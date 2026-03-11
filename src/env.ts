import { z } from 'zod';
import { ValidationError } from './utils/errors';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().trim().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().trim().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_SENTRY_DSN: z.string().trim().optional(),
});

const authUiEnvSchema = z.object({
  VITE_AUTH_DISABLE_SIGNUP: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  VITE_BETA_ACCESS_CONTACT: z.string().trim().optional(),
});

export interface ClientEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sentryDsn?: string;
}

export interface AuthUiEnv {
  isSignUpDisabled: boolean;
  betaAccessContact?: string;
}

let cachedClientEnv: ClientEnv | null = null;
let cachedAuthUiEnv: AuthUiEnv | null = null;

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

/**
 * Reads and validates client-safe runtime configuration for the browser bundle.
 */
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

/**
 * Reads browser-safe auth UI flags used to adapt the sign-in experience for private beta flows.
 */
export function getAuthUiEnv(): AuthUiEnv {
  if (cachedAuthUiEnv && !isTestRuntime()) return cachedAuthUiEnv;

  const parsed = authUiEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message);
    throw new ValidationError(formatIssueList(issues), { issues });
  }

  const contact = parsed.data.VITE_BETA_ACCESS_CONTACT?.trim();
  const authUiEnv = {
    isSignUpDisabled: parsed.data.VITE_AUTH_DISABLE_SIGNUP,
    betaAccessContact: contact ? contact : undefined,
  };
  if (!isTestRuntime()) {
    cachedAuthUiEnv = authUiEnv;
  }
  return authUiEnv;
}
