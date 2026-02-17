import { RATE_LIMIT_WINDOW_MS } from './extractStepsConstants.ts';
import {
  checkRateLimit,
  createRateLimitStore,
  purgeExpiredEntries,
} from './extractStepsHelpers.ts';

export interface ExtractStepsRateLimiter {
  check: (
    key: string,
    limit: number,
    now: number
  ) => Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>;
  mode: 'memory' | 'upstash_redis_with_memory_fallback';
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveUpstashConfig(env: Record<string, string | undefined>): {
  url: string;
  token: string;
  keyPrefix: string;
} | null {
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

async function upstashIncr(config: { url: string; token: string }, key: string): Promise<number> {
  const response = await fetch(`${config.url}/incr/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Upstash INCR failed (${response.status})`);
  }

  const payload = (await response.json()) as { result?: number | string };
  const value = Number(payload?.result);
  if (!Number.isFinite(value)) {
    throw new Error('Upstash INCR returned a non-numeric result');
  }
  return value;
}

async function upstashSetExpiry(config: { url: string; token: string }, key: string): Promise<void> {
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

async function checkUpstashRateLimit(
  config: { url: string; token: string; keyPrefix: string },
  key: string,
  limit: number,
  now: number
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
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

export function createExtractStepsRateLimiter(params: {
  env: Record<string, string | undefined>;
  onPersistentStoreError?: (error: unknown) => void;
}): ExtractStepsRateLimiter {
  const { env, onPersistentStoreError } = params;
  const memoryStore = createRateLimitStore();
  const upstashConfig = resolveUpstashConfig(env);
  let lastMemoryPurgeAt = 0;
  let lastPersistentErrorReportedAt = 0;

  const checkMemory = (
    key: string,
    limit: number,
    now: number
  ): { allowed: true } | { allowed: false; retryAfterSeconds: number } => {
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
