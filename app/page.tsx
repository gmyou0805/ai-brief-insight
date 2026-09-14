import { pool, type Article } from '@/lib/db';
import { auth, signOut } from '@/auth';
import Browser from './Browser';

// 매 요청마다 최신 데이터 조회 (캐시 비활성)
export const revalidate = 0;

const HOME_PER_SOURCE_LIMIT = 5; // 첫 페이지 노출 제한(출처별)

function formatDateKo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

async function getLatestBrief(): Promise<{
  articles: Article[];
  date: string | null;
}> {
  // 가장 최근 수집일 찾기
  const latest = await pool.query<{ collected_for: string }>(
    'select collected_for from articles order by collected_for desc limit 1'
  );

  const date = latest.rows[0]?.collected_for ?? null;
  if (!date) return { articles: [], date: null };

  // 해당 날짜의 전체 소스 기사 (출처당 최대 HOME_PER_SOURCE_LIMIT 건으로 고르게 뽑되, 화면 표시는 최신순)
  const result = await pool.query<Article>(
    `select * from (
       select *, row_number() over (partition by section order by rank asc) as rn
       from articles
       where collected_for = $1
     ) ranked
     where rn <= $2
     order by published_at desc nulls last`,
    [date, HOME_PER_SOURCE_LIMIT]
  );

  return { articles: result.rows, date };
}

export default async function Home() {
  const [{ articles, date }, session] = await Promise.all([getLatestBrief(), auth()]);
  const username = session?.user?.name || session?.user?.email?.split('@')[0] || '';
  const initials = (username || '?').slice(0, 2).toUpperCase();

  return (
    <>
      <header className="topbar">
        <a href="/" className="topbar-brand">
          <img src="/logo.png" alt="시큐 인사이트" className="topbar-logo-img" />
        </a>

        <nav className="topbar-nav">
          <a href="/" className="topbar-nav-link active">
            인사이트
          </a>
          <a href="/settings" className="topbar-nav-link">
            채널관리
          </a>
        </nav>

        {session?.user && (
          <form
            className="topbar-user"
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <span className="topbar-username">{username}</span>
            <span className="topbar-avatar" aria-hidden="true">
              {initials}
            </span>
            <button type="submit" className="topbar-logout" aria-label="로그아웃" title="로그아웃">
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        )}
      </header>

      <main className="wrap">
        {articles.length === 0 ? (
          <div className="empty">
            <p>오늘 아직 수집된 뉴스가 없어요.</p>
            <p className="empty-sub">매일 아침 9시에 새 브리핑이 올라옵니다.</p>
          </div>
        ) : (
          <Browser initialArticles={articles} dateLabel={formatDateKo(date)} todayDate={date} />
        )}

        <footer className="foot">
          <span>
            출처: AI타임즈(aitimes.com) · 데일리시큐(dailysecu.com) · 데이터넷(datanet.co.kr) ·
            전자신문(etnews.com) · 지티티코리아(gttkorea.com)
          </span>
        </footer>
      </main>
    </>
  );
}
