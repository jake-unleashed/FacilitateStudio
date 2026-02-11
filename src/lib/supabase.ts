import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isTest =
  import.meta.env.MODE === 'test' ||
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'test');

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
    !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
  ].filter((v): v is string => Boolean(v));

  if (!isTest) {
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(
        ', '
      )}. Copy .env.example to .env.local and fill them in.`
    );
  }
}

// In test runs we allow missing env vars and use dummy values, so modules that import
// the client (e.g. AuthContext) can be loaded without requiring a `.env.local`.
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'test-anon-key'
);
