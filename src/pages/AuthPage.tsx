import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { AuthCheckEmailPanel } from './auth/AuthCheckEmailPanel';
import { AuthFormPanel } from './auth/AuthFormPanel';
import { isEmailNotConfirmedError, toFriendlyAuthErrorMessage } from './auth/authErrors';
import type { AuthMode, AuthSuccessState, PendingEmailState } from './auth/authTypes';
import { logger } from '../utils/logger';

export function AuthPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    isLoading,
    signIn,
    signUp,
    resendSignUpConfirmation,
    requestPasswordReset,
    updatePassword,
  } = useAuth();

  const isResetPasswordRoute = location.pathname === '/auth/reset-password';
  const [mode, setMode] = useState<AuthMode>(isResetPasswordRoute ? 'reset-password' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(() => {
    const state = location.state as AuthSuccessState | null;
    return state?.authSuccessMessage ?? null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingEmailState, setPendingEmailState] = useState<PendingEmailState | null>(null);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [resendTargetEmail, setResendTargetEmail] = useState('');

  useEffect(() => {
    const state = location.state as AuthSuccessState | null;
    if (state?.authSuccessMessage) {
      setSuccessMessage(state.authSuccessMessage);
    }
  }, [location.state]);

  useEffect(() => {
    if (isResetPasswordRoute) {
      setMode('reset-password');
      setErrorMessage(null);
      setPendingEmailState(null);
      setCanResendConfirmation(false);
      return;
    }

    if (mode === 'reset-password') {
      setMode('sign-in');
      setErrorMessage(null);
      setCanResendConfirmation(false);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isResetPasswordRoute, mode]);

  useEffect(() => {
    if (!isLoading && user && mode !== 'reset-password') {
      navigate('/', { replace: true });
    }
  }, [isLoading, mode, navigate, user]);

  const title = useMemo(() => {
    if (mode === 'sign-up') return 'Create your account';
    if (mode === 'forgot-password') return 'Reset your password';
    if (mode === 'reset-password') return 'Choose a new password';
    return 'Welcome back';
  }, [mode]);

  const submitLabel = useMemo(() => {
    if (mode === 'sign-up') return 'Sign Up';
    if (mode === 'forgot-password') return 'Send reset link';
    if (mode === 'reset-password') return 'Update password';
    return 'Sign In';
  }, [mode]);

  const footerMessage = useMemo(
    () =>
      mode === 'sign-in'
        ? "Don't have an account?"
        : 'Already have an account?',
    [mode]
  );

  const footerActionLabel = mode === 'sign-in' ? 'Sign up' : 'Sign in';

  const switchToSignIn = (): void => {
    navigate('/auth', { replace: true, state: null });
    setMode('sign-in');
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingEmailState(null);
    setCanResendConfirmation(false);
    setPassword('');
    setConfirmPassword('');
  };

  const switchToSignUp = (): void => {
    navigate('/auth', { replace: true, state: null });
    setMode('sign-up');
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingEmailState(null);
    setCanResendConfirmation(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleResendConfirmation = async (targetEmail: string): Promise<void> => {
    const trimmedEmail = targetEmail.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address first.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const resendError = await resendSignUpConfirmation(trimmedEmail);
    setIsSubmitting(false);

    if (resendError) {
      setErrorMessage(toFriendlyAuthErrorMessage(resendError.message));
      return;
    }

    setSuccessMessage(`We sent another confirmation email to ${trimmedEmail}.`);
  };

  const handleResendPendingEmail = async (pendingState: PendingEmailState): Promise<void> => {
    if (pendingState.kind === 'sign-up') {
      await handleResendConfirmation(pendingState.email);
      return;
    }

    const trimmedEmail = pendingState.email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address first.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const resetError = await requestPasswordReset(trimmedEmail);
    setIsSubmitting(false);

    if (resetError) {
      setErrorMessage(toFriendlyAuthErrorMessage(resetError.message));
      return;
    }

    setSuccessMessage(`We sent another reset link to ${trimmedEmail}.`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setCanResendConfirmation(false);

    const trimmedEmail = email.trim();
    const needsEmail = mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot-password';
    const needsPassword = mode === 'sign-in' || mode === 'sign-up' || mode === 'reset-password';

    if (needsEmail && !trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (needsPassword && !password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'reset-password') {
      if (!confirmPassword) {
        setErrorMessage('Please confirm your new password.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'forgot-password') {
        const resetError = await requestPasswordReset(trimmedEmail);
        if (resetError) {
          setErrorMessage(toFriendlyAuthErrorMessage(resetError.message));
          return;
        }
        setPendingEmailState({
          email: trimmedEmail,
          kind: 'password-reset',
        });
        return;
      }

      if (mode === 'reset-password') {
        const updateError = await updatePassword(password);
        if (updateError) {
          setErrorMessage(toFriendlyAuthErrorMessage(updateError.message));
          return;
        }
        setMode('sign-in');
        navigate('/auth', {
          replace: true,
          state: { authSuccessMessage: 'Password updated. You can now sign in with your new password.' } satisfies AuthSuccessState,
        });
        setPassword('');
        setConfirmPassword('');
        return;
      }

      const result =
        mode === 'sign-in'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password);

      if (result.error) {
        setErrorMessage(toFriendlyAuthErrorMessage(result.error.message));
        if (mode === 'sign-in' && isEmailNotConfirmedError(result.error.message)) {
          setCanResendConfirmation(true);
          setResendTargetEmail(trimmedEmail);
        }
        return;
      }

      if (mode === 'sign-up' && !result.session) {
        setPendingEmailState({
          email: trimmedEmail,
          kind: 'sign-up',
        });
        setMode('sign-in');
        setPassword('');
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      logger.error('[AuthPage] Authentication failed:', error);
      setErrorMessage(
        error instanceof Error ? toFriendlyAuthErrorMessage(error.message) : 'Authentication failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Checking sign-in status..." />;
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
          {pendingEmailState ? (
            <AuthCheckEmailPanel
              pendingEmailState={pendingEmailState}
              isSubmitting={isSubmitting}
              successMessage={successMessage}
              errorMessage={errorMessage}
              onResend={() => void handleResendPendingEmail(pendingEmailState)}
              onBackToSignIn={switchToSignIn}
            />
          ) : (
            <AuthFormPanel
              mode={mode}
              title={title}
              submitLabel={submitLabel}
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              isSubmitting={isSubmitting}
              successMessage={successMessage}
              errorMessage={errorMessage}
              canResendConfirmation={canResendConfirmation}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleSubmit}
              onSwitchToSignIn={switchToSignIn}
              onSwitchToSignUp={switchToSignUp}
              onForgotPassword={() => {
                setMode('forgot-password');
                setErrorMessage(null);
                setSuccessMessage(null);
                setCanResendConfirmation(false);
                setPassword('');
                setConfirmPassword('');
              }}
              onResendConfirmation={() => void handleResendConfirmation(resendTargetEmail || email)}
              footerMessage={footerMessage}
              footerActionLabel={footerActionLabel}
              onFooterToggle={() => {
                if (mode === 'sign-in') {
                  switchToSignUp();
                  return;
                }
                switchToSignIn();
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
}
