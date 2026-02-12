import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import { createClient } from '@supabase/supabase-js';
import {
  getExtractSopStepsSystemPrompt,
} from '../shared/ai/extractSopStepsPrompt.js';

// Load local environment variables for development.
// - `.env.local` is gitignored and is where secrets should live.
// - We also load `.env` as a fallback if the user prefers it.
dotenv.config({ path: '.env.local' });
dotenv.config();

// Keep this fixed to match the Vite dev proxy target.
const PORT = 8787;
const MAX_EXTRACTED_STEPS = 50;
const MAX_INPUT_TEXT_LENGTH = 100_000;
const MAX_FILENAME_LENGTH = 256;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_USER_LIMIT_PER_MINUTE = 10;
const DEFAULT_IP_LIMIT_PER_MINUTE = 20;
const rateLimitStore = new Map();

// Periodically purge expired rate-limit entries to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}, 5 * 60_000); // every 5 minutes

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

function parseBearerToken(headerValue) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function parseLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function sanitizeFilename(filename) {
  return filename.replace(/["\r\n]/g, '_').slice(0, MAX_FILENAME_LENGTH);
}

function checkRateLimit(key, limit, now) {
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true };
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

// SUPABASE_URL is the canonical server-side env var (set on Vercel).
// Fall back to the VITE-prefixed client var for local dev where .env.local
// typically only defines VITE_SUPABASE_URL.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/api/ai/extract-steps', async (req, res) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
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

  const token = parseBearerToken(req.get('authorization'));
  if (!token) {
    return finalize(401, { error: 'Authentication required' });
  }

  if (!supabaseAdmin) {
    return finalize(500, { error: 'Server misconfiguration' });
  }

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

  const userLimitResult = checkRateLimit(`user:${userId}`, userLimit, now);
  if (!userLimitResult.allowed) {
    return finalize(
      429,
      { error: 'Rate limit exceeded. Please try again shortly.' },
      false,
      { 'Retry-After': String(userLimitResult.retryAfterSeconds) }
    );
  }

  const clientIp = getClientIp(req);
  const ipLimitResult = checkRateLimit(`ip:${clientIp}`, ipLimit, now);
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return finalize(500, {
      error: 'Server misconfiguration: OPENAI_API_KEY is missing',
    });
  }

  const client = new OpenAI({ apiKey });

  const systemInstruction = getExtractSopStepsSystemPrompt();

  const userPrompt = filename ? `Document "${filename}":\n\n${text}` : text;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
      },
      { signal: controller.signal }
    );

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return finalize(502, { error: 'Empty AI response' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return finalize(502, { error: 'Invalid AI response format' });
    }

    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
          .slice(0, MAX_EXTRACTED_STEPS)
      : [];

    if (steps.length > 0) {
      return finalize(200, { steps }, true);
    }

    if (parsed?.error) {
      return finalize(422, { error: String(parsed.error) });
    }

    return finalize(422, { error: 'No steps could be extracted from this document.' });
  } catch (error) {
    captureServerException(error, {
      requestId,
      userId,
      model,
      stage: 'openai_chat_completion',
    });
    return finalize(502, { error: 'Failed to analyze the document. Please try again.' });
  } finally {
    clearTimeout(timeout);
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
      })
    );
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});

