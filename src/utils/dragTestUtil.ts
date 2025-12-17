/**
 * Automated drag testing utility that simulates realistic user drag interactions
 *
 * DEPRECATED: Use programmaticTestUtil.ts instead for more reliable testing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DragConfig {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number; // Total drag duration
  fps?: number; // Defaults to 60
}

interface DragTestResult {
  success: boolean;
  startPos: { x: number; z: number };
  endPos: { x: number; z: number };
  undoStackSize: number;
  error?: string;
}

/**
 * Simulates a realistic user drag with easing
 */
export async function simulateRealisticDrag(config: DragConfig): Promise<DragTestResult> {
  const { startX, startY, endX, endY, durationMs, fps = 60 } = config;
  const canvas = document.querySelector('canvas');

  if (!canvas) {
    return {
      success: false,
      error: 'Canvas not found',
      startPos: { x: 0, z: 0 },
      endPos: { x: 0, z: 0 },
      undoStackSize: 0,
    };
  }

  const frameTime = 1000 / fps;
  const numFrames = Math.floor(durationMs / frameTime);

  // Easing function - ease in-out cubic (realistic human motion)
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Helper to dispatch proper pointer events
  const dispatchPointerEvent = (type: string, x: number, y: number, buttons: number) => {
    const event = new PointerEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      screenX: x + window.screenX,
      screenY: y + window.screenY,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons,
      isPrimary: true,
      pressure: buttons > 0 ? 0.5 : 0,
    });
    canvas.dispatchEvent(event);
  };

  console.log('[TEST] Starting realistic drag simulation');
  console.log('[TEST] From:', startX, startY, 'To:', endX, endY, 'Duration:', durationMs, 'ms');

  // Pointer down
  dispatchPointerEvent('pointerdown', startX, startY, 1);
  await new Promise((r) => setTimeout(r, frameTime));

  // Move with easing
  for (let i = 1; i <= numFrames; i++) {
    const progress = i / numFrames;
    const easedProgress = easeInOutCubic(progress);

    const currentX = startX + (endX - startX) * easedProgress;
    const currentY = startY + (endY - startY) * easedProgress;

    dispatchPointerEvent('pointermove', currentX, currentY, 1);
    await new Promise((r) => setTimeout(r, frameTime));
  }

  // Pointer up at final position
  dispatchPointerEvent('pointerup', endX, endY, 0);

  // Wait for state to settle
  await new Promise((r) => setTimeout(r, 100));

  console.log('[TEST] Drag simulation complete');

  return {
    success: true,
    startPos: { x: 0, z: 0 }, // These will be filled by test harness
    endPos: { x: 0, z: 0 },
    undoStackSize: 0,
  };
}

/**
 * Get the screen position of the first object in the scene
 */
function getObjectScreenPosition(canvas: HTMLCanvasElement): { x: number; y: number } | null {
  const objects = (window as any).__testHooks?.getCurrentObjects?.();
  if (!objects || objects.length === 0) {
    console.error('[TEST] No objects in scene to drag!');
    return null;
  }

  const firstObject = objects[0];
  console.log(
    '[TEST] Found object:',
    firstObject.name || firstObject.id,
    'at position:',
    firstObject.transform
  );

  // For now, use a position slightly offset from center to ensure we hit the object
  // In a real implementation, we'd project the 3D position to screen coordinates
  // But since objects spawn at origin and camera looks at origin, center should work
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Test harness: Drag an object, check that exactly 1 undo entry was created
 */
export async function runDragTest(
  testName: string,
  config: Partial<DragConfig> = {}
): Promise<DragTestResult> {
  console.log(`[TEST] ========== ${testName} ==========`);

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    return {
      success: false,
      error: 'Canvas not found',
      startPos: { x: 0, z: 0 },
      endPos: { x: 0, z: 0 },
      undoStackSize: 0,
    };
  }

  // Check if there's an object to drag
  const objects = (window as any).__testHooks?.getCurrentObjects?.();
  if (!objects || objects.length === 0) {
    console.error('[TEST] No objects in scene! Add a cube first.');
    return {
      success: false,
      error: 'No objects in scene',
      startPos: { x: 0, z: 0 },
      endPos: { x: 0, z: 0 },
      undoStackSize: 0,
    };
  }

  // Record initial undo stack size BEFORE drag
  const initialUndoStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  console.log('[TEST] Initial undo stack size:', initialUndoStackSize);
  console.log('[TEST] Objects in scene:', objects.length);

  // Get object position on screen
  const objectPos = getObjectScreenPosition(canvas);
  if (!objectPos) {
    return {
      success: false,
      error: 'Could not determine object position',
      startPos: { x: 0, z: 0 },
      endPos: { x: 0, z: 0 },
      undoStackSize: 0,
    };
  }

  const dragConfig: DragConfig = {
    startX: config.startX ?? objectPos.x,
    startY: config.startY ?? objectPos.y,
    endX: config.endX ?? objectPos.x + 200,
    endY: config.endY ?? objectPos.y,
    durationMs: config.durationMs ?? 300, // 300ms = medium speed drag
    fps: config.fps ?? 60,
  };

  const result = await simulateRealisticDrag(dragConfig);

  // Check undo stack size AFTER drag
  const finalUndoStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? -1;
  const stackIncrease = finalUndoStackSize - initialUndoStackSize;

  console.log('[TEST] Final undo stack size:', finalUndoStackSize);
  console.log('[TEST] Stack increase:', stackIncrease, '(expected: 1)');

  // Verify exactly ONE undo entry was added (the drag should be a single atomic action)
  if (stackIncrease !== 1) {
    console.error(
      '[TEST] FAIL - Expected stack to increase by 1, but it increased by',
      stackIncrease
    );
    return { ...result, success: false, undoStackSize: finalUndoStackSize };
  }

  console.log('[TEST] PASS - Drag created exactly 1 undo entry');
  return { ...result, success: true, undoStackSize: finalUndoStackSize };
}

/**
 * Stress test: Perform multiple consecutive drags and verify undo stack
 */
export async function multiDragTest(
  numDrags: number = 5
): Promise<{ success: boolean; results: DragTestResult[]; finalStackSize: number }> {
  console.log(`[STRESS TEST] ========== ${numDrags} Consecutive Drags ==========`);

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    return { success: false, results: [], finalStackSize: 0 };
  }

  // Check for objects
  const objects = (window as any).__testHooks?.getCurrentObjects?.();
  if (!objects || objects.length === 0) {
    console.error('[STRESS TEST] No objects in scene! Add a cube first.');
    return { success: false, results: [], finalStackSize: 0 };
  }

  const initialStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  console.log('[STRESS TEST] Initial undo stack size:', initialStackSize);
  console.log('[STRESS TEST] Objects in scene:', objects.length);

  // Get object screen position
  const objectPos = getObjectScreenPosition(canvas);
  if (!objectPos) {
    return { success: false, results: [], finalStackSize: 0 };
  }

  let currentX = objectPos.x;
  let currentY = objectPos.y;

  const results: DragTestResult[] = [];

  // Perform multiple drags - each drag starts from where the last one ended
  for (let i = 0; i < numDrags; i++) {
    // Drag in different directions - create a spiral pattern
    const angle = i * (360 / numDrags) * (Math.PI / 180);
    const distance = 50; // Consistent distance for each drag

    const endX = currentX + Math.cos(angle) * distance;
    const endY = currentY + Math.sin(angle) * distance;

    const config: DragConfig = {
      startX: currentX,
      startY: currentY,
      endX: endX,
      endY: endY,
      durationMs: 150 + Math.random() * 100, // Vary speed slightly
      fps: 60,
    };

    console.log(
      `[STRESS TEST] Drag ${i + 1}/${numDrags} from (${currentX.toFixed(0)}, ${currentY.toFixed(0)}) to (${endX.toFixed(0)}, ${endY.toFixed(0)})`
    );
    const result = await simulateRealisticDrag(config);
    results.push(result);

    // Update current position to where we just dragged to
    currentX = endX;
    currentY = endY;

    // Small delay between drags to simulate realistic usage
    await new Promise((r) => setTimeout(r, 50));
  }

  const finalStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  const stackIncrease = finalStackSize - initialStackSize;

  console.log('[STRESS TEST] Final undo stack size:', finalStackSize);
  console.log('[STRESS TEST] Stack increased by:', stackIncrease, `(expected: ${numDrags})`);

  const success = stackIncrease === numDrags;

  if (!success) {
    console.error(`[STRESS TEST] FAIL - Expected ${numDrags} undo entries, got ${stackIncrease}`);
    console.error(`[STRESS TEST] Extra/missing entries: ${stackIncrease - numDrags}`);
  } else {
    console.log(
      `[STRESS TEST] PASS - All ${numDrags} drags created exactly ${numDrags} undo entries`
    );
  }

  return { success, results, finalStackSize };
}

/**
 * Rapid fire test: Very fast consecutive drags
 */
export async function rapidDragTest(): Promise<{
  success: boolean;
  numDrags: number;
  stackIncrease: number;
}> {
  console.log('[RAPID TEST] ========== Rapid Consecutive Drags ==========');

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    return { success: false, numDrags: 0, stackIncrease: 0 };
  }

  // Check for objects
  const objects = (window as any).__testHooks?.getCurrentObjects?.();
  if (!objects || objects.length === 0) {
    console.error('[RAPID TEST] No objects in scene! Add a cube first.');
    return { success: false, numDrags: 0, stackIncrease: 0 };
  }

  const initialStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  console.log('[RAPID TEST] Objects in scene:', objects.length);

  // Get object screen position
  const objectPos = getObjectScreenPosition(canvas);
  if (!objectPos) {
    return { success: false, numDrags: 0, stackIncrease: 0 };
  }

  let currentX = objectPos.x;
  let currentY = objectPos.y;

  const numDrags = 10;

  // Very fast drags with minimal delay - alternate left/right
  for (let i = 0; i < numDrags; i++) {
    const offset = (i % 2 === 0 ? 1 : -1) * 50;
    const endX = currentX + offset;
    const endY = currentY + offset * 0.5;

    const config: DragConfig = {
      startX: currentX,
      startY: currentY,
      endX: endX,
      endY: endY,
      durationMs: 100, // Very fast
      fps: 60,
    };

    await simulateRealisticDrag(config);

    // Update position
    currentX = endX;
    currentY = endY;

    // Minimal delay - stress test the batching system
    await new Promise((r) => setTimeout(r, 20));
  }

  const finalStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  const stackIncrease = finalStackSize - initialStackSize;

  console.log('[RAPID TEST] Performed', numDrags, 'rapid drags');
  console.log('[RAPID TEST] Stack increased by:', stackIncrease, `(expected: ${numDrags})`);

  const success = stackIncrease === numDrags;

  if (!success) {
    console.error(`[RAPID TEST] FAIL - Expected ${numDrags} entries, got ${stackIncrease}`);
  } else {
    console.log(`[RAPID TEST] PASS`);
  }

  return { success, numDrags, stackIncrease };
}

/**
 * Complex path test: Single long drag with many intermediate points
 */
export async function complexPathTest(): Promise<DragTestResult> {
  console.log('[COMPLEX PATH] ========== Long Complex Drag ==========');

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    return { success: false, startPos: { x: 0, z: 0 }, endPos: { x: 0, z: 0 }, undoStackSize: 0 };
  }

  // Check for objects
  const objects = (window as any).__testHooks?.getCurrentObjects?.();
  if (!objects || objects.length === 0) {
    console.error('[COMPLEX PATH] No objects in scene! Add a cube first.');
    return { success: false, startPos: { x: 0, z: 0 }, endPos: { x: 0, z: 0 }, undoStackSize: 0 };
  }

  const initialStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  console.log('[COMPLEX PATH] Objects in scene:', objects.length);

  // Get object position and drag from there
  const objectPos = getObjectScreenPosition(canvas);
  if (!objectPos) {
    return { success: false, startPos: { x: 0, z: 0 }, endPos: { x: 0, z: 0 }, undoStackSize: 0 };
  }

  const startX = objectPos.x;
  const startY = objectPos.y;
  const endX = startX + 300; // Drag 300px to the right
  const endY = startY + 150; // And 150px down

  // Long drag with many frames (high fps * long duration)
  const config: DragConfig = {
    startX,
    startY,
    endX,
    endY,
    durationMs: 1000, // 1 second drag
    fps: 60, // 60 frames = lots of intermediate updates
  };

  const result = await simulateRealisticDrag(config);

  const finalStackSize = (window as any).__testHooks?.getUndoStackSize?.() ?? 0;
  const stackIncrease = finalStackSize - initialStackSize;

  console.log('[COMPLEX PATH] Stack increased by:', stackIncrease, '(expected: 1)');

  const success = stackIncrease === 1;

  if (!success) {
    console.error('[COMPLEX PATH] FAIL - Long drag should create only 1 entry, got', stackIncrease);
  } else {
    console.log('[COMPLEX PATH] PASS - Long complex drag created exactly 1 entry');
  }

  return { ...result, success, undoStackSize: finalStackSize };
}

// Expose to window for easy testing from browser console
if (typeof window !== 'undefined') {
  (window as any).dragTest = {
    simulate: simulateRealisticDrag,
    run: runDragTest,

    // Quick test scenarios
    quickDrag: () => runDragTest('Quick Drag', { durationMs: 200 }),
    slowDrag: () => runDragTest('Slow Drag', { durationMs: 800 }),
    fastDrag: () => runDragTest('Fast Drag', { durationMs: 100 }),
    longDrag: () =>
      runDragTest('Long Distance', {
        endX: window.innerWidth * 0.8,
      }),

    // Stress tests
    multiDrag: (count?: number) => multiDragTest(count || 10),
    rapidDrag: rapidDragTest,
    complexPath: complexPathTest,

    // Full suite
    fullSuite: async () => {
      console.log('\n\n[FULL SUITE] ========================================');
      console.log('[FULL SUITE] Starting comprehensive test suite...\n');

      const results = {
        single: await runDragTest('Single Drag'),
        multi5: await multiDragTest(5),
        multi10: await multiDragTest(10),
        multi20: await multiDragTest(20),
        rapid: await rapidDragTest(),
        complex: await complexPathTest(),
      };

      const allPassed =
        results.single.success &&
        results.multi5.success &&
        results.multi10.success &&
        results.multi20.success &&
        results.rapid.success &&
        results.complex.success;

      console.log('\n[FULL SUITE] ========================================');
      console.log('[FULL SUITE] Test Results:');
      console.log('  Single Drag:', results.single.success ? '✅ PASS' : '❌ FAIL');
      console.log('  5 Drags:', results.multi5.success ? '✅ PASS' : '❌ FAIL');
      console.log('  10 Drags:', results.multi10.success ? '✅ PASS' : '❌ FAIL');
      console.log('  20 Drags:', results.multi20.success ? '✅ PASS' : '❌ FAIL');
      console.log('  Rapid Drags:', results.rapid.success ? '✅ PASS' : '❌ FAIL');
      console.log('  Complex Path:', results.complex.success ? '✅ PASS' : '❌ FAIL');
      console.log('[FULL SUITE]', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
      console.log('[FULL SUITE] ========================================\n\n');

      return { results, allPassed };
    },
  };
}
