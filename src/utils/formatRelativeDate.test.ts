import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeDate } from './formatRelativeDate';

describe('formatRelativeDate', () => {
  beforeEach(() => {
    // Mock current time to 2024-01-15 12:00:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recent times', () => {
    it('returns "Just now" for times less than 1 minute ago', () => {
      const now = new Date();
      expect(formatRelativeDate(now.toISOString())).toBe('Just now');

      const thirtySecondsAgo = new Date(now.getTime() - 30_000);
      expect(formatRelativeDate(thirtySecondsAgo.toISOString())).toBe('Just now');
    });

    it('returns minutes ago for times between 1 and 59 minutes', () => {
      const now = new Date();

      const oneMinuteAgo = new Date(now.getTime() - 60_000);
      expect(formatRelativeDate(oneMinuteAgo.toISOString())).toBe('1m ago');

      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);
      expect(formatRelativeDate(fiveMinutesAgo.toISOString())).toBe('5m ago');

      const fiftyNineMinutesAgo = new Date(now.getTime() - 59 * 60_000);
      expect(formatRelativeDate(fiftyNineMinutesAgo.toISOString())).toBe('59m ago');
    });

    it('returns hours ago for times between 1 and 23 hours', () => {
      const now = new Date();

      const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
      expect(formatRelativeDate(oneHourAgo.toISOString())).toBe('1h ago');

      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60_000);
      expect(formatRelativeDate(twelveHoursAgo.toISOString())).toBe('12h ago');

      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60_000);
      expect(formatRelativeDate(twentyThreeHoursAgo.toISOString())).toBe('23h ago');
    });

    it('returns days ago for times between 1 and 6 days', () => {
      const now = new Date();

      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
      expect(formatRelativeDate(oneDayAgo.toISOString())).toBe('1d ago');

      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60_000);
      expect(formatRelativeDate(threeDaysAgo.toISOString())).toBe('3d ago');

      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60_000);
      expect(formatRelativeDate(sixDaysAgo.toISOString())).toBe('6d ago');
    });
  });

  describe('older dates', () => {
    it('returns formatted date for times 7 or more days ago (same year)', () => {
      const now = new Date();

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
      const result = formatRelativeDate(sevenDaysAgo.toISOString());
      // Should be something like "Jan 8"
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('includes year for dates from a different year', () => {
      // Mock time is 2024-01-15, so 2023 date should include year
      const lastYear = new Date('2023-06-15T12:00:00.000Z');
      const result = formatRelativeDate(lastYear.toISOString());
      // Should be something like "Jun 15, 2023"
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2023$/);
    });
  });

  describe('edge cases', () => {
    it('handles exactly 60 minutes (should show 1h ago)', () => {
      const now = new Date();
      const exactlyOneHour = new Date(now.getTime() - 60 * 60_000);
      expect(formatRelativeDate(exactlyOneHour.toISOString())).toBe('1h ago');
    });

    it('handles exactly 24 hours (should show 1d ago)', () => {
      const now = new Date();
      const exactlyOneDay = new Date(now.getTime() - 24 * 60 * 60_000);
      expect(formatRelativeDate(exactlyOneDay.toISOString())).toBe('1d ago');
    });

    it('handles future dates gracefully', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60_000);
      // Should return "Just now" for slightly future dates (due to rounding)
      expect(formatRelativeDate(futureDate.toISOString())).toBe('Just now');
    });
  });
});
