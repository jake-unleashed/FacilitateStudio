import { memo, useCallback, useState } from 'react';
import { Menu, MonitorPlay, Share2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { useAuth } from '../../contexts/AuthContext';
import { usePopup } from '../../contexts/PopupContext';

export const ActionButtons = memo<{
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
  hasUsableSteps?: boolean;
}>(({ onPreviewClick, onPublishClick, hasUsableSteps = true }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { showPopup } = usePopup();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const actionsDisabled = !hasUsableSteps;

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('[ActionButtons] Failed to sign out:', error);
      showPopup({
        type: 'error',
        title: 'Sign Out Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to sign out right now. Please try again.',
      });
    } finally {
      setIsSigningOut(false);
    }
  }, [navigate, showPopup, signOut]);

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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          void handleSignOut();
        }}
        disabled={isSigningOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={18} />
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
        <Menu size={20} />
      </Button>
    </div>
  );
});
ActionButtons.displayName = 'ActionButtons';

