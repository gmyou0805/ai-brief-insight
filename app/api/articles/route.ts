import { NextRequest, NextResponse } from 'next/server';
import { pool, type Article } from '@/lib/db';
import { keywordForField, categoriesForField, type Field } from '@/lib/categories';

// 검색/필터/페이지네이션 (app/Browser.tsx 클라이언트 컴포넌트에서 호출).
// pg 는 서버(Node 런타임)에서만 동작하므로, 브라우저는 이 라우트를 거쳐야 한다.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const types = (sp.get('type') ?? '').split(',').filter(Boolean); // 콤마로 여러 채널(콘텐츠 유형) 선택(다중 선택 팝오버)
  const sources = (sp.get('source') ?? '').split(',').filter(Boolean); // 채널 유형 아래 세부 출처(예: 뉴스 → AI타임즈)
  const fields = (sp.get('field') ?? '').split(',').filter(Boolean) as Field[]; // 콤마로 여러 분야 선택(다중 선택 팝오버)
  const dateFrom = sp.get('from');
  const dateTo = sp.get('to');
  const q = (sp.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);

  const conditions: string[] = [];
  const params: unknown[] = [];
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (types.length > 0) conditions.push(`content_type = ANY(${addParam(types)})`);
  if (sources.length > 0) conditions.push(`section = ANY(${addParam(sources)})`);

  if (fields.length > 0) {
    // 선택된 분야가 여러 개면 OR 로 묶는다(분야별 조건은 키워드 매칭 또는 카테고리 매칭).
    const fieldConditions = fields.map((f) => {
      const kw = keywordForField(f);
      if (kw) return `title ILIKE ${addParam(`%${kw}%`)}`;
      return `category = ANY(${addParam(categoriesForField(f))})`;
    });
    conditions.push(`(${fieldConditions.join(' or ')})`);
  }

  if (dateFrom) conditions.push(`collected_for >= ${addParam(dateFrom)}`);
  if (dateTo) conditions.push(`collected_for <= ${addParam(dateTo)}`);

  if (q) {
    const safe = q.replace(/[,()%]/g, ' ').trim();
    if (safe) conditions.push(`title ILIKE ${addParam(`%${safe}%`)}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const countResult = await pool.query<{ count: string }>(
      `select count(*)::text as count from articles ${where}`,
      params
    );
    const count = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const offset = (page - 1) * PAGE_SIZE;
    const limitParam = addParam(PAGE_SIZE);
    const offsetParam = addParam(offset);

    const dataResult = await pool.query<Article>(
      `select * from articles ${where}
       order by published_at desc nulls last
       limit ${limitParam} offset ${offsetParam}`,
      params
    );

    return NextResponse.json({ data: dataResult.rows, count });
  } catch (err) {
    console.error('[api/articles] 조회 오류:', err);
    return NextResponse.json({ data: [], count: 0, error: '조회 실패' }, { status: 500 });
  }
}
