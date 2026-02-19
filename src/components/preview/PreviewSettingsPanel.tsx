import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import type { SimulationSettings } from '../../types/simulationSettings';

// Timing for the one-shot settings callout shown on preview entry
const CALLOUT_SHOW_DELAY_MS = 700; // let the scene settle before appearing
const CALLOUT_VISIBLE_MS = 8700;   // start fade-out after ~8 s visible
const CALLOUT_UNMOUNT_MS = 9200;   // unmount after fade-out (500 ms transition)
const CALLOUT_DISMISS_MS = 500;    // fade duration when user opens the panel

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
 * Manages the one-shot callout shown when the creator first enters preview mode.
 *
 * Returns two flags:
 * - `showCallout`   — whether the callout is mounted in the DOM
 * - `isCalloutVisible` — whether it is fully visible (drives CSS transitions)
 *
 * The callout auto-dismisses after ~8 s and immediately dismisses when the
 * settings panel is opened (the user has discovered the button).
 */
function useSettingsCallout(isOpen: boolean) {
  const [showCallout, setShowCallout] = useState(false);
  const [isCalloutVisible, setIsCalloutVisible] = useState(false);

  // Mount → show after delay → fade out → unmount
  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setShowCallout(true);
      // Double rAF ensures the element is painted before the CSS transition starts
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsCalloutVisible(true);
        });
      });
    }, CALLOUT_SHOW_DELAY_MS);

    const hideTimer = window.setTimeout(() => {
      setIsCalloutVisible(false);
    }, CALLOUT_VISIBLE_MS);

    const unmountTimer = window.setTimeout(() => {
      setShowCallout(false);
    }, CALLOUT_UNMOUNT_MS);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  // Dismiss immediately when the user opens the settings panel
  useEffect(() => {
    if (!isOpen) return;
    setIsCalloutVisible(false);
    const unmountTimer = window.setTimeout(() => {
      setShowCallout(false);
    }, CALLOUT_DISMISS_MS);
    return () => window.clearTimeout(unmountTimer);
  }, [isOpen]);

  return { showCallout, isCalloutVisible };
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

  const { showCallout, isCalloutVisible } = useSettingsCallout(isOpen);

  // Close on outside click or Escape while the panel is open
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

  const handleSettingToggle = useCallback(
    (key: keyof SimulationSettings) => {
      onSettingsChange({ ...settings, [key]: !settings[key] });
    },
    [settings, onSettingsChange]
  );

  return (
    <div ref={containerRef} className="fixed right-4 top-4 z-[60]">
      {/* Pulse ring on the button during the callout window */}
      {showCallout && !isOpen && (
        <span
          className={`pointer-events-none absolute inset-[-4px] rounded-full border-2 border-blue-400/50 transition-opacity duration-500 ${
            isCalloutVisible ? 'animate-pulse opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />
      )}

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

      {/* Pill callout that floats to the left of the button */}
      {showCallout && !isOpen && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 z-[70] -translate-y-1/2 transition-all duration-500 ease-out ${
            isCalloutVisible ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0'
          }`}
          style={{ right: 'calc(100% + 16px)' }}
        >
          <div className="relative rounded-[14px] border border-white/40 bg-white/85 px-3 py-2 shadow-glass backdrop-blur-xl">
            <p className="whitespace-nowrap text-[11px] font-bold leading-none text-slate-800">
              Preview Settings
            </p>
            <p className="mt-1 whitespace-nowrap text-[10px] leading-none text-slate-500">
              Adjust trainee controls
            </p>
            {/* CSS border-triangle: zero-area, no background, so no alpha stacking with the pill */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                right: '-9px',
                width: 0,
                height: 0,
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderLeft: '9px solid rgba(255, 255, 255, 0.85)',
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

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
              onToggle={() => handleSettingToggle('allowOrbit')}
            />

            <ToggleRow
              label="Zoom"
              description="Allow zooming in and out."
              checked={settings.allowZoom}
              onToggle={() => handleSettingToggle('allowZoom')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
