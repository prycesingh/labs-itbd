"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Mounted once in the dashboard/admin layouts. Logs the current route to the
 * admin activity log whenever the pathname changes (including the initial
 * mount). Runs client-side rather than in proxy.ts — mysql2's TCP
 * connections are unreliable inside Next's proxy execution context, so the
 * actual write happens via a normal API route instead (see
 * app/api/page-visits/route.ts). Renders nothing.
 */
export function PageVisitTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastLoggedPath.current === pathname) return;
    lastLoggedPath.current = pathname;

    fetch("/api/page-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Best-effort; a missed log entry is not worth surfacing to the user.
    });
  }, [pathname]);

  return null;
}
