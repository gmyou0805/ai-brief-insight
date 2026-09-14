import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@/lib/db';

// 사용자별 팔로우(뉴스·블로그·유튜브 채널) 관리. 여기서 추가/삭제한 항목은
// scripts/fetch_and_summarize.js, scripts/collectors/blogs.js, scripts/collectors/youtube.js 가
// 다음 수집 실행 때 조회해서 반영한다(실시간 반영 아님 — 배치 수집 구조라 즉시 새 글이 나타나지는 않음).
export const dynamic = 'force-dynamic';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function getUserId(email: string): Promise<string | null> {
  const { rows } = await pool.query('select id from users where email = $1', [email]);
  return rows[0]?.id ?? null;
}

// 유튜브 채널 URL(@핸들, /channel/UC..., /c/이름, /user/이름 등 다양한 형태)을
// 실제 채널 ID(UC...)로 변환하고, 채널명을 라벨로 함께 가져온다.
async function resolveYoutubeChannel(
  input: string
): Promise<{ id: string; label: string } | null> {
  // /channel/UC... URL 형태이거나, 이미 채널 ID(UC...) 그 자체인 경우(기본 제공 채널 편집 등)
  const directMatch = input.match(/\/channel\/(UC[\w-]{10,})/) ?? input.trim().match(/^(UC[\w-]{10,})$/);
  let channelId = directMatch?.[1] ?? null;

  if (!channelId) {
    let pageUrl = input;
    if (!/^https?:\/\//.test(pageUrl)) {
      pageUrl = `https://www.youtube.com/${pageUrl.replace(/^@?/, '@')}`;
    }
    try {
      const res = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/"channelId":"(UC[\w-]{10,})"/) ?? html.match(/channel\/(UC[\w-]{10,})/);
      channelId = m?.[1] ?? null;
    } catch {
      return null;
    }
  }
  if (!channelId) return null;

  try {
    const feedRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { headers: { 'User-Agent': UA } }
    );
    if (!feedRes.ok) return null;
    const xml = await feedRes.text();
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    return { id: channelId, label: titleMatch?.[1]?.trim() || channelId };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ follows: [] });

  const { rows } = await pool.query(
    `select id, source_type, target_url, label, created_at
     from follows where user_id = $1
     order by created_at desc`,
    [userId]
  );
  return NextResponse.json({ follows: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sourceType = body?.sourceType;
  const rawUrl = (body?.url ?? '').trim();

  if (!rawUrl || (sourceType !== 'youtube' && sourceType !== 'blog' && sourceType !== 'news')) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

  let targetUrl = rawUrl;
  let label: string | null = (body?.label ?? '').trim() || null;
  const previousLabel: string = (body?.previousLabel ?? '').trim();

  if (sourceType === 'youtube') {
    const resolved = await resolveYoutubeChannel(rawUrl);
    if (!resolved) {
      return NextResponse.json(
        { error: '유튜브 채널을 찾을 수 없어요. 채널 URL을 다시 확인해주세요.' },
        { status: 400 }
      );
    }
    targetUrl = resolved.id;
    if (!label) label = resolved.label;
  } else {
    try {
      const u = new URL(rawUrl);
      if (!label) label = u.hostname.replace(/^www\./, '');
    } catch {
      return NextResponse.json({ error: '올바른 URL을 입력해주세요.' }, { status: 400 });
    }
  }

  try {
    const { rows } = await pool.query(
      `insert into follows (user_id, source_type, target_url, label)
       values ($1, $2, $3, $4)
       on conflict (user_id, source_type, target_url) do update set label = excluded.label
       returning id, source_type, target_url, label, created_at`,
      [userId, sourceType, targetUrl, label]
    );

    // 기본 제공 채널을 처음 수정한 경우: 이미 수집된 기사들의 채널 표시(articles.section)도
    // 기존 이름에서 새 이름으로 함께 바꿔서 인사이트 화면에 바로 반영되게 한다.
    if (previousLabel && label && previousLabel !== label) {
      await pool.query(
        `update articles set section = $1 where content_type = $2 and section = $3`,
        [label, sourceType, previousLabel]
      );
    }

    return NextResponse.json({ follow: rows[0] });
  } catch (err) {
    console.error('[api/follows] 추가 오류:', err);
    return NextResponse.json({ error: '추가 중 오류가 발생했어요.' }, { status: 500 });
  }
}
