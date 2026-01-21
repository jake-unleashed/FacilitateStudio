import { memo } from 'react';
import { Menu, MonitorPlay, Share2 } from 'lucide-react';
import { Button } from '../Button';

export const ActionButtons = memo<{
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
}>(({ onPreviewClick, onPublishClick }) => (
  <div className="z-10 flex items-center gap-3">
    <Button
      variant="secondary"
      className="hidden gap-2 rounded-[20px] border-white/40 bg-white/50 font-medium shadow-none hover:shadow-md sm:flex"
      onClick={onPreviewClick}
    >
      <MonitorPlay size={16} className="text-slate-500" />
      Preview
    </Button>
    <Button
      variant="primary"
      className="gap-2 rounded-[20px] pl-4 pr-5 shadow-lg shadow-blue-500/30"
      onClick={onPublishClick}
    >
      <Share2 size={16} />
      Publish
    </Button>
    <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
      <Menu size={20} />
    </Button>
  </div>
));
ActionButtons.displayName = 'ActionButtons';

