export type SupportedGenerationProvider = 'meshy' | 'tripo';

export type GenerationTaskStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface GenerationOptions {
  targetPolycount?: number;
  topology?: 'triangle' | 'quad';
  enablePbr?: boolean;
}

export interface GenerationTaskCreateResult {
  taskId: string;
}

export interface GenerationStatus {
  status: GenerationTaskStatus;
  progress: number;
  error?: string;
  modelUrl?: string;
}

export interface GenerationProvider {
  readonly name: SupportedGenerationProvider;
  createTask(imageDataUrl: string, options?: GenerationOptions): Promise<GenerationTaskCreateResult>;
  getTaskStatus(taskId: string): Promise<GenerationStatus>;
  downloadModel(taskId: string): Promise<ArrayBuffer>;
  cancelTask?(taskId: string): Promise<void>;
}
