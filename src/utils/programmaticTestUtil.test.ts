/**
 * Unit tests for programmaticTestUtil
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { TestHooks } from '../types/testHooks';
import type { SceneObject } from '../types';

describe('programmaticTestUtil', () => {
  let mockTestHooks: TestHooks;
  let mockObjects: SceneObject[];
  let undoStackSize: number;

  beforeEach(async () => {
    // Reset state
    undoStackSize = 0;

    // Setup mock objects
    mockObjects = [
      {
        id: 'test-cube-1',
        name: 'Test Cube',
        type: 'mesh',
        transform: {
          x: 0,
          y: 50,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: {
          visible: true,
          color: '#3b82f6',
        },
      },
    ];

    // Setup mock test hooks
    mockTestHooks = {
      getUndoStackSize: vi.fn(() => undoStackSize),
      getRedoStackSize: vi.fn(() => 0),
      getCurrentObjects: vi.fn(() => mockObjects),
      canUndo: true,
      canRedo: false,
      executeCommand: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      moveObject: vi.fn((objectId: string, x: number, z: number) => {
        const obj = mockObjects.find((o) => o.id === objectId);
        if (obj) {
          obj.transform.x = x;
          obj.transform.z = z;
        }
        undoStackSize++;
        return {
          type: 'updateObject',
          timestamp: Date.now(),
          objectId,
          previousState: mockObjects[0],
          newState: { ...mockObjects[0], transform: { ...mockObjects[0].transform, x, z } },
        };
      }),
      testMove: vi.fn((objectId: string, deltaX: number, deltaZ: number) => {
        const obj = mockObjects.find((o) => o.id === objectId);
        if (obj) {
          obj.transform.x += deltaX;
          obj.transform.z += deltaZ;
        }
        undoStackSize++;
        return {
          type: 'updateObject',
          timestamp: Date.now(),
          objectId,
          previousState: mockObjects[0],
          newState: mockObjects[0],
        };
      }),
    };

    // Mount mock to window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__testHooks = mockTestHooks;

    // Import the module to register window.programmaticTest
    await import('./programmaticTestUtil');
  });

  afterEach(() => {
    // Only clear test hooks, keep programmaticTest for integration tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__testHooks;
    vi.clearAllMocks();
  });

  describe('Test Environment Validation', () => {
    it('should access test hooks from window', () => {
      expect(window.__testHooks).toBeDefined();
      expect(window.__testHooks).toBe(mockTestHooks);
    });

    it('should have objects in scene', () => {
      expect(mockTestHooks.getCurrentObjects()).toHaveLength(1);
      expect(mockTestHooks.getCurrentObjects()[0].id).toBe('test-cube-1');
    });
  });

  describe('multiMoveTest', () => {
    it('should track all moves correctly', async () => {
      const { multiMoveTest } = await import('./programmaticTestUtil');

      const result = await multiMoveTest(5);

      expect(result.success).toBe(true);
      expect(result.details.movesExecuted).toBe(5);
      expect(result.details.stackIncrease).toBe(5);
      expect(mockTestHooks.testMove).toHaveBeenCalledTimes(5);
    });

    it('should handle missing test hooks gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__testHooks;
      const { multiMoveTest } = await import('./programmaticTestUtil');

      const result = await multiMoveTest(5);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Test hooks not available');
    });

    it('should handle no objects in scene', async () => {
      mockObjects.length = 0;
      const { multiMoveTest } = await import('./programmaticTestUtil');

      const result = await multiMoveTest(5);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No objects in scene');
    });
  });

  describe('rapidMoveTest', () => {
    it('should perform rapid moves with minimal delay', async () => {
      const { rapidMoveTest } = await import('./programmaticTestUtil');

      const result = await rapidMoveTest(10);

      expect(result.success).toBe(true);
      expect(result.details.movesExecuted).toBe(10);
      expect(result.details.stackIncrease).toBe(10);
      expect(mockTestHooks.testMove).toHaveBeenCalledTimes(10);
    });
  });

  describe('Test Suite Integration', () => {
    it('should expose programmaticTest API to window', () => {
      expect(window.programmaticTest).toBeDefined();
      expect(window.programmaticTest?.multiMove).toBeInstanceOf(Function);
      expect(window.programmaticTest?.rapidMove).toBeInstanceOf(Function);
      expect(window.programmaticTest?.verifyUndoRedo).toBeInstanceOf(Function);
      expect(window.programmaticTest?.complexScenario).toBeInstanceOf(Function);
      expect(window.programmaticTest?.fullSuite).toBeInstanceOf(Function);
    });

    it('should provide quick test shortcuts', () => {
      expect(window.programmaticTest?.quick5).toBeInstanceOf(Function);
      expect(window.programmaticTest?.quick10).toBeInstanceOf(Function);
      expect(window.programmaticTest?.quick20).toBeInstanceOf(Function);
      expect(window.programmaticTest?.quick50).toBeInstanceOf(Function);
    });
  });
});
