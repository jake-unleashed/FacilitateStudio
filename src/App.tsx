import { useState, useRef, useCallback, useMemo } from 'react';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainCanvas } from './components/MainCanvas';
import { NavigationHelp } from './components/NavigationHelp';
import { DebugMenu } from './components/DebugMenu';
import { CameraResetButton } from './components/CameraResetButton';
import { INITIAL_OBJECTS, INITIAL_STEPS } from './constants';
import { SceneObject, SidebarSection } from './types';
import CameraControlsImpl from 'camera-controls';

function App() {
  const [activeTab, setActiveTab] = useState<SidebarSection | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>(INITIAL_OBJECTS);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [steps] = useState(INITIAL_STEPS);
  const [simulationTitle, setSimulationTitle] = useState('New Simulation');

  // Use ref for camera controls to avoid stale closures
  const cameraControlsRef = useRef<CameraControlsImpl | null>(null);
  // Force re-render when controls become available
  const [, setControlsReady] = useState(false);

  // Track debug cube count for naming
  const debugCubeCountRef = useRef(0);

  // ============================================================================
  // Memoized Callbacks - Stable references for child components
  // ============================================================================

  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  const handleSelectObject = useCallback((id: string | null) => {
    setSelectedObjectId(id);
  }, []);

  const handleFocusObject = useCallback((object: SceneObject) => {
    const controls = cameraControlsRef.current;
    if (controls) {
      // Calculate object position in Three.js coordinates
      const x = object.transform.x / 100;
      const y = object.transform.y / 100;
      const z = -object.transform.z / 100;

      // Smoothly focus camera on object
      controls.setLookAt(
        x + 5,
        y + 3,
        z + 5, // Camera position offset
        x,
        y,
        z, // Target (object center)
        true // Enable smooth transition
      );
    }
  }, []);

  const handleUpdateObject = useCallback((updated: SceneObject) => {
    setObjects((prev) => prev.map((obj) => (obj.id === updated.id ? updated : obj)));
  }, []);

  const handleDeleteObject = useCallback((id: string) => {
    setObjects((prev) => prev.filter((obj) => obj.id !== id));
    setSelectedObjectId((prevId) => (prevId === id ? null : prevId));
  }, []);

  const handleAddDebugCube = useCallback(() => {
    debugCubeCountRef.current += 1;
    const cubeNumber = debugCubeCountRef.current;
    const newCube: SceneObject = {
      id: crypto.randomUUID(),
      name: cubeNumber === 1 ? 'Debug Cube' : `Debug Cube ${cubeNumber}`,
      type: 'mesh',
      transform: {
        x: 0,
        y: 50, // Position cube so base sits on grid (0.5 units up from origin)
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      properties: {
        visible: true,
        color: '#3b82f6',
      },
    };
    setObjects((prev) => [...prev, newCube]);
  }, []);

  const handleCloseRightSidebar = useCallback(() => {
    setSelectedObjectId(null);
  }, []);

  // ============================================================================
  // Memoized Derived State
  // ============================================================================

  const selectedObject = useMemo(
    () => objects.find((obj) => obj.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );

  const hasSelectedObject = useMemo(() => !!selectedObject, [selectedObject]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black selection:bg-blue-500/30 selection:text-white">
      {/* Background / Workspace Layer */}
      <MainCanvas
        objects={objects}
        selectedObjectId={selectedObjectId}
        onSelectObject={handleSelectObject}
        onUpdateObject={handleUpdateObject}
        onFocusObject={handleFocusObject}
        onCameraControlsReady={handleCameraControlsReady}
      />

      {/* Floating UI Layer */}
      <TopBar title={simulationTitle} onTitleChange={setSimulationTitle} />

      <LeftSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        steps={steps}
        objects={objects}
        onSelectObject={handleSelectObject}
        selectedObjectId={selectedObjectId}
        onFocusObject={handleFocusObject}
      />

      {selectedObject && (
        <RightSidebar
          object={selectedObject}
          onUpdate={handleUpdateObject}
          onDelete={handleDeleteObject}
          onClose={handleCloseRightSidebar}
        />
      )}

      <NavigationHelp offsetForSidebar={hasSelectedObject} />

      <CameraResetButton cameraControlsRef={cameraControlsRef} />

      <DebugMenu onAddCube={handleAddDebugCube} hasSelectedObject={hasSelectedObject} />
    </div>
  );
}

export default App;
