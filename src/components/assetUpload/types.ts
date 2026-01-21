import type { UploadStage } from '../../types/model';

export interface InternalState {
  isUploading: boolean;
  error: string | null;
  fileName: string | null;
  stage: UploadStage;
}

