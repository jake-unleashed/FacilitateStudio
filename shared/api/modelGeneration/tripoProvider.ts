import type {
  GenerationOptions,
  GenerationProvider,
  GenerationStatus,
  GenerationTaskCreateResult,
} from './types.js';

interface TripoTaskCreateResponse {
  data?: {
    task_id?: string;
  };
}

interface TripoStatusResponse {
  data?: {
    status?: string;
    progress?: number | string;
    output?: {
      model_url?: string;
      pbr_model_url?: string;
      base_model_url?: string;
    };
    error_message?: string;
  };
}

function normalizeStatus(status?: string): GenerationStatus['status'] {
  const normalized = status?.toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'SUCCEEDED') return 'succeeded';
  if (normalized === 'FAILED' || normalized === 'ERROR' || normalized === 'EXPIRED') return 'failed';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'BANNED') {
    return 'cancelled';
  }
  if (normalized === 'PENDING' || normalized === 'QUEUED') return 'pending';
  return 'processing';
}

function normalizeProgress(progress?: number | string): number {
  const parsed = typeof progress === 'string' ? Number(progress) : progress;
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.floor(parsed ?? 0)));
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export function createTripoProvider(apiKey: string): GenerationProvider {
  const apiBase = 'https://api.tripo3d.ai/v2/openapi/task';

  const getTaskStatus = async (taskId: string): Promise<GenerationStatus> => {
    const response = await fetch(`${apiBase}/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: buildHeaders(apiKey),
    });

    if (!response.ok) {
      throw new Error(`Tripo status request failed (${response.status})`);
    }

    const payload = (await response.json()) as TripoStatusResponse;
    const status = normalizeStatus(payload.data?.status);
    const modelUrl =
      payload.data?.output?.pbr_model_url ??
      payload.data?.output?.model_url ??
      payload.data?.output?.base_model_url;

    return {
      status,
      progress: status === 'succeeded' ? 100 : normalizeProgress(payload.data?.progress),
      error: payload.data?.error_message,
      modelUrl,
    };
  };

  return {
    name: 'tripo',
    async createTask(imageDataUrl: string, _options?: GenerationOptions): Promise<GenerationTaskCreateResult> {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          type: 'image_to_model',
          file: {
            type: 'base64',
            data: imageDataUrl,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tripo create task failed (${response.status}): ${errorText}`);
      }

      const payload = (await response.json()) as TripoTaskCreateResponse;
      const taskId = payload.data?.task_id;
      if (!taskId) {
        throw new Error('Tripo create task response did not include a task id');
      }

      return { taskId };
    },
    getTaskStatus,
    async downloadModel(taskId: string): Promise<ArrayBuffer> {
      const status = await getTaskStatus(taskId);
      if (status.status !== 'succeeded' || !status.modelUrl) {
        throw new Error('Tripo model is not ready for download');
      }

      const response = await fetch(status.modelUrl);
      if (!response.ok) {
        throw new Error(`Tripo download failed (${response.status})`);
      }
      return response.arrayBuffer();
    },
  };
}
