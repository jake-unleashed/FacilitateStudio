import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { EditorPage } from './pages/EditorPage';
import { PreviewPage } from './pages/PreviewPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalPopup } from './components/GlobalPopup';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { RouteTransitionProvider } from './contexts/RouteTransitionContext';
import { AuthProvider } from './contexts/AuthContext';
import { PopupProvider } from './contexts/PopupContext';

const PublishedSimulationPage = lazy(async () => {
  const mod = await import('./pages/PublishedSimulationPage');
  return { default: mod.PublishedSimulationPage };
});

/**
 * App - Root component with routing between HomePage, EditorPage, and PreviewPage.
 */
function App() {
  return (
    <Suspense
      fallback={
        <LoadingScreen message="Loading workspace..." />
      }
    >
      <ErrorBoundary>
        <PopupProvider>
          <AuthProvider>
            <RouteTransitionProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/reset-password" element={<AuthPage />} />
                <Route path="/auth/confirm" element={<AuthCallbackPage />} />
                <Route path="/published" element={<PublishedSimulationPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/editor" element={<EditorPage />} />
                  <Route path="/editor/:id" element={<EditorPage />} />
                  <Route path="/preview/:id" element={<PreviewPage />} />
                </Route>
              </Routes>
              <GlobalPopup />
            </RouteTransitionProvider>
          </AuthProvider>
        </PopupProvider>
      </ErrorBoundary>
    </Suspense>
  );
}

export default App;
