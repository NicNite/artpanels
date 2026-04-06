"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface PanelViewerProps {
  imageUrl: string;
  widthMm: number;
  heightMm: number;
  thicknessMinMm: number;
  thicknessMaxMm: number;
}

function PanelMesh({
  widthMm,
  heightMm,
  thicknessMinMm,
  thicknessMaxMm,
}: Omit<PanelViewerProps, "imageUrl">) {
  const meshRef = useRef<THREE.Mesh>(null);
  const avgThickness = (thicknessMinMm + thicknessMaxMm) / 2;

  // Scale mm to scene units (1 unit = 10 mm)
  const w = widthMm / 10;
  const h = heightMm / 10;
  const d = avgThickness / 10;

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[w, h, d]} />
      <meshPhysicalMaterial
        color="#e8e0d0"
        transmission={0.6}
        thickness={d}
        roughness={0.15}
        metalness={0}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function PanelViewer({
  imageUrl: _imageUrl,
  widthMm,
  heightMm,
  thicknessMinMm,
  thicknessMaxMm,
}: PanelViewerProps) {
  const maxDim = Math.max(widthMm, heightMm) / 10;
  const cameraDistance = maxDim * 1.5;

  return (
    <div className="w-full aspect-[4/3] rounded-lg border overflow-hidden bg-black">
      <Canvas
        camera={{
          position: [0, 0, cameraDistance],
          fov: 45,
          near: 0.01,
          far: cameraDistance * 10,
        }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Ambient fill */}
        <ambientLight intensity={0.4} color="#ffffff" />

        {/* Key light from front-top */}
        <directionalLight
          position={[maxDim, maxDim * 1.5, maxDim]}
          intensity={1.2}
          color="#fff8f0"
        />

        {/* Backlight simulating window / light table behind the panel */}
        <rectAreaLight
          position={[0, 0, -(thicknessMaxMm / 10) - 0.5]}
          rotation={[0, Math.PI, 0]}
          width={widthMm / 10 + 4}
          height={heightMm / 10 + 4}
          intensity={8}
          color="#d0e8ff"
        />

        <PanelMesh
          widthMm={widthMm}
          heightMm={heightMm}
          thicknessMinMm={thicknessMinMm}
          thicknessMaxMm={thicknessMaxMm}
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={maxDim * 0.5}
          maxDistance={maxDim * 5}
        />
      </Canvas>
    </div>
  );
}
