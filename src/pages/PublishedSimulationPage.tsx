import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainCanvas } from '../components/MainCanvas';
import { PreviewStepExecutor } from '../components/preview/PreviewStepExecutor';
import { usePopup } from '../contexts/PopupContext';
import { SimStep } from '../types';
import { applyChildLocalTransform, applyChildWorldPosition } from '../utils/childTransformUtils';
import CameraControlsImpl from 'camera-controls';
import { PublishedCenterCard } from './published/PublishedCenterCard';
import { PublishedTrainingLanding } from './published/PublishedTrainingLanding';
import { PublishedTrainingCompleteDialog } from './published/PublishedTrainingCompleteDialog';
import { usePublishedSnapshot } from './published/usePublishedSnapshot';

const START_TRANSITION_MS = 600;
const COMPLETION_DELAY_MS = 800;

/**
 * PublishedSimulationPage renders a published simulation snapshot by share token.
 */
export function PublishedSimulationPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { showPopup } = usePopup();
  const tokenParam = useMemo(() => searchParams.get('token'), [searchParams]);
  const invalidReason = useMemo(() => {
    if (!tokenParam) return 'missingToken';
    return null;
  }, [tokenParam]);

  const { project, isInitialized, previewObjects, setPreviewObjects } = usePublishedSnapshot(tokenParam, showPopup);
  const [isComplete, setIsComplete] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [currentPreviewStep, setCurrentPreviewStep] = useState<SimStep | null>(null);
  const [shouldAnimateMoveItem, setShouldAnimateMoveItem] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const objectClickHandlerRef = useRef<((objectId: string) => void) | null>(null);
  const stepCompleteHandlerRef = useRef<(() => void) | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);

  const cameraControlsRef = useRef<CameraControlsImpl | null>(null);
  const [, setControlsReady] = useState(false);

  const clearTransitionTimeout = useCallback(() => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const setTransitionTimeout = useCallback(
    (fn: () => void, ms: number) => {
      clearTransitionTimeout();
      transitionTimeoutRef.current = window.setTimeout(() => {
        transitionTimeoutRef.current = null;
        fn();
      }, ms);
    },
    [clearTransitionTimeout]
  );

  useEffect(() => {
    return () => {
      clearTransitionTimeout();
    };
  }, [clearTransitionTimeout]);

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
    [setPreviewObjects]
  );

  const handlePreviewComplete = useCallback(() => {
    setIsComplete(true);
    setTransitionTimeout(() => setShowCompletion(true), COMPLETION_DELAY_MS);
  }, [setTransitionTimeout]);

  const handleRetry = useCallback(() => {
    if (project) {
      clearTransitionTimeout();
      setPreviewObjects(project.objects.map((obj) => ({ ...obj })));
      setIsComplete(false);
      setShowCompletion(false);
      setCurrentPreviewStep(null);
      setShouldAnimateMoveItem(false);
      setRetryKey((k) => k + 1);
    }
  }, [clearTransitionTimeout, project, setPreviewObjects]);

  useEffect(() => {
    setShouldAnimateMoveItem(false);
  }, [currentPreviewStep?.id]);

  const canStartTraining = isInitialized && !!project && !isStarting;
  const landingTitle = project?.name?.trim() || 'Preparing your training';

  const handleStart = useCallback(() => {
    if (!canStartTraining) return;

    setIsStarting(true);
    setTransitionTimeout(() => {
      setHasStarted(true);
      setIsStarting(false);
    }, START_TRANSITION_MS);
  }, [canStartTraining, setTransitionTimeout]);

  // Missing / invalid link
  if (invalidReason === 'missingToken') {
    return (
      <PublishedCenterCard
        eyebrow="Published Training"
        title="Invalid published link"
        description="This link is missing a token."
      />
    );
  }

  // Invalid or unavailable published link.
  if (isInitialized && !project) {
    return (
      <PublishedCenterCard
        eyebrow="Published Training"
        title="Invalid published link"
        description="This link is invalid or no longer available."
      />
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* 3D canvas -- mounts as soon as project loads so models preload behind the landing page */}
      {project ? (
        <div className="absolute inset-0">
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

          {hasStarted ? (
            <PreviewStepExecutor
              key={retryKey}
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
          ) : null}
        </div>
      ) : null}

      {!hasStarted ? (
        <PublishedTrainingLanding
          title={landingTitle}
          canStart={canStartTraining}
          isStarting={isStarting}
          onStart={handleStart}
        />
      ) : null}

      {/* Completion overlay -- blurs the 3D scene and shows the card on top */}
      {hasStarted && isComplete ? (
        <PublishedTrainingCompleteDialog
          visible={showCompletion}
          title={project?.name?.trim() || 'Training Complete'}
          onRestart={handleRetry}
        />
      ) : null}
    </div>
  );
}
