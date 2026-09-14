import type { NextAuthConfig } from 'next-auth';

// 미들웨어(Edge 런타임)에서도 쓰는 최소 설정.
// DB(pg)·bcrypt 등 Node 전용 모듈은 Edge에서 못 돌아가니 여기 절대 넣지 않는다 —
// 실제 로그인 프로바이더(DB 접속 필요)는 auth.ts(Node 런타임 전용)에만 둔다.
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  // Vercel 프리뷰/커스텀 도메인 등 여러 호스트로 접속될 수 있어 Auth.js가
  // 호스트를 신뢰하도록 환경변수(AUTH_TRUST_HOST)만 믿지 않고 코드에서 명시.
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
