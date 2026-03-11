import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthPage } from './AuthPage';

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockResendSignUpConfirmation = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockUpdatePassword = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    isLoading: false,
    signUp: mockSignUp,
    signIn: mockSignIn,
    resendSignUpConfirmation: mockResendSignUpConfirmation,
    requestPasswordReset: mockRequestPasswordReset,
    updatePassword: mockUpdatePassword,
    signOut: vi.fn(),
  }),
}));

function renderAuth(options?: { initialEntries?: string[] }) {
  return render(
    <MemoryRouter initialEntries={options?.initialEntries ?? ['/auth']}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/reset-password" element={<AuthPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders sign in by default', () => {
    renderAuth();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
  });

  it('hides self-serve signup in closed beta mode', () => {
    vi.stubEnv('VITE_AUTH_DISABLE_SIGNUP', 'true');
    vi.stubEnv('VITE_BETA_ACCESS_CONTACT', 'beta@facilitate.test');

    renderAuth();

    expect(screen.getByRole('heading', { name: /private beta sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign up$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /forgot password/i })).not.toBeInTheDocument();
    expect(screen.getByText(/access is limited to invited testers/i)).toBeInTheDocument();
    expect(screen.getByText(/beta@facilitate.test/i)).toBeInTheDocument();
  });

  it('shows check-email screen when sign-up returns no session', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null, user: { id: 'u1' } });
    renderAuth();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
  });

  it('allows resending confirmation email from not-confirmed sign-in error', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: 'Email not confirmed' },
      session: null,
      user: null,
    });
    mockResendSignUpConfirmation.mockResolvedValueOnce(null);

    renderAuth();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'nope@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/please confirm your email/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /resend confirmation email/i }));
    expect(mockResendSignUpConfirmation).toHaveBeenCalledWith('nope@example.com');
    expect(await screen.findByText(/we sent another confirmation email/i)).toBeInTheDocument();
  });

  it('supports forgot password flow and shows check-email screen', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce(null);
    renderAuth();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    await user.type(screen.getByLabelText(/email/i), 'reset@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText('reset@example.com')).toBeInTheDocument();
  });

  it('supports reset-password route and updates password', async () => {
    mockUpdatePassword.mockResolvedValueOnce(null);
    renderAuth({ initialEntries: ['/auth/reset-password'] });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), 'newpass123');
    await user.type(screen.getByLabelText(/^confirm new password$/i), 'newpass123');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(mockUpdatePassword).toHaveBeenCalledWith('newpass123');

    // We navigate back to /auth with a success message in route state.
    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });
});
