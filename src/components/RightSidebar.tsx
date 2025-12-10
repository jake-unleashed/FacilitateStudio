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

export const RightSidebar: React.FC<RightSidebarProps> = ({
  object,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const [activeRotAxis, setActiveRotAxis] = useState<'x' | 'y' | 'z'>('y');

  if (!object) return null;

  const Icon = OBJECT_ICONS[object.type] || Box;

  const toggleProperty = (prop: keyof typeof object.properties) => {
    onUpdate({
      ...object,
      properties: {
        ...object.properties,
        [prop]: !object.properties[prop],
      },
    });
  };

  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const key = `rotation${activeRotAxis.toUpperCase()}` as 'rotationX' | 'rotationY' | 'rotationZ';
    onUpdate({
      ...object,
      transform: {
        ...object.transform,
        [key]: val,
      },
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
        scaleZ: val,
      },
    });
  };

  const currentRotation =
    object.transform[
      `rotation${activeRotAxis.toUpperCase()}` as 'rotationX' | 'rotationY' | 'rotationZ'
    ];
  const displayRotation = normalizeAngle(currentRotation);
  const currentScale = object.transform.scaleX;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 top-24 z-40 flex w-80 flex-col">
      {/* Floating Panel - Tier 1 Rounding (32px) */}
      <div className="pointer-events-auto flex flex-1 origin-right flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl transition-all duration-500 ease-out">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-500/20"
              title={`Type: ${object.type}`}
            >
              <Icon size={16} />
            </div>
            <h2 className="truncate text-sm font-bold text-slate-900">Object Details</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          {/* Identity Group - Compact Row */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Name"
                value={object.name}
                onChange={(e) => onUpdate({ ...object, name: e.target.value })}
                className="text-sm font-semibold"
              />
            </div>
            <button
              onClick={() => toggleProperty('visible')}
              className={`
                        flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[20px] border transition-all duration-200
                        ${
                          object.properties.visible
                            ? 'border-white/50 bg-white/50 text-blue-600 hover:bg-white hover:shadow-sm'
                            : 'border-transparent bg-slate-100/50 text-slate-400 hover:bg-slate-200'
                        }
                    `}
              title="Toggle Visibility"
            >
              {object.properties.visible ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>

          {/* Scale Section - Tier 2 Rounding (20px) */}
          <div className="rounded-[20px] border border-white/40 bg-white/40 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scaling size={14} className="text-slate-500" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Scale
                </label>
              </div>
              <span className="rounded-[12px] border border-white/50 bg-white/50 px-2 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm">
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
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
              />
              <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                <span>0.1x</span>
                <span>3.0x</span>
              </div>
            </div>
          </div>

          {/* Rotation Section - Tier 2 Rounding (20px) */}
          <div className="rounded-[20px] border border-white/40 bg-white/40 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rotate3d size={14} className="text-slate-500" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Rotation
                </label>
              </div>
              <span className="rounded-[12px] border border-white/50 bg-white/50 px-2 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm">
                {Math.round(displayRotation)}°
              </span>
            </div>

            <div className="space-y-4">
              {/* Axis Toggles */}
              <div className="flex rounded-[20px] border border-white/20 bg-slate-100/50 p-1">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <button
                    key={axis}
                    onClick={() => setActiveRotAxis(axis)}
                    className={`
                                    flex-1 rounded-[12px] py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-200
                                    ${
                                      activeRotAxis === axis
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                        : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
                                    }
                                `}
                  >
                    {axis}
                  </button>
                ))}
              </div>

              {/* Slider Center-Zero (-180 to 180) */}
              <div className="relative px-1">
                {/* Center Marker */}
                <div className="absolute bottom-4 left-1/2 top-[-6px] z-0 w-px bg-slate-300/50"></div>

                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={displayRotation}
                  onChange={handleRotationChange}
                  className="relative z-10 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
                />
                <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                  <span>-180°</span>
                  <span className="text-slate-300">0°</span>
                  <span>180°</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="h-10 w-full justify-center rounded-[20px] border-transparent bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              <Copy size={14} className="mr-2" />
              Duplicate
            </Button>
            <Button
              variant="glass"
              size="md"
              className="h-10 w-full justify-center rounded-[20px] border-red-100/50 bg-red-50/50 text-xs font-semibold text-red-500 shadow-none hover:border-red-200 hover:bg-red-100 hover:text-red-600"
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
