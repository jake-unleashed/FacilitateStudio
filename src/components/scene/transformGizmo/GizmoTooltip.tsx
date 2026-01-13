/**
 * GizmoTooltip Component
 *
 * Tooltip display for transform gizmo handles.
 */

import { memo } from 'react';
import { TooltipProps } from './types';

/**
 * Tooltip component for gizmo handles
 */
export const GizmoTooltip = memo<TooltipProps>(function GizmoTooltip({ text, visible }) {
  if (!visible) return null;

  return (
    <div
      className="animate-in fade-in pointer-events-none absolute left-1/2
                 top-12 -translate-x-1/2 whitespace-nowrap rounded-lg
                 bg-slate-800/95 px-3 py-1.5
                 text-xs font-medium
                 text-white
                 shadow-lg backdrop-blur-md duration-150"
      style={{ zIndex: 1000 }}
    >
      {text}
      <div
        className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 
                   rotate-45 bg-slate-800/95"
      />
    </div>
  );
});
