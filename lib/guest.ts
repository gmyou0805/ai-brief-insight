// 오픈 베타용 Guest 계정. users 테이블에 행을 만들지 않는 공용 세션이라
// 채널관리(follows) 같은 쓰기 기능은 사용할 수 없고 조회만 가능하다.
export const GUEST_EMAIL = 'guest@guest.local';
export const GUEST_NAME = 'Guest';

export function isGuest(email: string | null | undefined): boolean {
  return email === GUEST_EMAIL;
}
