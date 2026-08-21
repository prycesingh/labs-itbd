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
      className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-3 sm:h-20 sm:px-4 lg:h-26"
      style={{
        borderImage:
          "linear-gradient(to right, transparent, var(--itbd-blue), transparent) 1",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* Off-canvas sidebar has no way to reopen itself once collapsed on
            mobile — the sidebar's own trigger lives inside the sidebar, which
            is exactly what's hidden. This mirrors it in the always-visible
            header, shown only where the sidebar goes off-canvas. Styled as
            its own bordered/blue-accent tile (matching the app's icon-button
            language) instead of the bare default ghost button, which read as
            an unstyled stray mark next to the logo. */}
        <SidebarTrigger className="size-9 shrink-0 rounded-lg border border-white/10 text-white/70 hover:bg-itbd-blue/10 hover:text-itbd-blue md:hidden" />
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center"
          title="Labs ITBD"
        >
          <Image
            src="/itbd_logo_img.png"
            alt="Labs ITBD"
            width={911}
            height={344}
            priority
            className="h-12 w-auto max-w-40 object-contain object-left sm:h-16 sm:max-w-48 lg:h-22 lg:max-w-60"
          />
        </Link>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <div className="min-w-0 text-right leading-tight">
          <p className="truncate text-xs font-semibold sm:text-sm">
            Hello, {displayName}
          </p>
          <p className="hidden text-xs text-itbd-blue sm:block">
            Welcome back!
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-itbd-blue text-xs font-semibold uppercase text-primary-foreground sm:h-9 sm:w-9">
          {(user.name ?? user.email ?? "?").slice(0, 2)}
        </span>
      </div>
    </header>
  );
}
