import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import type { SimulationSettings } from '../../types/simulationSettings';

interface PreviewSettingsPanelProps {
  settings: SimulationSettings;
  onSettingsChange: (settings: SimulationSettings) => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/40 bg-white/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs leading-relaxed text-slate-600">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        onClick={onToggle}
        aria-label={checked ? `Disable ${label}` : `Enable ${label}`}
        aria-checked={checked}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white/30 ${
          checked ? 'bg-blue-500' : 'bg-slate-300/60'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * A floating settings button that opens a panel of trainee-facing simulation
 * controls (orbit and zoom toggles). Rendered above full-screen overlays like
 * info cards (z-[60] > z-50).
 */
export function PreviewSettingsPanel({ settings, onSettingsChange }: PreviewSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggleOrbit = useCallback(() => {
    onSettingsChange({ ...settings, allowOrbit: !settings.allowOrbit });
  }, [settings, onSettingsChange]);

  const handleToggleZoom = useCallback(() => {
    onSettingsChange({ ...settings, allowZoom: !settings.allowZoom });
  }, [settings, onSettingsChange]);

  return (
    <div ref={containerRef} className="fixed right-4 top-4 z-[60]">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={isOpen ? 'Close preview settings' : 'Open preview settings'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/70 text-slate-700 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white/90 active:scale-95"
      >
        <Settings2 className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Preview settings"
          aria-modal="true"
          className="animate-in fade-in zoom-in-95 absolute right-0 mt-2 w-72 origin-top-right rounded-[20px] border border-white/40 bg-white/70 p-3 shadow-glass backdrop-blur-xl duration-200"
        >
          <div className="mb-2 px-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Trainee Controls</p>
          </div>

          <div className="space-y-2">
            <ToggleRow
              label="Orbit"
              description="Allow rotating around objects."
              checked={settings.allowOrbit}
              onToggle={handleToggleOrbit}
            />

            <ToggleRow
              label="Zoom"
              description="Allow zooming in and out."
              checked={settings.allowZoom}
              onToggle={handleToggleZoom}
            />
          </div>
        </div>
      )}
    </div>
  );
}
