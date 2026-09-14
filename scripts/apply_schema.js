// db/schema.sql 을 DATABASE_URL(Neon 등)에 적용 — 로컬에 psql 이 없어도 됨.
// 사용: DATABASE_URL="postgresql://...?sslmode=require" node scripts/apply_schema.js
try {
  require('dotenv').config();
} catch {
  /* dotenv 미설치 → 무시 */
}
const fs = require('fs');
const path = require('path');
const { getPool, closePool } = require('./db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await getPool().query(sql);
  console.log('스키마 적용 완료');
  await closePool();
})().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
