import React, { Suspense, useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { SceneObject } from '../types';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../constants';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import {
  CameraControls,
  Environment,
  ContactShadows,
  Grid,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { PerformanceMonitorScene, PerformanceMonitorUI } from './PerformanceMonitor';

// Check if we're in development mode (Vite provides this)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV ?? process.env.NODE_ENV === 'development';

// ============================================================================
// Types
// ============================================================================

// Drag state interface for tracking object translation
interface DragState {
  objectId: string;
  object: SceneObject;
  groundPlaneY: number;
  offset: THREE.Vector3;
  hasMoved: boolean; // Track if mouse moved during drag (to distinguish click vs drag)
  startPosition: { x: number; y: number }; // Initial mouse position
}

interface SceneContentProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
}

// Shared geometry instances - created once and reused across all primitives
const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sharedSelectionGeometry = new THREE.BoxGeometry(1.05, 1.05, 1.05);

interface IndustrialPrimitiveProps {
  obj: SceneObject;
  isSelected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, obj: SceneObject) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

const IndustrialPrimitiveInner: React.FC<IndustrialPrimitiveProps> = ({
  obj,
  isSelected,
  onPointerDown,
  onDoubleClick,
  isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
}) => {
  const meshRef = useRef<THREE.Group>(null);
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

  // Calculate emissive properties
  const emissiveColor = isHovered && !isDragging ? color : '#000000';
  const emissiveIntensity = isHovered && !isDragging ? 0.1 : 0;

  return (
    <group
      ref={meshRef}
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
        />
      </mesh>

      {isSelected && (
        // eslint-disable-next-line react/no-unknown-property
        <mesh geometry={sharedSelectionGeometry} scale={[1.1, 1.1, 1.1]}>
          <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
        </mesh>
      )}
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

// Minimum distance in pixels before considering it a drag vs a click
const DRAG_THRESHOLD = 5;

// Drag handler component - manages pointer events for object translation
const DragHandler: React.FC<{
  dragState: DragState | null;
  onUpdateObject: (obj: SceneObject) => void;
  onDragEnd: (wasDrag: boolean) => void;
  onMarkAsDrag: () => void;
}> = ({ dragState, onUpdateObject, onDragEnd, onMarkAsDrag }) => {
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
      // Check if we've moved beyond the drag threshold
      const dx = event.clientX - dragState.startPosition.x;
      const dy = event.clientY - dragState.startPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only start actual dragging if we've moved beyond threshold
      if (distance < DRAG_THRESHOLD) return;

      // Mark as a real drag (not just a click)
      if (!dragState.hasMoved) {
        onMarkAsDrag();
      }

      // Convert mouse position to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Reuse the Vector2 instead of creating a new one each frame
      mouseCoords.current.set(x, y);
      raycaster.current.setFromCamera(mouseCoords.current, camera);

      if (raycaster.current.ray.intersectPlane(groundPlane.current, intersection.current)) {
        // Apply offset to get new object position
        const newX = (intersection.current.x - dragState.offset.x) * 100;
        const newZ = -(intersection.current.z - dragState.offset.z) * 100;

        // Update object with new position
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
    };

    const handlePointerUp = () => {
      onDragEnd(dragState.hasMoved);
    };

    // Add listeners to window to capture events outside canvas
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
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
}> = ({ controlsRef, selectedObject }) => {
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

      // Focus on selected object (F key)
      if (key === 'f' && selectedObject && controlsRef.current) {
        const pos = new THREE.Vector3(
          selectedObject.transform.x / 100,
          selectedObject.transform.y / 100,
          -selectedObject.transform.z / 100
        );
        // Smoothly focus on object with good framing distance
        controlsRef.current.setLookAt(
          pos.x + 5,
          pos.y + 3,
          pos.z + 5, // Camera position offset
          pos.x,
          pos.y,
          pos.z, // Target (object center)
          true // Enable smooth transition
        );
        invalidate(); // Trigger re-render for smooth animation
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
  }, [gl, selectedObject, controlsRef, invalidate]);

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
}) => {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const selectedObject = objects.find((obj) => obj.id === selectedObjectId) || null;

  // Drag state management
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

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

  // Handle pointer down on object - start potential drag
  const handleObjectPointerDown = useCallback((e: ThreeEvent<PointerEvent>, obj: SceneObject) => {
    // Only handle left mouse button
    if (e.nativeEvent.button !== 0) return;

    const objectWorldPos = new THREE.Vector3(
      obj.transform.x / 100,
      obj.transform.y / 100,
      -obj.transform.z / 100
    );

    // Calculate offset from click point to object center
    const clickPoint = e.point;
    const offset = new THREE.Vector3(
      clickPoint.x - objectWorldPos.x,
      0,
      clickPoint.z - objectWorldPos.z
    );

    setDragState({
      objectId: obj.id,
      object: obj,
      groundPlaneY: objectWorldPos.y,
      offset,
      hasMoved: false,
      startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
    });
  }, []);

  // Handle drag end - select object if it was just a click
  const handleDragEnd = useCallback(
    (wasDrag: boolean) => {
      if (dragState && !wasDrag) {
        // It was a click, not a drag - select the object
        onSelectObject(dragState.objectId);
      }
      setDragState(null);
    },
    [dragState, onSelectObject]
  );

  // Mark the current interaction as a drag (mouse moved beyond threshold)
  const handleMarkAsDrag = useCallback(() => {
    setDragState((prev) => (prev ? { ...prev, hasMoved: true } : null));
  }, []);

  // Handle double-click to focus on object
  const handleDoubleClick = useCallback(
    (obj: SceneObject) => {
      if (onFocusObject) {
        onFocusObject(obj);
      }
    },
    [onFocusObject]
  );

  // Update drag state when object is updated (keep reference fresh)
  useEffect(() => {
    if (dragState) {
      const updatedObj = objects.find((o) => o.id === dragState.objectId);
      if (updatedObj && updatedObj !== dragState.object) {
        setDragState((prev) => (prev ? { ...prev, object: updatedObj } : null));
      }
    }
  }, [objects, dragState]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <spotLight position={[-10, 15, 10]} angle={0.25} penumbra={1} intensity={2} />

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={35} />

      <group>
        {objects.map(
          (obj) =>
            obj.properties.visible && (
              <IndustrialPrimitive
                key={obj.id}
                obj={obj}
                isSelected={selectedObjectId === obj.id}
                onPointerDown={handleObjectPointerDown}
                onDoubleClick={handleDoubleClick}
                isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                isHovered={hoveredObjectId === obj.id}
                onHoverStart={() => setHoveredObjectId(obj.id)}
                onHoverEnd={() => setHoveredObjectId(null)}
              />
            )
        )}
      </group>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.2}
        scale={20}
        blur={2.5}
        far={1}
        resolution={256} // Lower resolution for better performance (default is 512)
        frames={1} // Only render shadow once (static shadows)
      />

      {/* Grid visible from both above and below */}
      <Grid
        infiniteGrid
        fadeDistance={40}
        sectionColor="#94a3b8"
        cellColor="#cbd5e1"
        sectionThickness={1.0}
        cellThickness={0.4}
        side={THREE.DoubleSide}
      />

      {/* Premium CameraControls - tuned for beginners */}
      <CameraControls
        ref={controlsRef}
        makeDefault
        enabled={!(dragState?.hasMoved ?? false)}
        // Smooth damping for premium feel
        smoothTime={0.35}
        draggingSmoothTime={0.2}
        // Comfortable rotation speed for beginner-friendly navigation
        azimuthRotateSpeed={0.35}
        polarRotateSpeed={0.35}
        // Slower panning
        truckSpeed={1.2}
        // Zoom settings
        minDistance={3}
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
      <KeyboardNavigator controlsRef={controlsRef} selectedObject={selectedObject} />
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
  onFocusObject?: (obj: SceneObject) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  /** Show performance monitor (defaults to true in development) */
  showPerformanceMonitor?: boolean;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  showPerformanceMonitor = IS_DEV,
}) => {
  // Performance monitoring state
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);

  // Memoize the stats handler to prevent unnecessary re-renders
  const handlePerfStats = useCallback((stats: PerformanceStats) => {
    setPerfStats(stats);
  }, []);

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-slate-100">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]"></div>

      <div className="relative z-10 h-full w-full">
        <Canvas
          shadows
          className="h-full w-full"
          onPointerMissed={() => onSelectObject(null)}
          // Performance optimizations
          dpr={[1, 2]} // Limit device pixel ratio (1 min, 2 max)
          performance={{ min: 0.5 }} // Allow adaptive performance scaling
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false, // Disable stencil buffer if not needed
            depth: true,
          }}
        >
          <SceneContent
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onFocusObject={onFocusObject}
            onCameraControlsReady={onCameraControlsReady}
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
