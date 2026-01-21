/**
 * Preview targeting helpers for move-item steps.
 *
 * In preview/published mode, move-item steps can target either:
 * - A whole object (no child path)
 * - A specific child subtree within an imported model (child path)
 */

/**
 * Returns true when `hitChildPath` is the target child or within its subtree.
 *
 * Example:
 * - target: "a.b"
 * - hits:   "a.b"      ✅
 * - hits:   "a.b.c"    ✅
 * - hits:   "a.bc"     ❌
 * - hits:   null       ❌
 */
export function isChildPathWithinSubtree(
  targetChildPath: string,
  hitChildPath: string | null
): boolean {
  if (!hitChildPath) return false;
  return hitChildPath === targetChildPath || hitChildPath.startsWith(targetChildPath + '.');
}

