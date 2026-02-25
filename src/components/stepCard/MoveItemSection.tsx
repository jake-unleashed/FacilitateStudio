import { CheckCircle, Circle } from 'lucide-react';
import type { SceneObject, SimStep } from '../../types';
import { HelpIcon } from '../HelpIcon';
import { TargetObjectPicker } from './TargetObjectPicker';

export interface MoveItemSectionProps {
  step: SimStep;
  isVisible: boolean;
  compact?: boolean;
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
  compact = false,
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

  const hasEndTransform = !!step.endPosition || !!step.endRotation || !!step.endScale;

  return (
    <div className={`border-t border-white/30 ${compact ? 'pt-3' : 'pt-4'}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Settings</span>
        <HelpIcon content="Choose which object moves and where it moves to." />
      </div>

      <div className={`mb-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
        <TargetObjectPicker
          compact={compact}
          helpText="The object that will move when the trainee performs this step."
          targetObject={targetObject}
          targetChildName={targetChildName}
          canUseSelectedObject={canUseSelectedObject}
          effectiveTargetObjectId={effectiveTargetObjectId}
          effectiveTargetChildPath={effectiveTargetChildPath}
          onUseSelectedObject={onUseSelectedObject}
          onRemoveTargetObject={onRemoveTargetObject}
          onFocusTargetObject={onFocusTargetObject}
        />

        {targetObject && (
          <div
            className={`rounded-[16px] border border-white/40 bg-white/40 shadow-sm ${
              compact ? 'px-3 py-2' : 'px-3 py-2.5'
            }`}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-700">End position</label>
              <HelpIcon content="Where the object will be when this step is complete. Move the object, then click 'Stop Recording' to save its position." />
            </div>
            <div className={compact ? 'space-y-2' : 'space-y-3'}>
              {isRecordingPosition ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-[10px] border border-blue-200/60 bg-blue-50/50 px-3 py-2">
                    <Circle size={12} className="animate-pulse fill-blue-600 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">
                      Recording... Move/rotate/scale the object to its end position
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
                  {hasEndTransform ? (
                    <div className="flex items-center gap-2 rounded-[10px] border border-green-200/60 bg-green-50/50 px-3 py-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span className="text-xs font-medium text-green-700">End position recorded</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[10px] border border-slate-200/60 bg-slate-100/50 px-3 py-2">
                      <Circle size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-400">No end position recorded</span>
                    </div>
                  )}
                  <button
                    onClick={onToggleRecording}
                    className="w-full rounded-[10px] border border-blue-300/60 bg-blue-100/50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:border-blue-400/80 hover:bg-blue-200/60"
                    title="Click to start recording the end position. Move/rotate/scale the object, then click Stop Recording."
                  >
                    {hasEndTransform ? 'Record end position again' : 'Record end position'}
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
