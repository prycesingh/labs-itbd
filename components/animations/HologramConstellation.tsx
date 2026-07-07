"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Suspense } from "react";

/**
 * Client wrapper for the div-3 3D hologram.
 *
 * The R3F <Canvas> touches browser/WebGL APIs at import time, so it must never
 * be server-rendered. A Server Component can't pass `ssr: false`, so this client
 * wrapper does the dynamic import; the server page imports THIS component
 * normally.
 *
 * The Suspense/fallback shows the complete composed hub (image 5, which already
 * has the ITBD logo embedded) so the brand mark is visible even before the scene
 * loads or if WebGL is unavailable — content is never gated on the animation.
 */
const HologramScene = dynamic(() => import("./HologramScene"), {
  ssr: false,
  loading: () => <StaticHub />,
});

function StaticHub() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Image
        src="/login-images/5.png"
        alt="IT by Design hologram"
        width={320}
        height={320}
        priority
        className="h-auto w-2/3 max-w-[320px] object-contain drop-shadow-[0_0_40px_rgba(0,173,218,0.35)]"
      />
    </div>
  );
}

export function HologramConstellation() {
  return (
    <div className="relative h-full min-h-0 w-full">
      <Suspense fallback={<StaticHub />}>
        <HologramScene />
      </Suspense>
    </div>
  );
}
