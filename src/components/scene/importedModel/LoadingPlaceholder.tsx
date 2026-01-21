import React from 'react';

export const LoadingPlaceholder: React.FC = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
  </mesh>
);

