import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthPage } from './AuthPage';

const mockUseAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAuthPage(options?: { initialEntries?: string[] }) {
  return render(
    <MemoryRouter initialEntries={options?.initialEntries ?? ['/auth']}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<div data-testid="home-page">Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn: vi.fn(async () => ({ error: null, session: {}, user: {} })),
      signUp: vi.fn(async () => ({ error: null, session: {}, user: {} })),
    });
  });

  it('renders sign-in mode by default', () => {
    renderAuthPage();
    expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('toggles to sign-up mode', async () => {
    renderAuthPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^sign up$/i }));
    expect(
      screen.getByRole('heading', { level: 1, name: /create your account/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting without email', async () => {
    renderAuthPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/please enter your email address/i);
  });

  it('shows friendly error message on invalid credentials', async () => {
    const signIn = vi.fn(async () => ({
      error: new Error('Invalid login credentials'),
      session: null,
      user: null,
    }));
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signUp: vi.fn(),
    });

    renderAuthPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(signIn).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/incorrect email or password/i);
  });

  it('navigates to home on successful sign-in', async () => {
    const signIn = vi.fn(async () => ({ error: null, session: {}, user: {} }));
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn,
      signUp: vi.fn(),
    });

    renderAuthPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });

  it('shows confirmation guidance when sign-up succeeds but no session is created', async () => {
    const signUp = vi.fn(async () => ({ error: null, session: null, user: {} }));
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signIn: vi.fn(),
      signUp,
    });

    renderAuthPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(signUp).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/check your email to confirm/i);
    // Should not navigate away
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });

  it('redirects to home if user is already authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
    });

    renderAuthPage();

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });
});

