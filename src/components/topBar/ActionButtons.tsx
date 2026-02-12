import { memo, useCallback, useState } from 'react';
import { Menu, MonitorPlay, Share2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { useAuth } from '../../contexts/AuthContext';
import { usePopup } from '../../contexts/PopupContext';

export const ActionButtons = memo<{
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
}>(({ onPreviewClick, onPublishClick }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { showPopup } = usePopup();
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  return (
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

