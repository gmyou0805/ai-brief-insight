# AI · 보안 뉴스 브리핑 (외부 공개판)

AI타임즈·보안뉴스·기술 블로그·유튜브·arXiv 논문·특허를 매일 수집해 **카테고리·출처별로 탐색·검색**할 수 있는 웹입니다.
Docker Compose 셀프 호스팅 버전을 **Vercel + Neon 으로 옮긴** 포트폴리오용 프로젝트입니다.

**Live:** https://ai-brief-insight.vercel.app

- Next.js 14 (App Router) · Auth.js v5 · PostgreSQL(pg)
- 라이트/다크 모드, 모바일 반응형

## 구조

```
[브라우저] ──▶ Vercel (Next.js, 서버리스)  ──SSL──▶  Neon (Postgres)
                  └ Route Handler/Server Component 에서만 DB 접속
```

> 수집 스크립트(cron)는 옮기지 않았습니다.  보여주며, 새 글이 자동으로 늘지는 않습니다.
> 수동 수집: 빌드 중 1회 수집하도록 옵션을 켜서 배포합니다(DB 접속값이 Vercel Secret 이라 빌드 환경에서 실행).
> ```bash
> vercel --prod --build-env COLLECT_ON_BUILD=1
> ```

## 배포 순서

### 1. Neon 프로젝트 생성 + 스키마 적용
[neon.tech](https://neon.tech) 가입 → 새 프로젝트(Region: Singapore 권장) → 연결 문자열 복사.

```bash
psql "<NEON_DATABASE_URL>" -f db/schema.sql
```
로컬에 `psql` 이 없으면 Neon 콘솔의 **SQL Editor** 에 `db/schema.sql` 내용을 붙여넣고 실행해도 됩니다.

### 2. 기존 DB → Neon 으로 기사 데이터 복사 (기존 Docker 서버에서 실행)
**`articles` 테이블만** 복사합니다. `users`/`follows`/`keywords`(계정·비밀번호 해시)는 옮기지 않습니다.

```bash
docker compose exec -T db pg_dump -U <DB_USER> -d <DB_NAME> --data-only --table=articles > articles.sql
docker compose exec -T db psql "<NEON_DATABASE_URL>" < articles.sql
```

### 3. Vercel 배포
```bash
npm i -g vercel
vercel            # 최초 1회: 로그인 + 프로젝트 연결(이 폴더 기준)
```
Vercel 프로젝트 **Settings > Environment Variables** 에 등록:

| 변수 | 값 |
|---|---|
| `DATABASE_URL` | Neon 연결 문자열(`?sslmode=require` 포함) |
| `AUTH_SECRET` | `openssl rand -base64 32` 로 새로 생성 |
| `AUTH_TRUST_HOST` | `true` |

등록 후 프로덕션 배포:
```bash
vercel --prod
```

### 4. 이후 업데이트 (자동 배포)
GitHub 저장소가 Vercel 프로젝트와 연결돼 있어 **`main` 브랜치에 push 하면 자동으로 프로덕션 배포**됩니다(다른 브랜치 push 는 Preview 배포).
```bash
git push origin main
```

## 로컬 개발
```bash
cp .env.example .env   # DATABASE_URL, AUTH_SECRET 채우기
npm install
npm run dev
```

## 참고
- 로그인은 "이메일+비밀번호 입력 시 처음 보는 이메일이면 바로 가입"되는 구조입니다(이메일 인증 없음).
- 디자인 토큰: `app/globals.css` 의 `:root`.
