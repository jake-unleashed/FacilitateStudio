import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  buildCorsHeaders,
  parseBearerToken,
  parseJsonBodyWithByteLimit,
  parseLimit,
  resolveClientIp,
} from '../../shared/api/extractStepsHelpers.js';
import { createExtractStepsRateLimiter } from '../../shared/api/extractStepsRateLimiter.js';
import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_MODEL_GENERATION_IP_LIMIT_PER_MINUTE,
  DEFAULT_MODEL_GENERATION_USER_LIMIT_PER_MINUTE,
  FALLBACK_POLYCOUNT,
  MAX_MODEL_GENERATION_REQUEST_BODY_BYTES,
} from '../../shared/api/modelGeneration/constants.js';
import { estimateTargetPolycount } from '../../shared/api/modelGeneration/estimatePolycount.js';
import { validateModelGenerationServerEnv } from '../../shared/api/modelGeneration/env.js';
import { createGenerationProvider } from '../../shared/api/modelGeneration/providerFactory.js';
import { parseGenerationRequestBody } from '../../shared/api/modelGeneration/helpers.js';
import {
  captureModelGenerationException,
  finalizeWithCors,
  jsonResponse,
} from '../../shared/api/modelGeneration/routeHelpers.js';

export const config = { runtime: 'edge' };
const rateLimiter = createExtractStepsRateLimiter({
  env: process.env,
  onPersistentStoreError: (error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'ai_generate_model_rate_limit_store_error',
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

  const envValidation = validateModelGenerationServerEnv(process.env);
  if (!envValidation.ok) {
    captureModelGenerationException(new Error(envValidation.message), { requestId, stage: 'env_validation' });
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
  const userId = authData.user.id;

  const now = Date.now();
  const userLimit = parseLimit(
    process.env.AI_3D_RATE_LIMIT_PER_USER,
    DEFAULT_MODEL_GENERATION_USER_LIMIT_PER_MINUTE
  );
  const ipLimit = parseLimit(
    process.env.AI_3D_RATE_LIMIT_PER_IP,
    DEFAULT_MODEL_GENERATION_IP_LIMIT_PER_MINUTE
  );

  const userLimitResult = await rateLimiter.check(`model-gen:user:${userId}`, userLimit, now);
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
  const ipLimitResult = await rateLimiter.check(`model-gen:ip:${clientIp}`, ipLimit, now);
  if (!ipLimitResult.allowed) {
    return finalize(
      jsonResponse(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(ipLimitResult.retryAfterSeconds) } }
      )
    );
  }

  const parsedBody = await parseJsonBodyWithByteLimit(req, MAX_MODEL_GENERATION_REQUEST_BODY_BYTES);
  if (!parsedBody.ok) {
    return finalize(jsonResponse({ error: parsedBody.error }, { status: parsedBody.status }));
  }

  const parsedRequest = parseGenerationRequestBody(parsedBody.data);
  if (!parsedRequest.ok) {
    return finalize(jsonResponse({ error: parsedRequest.error }, { status: parsedRequest.status }));
  }

  try {
    let generationOptions = parsedRequest.options ?? {};

    if (!generationOptions.targetPolycount) {
      generationOptions = { ...generationOptions, targetPolycount: FALLBACK_POLYCOUNT };

      if (envValidation.values.openAiApiKey) {
        const startedAt = Date.now();
        const openAiClient = new OpenAI({ apiKey: envValidation.values.openAiApiKey });
        const estimatedPolycount = await estimateTargetPolycount({
          client: openAiClient,
          imageDataUrl: parsedRequest.imageDataUrl,
          model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        });
        generationOptions = { ...generationOptions, targetPolycount: estimatedPolycount };

        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `[generate-model] AI polycount estimate for "${parsedRequest.imageName ?? 'image'}": ${estimatedPolycount.toLocaleString()} (${Date.now() - startedAt}ms)`
          );
        }
      }
    }

    const provider = createGenerationProvider({
      provider: envValidation.values.provider,
      meshyApiKey: envValidation.values.meshyApiKey,
      tripoApiKey: envValidation.values.tripoApiKey,
    });
    const createdTask = await provider.createTask(parsedRequest.imageDataUrl, generationOptions);
    return finalize(jsonResponse({ taskId: createdTask.taskId, provider: provider.name }, { status: 200 }));
  } catch (error) {
    captureModelGenerationException(error, {
      requestId,
      userId,
      provider: envValidation.values.provider,
      stage: 'provider_create_task',
    });
    return finalize(jsonResponse({ error: 'Failed to start model generation.' }, { status: 502 }));
  }
}
