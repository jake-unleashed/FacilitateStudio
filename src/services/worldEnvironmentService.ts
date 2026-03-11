import { supabase } from '../lib/supabase';
import type {
  WorldEnvironmentCreateResponse,
  WorldEnvironmentStatusResponse,
} from '../types/worldEnvironment';

const API_TIMEOUT_MS = 30_000;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function startWorldEnvironmentGeneration(input: {
  imageDataUrl: string;
  imageName?: string;
}): Promise<WorldEnvironmentCreateResponse> {
  const response = await fetch('/api/ai/world-environment', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as WorldEnvironmentCreateResponse;
}

export async function fetchWorldEnvironmentStatus(
  operationId: string
): Promise<WorldEnvironmentStatusResponse> {
  const response = await fetch(`/api/ai/world-environment/status?operationId=${encodeURIComponent(operationId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as WorldEnvironmentStatusResponse;
}
