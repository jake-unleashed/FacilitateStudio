import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Shared hook for obtaining the current authenticated user ID.
 * Keeps auth subscription logic in one place for upload flows and similar hooks.
 */
export function useSupabaseUserId(): string | undefined {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isActive = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (isActive) {
        setUserId(data.user?.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) {
        setUserId(session?.user.id);
      }
    });

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return userId;
}
