import { createClient } from '@supabase/supabase-js';
import { getClientEnv } from '../env';

const env = getClientEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
