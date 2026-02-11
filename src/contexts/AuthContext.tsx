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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async (): Promise<void> => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthContext] Failed to read initial session:', error);
      }

      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    };

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signUp({ email, password });
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
      signOut,
    }),
    [isLoading, session, signIn, signOut, signUp, user]
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
