import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./contexts/PopupContext', () => ({
  PopupProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./contexts/RouteTransitionContext', () => ({
  RouteTransitionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./components/GlobalPopup', () => ({
  GlobalPopup: () => <div data-testid="global-popup" />,
}));

vi.mock('./components/ProtectedRoute', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    ProtectedRoute: () => <Outlet />,
  };
});

vi.mock('./pages/HomePage', () => ({
  HomePage: () => <div>Home Page Mock</div>,
}));

vi.mock('./pages/AuthPage', () => ({
  AuthPage: () => <div>Auth Page Mock</div>,
}));

vi.mock('./pages/AuthCallbackPage', () => ({
  AuthCallbackPage: () => <div>Auth Callback Page Mock</div>,
}));

vi.mock('./pages/EditorPage', () => ({
  EditorPage: () => <div>Editor Page Mock</div>,
}));

vi.mock('./pages/PreviewPage', () => ({
  PreviewPage: () => <div>Preview Page Mock</div>,
}));

vi.mock('./pages/PublishedSimulationPage', () => ({
  PublishedSimulationPage: () => <div>Published Page Mock</div>,
}));

function renderApp(pathname: string): void {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>
  );
}

describe('App routing', () => {
  it('renders the protected home route', async () => {
    renderApp('/');

    expect(await screen.findByText('Home Page Mock')).toBeInTheDocument();
    expect(screen.getByTestId('global-popup')).toBeInTheDocument();
  });

  it('renders the protected editor route', async () => {
    renderApp('/editor');

    expect(await screen.findByText('Editor Page Mock')).toBeInTheDocument();
  });

  it('renders the preview route', async () => {
    renderApp('/preview/test-project');

    expect(await screen.findByText('Preview Page Mock')).toBeInTheDocument();
  });

  it('renders the auth route', async () => {
    renderApp('/auth');

    expect(await screen.findByText('Auth Page Mock')).toBeInTheDocument();
  });

  it('renders the published route', async () => {
    renderApp('/published?token=test-token');

    expect(await screen.findByText('Published Page Mock')).toBeInTheDocument();
  });
});
