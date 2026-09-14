// 'YYYY-MM-DD' 또는 ISO 타임스탬프 → "2025.01.01" 형식.
// 타임존 이슈를 피하기 위해 Date 파싱 대신 문자열에서 직접 추출.
export function formatDateDot(value: string | null | undefined): string {
  if (!value) return '';
  const m = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[1]}.${m[2]}.${m[3]}`;
}
