import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'sign-in' | 'sign-up';

function toFriendlyAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  if (normalized.includes('password')) {
    return 'Your password does not meet requirements. Try at least 6 characters.';
  }

  if (normalized.includes('email')) {
    return 'Please enter a valid email address.';
  }

  return 'Authentication failed. Please try again.';
}

export function AuthPage(): JSX.Element {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/', { replace: true });
    }
  }, [isLoading, navigate, user]);

  const title = mode === 'sign-in' ? 'Welcome back' : 'Create your account';
  const submitLabel = mode === 'sign-in' ? 'Sign In' : 'Sign Up';

  const footerMessage = useMemo(
    () =>
      mode === 'sign-in'
        ? "Don't have an account?"
        : 'Already have an account?',
    [mode]
  );

  const footerActionLabel = mode === 'sign-in' ? 'Sign up' : 'Sign in';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        mode === 'sign-in'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password);

      if (result.error) {
        setErrorMessage(toFriendlyAuthErrorMessage(result.error.message));
        return;
      }

      // Many Supabase projects require email confirmation for sign-up, which creates the user but
      // does not establish a session yet. In that case, keep the user on this page with guidance.
      if (mode === 'sign-up' && !result.session) {
        setMode('sign-in');
        setPassword('');
        setSuccessMessage('Account created. Check your email to confirm, then sign in.');
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      console.error('[AuthPage] Authentication failed:', error);
      setErrorMessage(
        error instanceof Error ? toFriendlyAuthErrorMessage(error.message) : 'Authentication failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm font-medium text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-slate-100 selection:bg-blue-500/30 selection:text-white">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#e2e8f0_50%,_#cbd5e1_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -right-40 -top-40 h-[460px] w-[460px] rounded-full bg-blue-400/20 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-40 -left-40 h-[560px] w-[560px] rounded-full bg-indigo-400/15 blur-[120px]"
        aria-hidden="true"
      />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-[32px] border border-white/40 bg-white/75 p-7 shadow-glass backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center justify-center gap-2 rounded-[20px] border border-white/50 bg-white/40 p-1 shadow-sm">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setMode('sign-in');
                setErrorMessage(null);
                setSuccessMessage(null);
                setPassword('');
              }}
              className={`w-1/2 rounded-[12px] px-3 py-2 text-xs font-semibold transition-all ${
                mode === 'sign-in'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
              }`}
              aria-label="Switch to sign in mode"
              aria-pressed={mode === 'sign-in'}
            >
              Sign In
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setMode('sign-up');
                setErrorMessage(null);
                setSuccessMessage(null);
                setPassword('');
              }}
              className={`w-1/2 rounded-[12px] px-3 py-2 text-xs font-semibold transition-all ${
                mode === 'sign-up'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
              }`}
              aria-label="Switch to sign up mode"
              aria-pressed={mode === 'sign-up'}
            >
              Sign Up
            </button>
          </div>

          <h1 className="text-center text-lg font-bold tracking-tight text-slate-800">{title}</h1>
          <p className="mt-1 text-center text-sm text-slate-500">
            {mode === 'sign-in'
              ? 'Sign in to access your projects.'
              : 'Create an account to start saving projects in the cloud.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              disabled={isSubmitting}
            />
            <Input
              label="Password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
              disabled={isSubmitting}
            />

            {successMessage ? (
              <p
                className="rounded-[12px] border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800"
                role="status"
              >
                {successMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p
                className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              className="mt-1 w-full justify-center rounded-[20px]"
            >
              {isSubmitting ? 'Please wait...' : submitLabel}
            </Button>
          </form>

          <div className="mt-5 text-center text-xs font-medium text-slate-500">
            {footerMessage}{' '}
            <button
              type="button"
              disabled={isSubmitting}
              className="font-semibold text-blue-600 hover:text-blue-500"
              onClick={() => {
                setMode((prev) => (prev === 'sign-in' ? 'sign-up' : 'sign-in'));
                setErrorMessage(null);
                setSuccessMessage(null);
                setPassword('');
              }}
            >
              {footerActionLabel}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
