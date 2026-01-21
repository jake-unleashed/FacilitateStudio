/**
 * Determines whether dragging is allowed for a pointer interaction.
 *
 * FEATURE: "Direct Dragging Disabled"
 * Direct click-and-drag translation of objects is disabled. Objects can only be moved
 * using the transform handles (gizmo). This prevents accidental object movement when:
 * - Users try to rotate the camera around objects
 * - Users attempt to select objects but accidentally drag them
 * - Camera movement (left click) accidentally triggers object translation
 *
 * When canDrag is false:
 * - Camera controls remain enabled (user can rotate/pan)
 * - Click-to-select still works (object is selected on pointer up if no drag)
 * - Object position is NOT updated during the gesture
 * - Objects can ONLY be moved via transform handles
 *
 * @returns Always false - direct dragging is disabled, use transform handles instead
 */
export function calculateCanDrag(
  _selectedParentId: string | null,
  _selectedChildPath: string | null,
  _clickedObjectId: string,
  _dragChildPath?: string | null
): boolean {
  return false;
}

