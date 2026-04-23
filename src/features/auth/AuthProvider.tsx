import { useState, type ReactNode } from 'react';
import { AuthContext, type User } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  return (
    <AuthContext.Provider
      value={{
        user,
        login: setUser,
        logout: () => setUser(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
