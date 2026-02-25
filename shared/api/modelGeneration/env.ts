import { z } from 'zod';
import type { SupportedGenerationProvider } from './types.js';

const providerSchema = z.enum(['meshy', 'tripo']);
const requiredStringSchema = z.string().trim().min(1);
const supabaseUrlSchema = z.string().trim().url('SUPABASE_URL must be a valid URL');

function formatIssues(issues: string[]): string {
  return `Model generation environment validation failed: ${issues.join('; ')}`;
}

export function validateModelGenerationServerEnv(
  env: Record<string, string | undefined>,
  options: { allowViteSupabaseUrlFallback?: boolean } = {}
):
  | {
      ok: true;
      values: {
        provider: SupportedGenerationProvider;
        meshyApiKey?: string;
        tripoApiKey?: string;
        openAiApiKey?: string;
        supabaseUrl: string;
        supabaseServiceRoleKey: string;
      };
    }
  | {
      ok: false;
      message: string;
    } {
  const { allowViteSupabaseUrlFallback = false } = options;
  const providerResult = providerSchema.safeParse(env.AI_3D_PROVIDER ?? 'meshy');
  const supabaseUrlResult = supabaseUrlSchema.safeParse(
    env.SUPABASE_URL ?? (allowViteSupabaseUrlFallback ? env.VITE_SUPABASE_URL : undefined)
  );
  const supabaseServiceRoleResult = requiredStringSchema.safeParse(env.SUPABASE_SERVICE_ROLE_KEY);
  const meshyApiKeyResult = requiredStringSchema.safeParse(env.MESHY_API_KEY);
  const tripoApiKeyResult = requiredStringSchema.safeParse(env.TRIPO_API_KEY);
  const openAiApiKeyResult = requiredStringSchema.safeParse(env.OPENAI_API_KEY);

  if (!providerResult.success || !supabaseUrlResult.success || !supabaseServiceRoleResult.success) {
    const issues = [
      ...(!providerResult.success ? providerResult.error.issues.map((issue) => issue.message) : []),
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

  const provider = providerResult.data;
  if (provider === 'meshy' && !meshyApiKeyResult.success) {
    return {
      ok: false,
      message: formatIssues(meshyApiKeyResult.error.issues.map((issue) => issue.message)),
    };
  }

  if (provider === 'tripo' && !tripoApiKeyResult.success) {
    return {
      ok: false,
      message: formatIssues(tripoApiKeyResult.error.issues.map((issue) => issue.message)),
    };
  }

  return {
    ok: true,
    values: {
      provider,
      meshyApiKey: meshyApiKeyResult.success ? meshyApiKeyResult.data : undefined,
      tripoApiKey: tripoApiKeyResult.success ? tripoApiKeyResult.data : undefined,
      openAiApiKey: openAiApiKeyResult.success ? openAiApiKeyResult.data : undefined,
      supabaseUrl: supabaseUrlResult.data,
      supabaseServiceRoleKey: supabaseServiceRoleResult.data,
    },
  };
}
