import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { supabase } from '../lib/supabase';

function readAuthParam(name: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get(name) ?? searchParams.get(name);
}

export function AuthCallbackPage(): JSX.Element {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const authError = readAuthParam('error_description') ?? readAuthParam('error');
    const authType = readAuthParam('type');
    const hasAccessToken = Boolean(readAuthParam('access_token'));
    const hasRefreshToken = Boolean(readAuthParam('refresh_token'));
    const hasAuthPayload = hasAccessToken || hasRefreshToken || authType === 'signup' || authType === 'recovery';

    if (authError) {
      const decodedError = authError.replace(/\+/g, ' ');
      setErrorMessage(decodedError);
      return undefined;
    }

    if (authType === 'recovery') {
      navigate('/auth/reset-password', { replace: true });
      return undefined;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        navigate('/auth/reset-password', { replace: true });
        return;
      }

      if (session) {
        navigate('/', { replace: true });
      }
    });

    const bootstrap = async (): Promise<void> => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage('We could not confirm this link. Please request a new email and try again.');
        return;
      }

      if (data.session) {
        navigate('/', { replace: true });
        return;
      }

      if (!hasAuthPayload) {
        setErrorMessage('This confirmation link is invalid or has already been used.');
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (!errorMessage) {
    return <LoadingScreen message="Confirming your account..." />;
  }

  return (
    <div className="relative min-h-screen w-full bg-slate-100 px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#e2e8f0_50%,_#cbd5e1_100%)]"
        aria-hidden="true"
      />
      <main className="relative z-10 flex min-h-[80vh] items-center justify-center">
        <section className="w-full max-w-md rounded-[32px] border border-white/40 bg-white/75 p-7 text-center shadow-glass backdrop-blur-xl sm:p-8">
          <h1 className="text-lg font-bold tracking-tight text-slate-800">Link not valid</h1>
          <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="mt-6 w-full justify-center rounded-[20px]"
            onClick={() => navigate('/auth', { replace: true })}
          >
            Back to sign in
          </Button>
        </section>
      </main>
    </div>
  );
}
