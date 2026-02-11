import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { EditorPage } from './pages/EditorPage';
import { PreviewPage } from './pages/PreviewPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteTransitionProvider } from './contexts/RouteTransitionContext';
import { AuthProvider } from './contexts/AuthContext';

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
        <div className="flex h-screen w-full items-center justify-center bg-slate-100">
          <div className="text-slate-500">Loading…</div>
        </div>
      }
    >
      <ErrorBoundary>
        <AuthProvider>
          <RouteTransitionProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:id" element={<EditorPage />} />
              <Route path="/preview/:id" element={<PreviewPage />} />
              <Route path="/published" element={<PublishedSimulationPage />} />
            </Routes>
          </RouteTransitionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Suspense>
  );
}

export default App;
