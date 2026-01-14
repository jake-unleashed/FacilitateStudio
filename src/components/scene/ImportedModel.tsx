/**
 * ImportedModel Component
 *
 * Renders uploaded 3D models in the scene with full transform, selection, and interaction support.
 *
 * ARCHITECTURE:
 * - Uses shared model cache to prevent redundant loading/preprocessing
 * - Outer group: positioned at visual center (for rotation pivot), handles rotation/scale
 * - Inner group: fixed offset of -modelHeight/2 to keep bottom at ground level
 * - This ensures models stay on ground during rotation/scaling
 * - Pointer events are attached directly to the model primitive to ensure only the mesh is interactive
 */

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneObject, ChildMesh, pathToString } from '../../types';
import { getOrLoadModel } from '../../utils/modelCache';
import { findChildByPath } from '../../utils/modelLoaders';
import { SelectObject } from './SelectionOutline';

// =============================================================================
// Constants
// =============================================================================

/** Duration of fade-in animation in milliseconds */
const FADE_IN_DURATION_MS = 300;

/** Colors for selection/hover effects */
const SELECTION_COLOR = '#3b82f6';
const SELECTION_COLOR_GHOST = '#a855f7';
const CHILD_SELECTION_COLOR = '#10b981'; // Emerald for child selection
const HOVER_COLOR = '#ffffff';
/** Selection emissive intensity - increased for clearer visibility */
const SELECTION_INTENSITY = 0.25;
/** Hover emissive intensity - increased for clearer pre-selection feedback */
const HOVER_INTENSITY = 0.18;

// =============================================================================
// Transform Utilities
// =============================================================================

/**
 * Computes pivot points for a mesh in its parent's local space.
 * Used to apply rotation around the geometric center and scale around the base.
 *
 * @param mesh - The Three.js object to compute pivots for
 * @returns Object containing localCenter (geometric center) and localBase (bottom-center)
 */
function computeMeshPivots(mesh: THREE.Object3D): {
  localCenter: THREE.Vector3;
  localBase: THREE.Vector3;
} {
  // Reset to identity to get the "base" bounding box
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrixWorld(true);

  // Compute world-space bounding box
  const box = new THREE.Box3().setFromObject(mesh);

  // Get geometric center (for rotation)
  const worldCenter = new THREE.Vector3();
  box.getCenter(worldCenter);

  // Get base center (center X, min Y, center Z) for scaling
  // This keeps objects grounded when scaled
  const worldBase = new THREE.Vector3(worldCenter.x, box.min.y, worldCenter.z);

  // Convert both to the mesh's parent's local space
  const parent = mesh.parent as THREE.Object3D | null;
  const localCenter = worldCenter.clone();
  const localBase = worldBase.clone();

  if (parent) {
    parent.updateMatrixWorld(true);
    const parentWorldMatrixInverse = parent.matrixWorld.clone().invert();
    localCenter.applyMatrix4(parentWorldMatrixInverse);
    localBase.applyMatrix4(parentWorldMatrixInverse);
  }

  return { localCenter, localBase };
}

/**
 * Calculates the position offset needed to rotate around a pivot point.
 *
 * When rotating around origin, a pivot point P moves to R(P).
 * To keep P stationary, we offset by P - R(P).
 *
 * @param pivot - The pivot point to rotate around
 * @param rotation - The rotation to apply (in radians)
 * @returns Position offset to compensate for rotation
 */
function calculateRotationOffset(pivot: THREE.Vector3, rotation: THREE.Euler): THREE.Vector3 {
  const rotatedPivot = pivot.clone().applyEuler(rotation);
  return pivot.clone().sub(rotatedPivot);
}

/**
 * Calculates the position offset needed to scale around a pivot point.
 *
 * When scaling around origin, a pivot point P moves to S*P.
 * To keep P stationary, we offset by P - S*P = P*(1-S).
 *
 * @param pivot - The pivot point to scale around
 * @param scale - The scale factors (x, y, z)
 * @returns Position offset to compensate for scaling
 */
function calculateScaleOffset(
  pivot: THREE.Vector3,
  scale: { x: number; y: number; z: number }
): THREE.Vector3 {
  return new THREE.Vector3(
    pivot.x * (1 - scale.x),
    pivot.y * (1 - scale.y),
    pivot.z * (1 - scale.z)
  );
}

// =============================================================================
// Types
// =============================================================================

interface ImportedModelProps {
  obj: SceneObject;
  isSelected: boolean;
  /** Path of the selected child mesh (if any) - format: "path.to.child" */
  selectedChildPath?: string | null;
  /**
   * Path of the child mesh to outline (if any) - format: "path.to.child".
   * Used by preview mode to highlight a target child without coupling to editor selection state.
   */
  outlinedChildPath?: string | null;
  /**
   * Called when the parent object is clicked.
   * - pendingChildPath: child to select if interaction is a click (not drag)
   * - dragChildPath: child to move if interaction is a drag (if not provided, moves root)
   */
  onPointerDown: (
    e: ThreeEvent<PointerEvent>,
    obj: SceneObject,
    pendingChildPath?: string | null,
    dragChildPath?: string | null
  ) => void;
  /** Called when a child mesh is clicked and should be directly selected/dragged */
  onChildPointerDown?: (e: ThreeEvent<PointerEvent>, obj: SceneObject, childPath: string) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isGhost?: boolean;
  /** If true, this is the actual reference object during recording (very transparent). If false but isGhost=true, it's the draggable ghost. */
  isActualReference?: boolean;
  /** If true and selectedChildPath is set, render only the target child with normal opacity, make rest very transparent */
  highlightOnlyChild?: boolean;
}

// =============================================================================
// Helper Components
// =============================================================================

/** Placeholder shown while model is loading */
const LoadingPlaceholder: React.FC = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
  </mesh>
);

// =============================================================================
// Main Component
// =============================================================================

const ImportedModelInner: React.FC<ImportedModelProps> = ({
  obj,
  isSelected,
  selectedChildPath,
  outlinedChildPath,
  onPointerDown,
  onChildPointerDown,
  onDoubleClick,
  isDragging: _isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
  isActualReference = false,
  highlightOnlyChild = false,
}) => {
  // Note: _isDragging is available for future use but currently unused
  const outerGroupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelHeight, setModelHeight] = useState<number>(0);
  // Start at opacity 1 - models should be visible immediately
  // Fade-in animation will temporarily reduce opacity if enabled
  // If isGhost is true, use ghost opacity (0.45 for draggable ghost, 0.2 for actual reference)
  const [opacity, setOpacity] = useState(isActualReference ? 0.2 : isGhost ? 0.45 : 1);

  // Track which child mesh is currently hovered (for visual feedback when parent is selected)
  const [hoveredChildPath, setHoveredChildPath] = useState<string | null>(null);

  const modelAssetId = obj.properties.modelAssetId as string | undefined;

  // Check if a specific child is selected
  const hasChildSelected = selectedChildPath !== null && selectedChildPath !== undefined;

  // Check if a child should be outlined (preview target)
  const hasOutlinedChild = outlinedChildPath !== null && outlinedChildPath !== undefined;

  // Load model from shared cache when asset ID changes
  useEffect(() => {
    if (!modelAssetId) {
      setError('No model asset ID provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reset opacity for new model load (respect isGhost prop)
    setOpacity(isGhost ? 0.45 : 0);

    getOrLoadModel(modelAssetId)
      .then(({ model: loadedModel, metrics }) => {
        if (cancelled) return;

        setModel(loadedModel);
        setModelHeight(metrics.size.y);
        setLoading(false);
        // Don't set opacity here - let the fade-in effect handle it
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ImportedModel] Failed to load model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelAssetId, isGhost, isActualReference]);

  // Set userData.objectId on outer group for scene traversal (used by TransformGizmo)
  useEffect(() => {
    if (outerGroupRef.current && outerGroupRef.current.userData) {
      outerGroupRef.current.userData.objectId = obj.id;
    }
  }, [obj.id]);

  // Outer group position: visual center for rotation pivot
  // pivotY = groundLevel + modelHeight/2
  const position = useMemo<[number, number, number]>(() => {
    const groundLevel = obj.transform.y / 100;
    const pivotY = groundLevel + modelHeight / 2;
    return [obj.transform.x / 100, pivotY, -obj.transform.z / 100];
  }, [obj.transform.x, obj.transform.y, obj.transform.z, modelHeight]);

  // Rotation calculation
  const rotation = useMemo<[number, number, number]>(
    () => [
      THREE.MathUtils.degToRad(obj.transform.rotationX),
      THREE.MathUtils.degToRad(obj.transform.rotationY),
      THREE.MathUtils.degToRad(obj.transform.rotationZ),
    ],
    [obj.transform.rotationX, obj.transform.rotationY, obj.transform.rotationZ]
  );

  // Scale calculation (no animation - separate opacity for fade-in)
  const scale = useMemo<[number, number, number]>(
    () => [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ],
    [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]
  );

  // Inner group offset: fixed offset to keep bottom at ground
  // This offset never changes, regardless of rotation or scale
  const modelOffset = useMemo<[number, number, number]>(
    () => [0, -modelHeight / 2, 0],
    [modelHeight]
  );

  // Build a map of path strings to child mesh info for efficient lookup
  // Must be defined before findChildPathForMesh which uses it
  const childPathToMesh = useMemo(() => {
    const map = new Map<string, { mesh: THREE.Object3D; childInfo: ChildMesh }>();
    if (!model || !obj.children) return map;

    for (const child of obj.children) {
      const pathStr = pathToString(child.path);
      const meshObj = findChildByPath(model, child.path);
      if (meshObj) {
        map.set(pathStr, { mesh: meshObj, childInfo: child });
      }
    }
    return map;
  }, [model, obj.children]);

  // Find which child (if any) a clicked mesh belongs to
  // Returns the DEEPEST matching child (most specific) to support nested hierarchies
  const findChildPathForMesh = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      // Collect all matching children (those that contain the clicked mesh)
      const matches: { pathStr: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        // Check if clicked mesh IS this child mesh
        if (mesh === clickedMesh) {
          matches.push({ pathStr, depth: pathStr.split('.').length });
          continue;
        }

        // Check if clicked mesh is a descendant of this child
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = clickedMesh;
        while (current && current !== model) {
          if (current === mesh) {
            matches.push({ pathStr, depth: pathStr.split('.').length });
            break;
          }
          current = current.parent;
        }
      }

      if (matches.length === 0) return null;

      // Return the deepest match (most specific child)
      matches.sort((a, b) => b.depth - a.depth);
      return matches[0].pathStr;
    },
    [model, obj.children, childPathToMesh]
  );

  // Find a child that is deeper than the current selection and contains the clicked mesh
  // Used for drilling down into nested hierarchies
  const findDeeperChild = useCallback(
    (currentChildPath: string, clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      const currentDepth = currentChildPath.split('.').length;

      // Find children that are deeper than the current selection
      const deeperMatches: { pathStr: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        const pathDepth = pathStr.split('.').length;

        // Only consider children that are deeper than current selection
        // AND whose path starts with the current selection path
        if (pathDepth <= currentDepth) continue;
        if (!pathStr.startsWith(currentChildPath + '.') && pathStr !== currentChildPath) continue;

        // Check if clicked mesh IS this child mesh or a descendant of it
        if (mesh === clickedMesh) {
          deeperMatches.push({ pathStr, depth: pathDepth });
          continue;
        }

        // Check if clicked mesh is a descendant of this child
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = clickedMesh;
        while (current && current !== model) {
          if (current === mesh) {
            deeperMatches.push({ pathStr, depth: pathDepth });
            break;
          }
          current = current.parent;
        }
      }

      if (deeperMatches.length === 0) return null;

      // Return the shallowest of the deeper matches (next level down)
      // This allows step-by-step drilling into the hierarchy
      deeperMatches.sort((a, b) => a.depth - b.depth);
      return deeperMatches[0].pathStr;
    },
    [model, obj.children, childPathToMesh]
  );

  // Find the shallowest (first-level) child that contains the clicked mesh
  // Used when first selecting a child from parent selection - always start at top level
  const findFirstLevelChild = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      // Find all matching children
      const matches: { pathStr: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        // Check if clicked mesh IS this child mesh
        if (mesh === clickedMesh) {
          matches.push({ pathStr, depth: pathStr.split('.').length });
          continue;
        }

        // Check if clicked mesh is a descendant of this child
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = clickedMesh;
        while (current && current !== model) {
          if (current === mesh) {
            matches.push({ pathStr, depth: pathStr.split('.').length });
            break;
          }
          current = current.parent;
        }
      }

      if (matches.length === 0) return null;

      // Return the shallowest match (first-level child)
      matches.sort((a, b) => a.depth - b.depth);
      return matches[0].pathStr;
    },
    [model, obj.children, childPathToMesh]
  );

  // Find a sibling child at the same hierarchy level as the currently selected child
  // Used for sibling navigation - clicking on adjacent children selects them at the same depth
  const findSiblingAtSameLevel = useCallback(
    (clickedMesh: THREE.Object3D, currentSelectionPath: string): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      const currentDepth = currentSelectionPath.split('.').length;
      const currentParentPath = currentSelectionPath.split('.').slice(0, -1).join('.');

      // Find all children whose mesh contains the clicked point
      const matchingPaths: { path: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        // Check if clickedMesh is this mesh or a descendant of it
        let isMatch = false;

        if (mesh === clickedMesh) {
          isMatch = true;
        } else {
          // Traverse up from clickedMesh to see if we hit this mesh
          let current = clickedMesh.parent;
          while (current && current !== model) {
            if (current === mesh) {
              isMatch = true;
              break;
            }
            current = current.parent;
          }
        }

        if (isMatch) {
          matchingPaths.push({
            path: pathStr,
            depth: pathStr.split('.').length,
          });
        }
      }

      if (matchingPaths.length === 0) return null;

      // Sort by depth (shallowest first)
      matchingPaths.sort((a, b) => a.depth - b.depth);

      // Strategy 1: Find a match at exactly the same depth
      const sameLevelMatch = matchingPaths.find((m) => m.depth === currentDepth);
      if (sameLevelMatch) {
        return sameLevelMatch.path;
      }

      // Strategy 2: Find a sibling (same parent path prefix)
      if (currentParentPath) {
        const siblingMatch = matchingPaths.find(
          (m) => m.path.startsWith(currentParentPath + '.') && m.depth === currentDepth
        );
        if (siblingMatch) {
          return siblingMatch.path;
        }
      }

      // Strategy 3: Return the shallowest match (closest to the current level without drilling)
      const shallowerMatch = matchingPaths.find((m) => m.depth <= currentDepth);
      if (shallowerMatch) {
        return shallowerMatch.path;
      }

      // Fallback: return shallowest overall
      return matchingPaths[0].path;
    },
    [model, obj.children, childPathToMesh]
  );

  // Memoize event handlers
  // Multi-tier selection: keep clicking to drill deeper into the hierarchy
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      // Check if a specific child was clicked (returns deepest matching child)
      const childPath = findChildPathForMesh(e.object);

      // Multi-tier selection logic:
      // 1. If parent is NOT selected: always select the parent (ignore child)
      // 2. If parent IS selected but NO child is selected:
      //    - Set up drag for parent with pending child path (first-level child)
      //    - Child will only be selected if it's a click (not a drag)
      // 3. If a child IS already selected:
      //    - Check for deeper children: if clicked area has a deeper child, select it
      //    - If no deeper child and clicking same child: drag that child
      //    - If clicking a different child at same/shallower level: select it

      if (!isSelected) {
        // Parent not selected - first click always selects the parent
        onPointerDown(e, obj);
      } else if (hasChildSelected && selectedChildPath) {
        // A child is already selected
        // Check if the clicked mesh is part of the selected child's subtree
        const isClickedOnSelectedSubtree =
          childPath &&
          (childPath === selectedChildPath || childPath.startsWith(selectedChildPath + '.'));

        if (isClickedOnSelectedSubtree) {
          // Clicked on the selected child or one of its descendants
          // First check if there's a deeper child we can drill down to
          const deeperChild = findDeeperChild(selectedChildPath, e.object);

          if (deeperChild) {
            // There's a deeper child - use pending selection mechanism
            // Click = select the deeper child, Drag = move the currently selected child
            // Pass selectedChildPath as dragChildPath so dragging moves the selected child, not root
            onPointerDown(e, obj, deeperChild, selectedChildPath);
          } else {
            // No deeper child available - start drag for the selected child
            // This moves the selected subtree
            if (onChildPointerDown) {
              onChildPointerDown(e, obj, selectedChildPath);
            }
          }
        } else if (childPath) {
          // Clicked on a different child (outside the selected subtree)
          // Require intentional selection: click selects, drag moves parent (not the new child)
          // This prevents accidental dragging of unselected children
          const siblingPath = findSiblingAtSameLevel(e.object, selectedChildPath);
          // Pass as pendingChildPath - click will select, drag will move parent
          onPointerDown(e, obj, siblingPath || childPath);
        } else {
          // Clicked on non-child area - keep parent selected, allow drag of root
          onPointerDown(e, obj);
        }
      } else if (childPath) {
        // Parent is selected, no child selected yet, clicked on a child
        // Find the shallowest child that contains the clicked mesh (first level only)
        const firstLevelChild = findFirstLevelChild(e.object);
        // Pass the first-level child path as "pending" - only select if it's a click (not a drag)
        onPointerDown(e, obj, firstLevelChild || childPath);
      } else {
        // Parent is selected, clicking on non-child area or no children exist
        // Keep parent selected and allow drag
        onPointerDown(e, obj);
      }
    },
    [
      onPointerDown,
      onChildPointerDown,
      obj,
      findChildPathForMesh,
      findDeeperChild,
      findFirstLevelChild,
      findSiblingAtSameLevel,
      isSelected,
      hasChildSelected,
      selectedChildPath,
    ]
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(obj);
  }, [onDoubleClick, obj]);

  // Handle pointer move to track which child is being hovered
  // Shows hover for:
  // - First-level children when parent is selected (no child selected)
  // - Deeper children when a child is selected (to show what can be drilled into)
  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isSelected) {
        // Parent not selected - no hover tracking needed
        if (hoveredChildPath !== null) {
          setHoveredChildPath(null);
        }
        return;
      }

      if (hasChildSelected && selectedChildPath) {
        // A child is selected - check for deeper children that can be selected
        const deeperChild = findDeeperChild(selectedChildPath, e.object);
        if (deeperChild !== hoveredChildPath) {
          setHoveredChildPath(deeperChild);
        }
      } else {
        // Parent selected, no child - show first-level child hover
        const firstLevelChild = findFirstLevelChild(e.object);
        if (firstLevelChild !== hoveredChildPath) {
          setHoveredChildPath(firstLevelChild);
        }
      }
    },
    [
      isSelected,
      hasChildSelected,
      selectedChildPath,
      hoveredChildPath,
      findDeeperChild,
      findFirstLevelChild,
    ]
  );

  // Clear hover state when pointer leaves the model
  const handlePointerLeave = useCallback(() => {
    if (hoveredChildPath !== null) {
      setHoveredChildPath(null);
    }
    onHoverEnd();
  }, [hoveredChildPath, onHoverEnd]);

  // Fade-in animation with proper cleanup
  useEffect(() => {
    if (!loading && !error && model) {
      let cancelled = false;
      const startTime = Date.now();

      const animate = () => {
        if (cancelled) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / FADE_IN_DURATION_MS, 1);
        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        setOpacity(eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);

      return () => {
        cancelled = true;
      };
    }
  }, [loading, error, model]);

  // Precompute the set of meshes belonging to the selected child subtree.
  // This avoids an O(N^2) search during material traversal when highlighting a single child.
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

  // Apply opacity to model materials - runs for ALL opacity values including 1
  // If isGhost is true, override opacity based on ghost type (0.2 for actual reference, 0.45 for draggable ghost)
  // If highlightOnlyChild is true and selectedChildPath is set, only the target child gets normal ghost opacity
  useEffect(() => {
    if (!model) return;

    // Determine final opacity: if isActualReference use 0.2, if isGhost use 0.45, otherwise use state opacity
    const ghostOpacity = isActualReference ? 0.2 : isGhost ? 0.45 : opacity;
    const dimmedOpacity = 0.05; // Very transparent for non-target parts

    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        const isTargetChildMesh = targetChildMeshSet ? targetChildMeshSet.has(child) : true;

        // When highlighting only a child, dim everything that is NOT part of the selected subtree.
        const finalOpacity =
          highlightOnlyChild && hasChildSelected && targetChildMeshSet && !isTargetChildMesh
            ? dimmedOpacity
            : ghostOpacity;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (
            mat instanceof THREE.MeshStandardMaterial ||
            mat instanceof THREE.MeshBasicMaterial ||
            mat instanceof THREE.MeshPhongMaterial ||
            mat instanceof THREE.MeshLambertMaterial
          ) {
            // When opacity is 1, disable transparency for better rendering
            const isTransparent = finalOpacity < 1;
            mat.transparent = isTransparent;
            mat.opacity = finalOpacity;
            // Ensure Three.js knows to update the material
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

  // Apply child transforms when they change
  // Uses center-based rotation (around visual center) and base-centered scaling (around bottom-center)
  useEffect(() => {
    if (!model || !obj.children) return;

    for (const child of obj.children) {
      const pathStr = pathToString(child.path);
      const entry = childPathToMesh.get(pathStr);
      if (!entry) continue;

      const mesh = entry.mesh as THREE.Object3D;
      const lt = entry.childInfo.localTransform;

      // User-specified position offset (scaled and Z-negated per coordinate convention)
      const userOffset = new THREE.Vector3(lt.x / 100, lt.y / 100, -lt.z / 100);

      // Compute pivot points dynamically from the mesh's bounding box
      // - localCenter: geometric center (for rotation)
      // - localBase: bottom-center (for scaling, keeps objects grounded)
      const { localCenter, localBase } = computeMeshPivots(mesh);

      // Convert user rotation from degrees to radians
      const rotationEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(lt.rotationX),
        THREE.MathUtils.degToRad(lt.rotationY),
        THREE.MathUtils.degToRad(lt.rotationZ),
        'XYZ'
      );

      // Calculate position offsets for pivot-based transforms
      const rotationOffset = calculateRotationOffset(localCenter, rotationEuler);
      const scaleOffset = calculateScaleOffset(localBase, {
        x: lt.scaleX,
        y: lt.scaleY,
        z: lt.scaleZ,
      });

      // Apply combined position: user offset + rotation compensation + scale compensation
      mesh.position.set(
        userOffset.x + rotationOffset.x + scaleOffset.x,
        userOffset.y + rotationOffset.y + scaleOffset.y,
        userOffset.z + rotationOffset.z + scaleOffset.z
      );

      // Apply rotation and scale
      mesh.rotation.copy(rotationEuler);
      mesh.scale.set(lt.scaleX, lt.scaleY, lt.scaleZ);
    }
  }, [model, obj.children, childPathToMesh]);

  // Selection and hover effects (optimized: only run when needed)
  const prevSelectedRef = useRef(isSelected);
  const prevHoveredRef = useRef(isHovered);
  const prevSelectedChildPathRef = useRef(selectedChildPath);
  const prevHoveredChildPathRef = useRef(hoveredChildPath);

  useFrame(() => {
    if (!model) return;

    // Only update materials if selection/hover state changed
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
      // Reset all materials first
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.set('#000000');
        }
      });

      // If a child is selected, highlight that child + any hovered deeper child
      if (hasChildSelected && selectedChildPath) {
        const entry = childPathToMesh.get(selectedChildPath);
        if (entry) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mesh = entry.mesh as any;
          mesh.traverse((child: THREE.Object3D) => {
            if (
              child instanceof THREE.Mesh &&
              child.material instanceof THREE.MeshStandardMaterial
            ) {
              child.material.emissive
                .set(CHILD_SELECTION_COLOR)
                .multiplyScalar(SELECTION_INTENSITY);
            }
          });
          // Also check if it's a single mesh (not a group with children)
          if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY);
          }
        }

        // If hovering over a deeper child, highlight it more intensely
        // This indicates it can be selected by clicking again
        if (hoveredChildPath && hoveredChildPath !== selectedChildPath) {
          const hoverEntry = childPathToMesh.get(hoveredChildPath);
          if (hoverEntry) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hoverMesh = hoverEntry.mesh as any;
            hoverMesh.traverse((childMesh: THREE.Object3D) => {
              if (
                childMesh instanceof THREE.Mesh &&
                childMesh.material instanceof THREE.MeshStandardMaterial
              ) {
                // Use brighter emerald to indicate deeper child can be selected
                childMesh.material.emissive
                  .set(CHILD_SELECTION_COLOR)
                  .multiplyScalar(SELECTION_INTENSITY * 2);
              }
            });
            if (
              hoverMesh instanceof THREE.Mesh &&
              hoverMesh.material instanceof THREE.MeshStandardMaterial
            ) {
              hoverMesh.material.emissive
                .set(CHILD_SELECTION_COLOR)
                .multiplyScalar(SELECTION_INTENSITY * 2);
            }
          }
        }
      }
      // If parent is selected (no child selected yet)
      else if (isSelected) {
        // First, apply subtle parent selection to entire model
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            // For actual objects during recording (isGhost=true), use lower opacity
            // For draggable ghost objects, use normal ghost color
            const highlightColor = isGhost ? SELECTION_COLOR_GHOST : SELECTION_COLOR;
            child.material.emissive.set(highlightColor).multiplyScalar(SELECTION_INTENSITY);
          }
        });

        // If a child is being hovered while parent is selected, add stronger highlight to that child
        // This indicates the child can be selected with a click
        if (hoveredChildPath) {
          const entry = childPathToMesh.get(hoveredChildPath);
          if (entry) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mesh = entry.mesh as any;
            mesh.traverse((childMesh: THREE.Object3D) => {
              if (
                childMesh instanceof THREE.Mesh &&
                childMesh.material instanceof THREE.MeshStandardMaterial
              ) {
                // Use emerald color (same as child selection) but with hover intensity
                // This creates a preview of what will be selected
                childMesh.material.emissive
                  .set(CHILD_SELECTION_COLOR)
                  .multiplyScalar(SELECTION_INTENSITY * 1.5);
              }
            });
            // Also check if it's a single mesh
            if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
              mesh.material.emissive
                .set(CHILD_SELECTION_COLOR)
                .multiplyScalar(SELECTION_INTENSITY * 1.5);
            }
          }
        }
      }
      // If a child is hovered (parent not selected) - shouldn't happen with two-tier selection
      else if (hoveredChildPath) {
        const entry = childPathToMesh.get(hoveredChildPath);
        if (entry) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mesh = entry.mesh as any;
          mesh.traverse((child: THREE.Object3D) => {
            if (
              child instanceof THREE.Mesh &&
              child.material instanceof THREE.MeshStandardMaterial
            ) {
              child.material.emissive.set(HOVER_COLOR).multiplyScalar(HOVER_INTENSITY);
            }
          });
        }
      }
      // If parent is hovered (not selected)
      else if (isHovered) {
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

  // Get the selected child mesh for outline rendering
  // NOTE: This hook MUST be called before any early returns to satisfy React's rules of hooks
  const selectedChildMesh = useMemo(() => {
    if (!hasChildSelected || !selectedChildPath || !model) return null;
    const entry = childPathToMesh.get(selectedChildPath);
    return entry?.mesh ?? null;
  }, [hasChildSelected, selectedChildPath, childPathToMesh, model]);

  // Get the outlined child mesh (preview target) for outline rendering
  // NOTE: This hook MUST be called before any early returns to satisfy React's rules of hooks
  const outlinedChildMesh = useMemo(() => {
    if (!hasOutlinedChild || !outlinedChildPath || !model) return null;
    const entry = childPathToMesh.get(outlinedChildPath);
    return entry?.mesh ?? null;
  }, [hasOutlinedChild, outlinedChildPath, childPathToMesh, model]);

  // Render error state
  if (error) {
    return (
      <group ref={outerGroupRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.7} />
        </mesh>
      </group>
    );
  }

  // Render loading state
  if (loading || !model) {
    return (
      <group ref={outerGroupRef} position={position} rotation={rotation} scale={scale}>
        <LoadingPlaceholder />
      </group>
    );
  }

  // Render model with two-group structure
  // Outer group: positioned at visual center, handles rotation/scale
  // Inner group: fixed offset to keep bottom at ground
  return (
    <group ref={outerGroupRef} position={position} rotation={rotation} scale={scale}>
      <group position={modelOffset}>
        {/* Render model with pointer events attached directly to it */}
        {/* This ensures only the mesh is clickable, not the bounding box or empty space */}
        <primitive
          object={model}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onPointerOver={onHoverStart}
          onPointerOut={handlePointerLeave}
          onPointerMove={handlePointerMove}
        />

        {/* Post-processing outline for selected child mesh */}
        <SelectObject
          object={outlinedChildMesh ?? selectedChildMesh}
          enabled={
            (hasOutlinedChild && outlinedChildMesh !== null) ||
            (hasChildSelected && selectedChildMesh !== null)
          }
        />
      </group>
    </group>
  );
};

// Memoized wrapper for performance
export const ImportedModel = React.memo(ImportedModelInner, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.obj.id === nextProps.obj.id &&
    prevProps.obj.transform.x === nextProps.obj.transform.x &&
    prevProps.obj.transform.y === nextProps.obj.transform.y &&
    prevProps.obj.transform.z === nextProps.obj.transform.z &&
    prevProps.obj.transform.rotationX === nextProps.obj.transform.rotationX &&
    prevProps.obj.transform.rotationY === nextProps.obj.transform.rotationY &&
    prevProps.obj.transform.rotationZ === nextProps.obj.transform.rotationZ &&
    prevProps.obj.transform.scaleX === nextProps.obj.transform.scaleX &&
    prevProps.obj.transform.scaleY === nextProps.obj.transform.scaleY &&
    prevProps.obj.transform.scaleZ === nextProps.obj.transform.scaleZ &&
    prevProps.obj.children === nextProps.obj.children &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectedChildPath === nextProps.selectedChildPath &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.isGhost === nextProps.isGhost &&
    prevProps.isActualReference === nextProps.isActualReference &&
    prevProps.highlightOnlyChild === nextProps.highlightOnlyChild
  );
});

ImportedModel.displayName = 'ImportedModel';
