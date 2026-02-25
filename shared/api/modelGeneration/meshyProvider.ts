import type {
  GenerationOptions,
  GenerationProvider,
  GenerationStatus,
  GenerationTaskCreateResult,
} from './types.js';
import { FALLBACK_POLYCOUNT } from './constants.js';

interface MeshyCreateTaskResponse {
  result?: string;
  id?: string;
  task_id?: string;
}

interface MeshyStatusResponse {
  status?: string;
  progress?: number | string;
  error?: string;
  model_url?: string;
  model_urls?: {
    glb?: string;
  };
  output?: {
    model_url?: string;
    model_urls?: {
      glb?: string;
    };
  };
}

function normalizeStatus(status?: string): GenerationStatus['status'] {
  const normalized = status?.toUpperCase();
  if (normalized === 'SUCCEEDED' || normalized === 'SUCCESS') return 'succeeded';
  if (normalized === 'FAILED' || normalized === 'ERROR') return 'failed';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'cancelled';
  if (normalized === 'PENDING' || normalized === 'QUEUED') return 'pending';
  return 'processing';
}

function normalizeProgress(progress?: number | string): number {
  const parsed = typeof progress === 'string' ? Number(progress) : progress;
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.floor(parsed ?? 0)));
}

function resolveModelUrl(payload: MeshyStatusResponse): string | undefined {
  return (
    // Prefer signed asset download URLs when available (Meshy docs: `model_urls.glb`).
    // Some responses may include `model_url` / `output.model_url`, which are not always direct binaries.
    payload.model_urls?.glb ??
    payload.output?.model_urls?.glb ??
    payload.output?.model_url ??
    payload.model_url
  );
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export function createMeshyProvider(apiKey: string): GenerationProvider {
  const apiBase = 'https://api.meshy.ai/openapi/v1/image-to-3d';

  const getTaskStatus = async (taskId: string): Promise<GenerationStatus> => {
    const response = await fetch(`${apiBase}/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: buildHeaders(apiKey),
    });

    if (!response.ok) {
      throw new Error(`Meshy status request failed (${response.status})`);
    }

    const payload = (await response.json()) as MeshyStatusResponse;
    const status = normalizeStatus(payload.status);
    return {
      status,
      progress: status === 'succeeded' ? 100 : normalizeProgress(payload.progress),
      error: payload.error,
      modelUrl: resolveModelUrl(payload),
    };
  };

  return {
    name: 'meshy',
    async createTask(imageDataUrl: string, options?: GenerationOptions): Promise<GenerationTaskCreateResult> {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          image_url: imageDataUrl,
          ai_model: 'latest',
          topology: options?.topology ?? 'triangle',
          should_remesh: true,
          target_polycount: options?.targetPolycount ?? FALLBACK_POLYCOUNT,
          enable_pbr: options?.enablePbr ?? false,
          should_texture: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meshy create task failed (${response.status}): ${errorText}`);
      }

      const payload = (await response.json()) as MeshyCreateTaskResponse;
      const taskId = payload.result ?? payload.id ?? payload.task_id;
      if (!taskId) {
        throw new Error('Meshy create task response did not include a task id');
      }

      return { taskId };
    },
    getTaskStatus,
    async downloadModel(taskId: string): Promise<ArrayBuffer> {
      const status = await getTaskStatus(taskId);
      if (status.status !== 'succeeded' || !status.modelUrl) {
        throw new Error('Meshy model is not ready for download');
      }

      const response = await fetch(status.modelUrl);
      if (!response.ok) {
        throw new Error(`Meshy download failed (${response.status})`);
      }
      return response.arrayBuffer();
    },
  };
}
