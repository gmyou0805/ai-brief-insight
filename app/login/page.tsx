'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!showPassword) {
      setShowPassword(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '문제가 발생했어요.');
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('로그인에 실패했어요.');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('네트워크 오류가 발생했어요.');
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <header className="topbar">
        <a href="/" className="topbar-brand">
          <img src="/logo.png" alt="시큐 인사이트" className="topbar-logo-img" />
        </a>

        <nav className="topbar-nav" aria-hidden="true">
          <span>소개</span>
          <span>기능</span>
          <span>요금제</span>
          <span>고객지원</span>
        </nav>

        <span className="topbar-cta" aria-hidden="true">
          로그인
        </span>
      </header>

      <main className="login-wrap">
        <div className="login-card">
          <img src="/logo.png" alt="시큐 인사이트" className="login-logo-img" />
          <h1 className="login-title">로그인 또는 가입</h1>

        <div className="login-oauth-grid">
          <button
            type="button"
            className="login-oauth-btn oauth-naver"
            onClick={() => signIn('naver')}
          >
            <span className="oauth-icon">N</span>
            <span>
              <strong>네이버</strong>
              <small>네이버로 계속하기</small>
            </span>
          </button>
          <button
            type="button"
            className="login-oauth-btn oauth-kakao"
            onClick={() => signIn('kakao')}
          >
            <span className="oauth-icon">💬</span>
            <span>
              <strong>카카오</strong>
              <small>카카오로 계속하기</small>
            </span>
          </button>
          <button
            type="button"
            className="login-oauth-btn oauth-google"
            onClick={() => signIn('google')}
          >
            <span className="oauth-icon">G</span>
            <span>
              <strong>Google</strong>
              <small>Google로 계속하기</small>
            </span>
          </button>
          <button
            type="button"
            className="login-oauth-btn oauth-microsoft"
            onClick={() => signIn('microsoft-entra-id')}
          >
            <span className="oauth-icon">⊞</span>
            <span>
              <strong>Microsoft</strong>
              <small>Microsoft로 계속하기</small>
            </span>
          </button>
        </div>

        <div className="login-divider">
          <span>또는</span>
        </div>

        <form className="login-email-form" onSubmit={handleEmailContinue}>
          <input
            type="email"
            className="login-input"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {showPassword && (
            <input
              type="password"
              className="login-input"
              placeholder="비밀번호 (8자 이상, 처음이면 새로 만들어져요)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          )}
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-continue-btn" disabled={loading}>
            {loading ? '처리 중…' : '계속하기'}
          </button>
        </form>

        </div>
      </main>
    </div>
  );
}
