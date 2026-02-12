import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, X } from 'lucide-react';
import type { Project } from '../types/project';
import { Button } from './Button';
import { usePopup, createErrorPopup, createSuccessPopup } from '../contexts/PopupContext';
import { copyToClipboard, generatePublishURL } from '../utils/publishUtils';
import { useAuth } from '../contexts/AuthContext';
import { getExistingPublish, unpublishProject } from '../services/publishService';

export interface PublishModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  // Keep this list conservative and predictable for our modal UI.
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );

  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // If something is intentionally non-focusable, respect it.
    const tabIndex = el.getAttribute('tabindex');
    if (tabIndex === '-1') return false;
    return true;
  });
}

/**
 * Modal component for publishing a simulation.
 * Displays a shareable link with copy and open functionality.
 */
export function PublishModal({ project, isOpen, onClose }: PublishModalProps): JSX.Element | null {
  const { showPopup } = usePopup();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [publishUrl, setPublishUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingPublishState, setIsLoadingPublishState] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setPublishError(null);

    if (!user?.id || !project.id.trim()) {
      setPublishUrl('');
      setIsPublished(false);
      return;
    }

    let isCancelled = false;

    const loadExistingPublish = async (): Promise<void> => {
      setIsLoadingPublishState(true);
      try {
        const existing = await getExistingPublish(project.id, user.id);
        if (isCancelled) return;
        if (existing?.isActive) {
          setPublishUrl(existing.url);
          setIsPublished(true);
        } else {
          setPublishUrl('');
          setIsPublished(false);
        }
      } catch (error) {
        if (isCancelled) return;
        console.error('[PublishModal] Failed to load existing publish state:', error);
        setPublishError('Unable to check publish status right now. You can still try publishing.');
      } finally {
        if (!isCancelled) {
          setIsLoadingPublishState(false);
        }
      }
    };

    void loadExistingPublish();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, project.id, user?.id]);

  const statusText = useMemo(() => {
    if (!user?.id) return 'Sign in to publish and share this simulation.';
    if (!project.id.trim()) return 'Save this project first, then publish a share link.';
    if (isLoadingPublishState) return 'Checking publish status...';
    if (isPublishing) return 'Publishing... Syncing and copying assets...';
    if (isUnpublishing) return 'Unpublishing link...';
    if (isPublished) return 'This simulation is published. You can copy the link or republish updates.';
    return 'Create a shareable link that anyone can open.';
  }, [isLoadingPublishState, isPublished, isPublishing, isUnpublishing, project.id, user?.id]);

  const handlePublish = useCallback(async () => {
    if (!user?.id) {
      setPublishError('You need to be signed in to publish.');
      return;
    }
    if (!project.id.trim()) {
      setPublishError('Save this project before publishing.');
      return;
    }

    setPublishError(null);
    setIsPublishing(true);
    try {
      const result = await generatePublishURL(project, user.id);
      setPublishUrl(result.url);
      setIsPublished(true);
      showPopup(createSuccessPopup('Published', 'Your share link is ready.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish simulation.';
      setPublishError(message);
      showPopup(createErrorPopup('Publish failed', message));
    } finally {
      setIsPublishing(false);
    }
  }, [project, showPopup, user?.id]);

  const handleUnpublish = useCallback(async () => {
    if (!user?.id) {
      setPublishError('You need to be signed in to unpublish.');
      return;
    }
    if (!project.id.trim()) {
      setPublishError('Project ID is missing; cannot unpublish.');
      return;
    }

    setPublishError(null);
    setIsUnpublishing(true);
    try {
      await unpublishProject(project.id, user.id);
      setPublishUrl('');
      setIsPublished(false);
      showPopup(createSuccessPopup('Unpublished', 'Your published link has been disabled.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unpublish simulation.';
      setPublishError(message);
      showPopup(createErrorPopup('Unpublish failed', message));
    } finally {
      setIsUnpublishing(false);
    }
  }, [project.id, showPopup, user?.id]);

  const isBusy = isPublishing || isLoadingPublishState || isUnpublishing;

  // Focus trap + restore focus on close/unmount.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const active = document.activeElement;
      const currentIndex = active ? focusables.indexOf(active as HTMLElement) : -1;

      // If focus is outside the dialog, pull it back in.
      if (currentIndex === -1) {
        e.preventDefault();
        (e.shiftKey ? focusables[focusables.length - 1] : focusables[0]).focus();
        return;
      }

      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + focusables.length) % focusables.length
        : (currentIndex + 1) % focusables.length;

      e.preventDefault();
      focusables[nextIndex].focus();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      // Restore focus to what opened the modal.
      const toRestore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      setTimeout(() => {
        toRestore?.focus?.();
      }, 0);
    };
  }, [isOpen, onClose]);

  const handleCopy = useCallback(async () => {
    if (!publishUrl) {
      showPopup(createErrorPopup('Copy failed', 'No valid URL to copy'));
      return;
    }
    const ok = await copyToClipboard(publishUrl);
    if (ok) {
      showPopup(createSuccessPopup('Link copied', 'Your published link has been copied to clipboard.'));
    } else {
      showPopup(
        createErrorPopup(
          'Copy failed',
          'Could not copy the link automatically. Please select the link and copy it manually.'
        )
      );
    }
  }, [publishUrl, showPopup]);

  const handleOpen = useCallback(() => {
    if (!publishUrl) {
      showPopup(createErrorPopup('Cannot open', 'No valid URL to open'));
      return;
    }
    window.open(publishUrl, '_blank', 'noopener,noreferrer');
  }, [publishUrl, showPopup]);

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Publish simulation"
      aria-labelledby="publish-modal-title"
      aria-describedby="publish-modal-description"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-sm"
        aria-label="Close publish modal"
        onClick={onClose}
        tabIndex={-1}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative mx-4 w-full max-w-lg rounded-[32px] border border-white/40 bg-white/80 p-6 shadow-glass backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3
              id="publish-modal-title"
              className="truncate text-sm font-bold tracking-tight text-slate-800"
            >
              Publish “{project.name}”
            </h3>
            <p
              id="publish-modal-description"
              className="mt-1 text-xs leading-relaxed text-slate-500"
            >
              {statusText}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 rounded-[20px]"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-xs font-semibold text-slate-600">Published link</label>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={publishUrl}
              readOnly
              className="h-11 w-full rounded-[20px] border border-white/50 bg-white/60 px-4 text-sm text-slate-800 shadow-sm outline-none ring-blue-500/30 focus:ring-2"
              aria-label="Published link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={handleCopy}
              disabled={isBusy || !publishUrl}
              className="h-11 whitespace-nowrap rounded-[20px] px-4"
            >
              <Copy size={16} className="mr-2" />
              Copy
            </Button>
          </div>

          {publishError && (
            <p className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {publishError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            {isPublished && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleUnpublish}
                disabled={isBusy}
                className="rounded-[20px] border-red-200 text-red-700 hover:bg-red-50"
              >
                Unpublish
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={handlePublish}
              disabled={isBusy || !user?.id || !project.id.trim()}
              className="rounded-[20px]"
            >
              {isPublishing ? 'Publishing...' : isPublished ? 'Update publish' : 'Publish'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleOpen}
              disabled={isBusy || !publishUrl}
              className="rounded-[20px]"
            >
              <ExternalLink size={16} className="mr-2" />
              Open in new tab
            </Button>
            <Button variant="primary" size="md" onClick={onClose} className="rounded-[20px]">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

