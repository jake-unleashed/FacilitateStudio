/**
 * Model Types
 *
 * Centralized type definitions for the 3D model upload and storage system.
 * Having types in one place prevents duplication and ensures consistency.
 */

// =============================================================================
// File Types
// =============================================================================

/** Supported 3D model file types */
export type ModelFileType = 'obj' | 'fbx' | 'glb';

/** File extension to ModelFileType mapping */
export const FILE_TYPE_EXTENSIONS: Record<string, ModelFileType> = {
  obj: 'obj',
  fbx: 'fbx',
  glb: 'glb',
};

/** Human-readable labels for file types */
export const FILE_TYPE_LABELS: Record<ModelFileType, string> = {
  obj: 'OBJ',
  fbx: 'FBX',
  glb: 'GLB',
};

// =============================================================================
// Geometry Types
// =============================================================================

/** 3D vector representation (plain object, JSON-serializable) */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned bounding box (plain object, JSON-serializable) */
export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

// =============================================================================
// Model Metrics
// =============================================================================

/**
 * Computed metrics for a 3D model.
 * These are calculated during preprocessing and cached with the asset.
 */
export interface ModelMetrics {
  /** Axis-aligned bounding box */
  boundingBox: BoundingBox;
  /** Center point of the bounding box */
  center: Vector3;
  /** Size in each dimension */
  size: Vector3;
  /** Y coordinate of the model bottom */
  bottomY: number;
  /** Y coordinate of the model top */
  topY: number;
  /** Maximum dimension (for camera distance calculations) */
  maxDimension: number;
  /** Number of triangles (for complexity warnings) */
  triangleCount?: number;
  /**
   * Scale factor applied during preprocessing to normalize the model size.
   * This is the multiplier used to scale the original model to fit within
   * MODEL_TARGET_SIZE (default 2.0 units). Stored for debugging and potential
   * future features like "show original size".
   */
  originalScale?: number;
}

// =============================================================================
// Asset Metadata
// =============================================================================

/**
 * Metadata for a stored 3D model asset.
 * This is the lightweight info stored separately from the binary data.
 */
export interface AssetMetadata {
  /** Unique identifier */
  id: string;
  /** Original filename */
  name: string;
  /** File type */
  fileType: ModelFileType;
  /** File size in bytes */
  fileSize: number;
  /** ISO date string of upload */
  uploadDate: string;
  /** Computed metrics (populated after preprocessing) */
  metrics?: ModelMetrics;
  /**
   * Extracted child mesh hierarchy (populated after preprocessing).
   * Stored to avoid re-extraction when adding from recent assets.
   */
  children?: import('../types').ChildMesh[];
  /**
   * Auto-generated thumbnail (base64 data URL).
   * Generated from the 3D model render and cached to avoid regeneration.
   */
  thumbnail?: string;
  /**
   * ISO date string of when the thumbnail was generated.
   * Used to determine if thumbnail needs regeneration (e.g., after app updates).
   */
  thumbnailUpdatedAt?: string;
}

// =============================================================================
// Upload Progress
// =============================================================================

/** Stages of the upload process */
export type UploadStage =
  | 'idle'
  | 'validating'
  | 'storing'
  | 'processing'
  | 'adding'
  | 'complete'
  | 'error';

/**
 * Upload progress state for UI feedback.
 */
export interface UploadProgress {
  /** Current stage */
  stage: UploadStage;
  /** Name of file being uploaded */
  fileName: string | null;
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if stage is 'error' */
  error: string | null;
  /** Warning message (e.g., large file) */
  warning: string | null;
}

/** Initial/reset state for upload progress */
export const INITIAL_UPLOAD_PROGRESS: UploadProgress = {
  stage: 'idle',
  fileName: null,
  progress: 0,
  error: null,
  warning: null,
};

// =============================================================================
// Validation
// =============================================================================

/**
 * Result of file validation.
 */
export interface ValidationResult {
  /** Whether the file is valid for upload */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warning message (file is valid but has concerns) */
  warning?: string;
}

/**
 * Optional validation policy overrides.
 */
export interface ModelValidationOptions {
  /**
   * When true, use the extended internal-testing upload limit.
   * Default is false (standard production limit).
   */
  extendedSizeLimit?: boolean;
}

// =============================================================================
// Storage Configuration
// =============================================================================

/** Storage limits and thresholds */
export const STORAGE_CONFIG = {
  /** Maximum file size allowed (100MB) */
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  /** Extended maximum file size for internal testing (500MB) */
  EXTENDED_MAX_FILE_SIZE: 500 * 1024 * 1024,
  /** Size threshold for showing a warning (50MB) */
  WARNING_FILE_SIZE: 50 * 1024 * 1024,
  /** Maximum number of models in memory cache */
  MAX_CACHE_SIZE: 50,
  /** Cache cleanup threshold */
  CACHE_CLEANUP_THRESHOLD: 40,
  /** IndexedDB database name */
  DB_NAME: 'facilitate-model-assets',
  /** IndexedDB version */
  DB_VERSION: 1,
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse file extension to get ModelFileType.
 * @throws Error if file type is not supported
 */
export function parseFileType(fileName: string): ModelFileType {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const fileType = FILE_TYPE_EXTENSIONS[ext];

  if (!fileType) {
    const supported = Object.keys(FILE_TYPE_EXTENSIONS).join(', ').toUpperCase();
    throw new Error(`Unsupported file type: .${ext}. Supported: ${supported}`);
  }

  return fileType;
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Resolve the active max upload size based on validation options.
 */
export function getModelMaxFileSize(options?: ModelValidationOptions): number {
  return options?.extendedSizeLimit ? STORAGE_CONFIG.EXTENDED_MAX_FILE_SIZE : STORAGE_CONFIG.MAX_FILE_SIZE;
}

/**
 * Validate a file for upload.
 * @param options.extendedSizeLimit - When true, allows up to EXTENDED_MAX_FILE_SIZE (500MB) instead of the default 100MB. Intended for internal testing only.
 */
export function validateModelFile(file: File, options?: ModelValidationOptions): ValidationResult {
  // Check file extension
  try {
    parseFileType(file.name);
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid file type',
    };
  }

  const maxSize = getModelMaxFileSize(options);

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum of ${formatFileSize(maxSize)}.`,
    };
  }

  if (file.size > STORAGE_CONFIG.WARNING_FILE_SIZE) {
    return {
      valid: true,
      warning: `Large file (${formatFileSize(file.size)}) may take longer to process.`,
    };
  }

  return { valid: true };
}
