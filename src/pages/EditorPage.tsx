import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { MainCanvas } from '../components/MainCanvas';
import { NavigationHelp } from '../components/NavigationHelp';
import { DebugMenu } from '../components/DebugMenu';
import { CameraResetButton } from '../components/CameraResetButton';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';
import { SceneObject, SidebarSection, SimStep } from '../types';
import { Project } from '../types/project';
import { useProjects } from '../hooks/useProjects';
import { captureThumbnail } from '../utils/captureThumbnail';
import CameraControlsImpl from 'camera-controls';

/**
 * EditorPage - The main 3D simulation editor interface.
 *
 * Handles loading/saving projects and provides the full editing experience.
 */
export function EditorPage() {
  const { id: projectId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { getProject, saveProject, createProject, isLoading: isLoadingProjects } = useProjects();

  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Editor state
  const [activeTab, setActiveTab] = useState<SidebarSection | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>(INITIAL_OBJECTS);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [steps, setSteps] = useState<SimStep[]>(INITIAL_STEPS);
  const [simulationTitle, setSimulationTitle] = useState('New Simulation');

  // Use ref for camera controls to avoid stale closures
  const cameraControlsRef = useRef<CameraControlsImpl | null>(null);
  // Force re-render when controls become available
  const [, setControlsReady] = useState(false);

  // Track debug cube count for naming
  const debugCubeCountRef = useRef(0);

  // Auto-save timer ref
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebGL canvas ref for thumbnail capture
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Track current selection for thumbnail capture (avoids stale closure in auto-save)
  const selectedObjectIdRef = useRef<string | null>(null);
  selectedObjectIdRef.current = selectedObjectId;

  // ============================================================================
  // Project Loading & Initialization
  // ============================================================================

  useEffect(() => {
    // Wait for projects to load from localStorage before initializing
    if (isLoadingProjects || isInitialized) return;

    if (projectId) {
      // Load existing project
      const project = getProject(projectId);
      if (project) {
        setCurrentProject(project);
        setObjects(project.objects);
        setSteps(project.steps);
        setSimulationTitle(project.name);
        setIsInitialized(true);
      } else {
        // Project not found, redirect to home
        navigate('/');
        return;
      }
    } else {
      // Create a new project
      const newProject = createProject('New Simulation');
      setCurrentProject(newProject);
      setObjects([]);
      setSteps([]);
      setSimulationTitle(newProject.name);
      // Update URL to include the new project ID
      navigate(`/editor/${newProject.id}`, { replace: true });
      setIsInitialized(true);
    }
  }, [projectId, getProject, createProject, navigate, isInitialized, isLoadingProjects]);

  // ============================================================================
  // Auto-save Logic
  // ============================================================================

  const triggerAutoSave = useCallback(() => {
    if (!currentProject) return;

    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Debounce auto-save by 1 second
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Capture thumbnail from the current scene
      let thumbnail = currentProject.thumbnail;
      if (canvasRef.current) {
        // Store current selection and temporarily clear it to avoid capturing selection wireframe
        const previousSelection = selectedObjectIdRef.current;
        if (previousSelection) {
          setSelectedObjectId(null);
          // Wait for next animation frame to ensure scene re-renders without selection
          await new Promise((resolve) => requestAnimationFrame(resolve));
          // Wait one more frame to ensure Three.js has updated
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }

        const captured = await captureThumbnail(canvasRef.current);
        if (captured) {
          thumbnail = captured;
        }

        // Restore selection
        if (previousSelection) {
          setSelectedObjectId(previousSelection);
        }
      }

      const updatedProject: Project = {
        ...currentProject,
        name: simulationTitle,
        objects,
        steps,
        thumbnail,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updatedProject);
      setCurrentProject(updatedProject);
    }, 1000);
  }, [currentProject, simulationTitle, objects, steps, saveProject]);

  // Trigger auto-save when relevant state changes
  useEffect(() => {
    if (isInitialized && currentProject) {
      triggerAutoSave();
    }
    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [objects, steps, simulationTitle, isInitialized, currentProject, triggerAutoSave]);

  // ============================================================================
  // Memoized Callbacks - Stable references for child components
  // ============================================================================

  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
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

  const handleTitleChange = useCallback((newTitle: string) => {
    setSimulationTitle(newTitle);
  }, []);

  // ============================================================================
  // Memoized Derived State
  // ============================================================================

  const selectedObject = useMemo(
    () => objects.find((obj) => obj.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );

  const hasSelectedObject = useMemo(() => !!selectedObject, [selectedObject]);

  // Show loading state while initializing or loading projects
  if (isLoadingProjects || !isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

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
        onCanvasReady={handleCanvasReady}
      />

      {/* Floating UI Layer */}
      <TopBar title={simulationTitle} onTitleChange={handleTitleChange} />

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
