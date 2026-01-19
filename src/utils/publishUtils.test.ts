import { describe, it, expect } from 'vitest';
import { generatePublishURL } from './publishUtils';

describe('publishUtils', () => {
  describe('generatePublishURL', () => {
    it('generates a creator-only published URL from projectId', () => {
      const result = generatePublishURL('abc-123');
      expect(result.url).toContain('/published?projectId=abc-123');
      expect(result.url.startsWith(window.location.origin)).toBe(true);
      expect(result.warning.length).toBeGreaterThan(0);
    });

    it('throws an error for empty projectId', () => {
      expect(() => generatePublishURL('')).toThrow('Project ID is required');
    });

    it('throws an error for whitespace-only projectId', () => {
      expect(() => generatePublishURL('   ')).toThrow('Project ID is required');
    });

    it('URL-encodes special characters in projectId', () => {
      const result = generatePublishURL('project with spaces');
      expect(result.url).toContain('projectId=project%20with%20spaces');
    });

    it('trims whitespace from projectId', () => {
      const result = generatePublishURL('  my-project  ');
      expect(result.url).toContain('projectId=my-project');
      expect(result.url).not.toContain('%20');
    });
  });
});

