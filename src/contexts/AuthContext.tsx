/* eslint-disable react-refresh/only-export-components */
// Disabled: This file exports both AuthProvider (component) and useAuth (hook).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthActionResult {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  resendSignUpConfirmation: (email: string) => Promise<Error | null>;
  requestPasswordReset: (email: string) => Promise<Error | null>;
  updatePassword: (password: string) => Promise<Error | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthSnapshot {
  user: User | null;
  session: Session | null;
  hasCachedSession: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isLikelyValidCachedSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;

  // Minimum fields we expect on a persisted Supabase session-like object.
  const hasAccessToken = typeof value.access_token === 'string' && value.access_token.length > 0;
  const hasUser = isRecord(value.user) && typeof value.user.id === 'string' && value.user.id.length > 0;

  // Some session shapes include expires_at (seconds since epoch). If present and expired, reject.
  const expiresAt = value.expires_at;
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (expiresAt <= nowSeconds) return false;
  }

  return hasAccessToken && hasUser;
}

function tryReadSessionFromSupabaseStorageValue(rawValue: string): Session | null {
  const parsedValue: unknown = JSON.parse(rawValue);
  const candidate = Array.isArray(parsedValue) ? parsedValue[0] : parsedValue;
  if (!isRecord(candidate)) {
    return null;
  }

  // Supabase storage value formats vary across versions. Prefer an explicit currentSession field.
  const potentialSession = 'currentSession' in candidate ? candidate.currentSession : candidate;
  return isLikelyValidCachedSession(potentialSession) ? (potentialSession as Session) : null;
}

function readCachedAuthSnapshot(): AuthSnapshot {
  if (typeof window === 'undefined') {
    return { user: null, session: null, hasCachedSession: false };
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) {
        continue;
      }

      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }

      const potentialSession = tryReadSessionFromSupabaseStorageValue(rawValue);
      if (!potentialSession) {
        continue;
      }

      return {
        session: potentialSession,
        user: potentialSession.user ?? null,
        hasCachedSession: true,
      };
    }
  } catch (error) {
    console.warn('[AuthContext] Failed to read cached auth snapshot:', error);
  }

  return { user: null, session: null, hasCachedSession: false };
}

function getEmailAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/auth/confirm`;
}

function clearSupabaseAuthHashIfPresent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.location.hash.includes('access_token=')) {
    return;
  }

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [initialSnapshot] = useState<AuthSnapshot>(() => readCachedAuthSnapshot());
  const [user, setUser] = useState<User | null>(initialSnapshot.user);
  const [session, setSession] = useState<Session | null>(initialSnapshot.session);
  const [isLoading, setIsLoading] = useState(!initialSnapshot.hasCachedSession);

  useEffect(() => {
    let isMounted = true;

    const setUserIfIdentityChanged = (nextUser: User | null): void => {
      setUser((currentUser) => {
        if (currentUser?.id === nextUser?.id) {
          return currentUser;
        }
        return nextUser;
      });
    };

    const bootstrapSession = async (): Promise<void> => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthContext] Failed to read initial session:', error);
      }

      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setUserIfIdentityChanged(data.session?.user ?? null);
      if (data.session) {
        clearSupabaseAuthHashIfPresent();
      }
      setIsLoading(false);
    };

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }
      setSession(nextSession);
      setUserIfIdentityChanged(nextSession?.user ?? null);
      if (nextSession) {
        clearSupabaseAuthHashIfPresent();
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getEmailAuthRedirectUrl(),
        },
      });
      return {
        error: error ?? null,
        session: data.session ?? null,
        user: data.user ?? null,
      };
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return {
        error: error ?? null,
        session: data.session ?? null,
        user: data.user ?? null,
      };
    },
    []
  );

  const resendSignUpConfirmation = useCallback(async (email: string): Promise<Error | null> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getEmailAuthRedirectUrl(),
      },
    });
    return error ?? null;
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<Error | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getEmailAuthRedirectUrl(),
    });
    return error ?? null;
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<Error | null> => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ?? null;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      signUp,
      signIn,
      resendSignUpConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      isLoading,
      requestPasswordReset,
      resendSignUpConfirmation,
      session,
      signIn,
      signOut,
      signUp,
      updatePassword,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
