// 특허 수집 — KIPRIS(특허청) Open API 연동 예정.
//
// 무료 API 키 발급: https://plus.kipris.or.kr (회원가입 → OpenAPI 신청, 승인까지 1~2일 소요)
// .env 에 KIPRIS_API_KEY=... 추가하면 활성화됨. 키가 없으면 이 수집기는 자동으로 건너뛴다.
//
// (다른 소스와 달리 KIPRIS 는 API 키 발급에 회원가입·승인 절차가 필요해서
//  로그인·OAuth 키 발급과 마찬가지로 사용자 본인의 계정 작업이 필요함 — 아직 미등록.)
const KIPRIS_API_KEY = process.env.KIPRIS_API_KEY;

async function collectPatents() {
  if (!KIPRIS_API_KEY) {
    console.log('[특허] KIPRIS_API_KEY 없음 — 특허 수집 생략(발급 필요)');
    return [];
  }
  // TODO: KIPRIS Open API(특허·실용신안 검색 getWordSearch 등) 연동.
  // 키 발급 후 요청 주시면 여기에 실제 조회 로직을 구현합니다.
  console.log('[특허] KIPRIS_API_KEY 감지됨 — 연동 로직은 아직 미구현');
  return [];
}

module.exports = { collectPatents };
