import {
  MAX_FILENAME_LENGTH,
  RATE_LIMIT_WINDOW_MS,
} from './extractStepsConstants.js';

/**
 * @typedef {{ count: number; resetAt: number }} RateLimitEntry
 * @typedef {Map<string, RateLimitEntry>} RateLimitStore
 */

/**
 * @returns {RateLimitStore}
 */
export function createRateLimitStore() {
  return new Map();
}

/**
 * @param {string | string[] | null | undefined} headerValue
 * @returns {string | null}
 */
export function parseFirstForwardedIp(headerValue) {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof value !== 'string') return null;
  const [first] = value.split(',');
  const candidate = first?.trim();
  return candidate ? candidate : null;
}

/**
 * @param {{
 *   xForwardedFor: string | string[] | null | undefined;
 *   xRealIp?: string | null | undefined;
 *   fallbackIp?: string | null | undefined;
 * }} input
 * @returns {string}
 */
export function resolveClientIp(input) {
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

/**
 * @param {string | null | undefined} headerValue
 * @returns {string | null}
 */
export function parseBearerToken(headerValue) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
export function parseLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  return filename.replace(/["\r\n]/g, '_').slice(0, MAX_FILENAME_LENGTH);
}

/**
 * @param {RateLimitStore} store
 * @param {number} now
 */
export function purgeExpiredEntries(store, now) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/**
 * @param {RateLimitStore} store
 * @param {string} key
 * @param {number} limit
 * @param {number} now
 * @returns {{ allowed: true } | { allowed: false; retryAfterSeconds: number }}
 */
export function checkRateLimit(store, key, limit, now) {
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

/**
 * @param {string | null} origin
 * @param {string | undefined} allowedOriginsValue
 * @returns {Record<string, string> | null}
 */
export function buildCorsHeaders(origin, allowedOriginsValue) {
  if (!allowedOriginsValue) return null;

  const allowedOrigins = allowedOriginsValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) return null;

  const allowAnyOrigin = allowedOrigins.includes('*');
  if (!allowAnyOrigin && (!origin || !allowedOrigins.includes(origin))) {
    return null;
  }

  const allowOrigin = allowAnyOrigin ? '*' : origin;
  if (!allowOrigin) return null;

  const headers = {
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

/**
 * @param {Request} req
 * @param {number} maxBodyBytes
 * @returns {Promise<
 *   | { ok: true; data: unknown }
 *   | { ok: false; status: 400 | 413; error: string }
 * >}
 */
export async function parseJsonBodyWithByteLimit(req, maxBodyBytes) {
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
