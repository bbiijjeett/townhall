import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, profile, profileLoading } = useApp();
  const location = useLocation();

  // Wait for both session and profile to resolve
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // New users who haven't finished onboarding go to the welcome flow
  if (!profile?.onboarding_complete) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}
