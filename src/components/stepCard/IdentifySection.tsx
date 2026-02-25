import type { SceneObject } from '../../types';
import { HelpIcon } from '../HelpIcon';
import { TargetObjectPicker } from './TargetObjectPicker';

export interface IdentifySectionProps {
  isVisible: boolean;
  compact?: boolean;
  targetObject: SceneObject | null;
  targetChildName?: string | null;
  canUseSelectedObject: boolean;
  effectiveTargetObjectId?: string;
  effectiveTargetChildPath?: string;
  onUseSelectedObject: () => void;
  onRemoveTargetObject: () => void;
  onFocusTargetObject: (obj: SceneObject) => void;
}

export function IdentifySection({
  isVisible,
  compact = false,
  targetObject,
  targetChildName,
  canUseSelectedObject,
  effectiveTargetObjectId,
  effectiveTargetChildPath,
  onUseSelectedObject,
  onRemoveTargetObject,
  onFocusTargetObject,
}: IdentifySectionProps): JSX.Element | null {
  if (!isVisible) return null;

  return (
    <div className={`border-t border-white/30 ${compact ? 'pt-3' : 'pt-4'}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Settings</span>
        <HelpIcon content="Choose which object trainees need to identify." />
      </div>

      <div className={`mb-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
        <TargetObjectPicker
          compact={compact}
          helpText="Trainees must click this object to complete the step."
          targetObject={targetObject}
          targetChildName={targetChildName}
          canUseSelectedObject={canUseSelectedObject}
          effectiveTargetObjectId={effectiveTargetObjectId}
          effectiveTargetChildPath={effectiveTargetChildPath}
          onUseSelectedObject={onUseSelectedObject}
          onRemoveTargetObject={onRemoveTargetObject}
          onFocusTargetObject={onFocusTargetObject}
        />
      </div>
    </div>
  );
}
