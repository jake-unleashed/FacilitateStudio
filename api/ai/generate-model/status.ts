import { createClient } from '@supabase/supabase-js';
import { buildCorsHeaders, parseBearerToken } from '../../../shared/api/extractStepsHelpers.js';
import { validateModelGenerationServerEnv } from '../../../shared/api/modelGeneration/env.js';
import { createGenerationProvider } from '../../../shared/api/modelGeneration/providerFactory.js';
import {
  captureModelGenerationException,
  finalizeWithCors,
  jsonResponse,
} from '../../../shared/api/modelGeneration/routeHelpers.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = buildCorsHeaders(
    req.headers.get('origin'),
    process.env.AI_GENERATE_ALLOWED_ORIGINS ?? process.env.AI_EXTRACT_ALLOWED_ORIGINS
  );
  const finalize = (response: Response): Response => finalizeWithCors(response, corsHeaders);

  if (req.method === 'OPTIONS') {
    return finalize(new Response(null, { status: 204 }));
  }
  if (req.method !== 'GET') {
    return finalize(jsonResponse({ error: 'Method Not Allowed' }, { status: 405 }));
  }

  const taskId = new URL(req.url).searchParams.get('taskId');
  if (!taskId) {
    return finalize(jsonResponse({ error: 'taskId is required' }, { status: 400 }));
  }

  const envValidation = validateModelGenerationServerEnv(process.env);
  if (!envValidation.ok) {
    return finalize(jsonResponse({ error: 'Server misconfiguration' }, { status: 500 }));
  }

  const token = parseBearerToken(req.headers.get('authorization'));
  if (!token) {
    return finalize(jsonResponse({ error: 'Authentication required' }, { status: 401 }));
  }

  const supabase = createClient(
    envValidation.values.supabaseUrl,
    envValidation.values.supabaseServiceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return finalize(jsonResponse({ error: 'Authentication required' }, { status: 401 }));
  }

  try {
    const provider = createGenerationProvider({
      provider: envValidation.values.provider,
      meshyApiKey: envValidation.values.meshyApiKey,
      tripoApiKey: envValidation.values.tripoApiKey,
    });
    const status = await provider.getTaskStatus(taskId);
    return finalize(jsonResponse(status, { status: 200 }));
  } catch (error) {
    captureModelGenerationException(error, { taskId, stage: 'status' }, 'ai_generate_model_status_error');
    return finalize(jsonResponse({ error: 'Failed to fetch generation status.' }, { status: 502 }));
  }
}
