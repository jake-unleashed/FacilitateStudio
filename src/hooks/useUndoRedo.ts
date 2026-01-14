import { useState, useCallback, useRef, useEffect } from 'react';
import {
  EditorState,
  UndoRedoCommand,
  UndoRedoOptions,
  UpdateObjectCommand,
} from './undoRedo/types';
import { executeCommand, undoCommand, createBatchCommand } from './undoRedo/commandImplementations';

const DEFAULT_MAX_HISTORY = 50;

/**
 * Hook for managing undo/redo functionality.
 *
 * @param initialState - The initial editor state
 * @param options - Configuration options
 * @returns Object with undo/redo functions and state
 */
export function useUndoRedo(initialState: EditorState, options: UndoRedoOptions = {}) {
  const { maxHistory = DEFAULT_MAX_HISTORY, enableKeyboardShortcuts = true } = options;

  // Current editor state
  const [currentState, setCurrentState] = useState<EditorState>(initialState);
  // Ref to track current state for use in callbacks (avoids stale closures)
  const currentStateRef = useRef<EditorState>(initialState);

  // History stacks
  const [undoStack, setUndoStack] = useState<UndoRedoCommand[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoCommand[]>([]);

  // Batching state - uses depth counter to support nested begin/endBatch calls
  const batchCommandsRef = useRef<UndoRedoCommand[]>([]);
  const batchDepthRef = useRef(0); // 0 = not batching, >0 = batching depth
  const batchInitialStateRef = useRef<EditorState | null>(null);

  // Update current state when initialState changes (e.g., project loaded)
  useEffect(() => {
    setCurrentState(initialState);
    currentStateRef.current = initialState;
    // Clear history when state is reset externally
    setUndoStack([]);
    setRedoStack([]);
    batchCommandsRef.current = [];
    batchDepthRef.current = 0;
    batchInitialStateRef.current = null;
  }, [initialState]);

  // Keep ref in sync with state
  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  /**
   * Executes a command and adds it to the undo stack.
   */
  const execute = useCallback(
    (command: UndoRedoCommand) => {
      // Use ref to get latest state (avoids stale closures during batching)
      const state = currentStateRef.current;
      const result = executeCommand(command, state);
      if (!result.success) {
        console.error('[useUndoRedo] Command execution failed:', result.error);
        return false;
      }

      // Update ref immediately
      currentStateRef.current = result.newState;

      // If we're batching (depth > 0), add to batch instead of executing immediately
      if (batchDepthRef.current > 0) {
        batchCommandsRef.current.push(command);
        // Update state immediately for real-time feedback
        setCurrentState(result.newState);
        return true;
      }

      // Execute the command
      setCurrentState(result.newState);

      // Add to undo stack
      setUndoStack((prev) => {
        const newStack = [command, ...prev];
        // Limit history size
        return newStack.slice(0, maxHistory);
      });

      // Clear redo stack when a new operation is performed
      setRedoStack([]);

      return true;
    },
    [maxHistory]
  );

  /**
   * Undoes the most recent command.
   */
  const undo = useCallback(() => {
    if (undoStack.length === 0) {
      return false;
    }

    const command = undoStack[0];
    const state = currentStateRef.current;
    const result = undoCommand(command, state);

    if (!result.success) {
      console.error('[useUndoRedo] Undo failed:', result.error);
      return false;
    }

    currentStateRef.current = result.newState;
    setCurrentState(result.newState);
    setUndoStack((prev) => prev.slice(1));
    setRedoStack((prev) => [command, ...prev]);

    return true;
  }, [undoStack]);

  /**
   * Redoes the most recent undone command.
   */
  const redo = useCallback(() => {
    if (redoStack.length === 0) {
      return false;
    }

    const command = redoStack[0];
    const state = currentStateRef.current;
    const result = executeCommand(command, state);

    if (!result.success) {
      console.error('[useUndoRedo] Redo failed:', result.error);
      return false;
    }

    currentStateRef.current = result.newState;
    setCurrentState(result.newState);
    setRedoStack((prev) => prev.slice(1));
    setUndoStack((prev) => [command, ...prev]);

    return true;
  }, [redoStack]);

  /**
   * Begins a batch operation. All commands executed until endBatch() is called
   * will be grouped into a single undo entry.
   *
   * Supports nested batches: multiple beginBatch calls will increment depth,
   * and the batch is only committed when depth returns to 0.
   */
  const beginBatch = useCallback(() => {
    batchDepthRef.current += 1;

    // Only initialize batch state on first (outermost) begin
    if (batchDepthRef.current === 1) {
      batchCommandsRef.current = [];
      // Store the initial state when batch starts
      batchInitialStateRef.current = currentStateRef.current;
    }
  }, []);

  /**
   * Ends a batch operation and commits all batched commands as a single undo entry.
   * Optimizes multiple updates to the same object into a single command.
   *
   * Supports nested batches: decrements depth and only commits when depth reaches 0.
   */
  const endBatch = useCallback(() => {
    if (batchDepthRef.current <= 0) {
      // Silently return if no batch is in progress (duplicate endBatch calls)
      return;
    }

    batchDepthRef.current -= 1;

    // Only commit when we return to depth 0 (outermost endBatch)
    if (batchDepthRef.current > 0) {
      return;
    }

    const commands = batchCommandsRef.current;
    const batchInitialState = batchInitialStateRef.current;
    batchCommandsRef.current = [];
    batchInitialStateRef.current = null;

    // If no commands were batched, do nothing
    if (commands.length === 0 || !batchInitialState) {
      return;
    }

    // Get the final state (which is the current state since we updated during batching)
    const finalState = currentStateRef.current;

    // Optimize: Collapse multiple UpdateObjectCommand instances for the same object
    // into a single command that goes from initial state to final state
    const optimizedCommands: UndoRedoCommand[] = [];
    const objectUpdates = new Map<
      string,
      { firstCommand: UpdateObjectCommand; lastCommand: UpdateObjectCommand }
    >();

    // Group UpdateObjectCommand instances by object ID
    // UpdateStepCommand instances are added as-is (not optimized)
    for (const command of commands) {
      if (command.type === 'updateObject') {
        const updateCmd = command as UpdateObjectCommand;
        const existing = objectUpdates.get(updateCmd.objectId);
        if (existing) {
          // Update to track the last command for this object
          existing.lastCommand = updateCmd;
        } else {
          // First update for this object
          objectUpdates.set(updateCmd.objectId, {
            firstCommand: updateCmd,
            lastCommand: updateCmd,
          });
        }
      } else {
        // Non-update commands (including UpdateStepCommand) are added as-is
        optimizedCommands.push(command);
      }
    }

    // Create optimized commands - one per object, from initial to final state
    for (const { firstCommand } of objectUpdates.values()) {
      const objectId = firstCommand.objectId;

      // Get the initial state from batchInitialState (the state when batch started)
      const initialObject = batchInitialState.objects.find((obj) => obj.id === objectId);
      if (!initialObject) {
        // Object didn't exist when batch started? This shouldn't happen, but skip it
        continue;
      }

      // Get the actual final state of the object from the current state
      const finalObject = finalState.objects.find((obj) => obj.id === objectId);
      if (!finalObject) {
        // Object was deleted during batch? Skip it
        continue;
      }

      // Check if the object actually changed (ignore if no change)
      if (JSON.stringify(initialObject) === JSON.stringify(finalObject)) {
        // No actual change - skip this command
        continue;
      }

      // Create a single optimized command from initial to final state
      const optimizedCommand: UpdateObjectCommand = {
        type: 'updateObject',
        timestamp: firstCommand.timestamp, // Use first command's timestamp
        description: firstCommand.description || `Update object`,
        objectId,
        previousState: initialObject, // Use initial state from when batch started
        newState: finalObject, // Use actual final state
      };
      optimizedCommands.push(optimizedCommand);
    }

    // If only one command after optimization, add it to undo stack directly
    // (state is already updated during batching, so we don't need to execute again)
    if (optimizedCommands.length === 0) {
      return;
    }

    if (optimizedCommands.length === 1) {
      // State is already updated (we updated it during batching for visual feedback)
      // Just add the optimized command to the undo stack
      const command = optimizedCommands[0];
      setUndoStack((prev) => {
        const newStack = [command, ...prev];
        return newStack.slice(0, maxHistory);
      });
      setRedoStack([]);
      return;
    }

    // Multiple commands - create a batch command and add to undo stack
    // (state is already updated, so we don't need to execute)
    const batchCommand = createBatchCommand(optimizedCommands, 'Batch operation');
    setUndoStack((prev) => {
      const newStack = [batchCommand, ...prev];
      return newStack.slice(0, maxHistory);
    });
    setRedoStack([]);
  }, [maxHistory]);

  /**
   * Cancels the current batch operation without committing.
   * Resets batch depth to 0 regardless of nesting level.
   */
  const cancelBatch = useCallback(() => {
    if (batchDepthRef.current <= 0) {
      return;
    }

    // Revert to state before batch started
    // We need to undo all commands in the batch
    let state = currentState;
    for (let i = batchCommandsRef.current.length - 1; i >= 0; i--) {
      const result = undoCommand(batchCommandsRef.current[i], state);
      if (result.success) {
        state = result.newState;
      }
    }

    setCurrentState(state);
    batchDepthRef.current = 0;
    batchCommandsRef.current = [];
    batchInitialStateRef.current = null;
  }, [currentState]);

  /**
   * Clears all undo/redo history.
   */
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    batchCommandsRef.current = [];
    batchDepthRef.current = 0;
    batchInitialStateRef.current = null;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableKeyboardShortcuts, undo, redo]);

  return {
    // Current state
    currentState,
    setCurrentState,

    // Undo/Redo functions
    execute,
    undo,
    redo,

    // Batching functions
    beginBatch,
    endBatch,
    cancelBatch,

    // History management
    clearHistory,

    // State queries
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    isBatching: batchDepthRef.current > 0,
    batchDepth: batchDepthRef.current,

    // Stack sizes (for testing)
    undoStackSize: undoStack.length,
    redoStackSize: redoStack.length,
  };
}
