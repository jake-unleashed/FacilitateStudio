import { Suspense } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { CameraControls, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { Selection } from '@react-three/postprocessing';

import type { PreviewOutlineTarget } from '../../preview/types';
import { PreviewMoveItemStepRenderer } from '../../preview/PreviewMoveItemStepRenderer';
import { DEFAULT_CAMERA_POSITION, GROUND_PLANE_EXTENT } from '../../../constants';
import type { FocusMode, SceneObject, SimStep } from '../../../types';

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

// Check if we're in development mode (Vite provides this)
const IS_DEV = import.meta.env.DEV ?? process.env.NODE_ENV === 'development';

const GRID_FADE_STRENGTH = 2.0;

export interface SceneContentViewProps {
  objects: SceneObject[];
  selectedParentId: string | null;
  selectedChildPath: string | null;
  selectedObjectId: string | null;
  selectedObject: SceneObject | null;

  previewMode: boolean;
  previewStep: SimStep | null;
  shouldAnimateMoveItem: boolean;
  previewOutlineParentId: string | null;
  previewOutlineChildPath: string | null;
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
  const isNavigationDisabled =
    typeof document !== 'undefined' && document.body.dataset.guidedNavLock === 'true';
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

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={35} />

      <FixedContactShadows
        opacity={0.18}
        scale={GROUND_PLANE_EXTENT * 2}
        blur={1.2}
        far={1.5}
        resolution={1024}
        smooth={true}
        color="#1e293b"
      />

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
        ((props.recordingPositionForStepId && props.ghostObject && props.selectedParentId === props.ghostObject.id) ||
          (!props.recordingPositionForStepId && props.selectedObject)) && (
          <TransformGizmo
            object={props.recordingPositionForStepId && props.ghostObject ? props.ghostObject : props.selectedObject!}
            selectedChildPath={props.selectedChildPath}
            onUpdateObject={props.onUpdateObject}
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            isDragging={props.dragState?.hasMoved ?? false}
          />
        )}

      <CameraControls
        ref={props.controlsRef}
        makeDefault
        enabled={
          !isNavigationDisabled &&
          ((!props.previewMode && (props.dragState === null || !props.dragState.canDrag) && !props.isRecentlyDragged) ||
            (props.previewMode && props.isPositioningCameraRef.current))
        }
        smoothTime={0.6}
        draggingSmoothTime={0.2}
        azimuthRotateSpeed={0.35}
        polarRotateSpeed={0.35}
        truckSpeed={1.2}
        minDistance={0.5}
        maxDistance={60}
        dollySpeed={0.3}
        dollyToCursor={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        touches={{
          one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
          two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
          three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
        }}
        mouseButtons={{
          left: CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.DOLLY,
          right: CameraControlsImpl.ACTION.TRUCK,
          wheel: CameraControlsImpl.ACTION.DOLLY,
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
        isEnabled={!isNavigationDisabled}
      />
    </>
  );
};

