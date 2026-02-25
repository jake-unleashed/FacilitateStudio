import { Suspense, useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { CameraControls, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { Selection } from '@react-three/postprocessing';

import type { PreviewOutlineTarget } from '../../preview/types';
import { PreviewMoveItemStepRenderer } from '../../preview/PreviewMoveItemStepRenderer';
import { PreviewIdentifyStep } from '../../preview/PreviewIdentifyStep';
import { DEFAULT_CAMERA_POSITION, GROUND_PLANE_EXTENT } from '../../../constants';
import type { FocusMode, SceneObject, SimStep } from '../../../types';
import type { SimulationSettings } from '../../../types/simulationSettings';

import { FixedContactShadows, ContactShadowDebugger } from '../FixedContactShadows';
import { DragHandler, CursorManager, type DragState } from '../DragHandler';
import { ImportedModel } from '../ImportedModel';
import { IndustrialPrimitive } from '../IndustrialPrimitive';
import { KeyboardNavigator } from '../KeyboardNavigator';
import {
  ChildOutlineEffect,
  ChildSelectionProvider,
  PreviewChildOutlineEffect,
  PreviewSelectionOutlineEffect,
  Select,
  SelectionOutlineEffect,
} from '../SelectionOutline';
import { TransformGizmo } from '../transformGizmo';
import { GridWithNoDepth } from '../GridWithNoDepth';
import { PanoramicBackground } from '../PanoramicBackground';

// Check if we're in development mode (Vite provides this)
const IS_DEV = import.meta.env.DEV ?? process.env.NODE_ENV === 'development';

const GRID_FADE_STRENGTH = 2.0;
const GUIDED_BODY_ATTRIBUTE_FILTER = [
  'data-guided-nav-lock',
  'data-guided-phase',
  'data-guided-position-mode',
];

interface GuidedBodyDatasetState {
  isNavigationDisabled: boolean;
  guidedPhase?: string;
  guidedPositionMode?: string;
}

function readGuidedBodyDatasetState(): GuidedBodyDatasetState {
  if (typeof document === 'undefined') {
    return {
      isNavigationDisabled: false,
      guidedPhase: undefined,
      guidedPositionMode: undefined,
    };
  }

  return {
    isNavigationDisabled: document.body.dataset.guidedNavLock === 'true',
    guidedPhase: document.body.dataset.guidedPhase,
    guidedPositionMode: document.body.dataset.guidedPositionMode,
  };
}

function useGuidedBodyDatasetState(): GuidedBodyDatasetState {
  const [guidedBodyState, setGuidedBodyState] = useState<GuidedBodyDatasetState>(
    readGuidedBodyDatasetState
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateGuidedBodyState = () => {
      setGuidedBodyState((previousState) => {
        const nextState = readGuidedBodyDatasetState();
        if (
          previousState.isNavigationDisabled === nextState.isNavigationDisabled &&
          previousState.guidedPhase === nextState.guidedPhase &&
          previousState.guidedPositionMode === nextState.guidedPositionMode
        ) {
          return previousState;
        }
        return nextState;
      });
    };

    // Ensure we’re in sync even if state was constructed before `document.body` was ready.
    updateGuidedBodyState();

    const observer = new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        const attributeName = mutation.attributeName;
        if (!attributeName) continue;
        if (!GUIDED_BODY_ATTRIBUTE_FILTER.includes(attributeName)) continue;
        updateGuidedBodyState();
        break;
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: GUIDED_BODY_ATTRIBUTE_FILTER,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return guidedBodyState;
}

export interface SceneContentViewProps {
  objects: SceneObject[];
  selectedParentId: string | null;
  selectedChildPath: string | null;
  selectedObjectId: string | null;
  selectedObject: SceneObject | null;

  previewMode: boolean;
  previewSettings?: SimulationSettings;
  previewStep: SimStep | null;
  shouldAnimateMoveItem: boolean;
  previewOutlineParentId: string | null;
  previewOutlineChildPath: string | null;
  backgroundImageUrl?: string;
  onBackgroundReadyChange?: (ready: boolean) => void;
  onPreviewTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  onPreviewStepComplete?: () => void;
  onPreviewOutlineTargetChange?: (target: PreviewOutlineTarget | null) => void;

  controlsRef: RefObject<CameraControlsImpl>;
  isPositioningCameraRef: MutableRefObject<boolean>;
  isCameraPositioning?: boolean;

  recordingPositionForStepId?: string | null;
  targetObjectId: string | null;
  recordingStep?: SimStep | null;
  actualObject: SceneObject | null;
  ghostObject: SceneObject | null;

  dragState: DragState | null;
  hasMovedRef: MutableRefObject<boolean>;
  hoveredObjectId: string | null;
  /** Whether the cursor should show a pointer (finger) over the canvas */
  isCursorHovering: boolean;
  isRecentlyDragged: boolean;

  onUpdateObject: (obj: SceneObject) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;

  handleObjectPointerDown: (
    e: ThreeEvent<PointerEvent>,
    obj: SceneObject,
    pendingChildPath?: string | null,
    dragChildPath?: string | null
  ) => void;
  handleDoubleClick: (_obj: SceneObject) => void;
  handleHoverStart: (objectId: string, e: ThreeEvent<PointerEvent>) => void;
  handleHoverEnd: (objectId: string) => void;

  handleDragEnd: (wasDrag: boolean) => void;
  handleMarkAsDrag: () => void;
}

export const SceneContentView: React.FC<SceneContentViewProps> = (props) => {
  const ghostObject = props.ghostObject;
  const guidedBodyState = useGuidedBodyDatasetState();

  const isNavigationDisabled = guidedBodyState.isNavigationDisabled;
  const guidedPhase = guidedBodyState.guidedPhase;
  const guidedPositionMode = guidedBodyState.guidedPositionMode;
  const isGuidedModelUpload = guidedPhase === 'model-upload';
  const isPreviewInteractionLocked = props.previewMode && (props.isCameraPositioning ?? props.isPositioningCameraRef.current);
  const previewAllowOrbit = props.previewMode ? (props.previewSettings?.allowOrbit ?? false) : true;
  const previewAllowZoom = props.previewMode ? (props.previewSettings?.allowZoom ?? false) : true;
  const isPreviewCameraInteractionEnabled = previewAllowOrbit || previewAllowZoom;
  const canUsePreviewOrbit = previewAllowOrbit && !isPreviewInteractionLocked;
  const canUsePreviewZoom = previewAllowZoom && !isPreviewInteractionLocked;
  const hasPanoramicBackground = typeof props.backgroundImageUrl === 'string' && props.backgroundImageUrl.length > 0;

  return (
    <>
      {IS_DEV && <ContactShadowDebugger />}

      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 15, 10]} intensity={1.8} />
      <directionalLight position={[-10, 10, -5]} intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={2.0} />
      <pointLight position={[-10, 8, -10]} intensity={1.5} />
      <spotLight position={[0, 20, 0]} angle={0.6} penumbra={0.5} intensity={2.5} />

      {props.previewMode && props.previewStep?.type === 'move-item' && (
        <PreviewMoveItemStepRenderer
          step={props.previewStep}
          objects={props.objects}
          cameraControlsRef={props.controlsRef}
          isPositioningCameraRef={props.isPositioningCameraRef}
          shouldAnimate={props.shouldAnimateMoveItem}
          onTransformUpdate={props.onPreviewTransformUpdate}
          onComplete={props.onPreviewStepComplete}
          onPreviewOutlineTargetChange={props.onPreviewOutlineTargetChange}
        />
      )}

      {props.previewMode && props.previewStep?.type === 'identify' && (
        <PreviewIdentifyStep
          step={props.previewStep}
          objects={props.objects}
          cameraControlsRef={props.controlsRef}
          isPositioningCameraRef={props.isPositioningCameraRef}
          onComplete={props.onPreviewStepComplete || (() => {})}
        />
      )}

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>
      {hasPanoramicBackground && (
        <PanoramicBackground
          imageUrl={props.backgroundImageUrl!}
          onReadyChange={props.onBackgroundReadyChange}
        />
      )}

      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={35} />

      <FixedContactShadows
        opacity={hasPanoramicBackground ? 0.6 : 0.18}
        scale={GROUND_PLANE_EXTENT * 2}
        blur={hasPanoramicBackground ? 0.7 : 1.2}
        far={1.5}
        resolution={1024}
        smooth={true}
        color="#1e293b"
      />

      {!(props.previewMode && hasPanoramicBackground) && (
        <GridWithNoDepth
          args={[GROUND_PLANE_EXTENT * 2, GROUND_PLANE_EXTENT * 2]}
          cellSize={1}
          sectionSize={5}
          fadeDistance={GROUND_PLANE_EXTENT}
          fadeStrength={GRID_FADE_STRENGTH}
          sectionColor="#94a3b8"
          cellColor="#cbd5e1"
          sectionThickness={0.8}
          cellThickness={0.4}
          side={THREE.DoubleSide}
        />
      )}

      <ChildSelectionProvider>
        <Selection>
          <group>
            {props.objects.map(
              (obj: SceneObject) =>
                obj.properties.visible &&
                !(props.recordingPositionForStepId && obj.id === props.targetObjectId) && (
                  <Select
                    key={obj.id}
                    enabled={
                      ((!props.previewMode && props.selectedParentId === obj.id) ||
                        (props.previewMode &&
                          props.previewOutlineParentId === obj.id &&
                          props.previewOutlineChildPath === null)) &&
                      !(obj.properties.modelAssetId && props.selectedChildPath)
                    }
                  >
                    {obj.properties.modelAssetId ? (
                      <ImportedModel
                        obj={obj}
                        isSelected={props.selectedParentId === obj.id}
                        selectedChildPath={props.selectedParentId === obj.id ? props.selectedChildPath : null}
                        outlinedChildPath={
                          props.previewMode && props.previewOutlineParentId === obj.id
                            ? props.previewOutlineChildPath
                            : null
                        }
                        onPointerDown={props.handleObjectPointerDown}
                        onDoubleClick={props.handleDoubleClick}
                        isDragging={props.dragState?.objectId === obj.id && props.dragState.hasMoved}
                        isHovered={props.hoveredObjectId === obj.id}
                        onHoverStart={(e) => props.handleHoverStart(obj.id, e)}
                        onHoverEnd={() => props.handleHoverEnd(obj.id)}
                      />
                    ) : (
                      <IndustrialPrimitive
                        obj={obj}
                        isSelected={props.selectedParentId === obj.id}
                        onPointerDown={props.handleObjectPointerDown}
                        onDoubleClick={props.handleDoubleClick}
                        isDragging={props.dragState?.objectId === obj.id && props.dragState.hasMoved}
                        isHovered={props.hoveredObjectId === obj.id}
                        onHoverStart={(e) => props.handleHoverStart(obj.id, e)}
                        onHoverEnd={(_e) => props.handleHoverEnd(obj.id)}
                      />
                    )}
                  </Select>
                )
            )}

            {props.recordingPositionForStepId &&
              props.actualObject &&
              props.actualObject.properties.visible &&
              (props.actualObject.properties.modelAssetId ? (
                <ImportedModel
                  key={`actual-${props.actualObject.id}`}
                  obj={props.actualObject}
                  isSelected={false}
                  onPointerDown={() => {}}
                  onDoubleClick={() => {}}
                  isDragging={false}
                  isHovered={false}
                  onHoverStart={(_e) => {}}
                  onHoverEnd={() => {}}
                  isGhost={true}
                  isActualReference={true}
                />
              ) : (
                <IndustrialPrimitive
                  key={`actual-${props.actualObject.id}`}
                  obj={props.actualObject}
                  isSelected={false}
                  onPointerDown={() => {}}
                  onDoubleClick={() => {}}
                  isDragging={false}
                  isHovered={false}
                  onHoverStart={(_e) => {}}
                  onHoverEnd={(_e) => {}}
                  isGhost={true}
                  isActualReference={true}
                />
              ))}

            {props.recordingPositionForStepId && ghostObject && ghostObject.properties.visible && (
              <Select key={`ghost-${ghostObject.id}`} enabled={props.selectedParentId === ghostObject.id}>
                {ghostObject.properties.modelAssetId ? (
                  <ImportedModel
                    obj={ghostObject}
                    isSelected={props.selectedParentId === ghostObject.id}
                    selectedChildPath={props.selectedParentId === ghostObject.id ? props.selectedChildPath : null}
                    onPointerDown={props.handleObjectPointerDown}
                    onDoubleClick={props.handleDoubleClick}
                    isDragging={props.dragState?.objectId === ghostObject.id && props.dragState.hasMoved}
                    isHovered={props.hoveredObjectId === ghostObject.id}
                    onHoverStart={(e) => props.handleHoverStart(ghostObject.id, e)}
                    onHoverEnd={() => props.handleHoverEnd(ghostObject.id)}
                    isGhost={true}
                    highlightOnlyChild={!!props.recordingStep?.targetChildPath}
                  />
                ) : (
                  <IndustrialPrimitive
                    obj={ghostObject}
                    isSelected={props.selectedParentId === ghostObject.id}
                    onPointerDown={props.handleObjectPointerDown}
                    onDoubleClick={props.handleDoubleClick}
                    isDragging={props.dragState?.objectId === ghostObject.id && props.dragState.hasMoved}
                    isHovered={props.hoveredObjectId === ghostObject.id}
                    onHoverStart={(e) => props.handleHoverStart(ghostObject.id, e)}
                    onHoverEnd={(_e) => props.handleHoverEnd(ghostObject.id)}
                    isGhost={true}
                  />
                )}
              </Select>
            )}
          </group>

          {props.previewMode ? <PreviewSelectionOutlineEffect /> : <SelectionOutlineEffect />}
        </Selection>

        {props.previewMode ? <PreviewChildOutlineEffect /> : <ChildOutlineEffect />}
      </ChildSelectionProvider>

      {!props.previewMode &&
        !isGuidedModelUpload &&
        ((props.recordingPositionForStepId && props.ghostObject && props.selectedParentId === props.ghostObject.id) ||
          (!props.recordingPositionForStepId && props.selectedObject)) &&
        (() => {
          const isGuidedPositioning = guidedPhase === 'model-positioning';
          const isGuidedStepConfig = guidedPhase === 'step-configuration';
          const shouldShowGizmo =
            (!isGuidedPositioning && !isGuidedStepConfig) || guidedPositionMode === 'position';

          if (!shouldShowGizmo) return null;

          return (
            <TransformGizmo
              object={props.recordingPositionForStepId && props.ghostObject ? props.ghostObject : props.selectedObject!}
              selectedChildPath={props.selectedChildPath}
              onUpdateObject={props.onUpdateObject}
              onDragStart={props.onDragStart}
              onDragEnd={props.onDragEnd}
              isDragging={props.dragState?.hasMoved ?? false}
            />
          );
        })()}

      <CameraControls
        ref={props.controlsRef}
        makeDefault
        enabled={
          !isNavigationDisabled &&
          ((!props.previewMode && (props.dragState === null || !props.dragState.canDrag) && !props.isRecentlyDragged) ||
            (props.previewMode &&
              (isPreviewInteractionLocked || isPreviewCameraInteractionEnabled)))
        }
        smoothTime={0.6}
        draggingSmoothTime={0.2}
        azimuthRotateSpeed={0.35}
        polarRotateSpeed={0.35}
        truckSpeed={1.2}
        minDistance={0.5}
        maxDistance={props.previewMode ? 20 : 60}
        dollySpeed={0.3}
        dollyToCursor={false}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        touches={{
          one: canUsePreviewOrbit ? CameraControlsImpl.ACTION.TOUCH_ROTATE : CameraControlsImpl.ACTION.NONE,
          two: props.previewMode
            ? canUsePreviewZoom
              ? CameraControlsImpl.ACTION.TOUCH_DOLLY
              : CameraControlsImpl.ACTION.NONE
            : isGuidedModelUpload
              ? CameraControlsImpl.ACTION.TOUCH_DOLLY
              : CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
          three:
            props.previewMode || isGuidedModelUpload
              ? CameraControlsImpl.ACTION.NONE
              : CameraControlsImpl.ACTION.TOUCH_TRUCK,
        }}
        mouseButtons={{
          left: canUsePreviewOrbit ? CameraControlsImpl.ACTION.ROTATE : CameraControlsImpl.ACTION.NONE,
          middle: canUsePreviewZoom ? CameraControlsImpl.ACTION.DOLLY : CameraControlsImpl.ACTION.NONE,
          right:
            props.previewMode || isGuidedModelUpload
              ? CameraControlsImpl.ACTION.NONE
              : CameraControlsImpl.ACTION.TRUCK,
          wheel: canUsePreviewZoom ? CameraControlsImpl.ACTION.DOLLY : CameraControlsImpl.ACTION.NONE,
        }}
      />

      <DragHandler
        dragState={props.dragState}
        hasMovedRef={props.hasMovedRef}
        onUpdateObject={props.onUpdateObject}
        onDragEnd={props.handleDragEnd}
        onMarkAsDrag={props.handleMarkAsDrag}
      />

      <CursorManager isHovering={props.isCursorHovering} isDragging={props.dragState?.hasMoved ?? false} />

      <KeyboardNavigator
        controlsRef={props.controlsRef}
        selectedObject={props.selectedObject}
        selectedChildPath={props.selectedChildPath}
        onFocusObject={props.onFocusObject}
        isEnabled={!isNavigationDisabled && !isGuidedModelUpload}
      />
    </>
  );
};

