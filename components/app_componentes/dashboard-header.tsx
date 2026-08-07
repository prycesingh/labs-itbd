import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";
import Link from "next/link";

/**
 * Global dashboard header — ITBD wordmark on the left, signed-in user greeting
 * + avatar on the right. Renders once at the layout level; every dashboard
 * page inherits it unchanged.
 */
export function DashboardHeader({
  user,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const displayName = user.name ?? user.email ?? "";

  return (
    <header
      className="flex h-26 shrink-0 items-center justify-between border-b px-4"
      style={{
        borderImage:
          "linear-gradient(to right, transparent, var(--itbd-blue), transparent) 1",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Off-canvas sidebar has no way to reopen itself once collapsed on
            mobile — the sidebar's own trigger lives inside the sidebar, which
            is exactly what's hidden. This mirrors it in the always-visible
            header, shown only where the sidebar goes off-canvas. Styled as
            its own bordered/blue-accent tile (matching the app's icon-button
            language) instead of the bare default ghost button, which read as
            an unstyled stray mark next to the logo. */}
        <SidebarTrigger className="size-9 rounded-lg border border-white/10 text-white/70 hover:bg-itbd-blue/10 hover:text-itbd-blue md:hidden" />
        <Link href="/dashboard" className="flex items-center" title="Labs ITBD">
          <Image
            src="/itbd_logo_img.png"
            alt="Labs ITBD"
            width={911}
            height={344}
            priority
            className="h-22 w-auto max-w-60 object-contain object-left"
          />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <p className="text-sm font-semibold">Hello, {displayName}</p>
          <p className="text-xs text-itbd-blue">Welcome back!</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-itbd-blue text-xs font-semibold uppercase text-primary-foreground">
          {(user.name ?? user.email ?? "?").slice(0, 2)}
        </span>
      </div>
    </header>
  );
}
