import dotenv from 'dotenv';
import express from 'express';
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
  MAX_INPUT_TEXT_LENGTH,
  MAX_REQUEST_BODY_BYTES,
  OPENAI_TIMEOUT_MS_DEFAULT,
} from '../shared/api/extractStepsConstants.js';
import {
  buildCorsHeaders,
  parseBearerToken,
  parseLimit,
  resolveClientIp,
  sanitizeFilename,
} from '../shared/api/extractStepsHelpers.js';
import { extractSopStepsWithOpenAI } from '../shared/api/extractStepsCore.js';
import { createExtractStepsRateLimiter } from '../shared/api/extractStepsRateLimiter.js';
import { validateExtractStepsServerEnv } from '../shared/api/extractStepsEnv.js';

// Load local environment variables for development.
// - `.env.local` is gitignored and is where secrets should live.
// - We also load `.env` as a fallback if the user prefers it.
dotenv.config({ path: '.env.local' });
dotenv.config();

// Keep this fixed to match the Vite dev proxy target.
const PORT = 8787;
const rateLimiter = createExtractStepsRateLimiter({
  env: process.env,
  onPersistentStoreError: (error) => {
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

function captureServerException(error, extra = {}) {
  if (!sentryDsn) return;
  Sentry.captureException(error, { extra });
}

function getClientIp(req) {
  return resolveClientIp({
    xForwardedFor: req.headers['x-forwarded-for'],
    xRealIp: req.headers['x-real-ip'],
    fallbackIp: req.ip,
  });
}

const app = express();
app.use(express.json({ limit: MAX_REQUEST_BODY_BYTES }));
app.use('/api/ai/extract-steps', (req, res, next) => {
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

app.post('/api/ai/extract-steps', async (req, res) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const openAiTimeoutMs = parseLimit(
    process.env.OPENAI_TIMEOUT_MS,
    OPENAI_TIMEOUT_MS_DEFAULT
  );
  let userId = null;
  let responseStatus = 500;
  let requestSucceeded = false;

  const finalize = (status, payload, success = false, extraHeaders = {}) => {
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

  const envValidation = validateExtractStepsServerEnv(process.env, {
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

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const filename =
    typeof req.body?.filename === 'string' ? sanitizeFilename(req.body.filename) : undefined;

  if (!text) {
    return finalize(400, { error: 'Missing or empty "text" field' });
  }
  if (text.length > MAX_INPUT_TEXT_LENGTH) {
    return finalize(400, {
      error: `Text exceeds maximum length of ${MAX_INPUT_TEXT_LENGTH} characters`,
    });
  }

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

app.use((error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
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

