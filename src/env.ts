import { z } from 'zod';
import { ValidationError } from './utils/errors';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().trim().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().trim().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_SENTRY_DSN: z.string().trim().optional(),
});

export interface ClientEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sentryDsn?: string;
}

let cachedClientEnv: ClientEnv | null = null;

function isTestRuntime(): boolean {
  return (
    import.meta.env.MODE === 'test' ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')
  );
}

function formatIssueList(issues: string[]): string {
  return `Missing or invalid client environment variables: ${issues.join(
    '; '
  )}. Copy .env.example to .env.local and fill in the required values.`;
}

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv;

  if (isTestRuntime()) {
    cachedClientEnv = {
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'test-anon-key',
    };
    return cachedClientEnv;
  }

  const parsed = clientEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message);
    throw new ValidationError(formatIssueList(issues), { issues });
  }

  cachedClientEnv = {
    supabaseUrl: parsed.data.VITE_SUPABASE_URL,
    supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
    sentryDsn: parsed.data.VITE_SENTRY_DSN || undefined,
  };
  return cachedClientEnv;
}
