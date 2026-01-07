/**
 * Tests for model types and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  parseFileType,
  formatFileSize,
  validateModelFile,
  STORAGE_CONFIG,
  FILE_TYPE_EXTENSIONS,
  FILE_TYPE_LABELS,
} from './model';

describe('model types', () => {
  // ===========================================================================
  // parseFileType
  // ===========================================================================

  describe('parseFileType', () => {
    it('parses valid OBJ extension', () => {
      expect(parseFileType('model.obj')).toBe('obj');
      expect(parseFileType('MODEL.OBJ')).toBe('obj');
      expect(parseFileType('my.model.obj')).toBe('obj');
    });

    it('parses valid FBX extension', () => {
      expect(parseFileType('model.fbx')).toBe('fbx');
      expect(parseFileType('MODEL.FBX')).toBe('fbx');
    });

    it('parses valid GLB extension', () => {
      expect(parseFileType('model.glb')).toBe('glb');
      expect(parseFileType('MODEL.GLB')).toBe('glb');
    });

    it('parses valid GLTF extension', () => {
      expect(parseFileType('model.gltf')).toBe('gltf');
      expect(parseFileType('MODEL.GLTF')).toBe('gltf');
    });

    it('throws for unsupported file types', () => {
      expect(() => parseFileType('model.stl')).toThrow('Unsupported file type');
      expect(() => parseFileType('model.3ds')).toThrow('Unsupported file type');
      expect(() => parseFileType('model.dae')).toThrow('Unsupported file type');
      expect(() => parseFileType('model.txt')).toThrow('Unsupported file type');
    });

    it('throws for files without extension', () => {
      expect(() => parseFileType('model')).toThrow('Unsupported file type');
    });

    it('includes supported types in error message', () => {
      try {
        parseFileType('model.stl');
      } catch (error) {
        expect((error as Error).message).toContain('OBJ');
        expect((error as Error).message).toContain('FBX');
        expect((error as Error).message).toContain('GLB');
        expect((error as Error).message).toContain('GLTF');
      }
    });
  });

  // ===========================================================================
  // formatFileSize
  // ===========================================================================

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(100)).toBe('100 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10.0 KB');
      expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024.0 MB');
    });
  });

  // ===========================================================================
  // validateModelFile
  // ===========================================================================

  describe('validateModelFile', () => {
    function createMockFile(name: string, size: number): File {
      const blob = new Blob(['x'.repeat(size)], { type: 'application/octet-stream' });
      return new File([blob], name, { type: 'application/octet-stream' });
    }

    it('validates valid small files', () => {
      const file = createMockFile('model.obj', 1024);
      const result = validateModelFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('validates all supported file types', () => {
      expect(validateModelFile(createMockFile('a.obj', 100)).valid).toBe(true);
      expect(validateModelFile(createMockFile('a.fbx', 100)).valid).toBe(true);
      expect(validateModelFile(createMockFile('a.glb', 100)).valid).toBe(true);
      expect(validateModelFile(createMockFile('a.gltf', 100)).valid).toBe(true);
    });

    it('rejects unsupported file types', () => {
      const file = createMockFile('model.stl', 1024);
      const result = validateModelFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('rejects files exceeding max size', () => {
      const file = createMockFile('model.obj', STORAGE_CONFIG.MAX_FILE_SIZE + 1);
      const result = validateModelFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('warns for large files under max size', () => {
      const file = createMockFile('model.obj', STORAGE_CONFIG.WARNING_FILE_SIZE + 1);
      const result = validateModelFile(file);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Large file');
    });

    it('does not warn for files under warning threshold', () => {
      const file = createMockFile('model.obj', STORAGE_CONFIG.WARNING_FILE_SIZE - 1);
      const result = validateModelFile(file);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  // ===========================================================================
  // Constants
  // ===========================================================================

  describe('constants', () => {
    it('FILE_TYPE_EXTENSIONS has all supported types', () => {
      expect(FILE_TYPE_EXTENSIONS).toHaveProperty('obj', 'obj');
      expect(FILE_TYPE_EXTENSIONS).toHaveProperty('fbx', 'fbx');
      expect(FILE_TYPE_EXTENSIONS).toHaveProperty('glb', 'glb');
      expect(FILE_TYPE_EXTENSIONS).toHaveProperty('gltf', 'gltf');
    });

    it('FILE_TYPE_LABELS has human-readable labels', () => {
      expect(FILE_TYPE_LABELS.obj).toBe('OBJ');
      expect(FILE_TYPE_LABELS.fbx).toBe('FBX');
      expect(FILE_TYPE_LABELS.glb).toBe('GLB');
      expect(FILE_TYPE_LABELS.gltf).toBe('GLTF');
    });

    it('STORAGE_CONFIG has reasonable values', () => {
      expect(STORAGE_CONFIG.MAX_FILE_SIZE).toBe(100 * 1024 * 1024); // 100MB
      expect(STORAGE_CONFIG.WARNING_FILE_SIZE).toBe(50 * 1024 * 1024); // 50MB
      expect(STORAGE_CONFIG.MAX_CACHE_SIZE).toBeGreaterThan(0);
      expect(STORAGE_CONFIG.CACHE_CLEANUP_THRESHOLD).toBeLessThan(STORAGE_CONFIG.MAX_CACHE_SIZE);
    });
  });
});



