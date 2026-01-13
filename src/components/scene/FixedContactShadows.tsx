/**
 * FixedContactShadows Component
 *
 * A contact shadow implementation that explicitly clears its render target
 * before each render to prevent shadow trail accumulation.
 *
 * This fixes an issue where the EffectComposer could interfere with render target
 * clearing, causing ContactShadows to accumulate frames instead of clearing
 * between renders.
 */

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================================
// Fixed Contact Shadows Component
// ============================================================================

interface FixedContactShadowsProps {
  opacity?: number;
  width?: number;
  height?: number;
  blur?: number;
  far?: number;
  resolution?: number;
  smooth?: boolean;
  color?: string;
  scale?: number | [number, number];
  depthWrite?: boolean;
}

export const FixedContactShadows: React.FC<FixedContactShadowsProps> = ({
  opacity = 0.4,
  width = 1,
  height = 1,
  blur = 1,
  far = 10,
  resolution = 512,
  smooth = true,
  color = '#000000',
  scale = 10,
  depthWrite = false,
}) => {
  const ref = useRef<THREE.Group>(null);
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const shadowCameraRef = useRef<THREE.OrthographicCamera>(null);

  // Calculate dimensions
  const scaledWidth = width * (Array.isArray(scale) ? scale[0] : scale);
  const scaledHeight = height * (Array.isArray(scale) ? scale[1] : scale);

  // Create render targets and materials (memoized)
  const [
    renderTarget,
    renderTargetBlur,
    planeGeometry,
    depthMaterial,
    blurPlane,
    horizontalBlurMaterial,
    verticalBlurMaterial,
  ] = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(resolution, resolution);
    const rtBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    rt.texture.generateMipmaps = rtBlur.texture.generateMipmaps = false;

    const geo = new THREE.PlaneGeometry(scaledWidth, scaledHeight).rotateX(Math.PI / 2);
    const blurMesh = new THREE.Mesh(geo);

    const depthMat = new THREE.MeshDepthMaterial();
    depthMat.depthTest = depthMat.depthWrite = false;
    depthMat.onBeforeCompile = (shader) => {
      shader.uniforms = {
        ...shader.uniforms,
        ucolor: { value: new THREE.Color(color) },
      };
      shader.fragmentShader = shader.fragmentShader.replace(
        `void main() {`,
        `uniform vec3 ucolor;
           void main() {`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );'
      );
    };

    // Horizontal blur shader
    const hBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        h: { value: 1.0 / 256.0 },
      },
      vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
      fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float h;
          varying vec2 vUv;
          void main() {
            vec4 sum = vec4(0.0);
            sum += texture2D(tDiffuse, vec2(vUv.x - 4.0 * h, vUv.y)) * 0.051;
            sum += texture2D(tDiffuse, vec2(vUv.x - 3.0 * h, vUv.y)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x - 2.0 * h, vUv.y)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x - 1.0 * h, vUv.y)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.1633;
            sum += texture2D(tDiffuse, vec2(vUv.x + 1.0 * h, vUv.y)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x + 2.0 * h, vUv.y)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x + 3.0 * h, vUv.y)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x + 4.0 * h, vUv.y)) * 0.051;
            gl_FragColor = sum;
          }
        `,
    });

    // Vertical blur shader
    const vBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        v: { value: 1.0 / 256.0 },
      },
      vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
      fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float v;
          varying vec2 vUv;
          void main() {
            vec4 sum = vec4(0.0);
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0 * v)) * 0.051;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * v)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * v)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * v)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.1633;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * v)) * 0.1531;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * v)) * 0.12245;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * v)) * 0.0918;
            sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0 * v)) * 0.051;
            gl_FragColor = sum;
          }
        `,
    });

    vBlurMat.depthTest = hBlurMat.depthTest = false;

    return [rt, rtBlur, geo, depthMat, blurMesh, hBlurMat, vBlurMat];
  }, [resolution, scaledWidth, scaledHeight, color]);

  // Blur helper function
  const blurShadows = useCallback(
    (blurAmount: number) => {
      if (!shadowCameraRef.current) return;

      blurPlane.visible = true;
      blurPlane.material = horizontalBlurMaterial;
      horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
      horizontalBlurMaterial.uniforms.h.value = (blurAmount * 1) / 256;
      gl.setRenderTarget(renderTargetBlur);
      gl.render(blurPlane, shadowCameraRef.current);

      blurPlane.material = verticalBlurMaterial;
      verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
      verticalBlurMaterial.uniforms.v.value = (blurAmount * 1) / 256;
      gl.setRenderTarget(renderTarget);
      gl.render(blurPlane, shadowCameraRef.current);

      blurPlane.visible = false;
    },
    [gl, renderTarget, renderTargetBlur, blurPlane, horizontalBlurMaterial, verticalBlurMaterial]
  );

  // Render shadows each frame
  useFrame(() => {
    if (!shadowCameraRef.current || !ref.current) return;

    const initialBackground = scene.background;
    const initialOverrideMaterial = scene.overrideMaterial;

    ref.current.visible = false;
    scene.background = null;
    scene.overrideMaterial = depthMaterial;

    // THE FIX: Explicitly clear the render target before rendering
    // This prevents shadow trail accumulation regardless of EffectComposer settings
    gl.setRenderTarget(renderTarget);
    gl.clear(true, true, false); // Clear color and depth, not stencil

    gl.render(scene, shadowCameraRef.current);

    blurShadows(blur);
    if (smooth) blurShadows(blur * 0.4);

    gl.setRenderTarget(null);
    ref.current.visible = true;
    scene.overrideMaterial = initialOverrideMaterial;
    scene.background = initialBackground;
  });

  // Cleanup
  useEffect(() => {
    return () => {
      renderTarget.dispose();
      renderTargetBlur.dispose();
      planeGeometry.dispose();
      depthMaterial.dispose();
      horizontalBlurMaterial.dispose();
      verticalBlurMaterial.dispose();
    };
  }, [
    renderTarget,
    renderTargetBlur,
    planeGeometry,
    depthMaterial,
    horizontalBlurMaterial,
    verticalBlurMaterial,
  ]);

  return (
    // eslint-disable-next-line react/no-unknown-property
    <group rotation-x={Math.PI / 2} position={[0, -0.01, 0]} ref={ref}>
      {/* eslint-disable react/no-unknown-property */}
      <mesh geometry={planeGeometry} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          transparent
          map={renderTarget.texture}
          opacity={opacity}
          depthWrite={depthWrite}
        />
      </mesh>
      {/* eslint-enable react/no-unknown-property */}
      <orthographicCamera
        ref={shadowCameraRef}
        args={[-scaledWidth / 2, scaledWidth / 2, scaledHeight / 2, -scaledHeight / 2, 0, far]}
      />
    </group>
  );
};

// ============================================================================
// Shadow System Debugger
// ============================================================================

/**
 * ContactShadowDebugger - Monitors for shadow trail issues
 * Logs when render target is being cleared and tracks frame consistency
 */
export const ContactShadowDebugger: React.FC = () => {
  const { gl } = useThree();
  const frameCountRef = useRef(0);
  const lastAutoClearRef = useRef<boolean | null>(null);

  useFrame(() => {
    frameCountRef.current++;

    // Log whenever autoClear state changes (this helps detect when EffectComposer modifies it)
    if (lastAutoClearRef.current !== gl.autoClear) {
      console.log('[ContactShadowDebugger] autoClear changed:', {
        previous: lastAutoClearRef.current,
        current: gl.autoClear,
        frame: frameCountRef.current,
      });
      lastAutoClearRef.current = gl.autoClear;
    }

    // Periodic status log every 600 frames (~10 seconds at 60fps)
    if (frameCountRef.current % 600 === 0) {
      console.log('[ContactShadowDebugger] Status:', {
        autoClear: gl.autoClear,
        autoClearColor: gl.autoClearColor,
        autoClearDepth: gl.autoClearDepth,
        frame: frameCountRef.current,
      });
    }
  });

  return null;
};
