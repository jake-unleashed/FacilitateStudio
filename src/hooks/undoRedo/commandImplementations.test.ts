import { describe, it, expect } from 'vitest';
import { executeCommand, undoCommand } from './commandImplementations';
import type { CreateStepCommand, EditorState } from './types';
import type { SimStep } from '../../types';

function step(id: string, title: string): SimStep {
  return { id, title, description: '', completed: false, type: null };
}

function state(steps: SimStep[] = []): EditorState {
  return { objects: [], steps, simulationTitle: 'Test' };
}

describe('undoRedo createStep indexing', () => {
  it('appends when createStep index is beyond length', () => {
    const initial = state([step('s1', 'One')]);
    const command: CreateStepCommand = {
      type: 'createStep',
      timestamp: 1,
      createdStep: step('s2', 'Two'),
      index: Number.MAX_SAFE_INTEGER,
    };

    const result = executeCommand(command, initial);
    expect(result.success).toBe(true);
    expect(result.newState.steps.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('preserves order when repeatedly appending with a large index', () => {
    let s = state();

    const commands: CreateStepCommand[] = [
      { type: 'createStep', timestamp: 1, createdStep: step('a', 'A'), index: Number.MAX_SAFE_INTEGER },
      { type: 'createStep', timestamp: 2, createdStep: step('b', 'B'), index: Number.MAX_SAFE_INTEGER },
      { type: 'createStep', timestamp: 3, createdStep: step('c', 'C'), index: Number.MAX_SAFE_INTEGER },
    ];

    for (const cmd of commands) {
      const result = executeCommand(cmd, s);
      expect(result.success).toBe(true);
      s = result.newState;
    }

    expect(s.steps.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('undo removes the created step by id', () => {
    const initial = state([step('s1', 'One')]);
    const command: CreateStepCommand = {
      type: 'createStep',
      timestamp: 1,
      createdStep: step('s2', 'Two'),
      index: Number.MAX_SAFE_INTEGER,
    };

    const afterCreate = executeCommand(command, initial);
    expect(afterCreate.success).toBe(true);

    const afterUndo = undoCommand(command, afterCreate.newState);
    expect(afterUndo.success).toBe(true);
    expect(afterUndo.newState.steps.map((s) => s.id)).toEqual(['s1']);
  });
});

