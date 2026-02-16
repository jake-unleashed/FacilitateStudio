import { z } from 'zod';

const openAiApiKeySchema = z.string().trim().min(1, 'OPENAI_API_KEY is required');
const supabaseServiceRoleSchema = z
  .string()
  .trim()
  .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required');
const supabaseUrlSchema = z.string().trim().url('SUPABASE_URL must be a valid URL');

/**
 * @param {string[]} issues
 * @returns {string}
 */
function formatIssues(issues) {
  return `Server environment validation failed: ${issues.join('; ')}`;
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ allowViteSupabaseUrlFallback?: boolean }} [options]
 * @returns {{
 *   ok: true;
 *   values: {
 *     openAiApiKey: string;
 *     supabaseUrl: string;
 *     supabaseServiceRoleKey: string;
 *   };
 * } | {
 *   ok: false;
 *   message: string;
 * }}
 */
export function validateExtractStepsServerEnv(env, options = {}) {
  const { allowViteSupabaseUrlFallback = false } = options;
  const supabaseUrlCandidate =
    env.SUPABASE_URL ??
    (allowViteSupabaseUrlFallback ? env.VITE_SUPABASE_URL : undefined);

  const openAiApiKeyResult = openAiApiKeySchema.safeParse(env.OPENAI_API_KEY);
  const supabaseUrlResult = supabaseUrlSchema.safeParse(supabaseUrlCandidate);
  const supabaseServiceRoleResult = supabaseServiceRoleSchema.safeParse(
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const issues = [
    ...(!openAiApiKeyResult.success ? openAiApiKeyResult.error.issues.map((i) => i.message) : []),
    ...(!supabaseUrlResult.success ? supabaseUrlResult.error.issues.map((i) => i.message) : []),
    ...(!supabaseServiceRoleResult.success
      ? supabaseServiceRoleResult.error.issues.map((i) => i.message)
      : []),
  ];

  if (issues.length > 0) {
    return {
      ok: false,
      message: formatIssues(issues),
    };
  }

  return {
    ok: true,
    values: {
      openAiApiKey: openAiApiKeyResult.data,
      supabaseUrl: supabaseUrlResult.data,
      supabaseServiceRoleKey: supabaseServiceRoleResult.data,
    },
  };
}
