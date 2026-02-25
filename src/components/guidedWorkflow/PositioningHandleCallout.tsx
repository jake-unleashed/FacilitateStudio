import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const VIEWPORT_PADDING = 12;
const GAP = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRect(el: Element | null): Rect | null {
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

export interface PositioningHandleCalloutProps {
  isOpen: boolean;
  title?: string;
  body?: React.ReactNode;
  onClose?: () => void;
}

/**
 * A single, purpose-built callout that points at the move gizmo handles.
 * Anchors to the DOM handles rendered by TransformGizmo (`handle-xz` / `handle-height`).
 */
export function PositioningHandleCallout({
  isOpen,
  title = 'Adjust position',
  body = 'Drag these handles to move your model on the ground or lift it up/down.',
  onClose,
}: PositioningHandleCalloutProps): JSX.Element | null {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; hasTarget: boolean }>({
    top: 0,
    left: 0,
    hasTarget: false,
  });
  const rafRef = useRef<number | null>(null);

  const compute = useCallback(() => {
    if (!isOpen) return;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const targetEl =
      typeof document !== 'undefined'
        ? (document.querySelector('[data-testid="handle-xz"]') ??
          document.querySelector('[data-testid="handle-height"]'))
        : null;

    const targetRect = getRect(targetEl);
    const cardRect = getRect(cardEl);
    if (!cardRect) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!targetRect) {
      // No target yet: don't render (keeps UI calm until the gizmo is visible).
      setPos((prev) => ({ ...prev, hasTarget: false }));
      return;
    }

    const desiredTop = targetRect.top + targetRect.height / 2 - cardRect.height / 2;
    const desiredLeft = targetRect.right + GAP;

    let top = desiredTop;
    let left = desiredLeft;

    // If it doesn't fit to the right, fall back to centered placement.
    if (
      left < VIEWPORT_PADDING ||
      top < VIEWPORT_PADDING ||
      left + cardRect.width > vw - VIEWPORT_PADDING ||
      top + cardRect.height > vh - VIEWPORT_PADDING
    ) {
      top = vh / 2 - cardRect.height / 2;
      left = vw / 2 - cardRect.width / 2;
    }

    setPos({
      top: clamp(top, VIEWPORT_PADDING, vh - cardRect.height - VIEWPORT_PADDING),
      left: clamp(left, VIEWPORT_PADDING, vw - cardRect.width - VIEWPORT_PADDING),
      hasTarget: true,
    });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    compute();
  }, [isOpen, compute, title]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = () => compute();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [isOpen, compute]);

  useEffect(() => {
    if (!isOpen) return;

    const tick = () => {
      compute();
      rafRef.current = window.setTimeout(tick, 200);
    };

    tick();

    return () => {
      if (rafRef.current) {
        window.clearTimeout(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [compute, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[80]">
      <div
        ref={cardRef}
        className="pointer-events-auto absolute w-[320px] max-w-[calc(100vw-24px)]"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label={title}
        data-testid="positioning-handle-callout"
      >
        <div
          className="relative overflow-hidden rounded-[20px] border border-white/40 bg-white/80 shadow-glass backdrop-blur-xl transition-opacity duration-200"
          style={{ opacity: pos.hasTarget ? 1 : 0 }}
          aria-hidden={!pos.hasTarget}
        >
          {/* Arrow pointing left toward the handle */}
          <div
            className="absolute left-[-8px] top-1/2 h-4 w-4 rotate-45 border border-white/60 bg-white/90 shadow-md backdrop-blur-xl"
            aria-hidden="true"
            style={{ transform: 'translateY(-50%) rotate(45deg)' }}
          />

          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold tracking-tight text-slate-800">{title}</p>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[12px] border border-white/40 bg-white/60 p-1.5 text-slate-500 shadow-sm transition-all duration-300 hover:bg-white/80 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <div className="text-sm font-medium leading-relaxed text-slate-700">{body}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

