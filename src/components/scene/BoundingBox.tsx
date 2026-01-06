/**
 * BoundingBox Component
 *
 * Premium bounding box selection indicator with clean edges.
 * Provides elegant visual feedback for selected 3D models and primitives.
 *
 * Features:
 * - Clean 12-edge wireframe cube (no diagonals)
 * - Smooth fade-in/fade-out transitions
 * - Non-interactive (doesn't intercept pointer events)
 * - Adapts to any THREE.Object3D model
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

interface BoundingBoxProps {
  /** The 3D object to create bounding box for (Group, Mesh, or any Object3D) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  /** Bounding box color (default: #3b82f6 - blue) */
  color?: string;
  /** Whether the bounding box is visible */
  visible?: boolean;
}

interface BoundingBoxData {
  box: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
}

// ============================================================================
// Constants
// ============================================================================

/** Target opacity when fully visible */
const TARGET_OPACITY = 0.95;

/** Fade-in speed per frame */
const FADE_IN_SPEED = 0.1;

/** Fade-out speed per frame */
const FADE_OUT_SPEED = 0.15;

/** Default selection color */
const DEFAULT_COLOR = '#3b82f6';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the 8 corners of a bounding box as Vector3 array
 */
function getBoxCorners(box: THREE.Box3): THREE.Vector3[] {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z), // 0: bottom-left-back
    new THREE.Vector3(max.x, min.y, min.z), // 1: bottom-right-back
    new THREE.Vector3(max.x, min.y, max.z), // 2: bottom-right-front
    new THREE.Vector3(min.x, min.y, max.z), // 3: bottom-left-front
    new THREE.Vector3(min.x, max.y, min.z), // 4: top-left-back
    new THREE.Vector3(max.x, max.y, min.z), // 5: top-right-back
    new THREE.Vector3(max.x, max.y, max.z), // 6: top-right-front
    new THREE.Vector3(min.x, max.y, max.z), // 7: top-left-front
  ];
}

/**
 * Create edge geometry for a bounding box.
 * Generates 12 edges connecting the 8 corners without diagonals.
 */
function createEdgeGeometry(box: THREE.Box3): THREE.BufferGeometry {
  const corners = getBoxCorners(box);

  // Define 12 edges as pairs of corner indices
  const edgeIndices: [number, number][] = [
    // Bottom face edges
    [0, 1], // back-bottom
    [1, 2], // right-bottom
    [2, 3], // front-bottom
    [3, 0], // left-bottom
    // Top face edges
    [4, 5], // back-top
    [5, 6], // right-top
    [6, 7], // front-top
    [7, 4], // left-top
    // Vertical edges
    [0, 4], // left-back
    [1, 5], // right-back
    [2, 6], // right-front
    [3, 7], // left-front
  ];

  // Create position buffer: 12 edges × 2 vertices × 3 components
  const positions = new Float32Array(edgeIndices.length * 6);
  let offset = 0;

  for (const [startIdx, endIdx] of edgeIndices) {
    const start = corners[startIdx];
    const end = corners[endIdx];

    positions[offset++] = start.x;
    positions[offset++] = start.y;
    positions[offset++] = start.z;
    positions[offset++] = end.x;
    positions[offset++] = end.y;
    positions[offset++] = end.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return geometry;
}

/**
 * Calculate the bounding box data for a 3D model.
 * Properly handles all nested transforms, including when the model
 * itself is a Mesh (for child selection).
 *
 * The bounding box includes the model's own transform (position/rotation/scale),
 * so the rendered wireframe will be at the correct position in the parent space.
 */
function calculateBoundingBoxData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
): BoundingBoxData | null {
  if (!model) return null;

  const box = new THREE.Box3();
  const isModelMesh = model instanceof THREE.Mesh;

  // Traverse all meshes and calculate combined bounding box
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model.traverse((child: any) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;

      // Ensure geometry has computed bounding box
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      if (geometry.boundingBox) {
        const corners = getBoxCorners(geometry.boundingBox);

        // Build the transform matrix from geometry space to model's parent space
        // We accumulate transforms from the mesh all the way up to and INCLUDING the model
        const transformMatrix = new THREE.Matrix4();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = child;
        const matrices: THREE.Matrix4[] = [];

        // Collect matrices from child up to model (inclusive)
        while (current) {
          if (current.matrixAutoUpdate) {
            current.updateMatrix();
          }
          matrices.push(current.matrix.clone());

          // Stop after we've included the model's matrix
          if (current === model) break;
          current = current.parent;
        }

        // Apply matrices in reverse order (outermost to innermost)
        for (let i = matrices.length - 1; i >= 0; i--) {
          transformMatrix.multiply(matrices[i]);
        }

        // Transform corners and expand box
        for (const corner of corners) {
          corner.applyMatrix4(transformMatrix);
          box.expandByPoint(corner);
        }
      }
    }
  });

  // For models that are Groups (not Meshes), traverse doesn't include the model itself
  // So we still need to apply the model's transform if it has one and isn't a mesh
  if (!isModelMesh && !box.isEmpty()) {
    const hasTransforms =
      model.position.lengthSq() > 0 ||
      model.rotation.x !== 0 ||
      model.rotation.y !== 0 ||
      model.rotation.z !== 0 ||
      model.scale.x !== 1 ||
      model.scale.y !== 1 ||
      model.scale.z !== 1;

    if (hasTransforms) {
      model.updateMatrix();
      const corners = getBoxCorners(box);
      const transformedBox = new THREE.Box3();

      for (const corner of corners) {
        corner.applyMatrix4(model.matrix);
        transformedBox.expandByPoint(corner);
      }
      box.copy(transformedBox);
    }
  }

  // Fallback for empty box
  if (box.isEmpty()) {
    box.setFromObject(model);
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Return null for zero-size models
  if (size.x === 0 && size.y === 0 && size.z === 0) {
    return null;
  }

  return { box, size, center };
}

// ============================================================================
// Component
// ============================================================================

/**
 * BoundingBox - Premium selection indicator for 3D objects
 *
 * Renders a clean wireframe cube around the selected object with
 * smooth fade transitions and non-interactive behavior.
 */
export const BoundingBox: React.FC<BoundingBoxProps> = ({
  model,
  color = DEFAULT_COLOR,
  visible = true,
}) => {
  // Refs for mutable state (doesn't trigger re-renders)
  const groupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(visible ? TARGET_OPACITY : 0);
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);

  // Calculate bounding box from model
  const boundingBoxData = useMemo(() => calculateBoundingBoxData(model), [model]);

  // Create edge geometry from bounding box
  const edgeGeometry = useMemo(() => {
    if (!boundingBoxData) return null;
    return createEdgeGeometry(boundingBoxData.box);
  }, [boundingBoxData]);

  // Create edge material with initial opacity
  const edgeMaterial = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: opacityRef.current,
      linewidth: 2, // Note: linewidth > 1 has limited browser support
      depthWrite: false,
      depthTest: true,
    });
    edgeMaterialRef.current = material;
    return material;
  }, [color]);

  // Update material color when prop changes
  useEffect(() => {
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.color.set(color);
    }
  }, [color]);

  // Disable raycasting so bounding box doesn't intercept pointer events
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        child.raycast = () => {};
      });
    }
  }, [boundingBoxData]); // Re-run when geometry changes

  // Animate fade-in/fade-out for smooth visibility transitions
  useFrame(() => {
    if (!groupRef.current || !boundingBoxData) return;

    // Update opacity based on visibility
    if (visible) {
      if (opacityRef.current < TARGET_OPACITY) {
        opacityRef.current = Math.min(TARGET_OPACITY, opacityRef.current + FADE_IN_SPEED);
      }
    } else {
      opacityRef.current = Math.max(0, opacityRef.current - FADE_OUT_SPEED);
    }

    // Apply opacity to material
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity = opacityRef.current;
    }
  });

  // Early return after all hooks
  if (!boundingBoxData || !edgeGeometry) {
    return null;
  }

  // Don't render if fully faded out
  if (!visible && opacityRef.current <= 0) {
    return null;
  }

  return (
    // eslint-disable-next-line react/no-unknown-property
    <group ref={groupRef} renderOrder={999}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <lineSegments geometry={edgeGeometry} material={edgeMaterial} />
    </group>
  );
};

// Export helpers for testing
export { createEdgeGeometry, calculateBoundingBoxData };
