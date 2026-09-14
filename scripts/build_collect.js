// Vercel 빌드 중 1회 수집 — DATABASE_URL 이 Vercel Secret 이라 로컬에서 못 읽으므로 빌드 환경에서 실행한다.
// 평소 배포(git push)에는 아무것도 안 하고, 빌드 환경변수 COLLECT_ON_BUILD=1 일 때만 수집한다.
//   vercel --prod --build-env COLLECT_ON_BUILD=1
// 수집이 실패해도 사이트 배포 자체는 막지 않는다.
const { spawnSync } = require('child_process');
const path = require('path');

if (process.env.COLLECT_ON_BUILD !== '1') process.exit(0);

console.log('[build-collect] COLLECT_ON_BUILD=1 → 수집 스크립트 실행');
const r = spawnSync(process.execPath, [path.join(__dirname, 'fetch_and_summarize.js')], {
  stdio: 'inherit',
});
if (r.status !== 0) console.warn(`[build-collect] 수집 실패(exit ${r.status}) — 배포는 계속 진행`);
