import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainCanvas } from '../components/MainCanvas';
import { PreviewStepExecutor } from '../components/preview/PreviewStepExecutor';
import { PreviewSettingsPanel } from '../components/preview/PreviewSettingsPanel';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { usePopup } from '../contexts/PopupContext';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
import { useProjects } from '../hooks/useProjects';
import type { Project } from '../types/project';
import { SceneObject, SimStep } from '../types';
import { DEFAULT_SIMULATION_SETTINGS, toSimulationSettings, type SimulationSettings } from '../types/simulationSettings';
import { applyChildLocalTransform, applyChildWorldPosition } from '../utils/childTransformUtils';
import CameraControlsImpl from 'camera-controls';
import { logger } from '../utils/logger';

/**
 * PreviewPage - Full-screen preview mode for experiencing the training simulation.
 *
 * Executes steps sequentially, displaying info cards and animating object movements
 * with automatic camera positioning.
 */
export function PreviewPage() {
  const { id: projectId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const { getProject, saveProject, isLoading: isLoadingProjects } = useProjects();

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewObjects, setPreviewObjects] = useState<SceneObject[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [currentPreviewStep, setCurrentPreviewStep] = useState<SimStep | null>(null);
  const [shouldAnimateMoveItem, setShouldAnimateMoveItem] = useState(false);
  const [previewSettings, setPreviewSettings] = useState<SimulationSettings>(
    DEFAULT_SIMULATION_SETTINGS
  );
  const objectClickHandlerRef = useRef<((objectId: string) => void) | null>(null);
  const wrongObjectClickHandlerRef = useRef<((objectId: string) => void) | null>(null);
  const stepCompleteHandlerRef = useRef<(() => void) | null>(null);
  const hasSettingsBaselineRef = useRef(false);

  const cameraControlsRef = useRef<CameraControlsImpl | null>(null);
  const [, setControlsReady] = useState(false);

  const { setBaseline, flushSave } = useProjectAutoSave({
    project,
    name: project?.name ?? '',
    objects: project?.objects ?? [],
    steps: project?.steps ?? [],
    simulationSettings: previewSettings,
    saveProject,
    debounceMs: 500,
  });

  useEffect(() => {
    if (!isInitialized || !project || hasSettingsBaselineRef.current) return;
    setBaseline();
    hasSettingsBaselineRef.current = true;
  }, [isInitialized, project, setBaseline]);

  // Load project data
  useEffect(() => {
    if (isLoadingProjects || isInitialized) return;

    let isCancelled = false;

    const loadProject = async () => {
      if (projectId) {
        try {
          const loadedProject = await getProject(projectId);
          if (!loadedProject) {
            navigate('/');
            return;
          }

          if (isCancelled) {
            return;
          }

          setProject(loadedProject);
          setPreviewSettings(toSimulationSettings(loadedProject.simulationSettings));
          // Initialize preview objects with start positions
          setPreviewObjects(loadedProject.objects.map((obj) => ({ ...obj })));
          hasSettingsBaselineRef.current = false;
          setIsInitialized(true);
        } catch (error) {
          console.error('[PreviewPage] Failed to load project:', error);
          showPopup({
            type: 'error',
            title: 'Preview Load Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to load this preview right now. Please try again.',
          });
          navigate('/');
        }
      } else {
        // No project ID, redirect to home
        navigate('/');
      }
    };

    void loadProject();

    return () => {
      isCancelled = true;
    };
  }, [projectId, getProject, navigate, isLoadingProjects, isInitialized, showPopup]);

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

  // Handle preview completion
  const handlePreviewComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  // Reset animation state when step changes
  useEffect(() => {
    setShouldAnimateMoveItem(false);
  }, [currentPreviewStep?.id]);

  // Handle exit
  const handleExit = useCallback(async () => {
    try {
      await flushSave({ includeThumbnail: false });
    } catch (error) {
      logger.warn('[PreviewPage] Failed to persist preview settings before exit:', error);
    }

    if (projectId) {
      navigate(`/editor/${projectId}`);
    } else {
      navigate('/');
    }
  }, [flushSave, navigate, projectId]);

  // Show loading state
  if (!isInitialized || !project) {
    return <LoadingScreen message="Preparing preview..." />;
  }

  // Show completion screen
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="animate-in fade-in relative w-full max-w-md overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/95 px-6 py-8 text-center shadow-2xl backdrop-blur-sm duration-300">
          <div className="mb-4 text-4xl">✓</div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Simulation Complete</h2>
          <p className="mb-6 text-sm text-slate-600">
            You have completed all steps in this training simulation.
          </p>
          <button
            onClick={() => {
              void handleExit();
            }}
            className="rounded-[12px] bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Exit Preview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* 3D Canvas */}
      <MainCanvas
        objects={previewObjects}
        selectedObjectId={null}
        onSelectObject={() => {}} // No selection in preview
        onUpdateObject={() => {}} // No updates in preview
        onCameraControlsReady={handleCameraControlsReady}
        showPerformanceMonitor={false}
        previewMode={true}
        previewSettings={previewSettings}
        previewStep={currentPreviewStep}
        onPreviewObjectClick={(objectId) => {
          // Forward click to PreviewStepExecutor
          if (objectClickHandlerRef.current) {
            objectClickHandlerRef.current(objectId);
          }
        }}
        onPreviewWrongClick={(objectId) => {
          if (wrongObjectClickHandlerRef.current) {
            wrongObjectClickHandlerRef.current(objectId);
          }
        }}
        shouldAnimateMoveItem={shouldAnimateMoveItem}
        onPreviewTransformUpdate={(update, childPath?: string) => {
          if (currentPreviewStep?.targetObjectId) {
            handleTransformUpdate(currentPreviewStep.targetObjectId, update, childPath);
          }
        }}
        onPreviewStepComplete={() => {
          // Forward step completion to PreviewStepExecutor
          if (stepCompleteHandlerRef.current) {
            stepCompleteHandlerRef.current();
          }
        }}
      />

      <PreviewSettingsPanel
        settings={previewSettings}
        onSettingsChange={(nextSettings) => setPreviewSettings(toSimulationSettings(nextSettings))}
      />

      {/* Step Executor Overlay */}
      <PreviewStepExecutor
        steps={project.steps}
        objects={previewObjects}
        onComplete={handlePreviewComplete}
        onExit={() => {
          void handleExit();
        }}
        onSetCurrentPreviewStep={setCurrentPreviewStep}
        onObjectClick={() => {
          // Trigger animation via state when object is clicked
          setShouldAnimateMoveItem(true);
        }}
        onRegisterObjectClickHandler={(handler) => {
          objectClickHandlerRef.current = handler;
        }}
        onRegisterWrongObjectClickHandler={(handler) => {
          wrongObjectClickHandlerRef.current = handler;
        }}
        onRegisterStepCompleteHandler={(handler) => {
          stepCompleteHandlerRef.current = handler;
        }}
      />
    </div>
  );
}
