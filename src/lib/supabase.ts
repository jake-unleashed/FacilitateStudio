import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
    !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
  ].filter((v): v is string => Boolean(v));

  throw new Error(
    `Missing Supabase environment variable(s): ${missing.join(
      ', '
    )}. Copy .env.example to .env.local and fill them in.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
