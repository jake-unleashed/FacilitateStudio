import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from './topBar/BrandLogo';
import { HistoryControls } from './topBar/HistoryControls';
import { SimulationTitle } from './topBar/SimulationTitle';
import { ActionButtons } from './topBar/ActionButtons';
import type { TopBarProps } from './topBar/types';

// =============================================================================
// Types
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
const TopBarInner: React.FC<TopBarProps> = ({
  title,
  onTitleChange,
  onRequestHome,
  saveStatus = 'idle',
  saveErrorMessage = null,
  onManualSave,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onPreviewClick,
  onPublishClick,
  projectId,
}) => {
  const navigate = useNavigate();

  const handlePreviewClick = useCallback(() => {
    if (onPreviewClick) {
      onPreviewClick();
    } else if (projectId) {
      navigate(`/preview/${projectId}`);
    }
  }, [onPreviewClick, projectId, navigate]);
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLogoClick = useCallback(() => {
    if (onRequestHome) {
      onRequestHome();
      return;
    }
    navigate('/');
  }, [navigate, onRequestHome]);

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
          <BrandLogo onClick={handleLogoClick} />
          <div className="hidden h-6 w-px bg-slate-900/10 sm:block" aria-hidden="true" />
          <HistoryControls
            saveStatus={saveStatus}
            saveErrorMessage={saveErrorMessage}
            onManualSave={onManualSave}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
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
        <ActionButtons onPreviewClick={handlePreviewClick} onPublishClick={onPublishClick} />
      </header>
    </div>
  );
};

// Export memoized component
export const TopBar = memo(TopBarInner);
