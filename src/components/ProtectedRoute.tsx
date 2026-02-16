import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from './ui/LoadingScreen';

/**
 * Route guard for authenticated-only sections of the app.
 *
 * Shows a lightweight loading state while auth bootstraps, redirects
 * unauthenticated users to `/auth`, and renders nested routes otherwise.
 */
export function ProtectedRoute(): JSX.Element {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Restoring your session..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
