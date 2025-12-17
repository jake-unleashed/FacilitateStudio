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

  // Batching state
  const batchCommandsRef = useRef<UndoRedoCommand[]>([]);
  const isBatchingRef = useRef(false);
  const batchInitialStateRef = useRef<EditorState | null>(null);

  // Update current state when initialState changes (e.g., project loaded)
  useEffect(() => {
    setCurrentState(initialState);
    currentStateRef.current = initialState;
    // Clear history when state is reset externally
    setUndoStack([]);
    setRedoStack([]);
    batchCommandsRef.current = [];
    isBatchingRef.current = false;
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
      console.log(
        '[CMD] Execute:',
        command.type,
        isBatchingRef.current ? '(batched)' : '(immediate)'
      );

      // Use ref to get latest state (avoids stale closures during batching)
      const state = currentStateRef.current;
      const result = executeCommand(command, state);
      if (!result.success) {
        console.error('[useUndoRedo] Command execution failed:', result.error);
        return false;
      }

      // Update ref immediately
      currentStateRef.current = result.newState;

      // If we're batching, add to batch instead of executing immediately
      if (isBatchingRef.current) {
        console.log('[CMD] Added to batch. Batch size now:', batchCommandsRef.current.length + 1);
        batchCommandsRef.current.push(command);
        // Update state immediately for real-time feedback
        setCurrentState(result.newState);
        return true;
      }

      // Execute the command
      console.log(
        '[CMD] Adding to undo stack immediately (not batching). Stack size will be:',
        undoStack.length + 1
      );
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
    [maxHistory, undoStack.length]
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
   * Safety: If a batch is already in progress (stale batch from a missed endBatch call),
   * we force-close it and discard the orphaned commands to prevent corruption.
   */
  const beginBatch = useCallback(() => {
    console.log('[BATCH] BEGIN - Stack size:', undoStack.length);
    if (isBatchingRef.current) {
      // Force-end the stale batch before starting a new one
      // This can happen if endBatch was missed due to race conditions (e.g., quick drag-release)
      console.warn('[BATCH] Force-ending stale batch before starting new one');
      console.log('[BATCH] Stale batch had', batchCommandsRef.current.length, 'commands');
      // Discard the stale batch commands (they're orphaned and would cause incorrect undo entries)
      batchCommandsRef.current = [];
      batchInitialStateRef.current = null;
    }
    isBatchingRef.current = true;
    batchCommandsRef.current = [];
    // Store the initial state when batch starts
    batchInitialStateRef.current = currentStateRef.current;
  }, [undoStack.length]);

  /**
   * Ends a batch operation and commits all batched commands as a single undo entry.
   * Optimizes multiple updates to the same object into a single command.
   */
  const endBatch = useCallback(() => {
    if (!isBatchingRef.current) {
      // Silently return if no batch is in progress (duplicate endBatch calls)
      console.log('[BATCH] END called but no batch in progress (duplicate call)');
      return;
    }

    const commands = batchCommandsRef.current;
    const batchInitialState = batchInitialStateRef.current;
    console.log('[BATCH] END - Commands received:', commands.length);
    isBatchingRef.current = false;
    batchCommandsRef.current = [];
    batchInitialStateRef.current = null;

    // If no commands were batched, do nothing
    if (commands.length === 0 || !batchInitialState) {
      console.log('[BATCH] END - No commands or no initial state, returning');
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
        // Non-update commands are added as-is
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
      console.log(`[BATCH] Optimized command for object ${objectId}:`, {
        previousPos: `(${initialObject.transform.x.toFixed(1)}, ${initialObject.transform.z.toFixed(1)})`,
        newPos: `(${finalObject.transform.x.toFixed(1)}, ${finalObject.transform.z.toFixed(1)})`,
      });
      optimizedCommands.push(optimizedCommand);
    }

    console.log('[BATCH] Optimized to:', optimizedCommands.length, 'commands');

    // If only one command after optimization, add it to undo stack directly
    // (state is already updated during batching, so we don't need to execute again)
    if (optimizedCommands.length === 0) {
      console.log('[BATCH] No optimized commands after filtering');
      return;
    }

    if (optimizedCommands.length === 1) {
      // State is already updated (we updated it during batching for visual feedback)
      // Just add the optimized command to the undo stack
      const command = optimizedCommands[0];
      console.log('[BATCH] Adding single optimized command to undo stack');
      console.log('[BATCH] Final stack size will be:', undoStack.length + 1);
      setUndoStack((prev) => {
        const newStack = [command, ...prev];
        return newStack.slice(0, maxHistory);
      });
      setRedoStack([]);
      return;
    }

    // Multiple commands - create a batch command and add to undo stack
    // (state is already updated, so we don't need to execute)
    console.log('[BATCH] Creating batch command with', optimizedCommands.length, 'commands');
    const batchCommand = createBatchCommand(optimizedCommands, 'Batch operation');
    setUndoStack((prev) => {
      const newStack = [batchCommand, ...prev];
      return newStack.slice(0, maxHistory);
    });
    setRedoStack([]);
  }, [maxHistory, undoStack.length]);

  /**
   * Cancels the current batch operation without committing.
   */
  const cancelBatch = useCallback(() => {
    if (!isBatchingRef.current) {
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
    isBatchingRef.current = false;
    batchCommandsRef.current = [];
  }, [currentState]);

  /**
   * Clears all undo/redo history.
   */
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    batchCommandsRef.current = [];
    isBatchingRef.current = false;
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
    isBatching: isBatchingRef.current,

    // Stack sizes (for testing)
    undoStackSize: undoStack.length,
    redoStackSize: redoStack.length,
  };
}
