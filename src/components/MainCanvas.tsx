import React, { Suspense, useRef, useEffect } from 'react';
import { SceneObject } from '../types';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../constants';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  CameraControls,
  Environment,
  ContactShadows,
  Grid,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';

interface SceneContentProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
}

const IndustrialPrimitive: React.FC<{
  obj: SceneObject;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ obj, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Group>(null);
  const color = obj.properties.color || '#3b82f6';

  return (
    <group
      ref={meshRef}
      position={[obj.transform.x / 100, obj.transform.y / 100, -obj.transform.z / 100]}
      rotation={[
        THREE.MathUtils.degToRad(obj.transform.rotationX),
        THREE.MathUtils.degToRad(obj.transform.rotationY),
        THREE.MathUtils.degToRad(obj.transform.rotationZ),
      ]}
      scale={[obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.1} />
      </mesh>

      {isSelected && (
        <mesh scale={[1.1, 1.1, 1.1]}>
          <boxGeometry args={[1.05, 1.05, 1.05]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
};

// Keyboard navigation component - handles WASD, arrow keys, Q/E, F, Home
const KeyboardNavigator: React.FC<{
  controlsRef: React.RefObject<CameraControlsImpl>;
  selectedObject: SceneObject | null;
}> = ({ controlsRef, selectedObject }) => {
  const keysPressed = useRef<Set<string>>(new Set());
  const { gl } = useThree();

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
        e.preventDefault();
      }

      // Reset view (Home or 0 key)
      if ((key === 'home' || key === '0') && controlsRef.current) {
        controlsRef.current.setLookAt(...DEFAULT_CAMERA_POSITION, ...DEFAULT_CAMERA_TARGET, true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gl, selectedObject, controlsRef]);

  // Continuous movement in useFrame for smooth WASD/arrow key navigation
  useFrame(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const keys = keysPressed.current;

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
  onCameraControlsReady,
}) => {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const selectedObject = objects.find((obj) => obj.id === selectedObjectId) || null;

  // Track if we've already notified parent
  const hasNotifiedRef = useRef(false);

  // Poll each frame until controls are ready - guarantees we capture them
  useFrame(() => {
    if (controlsRef.current && onCameraControlsReady && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      onCameraControlsReady(controlsRef.current);
    }
  });

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
                onSelect={() => onSelectObject(obj.id)}
              />
            )
        )}
      </group>

      <ContactShadows position={[0, -0.01, 0]} opacity={0.2} scale={20} blur={2.5} far={1} />

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

      {/* Keyboard navigation */}
      <KeyboardNavigator controlsRef={controlsRef} selectedObject={selectedObject} />
    </>
  );
};

interface MainCanvasProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onCameraControlsReady,
}) => {
  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-slate-100">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]"></div>

      <div className="relative z-10 h-full w-full cursor-crosshair">
        <Canvas shadows className="h-full w-full" onPointerMissed={() => onSelectObject(null)}>
          <SceneContent
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onCameraControlsReady={onCameraControlsReady}
          />
        </Canvas>
      </div>
    </div>
  );
};
