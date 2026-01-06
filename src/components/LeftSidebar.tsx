import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  ListOrdered,
  Box,
  ChevronRight,
  Upload,
  ChevronsLeft,
  LucideIcon,
  Clock,
  Info,
  MoveRight,
  Layers,
} from 'lucide-react';
import {
  SidebarSection,
  SimStep,
  SceneObject,
  ChildMesh,
  StepType,
  createChildSelectionId,
  parseSelectionId,
  pathToString,
} from '../types';
import { OBJECT_ICONS } from '../constants';
import { StepCard } from './StepCard';
import { AssetUploadButton } from './AssetUploadButton';
import { RecentAssetsList } from './RecentAssetsList';
import { AssetMetadata, UploadProgress } from '../types/model';

// Step type configuration for minimized step indicators
interface StepTypeConfig {
  type: StepType;
  icon: LucideIcon;
  color: 'text-blue-600' | 'text-purple-600';
  label: string;
}

const STEP_TYPE_CONFIGS: StepTypeConfig[] = [
  {
    type: 'info-card',
    icon: Info,
    color: 'text-blue-600',
    label: 'Info Card',
  },
  {
    type: 'move-item',
    icon: MoveRight,
    color: 'text-purple-600',
    label: 'Move Item',
  },
];

// ============================================================================
// Types
// ============================================================================

interface LeftSidebarProps {
  activeTab: SidebarSection | null;
  setActiveTab: (tab: SidebarSection | null) => void;
  steps: SimStep[];
  objects: SceneObject[];
  onSelectObject: (id: string | null) => void;
  selectedObjectId: string | null;
  /** Focus camera on object (with optional child path for child-level focus) */
  onFocusObject?: (object: SceneObject, childPath?: string) => void;
  onAddStep?: (step: Omit<SimStep, 'id'>) => void;
  onUpdateStep?: (step: SimStep) => void;
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: (stepId: string) => void;
  recordingPositionForStepId?: string | null;
  onUploadAsset?: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
}

interface NavItemProps {
  id: SidebarSection;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

interface HierarchyItemProps {
  obj: SceneObject;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  /** Focus camera on object (with optional child path for child-level focus) */
  onFocusObject?: (obj: SceneObject, childPath?: string) => void;
}

interface ChildItemProps {
  child: ChildMesh;
  parentObj: SceneObject;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string) => void;
  depth: number;
}

// ============================================================================
// Memoized Sub-Components
// ============================================================================

// Memoized navigation item to prevent unnecessary re-renders
const NavItem = memo<NavItemProps>(({ icon: Icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex w-full flex-col items-center justify-center gap-1.5 rounded-[20px] p-3 transition-all duration-300
        ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
            : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
        }
      `}
    >
      <Icon
        size={22}
        strokeWidth={isActive ? 2.5 : 2}
        className="transition-transform duration-300 group-hover:scale-110"
      />
      <span className="text-[10px] font-semibold tracking-tight">{label}</span>
    </button>
  );
});
NavItem.displayName = 'NavItem';

// Recursive child item component - supports nested children
const ChildItem = memo<ChildItemProps>(
  ({ child, parentObj, selectedObjectId, onSelectObject, onFocusObject, depth }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const childPathStr = pathToString(child.path);
    const parsedSelection = parseSelectionId(selectedObjectId);
    const isChildSelected =
      parsedSelection?.objectId === parentObj.id && parsedSelection.childPath === childPathStr;

    // Get nested children - children that are direct descendants of this child
    // A child is a "direct descendant" if:
    // 1. Its path starts with this child's path
    // 2. No intermediate path (between this child and that child) exists in the children list
    const nestedChildren = useMemo(() => {
      if (!parentObj.children) return [];

      // Build a set of all child path strings for quick lookup
      const allPathStrings = new Set(parentObj.children.map((c) => pathToString(c.path)));
      const thisPathStr = pathToString(child.path);

      return parentObj.children.filter((c) => {
        // Must be longer than this child's path
        if (c.path.length <= child.path.length) return false;

        // Check if this child's path is a prefix of the candidate's path
        for (let i = 0; i < child.path.length; i++) {
          if (c.path[i] !== child.path[i]) return false;
        }

        // Check that no intermediate path exists between this child and the candidate
        // For example, if this is "A" and candidate is "A.B.C", check if "A.B" exists
        for (let i = child.path.length + 1; i < c.path.length; i++) {
          const intermediatePath = c.path.slice(0, i);
          const intermediatePathStr = pathToString(intermediatePath);
          if (allPathStrings.has(intermediatePathStr) && intermediatePathStr !== thisPathStr) {
            // An intermediate parent exists, so this isn't a direct descendant
            return false;
          }
        }

        return true;
      });
    }, [parentObj.children, child.path]);

    const hasNestedChildren = nestedChildren.length > 0;

    // Auto-expand only when a descendant (not this child itself) is selected
    // This ensures the path to the selected child is visible, but doesn't auto-open on selection
    useEffect(() => {
      if (
        parsedSelection?.objectId === parentObj.id &&
        parsedSelection.childPath &&
        parsedSelection.childPath !== childPathStr
      ) {
        // Check if the selected child is a descendant of this child
        if (parsedSelection.childPath.startsWith(childPathStr + '.')) {
          setIsExpanded(true);
        }
      }
    }, [parsedSelection, parentObj.id, childPathStr]);

    const handleToggleExpand = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Also prevent default to ensure it doesn't bubble
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);

        // If closing and a descendant is selected, deselect it
        if (
          !newExpanded &&
          parsedSelection?.objectId === parentObj.id &&
          parsedSelection.childPath
        ) {
          if (
            parsedSelection.childPath.startsWith(childPathStr + '.') ||
            parsedSelection.childPath === childPathStr
          ) {
            onSelectObject(null);
          }
        }
      },
      [isExpanded, parsedSelection, parentObj.id, childPathStr, onSelectObject]
    );

    const handleChildClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const childSelectionId = createChildSelectionId(parentObj.id, childPathStr);
        onSelectObject(childSelectionId);
        if (onFocusObject) {
          onFocusObject(parentObj, childPathStr);
        }
      },
      [parentObj, childPathStr, onSelectObject, onFocusObject]
    );

    // Create selection ID for this child (used for scroll-to-view)
    const childSelectionId = createChildSelectionId(parentObj.id, childPathStr);

    return (
      <div className="space-y-0.5">
        <div
          onClick={handleChildClick}
          data-selection-id={childSelectionId}
          className={`
          group flex cursor-pointer items-center gap-2 rounded-[12px] p-2 text-sm transition-all duration-200
          ${
            isChildSelected
              ? 'scale-[1.02] bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-600 hover:scale-[1.01] hover:bg-white/70'
          }
        `}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          {/* Expand/Collapse Toggle for nested children */}
          {hasNestedChildren ? (
            <button
              onClick={handleToggleExpand}
              className={`
              flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-all duration-200
              ${
                isChildSelected
                  ? 'text-emerald-100 hover:bg-emerald-400'
                  : 'text-slate-400 hover:bg-slate-100'
              }
            `}
            >
              <ChevronRight
                size={12}
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              />
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          {/* Child Icon */}
          <div
            className={`rounded-[8px] p-1 transition-all duration-200 ${
              isChildSelected
                ? 'bg-emerald-400 text-white'
                : 'bg-slate-50 text-slate-400 group-hover:bg-white'
            }`}
          >
            <Layers size={12} />
          </div>

          {/* Child Name */}
          <span className="flex-1 truncate text-xs font-medium">{child.name}</span>

          {/* Selection Indicator */}
          {isChildSelected && <ChevronRight size={12} className="text-emerald-200" />}
        </div>

        {/* Nested Children List - only render if there are actually nested children */}
        {hasNestedChildren && nestedChildren.length > 0 && (
          <div
            className={`
            ml-3 space-y-0.5 overflow-hidden border-l-2 border-slate-100 pl-2 transition-all duration-200 ease-out
            ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}
          `}
          >
            {nestedChildren.map((nestedChild) => (
              <ChildItem
                key={pathToString(nestedChild.path)}
                child={nestedChild}
                parentObj={parentObj}
                selectedObjectId={selectedObjectId}
                onSelectObject={onSelectObject}
                onFocusObject={onFocusObject}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
ChildItem.displayName = 'ChildItem';

// Memoized hierarchy item with expandable children support
const HierarchyItem = memo<HierarchyItemProps>(
  ({ obj, selectedObjectId, onSelectObject, onFocusObject }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const Icon = OBJECT_ICONS[obj.type] || Box;
    const hasChildren = obj.children && obj.children.length > 0;

    // Parse the current selection to check if this object or any of its children is selected
    const parsedSelection = parseSelectionId(selectedObjectId);
    const isParentSelected =
      parsedSelection?.objectId === obj.id && parsedSelection.childPath === null;
    const isAnyChildSelected =
      parsedSelection?.objectId === obj.id && parsedSelection.childPath !== null;

    // Get direct children - children that are at the "top level" of the hierarchy
    // These are children whose path doesn't have a parent in the children list
    // (i.e., no other child is a prefix of their path)
    const directChildren = useMemo(() => {
      if (!obj.children || obj.children.length === 0) return [];

      // Build a set of all child path strings for quick lookup
      const allPathStrings = new Set(obj.children.map((c) => pathToString(c.path)));

      // A child is a "direct" child if none of its path prefixes are in the children list
      return obj.children.filter((child) => {
        // Check if any prefix of this child's path is another child
        for (let i = 1; i < child.path.length; i++) {
          const prefixPath = child.path.slice(0, i);
          const prefixPathStr = pathToString(prefixPath);
          if (allPathStrings.has(prefixPathStr)) {
            // This child has a parent in the children list, so it's not a direct child
            return false;
          }
        }
        return true;
      });
    }, [obj.children]);

    // Auto-expand only when a descendant is selected (to show the path), but not when just selecting
    // This ensures the path to the selected child is visible without auto-opening on every selection
    useEffect(() => {
      if (isAnyChildSelected && parsedSelection.childPath && !isExpanded) {
        // Only auto-expand if there's actually a selected child path
        setIsExpanded(true);
      }
    }, [isAnyChildSelected, parsedSelection?.childPath, isExpanded]);

    const handleParentClick = useCallback(() => {
      onSelectObject(obj.id);
      if (onFocusObject) {
        onFocusObject(obj);
      }
    }, [obj, onSelectObject, onFocusObject]);

    const handleToggleExpand = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Also prevent default to ensure it doesn't bubble
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);

        // If closing and a child is selected, deselect it
        if (!newExpanded && isAnyChildSelected) {
          onSelectObject(null);
        }
      },
      [isExpanded, isAnyChildSelected, onSelectObject]
    );

    return (
      <div className="space-y-0.5">
        {/* Parent Item */}
        <div
          onClick={handleParentClick}
          data-selection-id={obj.id}
          className={`
          group flex cursor-pointer items-center gap-2 rounded-[16px] p-2.5 text-sm transition-all duration-200
          ${
            isParentSelected
              ? 'scale-[1.02] bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : isAnyChildSelected
                ? 'bg-blue-50 text-slate-800'
                : 'text-slate-700 hover:scale-[1.01] hover:bg-white/60'
          }
        `}
        >
          {/* Expand/Collapse Toggle - only show if there are direct children to display */}
          {hasChildren && directChildren.length > 0 ? (
            <button
              onClick={handleToggleExpand}
              className={`
              flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-all duration-200
              ${
                isParentSelected
                  ? 'text-blue-100 hover:bg-blue-500'
                  : 'text-slate-400 hover:bg-slate-100'
              }
            `}
            >
              <ChevronRight
                size={14}
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              />
            </button>
          ) : (
            <div className="w-6 flex-shrink-0" />
          )}

          {/* Icon */}
          <div
            className={`rounded-[10px] p-1.5 transition-all duration-200 ${
              isParentSelected
                ? 'bg-blue-500 text-white'
                : 'bg-white text-slate-400 shadow-sm group-hover:shadow'
            }`}
          >
            <Icon size={14} />
          </div>

          {/* Name */}
          <span className="flex-1 truncate font-medium">{obj.name}</span>
        </div>

        {/* Children List (Expandable with animation) */}
        {hasChildren && directChildren.length > 0 && (
          <div
            className={`
            ml-3 space-y-0.5 overflow-hidden border-l-2 border-slate-100 pl-2 transition-all duration-200 ease-out
            ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
          `}
          >
            {/* Direct children - nested children are handled recursively by ChildItem */}
            {directChildren.map((child) => (
              <ChildItem
                key={pathToString(child.path)}
                child={child}
                parentObj={obj}
                selectedObjectId={selectedObjectId}
                onSelectObject={onSelectObject}
                onFocusObject={onFocusObject}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
HierarchyItem.displayName = 'HierarchyItem';

// ============================================================================
// Main Component
// ============================================================================

const LeftSidebarInner: React.FC<LeftSidebarProps> = ({
  activeTab,
  setActiveTab,
  steps,
  objects,
  onSelectObject,
  selectedObjectId,
  onFocusObject,
  onAddStep,
  onUpdateStep,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  onUploadAsset,
  uploadProgress,
  recentAssets = [],
  onAddRecentAsset,
}) => {
  // State for tracking which step is open
  const [openedStepId, setOpenedStepId] = useState<string | null>(null);

  // Ref for scrollable content area (used for auto-scroll to selected item)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const handleClosePanel = useCallback(() => {
    setActiveTab(null);
  }, [setActiveTab]);

  const handleSwitchToAddPanel = useCallback(() => {
    setActiveTab('add');
  }, [setActiveTab]);

  const handleAddStepClick = useCallback(() => {
    if (onAddStep) {
      const newStep: Omit<SimStep, 'id'> = {
        title: '',
        description: '',
        completed: false,
        type: null,
      };
      onAddStep(newStep);
    }
  }, [onAddStep]);

  // Auto-open the most recently added step (only if it's empty and no step is currently open)
  useEffect(() => {
    if (steps.length > 0 && openedStepId === null) {
      const lastStep = steps[steps.length - 1];
      // Check if it's a newly created empty step
      if (lastStep.title === '' && lastStep.type === null && lastStep.description === '') {
        setOpenedStepId(lastStep.id);
      }
    }
    // Close if the opened step was deleted
    if (openedStepId !== null && !steps.find((s) => s.id === openedStepId)) {
      setOpenedStepId(null);
    }
  }, [steps, openedStepId]);

  const handleStepClick = useCallback(
    (stepId: string) => {
      setOpenedStepId(stepId === openedStepId ? null : stepId);
    },
    [openedStepId]
  );

  const handleMinimizeStep = useCallback(() => {
    setOpenedStepId(null);
  }, []);

  return (
    <div
      className={`
        pointer-events-none absolute bottom-4 left-4 top-24 z-40 flex transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${activeTab ? 'w-[26rem] gap-6' : 'w-20 gap-0'}
    `}
    >
      {/* Floating Navigation Strip - Tier 1 Rounding (32px) */}
      <div className="pointer-events-auto flex h-fit w-20 shrink-0 -translate-y-16 flex-col items-center gap-2 self-center rounded-[32px] border border-white/40 bg-white/70 p-2 shadow-glass backdrop-blur-xl">
        <NavItem
          id="add"
          icon={Plus}
          label="Add"
          isActive={activeTab === 'add'}
          onClick={handleAddClick}
        />
        <NavItem
          id="objects"
          icon={Box}
          label="Objects"
          isActive={activeTab === 'objects'}
          onClick={handleObjectsClick}
        />
        <NavItem
          id="steps"
          icon={ListOrdered}
          label="Steps"
          isActive={activeTab === 'steps'}
          onClick={handleStepsClick}
        />
      </div>

      {/* Floating Content Panel - Tier 1 Rounding (32px) */}
      <div
        className={`
          pointer-events-auto flex flex-1 origin-left flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${activeTab ? 'translate-x-0 opacity-100' : 'w-0 flex-none -translate-x-8 border-0 p-0 opacity-0'}
      `}
      >
        {/* Header */}
        <div className="flex h-16 min-w-[20rem] shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">
            {activeTab === 'add' && 'Add New'}
            {activeTab === 'steps' && 'Steps'}
            {activeTab === 'objects' && 'Scene Objects'}
          </h2>
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
          className="custom-scrollbar min-w-[20rem] flex-1 space-y-5 overflow-y-auto p-5"
        >
          {/* Add Panel */}
          {activeTab === 'add' && (
            <div className="space-y-6">
              {/* Upload Section - Tier 2 Rounding (20px) */}
              {onUploadAsset ? (
                <AssetUploadButton onUpload={onUploadAsset} uploadProgress={uploadProgress} />
              ) : (
                <div className="group cursor-pointer rounded-[20px] border border-blue-100/50 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 shadow-sm transition-all hover:border-blue-300">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-blue-500 shadow-lg shadow-blue-500/10 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Upload Asset</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Section */}
              <div>
                <h3 className="mb-4 pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Recent
                </h3>
                {onAddRecentAsset ? (
                  <RecentAssetsList
                    assets={recentAssets}
                    onAddAsset={onAddRecentAsset}
                    emptyMessage="No recent assets"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Clock size={20} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No recent assets</p>
                    <p className="mt-1 text-xs text-slate-400">Uploaded assets will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Steps Panel */}
          {activeTab === 'steps' && (
            <div className="space-y-4">
              {steps.map((step, index) => {
                const isOpen = step.id === openedStepId;
                // Use a composite key that includes step properties to force re-render when step changes
                const stepKey = `${step.id}-${step.targetObjectId || 'none'}-${step.endPosition ? JSON.stringify(step.endPosition) : 'none'}`;
                return (
                  <div key={stepKey}>
                    {isOpen ? (
                      <StepCard
                        step={step}
                        stepNumber={index + 1}
                        isOpen={true}
                        onUpdate={onUpdateStep || (() => {})}
                        onMinimize={handleMinimizeStep}
                        selectedObjectId={selectedObjectId}
                        objects={objects}
                        onStartRecording={
                          onStartRecordingPosition
                            ? () => onStartRecordingPosition(step.id)
                            : undefined
                        }
                        onStopRecording={
                          onStopRecordingPosition
                            ? () => onStopRecordingPosition(step.id)
                            : undefined
                        }
                        isRecordingPosition={recordingPositionForStepId === step.id}
                        onFocusObject={onFocusObject}
                      />
                    ) : (
                      <div
                        onClick={() => handleStepClick(step.id)}
                        className="group relative cursor-pointer rounded-[20px] border border-white/50 bg-white/50 p-4 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`
                              mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm
                              ${
                                step.completed
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-slate-200 text-slate-500'
                              }
                            `}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug text-slate-700">
                              {step.title || 'Untitled Step'}
                            </p>
                            {/* Step Type Badge - Smaller, below step name */}
                            {step.type &&
                              (() => {
                                const stepTypeConfig = STEP_TYPE_CONFIGS.find(
                                  (config) => config.type === step.type
                                );
                                if (!stepTypeConfig) return null;
                                const Icon = stepTypeConfig.icon;
                                const isBlue = stepTypeConfig.color === 'text-blue-600';
                                return (
                                  <div
                                    className={`
                                    mt-1.5 flex w-fit items-center gap-1.5 rounded-lg border px-2 py-0.5
                                    ${
                                      isBlue
                                        ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/60 to-blue-100/30'
                                        : 'border-purple-200/60 bg-gradient-to-br from-purple-50/60 to-purple-100/30'
                                    }
                                  `}
                                  >
                                    <Icon size={12} className={stepTypeConfig.color} />
                                    <span className="text-[10px] font-medium text-slate-600">
                                      {stepTypeConfig.label}
                                    </span>
                                  </div>
                                );
                              })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Step Button */}
              <button
                onClick={handleAddStepClick}
                className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-slate-300 bg-white/20 py-4 text-sm font-medium text-slate-500 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
              >
                <Plus size={18} />
                Add Step
              </button>
            </div>
          )}

          {/* Objects Panel */}
          {activeTab === 'objects' && (
            <div className="space-y-2">
              {objects.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Box size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No objects in scene</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add objects from the{' '}
                    <button
                      onClick={handleSwitchToAddPanel}
                      className="font-semibold text-blue-500 underline decoration-blue-300 underline-offset-2 transition-colors hover:text-blue-600"
                    >
                      Add New
                    </button>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {objects.map((obj) => (
                    <HierarchyItem
                      key={obj.id}
                      obj={obj}
                      selectedObjectId={selectedObjectId}
                      onSelectObject={onSelectObject}
                      onFocusObject={onFocusObject}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export memoized component
export const LeftSidebar = memo(LeftSidebarInner);
