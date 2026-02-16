import { RATE_LIMIT_WINDOW_MS } from './extractStepsConstants.js';
import {
  checkRateLimit,
  createRateLimitStore,
  purgeExpiredEntries,
} from './extractStepsHelpers.js';

/**
 * @typedef {{
 *   check: (key: string, limit: number, now: number) => Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>;
 *   mode: 'memory' | 'upstash_redis_with_memory_fallback';
 * }} ExtractStepsRateLimiter
 */

/**
 * @param {string} url
 * @returns {string}
 */
function trimTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {{ url: string; token: string; keyPrefix: string } | null}
 */
function resolveUpstashConfig(env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.AI_RATE_LIMIT_REDIS_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.AI_RATE_LIMIT_REDIS_TOKEN;
  if (!url || !token) return null;

  const keyPrefix = env.AI_RATE_LIMIT_REDIS_PREFIX?.trim() || 'facilitate:extract-steps';
  return {
    url: trimTrailingSlash(url),
    token,
    keyPrefix,
  };
}

/**
 * @param {{ url: string; token: string }} config
 * @param {string} key
 * @returns {Promise<number>}
 */
async function upstashIncr(config, key) {
  const response = await fetch(`${config.url}/incr/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Upstash INCR failed (${response.status})`);
  }

  const payload = /** @type {{ result?: number | string }} */ (await response.json());
  const value = Number(payload?.result);
  if (!Number.isFinite(value)) {
    throw new Error('Upstash INCR returned a non-numeric result');
  }
  return value;
}

/**
 * @param {{ url: string; token: string }} config
 * @param {string} key
 * @returns {Promise<void>}
 */
async function upstashSetExpiry(config, key) {
  const response = await fetch(
    `${config.url}/pexpire/${encodeURIComponent(key)}/${RATE_LIMIT_WINDOW_MS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Upstash PEXPIRE failed (${response.status})`);
  }
}

/**
 * @param {{ url: string; token: string; keyPrefix: string }} config
 * @param {string} key
 * @param {number} limit
 * @param {number} now
 * @returns {Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>}
 */
async function checkUpstashRateLimit(config, key, limit, now) {
  const windowIndex = Math.floor(now / RATE_LIMIT_WINDOW_MS);
  const redisKey = `${config.keyPrefix}:${key}:${windowIndex}`;
  const count = await upstashIncr(config, redisKey);

  if (count === 1) {
    await upstashSetExpiry(config, redisKey);
  }

  if (count > limit) {
    const windowRemainingMs = RATE_LIMIT_WINDOW_MS - (now % RATE_LIMIT_WINDOW_MS);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(windowRemainingMs / 1000)),
    };
  }

  return { allowed: true };
}

/**
 * @param {{
 *   env: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   onPersistentStoreError?: (error: unknown) => void;
 * }} params
 * @returns {ExtractStepsRateLimiter}
 */
export function createExtractStepsRateLimiter(params) {
  const { env, onPersistentStoreError } = params;
  const memoryStore = createRateLimitStore();
  const upstashConfig = resolveUpstashConfig(env);
  let lastMemoryPurgeAt = 0;
  let lastPersistentErrorReportedAt = 0;

  /**
   * @param {string} key
   * @param {number} limit
   * @param {number} now
   * @returns {{ allowed: true } | { allowed: false; retryAfterSeconds: number }}
   */
  const checkMemory = (key, limit, now) => {
    if (now - lastMemoryPurgeAt >= 60_000) {
      lastMemoryPurgeAt = now;
      purgeExpiredEntries(memoryStore, now);
    }
    return checkRateLimit(memoryStore, key, limit, now);
  };

  return {
    mode: upstashConfig ? 'upstash_redis_with_memory_fallback' : 'memory',
    check: async (key, limit, now) => {
      if (!upstashConfig) {
        return checkMemory(key, limit, now);
      }

      try {
        return await checkUpstashRateLimit(upstashConfig, key, limit, now);
      } catch (error) {
        // Keep production traffic flowing even if the persistent rate-limit backend is degraded.
        if (
          onPersistentStoreError &&
          now - lastPersistentErrorReportedAt >= RATE_LIMIT_WINDOW_MS
        ) {
          lastPersistentErrorReportedAt = now;
          onPersistentStoreError(error);
        }
        return checkMemory(key, limit, now);
      }
    },
  };
}
