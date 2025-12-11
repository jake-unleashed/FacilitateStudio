import React, { useState, useEffect, useRef } from 'react';
import { Bug, Box } from 'lucide-react';
import { Button } from './Button';

interface DebugMenuProps {
  onAddCube: () => void;
  hasSelectedObject: boolean;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ onAddCube, hasSelectedObject }) => {
  const [isOpen, setIsOpen] = useState(false);
  const prevHasSelectedObjectRef = useRef(hasSelectedObject);

  // Close debug menu only when object details panel opens (transition from false to true)
  useEffect(() => {
    const wasSelected = prevHasSelectedObjectRef.current;
    prevHasSelectedObjectRef.current = hasSelectedObject;

    // Only close if hasSelectedObject just became true (object was just selected)
    if (!wasSelected && hasSelectedObject && isOpen) {
      setIsOpen(false);
    }
  }, [hasSelectedObject, isOpen]);

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-[100] flex flex-col items-end gap-3">
      {/* Toggle Button - subtle, not too obvious */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[20px] border transition-all duration-300 ${
          isOpen
            ? 'border-slate-300 bg-white/80 text-slate-700 shadow-sm'
            : 'border-white/40 bg-white/50 text-slate-400 hover:bg-white/70 hover:text-slate-600'
        }`}
        aria-label="Toggle debug menu"
      >
        <Bug size={18} strokeWidth={2} />
      </button>

      {/* Debug Panel - only rendered when open to avoid blocking */}
      {isOpen && (
        <div
          data-testid="debug-panel-wrapper"
          className="animate-in fade-in slide-in-from-top-1 pointer-events-auto origin-top-right duration-200"
        >
          <div
            data-testid="debug-panel"
            className="rounded-[32px] border border-white/40 bg-white/70 p-5 shadow-glass backdrop-blur-xl"
          >
            {/* Panel Header */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[12px] bg-slate-100 text-slate-500">
                <Bug size={14} />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Debug Tools</h3>
            </div>

            {/* Debug Actions */}
            <div className="flex flex-col gap-2">
              <p className="pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Add Objects
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={onAddCube}
                className="justify-start gap-2 rounded-[16px] border-white/50 bg-white/60 px-4 text-left hover:bg-white/80"
              >
                <Box size={14} className="text-blue-500" />
                <span className="text-slate-700">Add Cube</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
