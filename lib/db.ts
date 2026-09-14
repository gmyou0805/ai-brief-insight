import { Pool, types } from 'pg';

// pg 는 기본적으로 date/timestamptz 를 서버(로컬) 타임존 기준 JS Date 객체로 파싱하는데,
// 이 프로젝트는 'YYYY-MM-DD' 문자열을 그대로 다루도록 짜여 있다(lib/date.ts 등).
// Supabase(PostgREST) 시절과 동일하게 문자열 그대로 반환하도록 파서를 재정의한다.
types.setTypeParser(types.builtins.DATE, (v) => v); // date
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => v); // timestamptz
types.setTypeParser(types.builtins.TIMESTAMP, (v) => v); // timestamp
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10)); // bigint id → number

// 서버 전용 Postgres 커넥션 풀 (브라우저에서는 절대 import 하지 말 것).
// Next.js dev 모드의 모듈 재로딩(HMR)마다 새 Pool 이 생기는 걸 막기 위해
// globalThis 에 캐싱한다. (Vercel 서버리스에서도 warm invocation 간 재사용됨)

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('환경변수 DATABASE_URL 이 없습니다. .env 를 확인하세요.');
}

// Neon/Railway 등 대부분의 매니지드 Postgres 는 TLS 필수.
// 커넥션 문자열에 sslmode=require 가 있으면 SSL 활성화(자체 서명 인증서 허용).
const needsSsl = /sslmode=require/i.test(connectionString);

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5, // 서버리스 환경에서 인스턴스당 커넥션 폭주 방지(풀러 사용 권장)
  });

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

export type SourceLink = { label: string; url: string };

export type Article = {
  id: number;
  nyt_url: string;
  rank: number;
  title: string;
  abstract: string | null;
  summary_ko: string | null;
  category: string | null;
  image_url: string | null;
  byline: string | null;
  section: string | null;
  source_links: SourceLink[];
  published_at: string | null;
  collected_for: string | null;
  content_type: string;
};
