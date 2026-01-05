/**
 * BoundingBox Component
 * 
 * Premium bounding box selection indicator with clean edges and corner spheres.
 * Provides elegant visual feedback for selected 3D models.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BoundingBoxProps {
  /** The model object to create bounding box for */
  model: THREE.Object3D;
  /** Bounding box color (default: #3b82f6) */
  color?: string;
  /** Whether the bounding box is visible */
  visible?: boolean;
  /** Enable pulsing animation */
  animated?: boolean;
}

/**
 * Create edge geometry for a bounding box
 */
function createEdgeGeometry(box: THREE.Box3): THREE.BufferGeometry {
  const min = box.min;
  const max = box.max;
  
  // 8 corners of the box
  const corners = [
    new THREE.Vector3(min.x, min.y, min.z), // 0: bottom-left-back
    new THREE.Vector3(max.x, min.y, min.z), // 1: bottom-right-back
    new THREE.Vector3(max.x, min.y, max.z), // 2: bottom-right-front
    new THREE.Vector3(min.x, min.y, max.z), // 3: bottom-left-front
    new THREE.Vector3(min.x, max.y, min.z), // 4: top-left-back
    new THREE.Vector3(max.x, max.y, min.z), // 5: top-right-back
    new THREE.Vector3(max.x, max.y, max.z), // 6: top-right-front
    new THREE.Vector3(min.x, max.y, max.z), // 7: top-left-front
  ];
  
  // 12 edges: 4 vertical, 4 bottom horizontal, 4 top horizontal
  const edges = [
    // Bottom face edges
    [corners[0], corners[1]], // back-bottom
    [corners[1], corners[2]], // right-bottom
    [corners[2], corners[3]], // front-bottom
    [corners[3], corners[0]], // left-bottom
    // Top face edges
    [corners[4], corners[5]], // back-top
    [corners[5], corners[6]], // right-top
    [corners[6], corners[7]], // front-top
    [corners[7], corners[4]], // left-top
    // Vertical edges
    [corners[0], corners[4]], // left-back
    [corners[1], corners[5]], // right-back
    [corners[2], corners[6]], // right-front
    [corners[3], corners[7]], // left-front
  ];
  
  // Create geometry with all edge vertices
  const positions = new Float32Array(edges.length * 6); // 2 vertices per edge, 3 components per vertex
  let offset = 0;
  
  edges.forEach((edge) => {
    positions[offset++] = edge[0].x;
    positions[offset++] = edge[0].y;
    positions[offset++] = edge[0].z;
    positions[offset++] = edge[1].x;
    positions[offset++] = edge[1].y;
    positions[offset++] = edge[1].z;
  });
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  return geometry;
}

export const BoundingBox: React.FC<BoundingBoxProps> = ({
  model,
  color = '#3b82f6',
  visible = true,
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(visible ? 0.9 : 0);
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const cornerMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  
  // Calculate bounding box from model in LOCAL space
  // Since model and bounding box are siblings in the same group, we calculate in model's local space
  // We traverse all meshes and transform their geometry bounding boxes by their local matrices
  const boundingBoxData = useMemo(() => {
    if (!model) return null;
    
    // Calculate bounding box by traversing all meshes
    // This accounts for all internal transforms within the model hierarchy
    const box = new THREE.Box3();
    
    // Traverse model and calculate bounding box from each mesh
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geometry = child.geometry;
        
        // Ensure geometry has bounding box
        if (!geometry.boundingBox) {
          geometry.computeBoundingBox();
        }
        
        if (geometry.boundingBox) {
          const geomBox = geometry.boundingBox;
          
          // Get 8 corners of geometry bounding box
          const corners = [
            new THREE.Vector3(geomBox.min.x, geomBox.min.y, geomBox.min.z),
            new THREE.Vector3(geomBox.max.x, geomBox.min.y, geomBox.min.z),
            new THREE.Vector3(geomBox.max.x, geomBox.min.y, geomBox.max.z),
            new THREE.Vector3(geomBox.min.x, geomBox.min.y, geomBox.max.z),
            new THREE.Vector3(geomBox.min.x, geomBox.max.y, geomBox.min.z),
            new THREE.Vector3(geomBox.max.x, geomBox.max.y, geomBox.min.z),
            new THREE.Vector3(geomBox.max.x, geomBox.max.y, geomBox.max.z),
            new THREE.Vector3(geomBox.min.x, geomBox.max.y, geomBox.max.z),
          ];
          
          // Update child's matrix to get its local transform
          if (child.matrixAutoUpdate) {
            child.updateMatrix();
          }
          
          // Transform each corner by the mesh's local matrix
          // This transforms from geometry space to model's local space
          corners.forEach((corner) => {
            corner.applyMatrix4(child.matrix);
            box.expandByPoint(corner);
          });
        }
      }
    });
    
    // Also account for the model's own transform if it has one
    // The model object itself might have position/rotation/scale
    if (model.position.lengthSq() > 0 || 
        model.rotation.x !== 0 || model.rotation.y !== 0 || model.rotation.z !== 0 ||
        model.scale.x !== 1 || model.scale.y !== 1 || model.scale.z !== 1) {
      // Transform the bounding box by the model's own matrix
      model.updateMatrix();
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      ];
      
      const transformedBox = new THREE.Box3();
      corners.forEach((corner) => {
        corner.applyMatrix4(model.matrix);
        transformedBox.expandByPoint(corner);
      });
      box.copy(transformedBox);
    }
    
    // Fallback: use setFromObject if box is empty
    if (box.isEmpty()) {
      // Create a clone with reset transforms to get local bounding box
      const modelClone = model.clone();
      modelClone.position.set(0, 0, 0);
      modelClone.rotation.set(0, 0, 0);
      modelClone.scale.set(1, 1, 1);
      modelClone.updateMatrixWorld(true);
      box.setFromObject(modelClone);
    }
    
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    
    // Handle zero-size models
    if (size.x === 0 && size.y === 0 && size.z === 0) {
      return null;
    }
    
    return { box, size, center };
  }, [model]);
  
  // Create edge geometry
  const edgeGeometry = useMemo(() => {
    if (!boundingBoxData) return null;
    return createEdgeGeometry(boundingBoxData.box);
  }, [boundingBoxData]);
  
  // Calculate corner sphere size (adaptive based on model size)
  const cornerSize = useMemo(() => {
    if (!boundingBoxData) return 0.1;
    const minDim = Math.min(boundingBoxData.size.x, boundingBoxData.size.y, boundingBoxData.size.z);
    const size = minDim * 0.02; // 2% of smallest dimension
    return Math.max(0.05, Math.min(0.2, size)); // Clamp between 0.05 and 0.2
  }, [boundingBoxData]);
  
  // Create edge material
  const edgeMaterial = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacityRef.current,
      linewidth: 2, // Note: linewidth has limited browser support
      depthWrite: false,
      depthTest: true,
    });
    edgeMaterialRef.current = material;
    return material;
  }, [color]);
  
  // Create corner material
  const cornerMaterial = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacityRef.current,
      depthWrite: false,
      depthTest: true,
    });
    cornerMaterialRef.current = material;
    return material;
  }, [color]);
  
  // Create corner positions
  const cornerPositions = useMemo(() => {
    if (!boundingBoxData) return [];
    
    const { box } = boundingBoxData;
    const min = box.min;
    const max = box.max;
    
    // 8 corners
    return [
      new THREE.Vector3(min.x, min.y, min.z), // 0: bottom-left-back
      new THREE.Vector3(max.x, min.y, min.z), // 1: bottom-right-back
      new THREE.Vector3(max.x, min.y, max.z), // 2: bottom-right-front
      new THREE.Vector3(min.x, min.y, max.z), // 3: bottom-left-front
      new THREE.Vector3(min.x, max.y, min.z), // 4: top-left-back
      new THREE.Vector3(max.x, max.y, min.z), // 5: top-right-back
      new THREE.Vector3(max.x, max.y, max.z), // 6: top-right-front
      new THREE.Vector3(min.x, max.y, max.z), // 7: top-left-front
    ];
  }, [boundingBoxData]);
  
  // Update materials when color changes
  useEffect(() => {
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.color.set(color);
    }
    if (cornerMaterialRef.current) {
      cornerMaterialRef.current.color.set(color);
    }
  }, [color]);
  
  // Animate fade-in/fade-out and optional pulse
  useFrame((state) => {
    if (!groupRef.current || !boundingBoxData) return;
    
    // Fade in/out animation
    if (visible) {
      if (opacityRef.current < 0.9) {
        opacityRef.current = Math.min(0.9, opacityRef.current + 0.1);
      }
    } else {
      opacityRef.current = Math.max(0, opacityRef.current - 0.15);
    }
    
    // Update material opacity
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity = opacityRef.current;
    }
    if (cornerMaterialRef.current) {
      cornerMaterialRef.current.opacity = opacityRef.current;
    }
    
    // Optional pulse animation
    if (animated && visible && opacityRef.current > 0) {
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 2) * 0.05; // 5% pulse
      groupRef.current.scale.setScalar(pulse);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1.0);
    }
  });
  
  // Shared sphere geometry for corners (created once, reused)
  const sphereGeometry = useMemo(() => {
    return new THREE.SphereGeometry(cornerSize, 8, 8);
  }, [cornerSize]);
  
  // Don't render if not visible and fully faded out, or if no bounding box data
  if ((!visible && opacityRef.current <= 0) || !boundingBoxData || !edgeGeometry) {
    return null;
  }
  
  // Disable raycasting for the entire bounding box group
  // This ensures it doesn't intercept pointer events
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        child.raycast = () => {}; // Disable raycasting for all children
      });
    }
  }, []);
  
  return (
    <group ref={groupRef} renderOrder={999}>
      {/* Edge lines - non-interactive */}
      <lineSegments geometry={edgeGeometry} material={edgeMaterial} />
      
      {/* Corner spheres - non-interactive */}
      {cornerPositions.map((position, index) => (
        <mesh
          key={index}
          geometry={sphereGeometry}
          material={cornerMaterial}
          position={position}
        />
      ))}
    </group>
  );
};

