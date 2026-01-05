/**
 * Tests for RecentAssetsList component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentAssetsList } from './RecentAssetsList';
import type { AssetMetadata, ModelMetrics } from '../types/model';

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

  function createMockMetrics(): ModelMetrics {
    return {
      boundingBox: {
        min: { x: -0.5, y: 0, z: -0.5 },
        max: { x: 0.5, y: 1, z: 0.5 },
      },
      center: { x: 0, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      bottomY: 0,
      topY: 1,
      maxDimension: 2.5,
      triangleCount: 15000,
    };
  }

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
        <RecentAssetsList
          assets={[]}
          onAddAsset={mockOnAddAsset}
          emptyMessage="Nothing here yet"
        />
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

      expect(screen.getByText('chair.obj')).toBeInTheDocument();
      expect(screen.getByText('table.glb')).toBeInTheDocument();
      expect(screen.getByText('lamp.fbx')).toBeInTheDocument();
    });

    it('shows file type badges', () => {
      const assets = [
        createMockAsset('1', { name: 'model.obj', fileType: 'obj' }),
        createMockAsset('2', { name: 'model.fbx', fileType: 'fbx' }),
        createMockAsset('3', { name: 'model.glb', fileType: 'glb' }),
        createMockAsset('4', { name: 'model.gltf', fileType: 'gltf' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      expect(screen.getByText('OBJ')).toBeInTheDocument();
      expect(screen.getByText('FBX')).toBeInTheDocument();
      expect(screen.getByText('GLB')).toBeInTheDocument();
      expect(screen.getByText('GLTF')).toBeInTheDocument();
    });

    it('shows file size', () => {
      const assets = [createMockAsset('1', { fileSize: 2.5 * 1024 * 1024 })]; // 2.5MB

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      expect(screen.getByText('2.5 MB')).toBeInTheDocument();
    });

    it('shows relative date', () => {
      const assets = [createMockAsset('1')];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // The mocked formatRelativeDate returns 'Just now' for recent dates
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Metrics Display
  // ===========================================================================

  describe('metrics display', () => {
    it('shows model metrics when available', () => {
      const assets = [createMockAsset('1', { metrics: createMockMetrics() })];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // maxDimension is 2.5
      expect(screen.getByText(/2\.5u/)).toBeInTheDocument();
    });

    it('shows triangle count for complex models', () => {
      const metrics = createMockMetrics();
      metrics.triangleCount = 50000; // 50k triangles

      const assets = [createMockAsset('1', { metrics })];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      expect(screen.getByText(/50k/)).toBeInTheDocument();
    });

    it('hides triangle count for simple models', () => {
      const metrics = createMockMetrics();
      metrics.triangleCount = 500; // Under 1k threshold

      const assets = [createMockAsset('1', { metrics })];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Should not show triangle count
      expect(screen.queryByText(/k\)/)).not.toBeInTheDocument();
    });

    it('hides metrics section when not available', () => {
      const assets = [createMockAsset('1')]; // No metrics

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Should not show dimension or triangle count
      expect(screen.queryByText(/u$/)).not.toBeInTheDocument();
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

      const buttons = screen.getAllByRole('button');
      const names = buttons.map((btn) => btn.textContent);

      // Should be ordered: newer, new, old
      expect(names[0]).toContain('newer.obj');
      expect(names[1]).toContain('new.obj');
      expect(names[2]).toContain('old.obj');
    });
  });

  // ===========================================================================
  // Click Handling
  // ===========================================================================

  describe('click handling', () => {
    it('calls onAddAsset when asset is clicked', async () => {
      const asset = createMockAsset('1', { name: 'chair.obj' });

      render(<RecentAssetsList assets={[asset]} onAddAsset={mockOnAddAsset} />);

      await userEvent.click(screen.getByText('chair.obj'));

      expect(mockOnAddAsset).toHaveBeenCalledWith(asset);
    });

    it('calls onAddAsset with correct asset in list', async () => {
      const assets = [
        createMockAsset('1', { name: 'first.obj' }),
        createMockAsset('2', { name: 'second.obj' }),
        createMockAsset('3', { name: 'third.obj' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      await userEvent.click(screen.getByText('second.obj'));

      expect(mockOnAddAsset).toHaveBeenCalledWith(assets[1]);
    });
  });

  // ===========================================================================
  // File Type Colors
  // ===========================================================================

  describe('file type colors', () => {
    it('applies correct color classes to badges', () => {
      const assets = [
        createMockAsset('1', { fileType: 'obj' }),
        createMockAsset('2', { fileType: 'fbx' }),
        createMockAsset('3', { fileType: 'glb' }),
        createMockAsset('4', { fileType: 'gltf' }),
      ];

      render(<RecentAssetsList assets={assets} onAddAsset={mockOnAddAsset} />);

      // Check that badges have appropriate color-related classes
      const objBadge = screen.getByText('OBJ');
      const fbxBadge = screen.getByText('FBX');
      const glbBadge = screen.getByText('GLB');
      const gltfBadge = screen.getByText('GLTF');

      expect(objBadge).toHaveClass('bg-blue-100');
      expect(fbxBadge).toHaveClass('bg-purple-100');
      expect(glbBadge).toHaveClass('bg-green-100');
      expect(gltfBadge).toHaveClass('bg-indigo-100');
    });
  });
});

