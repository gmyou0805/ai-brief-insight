-- 순수 Postgres 스키마 (Neon/Railway/RDS/자체 호스팅 등 어디서든 psql 로 1회 실행).
-- 예: psql "$DATABASE_URL" -f db/schema.sql

create table if not exists articles (
  id bigint generated always as identity primary key,
  nyt_url text unique not null,          -- 중복 방지 키(대표 기사 URL)
  rank int,                              -- 그날의 Top10 순위(1~10)
  title text not null,
  abstract text,                         -- 원문 요약문
  summary_ko text,                       -- LLM 한국어 요약 (요약 생략 옵션시 null)
  category text,                         -- 카테고리(생성형AI·LLM 등)
  image_url text,                        -- 카드 썸네일 이미지
  byline text,                           -- 기자/작성자
  section text,                          -- 섹션/출처(예: AI타임즈, 보안뉴스)
  source_links jsonb default '[]'::jsonb,-- 관련 출처 링크들 [{label, url}, ...]
  published_at timestamptz,              -- 기사 발행일
  collected_for date,                    -- 어느 날짜분 수집인지(Top10 그룹 기준)
  collected_at timestamptz default now() -- 수집 시각
);

-- 콘텐츠 유형(news/paper/patent/blog/youtube) — 기존 테이블에도 안전하게 추가되도록 alter 로 분리
alter table articles add column if not exists content_type text not null default 'news';
create index if not exists idx_articles_content_type on articles (content_type);

-- 최신 날짜/랭크 조회 성능용 인덱스
create index if not exists idx_articles_collected_for
  on articles (collected_for desc, rank asc);

-- 카테고리 필터·발행일 정렬용 인덱스
create index if not exists idx_articles_category on articles (category);
create index if not exists idx_articles_published on articles (published_at desc);
-- 출처(section) 필터용 인덱스
create index if not exists idx_articles_section on articles (section);

-- ── 사용자 · 온톨로지(사용자-키워드-소스 관계) ──
-- User ──tracks──▶ Keyword
-- User ──follows─▶ Source(외부 채널/블로그 등)
create extension if not exists pgcrypto; -- gen_random_uuid() 용

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  image text,
  password_hash text,              -- 이메일/비밀번호 로그인 사용자만 값 있음(OAuth 전용은 null)
  provider text,                   -- 마지막 로그인 방식: credentials/google/kakao/naver/microsoft
  created_at timestamptz default now(),
  last_login_at timestamptz
);

create table if not exists keywords (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  keyword text not null,
  created_at timestamptz default now(),
  unique (user_id, keyword)
);

create table if not exists follows (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  source_type text not null,       -- 'youtube' | 'blog' | 'arxiv' | 'patent' 등
  target_url text not null,        -- 채널/블로그 URL 등
  label text,                      -- 목록에 보여줄 이름
  created_at timestamptz default now(),
  unique (user_id, source_type, target_url)
);

create index if not exists idx_keywords_user on keywords (user_id);
create index if not exists idx_follows_user on follows (user_id);

-- ── 참고 ──
-- Supabase 시절에는 RLS(Row Level Security) + anon 정책으로 "웹은 읽기 전용"을 강제했다.
-- 이제 웹(Next.js)도 서버 사이드(Route Handler/Server Component)에서만 DB에 접속하고
-- 브라우저는 절대 DB에 직접 붙지 않으므로, DB 레벨 RLS 없이 애플리케이션 코드가
-- 읽기 전용 쿼리만 날리는 것으로 충분하다. 더 엄격하게 가려면 DATABASE_URL 을
-- 두 개(쓰기용 owner 롤 / 읽기 전용 롤)로 나눠도 된다.
