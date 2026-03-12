import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import {
  CHILD_SELECTION_COLOR,
  HOVER_COLOR,
  HOVER_INTENSITY,
  SELECTION_COLOR,
  SELECTION_COLOR_GHOST,
  SELECTION_INTENSITY,
} from './constants';

interface MaterialHighlightState {
  signature: string;
  originalEmissive: THREE.Color;
}

function getMeshStandardMaterials(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.filter((material): material is THREE.MeshStandardMaterial => {
    return material instanceof THREE.MeshStandardMaterial;
  });
}

function applyMaterialHighlight(
  material: THREE.MeshStandardMaterial,
  highlight: { color: string; intensity: number }
): void {
  material.emissive.set(highlight.color).multiplyScalar(highlight.intensity);
}

function restoreMaterialHighlight(
  material: THREE.MeshStandardMaterial,
  originalEmissive: THREE.Color
): void {
  material.emissive.copy(originalEmissive);
}

function addObjectHighlight(
  highlightedMaterials: Map<THREE.MeshStandardMaterial, string>,
  object: THREE.Object3D | null | undefined,
  color: string,
  intensity: number
): void {
  if (!object) return;

  const signature = `${color}|${intensity}`;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    for (const material of getMeshStandardMaterials(child)) {
      highlightedMaterials.set(material, signature);
    }
  });
}

/**
 * Applies emissive-based selection feedback to imported-model materials while preserving each
 * material's original emissive color so selection state never leaks into the resting appearance.
 */
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
  const highlightedMaterialsRef = useRef<Map<THREE.MeshStandardMaterial, MaterialHighlightState>>(new Map());

  useEffect(() => {
    return () => {
      for (const [material, state] of highlightedMaterialsRef.current.entries()) {
        restoreMaterialHighlight(material, state.originalEmissive);
      }
      highlightedMaterialsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const nextHighlights = new Map<THREE.MeshStandardMaterial, string>();

    if (model) {
      if (hasChildSelected && selectedChildPath) {
        addObjectHighlight(nextHighlights, childPathToMesh.get(selectedChildPath)?.mesh, CHILD_SELECTION_COLOR, SELECTION_INTENSITY);

        if (hoveredChildPath && hoveredChildPath !== selectedChildPath) {
          addObjectHighlight(
            nextHighlights,
            childPathToMesh.get(hoveredChildPath)?.mesh,
            CHILD_SELECTION_COLOR,
            SELECTION_INTENSITY * 2
          );
        }
      } else if (isSelected) {
        addObjectHighlight(
          nextHighlights,
          model,
          isGhost ? SELECTION_COLOR_GHOST : SELECTION_COLOR,
          SELECTION_INTENSITY
        );

        if (hoveredChildPath) {
          addObjectHighlight(
            nextHighlights,
            childPathToMesh.get(hoveredChildPath)?.mesh,
            CHILD_SELECTION_COLOR,
            SELECTION_INTENSITY * 1.5
          );
        }
      } else if (hoveredChildPath) {
        addObjectHighlight(nextHighlights, childPathToMesh.get(hoveredChildPath)?.mesh, HOVER_COLOR, HOVER_INTENSITY);
      } else if (isHovered) {
        addObjectHighlight(nextHighlights, model, HOVER_COLOR, HOVER_INTENSITY);
      }
    }

    const previousHighlights = highlightedMaterialsRef.current;
    const appliedHighlights = new Map<THREE.MeshStandardMaterial, MaterialHighlightState>();

    for (const [material, previousState] of previousHighlights.entries()) {
      if (!nextHighlights.has(material)) {
        restoreMaterialHighlight(material, previousState.originalEmissive);
      }
    }

    for (const [material, signature] of nextHighlights.entries()) {
      const previousState = previousHighlights.get(material);
      const originalEmissive = previousState?.originalEmissive ?? material.emissive.clone();

      if (previousState?.signature !== signature) {
        const [color, intensity] = signature.split('|');
        applyMaterialHighlight(material, { color, intensity: Number(intensity) });
      }

      appliedHighlights.set(material, { signature, originalEmissive });
    }

    highlightedMaterialsRef.current = appliedHighlights;
  }, [
    model,
    isSelected,
    isHovered,
    hasChildSelected,
    selectedChildPath,
    hoveredChildPath,
    childPathToMesh,
    isGhost,
  ]);
}

