import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import * as THREEImpl from 'three';

export function useImportedModelOpacityMaterials({
  model,
  opacity,
  isGhost,
  isActualReference,
  highlightOnlyChild,
  hasChildSelected,
  selectedChildPath,
  childPathToMesh,
}: {
  model: THREE.Group | null;
  opacity: number;
  isGhost: boolean;
  isActualReference: boolean;
  highlightOnlyChild: boolean;
  hasChildSelected: boolean;
  selectedChildPath?: string | null;
  childPathToMesh: Map<string, { mesh: THREE.Object3D }>;
}): void {
  const targetChildMeshSet = useMemo(() => {
    if (!highlightOnlyChild || !hasChildSelected || !selectedChildPath) return null;

    const set = new WeakSet<THREE.Object3D>();
    for (const [pathStr, entry] of childPathToMesh.entries()) {
      if (pathStr === selectedChildPath || pathStr.startsWith(selectedChildPath + '.')) {
        set.add(entry.mesh);
      }
    }
    return set;
  }, [highlightOnlyChild, hasChildSelected, selectedChildPath, childPathToMesh]);

  useEffect(() => {
    if (!model) return;

    const ghostOpacity = isActualReference ? 0.2 : isGhost ? 0.45 : opacity;
    const dimmedOpacity = 0.05;

    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREEImpl.Mesh && child.material) {
        const isTargetChildMesh = targetChildMeshSet ? targetChildMeshSet.has(child) : true;
        const finalOpacity =
          highlightOnlyChild && hasChildSelected && targetChildMeshSet && !isTargetChildMesh
            ? dimmedOpacity
            : ghostOpacity;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (
            mat instanceof THREEImpl.MeshStandardMaterial ||
            mat instanceof THREEImpl.MeshBasicMaterial ||
            mat instanceof THREEImpl.MeshPhongMaterial ||
            mat instanceof THREEImpl.MeshLambertMaterial
          ) {
            const isTransparent = finalOpacity < 1;
            mat.transparent = isTransparent;
            mat.opacity = finalOpacity;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }, [
    model,
    opacity,
    isGhost,
    isActualReference,
    highlightOnlyChild,
    hasChildSelected,
    targetChildMeshSet,
  ]);
}

