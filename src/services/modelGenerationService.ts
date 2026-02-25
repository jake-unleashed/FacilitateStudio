import { supabase } from '../lib/supabase';
import type {
  GenerationOptions,
  GenerationStatus,
  SupportedGenerationProvider,
} from '../types/modelGeneration';

interface SubmitGenerationResponse {
  taskId: string;
  provider: SupportedGenerationProvider;
}

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

export async function submitGeneration(input: {
  imageDataUrl: string;
  imageName?: string;
  options?: GenerationOptions;
}): Promise<SubmitGenerationResponse> {
  const response = await fetch('/api/ai/generate-model', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as SubmitGenerationResponse;
}

export async function pollGenerationStatus(taskId: string): Promise<GenerationStatus> {
  const response = await fetch(`/api/ai/generate-model/status?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as GenerationStatus;
}

export async function downloadGeneratedModel(taskId: string): Promise<ArrayBuffer> {
  const response = await fetch(`/api/ai/generate-model/download?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.arrayBuffer();
}
