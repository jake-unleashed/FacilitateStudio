import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainCanvas } from '../components/MainCanvas';
import { PreviewStepExecutor } from '../components/preview/PreviewStepExecutor';
import { usePopup } from '../contexts/PopupContext';
import { useProjects } from '../hooks/useProjects';
import { resolvePublishedTokenToProjectId } from '../services/publishService';
import { SceneObject, SimStep } from '../types';
import { applyChildLocalTransform, applyChildWorldPosition } from '../utils/childTransformUtils';
import CameraControlsImpl from 'camera-controls';

/**
 * PublishedSimulationPage - Creator-only published view (MVP).
 *
 * Loads a project by `projectId` from IndexedDB and runs the same preview experience.
 * This works for the creator in their own browser. Phase 2 will load from backend storage.
 */
export function PublishedSimulationPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { showPopup } = usePopup();
  const { getProject, isLoading: isLoadingProjects } = useProjects();

  const projectIdParam = useMemo(() => searchParams.get('projectId'), [searchParams]);
  const tokenParam = useMemo(() => searchParams.get('token'), [searchParams]);
  const resolvedProjectId = useMemo(() => {
    if (projectIdParam) return projectIdParam;
    if (!tokenParam) return null;
    return resolvePublishedTokenToProjectId(tokenParam);
  }, [projectIdParam, tokenParam]);
  const invalidReason = useMemo(() => {
    if (projectIdParam) return null;
    if (!tokenParam) return 'missingProjectId';
    if (!resolvedProjectId) return 'invalidToken';
    return null;
  }, [projectIdParam, tokenParam, resolvedProjectId]);

  // Project state
  const [project, setProject] = useState<{
    objects: SceneObject[];
    steps: SimStep[];
    name: string;
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewObjects, setPreviewObjects] = useState<SceneObject[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [currentPreviewStep, setCurrentPreviewStep] = useState<SimStep | null>(null);
  const [shouldAnimateMoveItem, setShouldAnimateMoveItem] = useState(false);
  const objectClickHandlerRef = useRef<((objectId: string) => void) | null>(null);
  const stepCompleteHandlerRef = useRef<(() => void) | null>(null);

  const cameraControlsRef = useRef<CameraControlsImpl | null>(null);
  const [, setControlsReady] = useState(false);

  // Load project data
  useEffect(() => {
    if (isLoadingProjects || isInitialized) return;

    let isCancelled = false;

    const loadProject = async () => {
      if (!resolvedProjectId) {
        setIsInitialized(true);
        setProject(null);
        return;
      }

      try {
        const loadedProject = await getProject(resolvedProjectId);
        if (isCancelled) {
          return;
        }

        if (loadedProject) {
          setProject({
            objects: loadedProject.objects,
            steps: loadedProject.steps,
            name: loadedProject.name,
          });
          setPreviewObjects(loadedProject.objects.map((obj) => ({ ...obj })));
          setIsInitialized(true);
          return;
        }
      } catch (error) {
        console.error('[PublishedSimulationPage] Failed to load project:', error);
        showPopup({
          type: 'error',
          title: 'Simulation Load Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load this simulation right now. Please try again.',
        });
      }

      // Not found in this browser's storage (expected for non-creator)
      setProject(null);
      setIsInitialized(true);
    };

    void loadProject();

    return () => {
      isCancelled = true;
    };
  }, [resolvedProjectId, getProject, isLoadingProjects, isInitialized, showPopup]);

  // Handle camera controls ready
  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  // Handle object transform updates during animation
  const handleTransformUpdate = useCallback(
    (
      objectId: string,
      update: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
      },
      childPath?: string
    ) => {
      setPreviewObjects((prev) => {
        const obj = prev.find((o) => o.id === objectId);
        if (!obj) return prev;

        if (childPath) {
          // Child target: position is world-space (child), rotation/scale are local (child).
          const updatedForPos = applyChildWorldPosition(obj, childPath, update.position) ?? obj;
          const updatedForRotScale =
            applyChildLocalTransform(updatedForPos, childPath, {
              rotationX: update.rotation.x,
              rotationY: update.rotation.y,
              rotationZ: update.rotation.z,
              scaleX: update.scale.x,
              scaleY: update.scale.y,
              scaleZ: update.scale.z,
            }) ?? updatedForPos;

          return prev.map((o) => (o.id === objectId ? updatedForRotScale : o));
        }

        // Parent target: position/rotation/scale are local (parent transform).
        return prev.map((o) =>
          o.id === objectId
            ? {
                ...o,
                transform: {
                  ...o.transform,
                  x: update.position.x,
                  y: update.position.y,
                  z: update.position.z,
                  rotationX: update.rotation.x,
                  rotationY: update.rotation.y,
                  rotationZ: update.rotation.z,
                  scaleX: update.scale.x,
                  scaleY: update.scale.y,
                  scaleZ: update.scale.z,
                },
              }
            : o
        );
      });
    },
    []
  );

  const handlePreviewComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  const handleRetry = useCallback(() => {
    // Reset to initial state and restart simulation
    if (project) {
      setPreviewObjects(project.objects.map((obj) => ({ ...obj })));
      setIsComplete(false);
      setCurrentPreviewStep(null);
      setShouldAnimateMoveItem(false);
    }
  }, [project]);

  useEffect(() => {
    setShouldAnimateMoveItem(false);
  }, [currentPreviewStep?.id]);

  // Loading
  if (isLoadingProjects || !isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="text-slate-500">Loading published simulation...</div>
      </div>
    );
  }

  // Missing / invalid link
  if (invalidReason === 'missingProjectId') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 px-6 py-8 text-center shadow-2xl backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-bold text-slate-800">Invalid published link</h2>
          <p className="mb-6 text-sm text-slate-600">This link is missing a project ID.</p>
        </div>
      </div>
    );
  }

  if (invalidReason === 'invalidToken') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 px-6 py-8 text-center shadow-2xl backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-bold text-slate-800">Invalid published link</h2>
          <p className="mb-6 text-sm text-slate-600">
            This link is invalid or no longer available in this browser.
          </p>
        </div>
      </div>
    );
  }

  // Not found in storage (expected for non-creator)
  if (!project) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 px-6 py-8 text-center shadow-2xl backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-bold text-slate-800">
            This simulation isn’t available in your browser
          </h2>
          <p className="mb-2 text-sm text-slate-600">
            Published simulations currently only work for the creator in their own browser.
          </p>
          <p className="mb-6 text-sm text-slate-600">Full sharing is coming soon.</p>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="animate-in fade-in relative mx-4 w-full max-w-md overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 px-6 py-8 text-center shadow-2xl backdrop-blur-sm duration-300">
          <div className="mb-4 text-4xl">✓</div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Simulation Complete</h2>
          <p className="mb-6 text-sm text-slate-600">
            You have completed all steps in this training simulation.
          </p>
          <button
            onClick={handleRetry}
            className="rounded-[12px] bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry Simulation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <MainCanvas
        objects={previewObjects}
        selectedObjectId={null}
        onSelectObject={() => {}}
        onUpdateObject={() => {}}
        onCameraControlsReady={handleCameraControlsReady}
        showPerformanceMonitor={false}
        previewMode={true}
        previewStep={currentPreviewStep}
        onPreviewObjectClick={(objectId) => {
          if (objectClickHandlerRef.current) {
            objectClickHandlerRef.current(objectId);
          }
        }}
        shouldAnimateMoveItem={shouldAnimateMoveItem}
        onPreviewTransformUpdate={(update, childPath?: string) => {
          if (currentPreviewStep?.targetObjectId) {
            handleTransformUpdate(currentPreviewStep.targetObjectId, update, childPath);
          }
        }}
        onPreviewStepComplete={() => {
          if (stepCompleteHandlerRef.current) {
            stepCompleteHandlerRef.current();
          }
        }}
      />

      <PreviewStepExecutor
        steps={project.steps}
        objects={previewObjects}
        onComplete={handlePreviewComplete}
        onSetCurrentPreviewStep={setCurrentPreviewStep}
        onObjectClick={() => {
          setShouldAnimateMoveItem(true);
        }}
        onRegisterObjectClickHandler={(handler) => {
          objectClickHandlerRef.current = handler;
        }}
        onRegisterStepCompleteHandler={(handler) => {
          stepCompleteHandlerRef.current = handler;
        }}
      />

      <div className="pointer-events-none fixed bottom-4 right-4 z-30 rounded-full border border-slate-200/60 bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm">
        Powered by Facilitate
      </div>
    </div>
  );
}

