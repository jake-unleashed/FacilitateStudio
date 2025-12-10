import React, { useState } from 'react';
import { Move, Rotate3d, ZoomIn, HelpCircle, X } from 'lucide-react';

interface NavigationHelpProps {
  offsetForSidebar?: boolean;
}

export const NavigationHelp: React.FC<NavigationHelpProps> = ({ offsetForSidebar = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`
                pointer-events-none absolute bottom-6 right-6 z-50 flex flex-col items-end gap-4
                transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
                ${offsetForSidebar ? '-translate-x-[22rem]' : 'translate-x-0'}
            `}
    >
      {/* Expanded Content - Tier 1 Rounding (32px) */}
      <div
        className={`
                pointer-events-auto w-64 origin-bottom-right rounded-[32px] border border-white/40 bg-white/80 p-5 shadow-glass
                backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
                ${
                  isOpen
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none absolute bottom-0 right-0 translate-y-8 scale-90 opacity-0'
                }
            `}
      >
        <h3 className="mb-4 pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Navigation Controls
        </h3>

        <div className="space-y-4">
          {/* Rotate - Tier 2 Rounding (20px) */}
          <div className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/50 text-blue-500 shadow-sm transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
              <Rotate3d size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">Orbit / Rotate</span>
              <span className="text-[10px] font-medium text-slate-500">Left Click + Drag</span>
            </div>
          </div>

          {/* Pan */}
          <div className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/50 text-purple-500 shadow-sm transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
              <Move size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">Pan View</span>
              <span className="text-[10px] font-medium text-slate-500">Right Click + Drag</span>
            </div>
          </div>

          {/* Zoom */}
          <div className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/50 text-amber-500 shadow-sm transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
              <ZoomIn size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">Zoom In/Out</span>
              <span className="text-[10px] font-medium text-slate-500">Scroll Wheel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button - Circular */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
                    pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full
                    border shadow-glass-sm backdrop-blur-xl transition-all duration-300 hover:shadow-glow
                    ${
                      isOpen
                        ? 'rotate-90 border-blue-500 bg-blue-600 text-white'
                        : 'border-white/40 bg-white/80 text-slate-600 hover:scale-110 hover:bg-white'
                    }
                `}
        aria-label={isOpen ? 'Close Help' : 'Open Navigation Help'}
      >
        {isOpen ? <X size={20} /> : <HelpCircle size={22} strokeWidth={2.5} />}
      </button>
    </div>
  );
};
