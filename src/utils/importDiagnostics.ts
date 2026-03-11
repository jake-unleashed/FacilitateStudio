import type { ImportDiagnostics, ImportWarning, ModelFileType } from '../types/model';

export function createImportDiagnostics(fileType: ModelFileType): ImportDiagnostics {
  return {
    fileType,
    warnings: [],
    repairedNormalsMeshCount: 0,
    suspiciousMaterialCount: 0,
    missingTextureDataCount: 0,
  };
}

export function addImportWarning(diagnostics: ImportDiagnostics, warning: ImportWarning): void {
  const alreadyExists = diagnostics.warnings.some(
    (existing) => existing.code === warning.code && existing.message === warning.message
  );

  if (!alreadyExists) {
    diagnostics.warnings.push(warning);
  }
}
