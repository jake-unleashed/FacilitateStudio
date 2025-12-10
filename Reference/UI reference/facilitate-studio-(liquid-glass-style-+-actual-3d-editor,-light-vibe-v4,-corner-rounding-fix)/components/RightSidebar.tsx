import React, { useState } from 'react';
import { SceneObject } from '../types';
import { Input } from './Input';
import { Button } from './Button';
import { Box, Eye, EyeOff, Trash2, Copy, Rotate3d, Scaling, X } from 'lucide-react';
import { OBJECT_ICONS } from '../constants';

interface RightSidebarProps {
  object: SceneObject | null;
  onUpdate: (updated: SceneObject) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const normalizeAngle = (angle: number) => {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
};

export const RightSidebar: React.FC<RightSidebarProps> = ({ object, onUpdate, onDelete, onClose }) => {
  const [activeRotAxis, setActiveRotAxis] = useState<'x' | 'y' | 'z'>('y');

  if (!object) return null;

  const Icon = OBJECT_ICONS[object.type] || Box;

  const toggleProperty = (prop: keyof typeof object.properties) => {
    onUpdate({
        ...object,
        properties: {
            ...object.properties,
            [prop]: !object.properties[prop]
        }
    });
  };

  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const key = `rotation${activeRotAxis.toUpperCase()}` as 'rotationX' | 'rotationY' | 'rotationZ';
    onUpdate({
      ...object,
      transform: {
        ...object.transform,
        [key]: val
      }
    });
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onUpdate({
      ...object,
      transform: {
        ...object.transform,
        scaleX: val,
        scaleY: val,
        scaleZ: val
      }
    });
  };

  const currentRotation = object.transform[`rotation${activeRotAxis.toUpperCase()}` as 'rotationX' | 'rotationY' | 'rotationZ'];
  const displayRotation = normalizeAngle(currentRotation);
  const currentScale = object.transform.scaleX;

  return (
    <div className="absolute right-4 top-24 bottom-4 w-80 z-40 flex flex-col pointer-events-none">
      
      {/* Floating Panel - Tier 1 Rounding (32px) */}
      <div className="flex-1 pointer-events-auto bg-white/70 backdrop-blur-xl border border-white/40 rounded-[32px] shadow-glass flex flex-col overflow-hidden transition-all duration-500 ease-out origin-right">
          
        {/* Header */}
        <div className="h-16 px-6 flex items-center justify-between shrink-0 bg-white/10 backdrop-blur-sm border-b border-white/10">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[12px] text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20" title={`Type: ${object.type}`}>
                    <Icon size={16} />
                </div>
                <h2 className="font-bold text-slate-900 text-sm truncate">Object Details</h2>
            </div>
            <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-[12px] text-slate-500 hover:bg-white/50 hover:text-slate-800 transition-colors"
                aria-label="Close"
            >
                <X size={18} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            
            {/* Identity Group - Compact Row */}
            <div className="flex items-end gap-3">
                <div className="flex-1">
                    <Input 
                        label="Name" 
                        value={object.name} 
                        onChange={(e) => onUpdate({...object, name: e.target.value})}
                        className="font-semibold text-sm"
                    />
                </div>
                <button 
                    onClick={() => toggleProperty('visible')}
                    className={`
                        h-[42px] w-[42px] flex items-center justify-center rounded-[20px] transition-all duration-200 border shrink-0
                        ${object.properties.visible 
                            ? 'bg-white/50 border-white/50 text-blue-600 hover:bg-white hover:shadow-sm' 
                            : 'bg-slate-100/50 border-transparent text-slate-400 hover:bg-slate-200'
                        }
                    `}
                    title="Toggle Visibility"
                >
                    {object.properties.visible ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
            </div>

            {/* Scale Section - Tier 2 Rounding (20px) */}
            <div className="bg-white/40 p-4 rounded-[20px] border border-white/40 shadow-sm">
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Scaling size={14} className="text-slate-500" />
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Scale</label>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500 bg-white/50 px-2 py-0.5 rounded-[12px] shadow-sm border border-white/50">
                        {currentScale.toFixed(2)}x
                    </span>
                 </div>
                 
                 <div className="px-1">
                    <input 
                        type="range" 
                        min="0.1" 
                        max="3.0" 
                        step="0.1"
                        value={currentScale}
                        onChange={handleScaleChange}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all"
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium">
                        <span>0.1x</span>
                        <span>3.0x</span>
                    </div>
                 </div>
            </div>

            {/* Rotation Section - Tier 2 Rounding (20px) */}
            <div className="bg-white/40 p-4 rounded-[20px] border border-white/40 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Rotate3d size={14} className="text-slate-500" />
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Rotation</label>
                    </div>
                     <span className="text-xs font-mono font-bold text-slate-500 bg-white/50 px-2 py-0.5 rounded-[12px] shadow-sm border border-white/50">
                        {Math.round(displayRotation)}°
                    </span>
                 </div>
                 
                 <div className="space-y-4">
                    {/* Axis Toggles */}
                    <div className="flex p-1 bg-slate-100/50 rounded-[20px] border border-white/20">
                        {(['x', 'y', 'z'] as const).map((axis) => (
                            <button
                                key={axis}
                                onClick={() => setActiveRotAxis(axis)}
                                className={`
                                    flex-1 py-1 text-[10px] font-bold uppercase tracking-wider rounded-[12px] transition-all duration-200
                                    ${activeRotAxis === axis 
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                    }
                                `}
                            >
                                {axis}
                            </button>
                        ))}
                    </div>

                    {/* Slider Center-Zero (-180 to 180) */}
                    <div className="px-1 relative">
                        {/* Center Marker */}
                        <div className="absolute left-1/2 top-[-6px] bottom-4 w-px bg-slate-300/50 z-0"></div>
                        
                        <input 
                            type="range" 
                            min="-180" 
                            max="180" 
                            step="1"
                            value={displayRotation}
                            onChange={handleRotationChange}
                            className="relative z-10 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all"
                        />
                         <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium">
                            <span>-180°</span>
                            <span className="text-slate-300">0°</span>
                            <span>180°</span>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-auto pt-2">
                <Button 
                    variant="secondary" 
                    size="md"
                    className="w-full text-slate-600 justify-center rounded-[20px] font-semibold text-xs h-10 border-transparent bg-white/60 hover:bg-white"
                >
                    <Copy size={14} className="mr-2" />
                    Duplicate
                </Button>
                <Button 
                    variant="glass" 
                    size="md"
                    className="w-full text-red-500 bg-red-50/50 border-red-100/50 hover:bg-red-100 hover:text-red-600 hover:border-red-200 justify-center rounded-[20px] font-semibold text-xs h-10 shadow-none"
                    onClick={() => onDelete(object.id)}
                >
                    <Trash2 size={14} className="mr-2" />
                    Delete
                </Button>
            </div>

        </div>
      </div>
    </div>
  );
};