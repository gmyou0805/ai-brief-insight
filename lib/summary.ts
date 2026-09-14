// 요약 소스 우선순위: ① Gemini AI 요약(summary_ko, 완성형 2문장) → ② 없으면 추출식(abstract 앞 문장 2개, 한 줄로 축약).

const ONE_LINE_LEN = 46; // 추출식일 때 한 줄에 들어가는 대략적인 글자 수

// "[데이터넷]", "[보안뉴스 김형근 기자]" 같은 대괄호 표기·이메일 제거
function stripBoilerplate(text: string): string {
  return text
    .replace(/\[[^\]]{0,24}\]/g, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 한 줄 길이를 넘으면 단어 중간이 아니라 쉼표·공백 등 자연스러운 지점에서 자른다.
function truncateAtBoundary(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const slice = s.slice(0, maxLen);
  const lastBreak = Math.max(
    slice.lastIndexOf(', '),
    slice.lastIndexOf('· '),
    slice.lastIndexOf(' ')
  );
  const cut = lastBreak > maxLen * 0.5 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}…`;
}

// AI 요약(완성형 문장) → 문장 그대로 최대 2개. 길이 제한 없음(자르지 않음).
function aiSummaryBullets(summaryKo: string): string[] {
  return summaryKo
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
    .slice(0, 2);
}

// 원문 설명에서 추출식으로 뽑아 한 줄 분량으로 다듬음. (AI 미사용, 무료 폴백용)
function extractiveBullets(abstract: string): string[] {
  const cleaned = stripBoilerplate(abstract);
  return cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .slice(0, 2)
    .map((s) => truncateAtBoundary(s, ONE_LINE_LEN));
}

export function summaryBullets(article: {
  abstract: string | null;
  summary_ko?: string | null;
}): string[] {
  if (article.summary_ko) {
    const bullets = aiSummaryBullets(article.summary_ko);
    if (bullets.length > 0) return bullets;
  }
  if (!article.abstract) return [];
  return extractiveBullets(article.abstract);
}
