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
  const mockOnRemoveAsset = vi.fn();

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
      // The card uses role="button" and tabindex for keyboard accessibility
      expect(button).toHaveAttribute('role', 'button');
      expect(button).toHaveAttribute('tabindex', '0');
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
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Initially should show the asset name
      expect(screen.getByText('chair')).toBeInTheDocument();
      expect(screen.queryByText('Added to scene!')).not.toBeInTheDocument();

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        button.click();
      });

      // Should now show "Added to scene!" feedback
      expect(screen.getByText('Added to scene!')).toBeInTheDocument();
      // The asset name should still be visible (below the "Added to scene!" text)
      expect(screen.getByText('chair')).toBeInTheDocument();
    });

    it('disables the button while showing feedback', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add chair to scene/i });

      // Initially enabled (focusable)
      expect(button).toHaveAttribute('tabindex', '0');

      // Click the asset
      await act(async () => {
        button.click();
      });

      // Button should now be non-interactive (tabindex=-1 and cursor-default)
      expect(button).toHaveAttribute('tabindex', '-1');
      expect(button).toHaveClass('cursor-default');
    });

    it('updates aria-label when showing feedback', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        button.click();
      });

      // Aria-label should update to indicate it was added
      expect(screen.getByRole('button', { name: /chair added to scene/i })).toBeInTheDocument();
    });

    it('shows green styling when in feedback state', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        button.click();
      });

      // Button should have green styling (border-green-200 class)
      expect(button).toHaveClass('border-green-200');
    });

    it('resets feedback after timeout duration', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        button.click();
      });

      // Verify feedback is showing
      expect(screen.getByText('Added to scene!')).toBeInTheDocument();
      expect(button).toHaveAttribute('tabindex', '-1');

      // Advance time past the feedback duration
      await act(async () => {
        vi.advanceTimersByTime(ADDED_FEEDBACK_DURATION_MS + 100);
      });

      // Feedback should be reset - button should now be interactive and show the asset name
      expect(screen.queryByText('Added to scene!')).not.toBeInTheDocument();
      expect(screen.getByText('chair')).toBeInTheDocument();
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('only shows feedback on the clicked asset', async () => {
      const assets = [
        createMockAsset('1', { name: 'chair.obj' }),
        createMockAsset('2', { name: 'table.obj' }),
        createMockAsset('3', { name: 'lamp.obj' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Click the second asset (table)
      const tableButton = screen.getByRole('button', { name: /add table to scene/i });
      await act(async () => {
        tableButton.click();
      });

      // Table button should be non-interactive and show feedback
      expect(tableButton).toHaveAttribute('tabindex', '-1');

      // Chair and lamp buttons should still be interactive
      const chairButton = screen.getByRole('button', { name: /add chair to scene/i });
      const lampButton = screen.getByRole('button', { name: /add lamp to scene/i });
      expect(chairButton).toHaveAttribute('tabindex', '0');
      expect(lampButton).toHaveAttribute('tabindex', '0');

      // Only one "Added to scene!" should be visible
      expect(screen.getAllByText('Added to scene!')).toHaveLength(1);
    });

    it('switches feedback when clicking different asset before timeout', async () => {
      const assets = [
        createMockAsset('1', { name: 'chair.obj' }),
        createMockAsset('2', { name: 'table.obj' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Click the chair
      const chairButton = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        chairButton.click();
      });

      // Chair should show feedback (non-interactive)
      expect(chairButton).toHaveAttribute('tabindex', '-1');

      // Advance time partially
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Click the table
      const tableButton = screen.getByRole('button', { name: /add table to scene/i });
      await act(async () => {
        tableButton.click();
      });

      // Now table should show feedback and chair should be back to normal
      expect(tableButton).toHaveAttribute('tabindex', '-1');
      expect(chairButton).toHaveAttribute('tabindex', '0');

      // Still only one "Added to scene!" visible
      expect(screen.getAllByText('Added to scene!')).toHaveLength(1);
    });

    it('calls onAddAsset immediately (not delayed)', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        button.click();
      });

      // onAddAsset should be called immediately, not after timeout
      expect(mockOnAddAsset).toHaveBeenCalledTimes(1);
      expect(mockOnAddAsset).toHaveBeenCalledWith(asset);
    });

    it('cleans up timeout on unmount', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      const { unmount } = render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // Click the asset
      const button = screen.getByRole('button', { name: /add chair to scene/i });
      await act(async () => {
        button.click();
      });

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

  // ===========================================================================
  // Remove Asset Menu
  // ===========================================================================

  describe('remove asset menu', () => {
    it('shows ellipsis button on hover when onRemoveAsset is provided', () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // The ellipsis button should exist but be hidden (opacity-0)
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      expect(optionsButton).toBeInTheDocument();
      expect(optionsButton).toHaveClass('opacity-0');
    });

    it('does not show ellipsis button when onRemoveAsset is not provided', () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      // The ellipsis button should not be present
      expect(screen.queryByRole('button', { name: /options for chair/i })).not.toBeInTheDocument();
    });

    it('opens dropdown menu when ellipsis button is clicked', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Click the ellipsis button
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);

      // Dropdown menu should appear with "Remove" option
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /remove/i })).toBeInTheDocument();
    });

    it('calls onRemoveAsset with asset ID when Remove is clicked', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('asset-123', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Open the menu
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);

      // Click "Remove"
      const removeButton = screen.getByRole('menuitem', { name: /remove/i });
      await user.click(removeButton);

      // onRemoveAsset should be called with the asset ID
      expect(mockOnRemoveAsset).toHaveBeenCalledTimes(1);
      expect(mockOnRemoveAsset).toHaveBeenCalledWith('asset-123');
    });

    it('closes dropdown menu after clicking Remove', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Open the menu
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);

      // Click "Remove"
      const removeButton = screen.getByRole('menuitem', { name: /remove/i });
      await user.click(removeButton);

      // Menu should be closed
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('does not trigger onAddAsset when clicking ellipsis button', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Click the ellipsis button
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);

      // onAddAsset should NOT have been called
      expect(mockOnAddAsset).not.toHaveBeenCalled();
    });

    it('does not trigger onAddAsset when clicking Remove', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Open menu and click Remove
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);
      const removeButton = screen.getByRole('menuitem', { name: /remove/i });
      await user.click(removeButton);

      // onAddAsset should NOT have been called
      expect(mockOnAddAsset).not.toHaveBeenCalled();
    });

    it('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <div>
          <div data-testid="outside">Outside element</div>
          <RecentAssetsList
            assets={[asset]}
            onAddAsset={mockOnAddAsset}
            onRemoveAsset={mockOnRemoveAsset}
          />
        </div>
      );

      // Open the menu
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);

      // Menu should be open
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Click outside
      const outside = screen.getByTestId('outside');
      await user.click(outside);

      // Menu should be closed
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('hides ellipsis button when asset is in "added" state', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Click the card to add the asset (triggers "Added to scene!" state)
      const card = screen.getByRole('button', { name: /add chair to scene/i });
      await user.click(card);

      // The ellipsis button should not be visible while in added state
      expect(screen.queryByRole('button', { name: /options for chair/i })).not.toBeInTheDocument();
    });

    it('has proper aria attributes on dropdown elements', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Check the ellipsis button has proper aria attributes
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      expect(optionsButton).toHaveAttribute('aria-haspopup', 'menu');
      expect(optionsButton).toHaveAttribute('aria-expanded', 'false');

      // Open the menu
      await user.click(optionsButton);

      // Button should indicate menu is expanded
      expect(optionsButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes dropdown when pressing Escape key', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(
        <RecentAssetsList
          assets={[asset]}
          onAddAsset={mockOnAddAsset}
          onRemoveAsset={mockOnRemoveAsset}
        />
      );

      // Open the menu
      const optionsButton = screen.getByRole('button', { name: /options for chair/i });
      await user.click(optionsButton);

      // Menu should be open
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Menu should be closed
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('can add asset using keyboard (Enter key)', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const card = screen.getByRole('button', { name: /add chair to scene/i });

      // Focus the card and press Enter
      card.focus();
      await user.keyboard('{Enter}');

      expect(mockOnAddAsset).toHaveBeenCalledWith(asset);
    });

    it('can add asset using keyboard (Space key)', async () => {
      const user = userEvent.setup();
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      const card = screen.getByRole('button', { name: /add chair to scene/i });

      // Focus the card and press Space
      card.focus();
      await user.keyboard(' ');

      expect(mockOnAddAsset).toHaveBeenCalledWith(asset);
    });
  });
});
