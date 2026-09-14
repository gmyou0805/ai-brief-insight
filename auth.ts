// 로그인(Auth.js v5) 설정.
// - Naver/Kakao/Google/Microsoft OAuth + 이메일·비밀번호(Credentials) 지원.
// - DB 어댑터 없이 JWT 세션 전략을 쓰고, users 테이블은 signIn 콜백에서 직접 upsert 한다
//   (Credentials 로그인은 next-auth 어댑터가 기본 지원하지 않아서 이 방식이 가장 단순함).
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Kakao from 'next-auth/providers/kakao';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { authConfig } from './auth.config';

// 네이버는 next-auth 내장 프로바이더가 없어서 OAuth2 엔드포인트를 직접 지정.
function NaverProvider() {
  return {
    id: 'naver',
    name: 'Naver',
    type: 'oauth' as const,
    authorization: {
      url: 'https://nid.naver.com/oauth2.0/authorize',
      params: { response_type: 'code' },
    },
    token: 'https://nid.naver.com/oauth2.0/token',
    userinfo: 'https://openapi.naver.com/v1/nid/me',
    clientId: process.env.AUTH_NAVER_ID,
    clientSecret: process.env.AUTH_NAVER_SECRET,
    profile(profile: any) {
      const r = profile.response;
      return { id: r.id, name: r.name ?? r.nickname, email: r.email, image: r.profile_image };
    },
  };
}

async function upsertUser(email: string, name: string | null, image: string | null, provider: string) {
  const { rows } = await pool.query(
    `insert into users (email, name, image, provider, last_login_at)
     values ($1, $2, $3, $4, now())
     on conflict (email) do update set
       name = coalesce(excluded.name, users.name),
       image = coalesce(excluded.image, users.image),
       provider = excluded.provider,
       last_login_at = now()
     returning id`,
    [email, name, image, provider]
  );
  return rows[0].id as string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Kakao({
      clientId: process.env.AUTH_KAKAO_ID,
      clientSecret: process.env.AUTH_KAKAO_SECRET,
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ID,
      clientSecret: process.env.AUTH_MICROSOFT_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ISSUER, // 예: https://login.microsoftonline.com/<tenant-id>/v2.0
    }),
    NaverProvider(),
    Credentials({
      name: '이메일',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const { rows } = await pool.query(
          'select id, email, name, image, password_hash from users where email = $1',
          [email]
        );
        const user = rows[0];
        if (!user || !user.password_hash) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        await pool.query('update users set last_login_at = now() where id = $1', [user.id]);
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Credentials 는 authorize()에서 이미 검증·조회 끝났으니 그대로 통과.
      if (account?.provider === 'credentials') return true;
      if (!user.email) return false;
      await upsertUser(user.email, user.name ?? null, user.image ?? null, account?.provider ?? 'oauth');
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email as string;
      return session;
    },
  },
});
