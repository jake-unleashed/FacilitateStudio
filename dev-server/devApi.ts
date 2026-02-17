import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import { createClient } from '@supabase/supabase-js';
import {
  getExtractSopStepsSystemPrompt,
} from '../shared/ai/extractSopStepsPrompt.js';
import {
  DEFAULT_IP_LIMIT_PER_MINUTE,
  DEFAULT_USER_LIMIT_PER_MINUTE,
  MAX_REQUEST_BODY_BYTES,
  OPENAI_TIMEOUT_MS_DEFAULT,
} from '../shared/api/extractStepsConstants.ts';
import {
  buildCorsHeaders,
  parseBearerToken,
  parseExtractStepsRequestBody,
  parseLimit,
  resolveClientIp,
} from '../shared/api/extractStepsHelpers.ts';
import { extractSopStepsWithOpenAI } from '../shared/api/extractStepsCore.ts';
import { createExtractStepsRateLimiter } from '../shared/api/extractStepsRateLimiter.ts';
import { validateExtractStepsServerEnv } from '../shared/api/extractStepsEnv.ts';

// Load local environment variables for development.
// - `.env.local` is gitignored and is where secrets should live.
// - We also load `.env` as a fallback if the user prefers it.
dotenv.config({ path: '.env.local' });
dotenv.config();

// Keep this fixed to match the Vite dev proxy target.
const PORT = 8787;
const rateLimiter = createExtractStepsRateLimiter({
  env: process.env as Record<string, string | undefined>,
  onPersistentStoreError: (error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[dev-api] persistent rate-limit store unavailable:', error);
  },
});

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
  });
}

function captureServerException(error: unknown, extra: Record<string, unknown> = {}): void {
  if (!sentryDsn) return;
  Sentry.captureException(error, { extra });
}

function getClientIp(req: Request): string {
  const xRealIpHeader = req.headers['x-real-ip'];
  const xRealIp = Array.isArray(xRealIpHeader) ? xRealIpHeader[0] : xRealIpHeader;
  return resolveClientIp({
    xForwardedFor: req.headers['x-forwarded-for'],
    xRealIp,
    fallbackIp: req.ip,
  });
}

const app = express();
app.use(express.json({ limit: MAX_REQUEST_BODY_BYTES }));
app.use('/api/ai/extract-steps', (req: Request, res: Response, next: NextFunction) => {
  const corsHeaders = buildCorsHeaders(req.get('origin') ?? null, process.env.AI_EXTRACT_ALLOWED_ORIGINS);
  if (corsHeaders) {
    Object.entries(corsHeaders).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.post('/api/ai/extract-steps', async (req: Request, res: Response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const openAiTimeoutMs = parseLimit(
    process.env.OPENAI_TIMEOUT_MS,
    OPENAI_TIMEOUT_MS_DEFAULT
  );
  let userId: string | null = null;
  let responseStatus = 500;
  let requestSucceeded = false;

  const finalize = (
    status: number,
    payload: Record<string, unknown>,
    success = false,
    extraHeaders: Record<string, string> = {}
  ): Response => {
    responseStatus = status;
    requestSucceeded = success;
    Object.entries(extraHeaders).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
    return res.status(status).json(payload);
  };

  const contentLength = Number(req.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return finalize(413, { error: 'Request body too large' });
  }

  const token = parseBearerToken(req.get('authorization'));
  if (!token) {
    return finalize(401, { error: 'Authentication required' });
  }

  const envValidation = validateExtractStepsServerEnv(process.env as Record<string, string | undefined>, {
    allowViteSupabaseUrlFallback: true,
  });
  if (!envValidation.ok) {
    captureServerException(new Error(envValidation.message), {
      requestId,
      stage: 'env_validation',
    });
    return finalize(500, { error: 'Server misconfiguration' });
  }

  const supabaseAdmin = createClient(
    envValidation.values.supabaseUrl,
    envValidation.values.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return finalize(401, { error: 'Authentication required' });
  }
  userId = authData.user.id;

  const now = Date.now();
  const userLimit = parseLimit(
    process.env.AI_RATE_LIMIT_PER_USER,
    DEFAULT_USER_LIMIT_PER_MINUTE
  );
  const ipLimit = parseLimit(process.env.AI_RATE_LIMIT_PER_IP, DEFAULT_IP_LIMIT_PER_MINUTE);

  const userLimitResult = await rateLimiter.check(`user:${userId}`, userLimit, now);
  if (!userLimitResult.allowed) {
    return finalize(
      429,
      { error: 'Rate limit exceeded. Please try again shortly.' },
      false,
      { 'Retry-After': String(userLimitResult.retryAfterSeconds) }
    );
  }

  const clientIp = getClientIp(req);
  const ipLimitResult = await rateLimiter.check(`ip:${clientIp}`, ipLimit, now);
  if (!ipLimitResult.allowed) {
    return finalize(
      429,
      { error: 'Rate limit exceeded. Please try again shortly.' },
      false,
      { 'Retry-After': String(ipLimitResult.retryAfterSeconds) }
    );
  }

  const parsedRequest = parseExtractStepsRequestBody(req.body);
  if (!parsedRequest.ok) {
    return finalize(parsedRequest.status, { error: parsedRequest.error });
  }
  const { text, filename } = parsedRequest;

  const apiKey = envValidation.values.openAiApiKey;
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
      return finalize(200, { steps: extraction.steps }, true);
    }
    if (extraction.rawError) {
      captureServerException(extraction.rawError, {
        requestId,
        userId,
        model,
        stage: extraction.stage ?? 'openai_chat_completion',
      });
    }
    return finalize(extraction.status, { error: extraction.error });
  } catch (error) {
    captureServerException(error, {
      requestId,
      userId,
      model,
      stage: 'openai_chat_completion',
    });
    return finalize(502, { error: 'Failed to analyze the document. Please try again.' });
  } finally {
    // Structured dev logs to mirror production request metadata.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: 'ai_extract_steps_request',
        requestId,
        userId,
        durationMs: Date.now() - startedAt,
        model,
        success: requestSucceeded,
        status: responseStatus,
        rateLimitMode: rateLimiter.mode,
      })
    );
  }
});

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.too.large'
  ) {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(error);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});
