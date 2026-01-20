import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Copy, ExternalLink, X } from 'lucide-react';
import type { Project } from '../types/project';
import { Button } from './Button';
import { usePopup, createErrorPopup, createSuccessPopup } from '../contexts/PopupContext';
import { copyToClipboard, generatePublishURL } from '../utils/publishUtils';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const publish = useMemo(() => {
    try {
      return generatePublishURL(project.id);
    } catch (error) {
      console.error('[PublishModal] Failed to generate publish URL:', error);
      // Return a fallback result to prevent crashes
      return {
        url: '',
        warning: 'Unable to generate publish link. Please ensure the project has been saved.',
      };
    }
  }, [project.id]);

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
    if (!publish.url) {
      showPopup(createErrorPopup('Copy failed', 'No valid URL to copy'));
      return;
    }
    const ok = await copyToClipboard(publish.url);
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
  }, [publish.url, showPopup]);

  const handleOpen = useCallback(() => {
    if (!publish.url) {
      showPopup(createErrorPopup('Cannot open', 'No valid URL to open'));
      return;
    }
    window.open(publish.url, '_blank', 'noopener,noreferrer');
  }, [publish.url, showPopup]);

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
              {publish.warning}
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
              value={publish.url}
              readOnly
              className="h-11 w-full rounded-[20px] border border-white/50 bg-white/60 px-4 text-sm text-slate-800 shadow-sm outline-none ring-blue-500/30 focus:ring-2"
              aria-label="Published link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={handleCopy}
              className="h-11 whitespace-nowrap rounded-[20px] px-4"
            >
              <Copy size={16} className="mr-2" />
              Copy
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleOpen}
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

