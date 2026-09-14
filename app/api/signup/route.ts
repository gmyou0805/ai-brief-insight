import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';

// "로그인 또는 가입" 통합 엔드포인트 — 이메일이 처음 보는 주소면 계정을 만들고,
// 이미 있으면 비밀번호를 검증한다. 로그인 화면의 이메일 입력 하나로 두 동작을 처리한다.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 해요.' }, { status: 400 });
  }

  const { rows } = await pool.query(
    'select id, password_hash from users where email = $1',
    [email]
  );
  const existing = rows[0];

  if (!existing) {
    // 신규 가입
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `insert into users (email, password_hash, provider, last_login_at)
       values ($1, $2, 'credentials', now())`,
      [email, hash]
    );
    return NextResponse.json({ created: true });
  }

  if (!existing.password_hash) {
    return NextResponse.json(
      { error: '이미 소셜 로그인으로 가입된 이메일이에요. 해당 계정으로 로그인해주세요.' },
      { status: 409 }
    );
  }

  const ok = await bcrypt.compare(password, existing.password_hash);
  if (!ok) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  }

  return NextResponse.json({ created: false });
}
