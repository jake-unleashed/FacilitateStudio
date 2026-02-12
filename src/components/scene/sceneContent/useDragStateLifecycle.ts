import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { DragState } from '../DragHandler';

interface UseDragStateLifecycleArgs {
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
}

export function useDragStateLifecycle({
  dragState,
  setDragState,
}: UseDragStateLifecycleArgs): MutableRefObject<boolean> {
  const hasMovedRef = useRef(false);
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    hasMovedRef.current = dragState?.hasMoved ?? false;
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragStateRef.current) {
        setDragState(null);
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [setDragState]);

  return hasMovedRef;
}
