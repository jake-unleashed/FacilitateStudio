import { describe, expect, it, vi } from 'vitest';
import { MAX_BACKGROUND_IMAGE_SIZE_BYTES, validateBackgroundImageFile } from './backgroundImageUpload';

vi.mock('../lib/supabase', () => ({
  supabase: {},
}));

function createMockFile(name: string, type: string, size: number): File {
  const blob = new Blob(['x'], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('backgroundImageUpload validation', () => {
  it('accepts supported file types under size limit', () => {
    const file = createMockFile('background.jpg', 'image/jpeg', 1024);
    expect(validateBackgroundImageFile(file)).toBeNull();
  });

  it('rejects unsupported file types', () => {
    const file = createMockFile('background.gif', 'image/gif', 1024);
    expect(validateBackgroundImageFile(file)).toBe('Use a JPG, PNG, or WebP image for the 360 background.');
  });

  it('rejects files above max size with formatted limit message', () => {
    const file = createMockFile('background.png', 'image/png', MAX_BACKGROUND_IMAGE_SIZE_BYTES + 1);
    expect(validateBackgroundImageFile(file)).toBe('Background image must be 100.0 MB or smaller.');
  });
});
