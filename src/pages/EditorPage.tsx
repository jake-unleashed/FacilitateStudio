import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { LeftSidebar, type LeftSidebarHandle } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { MainCanvas } from '../components/MainCanvas';
import { NavigationHelp } from '../components/NavigationHelp';
import { DebugMenu } from '../components/DebugMenu';
import { CameraResetButton } from '../components/CameraResetButton';
import { SaveOverlay } from '../components/SaveOverlay';
import { RecordingModeOverlay } from '../components/RecordingModeOverlay';
import { PublishModal } from '../components/PublishModal';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { GuidedWorkflowOverlay, WelcomeModal } from '../components/guidedWorkflow';
import { PhaseIndicator } from '../components/guidedWorkflow/PhaseIndicator';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';
import { calculateIdealCameraPosition, calculateSoftFocus } from '../utils/focusUtils';
import { calculateFocusTargetForObject } from '../utils/focusTargetCalculator';
import { hasUsableSteps } from '../utils/stepValidation';
import {
  calculateOcclusionAwareFocusCamera,
  calculateQuickFocusCamera,
  MIN_FOCUS_CAMERA_Y,
} from '../utils/focusCameraOcclusion';
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
import { PopupProvider, usePopup } from '../contexts/PopupContext';
import { GuidedWorkflowProvider } from '../contexts/GuidedWorkflowContext';
import { GlobalPopup } from '../components/GlobalPopup';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useEditorProjectLifecycle } from '../hooks/editor/useEditorProjectLifecycle';
import { useEditorNavigationGuards } from '../hooks/editor/useEditorNavigationGuards';
import { useRecordingEndTransform } from '../hooks/editor/useRecordingEndTransform';
import type { LatestRecordingEndTransformRefValue } from '../hooks/editor/useRecordingEndTransform';
import { useGuidedWorkflow } from '../hooks/useGuidedWorkflow';
import type { PerformanceStats } from '../components/PerformanceMonitor';
import {
  calculateChildWorldPosition,
  applyChildLocalTransform,
  applyChildWorldPosition,
  findChildByPathString,
} from '../utils/childTransformUtils';
import * as THREE from 'three';
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
import { UpdateObjectCommand, UndoRedoCommand } from '../hooks/undoRedo/types';
import '../types/testHooks'; // Import for global type augmentation
import CameraControlsImpl from 'camera-controls';

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
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [isEntryFadeVisible, setIsEntryFadeVisible] = useState(false);
  const [isEntryFadeFading, setIsEntryFadeFading] = useState(false);
  const [isEntryTransitionDone, setIsEntryTransitionDone] = useState(true);
  const entryFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryFadeStartedAtRef = useRef<number | null>(null);
  const entryFadeCompletedRef = useRef(false);
  // Recording state for move-item step end position
  // recordingPositionForStepId is owned by useRecordingEndTransform (below)

  const handleSelectObject = useCallback((id: string | null) => {
    // During guided model upload, avoid selection so users don’t accidentally
    // enter object manipulation modes before we introduce them.
    const guidedPhase =
      typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
    // Always allow clearing selection (used when entering phases like model-upload).
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
    // Note: We no longer auto-switch panels when selecting an object.
    // Users can manually switch to the Objects tab if they want to see the hierarchy.
    // This allows users to stay on the Add panel when adding multiple objects.
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
      console.error('[EditorPage] Failed to initialize project:', error);
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
  // Keep a ref to the Three.js scene for occlusion-aware focus raycasts.
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Force re-render when controls become available
  const [, setControlsReady] = useState(false);

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

  // Show popup when upload error occurs
  useEffect(() => {
    if (uploadLastError) {
      showPopup({
        type: 'error',
        title: 'Upload Failed',
        message: uploadLastError,
      });
      // Clear the error from the hook so it doesn't show again if component re-renders
      clearUploadError();
    }
  }, [uploadLastError, showPopup, clearUploadError]);

  // Surface persistence errors that happen outside explicit load/save flows.
  useEffect(() => {
    if (!projectsError) return;
    showPopup({
      type: 'error',
      title: 'Cloud Sync Failed',
      message: projectsError,
    });
    clearProjectsError();
  }, [projectsError, showPopup, clearProjectsError]);

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

  // Establish baseline AFTER initial state load so autosave knows what "saved" means
  useEffect(() => {
    if (!isInitialized || !currentProjectId) return;
    if (hasHydratedRef.current) return;
    // Wait until local state has synced to undo/redo state, otherwise baseline may capture stale defaults
    // and trigger an unnecessary autosave during initial hydration.
    if (
      undoRedoState.objects !== objects ||
      undoRedoState.steps !== steps ||
      undoRedoState.simulationTitle !== simulationTitle
    ) {
      return;
    }
    hasHydratedRef.current = true;
    setBaseline();
  }, [
    currentProjectId,
    isInitialized,
    setBaseline,
    undoRedoState.objects,
    undoRedoState.steps,
    undoRedoState.simulationTitle,
    objects,
    steps,
    simulationTitle,
  ]);

  // Reset hydration when project changes
  useEffect(() => {
    hasHydratedRef.current = false;
    setHasFirstFrame(false);
    entryFadeCompletedRef.current = false;
    entryFadeStartedAtRef.current = null;
    setIsEntryFadeVisible(false);
    setIsEntryFadeFading(false);
    setIsEntryTransitionDone(true);
    if (entryFadeTimerRef.current) {
      clearTimeout(entryFadeTimerRef.current);
      entryFadeTimerRef.current = null;
    }
  }, [currentProjectId]);

  // ============================================================================
  // Memoized Callbacks - Stable references for child components
  // ============================================================================

  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  const handleSceneReady = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene;
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleFirstFrame = useCallback(() => {
    setHasFirstFrame(true);
  }, []);

  // Entry fade overlay: masks WebGL/scene initialization flashes, then dissolves away.
  useEffect(() => {
    const isNewProject =
      !!currentProject && currentProject.objects.length === 0 && currentProject.steps.length === 0;
    if (!isInitialized || !isNewProject) {
      setIsEntryFadeVisible(false);
      setIsEntryFadeFading(false);
      setIsEntryTransitionDone(true);
      entryFadeCompletedRef.current = false;
      return;
    }

    if (entryFadeCompletedRef.current) return;

    // Show immediately on new projects once initialized.
    if (!isEntryFadeVisible) {
      setIsEntryFadeVisible(true);
      setIsEntryFadeFading(false);
      setIsEntryTransitionDone(false);
      entryFadeStartedAtRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    if (!hasFirstFrame) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion: don't linger or animate; just ensure the overlay is gone.
    if (prefersReducedMotion) {
      setIsEntryFadeVisible(false);
      setIsEntryFadeFading(false);
      setIsEntryTransitionDone(true);
      entryFadeCompletedRef.current = true;
      if (entryFadeTimerRef.current) {
        clearTimeout(entryFadeTimerRef.current);
        entryFadeTimerRef.current = null;
      }
      return;
    }

    const minVisibleMs = prefersReducedMotion ? 0 : 200;
    const fadeMs = prefersReducedMotion ? 0 : 380;
    const startedAt =
      entryFadeStartedAtRef.current ??
      (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = Math.max(0, now - startedAt);
    const remaining = Math.max(0, minVisibleMs - elapsed);

    if (entryFadeTimerRef.current) {
      clearTimeout(entryFadeTimerRef.current);
      entryFadeTimerRef.current = null;
    }

    entryFadeTimerRef.current = setTimeout(() => {
      setIsEntryFadeFading(true);
      entryFadeTimerRef.current = setTimeout(() => {
        setIsEntryFadeVisible(false);
        setIsEntryFadeFading(false);
        setIsEntryTransitionDone(true);
        entryFadeCompletedRef.current = true;
        entryFadeTimerRef.current = null;
      }, fadeMs);
    }, remaining);
  }, [currentProject, hasFirstFrame, isEntryFadeVisible, isInitialized]);

  useEffect(() => {
    return () => {
      if (entryFadeTimerRef.current) clearTimeout(entryFadeTimerRef.current);
    };
  }, []);

  /**
   * Focus camera on a scene object or its child.
   *
   * Two focus modes are supported:
   * - 'full': Move camera directly to ideal framing position (F key, sidebar clicks)
   * - 'soft': Adaptive focus - zooms proportionally based on distance from ideal.
   *           Always updates orbit center. Zooms out if too close, in if too far.
   *
   * @param object - The scene object to focus on
   * @param childPath - Optional path to a child mesh within the object
   * @param focusMode - 'full' for immediate framing, 'soft' for adaptive zoom
   */
  const handleFocusObject = useCallback(
    async (object: SceneObject, childPath?: string, focusMode: FocusMode = 'full') => {
      const controls = cameraControlsRef.current;
      if (!controls) return;
      const guidedPhase =
        typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
      const resolvedChildPath =
        guidedPhase === 'model-positioning' && childPath ? undefined : childPath;

      const clampY = (pos: THREE.Vector3): THREE.Vector3 => {
        if (pos.y < MIN_FOCUS_CAMERA_Y) pos.y = MIN_FOCUS_CAMERA_Y;
        return pos;
      };

      const bumpCameraAboveGroundIfNeeded = (target: {
        x: number;
        y: number;
        z: number;
      }): boolean => {
        const cur = new THREE.Vector3();
        controls.getPosition(cur);
        if (cur.y < MIN_FOCUS_CAMERA_Y) {
          controls.setLookAt(cur.x, MIN_FOCUS_CAMERA_Y, cur.z, target.x, target.y, target.z, true);
          return true;
        }
        return false;
      };

      // Capture current camera position so occlusion selection can prefer the current view direction.
      const currentPos = new THREE.Vector3();
      controls.getPosition(currentPos);

      // Calculate focus target (orbit center and bounds size)
      const focusTarget = await calculateFocusTargetForObject({
        object,
        childPath: resolvedChildPath,
      });
      const focusTargetVec = { x: focusTarget.targetX, y: focusTarget.targetY, z: focusTarget.targetZ };

      // Prefer occlusion-aware camera positioning if we have a scene reference.
      const scene = sceneRef.current;
      if (!scene) {
        // Fallback: legacy focus behavior
        const ideal = calculateIdealCameraPosition(focusTarget);
        const idealPos = clampY(new THREE.Vector3(ideal.x, ideal.y, ideal.z));
        if (focusMode === 'full') {
          controls.setLookAt(
            idealPos.x,
            idealPos.y,
            idealPos.z,
            focusTargetVec.x,
            focusTargetVec.y,
            focusTargetVec.z,
            true
          );
        } else {
          const cur = new THREE.Vector3();
          controls.getPosition(cur);
          const soft = calculateSoftFocus(cur, focusTarget, { ...ideal, y: idealPos.y });
          if (soft.shouldMoveCamera && soft.newCameraPosition) {
            clampY(soft.newCameraPosition);
            controls.setLookAt(
              soft.newCameraPosition.x,
              soft.newCameraPosition.y,
              soft.newCameraPosition.z,
              focusTargetVec.x,
              focusTargetVec.y,
              focusTargetVec.z,
              true
            );
          } else {
            // Even if we don't “need” to move for soft focus, never leave the camera underground.
            if (!bumpCameraAboveGroundIfNeeded(focusTargetVec)) {
              controls.setTarget(focusTargetVec.x, focusTargetVec.y, focusTargetVec.z, true);
            }
          }
        }
        return;
      }

      // Fast path: test the “obvious” view (current direction at ideal distance).
      // If it’s clear enough, skip the expensive multi-candidate occlusion scoring.
      const quick = calculateQuickFocusCamera({
        target: focusTarget,
        scene,
        targetObjectId: object.id,
        targetChildPath: childPath,
        currentCameraPosition: currentPos,
      });

      if (quick.shouldUseFastPath && quick.position) {
        clampY(quick.position);
        const idealCamera = {
          x: quick.position.x,
          y: quick.position.y,
          z: quick.position.z,
          distance: quick.position.distanceTo(
            new THREE.Vector3(focusTarget.targetX, focusTarget.targetY, focusTarget.targetZ)
          ),
        };

        if (focusMode === 'full') {
          controls.setLookAt(
            idealCamera.x,
            idealCamera.y,
            idealCamera.z,
            focusTargetVec.x,
            focusTargetVec.y,
            focusTargetVec.z,
            true
          );
          return;
        }

        const latestPos = new THREE.Vector3();
        controls.getPosition(latestPos);
        const soft = calculateSoftFocus(latestPos, focusTarget, idealCamera);

        if (soft.shouldMoveCamera && soft.newCameraPosition) {
          clampY(soft.newCameraPosition);
          controls.setLookAt(
            soft.newCameraPosition.x,
            soft.newCameraPosition.y,
            soft.newCameraPosition.z,
            focusTargetVec.x,
            focusTargetVec.y,
            focusTargetVec.z,
            true
          );
        } else {
          // Even if we don't “need” to move for soft focus, never leave the camera underground.
          if (!bumpCameraAboveGroundIfNeeded(focusTargetVec)) {
            controls.setTarget(focusTargetVec.x, focusTargetVec.y, focusTargetVec.z, true);
          }
        }

        return;
      }

      // Single-decision feel: compute the best camera view synchronously (fast path),
      // then do ONE camera move.
      const refined = calculateOcclusionAwareFocusCamera({
        target: focusTarget,
        scene,
        targetObjectId: object.id,
        targetChildPath: childPath,
        currentCameraPosition: currentPos,
        // Editor mode: balanced preference toward minimal camera movement.
        sampleCount: 8,
        azimuthBiasStrength: 0.6,
        verticalTiers: { enabled: true, sampleCountPerTier: 6 },
        breathingRoom: {
          enabled: true,
          mode: 'strict',
          // Relaxed threshold to avoid big camera swings in editor mode.
          minClearFraction: 0.8,
          // Avoid backing off distance in editor mode (reduces candidates & motion).
          distanceMultipliers: [1],
          sampleRadiusScale: 0.34,
          sampleMinRadius: 0.12,
          includeDiagonalSamples: false,
          minVisibilityWeight: 1.5,
        },
      });

      const idealCamera = {
        x: refined.position.x,
        y: Math.max(refined.position.y, MIN_FOCUS_CAMERA_Y),
        z: refined.position.z,
        distance: refined.position.distanceTo(
          new THREE.Vector3(focusTarget.targetX, focusTarget.targetY, focusTarget.targetZ)
        ),
      };

      if (focusMode === 'full') {
        controls.setLookAt(
          idealCamera.x,
          idealCamera.y,
          idealCamera.z,
          focusTargetVec.x,
          focusTargetVec.y,
          focusTargetVec.z,
          true
        );
        return;
      }

      // Soft focus: decide once, after we know the best viewpoint.
      const latestPos = new THREE.Vector3();
      controls.getPosition(latestPos);
      const soft = calculateSoftFocus(latestPos, focusTarget, idealCamera);

      if (refined.wasOccluded) {
        // If the current view is occluded, rotate to the chosen clear view even if inside comfort zone.
        controls.setLookAt(
          idealCamera.x,
          idealCamera.y,
          idealCamera.z,
          focusTargetVec.x,
          focusTargetVec.y,
          focusTargetVec.z,
          true
        );
        return;
      }

      if (soft.shouldMoveCamera && soft.newCameraPosition) {
        clampY(soft.newCameraPosition);
        controls.setLookAt(
          soft.newCameraPosition.x,
          soft.newCameraPosition.y,
          soft.newCameraPosition.z,
          focusTargetVec.x,
          focusTargetVec.y,
          focusTargetVec.z,
          true
        );
      } else {
        // Even if we don't “need” to move for soft focus, never leave the camera underground.
        if (!bumpCameraAboveGroundIfNeeded(focusTargetVec)) {
          controls.setTarget(focusTargetVec.x, focusTargetVec.y, focusTargetVec.z, true);
        }
      }
    },
    []
  );

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
              console.warn(
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

  // Handle asset upload - uses the useModelUpload hook for storage and preprocessing
  const handleUploadAsset = useCallback(
    async (file: File) => {
      const result = await uploadFile(file, objects);
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
        console.error('[EditorPage] Failed to add recent asset:', asset.id);
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

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const stepToDelete = undoRedoState.steps.find((step) => step.id === stepId);
      if (!stepToDelete) {
        console.warn('[EditorPage] Cannot delete step: not found', stepId);
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

        {isEntryFadeVisible && (
          <div
            className={`pointer-events-auto absolute inset-0 z-40 bg-slate-100 transition-opacity duration-500 ease-out ${
              isEntryFadeFading ? 'opacity-0' : 'opacity-100'
            }`}
            aria-hidden="true"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]" />
          </div>
        )}

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
          recordingPositionForStepId={recordingPositionForStepId}
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

        {exitOverlay && (
          <SaveOverlay
            mode={exitOverlay.mode}
            errorMessage={exitOverlay.errorMessage}
            onStay={handleExitStay}
            onLeaveAnyway={handleExitLeaveAnyway}
          />
        )}

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
  onUploadAsset: (file: File) => Promise<void>;
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
  const [showWelcome, setShowWelcome] = useState(false);
  const hasAutoSelectedPositioningRef = useRef(false);
  const welcomeOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isReady) return;
    const shouldOfferWelcome =
      isNewProject && !state.isActive && !state.hasDismissedWelcome;
    if (!shouldOfferWelcome) {
      setShowWelcome(false);
      if (welcomeOpenTimeoutRef.current) {
        clearTimeout(welcomeOpenTimeoutRef.current);
        welcomeOpenTimeoutRef.current = null;
      }
      return;
    }

    // Wait until the entry fade has dissolved away, then add breathing room.
    if (!isEntryTransitionDone) return;
    if (showWelcome) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const delayMs = prefersReducedMotion ? 0 : 250;

    if (welcomeOpenTimeoutRef.current) {
      clearTimeout(welcomeOpenTimeoutRef.current);
      welcomeOpenTimeoutRef.current = null;
    }

    welcomeOpenTimeoutRef.current = setTimeout(() => {
      setShowWelcome(true);
      welcomeOpenTimeoutRef.current = null;
    }, delayMs);
  }, [
    isEntryTransitionDone,
    isNewProject,
    isReady,
    showWelcome,
    state.hasDismissedWelcome,
    state.isActive,
  ]);

  useEffect(() => {
    return () => {
      if (welcomeOpenTimeoutRef.current) clearTimeout(welcomeOpenTimeoutRef.current);
    };
  }, []);

  const shouldOfferWelcome =
    isNewProject && !state.isActive && !state.hasDismissedWelcome;
  const isGuidedUIMode = state.isActive || showWelcome || shouldOfferWelcome;
  const shouldLockNavigation =
    shouldOfferWelcome || (state.isActive && state.currentPhase === 'step-creation');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (shouldLockNavigation) {
      document.body.dataset.guidedNavLock = 'true';
    } else {
      delete document.body.dataset.guidedNavLock;
    }
  }, [shouldLockNavigation]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (state.isActive) {
      document.body.dataset.guidedPhase = state.currentPhase;
    } else {
      delete document.body.dataset.guidedPhase;
    }
    return () => {
      delete document.body.dataset.guidedPhase;
    };
  }, [state.currentPhase, state.isActive]);

  useEffect(() => {
    if (!state.isActive) return;
    if (state.currentPhase !== 'model-upload') return;
    // Ensure nothing is selected during model upload.
    onSelectObject(null);
  }, [onSelectObject, state.currentPhase, state.isActive]);

  useEffect(() => {
    if (!state.isActive || state.currentPhase !== 'model-positioning') {
      hasAutoSelectedPositioningRef.current = false;
      return;
    }

    if (hasAutoSelectedPositioningRef.current) return;

    const meshObjects = objects.filter((object) => object.type === 'mesh');
    if (meshObjects.length !== 1) return;

    // Gentle first-time experience: if there’s only one model, select + focus it automatically
    // so users immediately see the gizmo.
    hasAutoSelectedPositioningRef.current = true;
    onSelectObject(meshObjects[0].id);
    onFocusObject?.(meshObjects[0], undefined, 'full');
  }, [objects, onFocusObject, onSelectObject, state.currentPhase, state.isActive]);

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
