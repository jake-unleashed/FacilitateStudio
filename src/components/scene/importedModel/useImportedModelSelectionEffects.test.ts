import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { useImportedModelSelectionEffects } from './useImportedModelSelectionEffects';

function createModelWithMaterial(emissiveHex = 0x224466): {
  model: THREE.Group;
  material: THREE.MeshStandardMaterial;
} {
  const model = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ emissive: emissiveHex });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  model.add(mesh);

  return { model, material };
}

afterEach(() => {
  THREE.Cache.clear();
});

describe('useImportedModelSelectionEffects', () => {
  it('restores the original emissive color after selection is cleared', () => {
    const { model, material } = createModelWithMaterial();
    const originalHex = material.emissive.getHex();

    const { rerender, unmount } = renderHook(
      (props: Parameters<typeof useImportedModelSelectionEffects>[0]) =>
        useImportedModelSelectionEffects(props),
      {
        initialProps: {
          model,
          isSelected: true,
          isHovered: false,
          hasChildSelected: false,
          selectedChildPath: null,
          hoveredChildPath: null,
          childPathToMesh: new Map(),
          isGhost: false,
        },
      }
    );

    expect(material.emissive.getHex()).not.toBe(originalHex);

    rerender({
      model,
      isSelected: false,
      isHovered: false,
      hasChildSelected: false,
      selectedChildPath: null,
      hoveredChildPath: null,
      childPathToMesh: new Map(),
      isGhost: false,
    });

    expect(material.emissive.getHex()).toBe(originalHex);

    unmount();
    material.dispose();
    meshGeometryDispose(model);
  });

  it('restores the original emissive color when unmounted while highlighted', () => {
    const { model, material } = createModelWithMaterial(0x113355);
    const originalHex = material.emissive.getHex();

    const { unmount } = renderHook(
      () =>
        useImportedModelSelectionEffects({
          model,
          isSelected: true,
          isHovered: false,
          hasChildSelected: false,
          selectedChildPath: null,
          hoveredChildPath: null,
          childPathToMesh: new Map(),
          isGhost: false,
        })
    );

    expect(material.emissive.getHex()).not.toBe(originalHex);

    unmount();

    expect(material.emissive.getHex()).toBe(originalHex);

    material.dispose();
    meshGeometryDispose(model);
  });
});

function meshGeometryDispose(model: THREE.Object3D): void {
  model.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
    }
  });
}
