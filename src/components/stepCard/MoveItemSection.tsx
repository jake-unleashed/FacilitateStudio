import React from 'react';
import { CheckCircle, CheckCircle2, Circle, HelpCircle, Info, X } from 'lucide-react';
import type { SceneObject, SimStep } from '../../types';
import { OBJECT_ICONS } from '../../constants';

export interface MoveItemSectionProps {
  step: SimStep;
  isVisible: boolean;
  isRecordingPosition: boolean;
  targetObject: SceneObject | null;
  targetChildName?: string | null;
  canUseSelectedObject: boolean;
  effectiveTargetObjectId?: string;
  effectiveTargetChildPath?: string;

  onUseSelectedObject: () => void;
  onRemoveTargetObject: () => void;
  onFocusTargetObject: (obj: SceneObject) => void;
  onToggleRecording: () => void;
}

export function MoveItemSection({
  step,
  isVisible,
  isRecordingPosition,
  targetObject,
  targetChildName,
  canUseSelectedObject,
  effectiveTargetObjectId,
  effectiveTargetChildPath,
  onUseSelectedObject,
  onRemoveTargetObject,
  onFocusTargetObject,
  onToggleRecording,
}: MoveItemSectionProps): JSX.Element | null {
  if (!isVisible) return null;

  return (
    <div className="border-t border-white/30 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Settings</span>
        <span title="Configure which object to move/rotate/scale and what its end transform should be.">
          <HelpCircle size={12} className="text-slate-400" />
        </span>
      </div>

      <div className="mb-4 space-y-3">
        <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
          <label className="mb-2 block text-xs font-semibold text-slate-700">Target Object</label>

          {targetObject ? (
            <div className="group relative">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onFocusTargetObject(targetObject)}
                  className="flex w-full items-center gap-2 rounded-[12px] border border-slate-200/60 bg-slate-100/50 px-3 py-2 pr-10 text-left transition-all hover:border-slate-300/80 hover:bg-slate-100/80"
                >
                  {(() => {
                    const Icon = OBJECT_ICONS[targetObject.type] || Info;
                    return <Icon size={14} className="text-slate-600" />;
                  })()}
                  <span className="flex-1 text-xs font-medium text-slate-700">
                    {targetObject.name}
                    {targetChildName && ` / ${targetChildName}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onRemoveTargetObject}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                  title="Remove target object"
                  aria-label="Remove target object"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex-1 rounded-[10px] border border-slate-200/60 bg-slate-100/50 px-3 py-2 text-xs text-slate-400">
                No object selected
              </div>
              <button
                onClick={onUseSelectedObject}
                disabled={!canUseSelectedObject}
                className={`
                  flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-2 text-xs font-semibold transition-all
                  ${
                    canUseSelectedObject
                      ? 'border-slate-300/60 bg-slate-100/50 text-slate-700 hover:border-slate-400/80 hover:bg-slate-200/60'
                      : 'cursor-not-allowed border-slate-200/60 bg-slate-100/50 text-slate-400'
                  }
                `}
                title={
                  canUseSelectedObject ? 'Use the currently selected object in the scene' : 'Select an object in the scene first'
                }
              >
                <CheckCircle2 size={13} />
                <span>Use Selected Object</span>
              </button>
            </div>
          )}

          {!targetObject && effectiveTargetObjectId && (
            <p className="mt-2 text-xs text-rose-600">Object not found. It may have been deleted.</p>
          )}
          {targetObject && effectiveTargetChildPath && !targetChildName && (
            <p className="mt-2 text-xs text-rose-600">Child mesh not found. It may have been deleted.</p>
          )}
        </div>

        {targetObject && (
          <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
            <label className="mb-2 block text-xs font-semibold text-slate-700">End Transform</label>
            <div className="space-y-3">
              {isRecordingPosition ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-[10px] border border-blue-200/60 bg-blue-50/50 px-3 py-2">
                    <Circle size={12} className="animate-pulse fill-blue-600 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">
                      Recording... Move/rotate/scale the object to its end transform
                    </span>
                  </div>
                  <button
                    onClick={onToggleRecording}
                    className="w-full rounded-[10px] border border-rose-300/60 bg-rose-100/50 px-3 py-2 text-xs font-semibold text-rose-700 transition-all hover:border-rose-400/80 hover:bg-rose-200/60"
                  >
                    Stop Recording
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const hasEndTransform = !!step.endPosition || !!step.endRotation || !!step.endScale;
                    return hasEndTransform;
                  })() ? (
                    <div className="flex items-center gap-2 rounded-[10px] border border-green-200/60 bg-green-50/50 px-3 py-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span className="text-xs font-medium text-green-700">End transform recorded</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[10px] border border-slate-200/60 bg-slate-100/50 px-3 py-2">
                      <Circle size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-400">No end transform recorded</span>
                    </div>
                  )}
                  <button
                    onClick={onToggleRecording}
                    className="w-full rounded-[10px] border border-blue-300/60 bg-blue-100/50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:border-blue-400/80 hover:bg-blue-200/60"
                    title="Click to start recording the end transform. Move/rotate/scale the object, then click Stop Recording."
                  >
                    {(() => {
                      const hasEndTransform = !!step.endPosition || !!step.endRotation || !!step.endScale;
                      return hasEndTransform ? 'Record New Transform' : 'Record End Transform';
                    })()}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

