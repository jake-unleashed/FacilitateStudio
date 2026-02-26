import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Plus,
  ListOrdered,
  Box,
  Globe2,
  ChevronsLeft,
} from 'lucide-react';
import { usePopup } from '../contexts/PopupContext';
import type { StepCardHandle } from './StepCard';
import type { LeftSidebarHandle, LeftSidebarProps } from './leftSidebar/types';
import { isNewEmptyStep, EMPTY_NEW_STEP } from './leftSidebar/constants';
import { NavItem } from './leftSidebar/NavItem';
import { AddPanel } from './leftSidebar/AddPanel';
import { StepsPanel } from './leftSidebar/StepsPanel';
import { ObjectsPanel } from './leftSidebar/ObjectsPanel';
import { ScenePanel } from './leftSidebar/ScenePanel';
import { HelpIcon } from './HelpIcon';

export type { LeftSidebarHandle } from './leftSidebar/types';

// ============================================================================
// Main Component
// ============================================================================

const LeftSidebarInner = forwardRef<LeftSidebarHandle, LeftSidebarProps>(({
  activeTab,
  setActiveTab,
  steps,
  objects,
  onSelectObject,
  selectedObjectId,
  onFocusObject,
  onAddStep,
  onInsertStep,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  onUploadAsset,
  uploadProgress,
  recentAssets = [],
  starterAssets = [],
  onAddRecentAsset,
  onRemoveAsset,
  generations = [],
  onGenerateFromImage,
  onCancelGeneration,
  onRetryGeneration,
  backgroundImage,
  onUploadBackground,
  onRemoveBackground,
  isUploadingBackground,
  backgroundUploadStatusText,
  isBackgroundTextureLoading,
  backgroundImageFlowPhase,
}, ref) => {
  // State for tracking which step is open
  const [openedStepId, setOpenedStepId] = useState<string | null>(null);

  // Global popup for request modal
  const { showPopup } = usePopup();

  // Ref for scrollable content area (used for auto-scroll to selected item)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const stepCardRefs = useRef<Map<string, StepCardHandle | null>>(new Map());

  const handleStepCardHandleChange = useCallback(
    (stepId: string, handle: StepCardHandle | null) => {
      if (handle) {
        stepCardRefs.current.set(stepId, handle);
      } else {
        stepCardRefs.current.delete(stepId);
      }
    },
    []
  );

  const flushPendingEdits = useCallback(() => {
    for (const handle of stepCardRefs.current.values()) {
      handle?.flushPendingUpdates();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flushPendingEdits,
    }),
    [flushPendingEdits]
  );

  // Ref to track previous step count for detecting newly added steps
  const prevStepIdsRef = useRef<string[]>(steps.map((s) => s.id));

  const scrollStepIntoView = useCallback((stepId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-step-id="${CSS.escape(stepId)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, []);

  // Auto-scroll to selected object when selection changes
  useEffect(() => {
    if (!selectedObjectId || activeTab !== 'objects') return;

    // Small delay to allow DOM updates (expansion animations, etc.)
    const timeoutId = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Find the element with the matching selection ID
      const selectedElement = container.querySelector(
        `[data-selection-id="${CSS.escape(selectedObjectId)}"]`
      );

      if (selectedElement) {
        // Scroll the element into view with smooth animation, centered vertically
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }, 150); // Delay to allow expand animations to complete

    return () => clearTimeout(timeoutId);
  }, [selectedObjectId, activeTab]);

  // Memoized click handlers for nav items
  const handleAddClick = useCallback(() => {
    setActiveTab(activeTab === 'add' ? null : 'add');
  }, [activeTab, setActiveTab]);

  const handleObjectsClick = useCallback(() => {
    setActiveTab(activeTab === 'objects' ? null : 'objects');
  }, [activeTab, setActiveTab]);

  const handleStepsClick = useCallback(() => {
    setActiveTab(activeTab === 'steps' ? null : 'steps');
  }, [activeTab, setActiveTab]);

  const handleScenesClick = useCallback(() => {
    setActiveTab(activeTab === 'scenes' ? null : 'scenes');
  }, [activeTab, setActiveTab]);

  const handleClosePanel = useCallback(() => {
    setActiveTab(null);
  }, [setActiveTab]);

  const handleSwitchToAddPanel = useCallback(() => {
    setActiveTab('add');
  }, [setActiveTab]);

  const handleAddStepClick = useCallback(() => {
    if (onAddStep) {
      onAddStep(EMPTY_NEW_STEP);
    }
  }, [onAddStep]);

  const handleRequestModel = useCallback(() => {
    showPopup({
      type: 'info',
      title: 'Request a 3D Model',
      message:
        "To request a 3D model, please contact the Facilitate team. We'll work with you to create the perfect model for your needs.",
    });
  }, [showPopup]);

  // Auto-open newly created steps and scroll to them
  useEffect(() => {
    const prevIds = prevStepIdsRef.current;
    const currentIds = steps.map((s) => s.id);

    // Detect if a new step was added (IDs increased)
    if (currentIds.length > prevIds.length) {
      const newStep = steps.find((s) => !prevIds.includes(s.id));

      if (isNewEmptyStep(newStep)) {
        // Auto-open the newly created step
        setOpenedStepId(newStep.id);

        // Scroll the newly created step into view after a short delay to allow DOM update
        setTimeout(() => {
          scrollStepIntoView(newStep.id);
        }, 150);
      }
    }

    // Close if the opened step was deleted
    if (openedStepId !== null && !steps.find((s) => s.id === openedStepId)) {
      setOpenedStepId(null);
    }

    // Update the ref with current IDs
    prevStepIdsRef.current = currentIds;
  }, [steps, openedStepId, scrollStepIntoView]);

  const handleStepClick = useCallback(
    (stepId: string) => {
      setOpenedStepId(stepId === openedStepId ? null : stepId);
    },
    [openedStepId]
  );

  const handleMinimizeStep = useCallback(() => {
    setOpenedStepId(null);
  }, []);

  // Drag-and-drop sensors for step reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before starting
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for step reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = steps.findIndex((step) => step.id === active.id);
        const newIndex = steps.findIndex((step) => step.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1 && onReorderSteps) {
          const previousOrder = steps.map((step) => step.id);
          const reorderedSteps = arrayMove(steps, oldIndex, newIndex);
          const newOrder = reorderedSteps.map((step) => step.id);
          onReorderSteps(previousOrder, newOrder);
        }
      }
    },
    [steps, onReorderSteps]
  );

  // Step IDs for sortable context
  const stepIds = useMemo(() => steps.map((step) => step.id), [steps]);

  // NOTE: Open width is tuned for: compact strip + panel (`w-80`) + `ml-1` spacing.
  return (
    <div
      className={`
        pointer-events-none absolute bottom-4 left-4 top-24 z-40 flex will-change-[width] transition-[width] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${activeTab ? 'w-[23rem]' : 'w-20'}
    `}
    >
      {/* Floating Navigation Strip - Tier 1 Rounding (32px) */}
      <div
        className={`
          pointer-events-auto flex h-fit shrink-0 -translate-y-16 flex-col items-center gap-2 self-center rounded-[32px] border border-white/40 bg-white/70 p-2 shadow-glass backdrop-blur-xl transform-gpu will-change-[width,transform] transition-[width,transform] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${activeTab ? 'w-11 -translate-x-1' : 'w-20 translate-x-0'}
        `}
      >
        <NavItem
          id="add"
          icon={Plus}
          label="Add"
          isActive={activeTab === 'add'}
          onClick={handleAddClick}
          compact={!!activeTab}
        />
        <NavItem
          id="objects"
          icon={Box}
          label="Objects"
          isActive={activeTab === 'objects'}
          onClick={handleObjectsClick}
          compact={!!activeTab}
        />
        <NavItem
          id="steps"
          icon={ListOrdered}
          label="Steps"
          isActive={activeTab === 'steps'}
          onClick={handleStepsClick}
          compact={!!activeTab}
        />
        <NavItem
          id="scenes"
          icon={Globe2}
          label="Scene"
          isActive={activeTab === 'scenes'}
          onClick={handleScenesClick}
          compact={!!activeTab}
        />
      </div>

      {/* Floating Content Panel - Tier 1 Rounding (32px) */}
      <div
        className={`
          origin-left overflow-hidden rounded-[32px] backdrop-blur-xl
          transform-gpu will-change-[width,opacity,transform,margin-left]
          transition-[width,opacity,transform,margin-left] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${activeTab ? 'pointer-events-auto ml-1 flex w-80 translate-x-0 flex-col border border-white/40 bg-white/70 opacity-100 shadow-glass' : 'pointer-events-none ml-0 flex w-0 -translate-x-2 flex-col border border-white/0 bg-white/0 opacity-0 shadow-none'}
      `}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-800">
              {activeTab === 'add' && 'Add New'}
              {activeTab === 'steps' && 'Steps'}
              {activeTab === 'objects' && 'Scene Objects'}
              {activeTab === 'scenes' && 'Scene'}
            </h2>
            {activeTab === 'steps' && (
              <HelpIcon content="Your training steps in order. Drag to rearrange them." />
            )}
            {activeTab === 'objects' && (
              <HelpIcon content="All objects in your project. Select one to edit or use in a step." />
            )}
            {activeTab === 'add' && (
              <HelpIcon content="Add objects to build your training." />
            )}
            {activeTab === 'scenes' && (
              <HelpIcon content="Customize scene-level visuals like 360 backgrounds." />
            )}
          </div>
          <button
            onClick={handleClosePanel}
            className="flex h-8 w-8 items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800"
            title="Minimize Sidebar"
          >
            <ChevronsLeft size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div
          ref={scrollContainerRef}
          className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5"
        >
          {activeTab === 'add' && (
            <AddPanel
              onUploadAsset={onUploadAsset}
              uploadProgress={uploadProgress}
              recentAssets={recentAssets}
              starterAssets={starterAssets}
              onAddRecentAsset={onAddRecentAsset}
              onRemoveAsset={onRemoveAsset}
              onRequestModel={handleRequestModel}
              generations={generations}
              onGenerateFromImage={onGenerateFromImage}
              onCancelGeneration={onCancelGeneration}
              onRetryGeneration={onRetryGeneration}
            />
          )}

          {activeTab === 'steps' && (
            <StepsPanel
              steps={steps}
              stepIds={stepIds}
              sensors={sensors}
              onDragEnd={handleDragEnd}
              onInsertStep={onInsertStep}
              openedStepId={openedStepId}
              onUpdateStep={onUpdateStep}
              onMinimizeStep={handleMinimizeStep}
              onStepClick={handleStepClick}
              onStepCardHandleChange={handleStepCardHandleChange}
              selectedObjectId={selectedObjectId}
              objects={objects}
              onStartRecordingPosition={onStartRecordingPosition}
              onStopRecordingPosition={onStopRecordingPosition}
              recordingPositionForStepId={recordingPositionForStepId}
              onFocusObject={onFocusObject}
              onDeleteStep={onDeleteStep}
              onAddStepClick={handleAddStepClick}
            />
          )}

          {activeTab === 'objects' && (
            <div className="space-y-2">
              <ObjectsPanel
                objects={objects}
                selectedObjectId={selectedObjectId}
                onSelectObject={onSelectObject}
                onFocusObject={onFocusObject}
                onSwitchToAddPanel={handleSwitchToAddPanel}
              />
            </div>
          )}

          {activeTab === 'scenes' && onUploadBackground && onRemoveBackground && (
            <ScenePanel
              backgroundImage={backgroundImage}
              onUploadBackground={onUploadBackground}
              onRemoveBackground={onRemoveBackground}
              isUploading={isUploadingBackground}
              statusText={backgroundUploadStatusText}
              isTextureLoading={isBackgroundTextureLoading}
              phase={backgroundImageFlowPhase}
            />
          )}
        </div>
      </div>
    </div>
  );
});
LeftSidebarInner.displayName = 'LeftSidebarInner';

// Export memoized component
export const LeftSidebar = memo(LeftSidebarInner);
