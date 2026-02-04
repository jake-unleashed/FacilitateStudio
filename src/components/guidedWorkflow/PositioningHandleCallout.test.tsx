import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositioningHandleCallout } from './PositioningHandleCallout';

describe('PositioningHandleCallout', () => {
  afterEach(() => {
    document.querySelectorAll('[data-testid="handle-xz"], [data-testid="handle-height"]').forEach((el) => el.remove());
  });

  it('does not render when closed', () => {
    render(<PositioningHandleCallout isOpen={false} />);
    expect(screen.queryByTestId('positioning-handle-callout')).not.toBeInTheDocument();
  });

  it('anchors to the xz handle when present', () => {
    const handle = document.createElement('div');
    handle.setAttribute('data-testid', 'handle-xz');
    handle.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        right: 140,
        bottom: 140,
        width: 40,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => undefined,
      }) as DOMRect;
    document.body.appendChild(handle);

    render(<PositioningHandleCallout isOpen />);
    expect(screen.getByTestId('positioning-handle-callout')).toBeInTheDocument();
  });

  it('falls back to the height handle when xz is missing', () => {
    const handle = document.createElement('div');
    handle.setAttribute('data-testid', 'handle-height');
    handle.getBoundingClientRect = () =>
      ({
        left: 160,
        top: 160,
        right: 200,
        bottom: 200,
        width: 40,
        height: 40,
        x: 160,
        y: 160,
        toJSON: () => undefined,
      }) as DOMRect;
    document.body.appendChild(handle);

    render(<PositioningHandleCallout isOpen />);
    expect(screen.getByTestId('positioning-handle-callout')).toBeInTheDocument();
  });

  it('renders a close button when onClose is provided', () => {
    const handle = document.createElement('div');
    handle.setAttribute('data-testid', 'handle-xz');
    handle.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        right: 140,
        bottom: 140,
        width: 40,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => undefined,
      }) as DOMRect;
    document.body.appendChild(handle);

    render(<PositioningHandleCallout isOpen onClose={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

