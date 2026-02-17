import { z } from 'zod';
import {
  MAX_FILENAME_LENGTH,
  MAX_INPUT_TEXT_LENGTH,
  RATE_LIMIT_WINDOW_MS,
} from './extractStepsConstants.ts';

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export type RateLimitStore = Map<string, RateLimitEntry>;

export function createRateLimitStore(): RateLimitStore {
  return new Map();
}

export function parseFirstForwardedIp(headerValue: string | string[] | null | undefined): string | null {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof value !== 'string') return null;
  const [first] = value.split(',');
  const candidate = first?.trim();
  return candidate || null;
}

export function resolveClientIp(input: {
  xForwardedFor: string | string[] | null | undefined;
  xRealIp?: string | null | undefined;
  fallbackIp?: string | null | undefined;
}): string {
  const forwarded = parseFirstForwardedIp(input.xForwardedFor);
  if (forwarded) return forwarded;
  if (typeof input.xRealIp === 'string' && input.xRealIp.trim()) {
    return input.xRealIp.trim();
  }
  if (typeof input.fallbackIp === 'string' && input.fallbackIp.trim()) {
    return input.fallbackIp.trim();
  }
  return 'unknown';
}

export function parseBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/["\r\n]/g, '_').slice(0, MAX_FILENAME_LENGTH);
}

export function purgeExpiredEntries(store: RateLimitStore, now: number): void {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  now: number
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;
  return { allowed: true };
}

export function buildCorsHeaders(
  origin: string | null,
  allowedOriginsValue: string | undefined
): Record<string, string> | null {
  if (!allowedOriginsValue) return null;

  const allowedOrigins = allowedOriginsValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) return null;

  // In production, prefer explicit origins over "*" to prevent unintended cross-origin use.
  const allowAnyOrigin = allowedOrigins.includes('*');
  if (!allowAnyOrigin && (!origin || !allowedOrigins.includes(origin))) {
    return null;
  }

  const allowOrigin = allowAnyOrigin ? '*' : origin;
  if (!allowOrigin) return null;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  if (!allowAnyOrigin) {
    return { ...headers, Vary: 'Origin' };
  }

  return headers;
}

export async function parseJsonBodyWithByteLimit(
  req: Request,
  maxBodyBytes: number
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413; error: string }
> {
  const rawBody = await req.text();
  const bodyBytes = new TextEncoder().encode(rawBody).length;
  if (bodyBytes > maxBodyBytes) {
    return { ok: false, status: 413, error: 'Request body too large' };
  }

  try {
    return { ok: true, data: JSON.parse(rawBody) };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }
}

const extractStepsRequestBodySchema = z
  .object({
    text: z.string(),
    filename: z.string().optional(),
  })
  .passthrough();

export function parseExtractStepsRequestBody(data: unknown): {
  ok: true;
  text: string;
  filename: string | undefined;
} | {
  ok: false;
  status: 400;
  error: string;
} {
  const parsed = extractStepsRequestBodySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Missing or empty "text" field' };
  }

  const text = parsed.data.text.trim();
  if (!text) {
    return { ok: false, status: 400, error: 'Missing or empty "text" field' };
  }

  if (text.length > MAX_INPUT_TEXT_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Text exceeds maximum length of ${MAX_INPUT_TEXT_LENGTH} characters`,
    };
  }

  const filename =
    typeof parsed.data.filename === 'string' ? sanitizeFilename(parsed.data.filename) : undefined;

  return { ok: true, text, filename };
}
