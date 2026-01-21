import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import {
  CHILD_SELECTION_COLOR,
  HOVER_COLOR,
  HOVER_INTENSITY,
  SELECTION_COLOR,
  SELECTION_COLOR_GHOST,
  SELECTION_INTENSITY,
} from './constants';

export function useImportedModelSelectionEffects({
  model,
  isSelected,
  isHovered,
  hasChildSelected,
  selectedChildPath,
  hoveredChildPath,
  childPathToMesh,
  isGhost,
}: {
  model: THREE.Group | null;
  isSelected: boolean;
  isHovered: boolean;
  hasChildSelected: boolean;
  selectedChildPath?: string | null;
  hoveredChildPath: string | null;
  childPathToMesh: Map<string, { mesh: THREE.Object3D }>;
  isGhost: boolean;
}): void {
  const prevSelectedRef = useRef(isSelected);
  const prevHoveredRef = useRef(isHovered);
  const prevSelectedChildPathRef = useRef(selectedChildPath);
  const prevHoveredChildPathRef = useRef(hoveredChildPath);

  useFrame(() => {
    if (!model) return;

    const selectionChanged = prevSelectedRef.current !== isSelected;
    const hoverChanged = prevHoveredRef.current !== isHovered;
    const childSelectionChanged = prevSelectedChildPathRef.current !== selectedChildPath;
    const childHoverChanged = prevHoveredChildPathRef.current !== hoveredChildPath;

    if (
      selectionChanged ||
      hoverChanged ||
      childSelectionChanged ||
      childHoverChanged ||
      isSelected ||
      isHovered ||
      hasChildSelected ||
      hoveredChildPath
    ) {
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.set('#000000');
        }
      });

      if (hasChildSelected && selectedChildPath) {
        const entry = childPathToMesh.get(selectedChildPath);
        if (entry) {
          const mesh = entry.mesh;
          mesh.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY);
            }
          });
          if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY);
          }
        }

        if (hoveredChildPath && hoveredChildPath !== selectedChildPath) {
          const hoverEntry = childPathToMesh.get(hoveredChildPath);
          if (hoverEntry) {
            const hoverMesh = hoverEntry.mesh;
            hoverMesh.traverse((childMesh: THREE.Object3D) => {
              if (childMesh instanceof THREE.Mesh && childMesh.material instanceof THREE.MeshStandardMaterial) {
                childMesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY * 2);
              }
            });
            if (hoverMesh instanceof THREE.Mesh && hoverMesh.material instanceof THREE.MeshStandardMaterial) {
              hoverMesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY * 2);
            }
          }
        }
      } else if (isSelected) {
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            const highlightColor = isGhost ? SELECTION_COLOR_GHOST : SELECTION_COLOR;
            child.material.emissive.set(highlightColor).multiplyScalar(SELECTION_INTENSITY);
          }
        });

        if (hoveredChildPath) {
          const entry = childPathToMesh.get(hoveredChildPath);
          if (entry) {
            const mesh = entry.mesh;
            mesh.traverse((childMesh: THREE.Object3D) => {
              if (childMesh instanceof THREE.Mesh && childMesh.material instanceof THREE.MeshStandardMaterial) {
                childMesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY * 1.5);
              }
            });
            if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
              mesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY * 1.5);
            }
          }
        }
      } else if (hoveredChildPath) {
        const entry = childPathToMesh.get(hoveredChildPath);
        if (entry) {
          const mesh = entry.mesh;
          mesh.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive.set(HOVER_COLOR).multiplyScalar(HOVER_INTENSITY);
            }
          });
        }
      } else if (isHovered) {
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.set(HOVER_COLOR).multiplyScalar(HOVER_INTENSITY);
          }
        });
      }

      prevSelectedRef.current = isSelected;
      prevHoveredRef.current = isHovered;
      prevSelectedChildPathRef.current = selectedChildPath;
      prevHoveredChildPathRef.current = hoveredChildPath;
    }
  });
}

