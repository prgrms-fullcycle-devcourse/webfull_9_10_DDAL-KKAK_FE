import { createContext } from 'react';

/** 백엔드 콜백 응답의 user 객체 스키마와 맞춤 */
export type User = {
  id: string;
  name: string;
  imageUrl?: string;
} | null;

export type AuthCtx = {
  user: User;
  login: (user: User) => void;
  /**
   * 백엔드에 로그아웃 알리고 (refreshToken 파기) 로컬 상태 정리.
   * 네트워크 실패/404/401 등 어떤 결과든 로컬은 무조건 클리어 (best effort).
   */
  logout: () => Promise<void>;
  /**
   * 회원 탈퇴 — DELETE /auth/withdraw 호출 후 모든 로컬 데이터 삭제.
   * 404 USER_NOT_FOUND(이미 탈퇴됨)는 성공으로 처리.
   * 500 WITHDRAWAL_FAILED 등 진짜 실패는 throw → caller가 재시도 유도.
   */
  withdraw: () => Promise<void>;
};

export const AuthContext = createContext<AuthCtx | null>(null);
