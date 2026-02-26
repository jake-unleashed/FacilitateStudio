import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GROUND_PLANE_EXTENT } from '../../constants';
import { getCachedBackgroundTexture, loadBackgroundTexture } from '../../utils/backgroundTextureCache';

interface PanoramicBackgroundProps {
  imageUrl: string;
  onReadyChange?: (ready: boolean, imageUrl?: string, errorMessage?: string) => void;
}

const SPHERE_RADIUS = GROUND_PLANE_EXTENT;
const SPHERE_WIDTH_SEGMENTS = 64;
const SPHERE_HEIGHT_SEGMENTS = 32;

const GROUND_DISC_RADIUS = SPHERE_RADIUS * 0.85;
const GROUND_DISC_SEGMENTS = 64;
const GROUND_DISC_OPACITY = 0.3;
const GROUND_DISC_COLOR = 0xf1f5f9;

/**
 * Renders a 360 image on an inverted finite sphere with a subtle ground stage
 * disc that anchors 3D objects visually within the panoramic environment.
 *
 * Textures are loaded through a module-level cache so that navigating between
 * Editor / Preview / Published reuses the same GPU texture instantly.
 */
export function PanoramicBackground({ imageUrl, onReadyChange }: PanoramicBackgroundProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(
    () => getCachedBackgroundTexture(imageUrl)
  );
  const sphereRef = useRef<THREE.Mesh>(null);
  const discRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const cachedTexture = getCachedBackgroundTexture(imageUrl);
    if (cachedTexture) {
      setTexture(cachedTexture);
      onReadyChange?.(true, imageUrl);
      return;
    }

    let cancelled = false;
    onReadyChange?.(false, imageUrl);

    loadBackgroundTexture(imageUrl)
      .then((loaded) => {
        if (cancelled) return;
        setTexture(loaded);
        onReadyChange?.(true, imageUrl);
      })
      .catch(() => {
        if (cancelled) return;
        // We treat failed loads as "done" so the app remains usable, but surface
        // an error message upstream so the UI can inform the user.
        onReadyChange?.(true, imageUrl, 'Failed to load the 360 background image. Please try replacing it.');
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, onReadyChange]);

  useEffect(() => {
    if (sphereRef.current) sphereRef.current.raycast = () => undefined;
    if (discRef.current) discRef.current.raycast = () => undefined;
  }, [texture]);

  const sphereMaterial = useMemo(() => {
    if (!texture) return null;
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    });
  }, [texture]);

  const discMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: GROUND_DISC_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: GROUND_DISC_OPACITY,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDiscRadius = { value: GROUND_DISC_RADIUS };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vLocalPos;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvLocalPos = position.xz;'
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying vec2 vLocalPos;
uniform float uDiscRadius;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
float dist = length(vLocalPos) / uDiscRadius;
float edgeFade = 1.0 - smoothstep(0.5, 1.0, dist);
gl_FragColor.a *= edgeFade;`
      );
    };

    return mat;
  }, []);

  const discGeometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(GROUND_DISC_RADIUS, GROUND_DISC_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      sphereMaterial?.dispose();
      discMaterial.dispose();
      discGeometry.dispose();
    };
  }, [sphereMaterial, discMaterial, discGeometry]);

  if (!texture || !sphereMaterial) return null;

  return (
    <group>
      {/* eslint-disable react/no-unknown-property */}
      <mesh ref={sphereRef} renderOrder={-2} material={sphereMaterial}>
        <sphereGeometry args={[SPHERE_RADIUS, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS]} />
      </mesh>
      <mesh
        ref={discRef}
        renderOrder={-1.5}
        position={[0, 0.005, 0]}
        geometry={discGeometry}
        material={discMaterial}
      />
      {/* eslint-enable react/no-unknown-property */}
    </group>
  );
}
