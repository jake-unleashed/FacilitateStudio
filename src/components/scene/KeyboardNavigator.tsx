/**
 * KeyboardNavigator Component
 *
 * Handles keyboard navigation in the 3D scene including:
 * - WASD and arrow keys for camera panning
 * - Q/E for camera rotation
 * - F key for focusing on selected object
 * - Home/0 key for resetting camera view
 */

import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { SceneObject, FocusMode } from '../../types';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../../constants';

// ============================================================================
// Constants
// ============================================================================

/** Navigation keys that trigger continuous movement */
const NAVIGATION_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'q',
  'e',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
]);

/** Pan speed for WASD/arrow key navigation */
const PAN_SPEED = 0.08;

/** Rotation speed for Q/E rotation */
const ROTATE_SPEED = 0.02;

// ============================================================================
// KeyboardNavigator Component
// ============================================================================

interface KeyboardNavigatorProps {
  controlsRef: React.RefObject<CameraControlsImpl>;
  selectedObject: SceneObject | null;
  selectedChildPath: string | null;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
}

/**
 * KeyboardNavigator - Handles WASD, arrow keys, Q/E, F, Home
 */
export const KeyboardNavigator: React.FC<KeyboardNavigatorProps> = ({
  controlsRef,
  selectedObject,
  selectedChildPath,
  onFocusObject,
}) => {
  const keysPressed = useRef<Set<string>>(new Set());
  const { gl, invalidate } = useThree();

  // Handle keydown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      keysPressed.current.add(key);

      // Focus on selected object (F key) - delegates to onFocusObject for unified focus behavior
      // Passes childPath if a child is selected, enabling focus on child mesh bounds
      if (key === 'f' && selectedObject && onFocusObject) {
        onFocusObject(selectedObject, selectedChildPath ?? undefined);
        e.preventDefault();
      }

      // Reset view (Home or 0 key)
      if ((key === 'home' || key === '0') && controlsRef.current) {
        controlsRef.current.setLookAt(...DEFAULT_CAMERA_POSITION, ...DEFAULT_CAMERA_TARGET, true);
        invalidate(); // Trigger re-render for smooth animation
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Capture ref value for cleanup to satisfy exhaustive-deps rule
    const keysPressedRef = keysPressed.current;

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keysPressedRef.clear(); // Clean up on unmount
    };
  }, [gl, selectedObject, selectedChildPath, controlsRef, invalidate, onFocusObject]);

  // Continuous movement in useFrame for smooth WASD/arrow key navigation
  useFrame(() => {
    if (!controlsRef.current) return;

    const keys = keysPressed.current;

    // Early return if no navigation keys are pressed - saves CPU cycles
    if (keys.size === 0) return;

    // Check if any navigation keys are actually pressed
    let hasNavigationKey = false;
    for (const key of keys) {
      if (NAVIGATION_KEYS.has(key)) {
        hasNavigationKey = true;
        break;
      }
    }
    if (!hasNavigationKey) return;

    const controls = controlsRef.current;

    // Forward/Backward (W/S or Up/Down arrows) - truck forward/back
    if (keys.has('w') || keys.has('arrowup')) {
      controls.forward(PAN_SPEED, false);
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      controls.forward(-PAN_SPEED, false);
    }

    // Left/Right (A/D or Left/Right arrows) - truck left/right
    if (keys.has('a') || keys.has('arrowleft')) {
      controls.truck(-PAN_SPEED, 0, false);
    }
    if (keys.has('d') || keys.has('arrowright')) {
      controls.truck(PAN_SPEED, 0, false);
    }

    // Rotate (Q/E) - azimuth rotation
    if (keys.has('q')) {
      controls.rotate(-ROTATE_SPEED, 0, false);
    }
    if (keys.has('e')) {
      controls.rotate(ROTATE_SPEED, 0, false);
    }
  });

  return null;
};
