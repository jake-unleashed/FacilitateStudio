import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import './spark/SparkRendererBridge';
import './spark/SplatMeshBridge';

const TARGET_WORLD_SIZE = 120;

interface Vector3Like {
  x?: number;
  y?: number;
  z?: number;
}

interface SplatBaseTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
}

interface WorldEnvironmentRendererProps {
  spzUrl: string;
  positionOverride?: Vector3Like;
  rotationOverride?: Vector3Like;
  scaleOverride?: number;
  onReadyChange?: (ready: boolean, worldUrl?: string, errorMessage?: string) => void;
}

function calculateBaseTransform(mesh: SplatMesh): SplatBaseTransform {
  const boundingBox = mesh.getBoundingBox(false);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  boundingBox.getSize(size);
  boundingBox.getCenter(center);

  const largestDimension = Math.max(size.x, size.y, size.z);
  const scaleFactor =
    largestDimension > 0 && Number.isFinite(largestDimension)
      ? TARGET_WORLD_SIZE / largestDimension
      : 1;

  return {
    scale: scaleFactor,
    rotation: new THREE.Euler(Math.PI, 0, 0),
    position: new THREE.Vector3(
      -center.x * scaleFactor,
      boundingBox.max.y * scaleFactor,
      center.z * scaleFactor
    ),
  };
}

function normalizeFinite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function applyTransform(
  mesh: SplatMesh,
  baseTransform: SplatBaseTransform,
  positionOverride?: Vector3Like,
  rotationOverride?: Vector3Like,
  scaleOverride?: number
): void {
  const safeScaleOverride =
    typeof scaleOverride === 'number' && Number.isFinite(scaleOverride) && scaleOverride > 0
      ? scaleOverride
      : 1;
  const finalScale = baseTransform.scale * safeScaleOverride;
  mesh.scale.setScalar(finalScale);

  const rotationX = normalizeFinite(rotationOverride?.x, 0) * (Math.PI / 180);
  const rotationY = normalizeFinite(rotationOverride?.y, 0) * (Math.PI / 180);
  const rotationZ = normalizeFinite(rotationOverride?.z, 0) * (Math.PI / 180);
  mesh.rotation.set(
    baseTransform.rotation.x + rotationX,
    baseTransform.rotation.y + rotationY,
    baseTransform.rotation.z + rotationZ
  );

  const positionX = normalizeFinite(positionOverride?.x, 0);
  const positionY = normalizeFinite(positionOverride?.y, 0);
  const positionZ = normalizeFinite(positionOverride?.z, 0);
  mesh.position.set(
    baseTransform.position.x + positionX,
    baseTransform.position.y + positionY,
    baseTransform.position.z + positionZ
  );
}

export function WorldEnvironmentRenderer({
  spzUrl,
  positionOverride,
  rotationOverride,
  scaleOverride,
  onReadyChange,
}: WorldEnvironmentRendererProps): JSX.Element {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;
  const positionOverrideRef = useRef(positionOverride);
  const rotationOverrideRef = useRef(rotationOverride);
  const scaleOverrideRef = useRef(scaleOverride);
  positionOverrideRef.current = positionOverride;
  rotationOverrideRef.current = rotationOverride;
  scaleOverrideRef.current = scaleOverride;
  const baseTransformRef = useRef<SplatBaseTransform | null>(null);

  const sparkRenderer = useMemo(() => {
    return new SparkRenderer({ renderer });
  }, [renderer]);

  const splatMesh = useMemo(() => {
    return new SplatMesh({
      url: spzUrl,
      onLoad: (mesh) => {
        try {
          const baseTransform = calculateBaseTransform(mesh);
          baseTransformRef.current = baseTransform;
          applyTransform(
            mesh,
            baseTransform,
            positionOverrideRef.current,
            rotationOverrideRef.current,
            scaleOverrideRef.current
          );
          onReadyChangeRef.current?.(true, spzUrl);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to position world environment.';
          onReadyChangeRef.current?.(false, spzUrl, message);
        }
      },
    });
  }, [spzUrl]);

  useEffect(() => {
    onReadyChangeRef.current?.(false, spzUrl);
    return () => {
      onReadyChangeRef.current?.(false, spzUrl);
    };
  }, [spzUrl]);

  useEffect(() => {
    scene.add(sparkRenderer);
    return () => {
      scene.remove(sparkRenderer);
    };
  }, [scene, sparkRenderer]);

  useEffect(() => {
    const baseTransform = baseTransformRef.current;
    if (!baseTransform) return;
    applyTransform(splatMesh, baseTransform, positionOverride, rotationOverride, scaleOverride);
  }, [positionOverride, rotationOverride, scaleOverride, splatMesh]);

  useEffect(() => {
    return () => {
      try {
        splatMesh.dispose();
      } catch {
        // Best-effort cleanup only.
      }
    };
  }, [splatMesh]);

  return <primitive object={splatMesh} />;
}
