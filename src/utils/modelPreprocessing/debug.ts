import * as THREE from 'three';

/**
 * Log detailed hierarchy information for debugging
 */
export function logModelHierarchy(model: THREE.Group, label: string): void {
  console.group(`[modelPreprocessing] ${label} - Model Hierarchy`);

  console.log('Root transform:', {
    position: `(${model.position.x.toFixed(4)}, ${model.position.y.toFixed(4)}, ${model.position.z.toFixed(4)})`,
    rotation: `(${model.rotation.x.toFixed(4)}, ${model.rotation.y.toFixed(4)}, ${model.rotation.z.toFixed(4)})`,
    scale: `(${model.scale.x.toFixed(6)}, ${model.scale.y.toFixed(6)}, ${model.scale.z.toFixed(6)})`,
  });

  const transforms: Array<{ name: string; depth: number; scale: string; position: string }> = [];
  let meshCount = 0;
  let totalVertices = 0;

  model.traverse((child: THREE.Object3D) => {
    let depth = 0;
    let parent = child.parent;
    while (parent) {
      depth++;
      parent = parent.parent;
    }

    const hasNonIdentityScale =
      Math.abs(child.scale.x - 1) > 0.0001 ||
      Math.abs(child.scale.y - 1) > 0.0001 ||
      Math.abs(child.scale.z - 1) > 0.0001;
    const hasPosition =
      Math.abs(child.position.x) > 0.0001 ||
      Math.abs(child.position.y) > 0.0001 ||
      Math.abs(child.position.z) > 0.0001;

    if (hasNonIdentityScale || hasPosition) {
      transforms.push({
        name: child.name || child.type,
        depth,
        scale: `(${child.scale.x.toFixed(4)}, ${child.scale.y.toFixed(4)}, ${child.scale.z.toFixed(4)})`,
        position: `(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`,
      });
    }

    if (child instanceof THREE.Mesh && child.geometry) {
      meshCount++;
      const posAttr = child.geometry.attributes.position;
      if (posAttr) {
        totalVertices += posAttr.count;
      }
    }
  });

  console.log(`Meshes: ${meshCount}, Total vertices: ${totalVertices}`);

  if (transforms.length > 0) {
    console.log('Non-identity transforms in hierarchy:');
    transforms.forEach((t) => {
      console.log(`  ${'  '.repeat(t.depth)}${t.name}: scale=${t.scale}, pos=${t.position}`);
    });
  } else {
    console.log('All transforms are identity (scale=1, position=0)');
  }

  console.groupEnd();
}

