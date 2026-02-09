import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { WelcomeModal } from './WelcomeModal';

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <WelcomeModal
        isOpen={open}
        onSelectGuided={() => setOpen(false)}
        onSelectEditor={() => setOpen(false)}
      />
    </div>
  );
}

describe('WelcomeModal animations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stays mounted briefly after closing to allow exit animation', async () => {
    render(<Harness />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Close via backdrop/button click (Escape behavior is covered elsewhere).
    // The backdrop button has aria-label "Close guided setup modal".
    fireEvent.click(screen.getByLabelText(/close guided setup modal/i));

    // Immediately after closing, it should still be mounted (exiting).
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // After animation duration, it should unmount.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('unmounts immediately when prefers-reduced-motion is set', async () => {
    const originalMatchMedia = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<Harness />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/close guided setup modal/i));

    // Reduced motion: no exit animation delay.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    vi.stubGlobal('matchMedia', originalMatchMedia);
  });
});

