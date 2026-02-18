import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewSettingsPanel } from './PreviewSettingsPanel';
import type { SimulationSettings } from '../../types/simulationSettings';

function makeSettings(overrides: Partial<SimulationSettings> = {}): SimulationSettings {
  return { allowOrbit: false, allowZoom: false, ...overrides };
}

describe('PreviewSettingsPanel', () => {
  let onSettingsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSettingsChange = vi.fn();
  });

  describe('Rendering', () => {
    it('renders the settings button', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      expect(screen.getByRole('button', { name: /open preview settings/i })).toBeInTheDocument();
    });

    it('does not show the panel by default', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the panel when the button is clicked', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      expect(screen.getByRole('dialog', { name: /preview settings/i })).toBeInTheDocument();
    });

    it('closes the panel when the button is clicked again', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      const btn = screen.getByRole('button', { name: /open preview settings/i });
      fireEvent.click(btn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /close preview settings/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows Orbit and Zoom toggles inside the panel', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      expect(screen.getByRole('switch', { name: /orbit/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /zoom/i })).toBeInTheDocument();
    });
  });

  describe('Toggle behaviour', () => {
    it('calls onSettingsChange with allowOrbit toggled when Orbit switch is clicked', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      fireEvent.click(screen.getByRole('switch', { name: /enable orbit/i }));
      expect(onSettingsChange).toHaveBeenCalledWith({ allowOrbit: true, allowZoom: false });
    });

    it('calls onSettingsChange with allowZoom toggled when Zoom switch is clicked', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      fireEvent.click(screen.getByRole('switch', { name: /enable zoom/i }));
      expect(onSettingsChange).toHaveBeenCalledWith({ allowOrbit: false, allowZoom: true });
    });

    it('toggles Orbit off when it was previously on', () => {
      render(
        <PreviewSettingsPanel
          settings={makeSettings({ allowOrbit: true })}
          onSettingsChange={onSettingsChange}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      fireEvent.click(screen.getByRole('switch', { name: /disable orbit/i }));
      expect(onSettingsChange).toHaveBeenCalledWith({ allowOrbit: false, allowZoom: false });
    });

    it('reflects current settings via aria-checked', () => {
      render(
        <PreviewSettingsPanel
          settings={makeSettings({ allowOrbit: true, allowZoom: false })}
          onSettingsChange={onSettingsChange}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      expect(screen.getByRole('switch', { name: /orbit/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('switch', { name: /zoom/i })).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Keyboard interaction', () => {
    it('closes the panel on Escape and returns focus to the button', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      const openBtn = screen.getByRole('button', { name: /open preview settings/i });
      fireEvent.click(openBtn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('sets aria-expanded on the trigger button', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      const btn = screen.getByRole('button', { name: /open preview settings/i });
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(btn);
      expect(screen.getByRole('button', { name: /close preview settings/i })).toHaveAttribute('aria-expanded', 'true');
    });

    it('panel has role dialog and aria-modal', () => {
      render(<PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />);
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Click-away', () => {
    it('closes the panel when clicking outside the container', () => {
      render(
        <div>
          <PreviewSettingsPanel settings={makeSettings()} onSettingsChange={onSettingsChange} />
          <button data-testid="outside">Outside</button>
        </div>
      );
      fireEvent.click(screen.getByRole('button', { name: /open preview settings/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.pointerDown(screen.getByTestId('outside'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
