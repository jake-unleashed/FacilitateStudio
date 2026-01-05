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
} from 'lucide-react';
import { StepType, SimStep, SceneObject } from '../types';
import { OBJECT_ICONS } from '../constants';

interface StepCardProps {
  step: SimStep;
  stepNumber: number;
  isOpen: boolean;
  onUpdate: (updated: SimStep) => void;
  onMinimize: () => void;
  selectedObjectId?: string | null;
  objects?: SceneObject[];
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecordingPosition?: boolean;
  onFocusObject?: (object: SceneObject) => void;
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

// Custom debounce hook
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

export const StepCard: React.FC<StepCardProps> = ({
  step,
  stepNumber,
  isOpen,
  onUpdate,
  onMinimize,
  selectedObjectId,
  objects = [],
  onStartRecording,
  onStopRecording,
  isRecordingPosition = false,
  onFocusObject,
}) => {
  // Local state for form fields
  const [stepName, setStepName] = useState(step.title);
  const [selectedType, setSelectedType] = useState<StepType>(step.type || 'info-card');
  const [showTypeSelection, setShowTypeSelection] = useState(step.type === null || step.type === undefined);
  const [heading, setHeading] = useState(step.heading || '');
  const [bodyText, setBodyText] = useState(step.bodyText || '');
  const [buttonText, setButtonText] = useState(step.buttonText || '');
  const [cardColor, setCardColor] = useState<'blue' | 'green' | 'yellow' | 'red' | 'gray'>(
    step.cardColor || 'blue'
  );
  // Move Item specific state
  const [targetObjectId, setTargetObjectId] = useState(step.targetObjectId || '');
  const [endPosition, setEndPosition] = useState(step.endPosition);

  // Edit state for inline editing
  const [editingField, setEditingField] = useState<'heading' | 'bodyText' | 'buttonText' | null>(
    null
  );

  const stepNameTextareaRef = useRef<HTMLTextAreaElement>(null);
  const headingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextTextareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonTextInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when step prop changes
  // Use individual properties to ensure we catch all changes
  useEffect(() => {
    setStepName(step.title);
    setSelectedType(step.type);
    setShowTypeSelection(step.type === null);
    setHeading(step.heading || '');
    setBodyText(step.bodyText || '');
    setButtonText(step.buttonText || '');
    setCardColor(step.cardColor || 'blue');
    // Always sync from step prop - it's the source of truth
    setTargetObjectId(step.targetObjectId || '');
    setEndPosition(step.endPosition);
  }, [
    step.id,
    step.title,
    step.type,
    step.heading,
    step.bodyText,
    step.buttonText,
    step.cardColor,
    step.targetObjectId,
    step.endPosition,
  ]);

  // Helper function to create updated step object
  const createUpdatedStep = useCallback(
    (overrides?: Partial<SimStep>): SimStep => {
      // Use local state for move-item fields to ensure we have the latest values
      const baseStep: SimStep = {
        ...step,
        title: stepName,
        type: selectedType,
        heading: heading || undefined,
        bodyText: bodyText || undefined,
        buttonText: buttonText || undefined,
        cardColor: cardColor,
        // Use local state for targetObjectId to ensure we have the latest value
        targetObjectId: targetObjectId || undefined,
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
      endPosition,
    ]
  );

  // Debounced values for auto-save
  const debouncedStepName = useDebounce(stepName, AUTO_SAVE_DELAY);
  const debouncedHeading = useDebounce(heading, AUTO_SAVE_DELAY);
  const debouncedBodyText = useDebounce(bodyText, AUTO_SAVE_DELAY);
  const debouncedButtonText = useDebounce(buttonText, AUTO_SAVE_DELAY);

  // Debounced values for move-item fields
  const debouncedTargetObjectId = useDebounce(targetObjectId, AUTO_SAVE_DELAY);
  const debouncedEndPosition = useDebounce(endPosition, AUTO_SAVE_DELAY);

  // Auto-save when debounced values change
  useEffect(() => {
    // Skip if values haven't actually changed from the step's current values
    const hasChanged =
      debouncedStepName !== step.title ||
      selectedType !== step.type ||
      debouncedHeading !== (step.heading || '') ||
      debouncedBodyText !== (step.bodyText || '') ||
      debouncedButtonText !== (step.buttonText || '') ||
      cardColor !== (step.cardColor || 'blue') ||
      debouncedTargetObjectId !== (step.targetObjectId || '') ||
      JSON.stringify(debouncedEndPosition) !== JSON.stringify(step.endPosition);

    if (hasChanged) {
      onUpdate(
        createUpdatedStep({
          title: debouncedStepName,
          heading: debouncedHeading || undefined,
          bodyText: debouncedBodyText || undefined,
          buttonText: debouncedButtonText || undefined,
          targetObjectId: debouncedTargetObjectId || undefined,
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
    cardColor,
    debouncedTargetObjectId,
    debouncedEndPosition,
    step.id,
    createUpdatedStep,
    onUpdate,
  ]);

  // Auto-save on blur for immediate feedback
  const handleBlur = useCallback(() => {
    onUpdate(createUpdatedStep());
    setEditingField(null);
  }, [createUpdatedStep, onUpdate]);

  // Handle starting edit mode
  const handleStartEdit = useCallback((field: 'heading' | 'bodyText' | 'buttonText') => {
    setEditingField(field);
  }, []);

  // Handle saving and exiting edit mode
  const handleSaveEdit = useCallback(() => {
    handleBlur();
  }, [handleBlur]);

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
      const selectedObject = objects.find((obj) => obj.id === selectedObjectId);
      if (selectedObject) {
        // Update local state immediately for instant UI feedback
        setTargetObjectId(selectedObjectId);
        // Auto-save start position when target object is assigned
        const startPosition = {
          x: selectedObject.transform.x,
          y: selectedObject.transform.y,
          z: selectedObject.transform.z,
        };
        // Update the step with the new target object ID and start position
        const updatedStep: SimStep = createUpdatedStep({
          targetObjectId: selectedObjectId,
          startPosition: startPosition,
        });
        onUpdate(updatedStep);
      }
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
    const updatedStep: SimStep = createUpdatedStep({
      targetObjectId: undefined,
      startPosition: undefined,
      endPosition: undefined,
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
  const targetObject = effectiveTargetObjectId
    ? objects.find((obj) => obj.id === effectiveTargetObjectId)
    : null;
  const hasSelectedObject = selectedObjectId !== null && selectedObjectId !== undefined;
  const canUseSelectedObject = hasSelectedObject && selectedObjectId !== effectiveTargetObjectId;

  return (
    <div className="rounded-[20px] border border-white/50 bg-white/50 p-5 shadow-sm backdrop-blur-sm">
      {/* Header: Step Number, Name, and Minimize Button */}
      <div className="mb-4 flex items-start gap-3">
        <div
          className={`
            mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm
            ${step.completed ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}
          `}
        >
          {stepNumber}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            id={`step-name-input-${step.id}`}
            ref={stepNameTextareaRef}
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            onBlur={handleBlur}
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
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
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
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
            </div>

            {/* Body Text Section - Neutral */}
            <div className="group relative px-6 py-5">
              {editingField === 'bodyText' ? (
                <textarea
                  ref={bodyTextTextareaRef}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  onBlur={handleSaveEdit}
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
                  >
                    <Pencil size={12} />
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
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveEdit();
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
                  >
                    <Pencil size={10} />
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
            <span title="Configure which object to move and where it should end up.">
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
                  <button
                    onClick={() => handleFocusTargetObject(targetObject)}
                    className="flex w-full items-center gap-2 rounded-[12px] border border-slate-200/60 bg-slate-100/50 px-3 py-2 text-left transition-all hover:border-slate-300/80 hover:bg-slate-100/80"
                  >
                    {(() => {
                      const Icon = OBJECT_ICONS[targetObject.type] || Info;
                      return <Icon size={14} className="text-slate-600" />;
                    })()}
                    <span className="flex-1 text-xs font-medium text-slate-700">
                      {targetObject.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTargetObject();
                      }}
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                      title="Remove target object"
                    >
                      <X size={11} />
                    </button>
                  </button>
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
            </div>

            {/* End Position Recording Section - Only show when target object is assigned */}
            {targetObject && (
              <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  End Position
                </label>
                <div className="space-y-3">
                  {isRecordingPosition ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-[10px] border border-blue-200/60 bg-blue-50/50 px-3 py-2">
                        <Circle size={12} className="animate-pulse fill-blue-600 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">
                          Recording... Move the object to its end position
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
                      {step.endPosition ? (
                        <div className="flex items-center gap-2 rounded-[10px] border border-green-200/60 bg-green-50/50 px-3 py-2">
                          <CheckCircle size={14} className="text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            End position recorded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-[10px] border border-slate-200/60 bg-slate-100/50 px-3 py-2">
                          <Circle size={14} className="text-slate-400" />
                          <span className="text-xs text-slate-400">No end position recorded</span>
                        </div>
                      )}
                      <button
                        onClick={handleToggleRecording}
                        className="w-full rounded-[10px] border border-blue-300/60 bg-blue-100/50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:border-blue-400/80 hover:bg-blue-200/60"
                        title="Click to start recording the end position. Move the object, then click Stop Recording."
                      >
                        {step.endPosition ? 'Record New Position' : 'Record End Position'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
