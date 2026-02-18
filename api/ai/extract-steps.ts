import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  getExtractSopStepsSystemPrompt,
} from '../../shared/ai/extractSopStepsPrompt.js';
import {
  DEFAULT_IP_LIMIT_PER_MINUTE,
  DEFAULT_USER_LIMIT_PER_MINUTE,
  MAX_REQUEST_BODY_BYTES,
  OPENAI_TIMEOUT_MS_DEFAULT,
} from '../../shared/api/extractStepsConstants.js';
import {
  buildCorsHeaders,
  parseExtractStepsRequestBody,
  parseJsonBodyWithByteLimit,
  parseBearerToken,
  parseLimit,
  resolveClientIp,
} from '../../shared/api/extractStepsHelpers.js';
import { extractSopStepsWithOpenAI } from '../../shared/api/extractStepsCore.js';
import { createExtractStepsRateLimiter } from '../../shared/api/extractStepsRateLimiter.js';
import { validateExtractStepsServerEnv } from '../../shared/api/extractStepsEnv.js';

export const config = { runtime: 'edge' };
const rateLimiter = createExtractStepsRateLimiter({
  env: process.env,
  onPersistentStoreError: (error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'ai_extract_steps_rate_limit_store_error',
        error: error instanceof Error ? error.message : 'Unknown rate-limit store error',
      })
    );
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, init?: ResponseInit): Response {
  const initHeaders = new Headers(init?.headers);
  if (!initHeaders.has('Content-Type')) {
    initHeaders.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers: initHeaders,
  });
}

function logRequest(event: {
  requestId: string;
  userId: string | null;
  durationMs: number;
  model: string;
  success: boolean;
  status: number;
  rateLimitMode: string;
}): void {
  // Structured logs for Vercel ingestion without leaking request content.
  console.log(
    JSON.stringify({
      event: 'ai_extract_steps_request',
      ...event,
    })
  );
}

function captureServerException(error: unknown, extra: Record<string, unknown>): void {
  // Keep edge runtime compatible by avoiding Node-only SDK usage here.
  // Structured error logs are still emitted for production observability.
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const safeError =
    error instanceof Error
      ? {
          name: error.name,
          ...(Number.isFinite(status) ? { status } : {}),
        }
      : {
          type: typeof error,
          ...(Number.isFinite(status) ? { status } : {}),
        };
  console.error(
    JSON.stringify({
      event: 'ai_extract_steps_error',
      error: safeError,
      ...extra,
    })
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const openAiTimeoutMs = parseLimit(
    process.env.OPENAI_TIMEOUT_MS,
    OPENAI_TIMEOUT_MS_DEFAULT
  );
  let userId: string | null = null;
  let responseStatus = 500;
  let requestSucceeded = false;
  const corsHeaders = buildCorsHeaders(
    req.headers.get('origin'),
    process.env.AI_EXTRACT_ALLOWED_ORIGINS
  );

  const finalize = (response: Response, success: boolean): Response => {
    responseStatus = response.status;
    requestSucceeded = success;
    if (!corsHeaders) return response;

    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, String(value)));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  if (req.method === 'OPTIONS') {
    return finalize(new Response(null, { status: 204 }), true);
  }

  if (req.method !== 'POST') {
    return finalize(json({ error: 'Method Not Allowed' }, { status: 405 }), false);
  }

  const envValidation = validateExtractStepsServerEnv(process.env);
  if (!envValidation.ok) {
    captureServerException(new Error(envValidation.message), { requestId, stage: 'env_validation' });
    return finalize(json({ error: 'Server misconfiguration' }, { status: 500 }), false);
  }

  // --- Verify caller auth ---
  const token = parseBearerToken(req.headers.get('authorization'));
  if (!token) {
    return finalize(json({ error: 'Authentication required' }, { status: 401 }), false);
  }

  const supabase = createClient(
    envValidation.values.supabaseUrl,
    envValidation.values.supabaseServiceRoleKey,
    {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return finalize(json({ error: 'Authentication required' }, { status: 401 }), false);
  }
  userId = authData.user.id;

  // --- Rate limiting ---
  const now = Date.now();
  const userLimit = parseLimit(
    process.env.AI_RATE_LIMIT_PER_USER,
    DEFAULT_USER_LIMIT_PER_MINUTE
  );
  const ipLimit = parseLimit(
    process.env.AI_RATE_LIMIT_PER_IP,
    DEFAULT_IP_LIMIT_PER_MINUTE
  );

  const userLimitResult = await rateLimiter.check(`user:${userId}`, userLimit, now);
  if (!userLimitResult.allowed) {
    return finalize(
      json(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(userLimitResult.retryAfterSeconds) },
        }
      ),
      false
    );
  }

  const clientIp = resolveClientIp({
    xForwardedFor: req.headers.get('x-forwarded-for'),
    xRealIp: req.headers.get('x-real-ip'),
  });
  const ipLimitResult = await rateLimiter.check(`ip:${clientIp}`, ipLimit, now);
  if (!ipLimitResult.allowed) {
    return finalize(
      json(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimitResult.retryAfterSeconds) },
        }
      ),
      false
    );
  }

  // --- Parse body ---
  let text: string | undefined;
  let filename: string | undefined;
  const contentLengthHeader = req.headers.get('content-length');
  const contentLength = Number(contentLengthHeader);
  if (contentLengthHeader && Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return finalize(json({ error: 'Request body too large' }, { status: 413 }), false);
  }

  const parsedBody = await parseJsonBodyWithByteLimit(req, MAX_REQUEST_BODY_BYTES);
  if (!parsedBody.ok) {
    return finalize(json({ error: parsedBody.error }, { status: parsedBody.status }), false);
  }
  const parsedRequest = parseExtractStepsRequestBody(parsedBody.data);
  if (!parsedRequest.ok) {
    return finalize(json({ error: parsedRequest.error }, { status: parsedRequest.status }), false);
  }
  text = parsedRequest.text;
  filename = parsedRequest.filename;

  // --- Resolve API key ---
  const apiKey = envValidation.values.openAiApiKey;

  // --- Call OpenAI ---
  const client = new OpenAI({ apiKey });

  const systemInstruction = getExtractSopStepsSystemPrompt();

  try {
    const extraction = await extractSopStepsWithOpenAI({
      client,
      model,
      systemInstruction,
      text,
      filename,
      timeoutMs: openAiTimeoutMs,
    });
    if (extraction.ok) {
      return finalize(json({ steps: extraction.steps }), true);
    }
    if (extraction.rawError) {
      captureServerException(extraction.rawError, {
        requestId,
        userId,
        model,
        stage: extraction.stage ?? 'openai_chat_completion',
      });
    }
    return finalize(json({ error: extraction.error }, { status: extraction.status }), false);
  } catch (error) {
    captureServerException(error, {
      requestId,
      userId,
      model,
      stage: 'openai_chat_completion',
    });
    return finalize(
      json({ error: 'Failed to analyze the document. Please try again.' }, { status: 502 }),
      false
    );
  } finally {
    logRequest({
      requestId,
      userId,
      durationMs: Date.now() - startedAt,
      model,
      success: requestSucceeded,
      status: responseStatus,
      rateLimitMode: rateLimiter.mode,
    });
  }
}
