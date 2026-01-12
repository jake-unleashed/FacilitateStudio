import React, { Suspense, useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  SceneObject,
  SimStep,
  FocusMode,
  parseSelectionId,
  createChildSelectionId,
  pathToString,
} from '../types';
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  GROUND_PLANE_EXTENT,
  XZ_BOUNDARY_INTERNAL,
} from '../constants';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { CameraControls, Environment, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { PerformanceMonitorScene, PerformanceMonitorUI } from './PerformanceMonitor';
import { PreviewMoveItemStepRenderer } from './preview/PreviewMoveItemStepRenderer';
import { ImportedModel } from './scene/ImportedModel';
import {
  ChildSelectionProvider,
  ChildOutlineEffect,
  Select,
  SelectionOutlineEffect,
} from './scene/SelectionOutline';
import { Selection } from '@react-three/postprocessing';
import { TransformGizmo } from './scene/TransformGizmo';

// Check if we're in development mode (Vite provides this)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV ?? process.env.NODE_ENV === 'development';

// ============================================================================
// Grid and Shadow Configuration
// ============================================================================

/**
 * How quickly the grid fades at its edges.
 * Higher values = faster fade = sharper edge
 * Lower values = slower fade = softer edge
 * Note: With fixed-size grid, this controls the edge softness.
 */
const GRID_FADE_STRENGTH = 2.0;

/**
 * GridWithNoDepth - A wrapper around the drei Grid component that disables depth writing.
 *
 * Problem: The Grid component writes to the depth buffer, which interferes with the
 * postprocessing Outline effect's depth comparison. This causes selection outlines to
 * incorrectly appear as "hidden" (showing the hiddenEdgeColor) when objects are positioned
 * on certain sides of the grid.
 *
 * Solution: Disable depthWrite on the Grid's shader material so it doesn't affect
 * depth-based post-processing effects. Combined with renderOrder={-1}, this ensures
 * the grid is purely visual and doesn't interfere with object selection outlines.
 */
interface GridWithNoDepthProps {
  args: [number, number];
  cellSize: number;
  sectionSize: number;
  fadeDistance: number;
  fadeStrength: number;
  sectionColor: string;
  cellColor: string;
  sectionThickness: number;
  cellThickness: number;
  side: THREE.Side;
}

const GridWithNoDepth: React.FC<GridWithNoDepthProps> = (props) => {
  const gridRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (gridRef.current) {
      // The Grid component creates a mesh with a custom shader material
      // Disable depthWrite to prevent interference with Outline effect's depth comparison
      const material = gridRef.current.material as THREE.ShaderMaterial;
      if (material) {
        material.depthWrite = false;
      }
    }
  }, []);

  // renderOrder={-1} ensures grid renders before scene objects
  return <Grid ref={gridRef} {...props} renderOrder={-1} />;
};

// ============================================================================
// Fixed Contact Shadows Component
// ============================================================================

/**
 * FixedContactShadows - A contact shadow implementation that explicitly clears
 * its render target before each render to prevent shadow trail accumulation.
 *
 * This fixes an issue where the EffectComposer could interfere with render target
 * clearing, causing ContactShadows to accumulate frames instead of clearing
 * between renders.
 *
 * The fix: We explicitly clear the render target before rendering, making this
 * component independent of EffectComposer's autoClear setting.
 */
interface FixedContactShadowsProps {
  opacity?: number;
  width?: number;
  height?: number;
  blur?: number;
  far?: number;
  resolution?: number;
  smooth?: boolean;
  color?: string;
  scale?: number | [number, number];
  depthWrite?: boolean;
}

const FixedContactShadows: React.FC<FixedContactShadowsProps> = ({
  opacity = 0.4,
  width = 1,
  height = 1,
  blur = 1,
  far = 10,
  resolution = 512,
  smooth = true,
  color = '#000000',
  scale = 10,
  depthWrite = false,
}) => {
  const ref = useRef<THREE.Group>(null);
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const shadowCameraRef = useRef<THREE.OrthographicCamera>(null);

  // Calculate dimensions
  const scaledWidth = width * (Array.isArray(scale) ? scale[0] : scale);
  const scaledHeight = height * (Array.isArray(scale) ? scale[1] : scale);

  // Create render targets and materials (memoized)
  const [
    renderTarget,
    renderTargetBlur,
    planeGeometry,
    depthMaterial,
    blurPlane,
    horizontalBlurMaterial,
    verticalBlurMaterial,
  ] = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(resolution, resolution);
    const rtBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    rt.texture.generateMipmaps = rtBlur.texture.generateMipmaps = false;

    const geo = new THREE.PlaneGeometry(scaledWidth, scaledHeight).rotateX(Math.PI / 2);
    const blurMesh = new THREE.Mesh(geo);

    const depthMat = new THREE.MeshDepthMaterial();
    depthMat.depthTest = depthMat.depthWrite = false;
    depthMat.onBeforeCompile = (shader) => {
      shader.uniforms = {
        ...shader.uniforms,
        ucolor: { value: new THREE.Color(color) },
      };
      shader.fragmentShader = shader.fragmentShader.replace(
        `void main() {`,
        `uniform vec3 ucolor;
           void main() {`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );'
      );
    };

    // Import blur shaders dynamically
    const hBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        h: { value: 1.0 / 256.0 },
      },
      vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
      fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float h;
          varying vec2 vUv;
          void main() {
            vec4 sum = vec4(0.0);
            sum += texture2D(tDiffuse, vec2(vUv.x - 4.0 * h, vUv.y)) * 0.051;
            sum += texture2D(tDiffuse, vec2(vUv.x - 3.0 * h, vUv.y)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x - 2.0 * h, vUv.y)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x - 1.0 * h, vUv.y)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.1633;
            sum += texture2D(tDiffuse, vec2(vUv.x + 1.0 * h, vUv.y)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x + 2.0 * h, vUv.y)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x + 3.0 * h, vUv.y)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x + 4.0 * h, vUv.y)) * 0.051;
            gl_FragColor = sum;
          }
        `,
    });

    const vBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        v: { value: 1.0 / 256.0 },
      },
      vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
      fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float v;
          varying vec2 vUv;
          void main() {
            vec4 sum = vec4(0.0);
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0 * v)) * 0.051;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * v)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * v)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * v)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.1633;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * v)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * v)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * v)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0 * v)) * 0.051;
            gl_FragColor = sum;
          }
        `,
    });

    vBlurMat.depthTest = hBlurMat.depthTest = false;

    return [rt, rtBlur, geo, depthMat, blurMesh, hBlurMat, vBlurMat];
  }, [resolution, scaledWidth, scaledHeight, color]);

  // Blur helper function
  const blurShadows = useCallback(
    (blurAmount: number) => {
      if (!shadowCameraRef.current) return;

      blurPlane.visible = true;
      blurPlane.material = horizontalBlurMaterial;
      horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
      horizontalBlurMaterial.uniforms.h.value = (blurAmount * 1) / 256;
      gl.setRenderTarget(renderTargetBlur);
      gl.render(blurPlane, shadowCameraRef.current);

      blurPlane.material = verticalBlurMaterial;
      verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
      verticalBlurMaterial.uniforms.v.value = (blurAmount * 1) / 256;
      gl.setRenderTarget(renderTarget);
      gl.render(blurPlane, shadowCameraRef.current);

      blurPlane.visible = false;
    },
    [gl, renderTarget, renderTargetBlur, blurPlane, horizontalBlurMaterial, verticalBlurMaterial]
  );

  // Render shadows each frame
  useFrame(() => {
    if (!shadowCameraRef.current || !ref.current) return;

    const initialBackground = scene.background;
    const initialOverrideMaterial = scene.overrideMaterial;

    ref.current.visible = false;
    scene.background = null;
    scene.overrideMaterial = depthMaterial;

    // THE FIX: Explicitly clear the render target before rendering
    // This prevents shadow trail accumulation regardless of EffectComposer settings
    gl.setRenderTarget(renderTarget);
    gl.clear(true, true, false); // Clear color and depth, not stencil

    gl.render(scene, shadowCameraRef.current);

    blurShadows(blur);
    if (smooth) blurShadows(blur * 0.4);

    gl.setRenderTarget(null);
    ref.current.visible = true;
    scene.overrideMaterial = initialOverrideMaterial;
    scene.background = initialBackground;
  });

  // Cleanup
  useEffect(() => {
    return () => {
      renderTarget.dispose();
      renderTargetBlur.dispose();
      planeGeometry.dispose();
      depthMaterial.dispose();
      horizontalBlurMaterial.dispose();
      verticalBlurMaterial.dispose();
    };
  }, [
    renderTarget,
    renderTargetBlur,
    planeGeometry,
    depthMaterial,
    horizontalBlurMaterial,
    verticalBlurMaterial,
  ]);

  return (
    // eslint-disable-next-line react/no-unknown-property
    <group rotation-x={Math.PI / 2} position={[0, -0.01, 0]} ref={ref}>
      {/* eslint-disable react/no-unknown-property */}
      <mesh geometry={planeGeometry} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          transparent
          map={renderTarget.texture}
          opacity={opacity}
          depthWrite={depthWrite}
        />
      </mesh>
      {/* eslint-enable react/no-unknown-property */}
      <orthographicCamera
        ref={shadowCameraRef}
        args={[-scaledWidth / 2, scaledWidth / 2, scaledHeight / 2, -scaledHeight / 2, 0, far]}
      />
    </group>
  );
};

// ============================================================================
// Shadow System Debugger
// ============================================================================

/**
 * ContactShadowDebugger - Monitors for shadow trail issues
 * Logs when render target is being cleared and tracks frame consistency
 */
const ContactShadowDebugger: React.FC = () => {
  const { gl } = useThree();
  const frameCountRef = useRef(0);
  const lastAutoClearRef = useRef<boolean | null>(null);

  useFrame(() => {
    frameCountRef.current++;

    // Log whenever autoClear state changes (this helps detect when EffectComposer modifies it)
    if (lastAutoClearRef.current !== gl.autoClear) {
      console.log('[ContactShadowDebugger] autoClear changed:', {
        previous: lastAutoClearRef.current,
        current: gl.autoClear,
        frame: frameCountRef.current,
      });
      lastAutoClearRef.current = gl.autoClear;
    }

    // Periodic status log every 600 frames (~10 seconds at 60fps)
    if (frameCountRef.current % 600 === 0) {
      console.log('[ContactShadowDebugger] Status:', {
        autoClear: gl.autoClear,
        autoClearColor: gl.autoClearColor,
        autoClearDepth: gl.autoClearDepth,
        frame: frameCountRef.current,
      });
    }
  });

  return null;
};

// ============================================================================
// Constants
// ============================================================================

/** Minimum distance in pixels before considering it a drag vs a click */
const DRAG_THRESHOLD_PIXELS = 5;

/** Conversion factor from scene units to Three.js world units */
const SCENE_TO_WORLD_SCALE = 100;

/** Clamps a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Note: Focus mode determination is now handled entirely in EditorPage.tsx
// The 'soft' focus mode adaptively handles all cases (too close, too far, comfort zone)
// MainCanvas just always triggers 'soft' focus on selection

// ============================================================================
// Selection-Before-Drag Logic
// ============================================================================

/**
 * Determines whether dragging is allowed for a pointer interaction.
 *
 * FEATURE: "Selection Before Drag"
 * Objects must be selected before they can be dragged. This prevents accidental
 * object movement when users try to rotate the camera around objects.
 *
 * When canDrag is false:
 * - Camera controls remain enabled (user can rotate/pan)
 * - Click-to-select still works (object is selected on pointer up if no drag)
 * - Object position is NOT updated during the gesture
 *
 * @param selectedParentId - ID of the currently selected parent object (null if none)
 * @param selectedChildPath - Path of the currently selected child (null if parent or none)
 * @param clickedObjectId - ID of the object being clicked
 * @param dragChildPath - Path of the child that would be dragged (null for parent drag)
 * @returns true if dragging should be allowed, false for selection-only interaction
 */
function calculateCanDrag(
  selectedParentId: string | null,
  selectedChildPath: string | null,
  clickedObjectId: string,
  dragChildPath?: string | null
): boolean {
  const isParentSelected = selectedParentId === clickedObjectId;

  if (dragChildPath) {
    // Dragging a specific child: only allowed if that exact child is selected
    return isParentSelected && selectedChildPath === dragChildPath;
  } else {
    // Dragging the parent: only allowed if parent is selected AND no child is selected
    return isParentSelected && selectedChildPath === null;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Drag state for tracking object translation during drag operations.
 *
 * The drag system uses the click point's Y coordinate as the drag plane height,
 * ensuring consistent coordinate projection between the initial click and
 * subsequent drag movements. This prevents the "jump" issue that occurs when
 * clicking on elevated surfaces of 3D models.
 */
interface DragState {
  /** ID of the object being dragged */
  objectId: string;
  /** Reference to the scene object being dragged */
  object: SceneObject;
  /** Path of the child being dragged (if any) - format: "path.to.child" */
  childPath?: string | null;
  /**
   * Path of a child that was clicked but should only be selected if interaction is a click (not drag).
   * Used for two-tier selection: when parent is selected, clicking on a child should select it only
   * if it's a discrete click, not a drag (drag should move the parent instead).
   */
  pendingChildPath?: string | null;
  /** Y-coordinate of the drag plane (set to click point Y for consistent projection) */
  groundPlaneY: number;
  /** Object's starting X position in scene units (before drag began) - for parent OR child's local X */
  initialObjectX: number;
  /** Object's starting Z position in scene units (before drag began) - for parent OR child's local Z */
  initialObjectZ: number;
  /** X-coordinate where user grabbed on the drag plane (world units) */
  initialGrabX: number;
  /** Z-coordinate where user grabbed on the drag plane (world units) */
  initialGrabZ: number;
  /** Whether mouse moved beyond drag threshold (distinguishes click vs drag) */
  hasMoved: boolean;
  /** Initial mouse screen position for threshold calculation */
  startPosition: { x: number; y: number };
  /**
   * Effective world scale of the child mesh (for child dragging only).
   * This accounts for ALL transforms: parent scale, model preprocessing scale, etc.
   * Used to convert world-space drag delta to local-space position change.
   */
  childWorldScaleX?: number;
  childWorldScaleZ?: number;
  /**
   * Whether dragging is allowed for this interaction.
   * When false, the interaction is selection-only (object must be selected first before dragging).
   * This prevents accidental drags when navigating/rotating the camera around objects.
   */
  canDrag: boolean;
}

interface SceneContentProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  recordingPositionForStepId?: string | null;
  steps?: SimStep[];
  previewMode?: boolean;
  previewStep?: SimStep | null;
  onPreviewObjectClick?: (objectId: string) => void;
  onPreviewPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
  onPreviewStepComplete?: () => void;
  shouldAnimateMoveItem?: boolean;
}

// Shared geometry instances - created once and reused across all primitives
const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

interface IndustrialPrimitiveProps {
  obj: SceneObject;
  isSelected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, obj: SceneObject) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isGhost?: boolean;
}

const IndustrialPrimitiveInner: React.FC<IndustrialPrimitiveProps> = ({
  obj,
  isSelected: _isSelected,
  onPointerDown,
  onDoubleClick,
  isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const color = obj.properties.color || '#3b82f6';

  // Memoize position array to prevent unnecessary re-renders
  const position = useMemo<[number, number, number]>(
    () => [obj.transform.x / 100, obj.transform.y / 100, -obj.transform.z / 100],
    [obj.transform.x, obj.transform.y, obj.transform.z]
  );

  // Memoize rotation array
  const rotation = useMemo<[number, number, number]>(
    () => [
      THREE.MathUtils.degToRad(obj.transform.rotationX),
      THREE.MathUtils.degToRad(obj.transform.rotationY),
      THREE.MathUtils.degToRad(obj.transform.rotationZ),
    ],
    [obj.transform.rotationX, obj.transform.rotationY, obj.transform.rotationZ]
  );

  // Memoize scale array
  const scale = useMemo<[number, number, number]>(
    () => [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ],
    [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]
  );

  // Memoize event handlers
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onPointerDown(e, obj);
    },
    [onPointerDown, obj]
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onDoubleClick(obj);
    },
    [onDoubleClick, obj]
  );

  const handlePointerEnter = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverStart();
    },
    [onHoverStart]
  );

  const handlePointerLeave = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverEnd();
    },
    [onHoverEnd]
  );

  // Calculate emissive properties - increased intensity for clearer pre-selection feedback
  const emissiveColor = isHovered && !isDragging ? '#ffffff' : '#000000';
  const emissiveIntensity = isHovered && !isDragging ? 0.18 : 0;

  // Set userData.objectId on group for scene traversal (used by TransformGizmo)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData.objectId = obj.id;
    }
  }, [obj.id]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh geometry={sharedBoxGeometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.1}
          // eslint-disable-next-line react/no-unknown-property
          emissive={emissiveColor}
          // eslint-disable-next-line react/no-unknown-property
          emissiveIntensity={emissiveIntensity}
          transparent={isGhost}
          opacity={isGhost ? 0.45 : 1.0}
        />
      </mesh>
    </group>
  );
};

// Memoized component with custom comparison for optimal re-rendering
const IndustrialPrimitive = memo(IndustrialPrimitiveInner, (prevProps, nextProps) => {
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
    prevProps.obj.properties.color === nextProps.obj.properties.color &&
    prevProps.obj.properties.visible === nextProps.obj.properties.visible &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered
  );
});

// Cursor manager component - updates document cursor based on hover/drag state
const CursorManager: React.FC<{
  isHovering: boolean;
  isDragging: boolean;
}> = ({ isHovering, isDragging }) => {
  const { gl } = useThree();

  useEffect(() => {
    if (isDragging) {
      gl.domElement.style.cursor = 'grabbing';
    } else if (isHovering) {
      gl.domElement.style.cursor = 'grab';
    } else {
      gl.domElement.style.cursor = 'crosshair';
    }

    return () => {
      gl.domElement.style.cursor = 'crosshair';
    };
  }, [isHovering, isDragging, gl]);

  return null;
};

/**
 * DragHandler - Manages pointer events for object translation in the 3D scene.
 *
 * This component handles the drag-to-move interaction for scene objects:
 * 1. Raycasts from mouse position to a horizontal plane at the grab point height
 * 2. Calculates movement delta from initial grab position
 * 3. Updates object position while maintaining the grab point under cursor
 *
 * Key features:
 * - Uses capture phase event listeners to intercept before camera controls
 * - Implements drag threshold to distinguish clicks from drags
 * - Pre-allocates Three.js objects to avoid GC pressure
 */
const DragHandler: React.FC<{
  dragState: DragState | null;
  hasMovedRef: React.MutableRefObject<boolean>;
  onUpdateObject: (obj: SceneObject) => void;
  onDragEnd: (wasDrag: boolean) => void;
  onMarkAsDrag: () => void;
}> = ({ dragState, hasMovedRef, onUpdateObject, onDragEnd, onMarkAsDrag }) => {
  const { camera, gl } = useThree();
  // Pre-allocate Three.js objects to avoid GC pressure in hot loops
  const raycaster = useRef(new THREE.Raycaster());
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersection = useRef(new THREE.Vector3());
  const mouseCoords = useRef(new THREE.Vector2()); // Reusable Vector2 for mouse coordinates

  useEffect(() => {
    if (!dragState) return;

    // Update ground plane to object's Y position
    groundPlane.current.constant = -dragState.groundPlaneY;

    const handlePointerMove = (event: PointerEvent) => {
      // Safety check: if the primary button is no longer pressed, end the drag
      // This catches cases where the pointer up event was missed due to React re-render timing
      if ((event.buttons & 1) === 0) {
        // Primary button (left click) is not pressed - end drag immediately
        onDragEnd(hasMovedRef.current);
        return;
      }

      // Check if we've moved beyond the drag threshold
      const dx = event.clientX - dragState.startPosition.x;
      const dy = event.clientY - dragState.startPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If canDrag is false (clicking on unselected object), let camera controls handle
      // the gesture. We still track for click vs drag detection, but don't block events.
      if (!dragState.canDrag) {
        // Still mark as drag once threshold is crossed (for click vs drag distinction)
        if (distance >= DRAG_THRESHOLD_PIXELS && !dragState.hasMoved && !hasMovedRef.current) {
          onMarkAsDrag();
        }
        // Don't block - let camera controls rotate
        return;
      }

      // Block events while dragging an object. This prevents accidental camera movement
      // from small hand jitter on click/drag.
      event.stopPropagation();
      event.preventDefault();

      // Only start actual dragging if we've moved beyond threshold
      if (distance < DRAG_THRESHOLD_PIXELS) return;

      // Mark as a real drag (not just a click)
      // Check BOTH dragState.hasMoved AND hasMovedRef to prevent multiple calls
      // during rapid pointer events before React re-renders
      if (!dragState.hasMoved && !hasMovedRef.current) {
        onMarkAsDrag();
      }

      // Ground plane movement (XZ-axis)
      // Convert mouse position to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Reuse the Vector2 instead of creating a new one each frame
      mouseCoords.current.set(x, y);
      raycaster.current.setFromCamera(mouseCoords.current, camera);

      if (raycaster.current.ray.intersectPlane(groundPlane.current, intersection.current)) {
        // Calculate how far the grab point has moved on the drag plane
        const deltaX = intersection.current.x - dragState.initialGrabX;
        const deltaZ = intersection.current.z - dragState.initialGrabZ;

        // Check if we're dragging a child
        if (dragState.childPath && dragState.object.children) {
          // Use the effective world scale calculated at drag start.
          // This accounts for ALL transforms: parent's obj.transform.scale, model preprocessing scale, etc.
          // We divide the world delta by this scale to convert from world movement to local movement.
          const effectiveScaleX = dragState.childWorldScaleX || 1;
          const effectiveScaleZ = dragState.childWorldScaleZ || 1;

          // Divide world delta by effective world scale to get correct local movement
          // This ensures child moves 1:1 with cursor, just like root objects
          const childNewX =
            dragState.initialObjectX + (deltaX / effectiveScaleX) * SCENE_TO_WORLD_SCALE;
          const childNewZ =
            dragState.initialObjectZ - (deltaZ / effectiveScaleZ) * SCENE_TO_WORLD_SCALE;

          // Update child's localTransform in the parent object's children array
          const updatedChildren = dragState.object.children.map((child) => {
            const childPathStr = pathToString(child.path);
            if (childPathStr === dragState.childPath) {
              return {
                ...child,
                localTransform: {
                  ...child.localTransform,
                  x: childNewX,
                  z: childNewZ,
                },
              };
            }
            return child;
          });

          const updatedObject: SceneObject = {
            ...dragState.object,
            children: updatedChildren,
          };
          onUpdateObject(updatedObject);
        } else {
          // Update parent object's transform
          // Apply delta to initial position (convert from world to scene units)
          // Note: Z is negated because Three.js Z is opposite to scene transform Z
          // Clamp to grid boundary
          const rawX = dragState.initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
          const rawZ = dragState.initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;
          const newX = clamp(rawX, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
          const newZ = clamp(rawZ, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);

          const updatedObject: SceneObject = {
            ...dragState.object,
            transform: {
              ...dragState.object.transform,
              x: newX,
              z: newZ,
            },
          };
          onUpdateObject(updatedObject);
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      // Only block pointer up if we were actually dragging (canDrag=true and there was movement).
      // When canDrag=false, we let camera controls finish their gesture normally.
      if (dragState.canDrag && hasMovedRef.current) {
        // Prevent the pointer up event from reaching camera controls
        // This is critical to avoid unwanted camera movement after dragging
        event.stopPropagation();
        event.preventDefault();
      }

      // Use hasMovedRef instead of dragState.hasMoved to avoid stale closure issues
      // The ref is updated synchronously, so it always has the current value
      onDragEnd(hasMovedRef.current);
    };

    // Add listeners to window to capture events outside canvas
    // Use capture phase to intercept events before they reach camera controls
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
    };
    // hasMovedRef is a ref and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, camera, gl, onUpdateObject, onDragEnd, onMarkAsDrag]);

  return null;
};

// Navigation keys that trigger continuous movement
const NAVIGATION_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'q',
  'e',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
]);

// Keyboard navigation component - handles WASD, arrow keys, Q/E, F, Home
const KeyboardNavigator: React.FC<{
  controlsRef: React.RefObject<CameraControlsImpl>;
  selectedObject: SceneObject | null;
  selectedChildPath: string | null;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
}> = ({ controlsRef, selectedObject, selectedChildPath, onFocusObject }) => {
  const keysPressed = useRef<Set<string>>(new Set());
  const { gl, invalidate } = useThree();

  // Pan and rotation speeds
  const PAN_SPEED = 0.08;
  const ROTATE_SPEED = 0.02;

  // Handle keydown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      keysPressed.current.add(key);

      // Focus on selected object (F key) - delegates to onFocusObject for unified focus behavior
      // Passes childPath if a child is selected, enabling focus on child mesh bounds
      if (key === 'f' && selectedObject && onFocusObject) {
        onFocusObject(selectedObject, selectedChildPath ?? undefined);
        e.preventDefault();
      }

      // Reset view (Home or 0 key)
      if ((key === 'home' || key === '0') && controlsRef.current) {
        controlsRef.current.setLookAt(...DEFAULT_CAMERA_POSITION, ...DEFAULT_CAMERA_TARGET, true);
        invalidate(); // Trigger re-render for smooth animation
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Capture ref value for cleanup to satisfy exhaustive-deps rule
    const keysPressedRef = keysPressed.current;

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keysPressedRef.clear(); // Clean up on unmount
    };
  }, [gl, selectedObject, selectedChildPath, controlsRef, invalidate, onFocusObject]);

  // Continuous movement in useFrame for smooth WASD/arrow key navigation
  useFrame(() => {
    if (!controlsRef.current) return;

    const keys = keysPressed.current;

    // Early return if no navigation keys are pressed - saves CPU cycles
    if (keys.size === 0) return;

    // Check if any navigation keys are actually pressed
    let hasNavigationKey = false;
    for (const key of keys) {
      if (NAVIGATION_KEYS.has(key)) {
        hasNavigationKey = true;
        break;
      }
    }
    if (!hasNavigationKey) return;

    const controls = controlsRef.current;

    // Forward/Backward (W/S or Up/Down arrows) - truck forward/back
    if (keys.has('w') || keys.has('arrowup')) {
      controls.forward(PAN_SPEED, false);
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      controls.forward(-PAN_SPEED, false);
    }

    // Left/Right (A/D or Left/Right arrows) - truck left/right
    if (keys.has('a') || keys.has('arrowleft')) {
      controls.truck(-PAN_SPEED, 0, false);
    }
    if (keys.has('d') || keys.has('arrowright')) {
      controls.truck(PAN_SPEED, 0, false);
    }

    // Rotate (Q/E) - azimuth rotation
    if (keys.has('q')) {
      controls.rotate(-ROTATE_SPEED, 0, false);
    }
    if (keys.has('e')) {
      controls.rotate(ROTATE_SPEED, 0, false);
    }
  });

  return null;
};

const SceneContent: React.FC<SceneContentProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  previewMode = false,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewPositionUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
}) => {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const isPositioningCameraRef = useRef(false); // Track when camera is being positioned in preview

  // Parse the selection ID to separate parent and child selection
  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);
  const selectedParentId = parsedSelection?.objectId ?? null;
  const selectedChildPath = parsedSelection?.childPath ?? null;

  const selectedObject = objects.find((obj) => obj.id === selectedParentId) || null;

  // Drag state management
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [isRecentlyDragged, setIsRecentlyDragged] = useState(false);

  // Ref to track hasMoved synchronously (avoids stale closure issues in event handlers)
  const hasMovedRef = useRef(false);

  // Keep hasMovedRef in sync with dragState (for cases where state drives re-renders)
  useEffect(() => {
    hasMovedRef.current = dragState?.hasMoved ?? false;
  }, [dragState?.hasMoved]);

  // Ref to store the drag state for use in global pointer up listener
  // This avoids stale closure issues since the effect can capture the ref
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // CRITICAL: Global safety listener for pointer up events
  // This catches pointer up events that might be missed due to React re-render timing
  // when switching between child selections. This runs ALWAYS, not just when dragState exists.
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      // Only act if we have drag state
      if (dragStateRef.current) {
        // Clear the drag state - the child was already selected in handleChildPointerDown
        // so we just need to clean up
        setDragState(null);
      }
    };

    // Listen on window WITHOUT capture phase - this runs AFTER DragHandler's listener
    // If DragHandler handled it, dragState will already be null
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []); // Empty deps - this listener is always active

  // Track if we've already notified parent
  const hasNotifiedRef = useRef(false);

  // Poll each frame until controls are ready - guarantees we capture them
  // This is necessary because refs don't trigger re-renders, so useEffect can't detect when populated
  useFrame(() => {
    if (controlsRef.current && onCameraControlsReady && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      onCameraControlsReady(controlsRef.current);
    }
  });

  // Find recording step and target object
  const recordingStep = useMemo(() => {
    if (!recordingPositionForStepId) return null;
    return steps.find((s) => s.id === recordingPositionForStepId) || null;
  }, [recordingPositionForStepId, steps]);

  const targetObjectId = recordingStep?.targetObjectId;
  const targetObject = useMemo(() => {
    if (!targetObjectId) return null;
    return objects.find((obj) => obj.id === targetObjectId) || null;
  }, [targetObjectId, objects]);

  // Get ghost object position (uses endPosition from step) and actual object position (start position)
  const ghostObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;
    // Ghost uses endPosition from step if available, otherwise uses startPosition
    const startPos = recordingStep.startPosition || {
      x: targetObject.transform.x,
      y: targetObject.transform.y,
      z: targetObject.transform.z,
    };
    const ghostPos = recordingStep.endPosition || startPos;
    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        x: ghostPos.x,
        y: ghostPos.y,
        z: ghostPos.z,
      },
    };
  }, [targetObject, recordingStep]);

  const actualObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;
    // Actual object uses start position (locked in place), or current position if no startPosition saved
    const startPos = recordingStep.startPosition || {
      x: targetObject.transform.x,
      y: targetObject.transform.y,
      z: targetObject.transform.z,
    };
    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        x: startPos.x,
        y: startPos.y,
        z: startPos.z,
      },
    };
  }, [targetObject, recordingStep]);

  // Handle pointer down on object - start potential drag
  // pendingChildPath is used for two-tier selection: when parent is already selected
  // and user clicks on a child, we store the child path but only select it if it's a click (not a drag)
  const handleObjectPointerDown = useCallback(
    (
      e: ThreeEvent<PointerEvent>,
      obj: SceneObject,
      pendingChildPath?: string | null,
      dragChildPath?: string | null
    ) => {
      // Only handle left mouse button
      if (e.nativeEvent.button !== 0) return;

      // In preview mode, handle object clicks differently
      if (previewMode && onPreviewObjectClick) {
        e.stopPropagation();
        e.nativeEvent.stopPropagation();
        onPreviewObjectClick(obj.id);
        return;
      }

      // During recording, only allow dragging the ghost object (target object)
      if (recordingPositionForStepId) {
        if (obj.id !== targetObjectId) {
          // Disable dragging for non-target objects during recording
          return;
        }
      }

      // Determine if dragging is allowed using the "selection before drag" rule
      const canDrag = calculateCanDrag(selectedParentId, selectedChildPath, obj.id, dragChildPath);

      // Stop pointer events from reaching CameraControls ONLY when we're going to drag.
      // When canDrag=false (clicking on unselected object), let camera controls handle
      // the event so the user can rotate around. We'll still track for click-to-select.
      if (canDrag) {
        // R3F's `e.stopPropagation()` prevents other R3F handlers, but the camera
        // controls also listen at the DOM level.
        e.stopPropagation();
        e.nativeEvent.stopPropagation();
        // `stopImmediatePropagation` is not available on all Event types; guard it.
        (
          e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }
        ).stopImmediatePropagation?.();
      }

      const clickPoint = e.point;

      // Use click point Y for the drag plane - this ensures consistent projection
      // between the initial click and subsequent drag movements
      const groundPlaneY = clickPoint.y;

      // Reset hasMovedRef synchronously before setting drag state
      hasMovedRef.current = false;

      // If dragChildPath is provided, set up drag for that child instead of root
      if (dragChildPath) {
        const child = obj.children?.find((c) => pathToString(c.path) === dragChildPath);
        if (child) {
          // Extract effective world scale from clicked mesh for child dragging
          const clickedMesh = e.object;
          clickedMesh.updateMatrixWorld(true);
          const worldMatrix = clickedMesh.matrixWorld;
          const elements = worldMatrix.elements;
          const childWorldScaleX = Math.sqrt(
            elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]
          );
          const childWorldScaleZ = Math.sqrt(
            elements[8] * elements[8] + elements[9] * elements[9] + elements[10] * elements[10]
          );

          setDragState({
            objectId: obj.id,
            object: obj,
            childPath: dragChildPath, // Set childPath for dragging
            pendingChildPath: pendingChildPath ?? null, // Keep pending for selection on click
            groundPlaneY,
            initialObjectX: child.localTransform.x,
            initialObjectZ: child.localTransform.z,
            initialGrabX: clickPoint.x,
            initialGrabZ: clickPoint.z,
            hasMoved: false,
            startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            childWorldScaleX,
            childWorldScaleZ,
            canDrag,
          });
          return;
        }
      }

      // Default: set up drag for root object
      setDragState({
        objectId: obj.id,
        object: obj,
        pendingChildPath: pendingChildPath ?? null,
        groundPlaneY,
        initialObjectX: obj.transform.x,
        initialObjectZ: obj.transform.z,
        initialGrabX: clickPoint.x,
        initialGrabZ: clickPoint.z,
        hasMoved: false,
        startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        canDrag,
      });
    },
    [
      recordingPositionForStepId,
      targetObjectId,
      previewMode,
      onPreviewObjectClick,
      selectedParentId,
      selectedChildPath,
    ]
  );

  // Handle pointer down on a child mesh - selects the child and sets up drag state
  const handleChildPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>, obj: SceneObject, childPath: string) => {
      // Only handle left mouse button
      if (e.nativeEvent.button !== 0) return;

      // Stop propagation to prevent camera controls from responding
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      (
        e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }
      ).stopImmediatePropagation?.();

      // Find the child's current local transform
      const child = obj.children?.find((c) => pathToString(c.path) === childPath);
      if (!child) return;

      const clickPoint = e.point;
      const groundPlaneY = clickPoint.y;

      // Get child's current local position (in scene units)
      const initialChildX = child.localTransform.x;
      const initialChildZ = child.localTransform.z;

      // Extract effective world scale from the clicked mesh's world matrix.
      // This accounts for ALL transforms: parent's obj.transform.scale, model preprocessing scale, etc.
      // The world matrix contains position, rotation, and scale. We extract scale by measuring
      // the length of the basis vectors (columns of the upper 3x3 rotation/scale matrix).
      const clickedMesh = e.object;
      clickedMesh.updateMatrixWorld(true); // Ensure matrix is up-to-date
      const worldMatrix = clickedMesh.matrixWorld;

      // Extract scale from world matrix by getting the length of basis vectors
      // X basis vector is elements [0,1,2], Z basis vector is elements [8,9,10]
      const elements = worldMatrix.elements;
      const childWorldScaleX = Math.sqrt(
        elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]
      );
      const childWorldScaleZ = Math.sqrt(
        elements[8] * elements[8] + elements[9] * elements[9] + elements[10] * elements[10]
      );

      // Reset hasMovedRef synchronously before setting drag state
      hasMovedRef.current = false;

      // Set up drag state for the child
      // canDrag is true because this handler is only called when clicking on an already-selected child
      setDragState({
        objectId: obj.id,
        object: obj,
        childPath: childPath,
        groundPlaneY,
        initialObjectX: initialChildX,
        initialObjectZ: initialChildZ,
        initialGrabX: clickPoint.x,
        initialGrabZ: clickPoint.z,
        hasMoved: false,
        startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        childWorldScaleX,
        childWorldScaleZ,
        canDrag: true,
      });

      // Select the child
      const childSelectionId = createChildSelectionId(obj.id, childPath);
      onSelectObject(childSelectionId);

      // Adaptive soft focus: handles too close, too far, and comfort zone automatically
      onFocusObject?.(obj, childPath, 'soft');
    },
    [onSelectObject, onFocusObject]
  );

  // Handle drag end - select object if it was just a click
  // Also triggers smart auto-focus when selecting an object (only if camera is far from ideal)
  const handleDragEnd = useCallback(
    (wasDrag: boolean) => {
      if (dragState && !wasDrag) {
        // It was a click, not a drag
        // Check if there's a pending child path (two-tier selection from parent)
        if (dragState.pendingChildPath) {
          // Select the child that was clicked (drilling down from parent selection)
          const childSelectionId = createChildSelectionId(
            dragState.objectId,
            dragState.pendingChildPath
          );
          onSelectObject(childSelectionId);

          // Adaptive soft focus: handles too close, too far, and comfort zone automatically
          onFocusObject?.(dragState.object, dragState.pendingChildPath, 'soft');
        } else if (dragState.childPath) {
          // Already selecting a child directly (sibling navigation or child re-click)
          // The child was already selected in handleChildPointerDown, so just keep it
          // Don't re-select - this prevents accidentally selecting the parent on click release
        } else {
          // No pending child and no current child, select the parent object
          onSelectObject(dragState.objectId);

          // Adaptive soft focus: handles too close, too far, and comfort zone automatically
          // For re-selection of same object, soft focus will naturally do minimal adjustment
          onFocusObject?.(dragState.object, undefined, 'soft');
        }
      }

      // Notify parent that drag ended (for undo/redo batching)
      if (wasDrag && onDragEnd) {
        onDragEnd();
      }

      setDragState(null);

      // If this was an actual drag, prevent camera controls from responding
      // to the pointer up event by keeping them disabled briefly
      if (wasDrag) {
        setIsRecentlyDragged(true);
        // Re-enable camera controls after a short delay to ensure
        // the pointer up event doesn't affect the camera
        setTimeout(() => {
          setIsRecentlyDragged(false);
        }, 50); // 50ms is enough to skip the pointer up frame
      }
    },
    [dragState, onSelectObject, onDragEnd, onFocusObject]
  );

  // Mark the current interaction as a drag (mouse moved beyond threshold)
  const handleMarkAsDrag = useCallback(() => {
    // CRITICAL: Only proceed if this is the FIRST time marking as drag
    // Check BOTH ref and state to handle rapid events before React re-renders
    if (hasMovedRef.current || dragState?.hasMoved) {
      return;
    }

    // Set ref SYNCHRONOUSLY before state update to avoid stale closure issues
    // This ensures handlePointerUp always sees the correct value via hasMovedRef
    hasMovedRef.current = true;

    // If canDrag is false, this is a selection-only interaction (object wasn't selected before).
    // We still track hasMoved for click vs drag distinction, but don't start an actual drag.
    // This allows camera rotation while preventing accidental object movement.
    if (dragState && !dragState.canDrag) {
      // Update state to mark as moved (for click vs drag distinction)
      setDragState((prev) => {
        if (prev && !prev.hasMoved) {
          return { ...prev, hasMoved: true };
        }
        return prev;
      });
      return;
    }

    // Dragging an object = working with that object = select it
    // This ensures consistent UX: any direct manipulation selects the target
    if (dragState) {
      const targetSelectionId = dragState.childPath
        ? createChildSelectionId(dragState.objectId, dragState.childPath)
        : dragState.objectId;

      // Only update selection if it's different from current
      if (targetSelectionId !== selectedObjectId) {
        onSelectObject(targetSelectionId);
      }
    }

    // Call onDragStart SYNCHRONOUSLY *before* any state updates
    // This prevents race conditions where updateObject commands are sent before batching begins
    if (onDragStart) {
      onDragStart();
    }

    // Now update the state (this happens asynchronously)
    setDragState((prev) => {
      if (prev && !prev.hasMoved) {
        return { ...prev, hasMoved: true };
      }
      return prev;
    });
  }, [onDragStart, dragState, selectedObjectId, onSelectObject]);

  // Double-click handler - intentionally a no-op
  // Double-click focus was removed because it conflicts with multi-click child selection
  // Use F key or click in Scene Objects panel to focus instead
  const handleDoubleClick = useCallback((_obj: SceneObject) => {
    // No-op: double-click to focus is disabled
  }, []);

  // Update drag state when object is updated (keep reference fresh)
  // BUT: Only update if we're NOT currently dragging (hasMoved is false means we haven't started dragging yet)
  // During an active drag, we don't want to update dragState.object as it can cause extra updates
  useEffect(() => {
    if (dragState && !dragState.hasMoved) {
      // Only sync object reference before drag starts (when it's still just a click)
      const updatedObj = objects.find((o) => o.id === dragState.objectId);
      if (updatedObj && updatedObj !== dragState.object) {
        setDragState((prev) => (prev ? { ...prev, object: updatedObj } : null));
      }
    }
  }, [objects, dragState]);

  return (
    <>
      {/* Contact shadow debugger - monitors for trail issues in dev mode */}
      {IS_DEV && <ContactShadowDebugger />}

      {/* Enhanced lighting for better model visibility */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 15, 10]} intensity={1.8} />
      <directionalLight position={[-10, 10, -5]} intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={2.0} />
      <pointLight position={[-10, 8, -10]} intensity={1.5} />
      <spotLight position={[0, 20, 0]} angle={0.6} penumbra={0.5} intensity={2.5} />

      {/* Preview Move Item Step - renders outline and handles animation */}
      {previewMode && previewStep?.type === 'move-item' && (
        <PreviewMoveItemStepRenderer
          step={previewStep}
          objects={objects}
          cameraControlsRef={controlsRef}
          isPositioningCameraRef={isPositioningCameraRef}
          shouldAnimate={shouldAnimateMoveItem}
          onPositionUpdate={onPreviewPositionUpdate}
          onComplete={onPreviewStepComplete}
        />
      )}

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={35} />

      {/* FixedContactShadows - Custom implementation that explicitly clears render target
          to prevent shadow trail accumulation (independent of EffectComposer settings)
          Scale is matched to GROUND_PLANE_EXTENT for perfect grid alignment
          
          Shadow settings tuned for:
          - Darker, tighter shadow when objects touch ground
          - Shadow dissipates as objects lift off (controlled by 'far')
          - Minimal scattering for clean, focused shadows */}
      <FixedContactShadows
        opacity={0.18}
        scale={GROUND_PLANE_EXTENT * 2}
        blur={1.2}
        far={1.5}
        resolution={1024}
        smooth={true}
        color="#1e293b"
      />

      {/* Fixed-size grid visible from both above and below.
          Grid size matches movement constraint boundary exactly.
          Using args=[width, height] creates a fixed world-space grid.
          
          GridWithNoDepth disables depthWrite to prevent the grid from 
          interfering with the Outline effect's depth comparison. */}
      <GridWithNoDepth
        args={[GROUND_PLANE_EXTENT * 2, GROUND_PLANE_EXTENT * 2]}
        cellSize={1}
        sectionSize={5}
        fadeDistance={GROUND_PLANE_EXTENT}
        fadeStrength={GRID_FADE_STRENGTH}
        sectionColor="#94a3b8"
        cellColor="#cbd5e1"
        sectionThickness={0.8}
        cellThickness={0.4}
        side={THREE.DoubleSide}
      />

      {/* ChildSelectionProvider wraps everything for child outline support */}
      <ChildSelectionProvider>
        {/* Selection context for parent outlines (blue) */}
        <Selection>
          <group>
            {objects.map(
              (obj) =>
                obj.properties.visible &&
                // During recording, don't render the target object normally (we'll render it as actual + ghost)
                !(recordingPositionForStepId && obj.id === targetObjectId) && (
                  <Select
                    key={obj.id}
                    enabled={
                      selectedParentId === obj.id &&
                      // For imported models, only outline parent when no child is selected
                      // (child selection uses emissive highlighting instead)
                      !(obj.properties.modelAssetId && selectedChildPath)
                    }
                  >
                    {obj.properties.modelAssetId ? (
                      <ImportedModel
                        obj={obj}
                        isSelected={selectedParentId === obj.id}
                        selectedChildPath={selectedParentId === obj.id ? selectedChildPath : null}
                        onPointerDown={handleObjectPointerDown}
                        onChildPointerDown={handleChildPointerDown}
                        onDoubleClick={handleDoubleClick}
                        isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                        isHovered={hoveredObjectId === obj.id}
                        onHoverStart={() => setHoveredObjectId(obj.id)}
                        onHoverEnd={() => setHoveredObjectId(null)}
                      />
                    ) : (
                      <IndustrialPrimitive
                        obj={obj}
                        isSelected={selectedParentId === obj.id}
                        onPointerDown={handleObjectPointerDown}
                        onDoubleClick={handleDoubleClick}
                        isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                        isHovered={hoveredObjectId === obj.id}
                        onHoverStart={() => setHoveredObjectId(obj.id)}
                        onHoverEnd={() => setHoveredObjectId(null)}
                      />
                    )}
                  </Select>
                )
            )}
            {/* Render actual object at start position during recording (non-draggable) */}
            {recordingPositionForStepId &&
              actualObject &&
              actualObject.properties.visible &&
              (actualObject.properties.modelAssetId ? (
                <ImportedModel
                  key={`actual-${actualObject.id}`}
                  obj={actualObject}
                  isSelected={false}
                  onPointerDown={() => {}} // Disable interaction
                  onDoubleClick={() => {}}
                  isDragging={false}
                  isHovered={false}
                  onHoverStart={() => {}}
                  onHoverEnd={() => {}}
                />
              ) : (
                <IndustrialPrimitive
                  key={`actual-${actualObject.id}`}
                  obj={actualObject}
                  isSelected={false}
                  onPointerDown={() => {}} // Disable interaction
                  onDoubleClick={() => {}}
                  isDragging={false}
                  isHovered={false}
                  onHoverStart={() => {}}
                  onHoverEnd={() => {}}
                />
              ))}
            {/* Render ghost object during recording (draggable) */}
            {recordingPositionForStepId && ghostObject && ghostObject.properties.visible && (
              <Select key={`ghost-${ghostObject.id}`} enabled={selectedParentId === ghostObject.id}>
                {ghostObject.properties.modelAssetId ? (
                  <ImportedModel
                    obj={ghostObject}
                    isSelected={selectedParentId === ghostObject.id}
                    selectedChildPath={
                      selectedParentId === ghostObject.id ? selectedChildPath : null
                    }
                    onPointerDown={handleObjectPointerDown}
                    onChildPointerDown={handleChildPointerDown}
                    onDoubleClick={handleDoubleClick}
                    isDragging={dragState?.objectId === ghostObject.id && dragState.hasMoved}
                    isHovered={hoveredObjectId === ghostObject.id}
                    onHoverStart={() => setHoveredObjectId(ghostObject.id)}
                    onHoverEnd={() => setHoveredObjectId(null)}
                    isGhost={true}
                  />
                ) : (
                  <IndustrialPrimitive
                    obj={ghostObject}
                    isSelected={selectedParentId === ghostObject.id}
                    onPointerDown={handleObjectPointerDown}
                    onDoubleClick={handleDoubleClick}
                    isDragging={dragState?.objectId === ghostObject.id && dragState.hasMoved}
                    isHovered={hoveredObjectId === ghostObject.id}
                    onHoverStart={() => setHoveredObjectId(ghostObject.id)}
                    onHoverEnd={() => setHoveredObjectId(null)}
                    isGhost={true}
                  />
                )}
              </Select>
            )}
          </group>

          {/* Post-processing outline effect for parent objects (blue) */}
          <SelectionOutlineEffect />
        </Selection>

        {/* Child outline effect (green) - MUST be outside Selection context */}
        <ChildOutlineEffect />
      </ChildSelectionProvider>

      {/* Transform handles for selected object (height) */}
      {selectedObject && !previewMode && !recordingPositionForStepId && (
        <TransformGizmo
          object={selectedObject}
          selectedChildPath={selectedChildPath}
          onUpdateObject={onUpdateObject}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isDragging={dragState?.hasMoved ?? false}
        />
      )}

      {/* Premium CameraControls - tuned for beginners */}
      <CameraControls
        ref={controlsRef}
        makeDefault
        // Disable camera controls while a pointer interaction on an object is in-flight.
        // This prevents camera rotate/pan from competing with object click/drag.
        // Exception: when canDrag=false (clicking unselected object), keep camera enabled
        // so the user can rotate around. Selection will still happen on click (not drag).
        // Allow controls to be enabled in preview mode if camera is being positioned
        enabled={
          (!previewMode && (dragState === null || !dragState.canDrag) && !isRecentlyDragged) ||
          (previewMode && isPositioningCameraRef.current)
        }
        // Smooth damping for premium feel - slower for more comfortable camera movements
        smoothTime={0.6}
        draggingSmoothTime={0.2}
        // Comfortable rotation speed for beginner-friendly navigation
        azimuthRotateSpeed={0.35}
        polarRotateSpeed={0.35}
        // Slower panning
        truckSpeed={1.2}
        // Zoom settings - minDistance reduced to allow close zoom on small child objects
        minDistance={0.5}
        maxDistance={60}
        dollySpeed={0.3}
        dollyToCursor={true}
        // Full rotation freedom - no artificial limits
        // Allows looking straight down, and from below the ground plane
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        // Azimuth (horizontal rotation) - unlimited
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        // Touch settings for trackpad/mobile
        touches={{
          one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
          two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
          three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
        }}
        // Mouse button mappings
        mouseButtons={{
          left: CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.DOLLY,
          right: CameraControlsImpl.ACTION.TRUCK,
          wheel: CameraControlsImpl.ACTION.DOLLY,
        }}
      />

      {/* Drag handler for object translation */}
      <DragHandler
        dragState={dragState}
        hasMovedRef={hasMovedRef}
        onUpdateObject={onUpdateObject}
        onDragEnd={handleDragEnd}
        onMarkAsDrag={handleMarkAsDrag}
      />

      {/* Cursor manager for visual feedback */}
      <CursorManager
        isHovering={hoveredObjectId !== null}
        isDragging={dragState?.hasMoved ?? false}
      />

      {/* Keyboard navigation */}
      <KeyboardNavigator
        controlsRef={controlsRef}
        selectedObject={selectedObject}
        selectedChildPath={selectedChildPath}
        onFocusObject={onFocusObject}
      />
    </>
  );
};

// Performance stats type for the monitor
interface PerformanceStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memory: number;
}

interface MainCanvasProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  /** Callback when the WebGL canvas is ready (for thumbnail capture) */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /** Show performance monitor (defaults to true in development) */
  showPerformanceMonitor?: boolean;
  /** Callback when drag operation starts (for undo/redo batching) */
  onDragStart?: () => void;
  /** Callback when drag operation ends (for undo/redo batching) */
  onDragEnd?: () => void;
  /** Step ID for which position is being recorded */
  recordingPositionForStepId?: string | null;
  /** Steps array for finding recording step */
  steps?: SimStep[];
  /** Enable preview mode (disables camera controls, enables preview interactions) */
  previewMode?: boolean;
  /** Current preview step (used for rendering preview-step UI like move-item) */
  previewStep?: SimStep | null;
  /** Callback when object is clicked in preview mode */
  onPreviewObjectClick?: (objectId: string) => void;
  /** Callback when preview move-item step updates object position (during animation) */
  onPreviewPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
  /** Callback when preview move-item step finishes */
  onPreviewStepComplete?: () => void;
  /** Whether move-item animation should start (triggered after clicking target) */
  shouldAnimateMoveItem?: boolean;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  onCanvasReady,
  showPerformanceMonitor = IS_DEV,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  previewMode = false,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewPositionUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
}) => {
  // Performance monitoring state
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  // Track if we've notified about canvas being ready
  const hasNotifiedCanvasRef = useRef(false);

  // Memoize the stats handler to prevent unnecessary re-renders
  const handlePerfStats = useCallback((stats: PerformanceStats) => {
    setPerfStats(stats);
  }, []);

  // Handle Canvas onCreate to expose the WebGL canvas element
  const handleCreated = useCallback(
    (state: { gl: THREE.WebGLRenderer }) => {
      if (onCanvasReady && !hasNotifiedCanvasRef.current) {
        hasNotifiedCanvasRef.current = true;
        onCanvasReady(state.gl.domElement);
      }
    },
    [onCanvasReady]
  );

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-slate-100">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]"></div>

      <div className="relative z-10 h-full w-full">
        <Canvas
          shadows
          className="h-full w-full"
          onPointerMissed={() => onSelectObject(null)}
          onCreated={handleCreated}
          // Performance optimizations
          dpr={[1, 2]} // Limit device pixel ratio (1 min, 2 max)
          performance={{ min: 0.5 }} // Allow adaptive performance scaling
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false, // Disable stencil buffer if not needed
            depth: true,
            alpha: true, // Enable transparency for background gradient compositing
            preserveDrawingBuffer: true, // Required for thumbnail capture
          }}
        >
          <SceneContent
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onFocusObject={onFocusObject}
            onCameraControlsReady={onCameraControlsReady}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            recordingPositionForStepId={recordingPositionForStepId}
            steps={steps}
            previewMode={previewMode}
            previewStep={previewStep}
            onPreviewObjectClick={onPreviewObjectClick}
            onPreviewPositionUpdate={onPreviewPositionUpdate}
            onPreviewStepComplete={onPreviewStepComplete}
            shouldAnimateMoveItem={shouldAnimateMoveItem}
          />

          {/* Performance monitor (scene component - collects stats) */}
          {showPerformanceMonitor && <PerformanceMonitorScene onStats={handlePerfStats} />}
        </Canvas>
      </div>

      {/* Performance monitor UI (outside canvas) */}
      {showPerformanceMonitor && <PerformanceMonitorUI stats={perfStats} position="top-left" />}
    </div>
  );
};
