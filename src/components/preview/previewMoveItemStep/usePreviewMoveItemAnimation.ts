import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject, SimStep } from '../../../types';

export function usePreviewMoveItemAnimation(args: {
  step: SimStep;
  targetObject: SceneObject | null;
  isValidStep: boolean;
  shouldAnimate: boolean;
  implicitStartPosition: { x: number; y: number; z: number } | null;
  implicitStartRotationScale:
    | {
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
      }
    | null;
  onComplete: () => void;
  onAnimationStart?: () => void;
  onTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
}): { isAnimating: boolean } {
  const {
    step,
    targetObject,
    isValidStep,
    shouldAnimate,
    implicitStartPosition,
    implicitStartRotationScale,
    onComplete,
    onAnimationStart,
    onTransformUpdate,
  } = args;

  const [isAnimating, setIsAnimating] = useState(false);
  const animationStartTime = useRef<number>(0);
  const animationStartWorldPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const animationStartRotationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const animationStartScaleRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const hasStartedAnimation = useRef(false);

  const tmpEulerStartRef = useRef(new THREE.Euler());
  const tmpEulerEndRef = useRef(new THREE.Euler());
  const tmpEulerCurrentRef = useRef(new THREE.Euler());
  const tmpQuatStartRef = useRef(new THREE.Quaternion());
  const tmpQuatEndRef = useRef(new THREE.Quaternion());
  const tmpQuatCurrentRef = useRef(new THREE.Quaternion());

  // Start animation when shouldAnimate becomes true
  useEffect(() => {
    if (shouldAnimate && !isAnimating && !hasStartedAnimation.current && isValidStep) {
      hasStartedAnimation.current = true;
      setIsAnimating(true);
      animationStartTime.current = Date.now();
      animationStartWorldPosRef.current = step.startPosition ?? implicitStartPosition;
      animationStartRotationRef.current = step.startRotation ?? implicitStartRotationScale?.rotation ?? null;
      animationStartScaleRef.current = step.startScale ?? implicitStartRotationScale?.scale ?? null;
      onAnimationStart?.();
    }
  }, [
    shouldAnimate,
    isAnimating,
    isValidStep,
    step.startPosition,
    step.startRotation,
    step.startScale,
    implicitStartPosition,
    implicitStartRotationScale,
    onAnimationStart,
  ]);

  // Reset animation state when step changes
  useEffect(() => {
    hasStartedAnimation.current = false;
    setIsAnimating(false);
    animationStartWorldPosRef.current = null;
    animationStartRotationRef.current = null;
    animationStartScaleRef.current = null;
  }, [step.id]);

  // Animate object movement
  useFrame(() => {
    if (!isAnimating || !targetObject) return;

    const duration = 2000;
    const elapsed = Date.now() - animationStartTime.current;
    const progress = Math.min(elapsed / duration, 1);

    const easedProgress =
      progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const start =
      animationStartWorldPosRef.current ??
      step.startPosition ??
      implicitStartPosition ?? {
        x: targetObject.transform.x,
        y: targetObject.transform.y,
        z: targetObject.transform.z,
      };
    const end = step.endPosition ?? start;

    const currentWorldPos = {
      x: start.x + (end.x - start.x) * easedProgress,
      y: start.y + (end.y - start.y) * easedProgress,
      z: start.z + (end.z - start.z) * easedProgress,
    };

    const startRot =
      animationStartRotationRef.current ??
      step.startRotation ??
      implicitStartRotationScale?.rotation ?? {
        x: 0,
        y: 0,
        z: 0,
      };
    const startScale =
      animationStartScaleRef.current ??
      step.startScale ??
      implicitStartRotationScale?.scale ?? {
        x: 1,
        y: 1,
        z: 1,
      };

    const endRot = step.endRotation ?? startRot;
    const endScale = step.endScale ?? startScale;

    tmpEulerStartRef.current.set(
      THREE.MathUtils.degToRad(startRot.x),
      THREE.MathUtils.degToRad(startRot.y),
      THREE.MathUtils.degToRad(startRot.z),
      'XYZ'
    );
    tmpEulerEndRef.current.set(
      THREE.MathUtils.degToRad(endRot.x),
      THREE.MathUtils.degToRad(endRot.y),
      THREE.MathUtils.degToRad(endRot.z),
      'XYZ'
    );
    tmpQuatStartRef.current.setFromEuler(tmpEulerStartRef.current);
    tmpQuatEndRef.current.setFromEuler(tmpEulerEndRef.current);
    if (tmpQuatStartRef.current.dot(tmpQuatEndRef.current) < 0) {
      tmpQuatEndRef.current.x *= -1;
      tmpQuatEndRef.current.y *= -1;
      tmpQuatEndRef.current.z *= -1;
      tmpQuatEndRef.current.w *= -1;
    }
    tmpQuatCurrentRef.current.copy(tmpQuatStartRef.current).slerp(tmpQuatEndRef.current, easedProgress);
    tmpEulerCurrentRef.current.setFromQuaternion(tmpQuatCurrentRef.current, 'XYZ');

    const currentRot = {
      x: THREE.MathUtils.radToDeg(tmpEulerCurrentRef.current.x),
      y: THREE.MathUtils.radToDeg(tmpEulerCurrentRef.current.y),
      z: THREE.MathUtils.radToDeg(tmpEulerCurrentRef.current.z),
    };

    const currentScale = {
      x: startScale.x + (endScale.x - startScale.x) * easedProgress,
      y: startScale.y + (endScale.y - startScale.y) * easedProgress,
      z: startScale.z + (endScale.z - startScale.z) * easedProgress,
    };

    onTransformUpdate?.(
      {
        position: currentWorldPos,
        rotation: currentRot,
        scale: currentScale,
      },
      step.targetChildPath
    );

    if (progress >= 1) {
      setIsAnimating(false);
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  });

  return { isAnimating };
}

