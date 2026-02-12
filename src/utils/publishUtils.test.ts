import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePublishURL } from './publishUtils';
import type { Project } from '../types/project';
import { publishProject } from '../services/publishService';

vi.mock('../services/publishService', () => ({
  publishProject: vi.fn(),
}));

const mockPublishProject = vi.mocked(publishProject);

const makeProject = (id: string): Project => ({
  id,
  name: 'Publish Test',
  objects: [],
  steps: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('publishUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePublishURL', () => {
    it('delegates to publishProject and returns publish result', async () => {
      mockPublishProject.mockResolvedValue({
        shareToken: 'token-123',
        url: `${window.location.origin}/published?token=token-123`,
      });

      const result = await generatePublishURL(makeProject('abc-123'), 'user-1');

      expect(mockPublishProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc-123' }), 'user-1');
      expect(result.url).toContain('/published?token=token-123');
      expect(result.shareToken).toBe('token-123');
    });

    it('throws an error for empty projectId', async () => {
      await expect(generatePublishURL(makeProject(''), 'user-1')).rejects.toThrow(
        'Project ID is required'
      );
    });

    it('throws an error for whitespace-only projectId', async () => {
      await expect(generatePublishURL(makeProject('   '), 'user-1')).rejects.toThrow(
        'Project ID is required'
      );
    });

    it('throws an error for missing userId', async () => {
      await expect(generatePublishURL(makeProject('abc-123'), '')).rejects.toThrow(
        'Authenticated user ID is required'
      );
    });
  });
});

