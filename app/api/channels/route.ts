import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// 콘텐츠 유형별로 실제 현재 수집 중인 출처(채널) 목록 — 사이드바에서 채널 클릭 시
// 그 아래 세부 채널 목록을 보여주기 위함. 큐레이션 목록이 아니라 DB에 실제로 쌓인
// section 값 기준이라 "지금 수집되는 채널"을 그대로 반영한다.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await pool.query<{ content_type: string; section: string }>(
      `select distinct content_type, section
       from articles
       where section is not null
       order by content_type, section`
    );

    const byType: Record<string, string[]> = {};
    for (const row of rows) {
      if (!byType[row.content_type]) byType[row.content_type] = [];
      byType[row.content_type].push(row.section);
    }

    return NextResponse.json({ channels: byType });
  } catch (err) {
    console.error('[api/channels] 조회 오류:', err);
    return NextResponse.json({ channels: {} }, { status: 500 });
  }
}
