import React, { memo, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Activity, Cpu, Monitor, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PerformanceStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memory: number;
}

// ============================================================================
// Performance Stats Collector (Three.js scene component)
// ============================================================================

interface StatsCollectorProps {
  onStats: (stats: PerformanceStats) => void;
}

const StatsCollector: React.FC<StatsCollectorProps> = ({ onStats }) => {
  const { gl } = useThree();
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const updateIntervalRef = useRef(0);

  useFrame(() => {
    const now = performance.now();
    const frameTime = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // Track frame times for averaging
    frameTimesRef.current.push(frameTime);
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    frameCountRef.current++;
    updateIntervalRef.current += frameTime;

    // Update stats every 500ms to avoid too frequent updates
    if (updateIntervalRef.current >= 500) {
      const avgFrameTime =
        frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const fps = 1000 / avgFrameTime;

      // Get WebGL render info
      const info = gl.info;
      const drawCalls = info.render.calls;
      const triangles = info.render.triangles;

      // Get memory usage (if available)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memory = (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0;

      onStats({
        fps: Math.round(fps),
        frameTime: Math.round(avgFrameTime * 100) / 100,
        drawCalls,
        triangles,
        memory: Math.round(memory),
      });

      updateIntervalRef.current = 0;
    }
  });

  return null;
};

// ============================================================================
// Stats Display UI
// ============================================================================

interface StatsDisplayProps {
  stats: PerformanceStats;
  onClose: () => void;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const StatsDisplay = memo<StatsDisplayProps>(({ stats, onClose, position }) => {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // FPS color coding
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-emerald-400';
    if (fps >= 30) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div
      className={`pointer-events-auto fixed ${positionClasses[position]} z-[200] font-mono text-xs`}
    >
      {/* Dark mode panel for dev tools */}
      <div className="rounded-[20px] border border-slate-700/50 bg-slate-900/90 p-3 shadow-xl backdrop-blur-xl">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between border-b border-slate-700/50 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-[8px] bg-emerald-500/20 text-emerald-400">
              <Activity size={10} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Performance
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded-[8px] text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
            aria-label="Close performance monitor"
          >
            <X size={12} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {/* FPS */}
          <div className="flex items-center gap-1.5">
            <Monitor size={10} className="text-slate-500" />
            <span className="text-slate-400">FPS</span>
          </div>
          <span className={`text-right font-bold ${getFpsColor(stats.fps)}`}>{stats.fps}</span>

          {/* Frame Time */}
          <div className="flex items-center gap-1.5">
            <Cpu size={10} className="text-slate-500" />
            <span className="text-slate-400">Frame</span>
          </div>
          <span className="text-right font-medium text-slate-300">{stats.frameTime}ms</span>

          {/* Draw Calls */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">▶</span>
            <span className="text-slate-400">Draws</span>
          </div>
          <span className="text-right font-medium text-slate-300">{stats.drawCalls}</span>

          {/* Triangles */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">△</span>
            <span className="text-slate-400">Tris</span>
          </div>
          <span className="text-right font-medium text-slate-300">
            {stats.triangles > 1000 ? `${(stats.triangles / 1000).toFixed(1)}k` : stats.triangles}
          </span>

          {/* Memory (if available) */}
          {stats.memory > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">⬢</span>
                <span className="text-slate-400">Mem</span>
              </div>
              <span className="text-right font-medium text-slate-300">{stats.memory}MB</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
StatsDisplay.displayName = 'StatsDisplay';

// ============================================================================
// Performance Monitor Toggle Button
// ============================================================================

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const ToggleButton = memo<ToggleButtonProps>(({ isOpen, onClick, position }) => {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  if (isOpen) return null;

  // Subtle/faded style matching the Debug button
  return (
    <button
      onClick={onClick}
      className={`pointer-events-auto fixed ${positionClasses[position]} z-[200] flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/40 bg-white/50 text-slate-400 transition-all duration-300 hover:bg-white/70 hover:text-slate-600`}
      aria-label="Open performance monitor"
      title="Performance Monitor"
    >
      <Activity size={18} strokeWidth={2} />
    </button>
  );
});
ToggleButton.displayName = 'ToggleButton';

// ============================================================================
// Main Performance Monitor Component
// ============================================================================

/**
 * Performance Monitor component for development builds.
 * Displays real-time FPS, frame time, draw calls, triangle count, and memory usage.
 *
 * Usage:
 * 1. Import and add to your scene content (inside Canvas):
 *    <PerformanceMonitorScene onStats={setStats} />
 *
 * 2. Add the UI overlay outside Canvas:
 *    <PerformanceMonitorUI stats={stats} />
 *
 * Or use the combined component wrapper (recommended):
 *    <PerformanceMonitor enabled={process.env.NODE_ENV === 'development'} />
 */
export const PerformanceMonitorScene: React.FC<{ onStats: (stats: PerformanceStats) => void }> =
  memo(({ onStats }) => {
    return <StatsCollector onStats={onStats} />;
  });
PerformanceMonitorScene.displayName = 'PerformanceMonitorScene';

export const PerformanceMonitorUI: React.FC<{
  stats: PerformanceStats | null;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Whether the panel is open by default (defaults to false) */
  defaultOpen?: boolean;
}> = memo(({ stats, position = 'top-left', defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  if (!stats) return null;

  return (
    <>
      <ToggleButton isOpen={isOpen} onClick={handleToggle} position={position} />
      {isOpen && <StatsDisplay stats={stats} onClose={handleClose} position={position} />}
    </>
  );
});
PerformanceMonitorUI.displayName = 'PerformanceMonitorUI';

// ============================================================================
// Combined Hook for Easy Usage
// ============================================================================

/**
 * Hook to manage performance monitoring state.
 * Returns the stats state and the scene component to render inside Canvas.
 *
 * @example
 * const { stats, SceneComponent } = usePerformanceMonitor();
 *
 * // Inside Canvas:
 * {SceneComponent}
 *
 * // Outside Canvas (UI overlay):
 * <PerformanceMonitorUI stats={stats} />
 */
// eslint-disable-next-line react-refresh/only-export-components
export const usePerformanceMonitor = (enabled = true) => {
  const [stats, setStats] = useState<PerformanceStats | null>(null);

  const handleStats = useCallback((newStats: PerformanceStats) => {
    setStats(newStats);
  }, []);

  const SceneComponent = enabled ? <PerformanceMonitorScene onStats={handleStats} /> : null;

  return { stats, SceneComponent };
};

// Default export for convenience
export default {
  Scene: PerformanceMonitorScene,
  UI: PerformanceMonitorUI,
  usePerformanceMonitor,
};
