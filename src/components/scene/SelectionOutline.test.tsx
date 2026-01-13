/**
 * Unit tests for SelectionOutline component
 *
 * Tests the selection outline system that provides visual feedback for
 * selected objects in the 3D scene using post-processing effects.
 *
 * Key features tested:
 * - Parent selection with blue outline
 * - Child selection with emerald/green outline
 * - xRay mode enabled for consistent visibility
 * - Hidden and visible edge colors match for uniform appearance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import * as THREE from 'three';
import React from 'react';

// Mock @react-three/postprocessing
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="effect-composer">{children}</div>
  ),
  Outline: (props: Record<string, unknown>) => (
    <div
      data-testid="outline"
      data-xray={String(props.xRay)}
      data-visible-edge-color={String(props.visibleEdgeColor)}
      data-hidden-edge-color={String(props.hiddenEdgeColor)}
      data-edge-strength={String(props.edgeStrength)}
      data-blur={String(props.blur)}
    />
  ),
  Selection: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="selection">{children}</div>
  ),
  Select: ({ children, enabled }: { children: React.ReactNode; enabled: boolean }) => (
    <div data-testid="select" data-enabled={String(enabled)}>
      {children}
    </div>
  ),
}));

// Mock postprocessing
vi.mock('postprocessing', () => ({
  BlendFunction: {
    SCREEN: 'SCREEN',
  },
}));

// Import after mocks are set up
import {
  ChildSelectionProvider,
  useChildSelection,
  SelectChildObject,
  ChildOutlineEffect,
  SelectionOutlineEffect,
  SelectionProvider,
  Select,
  SelectObject,
} from './SelectionOutline';

describe('SelectionOutline', () => {
  // ==========================================================================
  // Test Setup
  // ==========================================================================

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Constant Tests
  // ==========================================================================

  describe('Outline Color Constants', () => {
    it('should use blue color for parent selection (0x3b82f6 = Tailwind blue-500)', () => {
      // Render SelectionOutlineEffect and check the color
      const TestComponent = () => {
        return (
          <ChildSelectionProvider>
            <SelectionOutlineEffect />
          </ChildSelectionProvider>
        );
      };

      const { container } = render(<TestComponent />);
      const outline = container.querySelector('[data-testid="outline"]');

      // 0x3b82f6 = 3899126 in decimal
      expect(outline?.getAttribute('data-visible-edge-color')).toBe('3899126');
      expect(outline?.getAttribute('data-hidden-edge-color')).toBe('3899126');
    });

    it('should use emerald color for child selection (0x10b981 = Tailwind emerald-500)', () => {
      // Create a mock mesh to trigger child selection
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const TestComponent = () => {
        const ctx = useChildSelection();
        React.useEffect(() => {
          if (ctx) {
            ctx.setSelectedChildren([mockMesh]);
          }
        }, [ctx]);
        return <ChildOutlineEffect />;
      };

      const { container } = render(
        <ChildSelectionProvider>
          <TestComponent />
        </ChildSelectionProvider>
      );

      const outline = container.querySelector('[data-testid="outline"]');

      // 0x10b981 = 1096065 in decimal
      expect(outline?.getAttribute('data-visible-edge-color')).toBe('1096065');
      expect(outline?.getAttribute('data-hidden-edge-color')).toBe('1096065');
    });

    it('should have matching visible and hidden edge colors for consistent appearance', () => {
      const TestComponent = () => {
        return (
          <ChildSelectionProvider>
            <SelectionOutlineEffect />
          </ChildSelectionProvider>
        );
      };

      const { container } = render(<TestComponent />);
      const outline = container.querySelector('[data-testid="outline"]');

      const visibleColor = outline?.getAttribute('data-visible-edge-color');
      const hiddenColor = outline?.getAttribute('data-hidden-edge-color');

      expect(visibleColor).toBe(hiddenColor);
    });
  });

  // ==========================================================================
  // xRay Mode Tests
  // ==========================================================================

  describe('xRay Mode', () => {
    it('should have xRay enabled on parent selection outline', () => {
      const TestComponent = () => {
        return (
          <ChildSelectionProvider>
            <SelectionOutlineEffect />
          </ChildSelectionProvider>
        );
      };

      const { container } = render(<TestComponent />);
      const outline = container.querySelector('[data-testid="outline"]');

      expect(outline?.getAttribute('data-xray')).toBe('true');
    });

    it('should have xRay enabled on child selection outline', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const TestComponent = () => {
        const ctx = useChildSelection();
        React.useEffect(() => {
          if (ctx) {
            ctx.setSelectedChildren([mockMesh]);
          }
        }, [ctx]);
        return <ChildOutlineEffect />;
      };

      const { container } = render(
        <ChildSelectionProvider>
          <TestComponent />
        </ChildSelectionProvider>
      );

      const outline = container.querySelector('[data-testid="outline"]');
      expect(outline?.getAttribute('data-xray')).toBe('true');
    });
  });

  // ==========================================================================
  // ChildSelectionProvider Tests
  // ==========================================================================

  describe('ChildSelectionProvider', () => {
    it('should provide child selection context to descendants', () => {
      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      render(
        <ChildSelectionProvider>
          <TestConsumer />
        </ChildSelectionProvider>
      );

      expect(contextValue!).not.toBeNull();
      expect(contextValue!.selectedChildren).toEqual([]);
      expect(typeof contextValue!.setSelectedChildren).toBe('function');
    });

    it('should return null when used outside provider', () => {
      const { result } = renderHook(() => useChildSelection());
      expect(result.current).toBeNull();
    });

    it('should update selectedChildren when setSelectedChildren is called', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      render(
        <ChildSelectionProvider>
          <TestConsumer />
        </ChildSelectionProvider>
      );

      // Initial state
      expect(contextValue!.selectedChildren).toEqual([]);

      // Update selection
      act(() => {
        contextValue!.setSelectedChildren([mockMesh]);
      });

      expect(contextValue!.selectedChildren).toContain(mockMesh);
    });
  });

  // ==========================================================================
  // SelectChildObject Tests
  // ==========================================================================

  describe('SelectChildObject', () => {
    it('should add meshes to child selection when enabled', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      const mockGroup = new THREE.Group();
      mockGroup.add(mockMesh);

      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      render(
        <ChildSelectionProvider>
          <SelectChildObject object={mockGroup} enabled={true} />
          <TestConsumer />
        </ChildSelectionProvider>
      );

      expect(contextValue!.selectedChildren).toContain(mockMesh);
    });

    it('should not add meshes when disabled', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      const mockGroup = new THREE.Group();
      mockGroup.add(mockMesh);

      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      render(
        <ChildSelectionProvider>
          <SelectChildObject object={mockGroup} enabled={false} />
          <TestConsumer />
        </ChildSelectionProvider>
      );

      expect(contextValue!.selectedChildren).not.toContain(mockMesh);
    });

    it('should remove meshes when disabled after being enabled', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      const mockGroup = new THREE.Group();
      mockGroup.add(mockMesh);

      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      const { rerender } = render(
        <ChildSelectionProvider>
          <SelectChildObject object={mockGroup} enabled={true} />
          <TestConsumer />
        </ChildSelectionProvider>
      );

      expect(contextValue!.selectedChildren).toContain(mockMesh);

      rerender(
        <ChildSelectionProvider>
          <SelectChildObject object={mockGroup} enabled={false} />
          <TestConsumer />
        </ChildSelectionProvider>
      );

      expect(contextValue!.selectedChildren).not.toContain(mockMesh);
    });

    it('should handle null object gracefully', () => {
      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      render(
        <ChildSelectionProvider>
          <SelectChildObject object={null} enabled={true} />
          <TestConsumer />
        </ChildSelectionProvider>
      );

      expect(contextValue!.selectedChildren).toEqual([]);
    });

    it('should render nothing (returns null)', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const { container } = render(
        <ChildSelectionProvider>
          <SelectChildObject object={mockMesh} enabled={true} />
        </ChildSelectionProvider>
      );

      // Should only have the provider wrapper, nothing from SelectChildObject
      expect(container.textContent).toBe('');
    });
  });

  // ==========================================================================
  // ChildOutlineEffect Tests
  // ==========================================================================

  describe('ChildOutlineEffect', () => {
    it('should not render when no children are selected', () => {
      const { container } = render(
        <ChildSelectionProvider>
          <ChildOutlineEffect />
        </ChildSelectionProvider>
      );

      expect(container.querySelector('[data-testid="effect-composer"]')).toBeNull();
    });

    it('should render when children are selected', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const TestComponent = () => {
        const ctx = useChildSelection();
        React.useEffect(() => {
          if (ctx) {
            ctx.setSelectedChildren([mockMesh]);
          }
        }, [ctx]);
        return <ChildOutlineEffect />;
      };

      const { container } = render(
        <ChildSelectionProvider>
          <TestComponent />
        </ChildSelectionProvider>
      );

      expect(container.querySelector('[data-testid="effect-composer"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="outline"]')).not.toBeNull();
    });

    it('should use correct edge strength', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const TestComponent = () => {
        const ctx = useChildSelection();
        React.useEffect(() => {
          if (ctx) {
            ctx.setSelectedChildren([mockMesh]);
          }
        }, [ctx]);
        return <ChildOutlineEffect />;
      };

      const { container } = render(
        <ChildSelectionProvider>
          <TestComponent />
        </ChildSelectionProvider>
      );

      const outline = container.querySelector('[data-testid="outline"]');
      expect(outline?.getAttribute('data-edge-strength')).toBe('5');
    });
  });

  // ==========================================================================
  // SelectionOutlineEffect Tests
  // ==========================================================================

  describe('SelectionOutlineEffect', () => {
    it('should render when no child is selected', () => {
      const { container } = render(
        <ChildSelectionProvider>
          <SelectionOutlineEffect />
        </ChildSelectionProvider>
      );

      expect(container.querySelector('[data-testid="effect-composer"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="outline"]')).not.toBeNull();
    });

    it('should not render when a child is selected', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const TestComponent = () => {
        const ctx = useChildSelection();
        React.useEffect(() => {
          if (ctx) {
            ctx.setSelectedChildren([mockMesh]);
          }
        }, [ctx]);
        return <SelectionOutlineEffect />;
      };

      const { container } = render(
        <ChildSelectionProvider>
          <TestComponent />
        </ChildSelectionProvider>
      );

      expect(container.querySelector('[data-testid="effect-composer"]')).toBeNull();
    });

    it('should have blur enabled', () => {
      const { container } = render(
        <ChildSelectionProvider>
          <SelectionOutlineEffect />
        </ChildSelectionProvider>
      );

      const outline = container.querySelector('[data-testid="outline"]');
      expect(outline?.getAttribute('data-blur')).toBe('true');
    });
  });

  // ==========================================================================
  // SelectionProvider Tests
  // ==========================================================================

  describe('SelectionProvider', () => {
    it('should wrap children with both Selection and ChildSelectionProvider', () => {
      const { container } = render(
        <SelectionProvider>
          <div data-testid="test-child">Test</div>
        </SelectionProvider>
      );

      expect(container.querySelector('[data-testid="selection"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="test-child"]')).not.toBeNull();
    });

    it('should make child selection context available to children', () => {
      let contextValue: ReturnType<typeof useChildSelection>;

      const TestConsumer = () => {
        contextValue = useChildSelection();
        return null;
      };

      render(
        <SelectionProvider>
          <TestConsumer />
        </SelectionProvider>
      );

      expect(contextValue!).not.toBeNull();
    });
  });

  // ==========================================================================
  // Re-export Tests
  // ==========================================================================

  describe('Re-exports', () => {
    it('should export Select component', () => {
      expect(Select).toBeDefined();
    });

    it('should export SelectObject as alias for SelectChildObject', () => {
      expect(SelectObject).toBe(SelectChildObject);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should switch from parent to child outline when child is selected', () => {
      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );

      const TestComponent = ({ selectChild }: { selectChild: boolean }) => {
        const ctx = useChildSelection();
        React.useEffect(() => {
          if (ctx && selectChild) {
            ctx.setSelectedChildren([mockMesh]);
          } else if (ctx) {
            ctx.setSelectedChildren([]);
          }
        }, [ctx, selectChild]);
        return (
          <>
            <SelectionOutlineEffect />
            <ChildOutlineEffect />
          </>
        );
      };

      // Initially, parent outline should render
      const { container, rerender } = render(
        <ChildSelectionProvider>
          <TestComponent selectChild={false} />
        </ChildSelectionProvider>
      );

      let outlines = container.querySelectorAll('[data-testid="outline"]');
      expect(outlines.length).toBe(1);
      // Parent uses blue (3899126)
      expect(outlines[0].getAttribute('data-visible-edge-color')).toBe('3899126');

      // Select a child - should switch to child outline
      rerender(
        <ChildSelectionProvider>
          <TestComponent selectChild={true} />
        </ChildSelectionProvider>
      );

      outlines = container.querySelectorAll('[data-testid="outline"]');
      expect(outlines.length).toBe(1);
      // Child uses emerald (1096065)
      expect(outlines[0].getAttribute('data-visible-edge-color')).toBe('1096065');
    });
  });
});
