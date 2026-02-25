import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimStep, StepType } from '../../types';
import { COLOR_THEMES, STEP_TYPES } from './constants';
import { useDeleteConfirm } from './useDeleteConfirm';
import { useStepCardAutoSave } from './useStepCardAutoSave';
import { useStepCardTextareas } from './useStepCardTextareas';
import { useMoveItemTarget } from './useMoveItemTarget';
import type { StepCardController, StepCardControllerArgs } from './StepCardController.types';

export function useStepCardController({
  step,
  isOpen,
  onUpdate,
  selectedObjectId,
  objects,
  onStartRecording,
  onStopRecording,
  isRecordingPosition,
  onFocusObject,
  onDelete,
}: StepCardControllerArgs): StepCardController {
  const [stepName, setStepName] = useState(step.title);
  const [selectedType, setSelectedType] = useState<StepType | null>(step.type ?? null);
  const [showTypeSelection, setShowTypeSelection] = useState(step.type === null || step.type === undefined);
  const [heading, setHeading] = useState(step.heading || '');
  const [bodyText, setBodyText] = useState(step.bodyText || '');
  const [buttonText, setButtonText] = useState(step.buttonText || '');
  const [cardColor, setCardColor] = useState<'blue' | 'green' | 'yellow' | 'red' | 'gray'>(
    step.cardColor || 'blue'
  );
  const [targetObjectId, setTargetObjectId] = useState(step.targetObjectId || '');
  const [targetChildPath, setTargetChildPath] = useState(step.targetChildPath || '');
  const [endPosition, setEndPosition] = useState(step.endPosition);

  const endPositionJustUpdatedFromPropsRef = useRef(false);

  const [editingField, setEditingField] = useState<'heading' | 'bodyText' | 'buttonText' | null>(null);
  const editingFieldRef = useRef<typeof editingField>(null);
  editingFieldRef.current = editingField;

  const { confirmingDelete, handleDeleteClick } = useDeleteConfirm(onDelete);

  const stepNameTextareaRef = useRef<HTMLTextAreaElement>(null);
  const headingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextTextareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonTextInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when step prop changes
  useEffect(() => {
    setStepName(step.title);
    setSelectedType(step.type ?? null);
    setShowTypeSelection(step.type === null || step.type === undefined);

    if (editingFieldRef.current !== 'heading') setHeading(step.heading || '');
    if (editingFieldRef.current !== 'bodyText') setBodyText(step.bodyText || '');
    if (editingFieldRef.current !== 'buttonText') setButtonText(step.buttonText || '');

    setCardColor(step.cardColor || 'blue');
    setTargetObjectId(step.targetObjectId || '');
    setTargetChildPath(step.targetChildPath || '');

    if (JSON.stringify(step.endPosition) !== JSON.stringify(endPosition)) {
      setEndPosition(step.endPosition);
      endPositionJustUpdatedFromPropsRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step.id,
    step.title,
    step.type,
    step.heading,
    step.bodyText,
    step.buttonText,
    step.cardColor,
    step.targetObjectId,
    step.targetChildPath,
    step.endPosition,
  ]);

  const createUpdatedStep = useCallback(
    (overrides?: Partial<SimStep>): SimStep => {
      const baseStep: SimStep = {
        ...step,
        title: stepName,
        type: selectedType,
        heading: heading || undefined,
        bodyText: bodyText || undefined,
        buttonText: buttonText || undefined,
        cardColor,
        targetObjectId: targetObjectId || undefined,
        targetChildPath: targetChildPath || undefined,
        startPosition: step.startPosition || undefined,
        endPosition: endPosition || undefined,
      };
      return { ...baseStep, ...overrides };
    },
    [
      step,
      stepName,
      selectedType,
      heading,
      bodyText,
      buttonText,
      cardColor,
      targetObjectId,
      targetChildPath,
      endPosition,
    ]
  );

  const flushPendingUpdates = useCallback(() => {
    if (isRecordingPosition) return;

    const latestStepName = stepNameTextareaRef.current?.value ?? stepName;
    const latestHeading = headingTextareaRef.current?.value ?? heading;
    const latestBodyText = bodyTextTextareaRef.current?.value ?? bodyText;
    const latestButtonText = buttonTextInputRef.current?.value ?? buttonText;

    setStepName(latestStepName);
    setHeading(latestHeading);
    setBodyText(latestBodyText);
    setButtonText(latestButtonText);

    const hasChanged =
      latestStepName !== step.title ||
      selectedType !== step.type ||
      latestHeading !== (step.heading || '') ||
      latestBodyText !== (step.bodyText || '') ||
      latestButtonText !== (step.buttonText || '') ||
      cardColor !== (step.cardColor || 'blue') ||
      targetObjectId !== (step.targetObjectId || '') ||
      targetChildPath !== (step.targetChildPath || '') ||
      JSON.stringify(endPosition) !== JSON.stringify(step.endPosition);

    if (!hasChanged) return;

    onUpdate(
      createUpdatedStep({
        title: latestStepName,
        heading: latestHeading || undefined,
        bodyText: latestBodyText || undefined,
        buttonText: latestButtonText || undefined,
        targetObjectId: targetObjectId || undefined,
        targetChildPath: targetChildPath || undefined,
        endPosition: endPosition || undefined,
      })
    );
  }, [
    isRecordingPosition,
    stepName,
    heading,
    bodyText,
    buttonText,
    selectedType,
    cardColor,
    targetObjectId,
    targetChildPath,
    endPosition,
    step,
    onUpdate,
    createUpdatedStep,
  ]);

  useStepCardAutoSave({
    step,
    onUpdate,
    createUpdatedStep,
    stepName,
    heading,
    bodyText,
    buttonText,
    cardColor,
    targetObjectId,
    targetChildPath,
    endPosition,
    isRecordingPosition,
    endPositionJustUpdatedFromPropsRef,
  });

  const handleStepNameChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStepName(e.target.value);
  }, []);

  const handleFieldBlur = useCallback(
    (field: 'stepName' | 'heading' | 'bodyText' | 'buttonText', value: string) => {
      if (field === 'stepName') setStepName(value);
      if (field === 'heading') setHeading(value);
      if (field === 'bodyText') setBodyText(value);
      if (field === 'buttonText') setButtonText(value);

      const overrides: Partial<SimStep> =
        field === 'stepName'
          ? { title: value }
          : field === 'heading'
            ? { heading: value || undefined }
            : field === 'bodyText'
              ? { bodyText: value || undefined }
              : { buttonText: value || undefined };

      onUpdate(createUpdatedStep(overrides));
      if (field !== 'stepName') setEditingField(null);
    },
    [createUpdatedStep, onUpdate]
  );

  const handleStartEdit = useCallback((field: 'heading' | 'bodyText' | 'buttonText') => {
    setEditingField(field);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingField !== null) {
        setEditingField(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editingField]);

  const handleTypeSelect = useCallback(
    (type: StepType) => {
      setSelectedType(type);
      setShowTypeSelection(false);
      onUpdate(createUpdatedStep({ type }));
    },
    [createUpdatedStep, onUpdate]
  );

  const handleChangeStepType = useCallback(() => {
    setShowTypeSelection(true);
  }, []);

  const handleClearStepType = useCallback(() => {
    setSelectedType(null);
    setShowTypeSelection(true);
    onUpdate(createUpdatedStep({ type: null }));
  }, [createUpdatedStep, onUpdate]);

  useStepCardTextareas({
    isOpen,
    step,
    editingField,
    stepName,
    heading,
    bodyText,
    stepNameTextareaRef,
    headingTextareaRef,
    bodyTextTextareaRef,
    buttonTextInputRef,
  });

  const handleSetCardColor = useCallback(
    (color: 'blue' | 'green' | 'yellow' | 'red' | 'gray') => {
      setCardColor(color);
      onUpdate(
        createUpdatedStep({
          cardColor: color,
          title: stepName,
          type: selectedType,
          heading: heading || undefined,
          bodyText: bodyText || undefined,
          buttonText: buttonText || undefined,
        })
      );
    },
    [createUpdatedStep, onUpdate, stepName, selectedType, heading, bodyText, buttonText]
  );

  const {
    effectiveTargetObjectId,
    effectiveTargetChildPath,
    targetObject,
    targetChild,
    canUseSelectedObject,
    handleUseSelectedObject,
    handleToggleRecording,
    handleRemoveTargetObject,
    handleFocusTargetObject,
  } = useMoveItemTarget({
    step,
    objects,
    selectedObjectId,
    targetObjectId,
    targetChildPath,
    setTargetObjectId,
    setTargetChildPath,
    createUpdatedStep,
    onUpdate,
    isRecordingPosition,
    onStartRecording,
    onStopRecording,
    onFocusObject,
  });

  // handleDeleteClick comes from useDeleteConfirm

  useEffect(() => {
    if (step.endPosition && isRecordingPosition) {
      setEndPosition(step.endPosition);
    }
  }, [step.endPosition, isRecordingPosition]);

  const isInfoCardSelected = selectedType === 'info-card';
  const isMoveItemSelected = selectedType === 'move-item';
  const isIdentifySelected = selectedType === 'identify';
  const currentStepTypeConfig = STEP_TYPES.find((st) => st.type === selectedType);
  const currentTheme = COLOR_THEMES[cardColor];

  // (effective target + canUseSelectedObject) is derived in useMoveItemTarget.

  return {
    stepName,
    selectedType,
    showTypeSelection,
    heading,
    bodyText,
    buttonText,
    cardColor,
    targetObjectId,
    targetChildPath,
    endPosition,
    editingField,
    confirmingDelete,
    isRecordingPosition,

    stepNameTextareaRef,
    headingTextareaRef,
    bodyTextTextareaRef,
    buttonTextInputRef,

    isInfoCardSelected,
    isMoveItemSelected,
    isIdentifySelected,
    currentStepTypeConfig,
    currentTheme,
    effectiveTargetObjectId,
    effectiveTargetChildPath,
    targetObject,
    targetChild,
    canUseSelectedObject,

    flushPendingUpdates,
    handleStepNameChange,
    handleFieldBlur,
    handleStartEdit,
    handleTypeSelect,
    handleChangeStepType,
    handleClearStepType,
    handleSetCardColor,
    handleUseSelectedObject,
    handleToggleRecording,
    handleRemoveTargetObject,
    handleFocusTargetObject,
    handleDeleteClick,
  };
}

