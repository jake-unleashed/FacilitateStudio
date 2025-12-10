import React from 'react';
import { 
  Plus, 
  ListOrdered, 
  Box, 
  ChevronRight,
  Upload,
  Image as ImageIcon,
  FileBox,
  ChevronsLeft
} from 'lucide-react';
import { SidebarSection, SimStep, SceneObject } from '../types';
import { OBJECT_ICONS } from '../constants';

interface LeftSidebarProps {
  activeTab: SidebarSection | null;
  setActiveTab: (tab: SidebarSection | null) => void;
  steps: SimStep[];
  objects: SceneObject[];
  onSelectObject: (id: string) => void;
  selectedObjectId: string | null;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  steps,
  objects,
  onSelectObject,
  selectedObjectId
}) => {
  
  const NavItem = ({ id, icon: Icon, label }: { id: SidebarSection, icon: any, label: string }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(isActive ? null : id)}
        className={`
          relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-[20px] transition-all duration-300 w-full group
          ${isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20' 
            : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
          }
        `}
      >
        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="transition-transform duration-300 group-hover:scale-110" />
        <span className="text-[10px] font-semibold tracking-tight">{label}</span>
      </button>
    );
  }

  return (
    <div className={`
        absolute left-4 top-24 bottom-4 z-40 flex pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${activeTab ? 'w-[26rem] gap-6' : 'w-20 gap-0'}
    `}>
      
      {/* Floating Navigation Strip - Tier 1 Rounding (32px) */}
      <div className="w-20 pointer-events-auto h-fit bg-white/70 backdrop-blur-xl border border-white/40 rounded-[32px] shadow-glass flex flex-col items-center p-2 gap-2 self-center -translate-y-16 shrink-0">
        <NavItem id="add" icon={Plus} label="Add" />
        <NavItem id="objects" icon={Box} label="Objects" />
        <NavItem id="steps" icon={ListOrdered} label="Steps" />
      </div>

      {/* Floating Content Panel - Tier 1 Rounding (32px) */}
      <div className={`
          flex-1 pointer-events-auto bg-white/70 backdrop-blur-xl border border-white/40 rounded-[32px] shadow-glass flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] origin-left
          ${activeTab ? 'opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-8 border-0 p-0 flex-none'}
      `}>
        
        {/* Header */}
        <div className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/10 bg-white/10 backdrop-blur-sm min-w-[20rem]">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            {activeTab === 'add' && 'Library'}
            {activeTab === 'steps' && 'Training Flow'}
            {activeTab === 'objects' && 'Scene Objects'}
          </h2>
          <button 
             onClick={() => setActiveTab(null)}
             className="w-8 h-8 flex items-center justify-center rounded-[12px] text-slate-500 hover:bg-white/50 hover:text-slate-800 transition-colors"
             title="Minimize Sidebar"
          >
             <ChevronsLeft size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar min-w-[20rem]">
          
          {/* Add Panel */}
          {activeTab === 'add' && (
            <div className="space-y-6">
               
               {/* Upload Section - Tier 2 Rounding (20px) */}
               <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-[20px] p-6 border border-blue-100/50 hover:border-blue-300 transition-all cursor-pointer group shadow-sm">
                 <div className="flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-[12px] flex items-center justify-center shadow-lg shadow-blue-500/10 text-blue-500 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                        <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Upload Asset</p>
                    </div>
                 </div>
              </div>

               {/* Assets Library */}
               <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 pl-1">Recent</h3>
                  <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: "Safety Cone", type: "model" },
                        { name: "Factory Wall", type: "model" },
                        { name: "Warning Sign", type: "image" },
                        { name: "Metal Floor", type: "image" },
                      ].map((item, i) => (
                        <div key={i} className="aspect-square bg-white/40 rounded-[20px] border border-white/40 flex flex-col items-center justify-center relative cursor-pointer hover:bg-white hover:shadow-lg hover:scale-105 transition-all group p-3">
                             <div className="flex-1 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                 {item.type === 'model' ? <FileBox size={28} /> : <ImageIcon size={28} />}
                             </div>
                             <span className="text-[10px] text-slate-600 font-semibold truncate w-full text-center">{item.name}</span>
                        </div>
                      ))}
                  </div>
               </div>
            </div>
          )}

          {/* Steps Panel */}
          {activeTab === 'steps' && (
            <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative bg-white/50 backdrop-blur-sm p-4 rounded-[20px] border border-white/50 shadow-sm hover:shadow-md hover:bg-white transition-all group cursor-pointer">
                    <div className="flex items-start gap-3">
                        <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold shadow-sm mt-0.5
                            ${step.completed 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-slate-200 text-slate-500'
                            }
                        `}>
                            {index + 1}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm font-medium text-slate-700 leading-snug">{step.description}</p>
                        </div>
                    </div>
                  </div>
                ))}
                
                <button className="w-full py-4 border border-dashed border-slate-300 bg-white/20 rounded-[20px] text-slate-500 text-sm font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2">
                    <Plus size={18} />
                    Add Step
                </button>
            </div>
          )}

          {/* Objects Panel */}
          {activeTab === 'objects' && (
            <div className="space-y-2">
                <div className="space-y-1">
                  {objects.map((obj) => {
                      const Icon = OBJECT_ICONS[obj.type] || Box;
                      const isSelected = selectedObjectId === obj.id;
                      return (
                          <div 
                              key={obj.id}
                              onClick={() => onSelectObject(obj.id)}
                              className={`
                                  flex items-center gap-3 p-3 rounded-[20px] cursor-pointer text-sm transition-all duration-200
                                  ${isSelected 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]' 
                                    : 'hover:bg-white/60 text-slate-700 hover:scale-[1.01]'
                                  }
                              `}
                          >
                              <div className={`p-1.5 rounded-[12px] ${isSelected ? 'bg-blue-500 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                                <Icon size={14} />
                              </div>
                              <span className="flex-1 truncate font-medium">{obj.name}</span>
                              {isSelected && <ChevronRight size={14} className="text-blue-200" />}
                          </div>
                      );
                  })}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};