import React, { useState, useEffect, useRef } from 'react';
import { Activity, Bug, Box, ChevronDown, Cpu, Monitor, Play } from 'lucide-react';
import { Button } from './Button';
import type { PerformanceStats } from './PerformanceMonitor';

interface DebugMenuProps {
  onAddCube: () => void;
  onPopulateTestSteps?: () => void;
  hasSelectedObject: boolean;
  /** Whether performance monitoring is enabled in this build/runtime (typically dev-only). */
  performanceEnabled?: boolean;
  performanceStats?: PerformanceStats | null;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({
  onAddCube,
  onPopulateTestSteps,
  hasSelectedObject,
  performanceEnabled = false,
  performanceStats = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const prevHasSelectedObjectRef = useRef(hasSelectedObject);

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-emerald-600';
    if (fps >= 30) return 'text-amber-600';
    return 'text-red-600';
  };

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
              <p className="pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">
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
              {onPopulateTestSteps && (
                <>
                  <p className="mt-2 pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Testing
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onPopulateTestSteps}
                    className="justify-start gap-2 rounded-[16px] border-white/50 bg-white/60 px-4 text-left hover:bg-white/80"
                  >
                    <Play size={14} className="text-green-500" />
                    <span className="text-slate-700">Populate Test Steps</span>
                  </Button>
                </>
              )}

              {performanceEnabled && (
                <>
                  {/* Performance Stats (dev) */}
                  <p className="mt-2 pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Performance
                  </p>
                  <details className="group rounded-[20px] border border-white/40 bg-white/60 p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[16px] text-left text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-[12px] bg-white/60 text-slate-500 shadow-sm">
                          <Activity size={14} />
                        </span>
                        <span>Show performance stats</span>
                      </span>
                      <ChevronDown
                        size={16}
                        className="text-slate-400 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>

                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                      {!performanceStats ? (
                        <div className="col-span-2 rounded-[16px] border border-white/40 bg-white/50 px-3 py-2 text-slate-500">
                          Collecting stats…
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Monitor size={12} aria-hidden="true" />
                            <span>FPS</span>
                          </div>
                          <div className={`text-right font-bold ${getFpsColor(performanceStats.fps)}`}>
                            {performanceStats.fps}
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Cpu size={12} aria-hidden="true" />
                            <span>Frame</span>
                          </div>
                          <div className="text-right font-medium text-slate-700">
                            {performanceStats.frameTime}ms
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span aria-hidden="true">▶</span>
                            <span>Draws</span>
                          </div>
                          <div className="text-right font-medium text-slate-700">
                            {performanceStats.drawCalls}
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span aria-hidden="true">△</span>
                            <span>Tris</span>
                          </div>
                          <div className="text-right font-medium text-slate-700">
                            {performanceStats.triangles > 1000
                              ? `${(performanceStats.triangles / 1000).toFixed(1)}k`
                              : performanceStats.triangles}
                          </div>

                          {performanceStats.memory > 0 && (
                            <>
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <span aria-hidden="true">⬢</span>
                                <span>Mem</span>
                              </div>
                              <div className="text-right font-medium text-slate-700">
                                {performanceStats.memory}MB
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
