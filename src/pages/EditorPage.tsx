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
import { RecordingModeOverlay } from '../components/RecordingModeOverlay';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';
import { SceneObject, SidebarSection, SimStep } from '../types';
import { Project } from '../types/project';
import { useProjects } from '../hooks/useProjects';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
import { captureThumbnail } from '../utils/captureThumbnail';
import { useUndoRedo } from '../hooks/useUndoRedo';
import {
  createUpdateObjectCommandHelper,
  createDeleteObjectCommandHelper,
  createCreateObjectCommandHelper,
  createUpdateTitleCommandHelper,
  createCreateStepCommandHelper,
  createUpdateStepCommandHelper,
  findObjectIndex,
} from '../hooks/undoRedo/integration';
import { UpdateObjectCommand, UndoRedoCommand } from '../hooks/undoRedo/types';
import '../types/testHooks'; // Import for global type augmentation
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
  // Recording state for move-item step end position
  const [recordingPositionForStepId, setRecordingPositionForStepId] = useState<string | null>(null);

  // Undo/Redo system - initialize with empty state, will be set when project loads
  const initialEditorState = useMemo(
    () => ({
      objects: [],
      steps: [],
      simulationTitle: 'New Simulation',
    }),
    []
  );

  const {
    currentState: undoRedoState,
    execute: executeCommand,
    undo,
    redo,
    beginBatch,
    endBatch,
    canUndo,
    canRedo,
    setCurrentState: setUndoRedoState,
    undoStackSize,
    redoStackSize,
  } = useUndoRedo(initialEditorState, { maxHistory: 50, enableKeyboardShortcuts: true });

  // Store stack sizes in refs for real-time access (needed for testing)
  const undoStackSizeRef = useRef(undoStackSize);
  const redoStackSizeRef = useRef(redoStackSize);

  useEffect(() => {
    undoStackSizeRef.current = undoStackSize;
    redoStackSizeRef.current = redoStackSize;
  }, [undoStackSize, redoStackSize]);

  // Sync undo/redo state changes back to local state
  useEffect(() => {
    // Only update if the state actually changed (to avoid infinite loops)
    if (
      undoRedoState.objects !== objects ||
      undoRedoState.steps !== steps ||
      undoRedoState.simulationTitle !== simulationTitle
    ) {
      setObjects(undoRedoState.objects);
      setSteps(undoRedoState.steps);
      setSimulationTitle(undoRedoState.simulationTitle);
    }
  }, [undoRedoState, objects, steps, simulationTitle]);

  // Expose test hooks for automated testing (development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const createMoveCommand = (
      objectId: string,
      x: number,
      z: number,
      description?: string
    ): UpdateObjectCommand => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj) throw new Error(`Object ${objectId} not found`);

      return {
        type: 'updateObject',
        timestamp: Date.now(),
        description: description || `Move to (${x.toFixed(1)}, ${z.toFixed(1)})`,
        objectId,
        previousState: obj,
        newState: { ...obj, transform: { ...obj.transform, x, z } },
      };
    };

    (window as Window).__testHooks = {
      // Stack queries (using refs for real-time values)
      getUndoStackSize: () => undoStackSizeRef.current,
      getRedoStackSize: () => redoStackSizeRef.current,
      getCurrentObjects: () => objects,
      canUndo,
      canRedo,

      // Command execution
      executeCommand: (command: UndoRedoCommand) => executeCommand(command),
      undo,
      redo,

      // Programmatic object movement
      moveObject: (objectId: string, x: number, z: number, description?: string) => {
        const command = createMoveCommand(objectId, x, z, description);
        executeCommand(command);
        return command;
      },

      testMove: (objectId: string, deltaX: number, deltaZ: number) => {
        const obj = objects.find((o) => o.id === objectId);
        if (!obj) throw new Error(`Object ${objectId} not found`);

        const command = createMoveCommand(
          objectId,
          obj.transform.x + deltaX,
          obj.transform.z + deltaZ,
          `Move by (${deltaX.toFixed(1)}, ${deltaZ.toFixed(1)})`
        );
        executeCommand(command);
        return command;
      },
    };

    return () => {
      delete window.__testHooks;
    };
  }, [objects, canUndo, canRedo, executeCommand, undo, redo]);

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
        // Initialize undo/redo state first, then it will sync to local state
        setUndoRedoState({
          objects: project.objects,
          steps: project.steps,
          simulationTitle: project.name,
        });
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
      // Initialize undo/redo state first, then it will sync to local state
      setUndoRedoState({
        objects: [],
        steps: [],
        simulationTitle: newProject.name,
      });
      // Update URL to include the new project ID
      navigate(`/editor/${newProject.id}`, { replace: true });
      setIsInitialized(true);
    }
  }, [
    projectId,
    getProject,
    createProject,
    navigate,
    isInitialized,
    isLoadingProjects,
    setUndoRedoState,
  ]);

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

  const handleUpdateObject = useCallback(
    (updated: SceneObject) => {
      const previousObject = objects.find((obj) => obj.id === updated.id);
      if (!previousObject) {
        console.warn('[EditorPage] Cannot update object: not found', updated.id);
        return;
      }

      // If we're recording position for a step and this is the target object,
      // don't update the actual object position - only update the step's end position
      // The actual object should remain at its start position
      if (recordingPositionForStepId) {
        const recordingStep = steps.find((s) => s.id === recordingPositionForStepId);
        if (recordingStep && recordingStep.targetObjectId === updated.id) {
          // Only update the step's end position, not the actual object
          const updatedStep: SimStep = {
            ...recordingStep,
            endPosition: {
              x: updated.transform.x,
              y: updated.transform.y,
              z: updated.transform.z,
            },
          };
          const previousStep = steps.find((s) => s.id === recordingStep.id);
          if (previousStep) {
            const stepCommand = createUpdateStepCommandHelper(
              updatedStep.id,
              previousStep,
              updatedStep,
              `Update step end position: ${updatedStep.title || 'Untitled'}`
            );
            executeCommand(stepCommand);
          }
          // Don't update the actual object - return early
          return;
        }
      }

      // Normal object update (not recording, or not the target object)
      const command = createUpdateObjectCommandHelper(
        updated.id,
        previousObject,
        updated,
        `Update ${updated.name}`
      );
      executeCommand(command);
    },
    [objects, executeCommand, recordingPositionForStepId, steps]
  );

  const handleDeleteObject = useCallback(
    (id: string) => {
      const objectToDelete = objects.find((obj) => obj.id === id);
      if (!objectToDelete) {
        console.warn('[EditorPage] Cannot delete object: not found', id);
        return;
      }

      const index = findObjectIndex(objects, id);
      const command = createDeleteObjectCommandHelper(
        objectToDelete,
        index,
        `Delete ${objectToDelete.name}`
      );
      executeCommand(command);
      setSelectedObjectId((prevId) => (prevId === id ? null : prevId));
    },
    [objects, executeCommand]
  );

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
    const index = objects.length;
    const command = createCreateObjectCommandHelper(newCube, index, `Create ${newCube.name}`);
    executeCommand(command);
  }, [objects.length, executeCommand]);

  const handleCloseRightSidebar = useCallback(() => {
    setSelectedObjectId(null);
  }, []);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const command = createUpdateTitleCommandHelper(
        simulationTitle,
        newTitle,
        'Update simulation title'
      );
      executeCommand(command);
    },
    [simulationTitle, executeCommand]
  );

  const handleAddStep = useCallback(
    (step: Omit<SimStep, 'id'>) => {
      const newStep: SimStep = {
        ...step,
        id: crypto.randomUUID(),
      };
      const index = steps.length;
      const command = createCreateStepCommandHelper(
        newStep,
        index,
        `Create step: ${newStep.title}`
      );
      executeCommand(command);
    },
    [steps.length, executeCommand]
  );

  const handleUpdateStep = useCallback(
    (updated: SimStep) => {
      // Use undoRedoState.steps to get the most up-to-date step (not the local steps state which might be stale)
      const previousStep = undoRedoState.steps.find((step) => step.id === updated.id);
      if (!previousStep) {
        console.warn('[EditorPage] Cannot update step: not found', updated.id);
        return;
      }

      const command = createUpdateStepCommandHelper(
        updated.id,
        previousStep,
        updated,
        `Update step: ${updated.title || 'Untitled'}`
      );
      executeCommand(command);
    },
    [undoRedoState.steps, executeCommand]
  );

  // Recording handlers for move-item step end position
  const handleStartRecordingPosition = useCallback(
    (stepId: string) => {
      setRecordingPositionForStepId(stepId);
      beginBatch();
    },
    [beginBatch]
  );

  const handleStopRecordingPosition = useCallback(() => {
    // Restore the actual object to its start position if it was moved during recording
    if (recordingPositionForStepId) {
      const recordingStep = steps.find((s) => s.id === recordingPositionForStepId);
      if (recordingStep?.targetObjectId && recordingStep.startPosition) {
        const targetObject = objects.find((obj) => obj.id === recordingStep.targetObjectId);
        if (targetObject) {
          // Check if object is not at start position and restore it
          const isAtStartPosition =
            targetObject.transform.x === recordingStep.startPosition.x &&
            targetObject.transform.y === recordingStep.startPosition.y &&
            targetObject.transform.z === recordingStep.startPosition.z;

          if (!isAtStartPosition) {
            const restoredObject: SceneObject = {
              ...targetObject,
              transform: {
                ...targetObject.transform,
                x: recordingStep.startPosition.x,
                y: recordingStep.startPosition.y,
                z: recordingStep.startPosition.z,
              },
            };
            const previousObject = objects.find((obj) => obj.id === restoredObject.id);
            if (previousObject) {
              const command = createUpdateObjectCommandHelper(
                restoredObject.id,
                previousObject,
                restoredObject,
                `Restore ${restoredObject.name} to start position`
              );
              executeCommand(command);
            }
          }
        }
      }
    }
    setRecordingPositionForStepId(null);
    endBatch();
  }, [endBatch, recordingPositionForStepId, steps, objects, executeCommand]);

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
        onDragStart={beginBatch}
        onDragEnd={endBatch}
        recordingPositionForStepId={recordingPositionForStepId}
        steps={steps}
      />

      {/* Floating UI Layer */}
      <TopBar
        title={simulationTitle}
        onTitleChange={handleTitleChange}
        onRequestHome={handleRequestHome}
        saveStatus={status}
        saveErrorMessage={lastError?.message ?? null}
        onManualSave={handleManualSave}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <LeftSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        steps={steps}
        objects={objects}
        onSelectObject={handleSelectObject}
        selectedObjectId={selectedObjectId}
        onFocusObject={handleFocusObject}
        onAddStep={handleAddStep}
        onUpdateStep={handleUpdateStep}
        onStartRecordingPosition={handleStartRecordingPosition}
        onStopRecordingPosition={handleStopRecordingPosition}
        recordingPositionForStepId={recordingPositionForStepId}
      />

      {selectedObject && (
        <RightSidebar
          object={selectedObject}
          onUpdate={handleUpdateObject}
          onDelete={handleDeleteObject}
          onClose={handleCloseRightSidebar}
          onBatchStart={beginBatch}
          onBatchEnd={endBatch}
        />
      )}

      <NavigationHelp offsetForSidebar={hasSelectedObject} />

      <CameraResetButton cameraControlsRef={cameraControlsRef} />

      {/* Recording Mode Overlay */}
      {recordingPositionForStepId && (
        <RecordingModeOverlay
          recordingStep={steps.find((s) => s.id === recordingPositionForStepId) || null}
          targetObject={(() => {
            const step = steps.find((s) => s.id === recordingPositionForStepId);
            if (!step?.targetObjectId) return null;
            return objects.find((obj) => obj.id === step.targetObjectId) || null;
          })()}
          onStopRecording={handleStopRecordingPosition}
        />
      )}

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
