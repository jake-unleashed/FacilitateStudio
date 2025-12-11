import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Undo, Redo, Share2, MonitorPlay, Save, Menu, Pencil } from 'lucide-react';
import { Button } from './Button';

// =============================================================================
// Types
// =============================================================================

interface TopBarProps {
  /** The current simulation title */
  title: string;
  /** Callback fired when the title is changed */
  onTitleChange: (newTitle: string) => void;
}

// =============================================================================
// Sub-components (Memoized for performance)
// =============================================================================

/**
 * Brand logo with gradient hover effect.
 * Uses a two-layer approach: gradient layer underneath, solid overlay on top.
 * The solid overlay fades out on hover to reveal the gradient.
 */
const BrandLogo = memo(() => (
  <div className="group flex cursor-pointer select-none flex-col justify-center">
    <h1 className="relative text-xl font-bold leading-none tracking-tight">
      {/* Gradient layer (always rendered, provides layout) */}
      <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent [backface-visibility:hidden]">
        Facilitate
      </span>
      {/* Solid overlay (fades out on hover to reveal gradient) */}
      <span
        className="pointer-events-none absolute inset-0 text-slate-800 transition-opacity duration-300 ease-in-out will-change-[opacity] [backface-visibility:hidden] group-hover:opacity-0"
        aria-hidden="true"
      >
        Facilitate
      </span>
    </h1>
    <span className="ml-0.5 mt-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.35em] text-slate-400 transition-colors duration-300 ease-in-out group-hover:text-blue-500">
      Studio
    </span>
  </div>
));
BrandLogo.displayName = 'BrandLogo';

/**
 * History control buttons (Save, Undo, Redo).
 */
const HistoryControls = memo(() => (
  <div className="hidden items-center gap-1 sm:flex">
    <Button variant="ghost" size="icon" aria-label="Save" className="h-10 w-10 rounded-[20px]">
      <Save size={18} />
    </Button>
    <div className="ml-1 flex items-center gap-1 rounded-[20px] border border-white/20 bg-slate-100/30 p-1">
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Undo"
        className="h-9 w-9 rounded-[20px]"
      >
        <Undo size={16} />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Redo" className="h-9 w-9 rounded-[20px]">
        <Redo size={16} />
      </Button>
    </div>
  </div>
));
HistoryControls.displayName = 'HistoryControls';

interface SimulationTitleProps {
  title: string;
  isEditing: boolean;
  tempTitle: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onTempTitleChange: (value: string) => void;
  onStartEditing: () => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Editable simulation title in the center of the header.
 */
const SimulationTitle = memo<SimulationTitleProps>(
  ({
    title,
    isEditing,
    tempTitle,
    inputRef,
    onTempTitleChange,
    onStartEditing,
    onSave,
    onKeyDown,
  }) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onTempTitleChange(e.target.value);
      },
      [onTempTitleChange]
    );

    return (
      <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center md:flex">
        {isEditing ? (
          <input
            ref={inputRef}
            value={tempTitle}
            onChange={handleChange}
            onBlur={onSave}
            onKeyDown={onKeyDown}
            className="w-[200px] border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center text-sm font-bold text-slate-800 focus:outline-none"
            aria-label="Simulation title"
          />
        ) : (
          <button
            type="button"
            className="group flex cursor-pointer items-center gap-2 rounded-[20px] px-4 py-1.5 outline-none transition-all hover:bg-black/5 focus:bg-black/5"
            onClick={onStartEditing}
            title="Edit simulation title"
          >
            <span className="max-w-[200px] truncate text-sm font-bold text-slate-700 lg:max-w-[400px]">
              {title}
            </span>
            <div className="rounded-[12px] bg-slate-200/50 p-1 text-slate-400 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
              <Pencil size={12} strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>
    );
  }
);
SimulationTitle.displayName = 'SimulationTitle';

/**
 * Action buttons on the right side (Preview, Publish, Mobile Menu).
 */
const ActionButtons = memo(() => (
  <div className="z-10 flex items-center gap-3">
    <Button
      variant="secondary"
      className="hidden gap-2 rounded-[20px] border-white/40 bg-white/50 font-medium shadow-none hover:shadow-md sm:flex"
    >
      <MonitorPlay size={16} className="text-slate-500" />
      Preview
    </Button>
    <Button
      variant="primary"
      className="gap-2 rounded-[20px] pl-4 pr-5 shadow-lg shadow-blue-500/30"
    >
      <Share2 size={16} />
      Publish
    </Button>
    <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
      <Menu size={20} />
    </Button>
  </div>
));
ActionButtons.displayName = 'ActionButtons';

// =============================================================================
// Main Component
// =============================================================================

/**
 * TopBar component - Floating island header with brand, title editing, and actions.
 *
 * Features:
 * - Brand logo with smooth gradient hover effect
 * - Inline editable simulation title
 * - History controls (Save, Undo, Redo)
 * - Action buttons (Preview, Publish)
 * - Responsive mobile menu
 * - Glass morphism styling
 */
const TopBarInner: React.FC<TopBarProps> = ({ title, onTitleChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync tempTitle when external title prop changes
  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  // Focus and select input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  /**
   * Save the title if valid, otherwise revert to original.
   */
  const handleSave = useCallback(() => {
    const trimmedTitle = tempTitle.trim();
    if (trimmedTitle) {
      onTitleChange(trimmedTitle);
    } else {
      setTempTitle(title);
    }
    setIsEditing(false);
  }, [tempTitle, title, onTitleChange]);

  /**
   * Handle keyboard shortcuts in the title input.
   * - Enter: Save the title
   * - Escape: Cancel editing and revert
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setTempTitle(title);
        setIsEditing(false);
      }
    },
    [handleSave, title]
  );

  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleTempTitleChange = useCallback((value: string) => {
    setTempTitle(value);
  }, []);

  return (
    <div className="pointer-events-none absolute left-4 right-4 top-4 z-50 flex justify-center transition-all duration-300 md:left-24 md:right-24">
      {/* Floating Island Header - Tier 1 Rounding (32px) */}
      <header className="pointer-events-auto relative flex h-16 w-full items-center justify-between rounded-[32px] border border-white/40 bg-white/70 px-6 shadow-glass-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
        {/* Left Section: Brand + History Controls */}
        <div className="z-10 flex items-center gap-6">
          <BrandLogo />
          <div className="hidden h-6 w-px bg-slate-900/10 sm:block" aria-hidden="true" />
          <HistoryControls />
        </div>

        {/* Center Section: Simulation Title */}
        <SimulationTitle
          title={title}
          isEditing={isEditing}
          tempTitle={tempTitle}
          inputRef={inputRef}
          onTempTitleChange={handleTempTitleChange}
          onStartEditing={handleStartEditing}
          onSave={handleSave}
          onKeyDown={handleKeyDown}
        />

        {/* Right Section: Action Buttons */}
        <ActionButtons />
      </header>
    </div>
  );
};

// Export memoized component
export const TopBar = memo(TopBarInner);
