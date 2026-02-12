import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route guard for authenticated-only sections of the app.
 *
 * Shows a lightweight loading state while auth bootstraps, redirects
 * unauthenticated users to `/auth`, and renders nested routes otherwise.
 */
export function ProtectedRoute(): JSX.Element {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
