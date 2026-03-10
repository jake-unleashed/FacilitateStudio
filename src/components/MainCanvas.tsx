import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, type RootState } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';

import type { FocusMode, SceneObject, SimStep } from '../types';
import { DEFAULT_SIMULATION_SETTINGS, type SimulationSettings } from '../types/simulationSettings';
import type { PreviewOutlineTarget } from './preview/types';
import { PerformanceMonitorScene, type PerformanceStats } from './PerformanceMonitor';
import { SceneContent } from './scene/SceneContent';
import { hasCachedBackgroundTexture } from '../utils/backgroundTextureCache';

// Check if we're in development mode (Vite provides this)
const IS_DEV = import.meta.env.DEV ?? process.env.NODE_ENV === 'development';

interface MainCanvasProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  /** Callback when the Three.js scene is ready (for occlusion-aware focus raycasts) */
  onSceneReady?: (scene: THREE.Scene) => void;
  /** Callback when the WebGL canvas is ready (for thumbnail capture) */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /** Callback after the first rendered frame (for visual loading transitions) */
  onFirstFrame?: () => void;
  /** Show performance monitor (defaults to true in development) */
  showPerformanceMonitor?: boolean;
  /** Optional callback for dev perf stats (e.g. DebugMenu). */
  onPerformanceStats?: (stats: PerformanceStats | null) => void;
  /** Callback when drag operation starts (for undo/redo batching) */
  onDragStart?: () => void;
  /** Callback when drag operation ends (for undo/redo batching) */
  onDragEnd?: () => void;
  /** Step ID for which position is being recorded */
  recordingPositionForStepId?: string | null;
  /** Steps array for finding recording step */
  steps?: SimStep[];
  /** Ref to latest endPosition during recording (updated synchronously to avoid race conditions) */
  latestRecordingEndPositionRef?: React.MutableRefObject<{
    stepId: string;
    endPosition: { x: number; y: number; z: number } | null;
    endRotation?: { x: number; y: number; z: number };
    endScale?: { x: number; y: number; z: number };
  } | null>;
  /** Enable preview mode (disables camera controls, enables preview interactions) */
  previewMode?: boolean;
  /** Preview camera interaction settings (for trainee experience controls) */
  previewSettings?: SimulationSettings;
  /** Current preview step (used for rendering preview-step UI like move-item) */
  previewStep?: SimStep | null;
  /** Callback when object is clicked in preview mode */
  onPreviewObjectClick?: (objectId: string) => void;
  /** Callback when wrong object is clicked in identify steps */
  onPreviewWrongClick?: (objectId: string) => void;
  /** Callback when preview move-item step updates object transform (during animation) */
  onPreviewTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  /** Callback when preview move-item step finishes */
  onPreviewStepComplete?: () => void;
  /** Whether move-item animation should start (triggered after clicking target) */
  shouldAnimateMoveItem?: boolean;
  /** Optional panoramic background URL for 360 scene rendering. */
  backgroundImageUrl?: string;
  /** Fires whenever the panoramic background texture transitions between loading and ready states. */
  onBackgroundReadyChange?: (ready: boolean, imageUrl?: string, errorMessage?: string) => void;
  /** Optional World Labs SPZ world environment URL. */
  worldEnvironmentUrl?: string;
  /** Optional transform overrides for world environment placement. */
  worldEnvironmentTransform?: {
    positionX?: number;
    positionY?: number;
    positionZ?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    scale?: number;
  };
  /** Fires whenever the world environment transitions between loading and ready states. */
  onWorldEnvironmentReadyChange?: (ready: boolean, worldUrl?: string, errorMessage?: string) => void;
}

function FirstFrameNotifier({
  onFirstFrame,
  hasNotifiedFirstFrameRef,
  isReadyToNotify,
}: {
  onFirstFrame: () => void;
  hasNotifiedFirstFrameRef: React.MutableRefObject<boolean>;
  isReadyToNotify: boolean;
}): null {
  useFrame(() => {
    if (!isReadyToNotify) return;
    if (hasNotifiedFirstFrameRef.current) return;
    hasNotifiedFirstFrameRef.current = true;
    onFirstFrame();
  });
  return null;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  onSceneReady,
  onCanvasReady,
  onFirstFrame,
  showPerformanceMonitor = IS_DEV,
  onPerformanceStats,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  latestRecordingEndPositionRef,
  previewMode = false,
  previewSettings = DEFAULT_SIMULATION_SETTINGS,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewWrongClick,
  onPreviewTransformUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
  backgroundImageUrl,
  onBackgroundReadyChange,
  worldEnvironmentUrl,
  worldEnvironmentTransform,
  onWorldEnvironmentReadyChange,
}) => {
  const [previewOutlineTarget, setPreviewOutlineTarget] = useState<PreviewOutlineTarget | null>(null);
  const [isPanoramicReady, setIsPanoramicReady] = useState<boolean>(
    () => !backgroundImageUrl || hasCachedBackgroundTexture(backgroundImageUrl)
  );
  const [isWorldEnvironmentReady, setIsWorldEnvironmentReady] = useState<boolean>(
    () => !worldEnvironmentUrl
  );

  useEffect(() => {
    if (previewStep?.type !== 'move-item') {
      setPreviewOutlineTarget(null);
    }
  }, [previewStep?.id, previewStep?.type]);

  const prevBgUrlRef = useRef(backgroundImageUrl);
  useEffect(() => {
    if (prevBgUrlRef.current === backgroundImageUrl) return;
    prevBgUrlRef.current = backgroundImageUrl;
    if (!backgroundImageUrl) {
      setIsPanoramicReady(true);
      return;
    }
    setIsPanoramicReady(hasCachedBackgroundTexture(backgroundImageUrl));
  }, [backgroundImageUrl]);

  const prevWorldEnvironmentUrlRef = useRef(worldEnvironmentUrl);
  useEffect(() => {
    if (prevWorldEnvironmentUrlRef.current === worldEnvironmentUrl) return;
    prevWorldEnvironmentUrlRef.current = worldEnvironmentUrl;
    setIsWorldEnvironmentReady(!worldEnvironmentUrl);
  }, [worldEnvironmentUrl]);

  const handleBackgroundReadyChange = useCallback((ready: boolean, imageUrl?: string, errorMessage?: string) => {
    setIsPanoramicReady(ready);
    onBackgroundReadyChange?.(ready, imageUrl, errorMessage);
  }, [onBackgroundReadyChange]);

  const handleWorldEnvironmentReadyChange = useCallback(
    (ready: boolean, worldUrl?: string, errorMessage?: string) => {
      setIsWorldEnvironmentReady(ready);
      onWorldEnvironmentReadyChange?.(ready, worldUrl, errorMessage);
    },
    [onWorldEnvironmentReadyChange]
  );

  // Track if we've notified about canvas being ready
  const hasNotifiedCanvasRef = useRef(false);
  const hasNotifiedFirstFrameRef = useRef(false);

  const handlePerfStats = useCallback((stats: PerformanceStats) => {
    onPerformanceStats?.(stats);
  }, [onPerformanceStats]);

  // Keep parent cleared when monitor is disabled.
  useEffect(() => {
    if (showPerformanceMonitor) return;
    onPerformanceStats?.(null);
  }, [onPerformanceStats, showPerformanceMonitor]);

  const handleCreated = useCallback(
    (state: RootState) => {
      // Prevent any opaque black clear from showing through during initialization.
      // With alpha enabled, we explicitly clear with alpha=0 so the CSS background stays visible.
      state.gl.setClearColor(0x000000, 0);

      if (onCanvasReady && !hasNotifiedCanvasRef.current) {
        hasNotifiedCanvasRef.current = true;
        onCanvasReady(state.gl.domElement);
      }
    },
    [onCanvasReady]
  );

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-slate-100">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]" />

      <div className="relative z-10 h-full w-full">
        <Canvas
          shadows
          className="h-full w-full"
          onPointerMissed={() => onSelectObject(null)}
          onCreated={handleCreated}
          dpr={[1, 2]}
          performance={{ min: 0.5 }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            alpha: true,
            preserveDrawingBuffer: !!onCanvasReady,
          }}
        >
          <SceneContent
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onFocusObject={onFocusObject}
            onCameraControlsReady={onCameraControlsReady}
            onSceneReady={onSceneReady}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            recordingPositionForStepId={recordingPositionForStepId}
            steps={steps}
            latestRecordingEndPositionRef={latestRecordingEndPositionRef}
            previewMode={previewMode}
            previewSettings={previewSettings}
            previewStep={previewStep}
            onPreviewObjectClick={onPreviewObjectClick}
            onPreviewWrongClick={onPreviewWrongClick}
            onPreviewTransformUpdate={onPreviewTransformUpdate}
            onPreviewStepComplete={onPreviewStepComplete}
            shouldAnimateMoveItem={shouldAnimateMoveItem}
            previewOutlineTarget={previewOutlineTarget}
            onPreviewOutlineTargetChange={setPreviewOutlineTarget}
            backgroundImageUrl={backgroundImageUrl}
            onBackgroundReadyChange={handleBackgroundReadyChange}
            worldEnvironmentUrl={worldEnvironmentUrl}
            worldEnvironmentTransform={worldEnvironmentTransform}
            onWorldEnvironmentReadyChange={handleWorldEnvironmentReadyChange}
          />

          {onFirstFrame && (
            <FirstFrameNotifier
              onFirstFrame={onFirstFrame}
              hasNotifiedFirstFrameRef={hasNotifiedFirstFrameRef}
              isReadyToNotify={(!backgroundImageUrl || isPanoramicReady) && (!worldEnvironmentUrl || isWorldEnvironmentReady)}
            />
          )}
          {showPerformanceMonitor && <PerformanceMonitorScene onStats={handlePerfStats} />}
        </Canvas>
      </div>
    </div>
  );
};
