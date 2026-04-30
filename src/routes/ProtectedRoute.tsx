import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

export function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    const onboardingDone = localStorage.getItem('onboarding_done');
    return <Navigate to={onboardingDone ? '/login' : '/onboarding'} replace />;
  }

  return <Outlet />;
}
