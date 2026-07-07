"use client";

import { Float, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Div-3 hero: a 3D ITBD hologram constellation (react-three-fiber).
 *
 * Composition (matches the marketing mockup's center object):
 * - HUB at center = image 6 (glass case) + image 7 (ITBD cube logo) composited;
 *   the logo rotates/bobs independently inside the case. The logo is mandatory
 *   and always visible.
 * - Four labelled tiles (images 1–4: SIMULATORS, COMMUNICATION LAB, PRACTICE,
 *   IMPROVE) sit close around the hub (like the mockup), large and glowing.
 *
 * Motion (single useFrame timeline; entrance DELAYED by `startDelay` so it plays
 * AFTER the page-loader reveal — otherwise the spread runs hidden and you only
 * see the end state):
 *   0.0–0.5s  hub scales in
 *   then      tiles spread OUT from behind the hub ONE BY ONE (clear stagger)
 *   then      perpetual gentle float + clamped pointer parallax
 *
 * `prefers-reduced-motion` → final resting state, no spread/float.
 */

const TILE = {
  urls: [
    "/login-images/1.png", // SIMULATORS
    "/login-images/2.png", // COMMUNICATION LAB
    "/login-images/3.png", // PRACTICE
    "/login-images/4.png", // IMPROVE
  ],
  // Resting positions — close to the hub (tiles nearly touch it, as in the
  // mockup) and larger. Order = spread reveal order (TL → TR → BL → BR).
  targets: [
    [-1.7, 1.15, 0.15], // top-left
    [1.7, 1.15, -0.15], // top-right
    [-1.7, -1.15, -0.15], // bottom-left
    [1.7, -1.15, 0.15], // bottom-right
  ] as [number, number, number][],
  size: 1.7, // corner tiles — smaller than the hub
};

const HUB_CASE = "/login-images/6.png";
const HUB_LOGO = "/login-images/7.png";

/** Wait this long (s) before the entrance plays — clears the page loader. */
const DEFAULT_START_DELAY = 5.2;
/** One-by-one spread: gap between each tile starting, and each tile's travel. */
const TILE_STAGGER = 0.28;
const TILE_TRAVEL = 0.7;

function Scene({
  reduce,
  startDelay,
}: {
  reduce: boolean;
  startDelay: number;
}) {
  const group = useRef<THREE.Group>(null);
  const hub = useRef<THREE.Group>(null);
  const logo = useRef<THREE.Mesh>(null);
  const tiles = useRef<(THREE.Group | null)[]>([]);
  const start = useRef<number | null>(null);

  const { pointer } = useThree();

  const [t1, t2, t3, t4, caseTex, logoTex] = useTexture([
    ...TILE.urls,
    HUB_CASE,
    HUB_LOGO,
  ]);
  const tileTex = [t1, t2, t3, t4];

  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    if (start.current === null) start.current = now;
    const t = reduce ? 999 : Math.max(0, now - start.current - startDelay);

    // Hub scale-in.
    if (hub.current) {
      hub.current.scale.setScalar(reduce ? 1 : easeOutBack(clamp01(t / 0.5)));
    }
    if (logo.current && !reduce) {
      logo.current.rotation.y = Math.sin(now * 0.6) * 0.35;
      logo.current.position.y = Math.sin(now * 1.1) * 0.08;
    }

    // Tiles spread from center → resting positions, ONE BY ONE (clear stagger).
    tiles.current.forEach((tile, i) => {
      if (!tile) return;
      const tgt = TILE.targets[i];
      if (reduce) {
        tile.position.set(tgt[0], tgt[1], tgt[2]);
        return;
      }
      const delay = 0.5 + i * TILE_STAGGER; // after the hub, staggered
      const e = easeOutBack(clamp01((t - delay) / TILE_TRAVEL));
      tile.position.set(tgt[0] * e, tgt[1] * e, tgt[2] * e);
      tile.scale.setScalar(0.3 + 0.7 * clamp01(e));
    });

    // Clamped pointer parallax — small enough tiles never leave the frame.
    if (group.current && !reduce) {
      const tx = pointer.y * 0.07;
      const ty = pointer.x * 0.1;
      group.current.rotation.x += (tx - group.current.rotation.x) * 0.05;
      group.current.rotation.y += (ty - group.current.rotation.y) * 0.05;
    }
  });

  return (
    <group ref={group}>
      {/* HUB: case + logo floating together */}
      <Float
        enabled={!reduce}
        speed={1.2}
        rotationIntensity={0.15}
        floatIntensity={0.4}
      >
        <group ref={hub}>
          {/* Hub is the largest element — clearly bigger than the corner tiles */}
          <mesh position={[0, 0, -0.15]}>
            <planeGeometry args={[3.4, 3.4]} />
            <meshBasicMaterial
              map={caseTex}
              transparent
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={logo} position={[0, 0, 0.15]}>
            <planeGeometry args={[2.4, 2.4]} />
            <meshBasicMaterial
              map={logoTex}
              transparent
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      </Float>

      {/* Four labelled tiles floating close around the hub */}
      {TILE.targets.map((_, i) => (
        <Float
          key={i}
          enabled={!reduce}
          speed={1.4 + i * 0.2}
          rotationIntensity={0.16}
          floatIntensity={0.45}
        >
          <group ref={(g) => void (tiles.current[i] = g)}>
            <mesh>
              <planeGeometry args={[TILE.size, TILE.size]} />
              <meshBasicMaterial
                map={tileTex[i]}
                transparent
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          </group>
        </Float>
      ))}
    </group>
  );
}

export default function HologramScene({
  startDelay = DEFAULT_START_DELAY,
}: {
  startDelay?: number;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 2]}
      // Explicit debounce: 0 means every resize (including a cross-monitor
      // drag that changes devicePixelRatio) re-measures the container
      // immediately instead of relying on a cached size.
      resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      camera={{ position: [0, 0, 6.2], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Scene reduce={reduce} startDelay={reduce ? 0 : startDelay} />
    </Canvas>
  );
}

/* ---- easing helpers ---- */
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function easeOutBack(x: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
