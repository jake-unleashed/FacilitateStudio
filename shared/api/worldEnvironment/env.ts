import { z } from 'zod';

const requiredStringSchema = z.string().trim().min(1);
const supabaseUrlSchema = z.string().trim().url('SUPABASE_URL must be a valid URL');

function formatIssues(issues: string[]): string {
  return `World environment environment validation failed: ${issues.join('; ')}`;
}

export function validateWorldEnvironmentServerEnv(
  env: Record<string, string | undefined>,
  options: { allowViteSupabaseUrlFallback?: boolean } = {}
):
  | {
      ok: true;
      values: {
        worldLabsApiKey: string;
        supabaseUrl: string;
        supabaseServiceRoleKey: string;
      };
    }
  | {
      ok: false;
      message: string;
    } {
  const { allowViteSupabaseUrlFallback = false } = options;
  const worldLabsApiKeyResult = requiredStringSchema.safeParse(env.WORLD_LABS_API_KEY);
  const supabaseUrlResult = supabaseUrlSchema.safeParse(
    env.SUPABASE_URL ?? (allowViteSupabaseUrlFallback ? env.VITE_SUPABASE_URL : undefined)
  );
  const supabaseServiceRoleResult = requiredStringSchema.safeParse(env.SUPABASE_SERVICE_ROLE_KEY);

  if (!worldLabsApiKeyResult.success || !supabaseUrlResult.success || !supabaseServiceRoleResult.success) {
    const issues = [
      ...(!worldLabsApiKeyResult.success
        ? worldLabsApiKeyResult.error.issues.map((issue) => issue.message)
        : []),
      ...(!supabaseUrlResult.success ? supabaseUrlResult.error.issues.map((issue) => issue.message) : []),
      ...(!supabaseServiceRoleResult.success
        ? supabaseServiceRoleResult.error.issues.map((issue) => issue.message)
        : []),
    ];
    return {
      ok: false,
      message: formatIssues(issues),
    };
  }

  return {
    ok: true,
    values: {
      worldLabsApiKey: worldLabsApiKeyResult.data,
      supabaseUrl: supabaseUrlResult.data,
      supabaseServiceRoleKey: supabaseServiceRoleResult.data,
    },
  };
}
