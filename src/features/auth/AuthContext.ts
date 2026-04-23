import { createContext } from 'react';

export type User = { id: string; name: string } | null;

export type AuthCtx = {
  user: User;
  login: (user: User) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthCtx | null>(null);
