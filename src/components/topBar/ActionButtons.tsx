import { memo, useCallback } from 'react';
import { Menu, MonitorPlay, Share2 } from 'lucide-react';
import { Button } from '../Button';
import { usePopup } from '../../contexts/PopupContext';

export const ActionButtons = memo<{
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
  hasUsableSteps?: boolean;
}>(({ onPreviewClick, onPublishClick, hasUsableSteps = true }) => {
  const { showPopup } = usePopup();
  const actionsDisabled = !hasUsableSteps;

  const handlePreview = useCallback(() => {
    if (actionsDisabled) {
      showPopup({
        type: 'error',
        title: 'Not ready to preview',
        message: 'Add and configure at least one step before previewing.',
      });
      return;
    }
    onPreviewClick?.();
  }, [actionsDisabled, onPreviewClick, showPopup]);

  const handlePublish = useCallback(() => {
    if (actionsDisabled) {
      showPopup({
        type: 'error',
        title: 'Not ready to publish',
        message: 'Add and configure at least one step before publishing.',
      });
      return;
    }
    onPublishClick?.();
  }, [actionsDisabled, onPublishClick, showPopup]);

  return (
    <div className="z-10 flex items-center gap-3">
      <Button
        variant="secondary"
        aria-disabled={actionsDisabled}
        title={actionsDisabled ? 'Add and configure a step to preview' : 'Preview'}
        className={`hidden gap-2 rounded-[20px] border-white/40 bg-white/50 font-medium shadow-none sm:flex ${
          actionsDisabled ? 'cursor-not-allowed opacity-50' : 'hover:shadow-md'
        }`}
        onClick={handlePreview}
      >
        <MonitorPlay size={16} className="text-slate-500" />
        Preview
      </Button>
      <Button
        variant="primary"
        aria-disabled={actionsDisabled}
        title={actionsDisabled ? 'Add and configure a step to publish' : 'Publish'}
        className={`gap-2 rounded-[20px] pl-4 pr-5 shadow-lg shadow-blue-500/30 ${
          actionsDisabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
        onClick={handlePublish}
      >
        <Share2 size={16} />
        Publish
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
        <Menu size={20} />
      </Button>
    </div>
  );
});
ActionButtons.displayName = 'ActionButtons';

