import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { getClosedBetaSupportMessage } from './authCopy';
import type { AuthMode } from './authTypes';

interface AuthFormPanelProps {
  mode: AuthMode;
  title: string;
  submitLabel: string;
  email: string;
  password: string;
  confirmPassword: string;
  isClosedBeta: boolean;
  betaAccessContact?: string;
  isSubmitting: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  canResendConfirmation: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSwitchToSignIn: () => void;
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
  onResendConfirmation: () => void;
  footerMessage: string;
  footerActionLabel: string;
  onFooterToggle: () => void;
}

export function AuthFormPanel({
  mode,
  title,
  submitLabel,
  email,
  password,
  confirmPassword,
  isClosedBeta,
  betaAccessContact,
  isSubmitting,
  successMessage,
  errorMessage,
  canResendConfirmation,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSwitchToSignIn,
  onSwitchToSignUp,
  onForgotPassword,
  onResendConfirmation,
  footerMessage,
  footerActionLabel,
  onFooterToggle,
}: AuthFormPanelProps): JSX.Element {
  const closedBetaMessage = getClosedBetaSupportMessage(betaAccessContact);

  return (
    <>
      {!isClosedBeta && (mode === 'sign-in' || mode === 'sign-up') ? (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-[20px] border border-white/50 bg-white/40 p-1 shadow-sm">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSwitchToSignIn}
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
            onClick={onSwitchToSignUp}
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
      ) : null}

      <h1 className="text-center text-lg font-bold tracking-tight text-slate-800">{title}</h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        {mode === 'sign-in' &&
          (isClosedBeta
            ? 'Sign in with the tester account we provided to access the editor.'
            : 'Sign in to access your projects.')}
        {mode === 'sign-up' && 'Create an account to start saving projects in the cloud.'}
        {mode === 'forgot-password' && 'Enter your email and we will send a reset link.'}
        {mode === 'reset-password' && 'Choose a secure password with at least 6 characters.'}
      </p>

      {isClosedBeta && mode === 'sign-in' ? (
        <p className="mt-4 rounded-[16px] border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          {closedBetaMessage}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {(mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot-password') && (
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@company.com"
            required
            disabled={isSubmitting}
          />
        )}

        {(mode === 'sign-in' || mode === 'sign-up' || mode === 'reset-password') && (
          <Input
            label={mode === 'reset-password' ? 'New password' : 'Password'}
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            autoFocus={mode === 'reset-password'}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder={mode === 'reset-password' ? 'Enter your new password' : 'Enter password'}
            required
            disabled={isSubmitting}
          />
        )}

        {mode === 'reset-password' && (
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="Re-enter your new password"
            required
            disabled={isSubmitting}
          />
        )}

        {mode === 'sign-in' && !isClosedBeta ? (
          <div className="-mt-2 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              className="text-xs font-semibold text-blue-600 hover:text-blue-500"
              onClick={onForgotPassword}
            >
              Forgot password?
            </button>
          </div>
        ) : null}

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

        {canResendConfirmation ? (
          <button
            type="button"
            disabled={isSubmitting}
            className="w-full rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60"
            onClick={onResendConfirmation}
          >
            Resend confirmation email
          </button>
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

      {!isClosedBeta && (mode === 'sign-in' || mode === 'sign-up') ? (
        <div className="mt-5 text-center text-xs font-medium text-slate-500">
          {footerMessage}{' '}
          <button
            type="button"
            disabled={isSubmitting}
            className="font-semibold text-blue-600 hover:text-blue-500"
            onClick={onFooterToggle}
          >
            {footerActionLabel}
          </button>
        </div>
      ) : mode === 'forgot-password' || mode === 'reset-password' ? (
        <div className="mt-5 text-center text-xs font-medium text-slate-500">
          Remembered your password?{' '}
          <button
            type="button"
            disabled={isSubmitting}
            className="font-semibold text-blue-600 hover:text-blue-500"
            onClick={onSwitchToSignIn}
          >
            Back to sign in
          </button>
        </div>
      ) : null}
    </>
  );
}
