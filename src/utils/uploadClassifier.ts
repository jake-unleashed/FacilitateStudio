export interface ClassifiedUpload {
  modelFile: File | null;
  textureFiles: File[];
  ignoredFiles: File[];
  warning?: string;
  error?: string;
}

const MODEL_EXTENSIONS = new Set(['obj', 'fbx', 'glb']);
const MATERIAL_SIDECAR_EXTENSIONS = new Set(['mtl']);
const TEXTURE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'tga', 'bmp', 'tif', 'tiff', 'webp']);

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Separate upload files into model, textures, and ignored files.
 * At most one model file is allowed per upload interaction.
 */
export function classifyUploadFiles(files: Iterable<File>): ClassifiedUpload {
  const modelCandidates: File[] = [];
  const textureFiles: File[] = [];
  const ignoredFiles: File[] = [];
  const sidecarMaterialFiles: File[] = [];

  for (const file of files) {
    const ext = getFileExtension(file.name);
    if (MODEL_EXTENSIONS.has(ext)) {
      modelCandidates.push(file);
      continue;
    }
    if (MATERIAL_SIDECAR_EXTENSIONS.has(ext)) {
      ignoredFiles.push(file);
      sidecarMaterialFiles.push(file);
      continue;
    }
    if (TEXTURE_EXTENSIONS.has(ext)) {
      textureFiles.push(file);
      continue;
    }
    ignoredFiles.push(file);
  }

  const modelFile = modelCandidates[0] ?? null;
  const warnings: string[] = [];

  if (modelCandidates.length > 1) {
    warnings.push('Only one model can be uploaded at a time. Additional model files were ignored.');
  }
  if (sidecarMaterialFiles.length > 0) {
    warnings.push(
      '.mtl material files are not imported. Upload image textures directly, or use GLB for the most reliable materials.'
    );
  }
  const genericIgnoredCount = ignoredFiles.length - sidecarMaterialFiles.length;
  if (genericIgnoredCount > 0) {
    warnings.push(
      `${genericIgnoredCount} unsupported file${genericIgnoredCount === 1 ? '' : 's'} were skipped.`
    );
  }

  return {
    modelFile,
    textureFiles,
    ignoredFiles,
    warning: warnings.length > 0 ? warnings.join(' ') : undefined,
    error: modelFile ? undefined : 'No 3D model found. Include a .fbx, .glb, or .obj file.',
  };
}
