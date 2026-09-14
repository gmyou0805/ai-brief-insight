// 카테고리·출처 목록 (scripts/fetch_and_summarize.js 의 규칙과 동일하게 유지)

export const AI_CATEGORIES = [
  '양자기술',
  '드론',
  '생성형AI·LLM',
  '반도체·인프라',
  '기업·투자',
  '정책·규제',
  '로봇·자율주행',
  '서비스·응용',
  '연구·기술',
  '기타',
] as const;

export const SECURITY_CATEGORIES = [
  '취약점·제로데이',
  '침해사고·정보유출',
  '랜섬웨어·악성코드',
  '제로트러스트',
  '양자기술',
  '개인정보·보안규제',
  '기타',
] as const;

// 출처(= articles.section 값)
export const SOURCES = [
  'AI타임즈',
  '데일리시큐',
  '데이터넷',
  '전자신문',
  '지티티코리아',
] as const;
export type Source = (typeof SOURCES)[number];

// 출처별 카테고리 목록. '전체'는 양쪽 합집합.
export function categoriesFor(source: string): string[] {
  if (source === 'AI타임즈') return [...AI_CATEGORIES];
  if (source === '데일리시큐') return [...SECURITY_CATEGORIES];
  // 전체: 중복 제거한 합집합
  return Array.from(new Set([...AI_CATEGORIES, ...SECURITY_CATEGORIES]));
}

// ── 분야(사이드바 → 채널/분야 팝오버로 이동) ──
export const FIELDS = [
  'AI',
  '양자',
  '드론',
  '정책동향',
  '침해사고',
  '제로트러스트',
  '모빌리티',
  '우주',
  '로봇',
  '클라우드',
  '공급망',
  '컨테이너',
  '운영기술(OT)',
  '랜섬웨어',
  '취약점',
  '인텔리전스',
  '다크웹',
  '피싱',
  '디도스',
  '암호',
  '규제인증',
  '기타',
] as const;
export type Field = (typeof FIELDS)[number];

// 분야 → 세부 카테고리 매핑(전용 카테고리가 있는 분야만)
// '로봇' 분야는 없앰 — 로봇·자율주행 카테고리는 AI 분야로 편입.
const FIELD_CATEGORIES: Partial<Record<Field, string[]>> = {
  AI: ['생성형AI·LLM', '반도체·인프라', '기업·투자', '서비스·응용', '연구·기술', '로봇·자율주행'],
  정책동향: ['정책·규제', '개인정보·보안규제'],
  침해사고: ['취약점·제로데이', '침해사고·정보유출', '랜섬웨어·악성코드'],
  제로트러스트: ['제로트러스트'],
  양자: ['양자기술'],
  드론: ['드론'],
  기타: ['기타'],
};

// 전용 카테고리가 없는 분야는 제목 키워드로 판별
const FIELD_KEYWORDS: Partial<Record<Field, string>> = {
  양자: '양자',
  드론: '드론',
  제로트러스트: '제로트러스트',
  모빌리티: '모빌리티',
  우주: '우주',
  로봇: '로봇',
  클라우드: '클라우드',
  공급망: '공급망',
  컨테이너: '컨테이너',
  '운영기술(OT)': '운영기술',
  랜섬웨어: '랜섬웨어',
  취약점: '취약점',
  인텔리전스: '인텔리전스',
  다크웹: '다크웹',
  피싱: '피싱',
  디도스: '디도스',
  암호: '암호',
  규제인증: '규제인증',
};

export function categoriesForField(field: Field): string[] {
  return FIELD_CATEGORIES[field] ?? [];
}

export function keywordForField(field: Field): string | null {
  return FIELD_KEYWORDS[field] ?? null;
}

// 기사 하나가 어떤 분야에 속하는지 판별(사이드바 클라이언트 필터링용)
export function fieldOf(article: { category: string | null; title: string }): Field {
  for (const f of FIELDS) {
    const kw = FIELD_KEYWORDS[f];
    if (kw && article.title?.includes(kw)) return f;
  }
  for (const f of FIELDS) {
    const cats = FIELD_CATEGORIES[f];
    if (cats && cats.includes(article.category ?? '')) return f;
  }
  return '기타';
}

// 분야별 배지 색상(CSS 클래스 접미사). globals.css 의 .cat-* 규칙과 짝을 이룸.
const FIELD_COLOR_SLUG: Record<Field, string> = {
  AI: 'ai',
  양자: 'quantum',
  드론: 'drone',
  정책동향: 'policy',
  침해사고: 'incident',
  제로트러스트: 'zerotrust',
  모빌리티: 'mobility',
  우주: 'space',
  로봇: 'robot',
  클라우드: 'cloud',
  공급망: 'supplychain',
  컨테이너: 'container',
  '운영기술(OT)': 'ot',
  랜섬웨어: 'ransomware',
  취약점: 'vuln',
  인텔리전스: 'intel',
  다크웹: 'darkweb',
  피싱: 'phishing',
  디도스: 'ddos',
  암호: 'crypto',
  규제인증: 'compliance',
  기타: 'etc',
};

export function fieldColorClass(field: Field): string {
  return FIELD_COLOR_SLUG[field] ?? 'etc';
}

// ── 콘텐츠 유형(뉴스 외 논문·특허·블로그·유튜브) ──
export const CONTENT_TYPES = ['news', 'blog', 'youtube', 'paper', 'patent'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  news: '뉴스',
  paper: '논문',
  patent: '특허',
  blog: '블로그',
  youtube: '유튜브',
};
