import { CheckCircle2, Info, X } from 'lucide-react';
import type { SceneObject } from '../../types';
import { OBJECT_ICONS } from '../../constants';
import { HelpIcon } from '../HelpIcon';

export interface TargetObjectPickerProps {
  compact?: boolean;
  helpText: string;
  targetObject: SceneObject | null;
  targetChildName?: string | null;
  canUseSelectedObject: boolean;
  effectiveTargetObjectId?: string;
  effectiveTargetChildPath?: string;
  onUseSelectedObject: () => void;
  onRemoveTargetObject: () => void;
  onFocusTargetObject: (obj: SceneObject) => void;
}

export function TargetObjectPicker({
  compact = false,
  helpText,
  targetObject,
  targetChildName,
  canUseSelectedObject,
  effectiveTargetObjectId,
  effectiveTargetChildPath,
  onUseSelectedObject,
  onRemoveTargetObject,
  onFocusTargetObject,
}: TargetObjectPickerProps): JSX.Element {
  return (
    <div
      className={`rounded-[16px] border border-white/40 bg-white/40 shadow-sm ${
        compact ? 'px-3 py-2' : 'px-3 py-2.5'
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-700">Target Object</label>
        <HelpIcon content={helpText} />
      </div>

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
  );
}
