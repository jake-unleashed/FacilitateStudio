import React, { memo, useCallback } from 'react';
import { Box, Layers, X } from 'lucide-react';
import { OBJECT_ICONS } from '../../constants';
import type { SceneObject } from '../../types';

export interface PanelHeaderProps {
  objectType: SceneObject['type'];
  isChild?: boolean;
  onClose: () => void;
}

export const PanelHeader = memo<PanelHeaderProps>(({ objectType, isChild = false, onClose }) => {
  const Icon = isChild ? Layers : OBJECT_ICONS[objectType] || Box;

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const iconClasses = isChild
    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
    : 'bg-blue-500 text-white shadow-md shadow-blue-500/20';

  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ${iconClasses}`}
          title={isChild ? 'Child Object' : `Type: ${objectType}`}
          data-testid="object-type-icon"
        >
          <Icon size={16} />
        </div>
        <h2 className="truncate text-sm font-bold text-slate-900">Object Details</h2>
      </div>
      <button
        onClick={handleClose}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800 active:scale-95"
        aria-label="Close"
        data-testid="close-button"
      >
        <X size={18} />
      </button>
    </div>
  );
});
PanelHeader.displayName = 'PanelHeader';

