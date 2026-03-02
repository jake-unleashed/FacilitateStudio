import { createClient } from '@supabase/supabase-js';
import {
  buildCorsHeaders,
  parseBearerToken,
  parseJsonBodyWithByteLimit,
  parseLimit,
  resolveClientIp,
} from '../../shared/api/extractStepsHelpers.js';
import { createExtractStepsRateLimiter } from '../../shared/api/extractStepsRateLimiter.js';
import {
  finalizeWithCors,
  jsonResponse,
  captureModelGenerationException,
} from '../../shared/api/modelGeneration/routeHelpers.js';
import {
  DEFAULT_WORLD_ENVIRONMENT_IP_LIMIT_PER_MINUTE,
  DEFAULT_WORLD_ENVIRONMENT_USER_LIMIT_PER_MINUTE,
  MAX_WORLD_ENVIRONMENT_REQUEST_BODY_BYTES,
} from '../../shared/api/worldEnvironment/constants.js';
import { validateWorldEnvironmentServerEnv } from '../../shared/api/worldEnvironment/env.js';
import {
  createWorldEnvironmentGeneration,
  parseWorldEnvironmentCreateRequestBody,
} from '../../shared/api/worldEnvironment/helpers.js';

export const config = { runtime: 'edge' };
const rateLimiter = createExtractStepsRateLimiter({
  env: process.env,
  onPersistentStoreError: (error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'ai_world_environment_rate_limit_store_error',
        error: error instanceof Error ? error.message : 'Unknown rate-limit store error',
      })
    );
  },
});

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
  if (req.method !== 'POST') {
    return finalize(jsonResponse({ error: 'Method Not Allowed' }, { status: 405 }));
  }

  const envValidation = validateWorldEnvironmentServerEnv(process.env);
  if (!envValidation.ok) {
    captureModelGenerationException(new Error(envValidation.message), {
      requestId,
      stage: 'env_validation',
    }, 'ai_world_environment_error');
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
  const userId = authData.user.id;

  const now = Date.now();
  const userLimit = parseLimit(
    process.env.AI_WORLD_ENV_RATE_LIMIT_PER_USER,
    DEFAULT_WORLD_ENVIRONMENT_USER_LIMIT_PER_MINUTE
  );
  const ipLimit = parseLimit(
    process.env.AI_WORLD_ENV_RATE_LIMIT_PER_IP,
    DEFAULT_WORLD_ENVIRONMENT_IP_LIMIT_PER_MINUTE
  );

  const userLimitResult = await rateLimiter.check(`world-env:user:${userId}`, userLimit, now);
  if (!userLimitResult.allowed) {
    return finalize(
      jsonResponse(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(userLimitResult.retryAfterSeconds) } }
      )
    );
  }

  const clientIp = resolveClientIp({
    xForwardedFor: req.headers.get('x-forwarded-for'),
    xRealIp: req.headers.get('x-real-ip'),
  });
  const ipLimitResult = await rateLimiter.check(`world-env:ip:${clientIp}`, ipLimit, now);
  if (!ipLimitResult.allowed) {
    return finalize(
      jsonResponse(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(ipLimitResult.retryAfterSeconds) } }
      )
    );
  }

  const parsedBody = await parseJsonBodyWithByteLimit(req, MAX_WORLD_ENVIRONMENT_REQUEST_BODY_BYTES);
  if (!parsedBody.ok) {
    return finalize(jsonResponse({ error: parsedBody.error }, { status: parsedBody.status }));
  }

  const parsedRequest = parseWorldEnvironmentCreateRequestBody(parsedBody.data);
  if (!parsedRequest.ok) {
    return finalize(jsonResponse({ error: parsedRequest.error }, { status: parsedRequest.status }));
  }

  try {
    const created = await createWorldEnvironmentGeneration({
      apiKey: envValidation.values.worldLabsApiKey,
      imageDataUrl: parsedRequest.imageDataUrl,
      imageName: parsedRequest.imageName,
    });
    return finalize(jsonResponse({ operationId: created.operationId }, { status: 200 }));
  } catch (error) {
    captureModelGenerationException(
      error,
      {
        requestId,
        userId,
        stage: 'world_environment_create',
      },
      'ai_world_environment_error'
    );
    return finalize(jsonResponse({ error: 'Failed to start world environment generation.' }, { status: 502 }));
  }
}
