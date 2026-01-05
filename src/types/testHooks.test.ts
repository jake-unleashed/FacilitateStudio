/**
 * Type tests for testHooks
 * Ensures test hooks interface is correctly defined
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import type { TestHooks } from './testHooks';
import type { SceneObject } from '../types';
import type { UndoRedoCommand } from '../hooks/undoRedo/types';

describe('TestHooks Types', () => {
  it('should have correct method signatures', () => {
    const mockHooks: TestHooks = {
      getUndoStackSize: () => 0,
      getRedoStackSize: () => 0,
      getCurrentObjects: () => [],
      canUndo: false,
      canRedo: false,
      executeCommand: () => {},
      undo: () => {},
      redo: () => {},
      moveObject: () =>
        ({
          type: 'updateObject',
          timestamp: Date.now(),
          objectId: 'test',
          previousState: {} as SceneObject,
          newState: {} as SceneObject,
        }) as UndoRedoCommand,
      testMove: () =>
        ({
          type: 'updateObject',
          timestamp: Date.now(),
          objectId: 'test',
          previousState: {} as SceneObject,
          newState: {} as SceneObject,
        }) as UndoRedoCommand,
    };

    expect(mockHooks.getUndoStackSize).toBeInstanceOf(Function);
    expect(mockHooks.getRedoStackSize).toBeInstanceOf(Function);
    expect(mockHooks.getCurrentObjects).toBeInstanceOf(Function);
    expect(typeof mockHooks.canUndo).toBe('boolean');
    expect(typeof mockHooks.canRedo).toBe('boolean');
  });

  it('should properly type getUndoStackSize', () => {
    const mockHooks: TestHooks = {} as TestHooks;
    expectTypeOf(mockHooks.getUndoStackSize).toBeFunction();
    expectTypeOf(mockHooks.getUndoStackSize).returns.toBeNumber();
  });

  it('should properly type getCurrentObjects', () => {
    const mockHooks: TestHooks = {} as TestHooks;
    expectTypeOf(mockHooks.getCurrentObjects).toBeFunction();
    expectTypeOf(mockHooks.getCurrentObjects).returns.toMatchTypeOf<SceneObject[]>();
  });

  it('should properly type moveObject', () => {
    const mockHooks: TestHooks = {} as TestHooks;
    expectTypeOf(mockHooks.moveObject).toBeFunction();
    expectTypeOf(mockHooks.moveObject).parameters.toMatchTypeOf<
      [string, number, number, string?]
    >();
    expectTypeOf(mockHooks.moveObject).returns.toMatchTypeOf<UndoRedoCommand>();
  });

  it('should properly type testMove', () => {
    const mockHooks: TestHooks = {} as TestHooks;
    expectTypeOf(mockHooks.testMove).toBeFunction();
    expectTypeOf(mockHooks.testMove).parameters.toMatchTypeOf<[string, number, number]>();
    expectTypeOf(mockHooks.testMove).returns.toMatchTypeOf<UndoRedoCommand>();
  });

  it('should properly type undo/redo', () => {
    const mockHooks: TestHooks = {} as TestHooks;
    expectTypeOf(mockHooks.undo).toBeFunction();
    expectTypeOf(mockHooks.undo).returns.toBeVoid();
    expectTypeOf(mockHooks.redo).toBeFunction();
    expectTypeOf(mockHooks.redo).returns.toBeVoid();
  });

  it('should properly type executeCommand', () => {
    const mockHooks: TestHooks = {} as TestHooks;
    expectTypeOf(mockHooks.executeCommand).toBeFunction();
    expectTypeOf(mockHooks.executeCommand).parameters.toMatchTypeOf<[UndoRedoCommand]>();
    expectTypeOf(mockHooks.executeCommand).returns.toBeVoid();
  });
});

describe('Window TestHooks Integration', () => {
  it('should allow optional testHooks on window', () => {
    const testWindow = window as Window;
    expectTypeOf(testWindow.__testHooks).toMatchTypeOf<TestHooks | undefined>();
  });

  it('should allow optional programmaticTest on window', () => {
    const testWindow = window as Window;
    expectTypeOf(testWindow.programmaticTest).toMatchTypeOf<
      | {
          multiMove: (numMoves?: number) => Promise<unknown>;
          rapidMove: (numMoves?: number) => Promise<unknown>;
          verifyUndoRedo: () => Promise<unknown>;
          complexScenario: () => Promise<unknown>;
          fullSuite: () => Promise<{ results: unknown; allPassed: boolean }>;
          quick5: () => Promise<unknown>;
          quick10: () => Promise<unknown>;
          quick20: () => Promise<unknown>;
          quick50: () => Promise<unknown>;
        }
      | undefined
    >();
  });
});





















