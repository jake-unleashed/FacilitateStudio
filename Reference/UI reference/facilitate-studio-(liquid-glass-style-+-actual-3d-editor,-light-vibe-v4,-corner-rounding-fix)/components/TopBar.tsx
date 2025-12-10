import React, { useState, useRef, useEffect } from 'react';
import { 
  Undo, 
  Redo, 
  Share2, 
  MonitorPlay, 
  Save,
  Menu,
  Pencil
} from 'lucide-react';
import { Button } from './Button';

interface TopBarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ title, onTitleChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (tempTitle.trim()) {
      onTitleChange(tempTitle);
    } else {
      setTempTitle(title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditing(false);
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 md:left-24 md:right-24 z-50 flex justify-center pointer-events-none transition-all duration-300">
      
      {/* Floating Island Header - Tier 1 Rounding (32px) */}
      <header className="pointer-events-auto relative h-16 w-full bg-white/70 backdrop-blur-xl border border-white/40 rounded-[32px] flex items-center justify-between px-6 transition-all duration-300 hover:bg-white/80 shadow-glass-sm">
        
        {/* Left Section */}
        <div className="flex items-center gap-6 z-10">
          <div className="flex flex-col justify-center cursor-pointer group select-none">
             {/* Brand Text */}
             <h1 className="font-black text-xl text-slate-800 leading-none tracking-tight transition-all duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600">
               Facilitate
             </h1>
             <span className="font-bold text-slate-400 text-[9px] leading-none uppercase tracking-[0.35em] ml-0.5 mt-0.5 group-hover:text-blue-500 transition-colors duration-300">
               Studio
             </span>
          </div>
          
          <div className="h-6 w-px bg-slate-900/10 hidden sm:block"></div>

          <div className="flex items-center gap-1 hidden sm:flex">
            {/* Buttons - Tier 2 Rounding (20px) handled by Button component size */}
            <Button variant="ghost" size="icon" aria-label="Save" className="rounded-[20px] w-10 h-10">
               <Save size={18} />
            </Button>
            <div className="flex items-center gap-1 ml-1 bg-slate-100/30 rounded-[20px] p-1 border border-white/20">
              <Button variant="ghost" size="icon" disabled aria-label="Undo" className="w-9 h-9 rounded-[20px]">
                <Undo size={16} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Redo" className="w-9 h-9 rounded-[20px]">
                <Redo size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Center Section - Simulation Title */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center">
           {isEditing ? (
             <input
               ref={inputRef}
               value={tempTitle}
               onChange={(e) => setTempTitle(e.target.value)}
               onBlur={handleSave}
               onKeyDown={handleKeyDown}
               className="font-bold text-sm text-slate-800 text-center bg-transparent border-b-2 border-blue-500 focus:outline-none px-2 py-1 w-[200px]"
             />
           ) : (
             <button
               className="group flex items-center gap-2 cursor-pointer px-4 py-1.5 rounded-[20px] hover:bg-black/5 transition-all outline-none focus:bg-black/5"
               onClick={() => setIsEditing(true)}
               title="Edit simulation title"
             >
               <span className="font-bold text-sm text-slate-700 truncate max-w-[200px] lg:max-w-[400px]">{title}</span>
               <div className="p-1 rounded-[12px] bg-slate-200/50 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <Pencil size={12} strokeWidth={2.5} />
               </div>
             </button>
           )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 z-10">
          <Button variant="secondary" className="gap-2 hidden sm:flex font-medium border-white/40 shadow-none hover:shadow-md bg-white/50 rounded-[20px]">
            <MonitorPlay size={16} className="text-slate-500" />
            Preview
          </Button>
          <Button variant="primary" className="gap-2 pl-4 pr-5 shadow-lg shadow-blue-500/30 rounded-[20px]">
            <Share2 size={16} />
            Publish
          </Button>
          <Button variant="ghost" size="icon" className="sm:hidden">
            <Menu size={20} />
          </Button>
        </div>
      </header>
    </div>
  );
};