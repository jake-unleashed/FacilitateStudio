import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainCanvas } from '../components/MainCanvas';
import { PreviewStepExecutor } from '../components/preview/PreviewStepExecutor';
import { useProjects } from '../hooks/useProjects';
import { SceneObject, SimStep } from '../types';
import CameraControlsImpl from 'camera-controls';

/**
 * PreviewPage - Full-screen preview mode for experiencing the training simulation.
 *
 * Executes steps sequentially, displaying info cards and animating object movements
 * with automatic camera positioning.
 */
export function PreviewPage() {
  const { id: projectId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { getProject, isLoading: isLoadingProjects } = useProjects();

  // Project state
  const [project, setProject] = useState<{
    objects: SceneObject[];
    steps: SimStep[];
    name: string;
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewObjects, setPreviewObjects] = useState<SceneObject[]>([]);
  const [animatedObjectId, setAnimatedObjectId] = useState<string | null>(null);
  const [animatedPosition, setAnimatedPosition] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
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

    if (projectId) {
      const loadedProject = getProject(projectId);
      if (loadedProject) {
        setProject({
          objects: loadedProject.objects,
          steps: loadedProject.steps,
          name: loadedProject.name,
        });
        // Initialize preview objects with start positions
        setPreviewObjects(loadedProject.objects.map((obj) => ({ ...obj })));
        setIsInitialized(true);
      } else {
        // Project not found, redirect to home
        navigate('/');
        return;
      }
    } else {
      // No project ID, redirect to home
      navigate('/');
    }
  }, [projectId, getProject, navigate, isLoadingProjects, isInitialized]);

  // Handle camera controls ready
  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  // Handle object position updates during animation
  const handlePositionUpdate = useCallback(
    (objectId: string, position: { x: number; y: number; z: number }) => {
      setAnimatedObjectId(objectId);
      setAnimatedPosition(position);

      // Update the preview objects array with the animated position
      setPreviewObjects((prev) =>
        prev.map((obj) =>
          obj.id === objectId
            ? {
                ...obj,
                transform: {
                  ...obj.transform,
                  x: position.x,
                  y: position.y,
                  z: position.z,
                },
              }
            : obj
        )
      );
    },
    []
  );

  // Apply animated positions to preview objects
  const effectiveObjects = useMemo(() => {
    if (!animatedObjectId || !animatedPosition) {
      return previewObjects;
    }

    return previewObjects.map((obj) =>
      obj.id === animatedObjectId
        ? {
            ...obj,
            transform: {
              ...obj.transform,
              x: animatedPosition.x,
              y: animatedPosition.y,
              z: animatedPosition.z,
            },
          }
        : obj
    );
  }, [previewObjects, animatedObjectId, animatedPosition]);

  // Handle preview completion
  const handlePreviewComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  // Reset animation state when step changes
  useEffect(() => {
    setShouldAnimateMoveItem(false);
    setAnimatedObjectId(null);
    setAnimatedPosition(null);
  }, [currentPreviewStep?.id]);

  // Handle exit
  const handleExit = useCallback(() => {
    if (projectId) {
      navigate(`/editor/${projectId}`);
    } else {
      navigate('/');
    }
  }, [navigate, projectId]);

  // Show loading state
  if (isLoadingProjects || !isInitialized || !project) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="text-slate-500">Loading preview...</div>
      </div>
    );
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
            onClick={handleExit}
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
        objects={effectiveObjects}
        selectedObjectId={null}
        onSelectObject={() => {}} // No selection in preview
        onUpdateObject={() => {}} // No updates in preview
        onCameraControlsReady={handleCameraControlsReady}
        showPerformanceMonitor={false}
        previewMode={true}
        previewStep={currentPreviewStep}
        onPreviewObjectClick={(objectId) => {
          // Forward click to PreviewStepExecutor
          if (objectClickHandlerRef.current) {
            objectClickHandlerRef.current(objectId);
          }
        }}
        shouldAnimateMoveItem={shouldAnimateMoveItem}
        onPreviewPositionUpdate={(position: { x: number; y: number; z: number }) => {
          if (currentPreviewStep?.targetObjectId) {
            handlePositionUpdate(currentPreviewStep.targetObjectId, position);
          }
        }}
        onPreviewStepComplete={() => {
          // Forward step completion to PreviewStepExecutor
          if (stepCompleteHandlerRef.current) {
            stepCompleteHandlerRef.current();
          }
        }}
      />

      {/* Step Executor Overlay */}
      <PreviewStepExecutor
        steps={project.steps}
        objects={effectiveObjects}
        onComplete={handlePreviewComplete}
        onExit={handleExit}
        onSetCurrentPreviewStep={setCurrentPreviewStep}
        onObjectClick={() => {
          // Trigger animation via state when object is clicked
          setShouldAnimateMoveItem(true);
        }}
        onRegisterObjectClickHandler={(handler) => {
          objectClickHandlerRef.current = handler;
        }}
        onRegisterStepCompleteHandler={(handler) => {
          stepCompleteHandlerRef.current = handler;
        }}
      />
    </div>
  );
}
