// AI/보안 키워드 분류 규칙.
// scripts/fetch_and_summarize.js 의 AI_RULES/SECURITY_RULES, lib/categories.ts 와 동일하게 유지.
// (뉴스 수집 파이프라인과 분리된 신규 수집기 전용이라 별도 모듈로 둠 — 값은 반드시 동기화할 것)

const AI_RULES = [
  ['양자기술', ['양자', '퀀텀', 'quantum', '큐비트', 'qubit']],
  ['드론', ['드론', 'drone', 'uav']],
  ['반도체·인프라', ['반도체', '엔비디아', 'gpu', 'hbm', '칩', '데이터센터', 'tpu', 'npu', '파운드리', 'tsmc', '인프라']],
  ['로봇·자율주행', ['로봇', '휴머노이드', '자율주행', '자동차', '테슬라', '피지컬']],
  ['정책·규제', ['규제', '정책', '정부', '법안', '법률', '저작권', '소송', '개인정보', '규정', '당국', '국회']],
  ['기업·투자', ['투자', '인수', '상장', '펀딩', '자금조달', '매출', '실적', '지분', '유치', 'ipo', '기업가치']],
  ['생성형AI·LLM', ['llm', 'gpt', '챗gpt', '생성형', '언어모델', '오픈ai', '제미나이', '클로드', '라마', '미스트랄', '챗봇', '모델', '앤트로픽', '딥시크', '키미']],
  ['서비스·응용', ['출시', '앱', '플랫폼', '솔루션', '에이전트', '비서']],
  ['연구·기술', ['연구', '논문', '기술', '개발', '성능', '학습', '알고리즘', '벤치마크', '오픈소스']],
];

const SECURITY_RULES = [
  ['양자기술', ['양자', '퀀텀', 'quantum', '큐비트', 'qubit']],
  ['취약점·제로데이', ['취약점', '제로데이', 'cve', '패치', '익스플로잇', '버그', '결함', '보안 업데이트', '보안업데이트']],
  ['침해사고·정보유출', ['유출', '해킹', '침해', '공격', '탈취', '유출사고', '데이터 유출', '디도스', 'ddos', '해커']],
  ['랜섬웨어·악성코드', ['랜섬웨어', '악성코드', '멀웨어', 'apt', '피싱', '백도어', '트로이목마', '스미싱', '악성']],
  ['제로트러스트', ['제로트러스트', 'zero trust', 'zta', 'sase']],
  ['개인정보·보안규제', ['개인정보', '컴플라이언스', 'gdpr', '개인정보보호법', '보안 인증', '보안 규제', '보안규제']],
];

const COMBINED_RULES = [...AI_RULES, ...SECURITY_RULES];

// 카테고리 키워드가 우연히 걸려도 이 중 하나도 없으면 무관한 기사로 본다
// (예: "쌀의 활용도를 높이고" 처럼 일반 단어가 세부 키워드와 우연히 겹치는 것 방지)
const CORE_RELEVANCE_KEYWORDS = [
  'ai',
  '인공지능',
  '보안',
  '해킹',
  '공격',
  '침해',
  '유출',
  '취약점',
  '랜섬웨어',
  '악성코드',
  '피싱',
  '개인정보',
  '제로트러스트',
  '양자',
  '드론',
  '로봇',
  '반도체',
  'llm',
  'gpt',
  '생성형',
  '챗봇',
  '머신러닝',
  '딥러닝',
  '알고리즘',
];

function hasCoreRelevance(title, abstract) {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  return CORE_RELEVANCE_KEYWORDS.some((k) => text.includes(k));
}

function matchCategory(title, abstract, rules) {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  for (const [cat, kws] of rules) {
    if (kws.some((k) => text.includes(k.toLowerCase()))) return cat;
  }
  return null;
}

module.exports = {
  AI_RULES,
  SECURITY_RULES,
  COMBINED_RULES,
  matchCategory,
  hasCoreRelevance,
};
