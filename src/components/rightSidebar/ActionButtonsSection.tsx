import React, { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../Button';

export interface ActionButtonsSectionProps {
  onReset: () => void;
  onDelete: () => void;
  resetDisabled?: boolean;
}

const HelpTooltip = memo<{ targetRef: React.RefObject<HTMLDivElement | null>; show: boolean }>(({ targetRef, show }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (show && targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [show, targetRef]);

  if (!show) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] w-52 -translate-x-1/2 -translate-y-full rounded-lg border border-white/40 bg-slate-800/95 px-3 py-2 text-center text-xs leading-relaxed text-white shadow-lg backdrop-blur-sm"
      style={{ top: position.top, left: position.left }}
    >
      <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/40 bg-slate-800/95" />
      Returns this object (and all parts) to their original position
    </div>,
    document.body
  );
});
HelpTooltip.displayName = 'HelpTooltip';

export const ActionButtonsSection = memo<ActionButtonsSectionProps>(({ onReset, onDelete, resetDisabled = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const helpIconRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mt-auto flex gap-2 pt-2" data-testid="action-buttons-section">
      <div className="flex-1">
        <Button
          variant="secondary"
          size="md"
          className="h-10 w-full justify-center rounded-[20px] border-blue-100/50 bg-blue-50/50 text-xs font-semibold text-blue-600 shadow-none hover:border-blue-200 hover:bg-blue-100 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onReset}
          disabled={resetDisabled}
          data-testid="reset-button"
        >
          <RotateCcw size={14} className="mr-1.5" />
          Reset
          <div
            ref={helpIconRef}
            className="ml-1"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <HelpCircle size={12} className="text-blue-400" />
          </div>
        </Button>
        <HelpTooltip targetRef={helpIconRef} show={showTooltip} />
      </div>

      <div className="flex-1">
        <Button
          variant="secondary"
          size="md"
          className="h-10 w-full justify-center rounded-[20px] border-red-100/50 bg-red-50/50 text-xs font-semibold text-red-500 shadow-none hover:border-red-200 hover:bg-red-100 hover:text-red-600"
          onClick={onDelete}
          data-testid="delete-button"
        >
          <Trash2 size={14} className="mr-1.5" />
          Delete
        </Button>
      </div>
    </div>
  );
});
ActionButtonsSection.displayName = 'ActionButtonsSection';

