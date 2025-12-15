import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { MainCanvas } from '../components/MainCanvas';
import { NavigationHelp } from '../components/NavigationHelp';
import { DebugMenu } from '../components/DebugMenu';
import { CameraResetButton } from '../components/CameraResetButton';
import { SaveOverlay } from '../components/SaveOverlay';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';
import { SceneObject, SidebarSection, SimStep } from '../types';
import { Project } from '../types/project';
import { useProjects } from '../hooks/useProjects';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
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

  // WebGL canvas ref for thumbnail capture
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hasHydratedRef = useRef(false);

  const [exitOverlay, setExitOverlay] = useState<null | {
    mode: 'saving' | 'error';
    errorMessage?: string;
  }>(null);

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

  // Stable thumbnail capture function (CRITICAL: must be useCallback to avoid infinite loops)
  const handleCaptureThumbnail = useCallback(async () => {
    if (!canvasRef.current) return undefined;
    // NOTE: We do not clear selection for thumbnail capture.
    const captured = await captureThumbnail(canvasRef.current);
    return captured ?? undefined;
  }, []);

  const { status, isDirty, lastError, setBaseline, flushSave, flushSaveNow } = useProjectAutoSave({
    project: currentProject,
    name: simulationTitle,
    objects,
    steps,
    saveProject,
    captureThumbnail: handleCaptureThumbnail,
    debounceMs: 1000,
  });

  // Establish baseline AFTER initial state load so autosave knows what "saved" means
  useEffect(() => {
    if (!isInitialized || !currentProject) return;
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    setBaseline();
    // We only need currentProject?.id, not the entire object, to avoid unnecessary re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, isInitialized, setBaseline]);

  // Reset hydration when project changes
  useEffect(() => {
    hasHydratedRef.current = false;
  }, [currentProject?.id]);

  // Best-effort flush on unload / backgrounding.
  useEffect(() => {
    const handlePageHide = () => {
      if (!isDirty) return;
      flushSaveNow();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!isDirty) return;
      flushSaveNow();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      flushSaveNow();
      e.preventDefault();
      // Required for some browsers to show a confirmation dialog.
      e.returnValue = '';
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, flushSaveNow]);

  const handleRequestHome = useCallback(async () => {
    if (!isDirty) {
      navigate('/');
      return;
    }

    setExitOverlay({ mode: 'saving' });

    // Safety timeout: if save takes longer than 2s total, force-navigate anyway.
    const safetyTimeout = setTimeout(() => {
      console.warn('[EditorPage] Save took too long; force-navigating Home.');
      setExitOverlay(null);
      navigate('/');
    }, 2000);

    try {
      // Ensure thumbnail is as fresh as possible before returning Home,
      // but never let this hang indefinitely.
      await flushSave({ includeThumbnail: true, thumbnailTimeoutMs: 600 });
      clearTimeout(safetyTimeout);
      setExitOverlay(null);
      navigate('/');
    } catch (err) {
      clearTimeout(safetyTimeout);
      console.error('[EditorPage] Failed to save before navigating Home:', err);
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      setExitOverlay({ mode: 'error', errorMessage: message });
    }
  }, [flushSave, isDirty, navigate]);

  const handleExitStay = useCallback(() => {
    setExitOverlay(null);
  }, []);

  const handleExitLeaveAnyway = useCallback(() => {
    setExitOverlay(null);
    navigate('/');
  }, [navigate]);

  const handleManualSave = useCallback(async () => {
    console.log('[EditorPage] Manual save clicked. isDirty:', isDirty, 'status:', status);
    if (!isDirty) {
      console.log('[EditorPage] Already saved, skipping.');
      return;
    }
    try {
      console.log('[EditorPage] Calling flushSave...');
      await flushSave({ includeThumbnail: true, thumbnailTimeoutMs: 600 });
      console.log('[EditorPage] Manual save completed. New status should be "saved"');
    } catch (err) {
      console.error('[EditorPage] Manual save failed:', err);
    }
  }, [flushSave, isDirty, status]);

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
      <TopBar
        title={simulationTitle}
        onTitleChange={handleTitleChange}
        onRequestHome={handleRequestHome}
        saveStatus={status}
        saveErrorMessage={lastError?.message ?? null}
        onManualSave={handleManualSave}
      />

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

      {exitOverlay && (
        <SaveOverlay
          mode={exitOverlay.mode}
          errorMessage={exitOverlay.errorMessage}
          onStay={handleExitStay}
          onLeaveAnyway={handleExitLeaveAnyway}
        />
      )}
    </div>
  );
}
