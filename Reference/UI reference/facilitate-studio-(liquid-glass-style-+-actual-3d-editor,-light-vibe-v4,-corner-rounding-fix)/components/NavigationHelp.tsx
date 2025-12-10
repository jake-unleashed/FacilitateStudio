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
                absolute bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none
                transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
                ${offsetForSidebar ? '-translate-x-[22rem]' : 'translate-x-0'}
            `}
        >
            {/* Expanded Content - Tier 1 Rounding (32px) */}
            <div className={`
                pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/40 rounded-[32px] shadow-glass p-5 w-64
                transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] origin-bottom-right
                ${isOpen 
                    ? 'opacity-100 scale-100 translate-y-0' 
                    : 'opacity-0 scale-90 translate-y-8 pointer-events-none absolute bottom-0 right-0'
                }
            `}>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 pl-1">Navigation Controls</h3>
                
                <div className="space-y-4">
                    {/* Rotate - Tier 2 Rounding (20px) */}
                    <div className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-[20px] bg-white/50 border border-white/60 flex items-center justify-center shadow-sm text-blue-500 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
                             <Rotate3d size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">Orbit / Rotate</span>
                            <span className="text-[10px] font-medium text-slate-500">Left Click + Drag</span>
                        </div>
                    </div>

                    {/* Pan */}
                     <div className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-[20px] bg-white/50 border border-white/60 flex items-center justify-center shadow-sm text-purple-500 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
                             <Move size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">Pan View</span>
                            <span className="text-[10px] font-medium text-slate-500">Right Click + Drag</span>
                        </div>
                    </div>

                    {/* Zoom */}
                     <div className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-[20px] bg-white/50 border border-white/60 flex items-center justify-center shadow-sm text-amber-500 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
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
                    pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full
                    backdrop-blur-xl border transition-all duration-300 shadow-glass-sm hover:shadow-glow
                    ${isOpen 
                        ? 'bg-blue-600 border-blue-500 text-white rotate-90' 
                        : 'bg-white/80 border-white/40 text-slate-600 hover:bg-white hover:scale-110'
                    }
                `}
                aria-label={isOpen ? "Close Help" : "Open Navigation Help"}
            >
                {isOpen ? <X size={20} /> : <HelpCircle size={22} strokeWidth={2.5} />}
            </button>
        </div>
    );
};