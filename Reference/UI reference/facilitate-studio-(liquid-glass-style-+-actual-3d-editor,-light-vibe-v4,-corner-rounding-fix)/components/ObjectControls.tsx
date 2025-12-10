import React, { useState, useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneObject } from '../types';
import { ArrowUpDown, Move } from 'lucide-react';

interface ObjectControlsProps {
  object: SceneObject;
  onUpdate: (updated: SceneObject) => void;
}

export const ObjectControls: React.FC<ObjectControlsProps> = ({ object, onUpdate }) => {
  const { camera, gl } = useThree();
  const [activeAxis, setActiveAxis] = useState<'y' | 'xz' | null>(null);

  // Drag state ref to prevent closure staleness and re-render loops during high-frequency events
  const dragRef = useRef<{
    isDragging: boolean;
    pointerId: number;
    axis: 'y' | 'xz' | null;
    plane: THREE.Plane;
    startIntersection: THREE.Vector3;
    startObjectPos: THREE.Vector3;
  }>({
    isDragging: false,
    pointerId: -1,
    axis: null,
    plane: new THREE.Plane(),
    startIntersection: new THREE.Vector3(),
    startObjectPos: new THREE.Vector3()
  });

  // Calculate current 3D position in Three.js space based on object properties
  const position = useMemo(() => new THREE.Vector3(
    object.transform.x / 100,
    object.transform.y / 100,
    -object.transform.z / 100
  ), [object.transform.x, object.transform.y, object.transform.z]);

  // Helper to raycast from mouse position to a specific plane
  const getRayIntersection = (clientX: number, clientY: number, plane: THREE.Plane) => {
    if (!gl.domElement) return null;
    
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, camera);
    
    const target = new THREE.Vector3();
    const intersect = raycaster.ray.intersectPlane(plane, target);
    return intersect; // Returns Vector3 or null
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, axis: 'y' | 'xz') => {
    e.stopPropagation();
    e.preventDefault();
    
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    // 1. Determine the Drag Plane
    const plane = new THREE.Plane();
    const worldPos = position.clone();

    if (axis === 'xz') {
      // Floor plane
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldPos);
    } else {
      // Billboard plane (vertical, facing camera)
      const normal = new THREE.Vector3();
      camera.getWorldDirection(normal);
      normal.y = 0; // Lock normal to horizon so plane is vertical
      normal.normalize();
      plane.setFromNormalAndCoplanarPoint(normal, worldPos);
    }

    // 2. Find initial intersection point
    const intersection = getRayIntersection(e.clientX, e.clientY, plane);
    
    if (intersection) {
      dragRef.current = {
        isDragging: true,
        pointerId: e.pointerId,
        axis: axis,
        plane: plane,
        startIntersection: intersection.clone(),
        startObjectPos: worldPos.clone()
      };
      setActiveAxis(axis);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { isDragging, pointerId, axis, plane, startIntersection, startObjectPos } = dragRef.current;

    // Guard clauses
    if (!isDragging || e.pointerId !== pointerId || !axis) return;
    
    e.stopPropagation();
    e.preventDefault();

    // 1. Get new intersection on the same plane
    const currentIntersection = getRayIntersection(e.clientX, e.clientY, plane);
    
    if (currentIntersection) {
      // 2. Calculate delta
      const delta = new THREE.Vector3().subVectors(currentIntersection, startIntersection);
      const newPos = new THREE.Vector3().addVectors(startObjectPos, delta);

      // 3. Convert back to App Coordinate System & Apply Constraints
      const updatedTransform = { ...object.transform };

      if (axis === 'xz') {
        updatedTransform.x = Math.round(newPos.x * 100);
        // Invert Z because App uses positive Z coming towards camera, Three uses negative
        updatedTransform.z = Math.round(-newPos.z * 100); 
      } else if (axis === 'y') {
        updatedTransform.y = Math.max(0, Math.round(newPos.y * 100)); // Floor constraint
      }

      onUpdate({
        ...object,
        transform: updatedTransform
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === e.pointerId) {
      e.stopPropagation();
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      dragRef.current.isDragging = false;
      dragRef.current.pointerId = -1;
      dragRef.current.axis = null;
      
      setActiveAxis(null);
    }
  };

  return (
    <Html position={[position.x, position.y, position.z]} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
      <div className="flex flex-col gap-4 pl-14 -translate-y-1/2 pointer-events-auto select-none">
        
        {/* Visual Connector Lines */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-14 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-white/60 pointer-events-none" />
        <div className="absolute left-14 top-8 bottom-8 w-px bg-white/20 rounded-full pointer-events-none" />

        {/* Y-Axis Handle (Elevation) - Tier 2 Rounding (20px) */}
        <div 
          className="relative group cursor-grab active:cursor-grabbing transform transition-transform hover:scale-105"
          onPointerDown={(e) => handlePointerDown(e, 'y')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className={`
             flex items-center justify-center w-11 h-11 rounded-[20px]
             backdrop-blur-xl border 
             shadow-lg hover:shadow-xl
             transition-all duration-300
             ${activeAxis === 'y' 
               ? 'bg-blue-600 border-blue-400 text-white ring-4 ring-blue-500/20' 
               : 'bg-white/70 border-white/60 text-slate-600 hover:bg-white'
             }
          `}>
             <ArrowUpDown size={20} strokeWidth={2.5} className={activeAxis === 'y' ? 'text-white' : 'text-blue-600'} />
          </div>
          
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800/90 backdrop-blur text-white text-[10px] font-bold rounded-[20px] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap pointer-events-none shadow-xl">
            Elevation
          </div>
        </div>

        {/* XZ-Axis Handle (Position) - Tier 2 Rounding (20px) */}
        <div 
          className="relative group cursor-grab active:cursor-grabbing ml-6 transform transition-transform hover:scale-105"
          onPointerDown={(e) => handlePointerDown(e, 'xz')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
           {/* Connector */}
           <div className="absolute right-full top-1/2 w-6 h-px bg-white/20 -translate-x-0 pointer-events-none" />

           <div className={`
             flex items-center justify-center w-11 h-11 rounded-[20px]
             backdrop-blur-xl border
             shadow-lg hover:shadow-xl
             transition-all duration-300
             ${activeAxis === 'xz' 
               ? 'bg-blue-600 border-blue-400 text-white ring-4 ring-blue-500/20' 
               : 'bg-white/70 border-white/60 text-slate-600 hover:bg-white'
             }
          `}>
             <Move size={20} strokeWidth={2.5} className={activeAxis === 'xz' ? 'text-white' : 'text-blue-600'} />
          </div>

           <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800/90 backdrop-blur text-white text-[10px] font-bold rounded-[20px] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap pointer-events-none shadow-xl">
            Move Position
          </div>
        </div>

      </div>
    </Html>
  );
};