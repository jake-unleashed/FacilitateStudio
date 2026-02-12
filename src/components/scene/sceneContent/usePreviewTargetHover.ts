import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getChildPathFromObject, getSceneObjectIdFromObject } from './pointerEventUtils';
import { isChildPathWithinSubtree } from '../../../utils/previewTargeting';

interface UsePreviewTargetHoverArgs {
  previewMode: boolean;
  previewOutlineParentId: string | null;
  previewOutlineChildPath: string | null;
  gl: THREE.WebGLRenderer;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

export function usePreviewTargetHover({
  previewMode,
  previewOutlineParentId,
  previewOutlineChildPath,
  gl,
  camera,
  scene,
}: UsePreviewTargetHoverArgs): boolean {
  const [isPreviewTargetHovering, setIsPreviewTargetHovering] = useState(false);
  const previewRaycasterRef = useRef(new THREE.Raycaster());
  const previewPointerNdcRef = useRef(new THREE.Vector2());

  useEffect(() => {
    if (!previewMode || !previewOutlineParentId) {
      setIsPreviewTargetHovering(false);
      return;
    }

    const dom = gl.domElement;

    const computeIsHoveringTarget = (event: PointerEvent): boolean => {
      const rect = dom.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      previewPointerNdcRef.current.set(x, y);

      previewRaycasterRef.current.setFromCamera(previewPointerNdcRef.current, camera);
      const intersections = previewRaycasterRef.current.intersectObjects(scene.children, true);

      for (const hit of intersections) {
        const hitSceneObjectId = getSceneObjectIdFromObject(hit.object);
        if (hitSceneObjectId !== previewOutlineParentId) continue;
        if (!previewOutlineChildPath) return true;
        const hitChildPath = getChildPathFromObject(hit.object);
        return isChildPathWithinSubtree(previewOutlineChildPath, hitChildPath);
      }

      return false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const next = computeIsHoveringTarget(event);
      setIsPreviewTargetHovering((prev) => (prev === next ? prev : next));
    };

    const handlePointerLeave = () => {
      setIsPreviewTargetHovering(false);
    };

    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [previewMode, previewOutlineParentId, previewOutlineChildPath, gl, camera, scene]);

  return isPreviewTargetHovering;
}
