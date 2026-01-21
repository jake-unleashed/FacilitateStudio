import { describe, expect, it } from 'vitest';
import { isChildPathWithinSubtree } from './previewTargeting';

describe('isChildPathWithinSubtree', () => {
  it('matches exact target path', () => {
    expect(isChildPathWithinSubtree('a.b', 'a.b')).toBe(true);
  });

  it('matches descendant within subtree', () => {
    expect(isChildPathWithinSubtree('a.b', 'a.b.c')).toBe(true);
    expect(isChildPathWithinSubtree('a', 'a.b.c')).toBe(true);
  });

  it('does not match siblings or partial prefixes', () => {
    expect(isChildPathWithinSubtree('a.b', 'a.bc')).toBe(false);
    expect(isChildPathWithinSubtree('a', 'ab')).toBe(false);
  });

  it('returns false for null hit path', () => {
    expect(isChildPathWithinSubtree('a.b', null)).toBe(false);
  });
});

