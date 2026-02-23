import type { UploadStage } from '../../types/model';
import { FILE_TYPE_LABELS } from '../../types/model';

export const ACCEPTED_FORMATS = '.obj,.fbx,.glb,.png,.jpg,.jpeg,.tga,.bmp,.tif,.tiff,.webp';

/** Display configuration for each upload stage */
export const STAGE_CONFIG: Record<UploadStage, { label: string; progress: number }> = {
  idle: { label: 'Upload 3D Model', progress: 0 },
  validating: { label: 'Validating...', progress: 10 },
  storing: { label: 'Storing...', progress: 25 },
  processing: { label: 'Processing model...', progress: 50 },
  adding: { label: 'Adding to scene...', progress: 85 },
  complete: { label: 'Complete!', progress: 100 },
  error: { label: 'Upload failed', progress: 0 },
};

/** Time to show success message before resetting (ms) */
export const SUCCESS_DISPLAY_DURATION = 1500;

/** Supported file types for display */
export const SUPPORTED_FORMATS_TEXT = Object.values(FILE_TYPE_LABELS).join(', ');

