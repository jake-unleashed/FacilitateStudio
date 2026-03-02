import { createClient } from '@supabase/supabase-js';
import { buildCorsHeaders, parseBearerToken } from '../../../shared/api/extractStepsHelpers.js';
import { validateWorldEnvironmentServerEnv } from '../../../shared/api/worldEnvironment/env.js';
import { getWorldEnvironmentStatus } from '../../../shared/api/worldEnvironment/helpers.js';
import {
  captureModelGenerationException,
  finalizeWithCors,
  jsonResponse,
} from '../../../shared/api/modelGeneration/routeHelpers.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
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

  const operationId = new URL(req.url).searchParams.get('operationId');
  if (!operationId) {
    return finalize(jsonResponse({ error: 'operationId is required' }, { status: 400 }));
  }

  const envValidation = validateWorldEnvironmentServerEnv(process.env);
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
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return finalize(jsonResponse({ error: 'Authentication required' }, { status: 401 }));
  }

  try {
    const status = await getWorldEnvironmentStatus({
      apiKey: envValidation.values.worldLabsApiKey,
      operationId,
    });
    return finalize(jsonResponse(status, { status: 200 }));
  } catch (error) {
    captureModelGenerationException(
      error,
      { requestId, operationId, stage: 'world_environment_status' },
      'ai_world_environment_status_error'
    );
    return finalize(jsonResponse({ error: 'Failed to fetch world generation status.' }, { status: 502 }));
  }
}
