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
    previewSettings: {
      allowOrbit: false,
      allowZoom: false,
    },
    previewStep: null,
    shouldAnimateMoveItem: false,
    previewOutlineParentId: null,
    previewOutlineChildPath: null,
    controlsRef: { current: null } as unknown as SceneContentViewProps['controlsRef'],
    isPositioningCameraRef: { current: false },
    isCameraPositioning: false,
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

  it('always keeps dollyToCursor disabled', () => {
    const firstRender = render(<SceneContentView {...createBaseProps({ selectedObjectId: null })} />);
    expect(lastCameraControlsProps).not.toBeNull();
    expect(lastCameraControlsProps?.dollyToCursor).toBe(false);
    firstRender.unmount();

    const secondRender = render(<SceneContentView {...createBaseProps({ selectedObjectId: 'obj-123' })} />);
    expect(lastCameraControlsProps?.dollyToCursor).toBe(false);
    secondRender.unmount();

    document.body.dataset.guidedPhase = 'model-upload';
    const thirdRender = render(<SceneContentView {...createBaseProps({ selectedObjectId: null })} />);
    expect(lastCameraControlsProps?.dollyToCursor).toBe(false);
    thirdRender.unmount();

    const fourthRender = render(
      <SceneContentView
        {...createBaseProps({
          previewMode: true,
          selectedObjectId: null,
        })}
      />
    );
    expect(lastCameraControlsProps?.dollyToCursor).toBe(false);
    fourthRender.unmount();
  });

  it('uses tighter maxDistance in preview mode', () => {
    const props = createBaseProps({
      previewMode: true,
    });

    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect(lastCameraControlsProps?.maxDistance).toBe(20);
  });

  it('uses default maxDistance outside preview mode', () => {
    const props = createBaseProps({
      previewMode: false,
    });

    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect(lastCameraControlsProps?.maxDistance).toBe(60);
  });

  it('locks preview orbit/zoom while camera is positioning', () => {
    const props = createBaseProps({
      previewMode: true,
      previewSettings: {
        allowOrbit: true,
        allowZoom: true,
      },
      isCameraPositioning: true,
      isPositioningCameraRef: { current: true },
    });

    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect((lastCameraControlsProps?.mouseButtons as Record<string, number>).left).toBe(0);
    expect((lastCameraControlsProps?.mouseButtons as Record<string, number>).wheel).toBe(0);
    expect((lastCameraControlsProps?.touches as Record<string, number>).one).toBe(0);
    expect((lastCameraControlsProps?.touches as Record<string, number>).two).toBe(0);
  });

  it('keeps preview orbit/zoom available during move-item animation', () => {
    const props = createBaseProps({
      previewMode: true,
      previewSettings: {
        allowOrbit: true,
        allowZoom: true,
      },
      shouldAnimateMoveItem: true,
      isPositioningCameraRef: { current: false },
    });

    render(<SceneContentView {...props} />);

    expect(lastCameraControlsProps).not.toBeNull();
    expect((lastCameraControlsProps?.mouseButtons as Record<string, number>).left).toBe(1);
    expect((lastCameraControlsProps?.mouseButtons as Record<string, number>).wheel).toBe(2);
    expect((lastCameraControlsProps?.touches as Record<string, number>).one).toBe(4);
    expect((lastCameraControlsProps?.touches as Record<string, number>).two).toBe(5);
  });
});

