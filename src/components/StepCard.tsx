import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Info,
  MoveRight,
  ChevronUp,
  RefreshCw,
  HelpCircle,
  Pencil,
  Circle,
  CheckCircle2,
  X,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { StepType, SimStep, SceneObject, parseSelectionId } from '../types';
import { calculateChildWorldPosition, findChildByPathString } from '../utils/childTransformUtils';
import { OBJECT_ICONS } from '../constants';

interface StepCardProps {
  step: SimStep;
  isOpen: boolean;
  onUpdate: (updated: SimStep) => void;
  onMinimize: () => void;
  selectedObjectId?: string | null;
  objects?: SceneObject[];
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecordingPosition?: boolean;
  onFocusObject?: (object: SceneObject) => void;
  onDelete?: () => void;
}

interface StepTypeConfig {
  type: 'info-card' | 'move-item';
  label: string;
  description: string;
  icon: React.ElementType;
  color: 'blue' | 'purple';
}

const STEP_TYPES: StepTypeConfig[] = [
  {
    type: 'info-card',
    label: 'Info Card',
    description: 'Display information to the trainee',
    icon: Info,
    color: 'blue',
  },
  {
    type: 'move-item',
    label: 'Move Item',
    description: 'Guide trainee to move an object',
    icon: MoveRight,
    color: 'purple',
  },
];

// Constants for textarea auto-resize
const TEXTAREA_CONFIG = {
  MAX_LINES: 3,
  LINE_HEIGHT: 22.75, // text-sm (14px) * leading-relaxed (~1.625)
  PADDING: 20, // py-2.5 (10px top + 10px bottom)
  MAX_HEIGHT: 88, // 3 * LINE_HEIGHT + PADDING
} as const;

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 400;

// Color theme configurations for Info Card - Clean, elegant palette
const COLOR_THEMES: Record<
  'blue' | 'green' | 'yellow' | 'red' | 'gray',
  {
    headingBg: string;
    headingText: string;
    circleColor: string;
  }
> = {
  blue: {
    headingBg: 'bg-blue-600',
    headingText: 'text-white',
    circleColor: 'bg-blue-600',
  },
  green: {
    headingBg: 'bg-emerald-600',
    headingText: 'text-white',
    circleColor: 'bg-emerald-600',
  },
  yellow: {
    headingBg: 'bg-amber-500',
    headingText: 'text-white',
    circleColor: 'bg-amber-500',
  },
  red: {
    headingBg: 'bg-rose-600',
    headingText: 'text-white',
    circleColor: 'bg-rose-600',
  },
  gray: {
    headingBg: 'bg-slate-600',
    headingText: 'text-white',
    circleColor: 'bg-slate-600',
  },
};

/**
 * Custom hook that debounces a value by a specified delay.
 * Returns the value after it has remained unchanged for the delay period.
 * 
 * @template T - The type of value to debounce
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 * 
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * StepCard - Editable card for simulation steps
 * 
 * Supports two step types:
 * - Info Card: Display information to trainees with heading, body text, and button
 * - Move Item: Guide trainees to move an object in the 3D scene
 * 
 * Features:
 * - Auto-save with debouncing (400ms)
 * - Uncontrolled inputs during editing for reliable text persistence
 * - Inline editing for Info Card fields
 * - Real-time preview of Info Card appearance
 * - Drag-to-reorder support (when minimized)
 */
export const StepCard: React.FC<StepCardProps> = ({
  step,
  isOpen,
  onUpdate,
  onMinimize,
  selectedObjectId,
  objects = [],
  onStartRecording,
  onStopRecording,
  isRecordingPosition = false,
  onFocusObject,
  onDelete,
}) => {
  // Local state for form fields
  const [stepName, setStepName] = useState(step.title);
  // Keep selectedType as the actual step type (can be null) to prevent premature type assignment
  const [selectedType, setSelectedType] = useState<StepType | null>(step.type ?? null);
  const [showTypeSelection, setShowTypeSelection] = useState(
    step.type === null || step.type === undefined
  );
  const [heading, setHeading] = useState(step.heading || '');
  const [bodyText, setBodyText] = useState(step.bodyText || '');
  const [buttonText, setButtonText] = useState(step.buttonText || '');
  const [cardColor, setCardColor] = useState<'blue' | 'green' | 'yellow' | 'red' | 'gray'>(
    step.cardColor || 'blue'
  );
  // Move Item specific state
  const [targetObjectId, setTargetObjectId] = useState(step.targetObjectId || '');
  const [targetChildPath, setTargetChildPath] = useState(step.targetChildPath || '');
  const [endPosition, setEndPosition] = useState(step.endPosition);

  // Track if endPosition was just updated from props to prevent auto-save interference
  const endPositionJustUpdatedFromPropsRef = useRef(false);

  // Edit state for inline editing
  const [editingField, setEditingField] = useState<'heading' | 'bodyText' | 'buttonText' | null>(
    null
  );
  const editingFieldRef = useRef<typeof editingField>(null);
  editingFieldRef.current = editingField;

  // Delete confirmation state (click twice to confirm)
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Refs for DOM inputs - allows reading actual typed value on blur (bypasses React state timing)
  const stepNameTextareaRef = useRef<HTMLTextAreaElement>(null);
  const headingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextTextareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonTextInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when step prop changes
  useEffect(() => {
    setStepName(step.title);
    setSelectedType(step.type ?? null);
    setShowTypeSelection(step.type === null || step.type === undefined);
    
    // Don't sync text fields while actively editing - uncontrolled inputs are source of truth
    if (editingFieldRef.current !== 'heading') setHeading(step.heading || '');
    if (editingFieldRef.current !== 'bodyText') setBodyText(step.bodyText || '');
    if (editingFieldRef.current !== 'buttonText') setButtonText(step.buttonText || '');
    
    setCardColor(step.cardColor || 'blue');
    setTargetObjectId(step.targetObjectId || '');
    setTargetChildPath(step.targetChildPath || '');

    // Check if endPosition changed from props (e.g., after recording)
    if (JSON.stringify(step.endPosition) !== JSON.stringify(endPosition)) {
      setEndPosition(step.endPosition);
      endPositionJustUpdatedFromPropsRef.current = true;
    }
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
    endPosition,
  ]);

  // Helper function to create updated step object
  const createUpdatedStep = useCallback(
    (overrides?: Partial<SimStep>): SimStep => {
      // Use local state for move-item fields to ensure we have the latest values
      // Preserve null type if user hasn't selected a type yet (showTypeSelection is true)
      const baseStep: SimStep = {
        ...step,
        title: stepName,
        type: selectedType, // Can be null if user hasn't selected yet
        heading: heading || undefined,
        bodyText: bodyText || undefined,
        buttonText: buttonText || undefined,
        cardColor: cardColor,
        // Use local state for targetObjectId and targetChildPath to ensure we have the latest values
        targetObjectId: targetObjectId || undefined,
        targetChildPath: targetChildPath || undefined,
        startPosition: step.startPosition || undefined,
        endPosition: endPosition || undefined,
      };
      // Apply overrides (which will override the above values if provided)
      return {
        ...baseStep,
        ...overrides,
      };
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

  // Debounced values for auto-save
  const debouncedStepName = useDebounce(stepName, AUTO_SAVE_DELAY);
  const debouncedHeading = useDebounce(heading, AUTO_SAVE_DELAY);
  const debouncedBodyText = useDebounce(bodyText, AUTO_SAVE_DELAY);
  const debouncedButtonText = useDebounce(buttonText, AUTO_SAVE_DELAY);

  // Debounced values for move-item fields
  // Note: targetObjectId and targetChildPath are NOT debounced because they should update immediately
  // when explicitly set (via "Use Selected Object" button). Only endPosition is debounced.
  const debouncedEndPosition = useDebounce(endPosition, AUTO_SAVE_DELAY);

  // Auto-save when debounced values change
  useEffect(() => {
    // CRITICAL: If debounced values haven't caught up to local state yet, skip.
    // This prevents stale debounced values from overwriting freshly-saved edits
    // (e.g., when user types fast then blurs, blur saves immediately, but debounce
    // is still holding old value and would overwrite the new save).
    if (
      debouncedStepName !== stepName ||
      debouncedHeading !== heading ||
      debouncedBodyText !== bodyText ||
      debouncedButtonText !== buttonText
    ) {
      return;
    }

    // Skip if values haven't actually changed from the step's current values
    const hasChanged =
      debouncedStepName !== step.title ||
      selectedType !== step.type ||
      debouncedHeading !== (step.heading || '') ||
      debouncedBodyText !== (step.bodyText || '') ||
      debouncedButtonText !== (step.buttonText || '') ||
      cardColor !== (step.cardColor || 'blue') ||
      targetObjectId !== (step.targetObjectId || '') ||
      targetChildPath !== (step.targetChildPath || '') ||
      JSON.stringify(debouncedEndPosition) !== JSON.stringify(step.endPosition);

    // If endPosition was just updated from props, skip this auto-save cycle
    if (endPositionJustUpdatedFromPropsRef.current) {
      endPositionJustUpdatedFromPropsRef.current = false;
      return;
    }

    // If we're currently recording, skip auto-save entirely
    if (isRecordingPosition) {
      return;
    }

    if (hasChanged) {
      onUpdate(
        createUpdatedStep({
          title: debouncedStepName,
          heading: debouncedHeading || undefined,
          bodyText: debouncedBodyText || undefined,
          buttonText: debouncedButtonText || undefined,
          targetObjectId: targetObjectId || undefined,
          targetChildPath: targetChildPath || undefined,
          endPosition: debouncedEndPosition,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedStepName,
    selectedType,
    debouncedHeading,
    debouncedBodyText,
    debouncedButtonText,
    stepName,
    heading,
    bodyText,
    buttonText,
    cardColor,
    targetObjectId,
    targetChildPath,
    debouncedEndPosition,
    step.id,
    createUpdatedStep,
    onUpdate,
    isRecordingPosition,
  ]);

  const handleStepNameChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStepName(e.target.value);
  }, []);

  const handleFieldBlur = useCallback(
    (field: 'stepName' | 'heading' | 'bodyText' | 'buttonText', value: string) => {
      // Read actual DOM value and save immediately.
      // Using uncontrolled inputs (defaultValue) ensures the DOM value is always
      // authoritative, eliminating React state timing issues when typing fast.
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

  // Handle starting edit mode
  const handleStartEdit = useCallback((field: 'heading' | 'bodyText' | 'buttonText') => {
    setEditingField(field);
  }, []);

  // Handle Escape key to cancel edit
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
      // Auto-save immediately when type is selected
      onUpdate(createUpdatedStep({ type }));
    },
    [createUpdatedStep, onUpdate]
  );

  const handleChangeStepType = useCallback(() => {
    setShowTypeSelection(true);
    // Keep the current selectedType so the UI shows which one was previously selected
    // When user selects a new type, handleTypeSelect will update it
  }, []);

  // Auto-focus step name input when newly created (empty step)
  useEffect(() => {
    if (isOpen && step.title === '' && step.type === null) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        stepNameTextareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, step.title, step.type]);

  // Auto-resize textareas
  useEffect(() => {
    const textarea = stepNameTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, TEXTAREA_CONFIG.MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > TEXTAREA_CONFIG.MAX_HEIGHT ? 'auto' : 'hidden';
  }, [stepName]);

  useEffect(() => {
    const textarea = headingTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, TEXTAREA_CONFIG.MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > TEXTAREA_CONFIG.MAX_HEIGHT ? 'auto' : 'hidden';
  }, [heading]);

  useEffect(() => {
    const textarea = bodyTextTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${scrollHeight}px`;
  }, [bodyText]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingField === 'heading' && headingTextareaRef.current) {
      headingTextareaRef.current.focus();
    } else if (editingField === 'bodyText' && bodyTextTextareaRef.current) {
      bodyTextTextareaRef.current.focus();
    } else if (editingField === 'buttonText' && buttonTextInputRef.current) {
      buttonTextInputRef.current.focus();
    }
  }, [editingField]);

  // Handle using selected object
  const handleUseSelectedObject = useCallback(() => {
    if (selectedObjectId) {
      // Parse selection ID to extract object ID and optional child path
      const parsed = parseSelectionId(selectedObjectId);
      if (!parsed) return;

      const selectedObject = objects.find((obj) => obj.id === parsed.objectId);
      if (!selectedObject) return;

      // Calculate start position
      let startPosition: { x: number; y: number; z: number };
      let childPath: string | undefined;

      if (parsed.childPath) {
        // Child mesh is selected - calculate its world position
        const childWorldPos = calculateChildWorldPosition(selectedObject, parsed.childPath);
        if (childWorldPos) {
          startPosition = childWorldPos;
          childPath = parsed.childPath;
        } else {
          // Child not found, fall back to parent
          startPosition = {
            x: selectedObject.transform.x,
            y: selectedObject.transform.y,
            z: selectedObject.transform.z,
          };
        }
      } else {
        // Parent object is selected
        startPosition = {
          x: selectedObject.transform.x,
          y: selectedObject.transform.y,
          z: selectedObject.transform.z,
        };
      }

      // Update local state immediately for instant UI feedback
      setTargetObjectId(parsed.objectId);
      setTargetChildPath(childPath || '');

      // Update the step with the new target object ID, child path, and start position
      const updatedStep: SimStep = createUpdatedStep({
        targetObjectId: parsed.objectId,
        targetChildPath: childPath,
        startPosition: startPosition,
      });
      onUpdate(updatedStep);
    }
  }, [selectedObjectId, objects, createUpdatedStep, onUpdate]);

  // Handle recording toggle
  const handleToggleRecording = useCallback(() => {
    if (isRecordingPosition) {
      if (onStopRecording) {
        onStopRecording();
      }
    } else {
      if (onStartRecording) {
        onStartRecording();
      }
    }
  }, [isRecordingPosition, onStartRecording, onStopRecording]);

  // Handle removing target object
  const handleRemoveTargetObject = useCallback(() => {
    setTargetObjectId('');
    setTargetChildPath('');
    const updatedStep: SimStep = createUpdatedStep({
      targetObjectId: undefined,
      targetChildPath: undefined,
      startPosition: undefined,
      endPosition: undefined,
      startRotation: undefined,
      endRotation: undefined,
      startScale: undefined,
      endScale: undefined,
    });
    onUpdate(updatedStep);
  }, [createUpdatedStep, onUpdate]);

  // Handle focusing on target object
  const handleFocusTargetObject = useCallback(
    (targetObj: SceneObject) => {
      if (onFocusObject) {
        onFocusObject(targetObj);
      }
    },
    [onFocusObject]
  );

  // Handle delete button click (click twice to confirm)
  const handleDeleteClick = useCallback(() => {
    if (confirmingDelete) {
      // Second click - actually delete
      if (onDelete) {
        onDelete();
      }
      setConfirmingDelete(false);
    } else {
      // First click - show confirmation
      setConfirmingDelete(true);
      // Reset confirmation state after 3 seconds if user doesn't confirm
      setTimeout(() => {
        setConfirmingDelete(false);
      }, 3000);
    }
  }, [confirmingDelete, onDelete]);

  // Update end position when recording (called from parent via step updates)
  useEffect(() => {
    if (step.endPosition && isRecordingPosition) {
      setEndPosition(step.endPosition);
    }
  }, [step.endPosition, isRecordingPosition]);

  // Only render if open
  if (!isOpen) {
    return null;
  }

  const isInfoCardSelected = selectedType === 'info-card';
  const isMoveItemSelected = selectedType === 'move-item';
  const currentStepTypeConfig = STEP_TYPES.find((st) => st.type === selectedType);
  const currentTheme = COLOR_THEMES[cardColor];

  // Find target object for move-item step (use local state for immediate updates, fallback to step prop)
  const effectiveTargetObjectId = targetObjectId || step.targetObjectId;
  const effectiveTargetChildPath = targetChildPath || step.targetChildPath;
  const targetObject = effectiveTargetObjectId
    ? objects.find((obj) => obj.id === effectiveTargetObjectId)
    : null;
  const targetChild =
    targetObject && effectiveTargetChildPath
      ? findChildByPathString(targetObject, effectiveTargetChildPath)
      : null;
  const hasSelectedObject = selectedObjectId !== null && selectedObjectId !== undefined;
  const canUseSelectedObject = hasSelectedObject && selectedObjectId !== effectiveTargetObjectId;

  return (
    <div className="rounded-[16px] border border-white/50 bg-white/50 p-4 shadow-sm backdrop-blur-sm">
      {/* Header: Step Name and Minimize Button */}
      <div className="mb-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            id={`step-name-input-${step.id}`}
            ref={stepNameTextareaRef}
            value={stepName}
            onChange={handleStepNameChange}
            onBlur={(e) => handleFieldBlur('stepName', e.currentTarget.value)}
            placeholder="Enter step name..."
            maxLength={200}
            rows={1}
            className="w-full resize-none border-0 bg-transparent p-0 text-sm font-medium leading-snug text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-0"
          />
        </div>
        <button
          onClick={onMinimize}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-600"
          title="Minimize step"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Step Type Indicator / Change Button (compact inline version) */}
      {!showTypeSelection && selectedType !== null && currentStepTypeConfig && (
        <div className="mb-4 flex items-center gap-2">
          <div
            className={`
              flex items-center gap-2 rounded-[12px] border px-3 py-1.5
              ${
                currentStepTypeConfig.color === 'blue'
                  ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-blue-100/40 shadow-sm shadow-blue-500/10'
                  : 'border-purple-200/60 bg-gradient-to-br from-purple-50/80 to-purple-100/40 shadow-sm shadow-purple-500/10'
              }
            `}
          >
            {(() => {
              const Icon = currentStepTypeConfig.icon;
              return (
                <Icon
                  size={14}
                  className={
                    currentStepTypeConfig.color === 'blue' ? 'text-blue-600' : 'text-purple-600'
                  }
                />
              );
            })()}
            <span className="text-xs font-semibold text-slate-700">
              {currentStepTypeConfig.label}
            </span>
          </div>
          {/* Help icon for step type */}
          <span
            title={
              isInfoCardSelected
                ? 'Shows a pop-up card with information to trainees. They read the heading and body text, then click the button to continue.'
                : 'Guides trainees to move an object in the 3D scene.'
            }
          >
            <HelpCircle size={12} className="text-slate-400" />
          </span>
          <button
            onClick={handleChangeStepType}
            className="flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium text-slate-500 transition-all hover:bg-white/60 hover:text-blue-600"
            title="Change step type"
          >
            <RefreshCw size={12} />
            <span>Change</span>
          </button>
        </div>
      )}

      {/* Step Type Selection (shown when no type selected or Change Step Type clicked) */}
      {showTypeSelection && (
        <div className="mb-4">
          <label className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Step Type
            <span title="Choose what kind of step this is. Each type does something different for the trainee.">
              <HelpCircle size={12} className="text-slate-400" />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {STEP_TYPES.map((stepType) => {
              const Icon = stepType.icon;
              const isSelected = selectedType === stepType.type;
              const isBlue = stepType.color === 'blue';

              return (
                <button
                  key={stepType.type}
                  onClick={() => handleTypeSelect(stepType.type)}
                  className={`
                    group relative aspect-square cursor-pointer overflow-hidden rounded-[20px] border backdrop-blur-xl transition-all duration-300 ease-out
                    ${
                      isBlue
                        ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/90 via-blue-100/80 to-white/70 shadow-lg shadow-blue-500/15 hover:border-blue-300/70 hover:shadow-xl hover:shadow-blue-500/25'
                        : 'border-purple-200/60 bg-gradient-to-br from-purple-50/90 via-purple-100/80 to-white/70 shadow-lg shadow-purple-500/15 hover:border-purple-300/70 hover:shadow-xl hover:shadow-purple-500/25'
                    }
                    ${
                      isSelected
                        ? isBlue
                          ? 'border-blue-400/70 shadow-2xl shadow-blue-500/40 ring-2 ring-blue-400/60'
                          : 'border-purple-400/70 shadow-2xl shadow-purple-500/40 ring-2 ring-purple-400/60'
                        : 'hover:scale-[1.02]'
                    }
                  `}
                >
                  {/* Premium frosted glass overlay */}
                  <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 backdrop-blur-sm" />

                  {/* Content Container */}
                  <div className="relative flex h-full flex-col items-center justify-center px-6 py-5">
                    {/* Icon and Heading - visible by default, fade out on hover */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 opacity-100 transition-opacity duration-500 ease-out group-hover:opacity-0">
                      {/* Icon */}
                      <div
                        className={`flex items-center justify-center ${
                          isBlue ? 'text-blue-600' : 'text-purple-600'
                        }`}
                      >
                        <Icon size={28} strokeWidth={2.5} />
                      </div>

                      {/* Title - single line, no wrap */}
                      <p className="whitespace-nowrap text-xs font-semibold leading-tight text-slate-800">
                        {stepType.label}
                      </p>
                    </div>

                    {/* Description - hidden by default, fades in on hover */}
                    <div className="absolute inset-0 flex items-center justify-center px-6 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100">
                      <p className="text-center text-[11px] font-medium leading-relaxed text-slate-600">
                        {stepType.description}
                      </p>
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="absolute right-3 top-3">
                        <div
                          className={`h-2 w-2 animate-pulse rounded-full shadow-lg ring-2 ${
                            isBlue
                              ? 'bg-blue-600 ring-blue-400/50'
                              : 'bg-purple-600 ring-purple-400/50'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Card Preview (shown when Info Card type is selected) */}
      {isInfoCardSelected && !showTypeSelection && (
        <div className="border-t border-white/30 pt-4">
          {/* Preview Label */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Preview
            </span>
            <span title="Preview of how the Info Card will look. Click edit icons to change content.">
              <HelpCircle size={12} className="text-slate-400" />
            </span>
          </div>

          {/* Info Card Preview */}
          <div className="relative overflow-hidden rounded-[20px] border border-slate-300/60 bg-white/50 shadow-sm backdrop-blur-sm">
            {/* Heading Section - Colored */}
            <div className={`group relative ${currentTheme.headingBg} rounded-t-[20px] px-6 py-4`}>
              {editingField === 'heading' ? (
                <textarea
                  ref={headingTextareaRef}
                  defaultValue={heading}
                  onBlur={(e) => handleFieldBlur('heading', e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleFieldBlur('heading', headingTextareaRef.current?.value ?? '');
                    }
                  }}
                  placeholder="Enter heading..."
                  maxLength={200}
                  rows={1}
                  className={`w-full resize-none border-0 bg-transparent p-0 text-base font-medium leading-tight ${currentTheme.headingText} placeholder-white/60 focus:outline-none focus:ring-0`}
                  style={{
                    minHeight: '1.5rem',
                  }}
                />
              ) : (
                <>
                  <div
                    className={`min-h-[1.5rem] cursor-pointer text-base font-medium leading-tight ${currentTheme.headingText}`}
                    onClick={() => handleStartEdit('heading')}
                  >
                    {heading || <span className="opacity-60">Enter heading...</span>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit('heading');
                    }}
                    className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/20 text-white opacity-70 transition-all hover:bg-white/30 hover:opacity-100"
                    title="Edit heading"
                    aria-label="Edit heading"
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {/* Body Text Section - Neutral */}
            <div className="group relative px-6 py-5">
              {editingField === 'bodyText' ? (
                <textarea
                  ref={bodyTextTextareaRef}
                  defaultValue={bodyText}
                  onBlur={(e) => handleFieldBlur('bodyText', e.currentTarget.value)}
                  placeholder="Enter body text..."
                  rows={4}
                  className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-0"
                />
              ) : (
                <>
                  <div
                    className="min-h-[4rem] cursor-pointer whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
                    onClick={() => handleStartEdit('bodyText')}
                  >
                    {bodyText || <span className="text-slate-400">Enter body text...</span>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit('bodyText');
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/80 text-slate-400 opacity-70 transition-all hover:bg-white hover:text-slate-600 hover:opacity-100"
                    title="Edit body text"
                    aria-label="Edit body text"
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {/* Button Section */}
            <div className="group relative flex justify-center border-t border-white/30 px-6 py-4">
              {editingField === 'buttonText' ? (
                <input
                  ref={buttonTextInputRef}
                  type="text"
                  defaultValue={buttonText}
                  onBlur={(e) => handleFieldBlur('buttonText', e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFieldBlur('buttonText', buttonTextInputRef.current?.value ?? '');
                    }
                  }}
                  placeholder="OK"
                  maxLength={50}
                  className="rounded-[12px] border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              ) : (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit('buttonText');
                    }}
                    className="rounded-[12px] bg-slate-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
                    title="Edit button text"
                  >
                    {buttonText || 'OK'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit('buttonText');
                    }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 opacity-70 shadow-sm transition-all hover:bg-blue-50 hover:text-blue-600 hover:opacity-100"
                    title="Edit button text"
                    aria-label="Edit button text"
                  >
                    <Pencil size={10} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Color Style Options */}
          <div className="mt-4 flex items-center justify-center gap-2.5">
            {(['blue', 'green', 'yellow', 'red', 'gray'] as const).map((color) => {
              const isSelected = cardColor === color;
              const theme = COLOR_THEMES[color];
              return (
                <button
                  key={color}
                  onClick={() => {
                    setCardColor(color);
                    const updatedStep: SimStep = {
                      ...step,
                      cardColor: color,
                      title: stepName,
                      type: selectedType,
                      heading: heading || undefined,
                      bodyText: bodyText || undefined,
                      buttonText: buttonText || undefined,
                    };
                    onUpdate(updatedStep);
                  }}
                  className={`
                    relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200
                    ${
                      isSelected
                        ? 'scale-110 border-slate-400 ring-2 ring-slate-200/50'
                        : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                    }
                    ${theme.circleColor}
                  `}
                  title={color.charAt(0).toUpperCase() + color.slice(1)}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Move Item Configuration (shown when Move Item type is selected) */}
      {isMoveItemSelected && !showTypeSelection && (
        <div className="border-t border-white/30 pt-4">
          {/* Settings Label */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Settings
            </span>
            <span title="Configure which object to move/rotate/scale and what its end transform should be.">
              <HelpCircle size={12} className="text-slate-400" />
            </span>
          </div>

          {/* Object Selection Section */}
          <div className="mb-4 space-y-3">
            {/* Target Object Display */}
            <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Target Object
              </label>
              {targetObject ? (
                <div className="group relative">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => handleFocusTargetObject(targetObject)}
                      className="flex w-full items-center gap-2 rounded-[12px] border border-slate-200/60 bg-slate-100/50 px-3 py-2 pr-10 text-left transition-all hover:border-slate-300/80 hover:bg-slate-100/80"
                    >
                      {(() => {
                        const Icon = OBJECT_ICONS[targetObject.type] || Info;
                        return <Icon size={14} className="text-slate-600" />;
                      })()}
                      <span className="flex-1 text-xs font-medium text-slate-700">
                        {targetObject.name}
                        {targetChild && ` / ${targetChild.name}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTargetObject()}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                      title="Remove target object"
                      aria-label="Remove target object"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex-1 rounded-[10px] border border-slate-200/60 bg-slate-100/50 px-3 py-2 text-xs text-slate-400">
                    No object selected
                  </div>
                  <button
                    onClick={handleUseSelectedObject}
                    disabled={!canUseSelectedObject}
                    className={`
                      flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-2 text-xs font-semibold transition-all
                      ${
                        canUseSelectedObject
                          ? 'border-slate-300/60 bg-slate-100/50 text-slate-700 hover:border-slate-400/80 hover:bg-slate-200/60'
                          : 'cursor-not-allowed border-slate-200/60 bg-slate-100/50 text-slate-400'
                      }
                    `}
                    title={
                      canUseSelectedObject
                        ? 'Use the currently selected object in the scene'
                        : 'Select an object in the scene first'
                    }
                  >
                    <CheckCircle2 size={13} />
                    <span>Use Selected Object</span>
                  </button>
                </div>
              )}
              {!targetObject && effectiveTargetObjectId && (
                <p className="mt-2 text-xs text-rose-600">
                  Object not found. It may have been deleted.
                </p>
              )}
              {targetObject && effectiveTargetChildPath && !targetChild && (
                <p className="mt-2 text-xs text-rose-600">
                  Child mesh not found. It may have been deleted.
                </p>
              )}
            </div>

            {/* End Position Recording Section - Only show when target object is assigned */}
            {targetObject && (
              <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  End Transform
                </label>
                <div className="space-y-3">
                  {isRecordingPosition ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-[10px] border border-blue-200/60 bg-blue-50/50 px-3 py-2">
                        <Circle size={12} className="animate-pulse fill-blue-600 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">
                          Recording... Move/rotate/scale the object to its end transform
                        </span>
                      </div>
                      <button
                        onClick={handleToggleRecording}
                        className="w-full rounded-[10px] border border-rose-300/60 bg-rose-100/50 px-3 py-2 text-xs font-semibold text-rose-700 transition-all hover:border-rose-400/80 hover:bg-rose-200/60"
                      >
                        Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const hasEndTransform =
                          !!step.endPosition || !!step.endRotation || !!step.endScale;
                        return hasEndTransform;
                      })() ? (
                        <div className="flex items-center gap-2 rounded-[10px] border border-green-200/60 bg-green-50/50 px-3 py-2">
                          <CheckCircle size={14} className="text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            End transform recorded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-[10px] border border-slate-200/60 bg-slate-100/50 px-3 py-2">
                          <Circle size={14} className="text-slate-400" />
                          <span className="text-xs text-slate-400">No end transform recorded</span>
                        </div>
                      )}
                      <button
                        onClick={handleToggleRecording}
                        className="w-full rounded-[10px] border border-blue-300/60 bg-blue-100/50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:border-blue-400/80 hover:bg-blue-200/60"
                        title="Click to start recording the end transform. Move/rotate/scale the object, then click Stop Recording."
                      >
                        {(() => {
                          const hasEndTransform =
                            !!step.endPosition || !!step.endRotation || !!step.endScale;
                          return hasEndTransform ? 'Record New Transform' : 'Record End Transform';
                        })()}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Button Section - Always at bottom */}
      {onDelete && (
        <div className="mt-4 border-t border-white/30 pt-4">
          <button
            onClick={handleDeleteClick}
            className={`
              flex w-full items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-xs font-medium transition-all
              ${
                confirmingDelete
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                  : 'border border-slate-200/60 bg-white/40 text-slate-500 hover:border-rose-200 hover:bg-rose-50/50 hover:text-rose-600'
              }
            `}
          >
            <Trash2 size={14} />
            <span>{confirmingDelete ? 'Click again to confirm delete' : 'Delete Step'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
