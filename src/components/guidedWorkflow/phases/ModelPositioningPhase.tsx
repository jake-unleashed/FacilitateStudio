import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FocusMode, SceneObject } from '../../../types';
import { parseSelectionId } from '../../../types';
import type { RotationAxis } from '../../rightSidebar/types';
import { getRotationKey } from '../../rightSidebar/utils';
import { calculateScaleAdjustedY, DEFAULT_MODEL_HEIGHT } from '../../../utils/groundHeight';
import { ObjectSelectionScreen } from './modelPositioning/ObjectSelectionScreen';
import { AdjustmentTypeScreen } from './modelPositioning/AdjustmentTypeScreen';
import { AdjustPositionScreen } from './modelPositioning/AdjustPositionScreen';
import { AdjustRotationScreen } from './modelPositioning/AdjustRotationScreen';
import { AdjustScaleScreen } from './modelPositioning/AdjustScaleScreen';

export type PositioningScreen =
  | 'object-selection'
  | 'adjustment-type'
  | 'adjust-position'
  | 'adjust-rotation'
  | 'adjust-scale';

interface ModelPositioningPhaseProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onSelectObject?: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  screen: PositioningScreen;
  onScreenChange: (screen: PositioningScreen) => void;
}

/**
 * Guided workflow phase for positioning uploaded models in the scene.
 * Keeps UI minimal and teaches the same editor interactions (select + gizmo + camera).
 */
export function ModelPositioningPhase({
  objects,
  selectedObjectId,
  onFocusObject,
  onSelectObject,
  onUpdateObject,
  screen,
  onScreenChange,
}: ModelPositioningPhaseProps): JSX.Element {
  const uploadedObjects = useMemo(
    () => objects.filter((object) => object.type === 'mesh'),
    [objects]
  );

  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);
  const selectedParentId = parsedSelection?.objectId ?? null;

  const selectedObject = useMemo(
    () => (selectedParentId ? objects.find((o) => o.id === selectedParentId) ?? null : null),
    [objects, selectedParentId]
  );

  const [isPositionCalloutDismissed, setIsPositionCalloutDismissed] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (screen === 'adjust-position') {
      document.body.dataset.guidedPositionMode = 'position';
    } else {
      delete document.body.dataset.guidedPositionMode;
    }
    return () => {
      delete document.body.dataset.guidedPositionMode;
    };
  }, [screen]);

  useEffect(() => {
    if (screen === 'adjust-position') setIsPositionCalloutDismissed(false);
  }, [screen, selectedParentId]);

  const handleRotationChange = useCallback((axis: RotationAxis, rotation: number) => {
    if (!selectedObject) return;
    const key = getRotationKey(axis);
    onUpdateObject({
      ...selectedObject,
      transform: {
        ...selectedObject.transform,
        [key]: rotation,
      },
    });
  }, [onUpdateObject, selectedObject]);

  const handleScaleChange = useCallback((scale: number) => {
    if (!selectedObject) return;
    const modelHeightRaw = selectedObject.properties.modelHeight;
    const modelHeight = typeof modelHeightRaw === 'number' ? modelHeightRaw : DEFAULT_MODEL_HEIGHT;
    const newY = calculateScaleAdjustedY(
      selectedObject.transform.y,
      selectedObject.transform.scaleY,
      scale,
      modelHeight
    );

    onUpdateObject({
      ...selectedObject,
      transform: {
        ...selectedObject.transform,
        scaleX: scale,
        scaleY: scale,
        scaleZ: scale,
        y: newY,
      },
    });
  }, [onUpdateObject, selectedObject]);

  const handleSelect = useCallback((object: SceneObject) => {
    onSelectObject?.(object.id);
    onFocusObject?.(object, undefined, 'full');
  }, [onFocusObject, onSelectObject]);

  return (
    <div className="space-y-6">
      {screen === 'object-selection' ? (
        <ObjectSelectionScreen
          objects={uploadedObjects}
          selectedParentId={selectedParentId}
          onSelectObject={handleSelect}
        />
      ) : null}

      {screen === 'adjustment-type' ? (
        <AdjustmentTypeScreen
          selectedObjectName={selectedObject?.name ?? null}
          onBack={() => onScreenChange('object-selection')}
          onChooseDifferentModel={() => onScreenChange('object-selection')}
          onChoosePosition={() => onScreenChange('adjust-position')}
          onChooseRotation={() => onScreenChange('adjust-rotation')}
          onChooseScale={() => onScreenChange('adjust-scale')}
        />
      ) : null}

      {screen === 'adjust-position' ? (
        <AdjustPositionScreen
          onBack={() => onScreenChange('adjustment-type')}
          onDone={() => onScreenChange('adjustment-type')}
          isCalloutOpen={Boolean(selectedObject) && !isPositionCalloutDismissed}
          onDismissCallout={() => setIsPositionCalloutDismissed(true)}
        />
      ) : null}

      {screen === 'adjust-rotation' ? (
        <AdjustRotationScreen
          selectedObject={selectedObject}
          onBack={() => onScreenChange('adjustment-type')}
          onDone={() => onScreenChange('adjustment-type')}
          onRotationChange={handleRotationChange}
        />
      ) : null}

      {screen === 'adjust-scale' ? (
        <AdjustScaleScreen
          selectedObject={selectedObject}
          onBack={() => onScreenChange('adjustment-type')}
          onDone={() => onScreenChange('adjustment-type')}
          onScaleChange={handleScaleChange}
        />
      ) : null}
    </div>
  );
}

