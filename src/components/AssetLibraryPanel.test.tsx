/**
 * Tests for AssetLibraryPanel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetLibraryPanel } from './AssetLibraryPanel';
import type { AssetMetadata } from '../types/model';

// Mock RecentAssetsList to simplify testing
vi.mock('./RecentAssetsList', () => ({
  RecentAssetsList: ({
    assets,
    onAddAsset,
    emptyMessage,
  }: {
    assets: AssetMetadata[];
    onAddAsset: (asset: AssetMetadata) => void;
    emptyMessage: string;
  }) => (
    <div data-testid="recent-assets-list">
      {assets.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        assets.map((a) => (
          <button key={a.id} type="button" onClick={() => onAddAsset(a)}>
            {a.name}
          </button>
        ))
      )}
    </div>
  ),
}));

// Mock ensureAssetThumbnail
vi.mock('../utils/assetThumbnails/ensureAssetThumbnail', () => ({
  ensureAssetThumbnail: vi.fn().mockResolvedValue(null),
}));

describe('AssetLibraryPanel', () => {
  const mockOnAddAsset = vi.fn();

  function createMockAsset(id: string, name: string): AssetMetadata {
    return {
      id,
      name,
      fileType: 'glb',
      fileSize: 1024,
      uploadDate: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('empty state', () => {
    it('shows empty message when both lists are empty', () => {
      render(
        <AssetLibraryPanel
          starterAssets={[]}
          recentAssets={[]}
          onAddAsset={mockOnAddAsset}
        />
      );

      expect(screen.getByText('No assets available')).toBeInTheDocument();
      expect(screen.getByText('Upload a 3D model to get started')).toBeInTheDocument();
    });
  });

  describe('starter assets', () => {
    it('renders starter section when starter assets exist', () => {
      const starters = [
        createMockAsset('starter:cube', 'cube.glb'),
        createMockAsset('starter:sphere', 'sphere.glb'),
      ];

      render(
        <AssetLibraryPanel
          starterAssets={starters}
          recentAssets={[]}
          onAddAsset={mockOnAddAsset}
        />
      );

      expect(screen.getByText('Starter models')).toBeInTheDocument();
      expect(screen.getByText('cube.glb')).toBeInTheDocument();
      expect(screen.getByText('sphere.glb')).toBeInTheDocument();
    });

    it('has collapsible starter section with accessible toggle', () => {
      const starters = [createMockAsset('starter:cube', 'cube.glb')];

      render(
        <AssetLibraryPanel
          starterAssets={starters}
          recentAssets={[]}
          onAddAsset={mockOnAddAsset}
        />
      );

      const toggle = screen.getByRole('button', { name: /collapse starter models/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('recent assets', () => {
    it('renders recent uploads section when recent assets exist', () => {
      const recent = [createMockAsset('asset-1', 'uploaded.glb')];

      render(
        <AssetLibraryPanel
          starterAssets={[]}
          recentAssets={recent}
          onAddAsset={mockOnAddAsset}
        />
      );

      expect(screen.getByText('Recent')).toBeInTheDocument();
      expect(screen.getByText('uploaded.glb')).toBeInTheDocument();
    });
  });

  describe('onAddAsset callback', () => {
    it('calls onAddAsset when starter asset is clicked', () => {
      const starters = [createMockAsset('starter:cube', 'cube.glb')];

      render(
        <AssetLibraryPanel
          starterAssets={starters}
          recentAssets={[]}
          onAddAsset={mockOnAddAsset}
        />
      );

      fireEvent.click(screen.getByText('cube.glb'));
      expect(mockOnAddAsset).toHaveBeenCalledWith(starters[0]);
    });
  });
});
