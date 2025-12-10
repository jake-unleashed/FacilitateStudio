import React, { useState, useRef, useEffect } from 'react';
import { Undo, Redo, Share2, MonitorPlay, Save, Menu, Pencil } from 'lucide-react';
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
    <div className="pointer-events-none absolute left-4 right-4 top-4 z-50 flex justify-center transition-all duration-300 md:left-24 md:right-24">
      {/* Floating Island Header - Tier 1 Rounding (32px) */}
      <header className="pointer-events-auto relative flex h-16 w-full items-center justify-between rounded-[32px] border border-white/40 bg-white/70 px-6 shadow-glass-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
        {/* Left Section */}
        <div className="z-10 flex items-center gap-6">
          <div className="group flex cursor-pointer select-none flex-col justify-center">
            {/* Brand Text */}
            <h1 className="text-xl font-black leading-none tracking-tight text-slate-800 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:bg-clip-text group-hover:text-transparent">
              Facilitate
            </h1>
            <span className="ml-0.5 mt-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.35em] text-slate-400 transition-colors duration-300 group-hover:text-blue-500">
              Studio
            </span>
          </div>

          <div className="hidden h-6 w-px bg-slate-900/10 sm:block"></div>

          <div className="hidden items-center gap-1 sm:flex">
            {/* Buttons - Tier 2 Rounding (20px) handled by Button component size */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Save"
              className="h-10 w-10 rounded-[20px]"
            >
              <Save size={18} />
            </Button>
            <div className="ml-1 flex items-center gap-1 rounded-[20px] border border-white/20 bg-slate-100/30 p-1">
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label="Undo"
                className="h-9 w-9 rounded-[20px]"
              >
                <Undo size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Redo"
                className="h-9 w-9 rounded-[20px]"
              >
                <Redo size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Center Section - Simulation Title */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center md:flex">
          {isEditing ? (
            <input
              ref={inputRef}
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-[200px] border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center text-sm font-bold text-slate-800 focus:outline-none"
            />
          ) : (
            <button
              className="group flex cursor-pointer items-center gap-2 rounded-[20px] px-4 py-1.5 outline-none transition-all hover:bg-black/5 focus:bg-black/5"
              onClick={() => setIsEditing(true)}
              title="Edit simulation title"
            >
              <span className="max-w-[200px] truncate text-sm font-bold text-slate-700 lg:max-w-[400px]">
                {title}
              </span>
              <div className="rounded-[12px] bg-slate-200/50 p-1 text-slate-400 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                <Pencil size={12} strokeWidth={2.5} />
              </div>
            </button>
          )}
        </div>

        {/* Right Section */}
        <div className="z-10 flex items-center gap-3">
          <Button
            variant="secondary"
            className="hidden gap-2 rounded-[20px] border-white/40 bg-white/50 font-medium shadow-none hover:shadow-md sm:flex"
          >
            <MonitorPlay size={16} className="text-slate-500" />
            Preview
          </Button>
          <Button
            variant="primary"
            className="gap-2 rounded-[20px] pl-4 pr-5 shadow-lg shadow-blue-500/30"
          >
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
