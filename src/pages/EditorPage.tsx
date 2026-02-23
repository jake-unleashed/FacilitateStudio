import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { LeftSidebar, type LeftSidebarHandle } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { MainCanvas } from '../components/MainCanvas';
import { NavigationHelp } from '../components/NavigationHelp';
import { DebugMenu } from '../components/DebugMenu';
import { CameraResetButton } from '../components/CameraResetButton';
import { SaveOverlay, type SaveOverlayProps } from '../components/SaveOverlay';
import { RecordingModeOverlay } from '../components/RecordingModeOverlay';
import { PublishModal } from '../components/PublishModal';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { GuidedWorkflowOverlay, WelcomeModal } from '../components/guidedWorkflow';
import { PhaseIndicator } from '../components/guidedWorkflow/PhaseIndicator';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';
import { hasUsableSteps } from '../utils/stepValidation';
import {
  SceneObject,
  SidebarSection,
  SimStep,
  ChildMesh,
  FocusMode,
  parseSelectionId,
  stringToPath,
} from '../types';
import { useProjects } from '../hooks/useProjects';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
import { useModelUpload } from '../hooks/useModelUpload';
import { captureThumbnail } from '../utils/captureThumbnail';
import { logger } from '../utils/logger';
import { toSimulationSettings } from '../types/simulationSettings';
import { PopupProvider, usePopup } from '../contexts/PopupContext';
import { GuidedWorkflowProvider } from '../contexts/GuidedWorkflowContext';
import { GlobalPopup } from '../components/GlobalPopup';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useEditorProjectLifecycle } from '../hooks/editor/useEditorProjectLifecycle';
import { useEditorNavigationGuards } from '../hooks/editor/useEditorNavigationGuards';
import { useRecordingEndTransform } from '../hooks/editor/useRecordingEndTransform';
import { useEntryFade } from '../hooks/editor/useEntryFade';
import { useCameraFocus } from '../hooks/editor/useCameraFocus';
import { useErrorPopups } from '../hooks/editor/useErrorPopups';
import { useAutosaveHydration } from '../hooks/editor/useAutosaveHydration';
import { useTestHooks } from '../hooks/editor/useTestHooks';
import { useGuidedWelcome } from '../hooks/editor/useGuidedWelcome';
import type { LatestRecordingEndTransformRefValue } from '../hooks/editor/useRecordingEndTransform';
import { useGuidedWorkflow } from '../hooks/useGuidedWorkflow';
import type { PerformanceStats } from '../components/PerformanceMonitor';
import {
  calculateChildWorldPosition,
  applyChildLocalTransform,
  applyChildWorldPosition,
  findChildByPathString,
} from '../utils/childTransformUtils';
import { AssetMetadata, UploadProgress } from '../types/model';
import {
  createUpdateObjectCommandHelper,
  createDeleteObjectCommandHelper,
  createCreateObjectCommandHelper,
  createUpdateTitleCommandHelper,
  createCreateStepCommandHelper,
  createUpdateStepCommandHelper,
  createDeleteStepCommandHelper,
  createReorderStepsCommandHelper,
  findObjectIndex,
  findStepIndex,
} from '../hooks/undoRedo/integration';
import '../types/testHooks'; // Import for global type augmentation

/**
 * EditorPage - The main 3D simulation editor interface.
 *
 * Handles loading/saving projects and provides the full editing experience.
 * Wrapped with PopupProvider for global popup support.
 */
export function EditorPage() {
  return (
    <PopupProvider>
      <EditorPageContent />
    </PopupProvider>
  );
}

/**
 * EditorPageContent - The actual editor implementation.
 * Must be rendered inside a PopupProvider to use the usePopup hook.
 */
function EditorPageContent() {
  const { id: projectId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const {
    getProject,
    saveProject,
    createProject,
    isLoading: isLoadingProjects,
    error: projectsError,
    clearError: clearProjectsError,
  } = useProjects();

  // Editor state
  const [activeTab, setActiveTab] = useState<SidebarSection | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>(INITIAL_OBJECTS);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [steps, setSteps] = useState<SimStep[]>(INITIAL_STEPS);
  const [simulationTitle, setSimulationTitle] = useState('New Simulation');
  // Recording state for move-item step end position
  // recordingPositionForStepId is owned by useRecordingEndTransform (below)

  const handleSelectObject = useCallback((id: string | null) => {
    const guidedPhase =
      typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
    if (id === null) {
      setSelectedObjectId(null);
      return;
    }
    if (guidedPhase === 'model-upload') return;
    if (guidedPhase === 'model-positioning' && id) {
      const parsed = parseSelectionId(id);
      if (parsed?.objectId && parsed.childPath) {
        setSelectedObjectId(parsed.objectId);
        return;
      }
    }
    setSelectedObjectId(id);
  }, []);

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

  // ---------------------------------------------------------------------------
  // Save Snapshot Source of Truth
  // ---------------------------------------------------------------------------
  // `useUndoRedo.getCurrentState()` can lag by a render under heavy batching. For
  // save-before-navigation we want the latest React state synchronously.
  const latestSaveStateRef = useRef({ objects: INITIAL_OBJECTS, steps: INITIAL_STEPS, simulationTitle: 'New Simulation' });
  latestSaveStateRef.current = { objects, steps, simulationTitle };
  const getCurrentStateForSave = useCallback(() => latestSaveStateRef.current, []);

  // Global popup hook for displaying errors and notifications
  const { showPopup } = usePopup();

  const { currentProject, isInitialized } = useEditorProjectLifecycle({
    projectId,
    isLoadingProjects,
    getProject,
    createProject,
    navigate,
    setUndoRedoState,
    onLoadError: (error: unknown) => {
      logger.error('[EditorPage] Failed to initialize project:', error);
      showPopup({
        type: 'error',
        title: 'Project Load Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load this project right now. Please try again.',
      });
    },
  });

  const {
    recordingPositionForStepId,
    latestRecordingEndPositionRef,
    handleStartRecordingPosition,
    handleStopRecordingPosition,
  } = useRecordingEndTransform({
    steps,
    undoRedoSteps: undoRedoState.steps,
    objects,
    beginBatch,
    endBatch,
    executeCommand,
    onSelectObject: handleSelectObject,
  });

  // Store stack sizes in refs for real-time access (needed for testing)
  const undoStackSizeRef = useRef(undoStackSize);
  const redoStackSizeRef = useRef(redoStackSize);

  useEffect(() => {
    undoStackSizeRef.current = undoStackSize;
    redoStackSizeRef.current = redoStackSize;
  }, [undoStackSize, redoStackSize]);

  // Sync undo/redo state changes back to local state
  // Sync undoRedoState to local state
  // CRITICAL: Only depend on undoRedoState to avoid infinite loops
  // The individual state values (objects, steps, simulationTitle) are outputs, not inputs
  // We check for reference equality to avoid unnecessary updates
  useEffect(() => {
    if (
      undoRedoState.objects !== objects ||
      undoRedoState.steps !== steps ||
      undoRedoState.simulationTitle !== simulationTitle
    ) {
      setObjects(undoRedoState.objects);
      setSteps(undoRedoState.steps);
      setSimulationTitle(undoRedoState.simulationTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoRedoState]);

  useTestHooks({
    objects,
    canUndo,
    canRedo,
    executeCommand,
    undo,
    redo,
    undoStackSizeRef,
    redoStackSizeRef,
  });

  const { cameraControlsRef, handleCameraControlsReady, handleSceneReady, handleFocusObject } =
    useCameraFocus();

  const {
    setHasFirstFrame,
    isEntryFadeVisible,
    isEntryFadeFading,
    isEntryTransitionDone,
  } = useEntryFade({
    currentProject,
    isInitialized,
    currentProjectId: currentProject?.id ?? null,
  });

  // Track debug cube count for naming
  const debugCubeCountRef = useRef(0);

  // Model upload hook - handles storage, preprocessing, and caching
  const {
    uploadProgress,
    recentAssets,
    starterAssets,
    uploadFile,
    addRecentAssetToScene,
    removeAsset,
    lastError: uploadLastError,
    clearError: clearUploadError,
  } = useModelUpload();

  useErrorPopups({
    uploadLastError,
    clearUploadError,
    projectsError,
    clearProjectsError,
    popupApi: { showPopup },
  });

  // WebGL canvas ref for thumbnail capture
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hasHydratedRef = useRef(false);

  const leftSidebarRef = useRef<LeftSidebarHandle | null>(null);

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
    simulationSettings: toSimulationSettings(currentProject?.simulationSettings),
    saveProject,
    captureThumbnail: handleCaptureThumbnail,
    debounceMs: 2500,
  });

  const flushPendingStepEdits = useCallback(() => {
    leftSidebarRef.current?.flushPendingEdits();
  }, []);

  const {
    exitOverlay,
    isPublishModalOpen,
    setIsPublishModalOpen,
    requestNavigation,
    handleRequestHome,
    handleExitStay,
    handleExitLeaveAnyway,
    handleManualSave,
    handlePublishClick,
  } = useEditorNavigationGuards({
    navigate,
    currentProject,
    isDirty,
    flushPendingStepEdits,
    recordingPositionForStepId,
    stopRecording: handleStopRecordingPosition,
    getCurrentState: getCurrentStateForSave,
    flushSave,
    flushSaveNow,
    showPopup,
  });
  const handleClosePublishModal = useCallback(() => {
    setIsPublishModalOpen(false);
  }, [setIsPublishModalOpen]);

  const currentProjectId = currentProject?.id ?? null;
  const publishProjectView = useMemo(() => {
    if (!currentProject) return null;
    return {
      ...currentProject,
      name: simulationTitle,
      objects,
      steps,
    };
  }, [currentProject, objects, simulationTitle, steps]);

  const hasReadySteps = useMemo(() => hasUsableSteps(steps), [steps]);

  useAutosaveHydration({
    currentProjectId,
    isInitialized,
    setBaseline,
    undoRedoObjects: undoRedoState.objects,
    undoRedoSteps: undoRedoState.steps,
    undoRedoTitle: undoRedoState.simulationTitle,
    objects,
    steps,
    simulationTitle,
    hasHydratedRef,
  });

  // ============================================================================
  // Memoized Callbacks - Stable references for child components
  // ============================================================================

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleFirstFrame = useCallback(() => {
    setHasFirstFrame(true);
  }, [setHasFirstFrame]);


  const handleUpdateObject = useCallback(
    (updated: SceneObject) => {
      const previousObject = objects.find((obj) => obj.id === updated.id);
      if (!previousObject) {
        logger.warn('[EditorPage] Cannot update object: not found', updated.id);
        return;
      }

      // If we're recording position for a step and this is the target object,
      // don't update the actual object position - only update the step's end position
      // The actual object should remain at its start position
      if (recordingPositionForStepId) {
        // Read from undoRedoState.steps to get the most up-to-date step
        const recordingStep =
          undoRedoState.steps.find((s) => s.id === recordingPositionForStepId) ||
          steps.find((s) => s.id === recordingPositionForStepId);
        if (recordingStep && recordingStep.targetObjectId === updated.id) {
          // Calculate end position based on whether target is a child or parent
          let endPosition: { x: number; y: number; z: number };
          // Capture end rotation/scale in LOCAL space:
          // - Parent targets: from object.transform
          // - Child targets: from child.localTransform
          let endRotation: { x: number; y: number; z: number } | undefined = undefined;
          let endScale: { x: number; y: number; z: number } | undefined = undefined;

          if (recordingStep.targetChildPath) {
            // Target is a child mesh
            // The ghost object's transform represents the parent position needed to place the child at the desired world position
            // So we need to calculate what the child's world position would be with this parent transform
            const childWorldPos = calculateChildWorldPosition(
              updated,
              recordingStep.targetChildPath
            );
            if (childWorldPos) {
              endPosition = childWorldPos;
            } else {
              // Child not found, fall back to parent position
              logger.warn(
                '[handleUpdateObject] Child not found for path:',
                recordingStep.targetChildPath
              );
              endPosition = {
                x: updated.transform.x,
                y: updated.transform.y,
                z: updated.transform.z,
              };
            }

            // Child rotation/scale come from child's localTransform
            const child = findChildByPathString(updated, recordingStep.targetChildPath);
            if (child) {
              endRotation = {
                x: child.localTransform.rotationX,
                y: child.localTransform.rotationY,
                z: child.localTransform.rotationZ,
              };
              endScale = {
                x: child.localTransform.scaleX,
                y: child.localTransform.scaleY,
                z: child.localTransform.scaleZ,
              };
            }
          } else {
            // Target is parent object - use the updated transform directly
            // This is the ghost object's current position from the drag
            endPosition = {
              x: updated.transform.x,
              y: updated.transform.y,
              z: updated.transform.z,
            };

            endRotation = {
              x: updated.transform.rotationX,
              y: updated.transform.rotationY,
              z: updated.transform.rotationZ,
            };
            endScale = {
              x: updated.transform.scaleX,
              y: updated.transform.scaleY,
              z: updated.transform.scaleZ,
            };
          }

          // Update ref synchronously FIRST for immediate access (prevents race conditions)
          latestRecordingEndPositionRef.current = {
            stepId: recordingStep.id,
            endPosition,
            endRotation,
            endScale,
          };

          // Update state for real-time visual feedback during drag
          // This allows the ghost object to update smoothly as the user drags
          // The command system will capture the final position when recording stops
          setUndoRedoState((prevState) => ({
            ...prevState,
            steps: prevState.steps.map((s) =>
              s.id === recordingStep.id ? { ...s, endPosition, endRotation, endScale } : s
            ),
          }));

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
    [
      objects,
      executeCommand,
      recordingPositionForStepId,
      steps,
      undoRedoState.steps,
      setUndoRedoState,
      latestRecordingEndPositionRef,
    ]
  );

  const handleDeleteObject = useCallback(
    (id: string) => {
      const objectToDelete = objects.find((obj) => obj.id === id);
      if (!objectToDelete) {
        logger.warn('[EditorPage] Cannot delete object: not found', id);
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

  // Handle asset upload - uses the useModelUpload hook for storage and preprocessing
  const handleUploadAsset = useCallback(
    async (file: File, textureFiles: File[] = []) => {
      const result = await uploadFile(file, objects, textureFiles);
      if (!result) {
        // Error is handled by the hook and shown in the UI
        return;
      }

      // Add to scene via undo/redo
      const index = objects.length;
      const command = createCreateObjectCommandHelper(
        result.sceneObject,
        index,
        `Upload and add ${result.sceneObject.name}`
      );
      executeCommand(command);

      // Focus on the new object
      setTimeout(() => {
        const guidedPhase =
          typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
        if (guidedPhase !== 'model-upload') {
          handleSelectObject(result.sceneObject.id);
        } else {
          setSelectedObjectId(null);
        }
        setTimeout(() => {
          if (handleFocusObject) {
            handleFocusObject(result.sceneObject);
          }
        }, 50);
      }, 100);
    },
    [objects, uploadFile, executeCommand, handleSelectObject, handleFocusObject]
  );

  // Handle adding recent asset to scene
  const handleAddRecentAsset = useCallback(
    async (asset: AssetMetadata) => {
      const result = await addRecentAssetToScene(asset, objects);
      if (!result) {
        logger.error('[EditorPage] Failed to add recent asset:', asset.id);
        return;
      }

      // Add to scene via undo/redo
      const index = objects.length;
      const command = createCreateObjectCommandHelper(
        result.sceneObject,
        index,
        `Add ${result.sceneObject.name}`
      );
      executeCommand(command);

      // Focus on the new object
      setTimeout(() => {
        const guidedPhase =
          typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
        if (guidedPhase !== 'model-upload') {
          handleSelectObject(result.sceneObject.id);
        } else {
          setSelectedObjectId(null);
        }
        setTimeout(() => {
          if (handleFocusObject) {
            handleFocusObject(result.sceneObject);
          }
        }, 50);
      }, 100);
    },
    [objects, addRecentAssetToScene, executeCommand, handleSelectObject, handleFocusObject]
  );

  // Handle removing asset from recent assets
  const handleRemoveAsset = useCallback(
    async (assetId: string) => {
      await removeAsset(assetId);
      showPopup({
        type: 'success',
        title: 'Asset Removed',
        message: 'The asset has been removed from your recent uploads.',
      });
    },
    [removeAsset, showPopup]
  );

  const handlePopulateTestSteps = useCallback(() => {
    beginBatch();

    // Define object IDs first so we can reference them in steps
    const objectId1 = crypto.randomUUID();
    const objectId2 = crypto.randomUUID();
    const objectId3 = crypto.randomUUID();

    // Create test steps first to determine object start positions
    // We'll create objects at their first move step's start positions
    const testSteps: Omit<SimStep, 'id'>[] = [
      // Step 1: Info card
      {
        title: 'Welcome to the Test Simulation',
        description: 'This is a test step',
        completed: false,
        type: 'info-card',
        heading: 'Welcome!',
        bodyText: 'This is a test simulation with multiple steps. Click Continue to proceed.',
        buttonText: 'Continue',
        cardColor: 'blue',
      },
      // Step 2: Move item - Cube 1
      {
        title: 'Move Test Cube 1',
        description: 'Move the blue cube from its starting position',
        completed: false,
        type: 'move-item',
        targetObjectId: objectId1,
        startPosition: { x: -200, y: 50, z: -200 },
        endPosition: { x: 200, y: 50, z: 200 },
      },
      // Step 3: Info card
      {
        title: 'Great Job!',
        description: 'You moved the cube successfully',
        completed: false,
        type: 'info-card',
        heading: 'Well Done!',
        bodyText: "You successfully moved the first cube. Let's continue with more steps.",
        buttonText: 'Next',
        cardColor: 'green',
      },
      // Step 4: Move item - Cube 2
      {
        title: 'Move Test Cube 2',
        description: 'Move the green cube',
        completed: false,
        type: 'move-item',
        targetObjectId: objectId2,
        startPosition: { x: 0, y: 50, z: 0 },
        endPosition: { x: -300, y: 150, z: 300 },
      },
      // Step 5: Info card
      {
        title: 'Keep Going!',
        description: 'Continue with the simulation',
        completed: false,
        type: 'info-card',
        heading: 'Excellent Progress',
        bodyText: "You're doing great! Keep following the steps.",
        buttonText: 'Continue',
        cardColor: 'yellow',
      },
      // Step 6: Move item - Cube 3
      {
        title: 'Move Test Cube 3',
        description: 'Move the orange cube',
        completed: false,
        type: 'move-item',
        targetObjectId: objectId3,
        startPosition: { x: 300, y: 50, z: -100 },
        endPosition: { x: -100, y: 200, z: -300 },
      },
      // Step 7: Info card
      {
        title: 'Almost There',
        description: 'Just a few more steps',
        completed: false,
        type: 'info-card',
        heading: 'Almost Done!',
        bodyText: "You're almost at the end of the test simulation. Great work!",
        buttonText: 'Continue',
        cardColor: 'blue',
      },
      // Step 8: Move item - Cube 1 again (different position)
      {
        title: 'Move Test Cube 1 Again',
        description: 'Move the blue cube to a new position',
        completed: false,
        type: 'move-item',
        targetObjectId: objectId1,
        startPosition: { x: 200, y: 50, z: 200 }, // From previous end position
        endPosition: { x: 0, y: 100, z: 0 },
      },
      // Step 9: Info card
      {
        title: 'Final Step',
        description: 'One last info card',
        completed: false,
        type: 'info-card',
        heading: 'Final Step',
        bodyText:
          'This is the final step of the test simulation. Congratulations on completing it!',
        buttonText: 'Finish',
        cardColor: 'green',
      },
      // Step 10: Move item - Cube 2 again
      {
        title: 'Final Move',
        description: 'Final move step',
        completed: false,
        type: 'move-item',
        targetObjectId: objectId2,
        startPosition: { x: -300, y: 150, z: 300 }, // From previous end position
        endPosition: { x: 400, y: 50, z: -400 },
      },
    ];

    // Find first start positions for each object
    const firstStartPositions: Record<string, { x: number; y: number; z: number }> = {};
    testSteps.forEach((step) => {
      if (step.type === 'move-item' && step.targetObjectId && step.startPosition) {
        // Use a unique key that includes child path if present
        const positionKey = step.targetChildPath
          ? `${step.targetObjectId}/${step.targetChildPath}`
          : step.targetObjectId;
        if (!firstStartPositions[positionKey]) {
          firstStartPositions[positionKey] = step.startPosition;
        }
      }
    });

    // Create test objects at their first start positions
    const testObjects: SceneObject[] = [
      {
        id: objectId1,
        name: 'Test Cube 1',
        type: 'mesh',
        transform: {
          x: firstStartPositions[objectId1]?.x ?? -200,
          y: firstStartPositions[objectId1]?.y ?? 50,
          z: firstStartPositions[objectId1]?.z ?? -200,
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
      },
      {
        id: objectId2,
        name: 'Test Cube 2',
        type: 'mesh',
        transform: {
          x: firstStartPositions[objectId2]?.x ?? 0,
          y: firstStartPositions[objectId2]?.y ?? 50,
          z: firstStartPositions[objectId2]?.z ?? 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: {
          visible: true,
          color: '#10b981',
        },
      },
      {
        id: objectId3,
        name: 'Test Cube 3',
        type: 'mesh',
        transform: {
          x: firstStartPositions[objectId3]?.x ?? 300,
          y: firstStartPositions[objectId3]?.y ?? 50,
          z: firstStartPositions[objectId3]?.z ?? -100,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: {
          visible: true,
          color: '#f59e0b',
        },
      },
    ];

    // Add objects first
    testObjects.forEach((obj, index) => {
      const command = createCreateObjectCommandHelper(
        obj,
        objects.length + index,
        `Create ${obj.name}`
      );
      executeCommand(command);
    });

    // Add all steps
    testSteps.forEach((step, index) => {
      const newStep: SimStep = {
        ...step,
        id: crypto.randomUUID(),
      };
      const command = createCreateStepCommandHelper(
        newStep,
        steps.length + index,
        `Create test step: ${newStep.title}`
      );
      executeCommand(command);
    });

    endBatch();
  }, [objects.length, steps.length, executeCommand, beginBatch, endBatch]);

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
      // IMPORTANT:
      // We intentionally append by using an index beyond the current list length.
      // Relying on `steps.length` here can be stale during rapid multi-step insertion
      // (e.g. SOP imports), which can lead to repeated inserts at the same index and
      // reverse the inserted block.
      const index = Number.MAX_SAFE_INTEGER;
      const command = createCreateStepCommandHelper(
        newStep,
        index,
        `Create step: ${newStep.title}`
      );
      executeCommand(command);
    },
    [executeCommand]
  );

  const handleInsertStep = useCallback(
    (index: number, step?: Omit<SimStep, 'id'>) => {
      const nextStep: Omit<SimStep, 'id'> =
        step ??
        ({
          title: '',
          description: '',
          completed: false,
          type: null,
        } satisfies Omit<SimStep, 'id'>);

      const newStep: SimStep = {
        ...nextStep,
        id: crypto.randomUUID(),
      };

      // Clamp only the lower bound. If index is beyond the current length,
      // the command execution will safely append.
      const clampedIndex = Math.max(0, index);
      const command = createCreateStepCommandHelper(
        newStep,
        clampedIndex,
        `Insert step: ${newStep.title || 'Untitled'}`
      );
      executeCommand(command);
    },
    [executeCommand]
  );

  const handleUpdateStep = useCallback(
    (updated: SimStep) => {
      // Use undoRedoState.steps to get the most up-to-date step (not the local steps state which might be stale)
      const previousStep = undoRedoState.steps.find((step) => step.id === updated.id);
      if (!previousStep) {
        logger.warn('[EditorPage] Cannot update step: not found', updated.id);
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

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const stepToDelete = undoRedoState.steps.find((step) => step.id === stepId);
      if (!stepToDelete) {
        logger.warn('[EditorPage] Cannot delete step: not found', stepId);
        return;
      }

      const index = findStepIndex(undoRedoState.steps, stepId);
      const command = createDeleteStepCommandHelper(
        stepToDelete,
        index,
        `Delete step: ${stepToDelete.title || 'Untitled'}`
      );
      executeCommand(command);
    },
    [undoRedoState.steps, executeCommand]
  );

  const handleReorderSteps = useCallback(
    (previousOrder: string[], newOrder: string[]) => {
      const command = createReorderStepsCommandHelper(previousOrder, newOrder, 'Reorder steps');
      executeCommand(command);
    },
    [executeCommand]
  );

  // ============================================================================
  // Memoized Derived State
  // ============================================================================

  // Parse selection ID to extract parent object ID and optional child path
  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);

  // Get the parent object based on parsed selection
  const selectedObject = useMemo(
    () => objects.find((obj) => obj.id === parsedSelection?.objectId) || null,
    [objects, parsedSelection]
  );

  /**
   * During move-item recording, we want the RightSidebar to edit the *ghost/end transform*,
   * not the actual object (which remains at start transform in the scene).
   *
   * So when recording is active and the selected object matches the recording target,
   * we synthesize a "ghost" SceneObject for the sidebar using:
   * - endPosition/endRotation/endScale if present, otherwise start/current values.
   */
  const selectedObjectForSidebar = useMemo(() => {
    if (!selectedObject) return null;
    if (!recordingPositionForStepId) return selectedObject;

    const recordingStep =
      undoRedoState.steps.find((s) => s.id === recordingPositionForStepId) ||
      steps.find((s) => s.id === recordingPositionForStepId);
    if (!recordingStep?.targetObjectId) return selectedObject;
    if (recordingStep.targetObjectId !== selectedObject.id) return selectedObject;

    // Parent-target editing (ghost = end transform)
    if (!recordingStep.targetChildPath) {
      const startPos = recordingStep.startPosition ?? {
        x: selectedObject.transform.x,
        y: selectedObject.transform.y,
        z: selectedObject.transform.z,
      };
      const ghostPos = recordingStep.endPosition ?? startPos;
      const ghostRot = recordingStep.endRotation ?? {
        x: selectedObject.transform.rotationX,
        y: selectedObject.transform.rotationY,
        z: selectedObject.transform.rotationZ,
      };
      const ghostScale = recordingStep.endScale ?? {
        x: selectedObject.transform.scaleX,
        y: selectedObject.transform.scaleY,
        z: selectedObject.transform.scaleZ,
      };

      return {
        ...selectedObject,
        transform: {
          ...selectedObject.transform,
          x: ghostPos.x,
          y: ghostPos.y,
          z: ghostPos.z,
          rotationX: ghostRot.x,
          rotationY: ghostRot.y,
          rotationZ: ghostRot.z,
          scaleX: ghostScale.x,
          scaleY: ghostScale.y,
          scaleZ: ghostScale.z,
        },
      };
    }

    // Child-target editing: synthesize object with child placed at ghost world position and with end rot/scale.
    const childPath = recordingStep.targetChildPath;
    const implicitStartWorldPos = recordingStep.startPosition ??
      calculateChildWorldPosition(selectedObject, childPath) ?? {
        x: selectedObject.transform.x,
        y: selectedObject.transform.y,
        z: selectedObject.transform.z,
      };
    const ghostWorldPos = recordingStep.endPosition ?? implicitStartWorldPos;

    const withChildPos =
      applyChildWorldPosition(selectedObject, childPath, ghostWorldPos) ?? selectedObject;

    const child = findChildByPathString(selectedObject, childPath);
    if (!child) return withChildPos;

    const ghostRot = recordingStep.endRotation ?? {
      x: child.localTransform.rotationX,
      y: child.localTransform.rotationY,
      z: child.localTransform.rotationZ,
    };
    const ghostScale = recordingStep.endScale ?? {
      x: child.localTransform.scaleX,
      y: child.localTransform.scaleY,
      z: child.localTransform.scaleZ,
    };

    const withChildRotScale =
      recordingStep.endRotation || recordingStep.endScale
        ? (applyChildLocalTransform(withChildPos, childPath, {
            rotationX: ghostRot.x,
            rotationY: ghostRot.y,
            rotationZ: ghostRot.z,
            scaleX: ghostScale.x,
            scaleY: ghostScale.y,
            scaleZ: ghostScale.z,
          }) ?? withChildPos)
        : withChildPos;

    return withChildRotScale;
  }, [selectedObject, recordingPositionForStepId, undoRedoState.steps, steps]);

  // Get the selected child mesh if a child is selected
  const selectedChild = useMemo((): ChildMesh | null => {
    if (
      !selectedObjectForSidebar ||
      !parsedSelection?.childPath ||
      !selectedObjectForSidebar.children
    ) {
      return null;
    }
    // Find the child whose path matches the selected child path
    const childPathArray = stringToPath(parsedSelection.childPath);
    return (
      selectedObjectForSidebar.children.find(
        (child) => child.path.join('.') === childPathArray.join('.')
      ) ?? null
    );
  }, [selectedObjectForSidebar, parsedSelection]);

  const hasSelectedObject = useMemo(() => !!selectedObjectForSidebar, [selectedObjectForSidebar]);

  // Dev-only: performance stats surfaced inside DebugMenu.
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);

  // Keep the editor interactive during background project refreshes.
  if (!isInitialized) {
    return <LoadingScreen message="Opening your studio..." />;
  }

  return (
    <GuidedWorkflowProvider projectId={projectId}>
      <div className="relative h-screen w-full overflow-hidden bg-slate-100 selection:bg-blue-500/30 selection:text-white">
        {/* Background / Workspace Layer */}
        <MainCanvas
          objects={objects}
          selectedObjectId={selectedObjectId}
          onSelectObject={handleSelectObject}
          onUpdateObject={handleUpdateObject}
          onFocusObject={handleFocusObject}
          onCameraControlsReady={handleCameraControlsReady}
          onSceneReady={handleSceneReady}
          onCanvasReady={handleCanvasReady}
          onFirstFrame={handleFirstFrame}
          onPerformanceStats={setPerformanceStats}
          onDragStart={beginBatch}
          onDragEnd={endBatch}
          recordingPositionForStepId={recordingPositionForStepId}
          steps={steps}
          latestRecordingEndPositionRef={latestRecordingEndPositionRef}
        />

        <EntryFadeOverlay
          isEntryFadeVisible={isEntryFadeVisible}
          isEntryFadeFading={isEntryFadeFading}
        />

        <GuidedWorkflowEntry
          isReady={isInitialized}
          isEntryTransitionDone={isEntryTransitionDone}
          isNewProject={
            !!currentProject && currentProject.objects.length === 0 && currentProject.steps.length === 0
          }
          steps={steps}
          onAddStep={handleAddStep}
          onUpdateStep={handleUpdateStep}
          onDeleteStep={handleDeleteStep}
          onReorderSteps={handleReorderSteps}
          onBatchStart={beginBatch}
          onBatchEnd={endBatch}
          objects={objects}
          selectedObjectId={selectedObjectId}
          onUploadAsset={handleUploadAsset}
          uploadProgress={uploadProgress}
          recentAssets={recentAssets}
          starterAssets={starterAssets}
          onAddRecentAsset={handleAddRecentAsset}
          onDeleteObject={handleDeleteObject}
          onFocusObject={handleFocusObject}
          onSelectObject={handleSelectObject}
          onUpdateObject={handleUpdateObject}
          onStartRecordingPosition={handleStartRecordingPosition}
          onStopRecordingPosition={handleStopRecordingPosition}
          recordingPositionForStepId={recordingPositionForStepId ?? undefined}
          latestRecordingEndPositionRef={latestRecordingEndPositionRef}
          onRequestHome={handleRequestHome}
          onPreviewClick={
            projectId
              ? () => {
                  void requestNavigation({ type: 'preview', projectId });
                }
              : undefined
          }
          onPublishClick={handlePublishClick}
          editorChrome={{
            topBar: (
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
                onPreviewClick={
                  projectId
                    ? () => {
                        void requestNavigation({ type: 'preview', projectId });
                      }
                    : undefined
                }
                onPublishClick={handlePublishClick}
                projectId={projectId}
                hasUsableSteps={hasReadySteps}
              />
            ),
            leftSidebar: (
              <LeftSidebar
                ref={leftSidebarRef}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                steps={steps}
                objects={objects}
                onSelectObject={handleSelectObject}
                selectedObjectId={selectedObjectId}
                onFocusObject={handleFocusObject}
                onAddStep={handleAddStep}
                onInsertStep={handleInsertStep}
                onUpdateStep={handleUpdateStep}
                onDeleteStep={handleDeleteStep}
                onReorderSteps={handleReorderSteps}
                onStartRecordingPosition={handleStartRecordingPosition}
                onStopRecordingPosition={handleStopRecordingPosition}
                recordingPositionForStepId={recordingPositionForStepId}
                onUploadAsset={handleUploadAsset}
                uploadProgress={uploadProgress}
                recentAssets={recentAssets}
                starterAssets={starterAssets}
                onAddRecentAsset={handleAddRecentAsset}
                onRemoveAsset={handleRemoveAsset}
              />
            ),
            rightSidebar: selectedObjectForSidebar ? (
              <RightSidebar
                object={selectedObjectForSidebar}
                selectedChild={selectedChild}
                onUpdate={handleUpdateObject}
                onDelete={handleDeleteObject}
                onClose={handleCloseRightSidebar}
                onBatchStart={beginBatch}
                onBatchEnd={endBatch}
                onFocusObject={handleFocusObject}
              />
            ) : null,
            navigationHelp: <NavigationHelp offsetForSidebar={hasSelectedObject} />,
            cameraResetButton: <CameraResetButton cameraControlsRef={cameraControlsRef} />,
            debugMenu: (
              <DebugMenu
                onAddCube={handleAddDebugCube}
                onPopulateTestSteps={handlePopulateTestSteps}
                hasSelectedObject={hasSelectedObject}
                performanceEnabled={import.meta.env.DEV ?? process.env.NODE_ENV === 'development'}
                performanceStats={performanceStats}
              />
            ),
            publishModal: currentProject ? (
              <PublishModal
                project={publishProjectView ?? currentProject}
                isOpen={isPublishModalOpen}
                onClose={handleClosePublishModal}
              />
            ) : null,
          }}
        />

        <RecordingModeOverlayWrapper
          recordingPositionForStepId={recordingPositionForStepId}
          steps={steps}
          objects={objects}
          onStopRecording={handleStopRecordingPosition}
        />

        <SaveOverlayWrapper
          exitOverlay={exitOverlay}
          onStay={handleExitStay}
          onLeaveAnyway={handleExitLeaveAnyway}
        />

        {/* Global Popup - renders centered on screen for errors and notifications */}
        <GlobalPopup />
      </div>
    </GuidedWorkflowProvider>
  );
}

interface GuidedWorkflowEntryProps {
  isReady: boolean;
  isEntryTransitionDone: boolean;
  isNewProject: boolean;
  steps: SimStep[];
  onAddStep: (step: Omit<SimStep, 'id'>) => void;
  onUpdateStep: (step: SimStep) => void;
  onDeleteStep: (stepId: string) => void;
  onReorderSteps: (previousOrder: string[], newOrder: string[]) => void;
  onBatchStart?: () => void;
  onBatchEnd?: () => void;
  objects: SceneObject[];
  selectedObjectId: string | null;
  onUploadAsset: (file: File, textureFiles?: File[]) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  starterAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onDeleteObject?: (objectId: string) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: () => void;
  recordingPositionForStepId?: string | null;
  latestRecordingEndPositionRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
  /** Called when user requests going Home (save-guarded). */
  onRequestHome: () => void;
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
  editorChrome: {
    topBar: JSX.Element;
    leftSidebar: JSX.Element;
    rightSidebar: JSX.Element | null;
    navigationHelp: JSX.Element;
    cameraResetButton: JSX.Element;
    debugMenu: JSX.Element;
    publishModal: JSX.Element | null;
  };
}

function EntryFadeOverlay({
  isEntryFadeVisible,
  isEntryFadeFading,
}: {
  isEntryFadeVisible: boolean;
  isEntryFadeFading: boolean;
}) {
  if (!isEntryFadeVisible) return null;
  return (
    <div
      className={`absolute inset-0 z-40 bg-slate-100 transition-opacity duration-500 ease-out ${
        isEntryFadeFading ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
      }`}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]" />
    </div>
  );
}

function RecordingModeOverlayWrapper({
  recordingPositionForStepId,
  steps,
  objects,
  onStopRecording,
}: {
  recordingPositionForStepId: string | null;
  steps: SimStep[];
  objects: SceneObject[];
  onStopRecording: () => void;
}) {
  if (!recordingPositionForStepId) return null;
  const recordingStep = steps.find((s) => s.id === recordingPositionForStepId) || null;
  const targetObject = (() => {
    const step = steps.find((s) => s.id === recordingPositionForStepId);
    if (!step?.targetObjectId) return null;
    return objects.find((obj) => obj.id === step.targetObjectId) || null;
  })();

  return (
    <RecordingModeOverlay
      recordingStep={recordingStep}
      targetObject={targetObject}
      onStopRecording={onStopRecording}
    />
  );
}

function SaveOverlayWrapper({
  exitOverlay,
  onStay,
  onLeaveAnyway,
}: {
  exitOverlay: { mode: SaveOverlayProps['mode']; errorMessage?: string } | null;
  onStay: () => void;
  onLeaveAnyway: () => void;
}) {
  if (!exitOverlay) return null;
  return (
    <SaveOverlay
      mode={exitOverlay.mode}
      errorMessage={exitOverlay.errorMessage}
      onStay={onStay}
      onLeaveAnyway={onLeaveAnyway}
    />
  );
}

function GuidedWorkflowEntry({
  isReady,
  isEntryTransitionDone,
  isNewProject,
  editorChrome,
  steps,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
  onBatchStart,
  onBatchEnd,
  objects,
  selectedObjectId,
  onUploadAsset,
  uploadProgress,
  recentAssets,
  starterAssets,
  onAddRecentAsset,
  onDeleteObject,
  onFocusObject,
  onSelectObject,
  onUpdateObject,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  latestRecordingEndPositionRef,
  onRequestHome,
  onPreviewClick,
  onPublishClick,
}: GuidedWorkflowEntryProps) {
  const { state, actions } = useGuidedWorkflow();
  const { showWelcome, setShowWelcome, isGuidedUIMode } = useGuidedWelcome({
    isReady,
    isEntryTransitionDone,
    isNewProject,
    state,
    objects,
    onSelectObject,
    onFocusObject,
  });

  return (
    <>
      {!isGuidedUIMode && (
        <>
          {/* Floating UI Layer */}
          {editorChrome.topBar}
          {editorChrome.leftSidebar}
          {editorChrome.rightSidebar}
          {editorChrome.navigationHelp}
          {editorChrome.cameraResetButton}
          {editorChrome.debugMenu}
        </>
      )}

      <WelcomeModal
        isOpen={showWelcome}
        onSelectGuided={() => {
          actions.startWorkflow();
          setShowWelcome(false);
        }}
        onSelectEditor={() => {
          actions.skipToEditor();
          setShowWelcome(false);
        }}
      />
      {state.isActive && (
        <>
          <GuidedWorkflowOverlay
            steps={steps}
            onAddStep={onAddStep}
            onUpdateStep={onUpdateStep}
            onDeleteStep={onDeleteStep}
            onReorderSteps={onReorderSteps}
            onRequestHome={onRequestHome}
            onBatchStart={onBatchStart}
            onBatchEnd={onBatchEnd}
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onStartRecordingPosition={onStartRecordingPosition}
            onStopRecordingPosition={onStopRecordingPosition}
            recordingPositionForStepId={recordingPositionForStepId}
            latestRecordingEndPositionRef={latestRecordingEndPositionRef}
            onUploadAsset={onUploadAsset}
            uploadProgress={uploadProgress}
            recentAssets={recentAssets}
            starterAssets={starterAssets}
            onAddRecentAsset={onAddRecentAsset}
            onDeleteObject={onDeleteObject}
            onFocusObject={onFocusObject}
            onPreviewClick={onPreviewClick}
            onPublishClick={onPublishClick}
          />
          <PhaseIndicator currentPhase={state.currentPhase} />
        </>
      )}
      {editorChrome.publishModal}
    </>
  );
}
