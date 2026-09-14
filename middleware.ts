import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

// Edge 런타임에서 도는 미들웨어라, DB(pg)/bcrypt 등을 쓰는 전체 auth.ts 대신
// providers 없는 최소 설정(auth.config.ts)으로 별도 인스턴스를 만든다.
const { auth } = NextAuth(authConfig);

// 로그인 화면·인증 API·정적 자산을 제외한 모든 경로는 로그인해야 볼 수 있게 막는다.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    // public/ 아래 정적 파일(로고 등) — 로그인 전(=로그인 화면 자체)에도 보여야 함
    /\.(png|jpe?g|svg|ico|webp|gif|css|js)$/.test(pathname);

  if (isPublic || req.auth) return NextResponse.next();

  const loginUrl = new URL('/login', req.nextUrl.origin);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
