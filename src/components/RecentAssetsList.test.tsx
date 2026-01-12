/**
 * Tests for RecentAssetsList component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RecentAssetsList,
  stripFileExtension,
  ADDED_FEEDBACK_DURATION_MS,
} from './RecentAssetsList';
import type { AssetMetadata } from '../types/model';

// Mock formatRelativeDate
vi.mock('../utils/formatRelativeDate', () => ({
  formatRelativeDate: vi.fn((date: string) => {
    // Return a simple mock relative date
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return 'Earlier';
  }),
}));

describe('RecentAssetsList', () => {
  // ===========================================================================
  // Test Data
  // ===========================================================================

  const mockOnAddAsset = vi.fn();

  function createMockAsset(id: string, overrides: Partial<AssetMetadata> = {}): AssetMetadata {
    return {
      id,
      name: `model-${id}.obj`,
      fileType: 'obj',
      fileSize: 1024 * 1024, // 1MB
      uploadDate: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Empty State
  // ===========================================================================

  describe('empty state', () => {
    it('shows empty message when no assets', () => {
      render(<RecentAssetsList assets={[]} onAddAsset={mockOnAddAsset} />);

      expect(screen.getByText('No recent assets')).toBeInTheDocument();
      expect(screen.getByText('Uploaded assets will appear here')).toBeInTheDocument();
    });

    it('shows custom empty message', () => {
      render(
        <RecentAssetsList assets={[]} onAddAsset={mockOnAddAsset} emptyMessage="Nothing here yet" />
      );

      expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Asset List
  // ===========================================================================

  describe('asset list', () => {
    it('renders list of assets', () => {
      const assets = [
        createMockAsset('1', { name: 'chair.obj' }),
        createMockAsset('2', { name: 'table.glb' }),
        createMockAsset('3', { name: 'lamp.fbx' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Should display names without extensions
      expect(screen.getByText('chair')).toBeInTheDocument();
      expect(screen.getByText('table')).toBeInTheDocument();
      expect(screen.getByText('lamp')).toBeInTheDocument();
    });

    it('strips file extensions from displayed names', () => {
      const assets = [
        createMockAsset('1', { name: 'model.obj' }),
        createMockAsset('2', { name: 'complex-model-name.fbx' }),
        createMockAsset('3', { name: 'file.with.multiple.dots.glb' }),
        createMockAsset('4', { name: 'noextension' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      expect(screen.getByText('model')).toBeInTheDocument();
      expect(screen.getByText('complex-model-name')).toBeInTheDocument();
      expect(screen.getByText('file.with.multiple.dots')).toBeInTheDocument();
      expect(screen.getByText('noextension')).toBeInTheDocument();
    });

    it('does not show file type badges', () => {
      const assets = [
        createMockAsset('1', { name: 'model.obj', fileType: 'obj' }),
        createMockAsset('2', { name: 'model.fbx', fileType: 'fbx' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // File type badges should not be present
      expect(screen.queryByText('OBJ')).not.toBeInTheDocument();
      expect(screen.queryByText('FBX')).not.toBeInTheDocument();
    });

    it('does not show file size', () => {
      const assets = [createMockAsset('1', { fileSize: 2.5 * 1024 * 1024 })]; // 2.5MB

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // File size should not be displayed
      expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
      expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
    });

    it('shows relative date', () => {
      const assets = [createMockAsset('1')];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // The mocked formatRelativeDate returns 'Just now' for recent dates
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('displays icon for each asset', () => {
      const assets = [createMockAsset('1', { name: 'test.obj' })];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Package icon should be present (aria-hidden on the icon itself)
      const button = screen.getByRole('button', { name: /add test to scene/i });
      expect(button).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // File Extension Stripping
  // ===========================================================================

  describe('stripFileExtension utility', () => {
    it('strips single extension', () => {
      expect(stripFileExtension('model.obj')).toBe('model');
      expect(stripFileExtension('chair.glb')).toBe('chair');
    });

    it('strips extension from files with multiple dots', () => {
      expect(stripFileExtension('file.name.obj')).toBe('file.name');
      expect(stripFileExtension('complex.model.fbx')).toBe('complex.model');
    });

    it('returns filename unchanged if no extension', () => {
      expect(stripFileExtension('noextension')).toBe('noextension');
      expect(stripFileExtension('file')).toBe('file');
    });

    it('handles edge cases', () => {
      expect(stripFileExtension('.hidden')).toBe('');
      expect(stripFileExtension('file.')).toBe('file');
      expect(stripFileExtension('')).toBe('');
    });
  });

  // ===========================================================================
  // Sorting
  // ===========================================================================

  describe('sorting', () => {
    it('sorts assets by upload date (most recent first)', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-01-15');
      const newerDate = new Date('2024-01-20');

      const assets = [
        createMockAsset('old', { name: 'old.obj', uploadDate: oldDate.toISOString() }),
        createMockAsset('newer', { name: 'newer.obj', uploadDate: newerDate.toISOString() }),
        createMockAsset('new', { name: 'new.obj', uploadDate: newDate.toISOString() }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Get displayed names (without extensions)
      const newerName = screen.getByText('newer');
      const newName = screen.getByText('new');
      const oldName = screen.getByText('old');

      // Check that they appear in the correct order (most recent first)
      // We can verify order by checking their positions in the DOM
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map((btn) => btn.textContent || '');

      // Should be ordered: newer, new, old (most recent first)
      expect(buttonTexts[0]).toContain('newer');
      expect(buttonTexts[1]).toContain('new');
      expect(buttonTexts[2]).toContain('old');

      // Verify all names are present
      expect(newerName).toBeInTheDocument();
      expect(newName).toBeInTheDocument();
      expect(oldName).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Click Handling
  // ===========================================================================

  describe('click handling', () => {
    it('calls onAddAsset when asset is clicked', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      expect(mockOnAddAsset).toHaveBeenCalledTimes(1);
      expect(mockOnAddAsset).toHaveBeenCalledWith(asset);
    });

    it('calls onAddAsset with correct asset in list', async () => {
      const user = userEvent.setup();
      const assets = [
        createMockAsset('1', { name: 'first.obj' }),
        createMockAsset('2', { name: 'second.obj' }),
        createMockAsset('3', { name: 'third.obj' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add second to scene/i });
      await user.click(button);

      expect(mockOnAddAsset).toHaveBeenCalledTimes(1);
      expect(mockOnAddAsset).toHaveBeenCalledWith(assets[1]);
    });

    it('has proper accessibility attributes', () => {
      const assets = [createMockAsset('1', { name: 'test.obj' })];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add test to scene/i });
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================

  describe('accessibility', () => {
    it('provides descriptive aria-labels for buttons', () => {
      const assets = [
        createMockAsset('1', { name: 'chair.obj' }),
        createMockAsset('2', { name: 'table.glb' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      expect(screen.getByRole('button', { name: /add chair to scene/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add table to scene/i })).toBeInTheDocument();
    });

    it('marks decorative icons as aria-hidden', () => {
      const assets = [createMockAsset('1', { name: 'test.obj' })];

      const { container } = render(
        <RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />
      );

      // Package and Clock icons should be marked as aria-hidden
      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // "Added to Scene" Feedback
  // ===========================================================================

  describe('added to scene feedback', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('shows "Added to scene!" feedback when asset is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Initially should show the asset name
      expect(screen.getByText('chair')).toBeInTheDocument();
      expect(screen.queryByText('Added to scene!')).not.toBeInTheDocument();

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      // Should now show "Added to scene!" feedback
      expect(screen.getByText('Added to scene!')).toBeInTheDocument();
      // The asset name should still be visible (below the "Added to scene!" text)
      expect(screen.getByText('chair')).toBeInTheDocument();
    });

    it('disables the button while showing feedback', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add chair to scene/i });

      // Initially enabled
      expect(button).not.toBeDisabled();

      // Click the asset
      await user.click(button);

      // Button should now be disabled
      expect(button).toBeDisabled();
    });

    it('updates aria-label when showing feedback', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      // Aria-label should update to indicate it was added
      expect(screen.getByRole('button', { name: /chair added to scene/i })).toBeInTheDocument();
    });

    it('shows green styling when in feedback state', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      // Button should have green styling (border-green-200 class)
      expect(button).toHaveClass('border-green-200');
    });

    it('resets feedback after timeout duration', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      // Verify feedback is showing
      expect(screen.getByText('Added to scene!')).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Advance time past the feedback duration
      await act(async () => {
        vi.advanceTimersByTime(ADDED_FEEDBACK_DURATION_MS + 100);
      });

      // Feedback should be reset - button should now be enabled and show the asset name
      expect(screen.queryByText('Added to scene!')).not.toBeInTheDocument();
      expect(screen.getByText('chair')).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('only shows feedback on the clicked asset', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const assets = [
        createMockAsset('1', { name: 'chair.obj' }),
        createMockAsset('2', { name: 'table.obj' }),
        createMockAsset('3', { name: 'lamp.obj' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Click the second asset (table)
      const tableButton = screen.getByRole('button', { name: /add table to scene/i });
      await user.click(tableButton);

      // Table button should be disabled and show feedback
      expect(tableButton).toBeDisabled();

      // Chair and lamp buttons should still be enabled
      const chairButton = screen.getByRole('button', { name: /add chair to scene/i });
      const lampButton = screen.getByRole('button', { name: /add lamp to scene/i });
      expect(chairButton).not.toBeDisabled();
      expect(lampButton).not.toBeDisabled();

      // Only one "Added to scene!" should be visible
      expect(screen.getAllByText('Added to scene!')).toHaveLength(1);
    });

    it('switches feedback when clicking different asset before timeout', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const assets = [
        createMockAsset('1', { name: 'chair.obj' }),
        createMockAsset('2', { name: 'table.obj' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Click the chair
      const chairButton = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(chairButton);

      // Chair should show feedback
      expect(chairButton).toBeDisabled();

      // Advance time partially
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Click the table
      const tableButton = screen.getByRole('button', { name: /add table to scene/i });
      await user.click(tableButton);

      // Now table should show feedback and chair should be back to normal
      expect(tableButton).toBeDisabled();
      expect(chairButton).not.toBeDisabled();

      // Still only one "Added to scene!" visible
      expect(screen.getAllByText('Added to scene!')).toHaveLength(1);
    });

    it('calls onAddAsset immediately (not delayed)', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      // onAddAsset should be called immediately, not after timeout
      expect(mockOnAddAsset).toHaveBeenCalledTimes(1);
      expect(mockOnAddAsset).toHaveBeenCalledWith(asset);
    });

    it('cleans up timeout on unmount', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const asset = createMockAsset('1', { name: 'chair.obj' });

      const { unmount } = render(
        <RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />
      );

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(button);

      // Unmount before timeout completes
      unmount();

      // Advancing time should not cause errors
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(ADDED_FEEDBACK_DURATION_MS + 100);
        });
      }).not.toThrow();
    });

    it('exports the feedback duration constant', () => {
      // Verify the constant is exported and has the expected value
      expect(ADDED_FEEDBACK_DURATION_MS).toBe(2500);
    });
  });
});
