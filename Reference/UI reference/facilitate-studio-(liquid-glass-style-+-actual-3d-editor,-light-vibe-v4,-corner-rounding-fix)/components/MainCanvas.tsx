// Import React to access React.FC namespace
import React, { useState, Suspense, useRef } from 'react';
import { SceneObject, ToolType } from '../types';
import { Canvas } from '@react-three/fiber';
import { 
    OrbitControls, 
    Environment, 
    ContactShadows, 
    Grid,
    PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';

interface SceneContentProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
}

// Correct usage of React.FC requires React to be imported
const IndustrialPrimitive: React.FC<{
    obj: SceneObject;
    isSelected: boolean;
    onSelect: () => void;
}> = ({ obj, isSelected, onSelect }) => {
    const meshRef = useRef<THREE.Group>(null);
    const color = obj.properties.color || '#3b82f6';

    return (
        <group
            ref={meshRef}
            position={[obj.transform.x / 100, obj.transform.y / 100, -obj.transform.z / 100]}
            rotation={[
                THREE.MathUtils.degToRad(obj.transform.rotationX),
                THREE.MathUtils.degToRad(obj.transform.rotationY),
                THREE.MathUtils.degToRad(obj.transform.rotationZ)
            ]}
            scale={[obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
        >
            <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial 
                    color={color}
                    roughness={0.2}
                    metalness={0.1}
                />
            </mesh>

            {isSelected && (
                <mesh scale={[1.1, 1.1, 1.1]}>
                    <boxGeometry args={[1.05, 1.05, 1.05]} />
                    <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
                </mesh>
            )}
        </group>
    );
};

// Correct usage of React.FC requires React to be imported
const SceneContent: React.FC<SceneContentProps> = ({ 
    objects, 
    selectedObjectId, 
    onSelectObject,
    onUpdateObject
}) => {
    
    // Find selected object data
    const selectedObject = objects.find(o => o.id === selectedObjectId);

    return (
        <>
            <ambientLight intensity={0.7} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <spotLight position={[-10, 15, 10]} angle={0.25} penumbra={1} intensity={2} />
            
            <Suspense fallback={null}>
                <Environment preset="city" />
            </Suspense>

            <PerspectiveCamera makeDefault position={[12, 8, 12]} fov={35} />
            
            <group>
                {objects.map(obj => (
                    obj.properties.visible && (
                        <IndustrialPrimitive 
                            key={obj.id} 
                            obj={obj} 
                            isSelected={selectedObjectId === obj.id}
                            onSelect={() => onSelectObject(obj.id)}
                        />
                    )
                ))}
            </group>

            <ContactShadows position={[0, -0.01, 0]} opacity={0.2} scale={20} blur={2.5} far={1} />
            
            <Grid 
                infiniteGrid 
                fadeDistance={40} 
                sectionColor="#94a3b8" 
                cellColor="#cbd5e1" 
                sectionThickness={1.0} 
                cellThickness={0.4}
            />

            <OrbitControls 
                makeDefault 
                enableDamping 
                dampingFactor={0.05} 
                maxPolarAngle={Math.PI / 2.1} 
                minDistance={5}
                maxDistance={50}
            />
        </>
    );
};

interface MainCanvasProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
}

// Correct usage of React.FC requires React to be imported
export const MainCanvas: React.FC<MainCanvasProps> = ({ 
    objects, 
    selectedObjectId, 
    onSelectObject,
    onUpdateObject
}) => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)] z-0"></div>
        
        <div className="w-full h-full relative z-10 cursor-crosshair">
            <Canvas 
                shadows 
                className="w-full h-full" 
                onPointerMissed={() => onSelectObject(null)}
            >
                <SceneContent 
                    objects={objects} 
                    selectedObjectId={selectedObjectId} 
                    onSelectObject={onSelectObject} 
                    onUpdateObject={onUpdateObject}
                />
            </Canvas>
        </div>
    </div>
  );
};