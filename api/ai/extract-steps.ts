import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  getExtractSopStepsSystemPrompt,
} from '../../shared/ai/extractSopStepsPrompt.js';

export const config = { runtime: 'edge' };
const MAX_EXTRACTED_STEPS = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_USER_LIMIT_PER_MINUTE = 10;
const DEFAULT_IP_LIMIT_PER_MINUTE = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Lazily purge expired entries to prevent unbounded memory growth in long-lived
// edge isolates. Runs at most once per minute.
let lastPurge = 0;
function purgeExpiredEntries(now: number): void {
  if (now - lastPurge < 60_000) return;
  lastPurge = now;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function checkRateLimit(
  key: string,
  limit: number,
  now: number
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;
  return { allowed: true };
}

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const [first] = xForwardedFor.split(',');
    if (first?.trim()) return first.trim();
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function logRequest(event: {
  requestId: string;
  userId: string | null;
  durationMs: number;
  model: string;
  success: boolean;
  status: number;
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
  console.error(
    JSON.stringify({
      event: 'ai_extract_steps_error',
      error: error instanceof Error ? error.message : String(error),
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
  let userId: string | null = null;
  let responseStatus = 500;
  let requestSucceeded = false;

  const finalize = (response: Response, success: boolean): Response => {
    responseStatus = response.status;
    requestSucceeded = success;
    return response;
  };

  if (req.method !== 'POST') {
    return finalize(json({ error: 'Method Not Allowed' }, { status: 405 }), false);
  }

  // --- Verify caller auth ---
  const token = parseBearerToken(req.headers.get('authorization'));
  if (!token) {
    return finalize(json({ error: 'Authentication required' }, { status: 401 }), false);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return finalize(
      json({ error: 'Server misconfiguration' }, { status: 500 }),
      false
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
  purgeExpiredEntries(now);
  const userLimit = parseLimit(
    process.env.AI_RATE_LIMIT_PER_USER,
    DEFAULT_USER_LIMIT_PER_MINUTE
  );
  const ipLimit = parseLimit(
    process.env.AI_RATE_LIMIT_PER_IP,
    DEFAULT_IP_LIMIT_PER_MINUTE
  );

  const userLimitResult = checkRateLimit(`user:${userId}`, userLimit, now);
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

  const clientIp = getClientIp(req);
  const ipLimitResult = checkRateLimit(`ip:${clientIp}`, ipLimit, now);
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
  try {
    const data = await req.json().catch(() => ({}));
    text = typeof data?.text === 'string' ? data.text.trim() : undefined;
    filename = typeof data?.filename === 'string' ? data.filename : undefined;
  } catch {
    return finalize(json({ error: 'Invalid JSON body' }, { status: 400 }), false);
  }

  if (!text) {
    return finalize(
      json({ error: 'Missing or empty "text" field' }, { status: 400 }),
      false
    );
  }

  // --- Resolve API key ---
  const apiKey =
    process.env.OPENAI_API_KEY ??
    (process as unknown as { env?: Record<string, string | undefined> }).env?.OPENAI_API_KEY;

  if (!apiKey) {
    return finalize(
      json(
        { error: 'Server misconfiguration: OPENAI_API_KEY is missing' },
        { status: 500 }
      ),
      false
    );
  }

  // --- Call OpenAI ---
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
      { signal: controller.signal as unknown as AbortSignal }
    );

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return finalize(json({ error: 'Empty AI response' }, { status: 502 }), false);
    }

    let parsed: { steps?: string[]; error?: string } | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return finalize(
        json({ error: 'Invalid AI response format' }, { status: 502 }),
        false
      );
    }

    if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const steps = parsed.steps
        .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean)
        .slice(0, MAX_EXTRACTED_STEPS);
      if (steps.length > 0) return finalize(json({ steps }), true);
    }

    if (parsed?.error) {
      return finalize(json({ error: String(parsed.error) }, { status: 422 }), false);
    }

    return finalize(
      json({ error: 'No steps could be extracted from this document.' }, { status: 422 }),
      false
    );
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
    clearTimeout(timeout);
    logRequest({
      requestId,
      userId,
      durationMs: Date.now() - startedAt,
      model,
      success: requestSucceeded,
      status: responseStatus,
    });
  }
}
