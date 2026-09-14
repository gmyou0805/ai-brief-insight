// 수집/리포트 스크립트(CommonJS)에서 공유하는 Postgres 커넥션 풀.
const { Pool, types } = require('pg');

// date/timestamptz 를 JS Date 로 자동 변환하지 않고 문자열 그대로 받는다.
// (generate_report.js 의 mmdd() 등이 'YYYY-MM-DD' 문자열을 직접 다룸)
types.setTypeParser(types.builtins.DATE, (v) => v);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => v);
types.setTypeParser(types.builtins.TIMESTAMP, (v) => v);
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));

let pool = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('환경변수 DATABASE_URL 이 없습니다. .env 또는 Secrets 를 확인하세요.');
  }
  const needsSsl = /sslmode=require/i.test(connectionString);
  pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

async function closePool() {
  if (pool) await pool.end();
}

module.exports = { getPool, closePool };
