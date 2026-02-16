import { Button } from '../../components/Button';
import type { PendingEmailState } from './authTypes';

interface AuthCheckEmailPanelProps {
  pendingEmailState: PendingEmailState;
  isSubmitting: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  onResend: () => void;
  onBackToSignIn: () => void;
}

export function AuthCheckEmailPanel({
  pendingEmailState,
  isSubmitting,
  successMessage,
  errorMessage,
  onResend,
  onBackToSignIn,
}: AuthCheckEmailPanelProps): JSX.Element {
  return (
    <>
      <h1 className="text-center text-lg font-bold tracking-tight text-slate-800">Check your inbox</h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        {pendingEmailState.kind === 'sign-up'
          ? 'We sent a confirmation link to:'
          : 'We sent a password reset link to:'}
      </p>
      <p className="mt-2 rounded-[12px] border border-slate-200 bg-white/70 px-3 py-2 text-center text-sm font-semibold text-slate-700">
        {pendingEmailState.email}
      </p>
      <p className="mt-3 text-center text-xs text-slate-500">
        Check your spam folder if it does not arrive within a minute.
      </p>

      {successMessage ? (
        <p
          className="mt-4 rounded-[12px] border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={isSubmitting}
        className="mt-5 w-full justify-center rounded-[20px]"
        onClick={onResend}
      >
        {isSubmitting ? 'Please wait...' : 'Resend email'}
      </Button>

      <button
        type="button"
        disabled={isSubmitting}
        className="mt-4 w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-500"
        onClick={onBackToSignIn}
      >
        Back to sign in
      </button>
    </>
  );
}
