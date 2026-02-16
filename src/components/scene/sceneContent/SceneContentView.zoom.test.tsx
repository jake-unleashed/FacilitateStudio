import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Hoisted mocks: keep jsdom stable (avoid WebGL/postprocessing init)
// -----------------------------------------------------------------------------

let lastCameraControlsProps: Record<string, unknown> | null = null;

vi.mock('@react-three/postprocessing', () => ({
  Selection: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="postprocessing-selection">{children}</div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  CameraControls: React.forwardRef(function CameraControlsMock(
    props: Record<string, unknown>,
    _ref
  ) {
    lastCameraControlsProps = props;
    return <div data-testid="camera-controls" />;
  }),
  Environment: () => null,
  PerspectiveCamera: () => null,
}));

vi.mock('camera-controls', () => ({
  default: {
    ACTION: {
      NONE: 0,
      ROTATE: 1,
      DOLLY: 2,
      TRUCK: 3,
      TOUCH_ROTATE: 4,
      TOUCH_DOLLY: 5,
      TOUCH_DOLLY_TRUCK: 6,
      TOUCH_TRUCK: 7,
    },
  },
}));

// Local scene component mocks (avoid R3F deps + heavy module graphs)
vi.mock('../FixedContactShadows', () => ({
  FixedContactShadows: () => null,
  ContactShadowDebugger: () => null,
}));

vi.mock('../DragHandler', () => ({
  DragHandler: () => null,
  CursorManager: () => null,
}));

vi.mock('../ImportedModel', () => ({
  ImportedModel: () => null,
}));

vi.mock('../IndustrialPrimitive', () => ({
  IndustrialPrimitive: () => null,
}));

vi.mock('../KeyboardNavigator', () => ({
  KeyboardNavigator: () => null,
}));

vi.mock('../SelectionOutline', () => ({
  ChildOutlineEffect: () => null,
  ChildSelectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PreviewChildOutlineEffect: () => null,
  PreviewSelectionOutlineEffect: () => null,
  Select: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectionOutlineEffect: () => null,
}));

vi.mock('../transformGizmo', () => ({
  TransformGizmo: () => null,
}));

vi.mock('../GridWithNoDepth', () => ({
  GridWithNoDepth: () => null,
}));

vi.mock('../../preview/PreviewMoveItemStepRenderer', () => ({
  PreviewMoveItemStepRenderer: () => null,
}));

// Import after mocks
import { SceneContentView, type SceneContentViewProps } from './SceneContentView';

function createBaseProps(overrides: Partial<SceneContentViewProps> = {}): SceneContentViewProps {
  return {
    objects: [],
    selectedParentId: null,
    selectedChildPath: null,
    selectedObjectId: null,
    selectedObject: null,
    previewMode: false,
    previewStep: null,
    shouldAnimateMoveItem: false,
    previewOutlineParentId: null,
    previewOutlineChildPath: null,
    controlsRef: { current: null } as unknown as SceneContentViewProps['controlsRef'],
    isPositioningCameraRef: { current: false },
    actualObject: null,
    ghostObject: null,
    targetObjectId: null,
    dragState: null,
    hasMovedRef: { current: false },
    hoveredObjectId: null,
    isCursorHovering: false,
    isRecentlyDragged: false,
    onUpdateObject: vi.fn(),
    handleObjectPointerDown: vi.fn(),
    handleDoubleClick: vi.fn(),
    handleHoverStart: vi.fn(),
    handleHoverEnd: vi.fn(),
    handleDragEnd: vi.fn(),
    handleMarkAsDrag: vi.fn(),
    ...overrides,
  };
}

describe('SceneContentView zoom behavior', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | null = null;
  let errorSpy: ReturnType<typeof vi.spyOn> | null = null;
  let originalWarn: typeof console.warn | null = null;
  let originalError: typeof console.error | null = null;

  beforeEach(() => {
    lastCameraControlsProps = null;
    document.body.dataset.guidedNavLock = 'false';
    delete document.body.dataset.guidedPhase;
    delete document.body.dataset.guidedPositionMode;

    // R3F uses a custom renderer; in jsdom these intrinsic scene tags trigger React casing warnings.
    const isR3FPrimitiveWarning = (message?: unknown) => {
      if (typeof message !== 'string') return false;
      return (
        message.includes('is using incorrect casing') ||
        message.includes('is unrecognized in this browser')
      );
    };

    originalWarn = console.warn;
    originalError = console.error;

    warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      if (isR3FPrimitiveWarning(args[0])) return;
      originalWarn?.(...args);
    });

    errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (isR3FPrimitiveWarning(args[0])) return;
      originalError?.(...args);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    warnSpy?.mockRestore();
    errorSpy?.mockRestore();
    warnSpy = null;
    errorSpy = null;
    originalWarn = null;
    originalError = null;
  });

  it('enables dollyToCursor when nothing is selected', () => {
    const props = createBaseProps({ selectedObjectId: null });
    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect(lastCameraControlsProps?.dollyToCursor).toBe(true);
  });

  it('disables dollyToCursor when a selection exists', () => {
    const props = createBaseProps({ selectedObjectId: 'obj-123' });
    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect(lastCameraControlsProps?.dollyToCursor).toBe(false);
  });

  it('disables dollyToCursor during guided model-upload even with no selection', () => {
    document.body.dataset.guidedPhase = 'model-upload';
    const props = createBaseProps({ selectedObjectId: null });
    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect(lastCameraControlsProps?.dollyToCursor).toBe(false);
  });
});

