import React, { useEffect, useRef } from 'react';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';

/**
 * GridWithNoDepth - A wrapper around the drei Grid component that disables depth writing.
 *
 * Problem: The Grid component writes to the depth buffer, which interferes with the
 * postprocessing Outline effect's depth comparison. This causes selection outlines to
 * incorrectly appear as "hidden" (showing the hiddenEdgeColor) when objects are positioned
 * on certain sides of the grid.
 *
 * Solution: Disable depthWrite on the Grid's shader material so it doesn't affect
 * depth-based post-processing effects. Combined with renderOrder={-1}, this ensures
 * the grid is purely visual and doesn't interfere with object selection outlines.
 */
export interface GridWithNoDepthProps {
  args: [number, number];
  cellSize: number;
  sectionSize: number;
  fadeDistance: number;
  fadeStrength: number;
  sectionColor: string;
  cellColor: string;
  sectionThickness: number;
  cellThickness: number;
  side: THREE.Side;
}

export const GridWithNoDepth: React.FC<GridWithNoDepthProps> = (props) => {
  const gridRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (gridRef.current) {
      const material = gridRef.current.material as THREE.ShaderMaterial;
      material.depthWrite = false;
    }
  }, []);

  // renderOrder={-1} ensures grid renders before scene objects
  return <Grid ref={gridRef} {...props} renderOrder={-1} />;
};

