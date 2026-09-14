'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'email' | 'guest' | null>(null);
  const [error, setError] = useState('');

  // 이메일 주소만으로 로그인 — 처음 보는 이메일이면 서버(auth.ts)에서 바로 가입된다.
  async function enter(provider: 'email' | 'guest') {
    setError('');
    setLoading(provider);
    try {
      const result = await signIn(provider, {
        ...(provider === 'email' ? { email } : {}),
        redirect: false,
      });
      if (result?.error) {
        setError(provider === 'email' ? '올바른 이메일 주소를 입력해주세요.' : '입장에 실패했어요.');
        setLoading(null);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('네트워크 오류가 발생했어요.');
      setLoading(null);
    }
  }

  return (
    <div className="login-page">
      <header className="topbar">
        <a href="/" className="topbar-brand">
          <img src="/logo.png" alt="시큐 인사이트" className="topbar-logo-img" />
        </a>
      </header>

      <main className="login-wrap">
        <div className="login-card">
          <img src="/logo.png" alt="시큐 인사이트" className="login-logo-img" />
          <h1 className="login-title">로그인 또는 가입</h1>

          <p className="login-beta-notice">현재는 오픈 베타 테스트로서 Guest로 로그인 가능합니다.</p>

          <form
            className="login-email-form"
            onSubmit={(e) => {
              e.preventDefault();
              enter('email');
            }}
          >
            <input
              type="email"
              className="login-input"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-continue-btn" disabled={loading !== null}>
              {loading === 'email' ? '처리 중…' : '계속하기'}
            </button>
          </form>

          <div className="login-divider">
            <span>또는</span>
          </div>

          <button
            type="button"
            className="login-guest-btn"
            onClick={() => enter('guest')}
            disabled={loading !== null}
          >
            {loading === 'guest' ? '입장 중…' : 'Guest로 입장'}
          </button>
        </div>
      </main>
    </div>
  );
}
