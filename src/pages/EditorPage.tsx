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
import { PublishModal } from '../components/PublishModal';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';
import { calculateIdealCameraPosition, calculateSoftFocus } from '../utils/focusUtils';
import { calculateFocusTargetForObject } from '../utils/focusTargetCalculator';
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
import { Project } from '../types/project';
import { useProjects } from '../hooks/useProjects';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
import { useModelUpload } from '../hooks/useModelUpload';
import { captureThumbnail } from '../utils/captureThumbnail';
import { PopupProvider, usePopup, createErrorPopup } from '../contexts/PopupContext';
import { GlobalPopup } from '../components/GlobalPopup';
import { useUndoRedo } from '../hooks/useUndoRedo';
import {
  calculateChildWorldPosition,
  applyChildLocalTransform,
  applyChildWorldPosition,
  findChildByPathString,
} from '../utils/childTransformUtils';
import * as THREE from 'three';
import { AssetMetadata } from '../types/model';
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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

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

  // Ref to track latest endPosition during drag (updated synchronously to avoid race conditions)
  const latestRecordingEndPositionRef = useRef<{
    stepId: string;
    endPosition: { x: number; y: number; z: number } | null;
    endRotation?: { x: number; y: number; z: number };
    endScale?: { x: number; y: number; z: number };
  } | null>(null);

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
    uploadFile,
    addRecentAssetToScene,
    removeAsset,
    lastError: uploadLastError,
    clearError: clearUploadError,
  } = useModelUpload();

  // Global popup hook for displaying errors and notifications
  const { showPopup } = usePopup();

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

  const currentProjectId = currentProject?.id ?? null;

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
  }, [currentProjectId]);

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

  const handlePublishClick = useCallback(async () => {
    if (!currentProject) return;
    try {
      // Ensure the project is persisted before generating a link that loads from IndexedDB.
      await flushSave({ includeThumbnail: true, thumbnailTimeoutMs: 600 });
      setIsPublishModalOpen(true);
    } catch (err) {
      console.error('[EditorPage] Failed to save before publishing:', err);
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      showPopup(createErrorPopup('Publish failed', message));
    }
  }, [currentProject, flushSave, showPopup]);

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

  const handleSelectObject = useCallback((id: string | null) => {
    setSelectedObjectId(id);
    // Note: We no longer auto-switch panels when selecting an object.
    // Users can manually switch to the Objects tab if they want to see the hierarchy.
    // This allows users to stay on the Add panel when adding multiple objects.
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
      const focusTarget = await calculateFocusTargetForObject({ object, childPath });
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
        handleSelectObject(result.sceneObject.id);
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
        handleSelectObject(result.sceneObject.id);
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

      const clampedIndex = Math.max(0, Math.min(index, steps.length));
      const command = createCreateStepCommandHelper(
        newStep,
        clampedIndex,
        `Insert step: ${newStep.title || 'Untitled'}`
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

  // Recording handlers for move-item step end position
  const handleStartRecordingPosition = useCallback(
    (stepId: string) => {
      setRecordingPositionForStepId(stepId);

      // Clear the ref when starting a new recording session
      latestRecordingEndPositionRef.current = null;

      // Auto-select the target object so the transform gizmo appears immediately
      // Read from undoRedoState.steps to get the most up-to-date step
      const recordingStep =
        undoRedoState.steps.find((s) => s.id === stepId) || steps.find((s) => s.id === stepId);
      if (recordingStep?.targetObjectId) {
        // Clear endPosition when starting a new recording session so ghost starts at startPosition
        // Store the initial step state AFTER clearing (this is what we'll compare against when stopping)
        let initialStepForCommand = { ...recordingStep };

        // Start batch FIRST so the initial state is captured before we clear endPosition
        // This ensures the batch system has the correct initial state
        beginBatch();

        const hasExistingEndTransform =
          !!recordingStep.endPosition || !!recordingStep.endRotation || !!recordingStep.endScale;
        if (hasExistingEndTransform) {
          // Clear end transform fields and store the cleared version as initial state
          initialStepForCommand = {
            ...recordingStep,
            endPosition: undefined,
            endRotation: undefined,
            endScale: undefined,
          };

          // Clear via a command so it's part of the batch
          const clearedStep: SimStep = {
            ...recordingStep,
            endPosition: undefined,
            endRotation: undefined,
            endScale: undefined,
          };

          const clearCommand = createUpdateStepCommandHelper(
            clearedStep.id,
            recordingStep, // previousState: with end transform
            clearedStep, // newState: cleared
            `Clear end transform for recording: ${clearedStep.title || 'Untitled'}`
          );
          executeCommand(clearCommand);
        }

        // Store the initial step state for undo command creation (after clearing endPosition)
        // This is what we'll use as previousState when creating the final command
        recordingInitialStepRef.current = initialStepForCommand;

        // If target is a child, create compound selection ID
        if (recordingStep.targetChildPath) {
          handleSelectObject(`${recordingStep.targetObjectId}/${recordingStep.targetChildPath}`);
        } else {
          handleSelectObject(recordingStep.targetObjectId);
        }
      }
    },
    [beginBatch, steps, handleSelectObject, undoRedoState.steps, executeCommand]
    // Note: createUpdateStepCommandHelper is a stable outer scope function, not a dependency
  );

  // Track the initial step state when recording starts (for creating undo command)
  const recordingInitialStepRef = useRef<SimStep | null>(null);

  const handleStopRecordingPosition = useCallback(() => {
    // Create a command for the step's endPosition change so it's part of the batch
    if (recordingPositionForStepId && recordingInitialStepRef.current) {
      // Get the latest endPosition from the ref (updated synchronously during drag)
      // This is the most reliable source since it's updated immediately during drag
      const latestEndPos =
        latestRecordingEndPositionRef.current?.stepId === recordingPositionForStepId
          ? latestRecordingEndPositionRef.current.endPosition
          : null;
      const latestEndRot =
        latestRecordingEndPositionRef.current?.stepId === recordingPositionForStepId
          ? latestRecordingEndPositionRef.current.endRotation
          : undefined;
      const latestEndScale =
        latestRecordingEndPositionRef.current?.stepId === recordingPositionForStepId
          ? latestRecordingEndPositionRef.current.endScale
          : undefined;

      // Read from undoRedoState.steps directly (most up-to-date) instead of local steps state
      // The local steps state is synced via useEffect which is async, so it might be stale
      const currentStep = undoRedoState.steps.find((s) => s.id === recordingPositionForStepId);

      if (currentStep && recordingInitialStepRef.current) {
        // CRITICAL: Always prioritize ref value (latestEndPos) - it's updated synchronously during drag
        // The ref is the source of truth. If it exists, the user definitely dragged the object.
        // currentStep.endPosition might be stale due to async state updates.
        // IMPORTANT: If latestEndPos exists, we MUST use it - the user dragged the object
        const endPosToSave = latestEndPos || currentStep.endPosition;
        const endRotToSave = latestEndRot ?? currentStep.endRotation;
        const endScaleToSave = latestEndScale ?? currentStep.endScale;

        // Note: We intentionally avoid per-interaction debug logging here in production.

        // CRITICAL: If latestEndPos exists, we MUST save it - the user dragged the object
        // Always create command if we have an endPosition to save
        // The ref value (latestEndPos) is the source of truth - if it exists, user dragged the object
        // We MUST create the command to persist the endPosition in the undo/redo system
        // The command will update from the initial state (no endPosition) to the final state (with endPosition)
        if (endPosToSave || endRotToSave || endScaleToSave) {
          // CRITICAL: Always use endPosToSave (prioritizing latestEndPos from ref)
          // Create updated step with the endPosition - create a completely new object to avoid reference issues
          // IMPORTANT: Spread ALL properties from currentStep to ensure we don't lose any step data
          const updatedStep: SimStep = {
            ...currentStep,
            endPosition: endPosToSave
              ? {
                  x: endPosToSave.x,
                  y: endPosToSave.y,
                  z: endPosToSave.z,
                }
              : currentStep.startPosition
                ? { ...currentStep.startPosition }
                : currentStep.endPosition,
            endRotation: endRotToSave ? { ...endRotToSave } : currentStep.endRotation,
            endScale: endScaleToSave ? { ...endScaleToSave } : currentStep.endScale,
          };

          // If endPosition is missing, something is inconsistent; bail out safely.
          if (!updatedStep.endPosition) return;

          // CRITICAL: The command's previousState must be the state from when recording STARTED
          // (after clearing endPosition). The newState is the state with the endPosition.
          // When the command executes during batching, it will update the step in the state.
          // Even though we've already updated the state via setUndoRedoState, the command ensures
          // the change is persisted in the undo/redo system and won't be lost.

          // CRITICAL: Ensure updatedStep has ALL properties from currentStep, not just endPosition
          // This prevents losing other step properties when the command executes
          const stepCommand = createUpdateStepCommandHelper(
            updatedStep.id,
            recordingInitialStepRef.current, // previousState: no endPosition (after clearing at start)
            updatedStep, // newState: with endPosition (from drag) - MUST have endPosition set
            `Set end transform: ${updatedStep.title || 'Untitled'}`
          );

          // Execute the command - this will update the state during batching
          // The batch system will then commit it when endBatch() is called
          executeCommand(stepCommand);
        } else {
          // No endPosition recorded; nothing to persist.
        }
      } else {
        // Missing currentStep or initial ref; nothing to persist.
      }
      recordingInitialStepRef.current = null;
    }

    // Clear the ref when recording stops
    latestRecordingEndPositionRef.current = null;

    // Restore the actual object to its start position if it was moved during recording
    // Read from undoRedoState.steps to get the most up-to-date step (after command execution)
    // NOTE: The state might be stale here due to async updates, but the command should have
    // updated currentStateRef.current which will be used when the batch commits
    if (recordingPositionForStepId) {
      const recordingStep =
        undoRedoState.steps.find((s) => s.id === recordingPositionForStepId) ||
        steps.find((s) => s.id === recordingPositionForStepId);
      if (recordingStep?.targetObjectId && recordingStep.startPosition) {
        const targetObject = objects.find((obj) => obj.id === recordingStep.targetObjectId);
        if (targetObject) {
          if (recordingStep.targetChildPath) {
            // Target is a child mesh - restore child's world position
            const currentChildWorldPos = calculateChildWorldPosition(
              targetObject,
              recordingStep.targetChildPath
            );
            const isAtStartPosition =
              currentChildWorldPos &&
              currentChildWorldPos.x === recordingStep.startPosition.x &&
              currentChildWorldPos.y === recordingStep.startPosition.y &&
              currentChildWorldPos.z === recordingStep.startPosition.z;

            if (!isAtStartPosition) {
              const restoredObject = applyChildWorldPosition(
                targetObject,
                recordingStep.targetChildPath,
                recordingStep.startPosition
              );
              if (restoredObject) {
                const previousObject = objects.find((obj) => obj.id === restoredObject.id);
                if (previousObject) {
                  const command = createUpdateObjectCommandHelper(
                    restoredObject.id,
                    previousObject,
                    restoredObject,
                    `Restore ${targetObject.name} / ${findChildByPathString(targetObject, recordingStep.targetChildPath)?.name || 'child'} to start position`
                  );
                  executeCommand(command);
                }
              }
            }
          } else {
            // Target is parent object - restore parent transform
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
    }
    // CRITICAL: Clear recording state BEFORE ending batch to ensure batch commits correctly
    setRecordingPositionForStepId(null);
    // End batch AFTER clearing state - this ensures the batch command has the correct final state
    endBatch();
  }, [endBatch, recordingPositionForStepId, undoRedoState.steps, steps, objects, executeCommand]);

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
        onSceneReady={handleSceneReady}
        onCanvasReady={handleCanvasReady}
        onDragStart={beginBatch}
        onDragEnd={endBatch}
        recordingPositionForStepId={recordingPositionForStepId}
        steps={steps}
        latestRecordingEndPositionRef={latestRecordingEndPositionRef}
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
        onPublishClick={handlePublishClick}
        projectId={projectId}
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
        onAddRecentAsset={handleAddRecentAsset}
        onRemoveAsset={handleRemoveAsset}
      />

      {selectedObjectForSidebar && (
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

      <DebugMenu
        onAddCube={handleAddDebugCube}
        onPopulateTestSteps={handlePopulateTestSteps}
        hasSelectedObject={hasSelectedObject}
      />

      {exitOverlay && (
        <SaveOverlay
          mode={exitOverlay.mode}
          errorMessage={exitOverlay.errorMessage}
          onStay={handleExitStay}
          onLeaveAnyway={handleExitLeaveAnyway}
        />
      )}

      {currentProject && (
        <PublishModal
          project={currentProject}
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
        />
      )}

      {/* Global Popup - renders centered on screen for errors and notifications */}
      <GlobalPopup />
    </div>
  );
}
