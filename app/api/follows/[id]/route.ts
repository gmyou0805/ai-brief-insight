import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const label = (body?.label ?? '').trim();
  if (!label) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `update follows
     set label = $1
     where id = $2
       and user_id = (select id from users where email = $3)
     returning id, source_type, target_url, label, created_at`,
    [label, params.id, session.user.email]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 이미 수집된 기사들의 채널 표시(articles.section)도 이전 이름에서 새 이름으로 함께 바꿔서
  // 인사이트 화면에 바로 반영되게 한다.
  const previousLabel = (body?.previousLabel ?? '').trim();
  if (previousLabel && previousLabel !== label) {
    await pool.query(
      `update articles set section = $1 where content_type = $2 and section = $3`,
      [label, rows[0].source_type, previousLabel]
    );
  }

  return NextResponse.json({ follow: rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  await pool.query(
    `delete from follows
     where id = $1
       and user_id = (select id from users where email = $2)`,
    [params.id, session.user.email]
  );
  return NextResponse.json({ ok: true });
}
