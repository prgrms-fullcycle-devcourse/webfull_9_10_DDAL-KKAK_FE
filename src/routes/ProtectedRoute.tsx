import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

export function ProtectedRoute() {
  const { user } = useAuth();

  // 로그인 안 돼있으면 로그인 페이지로 강제 이동
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 로그인 돼있으면 하위 라우트를 이 자리에 렌더
  return <Outlet />;
}
