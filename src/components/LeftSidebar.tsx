import {
  Plus,
  ListOrdered,
  Box,
  ChevronRight,
  Upload,
  ChevronsLeft,
  LucideIcon,
  Clock,
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
  onFocusObject?: (object: SceneObject) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab,
  setActiveTab,
  steps,
  objects,
  onSelectObject,
  selectedObjectId,
  onFocusObject,
}) => {
  const NavItem = ({
    id,
    icon: Icon,
    label,
  }: {
    id: SidebarSection;
    icon: LucideIcon;
    label: string;
  }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(isActive ? null : id)}
        className={`
          group relative flex w-full flex-col items-center justify-center gap-1.5 rounded-[20px] p-3 transition-all duration-300
          ${
            isActive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
              : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
          }
        `}
      >
        <Icon
          size={22}
          strokeWidth={isActive ? 2.5 : 2}
          className="transition-transform duration-300 group-hover:scale-110"
        />
        <span className="text-[10px] font-semibold tracking-tight">{label}</span>
      </button>
    );
  };

  return (
    <div
      className={`
        pointer-events-none absolute bottom-4 left-4 top-24 z-40 flex transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${activeTab ? 'w-[26rem] gap-6' : 'w-20 gap-0'}
    `}
    >
      {/* Floating Navigation Strip - Tier 1 Rounding (32px) */}
      <div className="pointer-events-auto flex h-fit w-20 shrink-0 -translate-y-16 flex-col items-center gap-2 self-center rounded-[32px] border border-white/40 bg-white/70 p-2 shadow-glass backdrop-blur-xl">
        <NavItem id="add" icon={Plus} label="Add" />
        <NavItem id="objects" icon={Box} label="Objects" />
        <NavItem id="steps" icon={ListOrdered} label="Steps" />
      </div>

      {/* Floating Content Panel - Tier 1 Rounding (32px) */}
      <div
        className={`
          pointer-events-auto flex flex-1 origin-left flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${activeTab ? 'translate-x-0 opacity-100' : 'w-0 flex-none -translate-x-8 border-0 p-0 opacity-0'}
      `}
      >
        {/* Header */}
        <div className="flex h-16 min-w-[20rem] shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">
            {activeTab === 'add' && 'Library'}
            {activeTab === 'steps' && 'Training Flow'}
            {activeTab === 'objects' && 'Scene Objects'}
          </h2>
          <button
            onClick={() => setActiveTab(null)}
            className="flex h-8 w-8 items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800"
            title="Minimize Sidebar"
          >
            <ChevronsLeft size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="custom-scrollbar min-w-[20rem] flex-1 space-y-5 overflow-y-auto p-5">
          {/* Add Panel */}
          {activeTab === 'add' && (
            <div className="space-y-6">
              {/* Upload Section - Tier 2 Rounding (20px) */}
              <div className="group cursor-pointer rounded-[20px] border border-blue-100/50 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 shadow-sm transition-all hover:border-blue-300">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-blue-500 shadow-lg shadow-blue-500/10 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    <Upload size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Upload Asset</p>
                  </div>
                </div>
              </div>

              {/* Recent Section */}
              <div>
                <h3 className="mb-4 pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Recent
                </h3>
                {/* Empty State */}
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-8 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Clock size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No recent assets</p>
                  <p className="mt-1 text-xs text-slate-400">Uploaded assets will appear here</p>
                </div>
              </div>
            </div>
          )}

          {/* Steps Panel */}
          {activeTab === 'steps' && (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="group relative cursor-pointer rounded-[20px] border border-white/50 bg-white/50 p-4 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                            mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm
                            ${
                              step.completed
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }
                        `}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium leading-snug text-slate-700">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <button className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-slate-300 bg-white/20 py-4 text-sm font-medium text-slate-500 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600">
                <Plus size={18} />
                Add Step
              </button>
            </div>
          )}

          {/* Objects Panel */}
          {activeTab === 'objects' && (
            <div className="space-y-2">
              {objects.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Box size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No objects in scene</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add objects from the{' '}
                    <button
                      onClick={() => setActiveTab('add')}
                      className="font-semibold text-blue-500 underline decoration-blue-300 underline-offset-2 transition-colors hover:text-blue-600"
                    >
                      Library
                    </button>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {objects.map((obj) => {
                    const Icon = OBJECT_ICONS[obj.type] || Box;
                    const isSelected = selectedObjectId === obj.id;
                    return (
                      <div
                        key={obj.id}
                        onClick={() => {
                          onSelectObject(obj.id);
                          // Focus camera on the object when clicked
                          if (onFocusObject) {
                            onFocusObject(obj);
                          }
                        }}
                        className={`
                                    flex cursor-pointer items-center gap-3 rounded-[20px] p-3 text-sm transition-all duration-200
                                    ${
                                      isSelected
                                        ? 'scale-[1.02] bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'text-slate-700 hover:scale-[1.01] hover:bg-white/60'
                                    }
                                `}
                      >
                        <div
                          className={`rounded-[12px] p-1.5 ${isSelected ? 'bg-blue-500 text-white' : 'bg-white text-slate-400 shadow-sm'}`}
                        >
                          <Icon size={14} />
                        </div>
                        <span className="flex-1 truncate font-medium">{obj.name}</span>
                        {isSelected && <ChevronRight size={14} className="text-blue-200" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
