import React, { useState, memo, useCallback } from 'react';
import {
  Move,
  Rotate3d,
  ZoomIn,
  HelpCircle,
  X,
  ChevronDown,
  Keyboard,
  Focus,
  Scan,
} from 'lucide-react';

interface NavigationHelpProps {
  offsetForSidebar?: boolean;
}

// Memoized keyboard shortcut badge component
const KeyBadge = memo<{ children: React.ReactNode }>(({ children }) => (
  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded bg-slate-200/80 px-1 py-0.5 text-[8px] font-bold text-slate-500">
    {children}
  </span>
));
KeyBadge.displayName = 'KeyBadge';

const NavigationHelpInner: React.FC<NavigationHelpProps> = ({ offsetForSidebar = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleKeyboard = useCallback(() => setShowKeyboard((prev) => !prev), []);

  return (
    <div
      className={`
        pointer-events-none absolute bottom-6 right-6 z-50 flex flex-col items-end gap-3
        transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${offsetForSidebar ? '-translate-x-[22rem]' : 'translate-x-0'}
      `}
    >
      {/* Expanded Content */}
      {isOpen && (
        <div
          className="
            animate-in fade-in slide-in-from-bottom-2 pointer-events-auto w-56 origin-bottom-right 
            rounded-[24px] border border-white/40 bg-white/80
            p-4 shadow-glass backdrop-blur-xl duration-300
          "
        >
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Navigation
          </h3>

          <div className="space-y-2.5">
            {/* Rotate */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/60 bg-white/50 text-blue-500">
                <Rotate3d size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-700">Orbit</span>
                <span className="text-[9px] text-slate-400">Left Click + Drag</span>
              </div>
            </div>

            {/* Pan */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/60 bg-white/50 text-purple-500">
                <Move size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-700">Pan</span>
                <span className="text-[9px] text-slate-400">Right Click + Drag</span>
              </div>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/60 bg-white/50 text-amber-500">
                <ZoomIn size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-700">Zoom</span>
                <span className="text-[9px] text-slate-400">Scroll Wheel</span>
              </div>
            </div>

            {/* Keyboard Shortcuts - Expandable Section */}
            <div className="mt-3 border-t border-slate-200/50 pt-2">
              <button
                onClick={toggleKeyboard}
                className="flex w-full items-center justify-between py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
              >
                <span>Keyboard Shortcuts</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${showKeyboard ? 'rotate-180' : ''}`}
                />
              </button>

              {showKeyboard && (
                <div className="animate-in fade-in slide-in-from-top-1 mt-2 space-y-2 duration-200">
                  {/* Move */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Keyboard size={10} className="text-emerald-500" />
                      <span className="text-[9px] text-slate-600">Move</span>
                    </div>
                    <div className="flex gap-0.5">
                      <KeyBadge>W</KeyBadge>
                      <KeyBadge>A</KeyBadge>
                      <KeyBadge>S</KeyBadge>
                      <KeyBadge>D</KeyBadge>
                    </div>
                  </div>

                  {/* Rotate */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Rotate3d size={10} className="text-cyan-500" />
                      <span className="text-[9px] text-slate-600">Rotate</span>
                    </div>
                    <div className="flex gap-0.5">
                      <KeyBadge>Q</KeyBadge>
                      <KeyBadge>E</KeyBadge>
                    </div>
                  </div>

                  {/* Focus */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Focus size={10} className="text-pink-500" />
                      <span className="text-[9px] text-slate-600">Focus Object</span>
                    </div>
                    <KeyBadge>F</KeyBadge>
                  </div>

                  {/* Reset */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Scan size={10} className="text-orange-500" />
                      <span className="text-[9px] text-slate-600">Reset View</span>
                    </div>
                    <KeyBadge>0</KeyBadge>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleOpen}
        className={`
          pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full
          border shadow-sm backdrop-blur-md transition-all duration-200
          ${
            isOpen
              ? 'border-slate-300 bg-white/90 text-slate-700'
              : 'border-white/50 bg-white/70 text-slate-500 hover:bg-white/90 hover:text-slate-700 hover:shadow-md'
          }
        `}
        aria-label={isOpen ? 'Close Help' : 'Open Navigation Help'}
      >
        {isOpen ? <X size={16} /> : <HelpCircle size={18} strokeWidth={2} />}
      </button>
    </div>
  );
};

// Export memoized component
export const NavigationHelp = memo(NavigationHelpInner);
