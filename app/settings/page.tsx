import { auth, signOut } from '@/auth';
import { DEFAULT_NEWS, DEFAULT_BLOGS, DEFAULT_YOUTUBE_CHANNELS } from '@/lib/defaultChannels';
import { isGuest } from '@/lib/guest';
import FollowsManager from './FollowsManager';

export const revalidate = 0;

export default async function SettingsPage() {
  const session = await auth();
  const username = session?.user?.name || session?.user?.email?.split('@')[0] || '';
  const initials = (username || '?').slice(0, 2).toUpperCase();
  const guest = isGuest(session?.user?.email);

  return (
    <>
      <header className="topbar">
        <a href="/" className="topbar-brand">
          <img src="/logo.png" alt="시큐 인사이트" className="topbar-logo-img" />
        </a>

        <nav className="topbar-nav">
          <a href="/" className="topbar-nav-link">
            인사이트
          </a>
          <a href="/settings" className="topbar-nav-link active">
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
        <div className="content-head-row">
          <h1 className="content-title">내 채널 관리</h1>
        </div>
        {!guest && <p className="sub">직접 추가한 채널은 다음날 오전 9시부터 수집 진행</p>}

        <FollowsManager
          defaultNews={DEFAULT_NEWS}
          defaultBlogs={DEFAULT_BLOGS}
          defaultYoutube={DEFAULT_YOUTUBE_CHANNELS}
          readOnly={guest}
        />
      </main>
    </>
  );
}
