/**
 * Programmatic Testing Utility for Undo/Redo System
 *
 * Provides robust testing by directly manipulating objects in 3D space,
 * bypassing pointer events to eliminate camera movement issues.
 */

import type { TestHooks } from '../types/testHooks';

interface TestResult {
  success: boolean;
  message: string;
  details: {
    initialStackSize: number;
    finalStackSize: number;
    expectedStackSize: number;
    stackIncrease: number;
    expectedIncrease: number;
    movesExecuted: number;
    objectPositions?: Array<{ x: number; z: number }>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTestHooks(): TestHooks | undefined {
  return window.__testHooks;
}

function createEmptyTestResult(expectedIncrease: number, message: string): TestResult {
  return {
    success: false,
    message,
    details: {
      initialStackSize: 0,
      finalStackSize: 0,
      expectedStackSize: 0,
      stackIncrease: 0,
      expectedIncrease,
      movesExecuted: 0,
    },
  };
}

function createTestResult(
  initialStackSize: number,
  finalStackSize: number,
  expectedIncrease: number,
  movesExecuted: number
): TestResult {
  const stackIncrease = finalStackSize - initialStackSize;
  const success = stackIncrease === expectedIncrease;

  return {
    success,
    message: success
      ? 'All moves recorded correctly'
      : `Expected ${expectedIncrease} entries, got ${stackIncrease}`,
    details: {
      initialStackSize,
      finalStackSize,
      expectedStackSize: initialStackSize + expectedIncrease,
      stackIncrease,
      expectedIncrease,
      movesExecuted,
    },
  };
}

function validateTestEnvironment(
  expectedIncrease: number
): { valid: true; hooks: TestHooks; objectId: string } | { valid: false; result: TestResult } {
  const hooks = getTestHooks();

  if (!hooks) {
    return {
      valid: false,
      result: createEmptyTestResult(expectedIncrease, 'Test hooks not available'),
    };
  }

  const objects = hooks.getCurrentObjects();
  if (!objects || objects.length === 0) {
    return { valid: false, result: createEmptyTestResult(expectedIncrease, 'No objects in scene') };
  }

  return { valid: true, hooks, objectId: objects[0].id };
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Multi-move test: Move object multiple times programmatically
 */
export async function multiMoveTest(numMoves: number = 10): Promise<TestResult> {
  console.log(`[MULTI-MOVE TEST] ========== ${numMoves} Programmatic Moves ==========`);

  const env = validateTestEnvironment(numMoves);
  if (!env.valid) return env.result;

  const { hooks, objectId } = env;
  const initialStackSize = hooks.getUndoStackSize();

  console.log(`[MULTI-MOVE TEST] Moving object ${objectId} ${numMoves} times`);
  console.log(`[MULTI-MOVE TEST] Initial stack size: ${initialStackSize}`);

  // Perform moves in circular pattern
  for (let i = 0; i < numMoves; i++) {
    const angle = (i / numMoves) * Math.PI * 2;
    const radius = 5;
    const deltaX = Math.cos(angle) * radius;
    const deltaZ = Math.sin(angle) * radius;

    console.log(
      `[MULTI-MOVE TEST] Move ${i + 1}/${numMoves}: delta (${deltaX.toFixed(2)}, ${deltaZ.toFixed(2)})`
    );
    hooks.testMove(objectId, deltaX, deltaZ);

    await new Promise((r) => setTimeout(r, 10));
  }

  const finalStackSize = hooks.getUndoStackSize();
  const result = createTestResult(initialStackSize, finalStackSize, numMoves, numMoves);

  console.log(`[MULTI-MOVE TEST] Final stack size: ${finalStackSize}`);
  console.log(
    `[MULTI-MOVE TEST] Stack increased by: ${result.details.stackIncrease} (expected: ${numMoves})`
  );
  console.log(`[MULTI-MOVE TEST] ${result.success ? 'PASS' : 'FAIL'}`);

  return result;
}

/**
 * Rapid move test: Very fast consecutive moves with minimal delay
 */
export async function rapidMoveTest(numMoves: number = 50): Promise<TestResult> {
  console.log(`[RAPID TEST] ========== ${numMoves} Rapid Moves (5ms delay) ==========`);

  const env = validateTestEnvironment(numMoves);
  if (!env.valid) return env.result;

  const { hooks, objectId } = env;
  const initialStackSize = hooks.getUndoStackSize();

  console.log(`[RAPID TEST] Moving object ${objectId} ${numMoves} times rapidly`);
  console.log(`[RAPID TEST] Initial stack size: ${initialStackSize}`);

  // Perform rapid moves in zigzag pattern
  for (let i = 0; i < numMoves; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    hooks.testMove(objectId, direction * 2, direction * 1.5);
    await new Promise((r) => setTimeout(r, 5));
  }

  const finalStackSize = hooks.getUndoStackSize();
  const result = createTestResult(initialStackSize, finalStackSize, numMoves, numMoves);

  console.log(`[RAPID TEST] Final stack size: ${finalStackSize}`);
  console.log(
    `[RAPID TEST] Stack increased by: ${result.details.stackIncrease} (expected: ${numMoves})`
  );
  console.log(`[RAPID TEST] ${result.success ? 'PASS' : 'FAIL'}`);

  return result;
}

/**
 * Undo/Redo verification test: Verify positions are correctly restored
 */
export async function undoRedoVerificationTest(): Promise<TestResult> {
  console.log('[UNDO/REDO TEST] ========== Position Verification ==========');

  const env = validateTestEnvironment(0);
  if (!env.valid) return env.result;

  const { hooks, objectId } = env;

  // Record initial position
  const initialPos = {
    x: hooks.getCurrentObjects()[0].transform.x,
    z: hooks.getCurrentObjects()[0].transform.z,
  };
  console.log(`[UNDO/REDO TEST] Initial position: (${initialPos.x}, ${initialPos.z})`);

  // Perform two moves
  hooks.testMove(objectId, 10, 0);
  await new Promise((r) => setTimeout(r, 50));
  const pos1 = hooks.getCurrentObjects()[0].transform;
  console.log(`[UNDO/REDO TEST] After move 1: (${pos1.x}, ${pos1.z})`);

  hooks.testMove(objectId, 0, 10);
  await new Promise((r) => setTimeout(r, 50));
  const pos2 = hooks.getCurrentObjects()[0].transform;
  console.log(`[UNDO/REDO TEST] After move 2: (${pos2.x}, ${pos2.z})`);

  // Verify undo twice
  hooks.undo();
  await new Promise((r) => setTimeout(r, 50));
  const afterUndo1 = hooks.getCurrentObjects()[0].transform;
  const undo1Correct =
    Math.abs(afterUndo1.x - pos1.x) < 0.01 && Math.abs(afterUndo1.z - pos1.z) < 0.01;
  console.log(
    `[UNDO/REDO TEST] After undo 1: (${afterUndo1.x}, ${afterUndo1.z}) ${undo1Correct ? '✓' : '✗'}`
  );

  hooks.undo();
  await new Promise((r) => setTimeout(r, 50));
  const afterUndo2 = hooks.getCurrentObjects()[0].transform;
  const undo2Correct =
    Math.abs(afterUndo2.x - initialPos.x) < 0.01 && Math.abs(afterUndo2.z - initialPos.z) < 0.01;
  console.log(
    `[UNDO/REDO TEST] After undo 2: (${afterUndo2.x}, ${afterUndo2.z}) ${undo2Correct ? '✓' : '✗'}`
  );

  // Verify redo
  hooks.redo();
  await new Promise((r) => setTimeout(r, 50));
  const afterRedo1 = hooks.getCurrentObjects()[0].transform;
  const redo1Correct =
    Math.abs(afterRedo1.x - pos1.x) < 0.01 && Math.abs(afterRedo1.z - pos1.z) < 0.01;
  console.log(
    `[UNDO/REDO TEST] After redo 1: (${afterRedo1.x}, ${afterRedo1.z}) ${redo1Correct ? '✓' : '✗'}`
  );

  const success = undo1Correct && undo2Correct && redo1Correct;
  console.log(`[UNDO/REDO TEST] ${success ? 'PASS' : 'FAIL'}`);

  return {
    success,
    message: success ? 'All undo/redo operations correct' : 'Position mismatch detected',
    details: {
      initialStackSize: 0,
      finalStackSize: 0,
      expectedStackSize: 0,
      stackIncrease: 0,
      expectedIncrease: 0,
      movesExecuted: 2,
      objectPositions: [initialPos, pos1, pos2, afterUndo1, afterUndo2, afterRedo1],
    },
  };
}

/**
 * Complex scenario: Combines moves, undos, redos
 */
export async function complexScenarioTest(): Promise<TestResult> {
  console.log('[COMPLEX TEST] ========== Complex Scenario ==========');

  const env = validateTestEnvironment(7);
  if (!env.valid) return env.result;

  const { hooks, objectId } = env;
  const initialStackSize = hooks.getUndoStackSize();

  console.log('[COMPLEX TEST] Initial stack size:', initialStackSize);

  // 5 moves
  for (let i = 0; i < 5; i++) {
    hooks.testMove(objectId, 3, 2);
    await new Promise((r) => setTimeout(r, 15));
  }
  console.log('[COMPLEX TEST] After 5 moves, stack size:', hooks.getUndoStackSize());

  // 3 undos
  for (let i = 0; i < 3; i++) {
    hooks.undo();
    await new Promise((r) => setTimeout(r, 15));
  }
  console.log('[COMPLEX TEST] After 3 undos, stack size:', hooks.getUndoStackSize());

  // 2 redos
  for (let i = 0; i < 2; i++) {
    hooks.redo();
    await new Promise((r) => setTimeout(r, 15));
  }
  console.log('[COMPLEX TEST] After 2 redos, stack size:', hooks.getUndoStackSize());

  // 3 more moves (clears redo stack)
  for (let i = 0; i < 3; i++) {
    hooks.testMove(objectId, -2, -1);
    await new Promise((r) => setTimeout(r, 15));
  }

  const finalStackSize = hooks.getUndoStackSize();
  // Expected increase: 5 moves - 3 undos + 2 redos + 3 moves = 7
  const result = createTestResult(initialStackSize, finalStackSize, 7, 8);

  console.log('[COMPLEX TEST] Final stack size:', finalStackSize);
  console.log(`[COMPLEX TEST] ${result.success ? 'PASS' : 'FAIL'}`);

  return result;
}

// ============================================================================
// Test Suite Orchestration
// ============================================================================

async function runFullSuite() {
  console.log('\n\n' + '='.repeat(70));
  console.log('[FULL SUITE] Starting Comprehensive Programmatic Tests');
  console.log('='.repeat(70) + '\n');

  const results: { [key: string]: TestResult } = {};

  results.move5 = await multiMoveTest(5);
  results.move10 = await multiMoveTest(10);
  results.move20 = await multiMoveTest(20);
  results.rapid = await rapidMoveTest(50);
  results.undoRedo = await undoRedoVerificationTest();
  results.complex = await complexScenarioTest();

  const allPassed = Object.values(results).every((r) => r.success);

  console.log('\n' + '='.repeat(70));
  console.log('[FULL SUITE] Test Results Summary');
  console.log('='.repeat(70));
  console.log('  1. 5 Moves:'.padEnd(40), results.move5.success ? '✓ PASS' : '✗ FAIL');
  console.log('  2. 10 Moves:'.padEnd(40), results.move10.success ? '✓ PASS' : '✗ FAIL');
  console.log('  3. 20 Moves:'.padEnd(40), results.move20.success ? '✓ PASS' : '✗ FAIL');
  console.log('  4. Rapid Moves (50):'.padEnd(40), results.rapid.success ? '✓ PASS' : '✗ FAIL');
  console.log(
    '  5. Undo/Redo Verification:'.padEnd(40),
    results.undoRedo.success ? '✓ PASS' : '✗ FAIL'
  );
  console.log('  6. Complex Scenario:'.padEnd(40), results.complex.success ? '✓ PASS' : '✗ FAIL');
  console.log('='.repeat(70));
  console.log(`[FULL SUITE] Overall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log('='.repeat(70) + '\n\n');

  return { results, allPassed };
}

// ============================================================================
// Expose API to Window
// ============================================================================

if (typeof window !== 'undefined') {
  window.programmaticTest = {
    // Core test functions
    multiMove: multiMoveTest,
    rapidMove: rapidMoveTest,
    verifyUndoRedo: undoRedoVerificationTest,
    complexScenario: complexScenarioTest,
    fullSuite: runFullSuite,

    // Quick shortcuts
    quick5: () => multiMoveTest(5),
    quick10: () => multiMoveTest(10),
    quick20: () => multiMoveTest(20),
    quick50: () => multiMoveTest(50),
  };

  console.log('[Programmatic Test] Utilities loaded. Run: programmaticTest.fullSuite()');
}
