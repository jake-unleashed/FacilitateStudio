import type { GenerationStatus, SupportedGenerationProvider } from '../../shared/api/modelGeneration/types.js';

export type {
  GenerationOptions,
  GenerationStatus,
  SupportedGenerationProvider,
} from '../../shared/api/modelGeneration/types.js';

export type GenerationUiStage =
  | 'idle'
  | 'uploading'
  | 'generating'
  | 'downloading'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'cancelled';

export interface GenerationTask {
  id: string;
  taskId: string;
  name: string;
  imagePreviewDataUrl: string;
  provider: SupportedGenerationProvider;
  stage: GenerationUiStage;
  progress: number;
  status: GenerationStatus['status'];
  error: string | null;
  createdAt: string;
}
