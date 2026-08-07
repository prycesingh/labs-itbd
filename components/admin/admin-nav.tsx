"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { motion } from "motion/react";
import {
  ArrowLeft,
  KeyRound,
  LogOut,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; icon: LucideIcon };

/**
 * Admin panel sidebar — same shell as DashboardNav (shadcn Sidebar primitive,
 * gradient/rounded rail, click-toggle collapse, ITBD-blue active bar + hover
 * nudge), so /admin and /dashboard read as one product.
 */
export function AdminNav({
  user,
  isSuperAdmin,
  mustChangePassword,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
}) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/admin/password", label: "My Password", icon: KeyRound },
    ...(isSuperAdmin
      ? [{ href: "/admin/users", label: "User Management", icon: Users }]
      : []),
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden  rounded-tr-3xl  border-itbd-blue border-t top-30! h-[calc(100svh-7.5rem)]! **:data-[slot=sidebar-inner]:rounded-r-2xl **:data-[slot=sidebar-inner]:bg-[linear-gradient(45deg,transparent_25%,color-mix(in_srgb,var(--itbd-blue)_15%,transparent)_50%,transparent_65%)]"
    >
      <SidebarHeader className="flex-row items-center justify-end">
        <SidebarTrigger />
      </SidebarHeader>

      {mustChangePassword ? (
        <div className="mx-3 mt-1 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground group-data-[collapsible=icon]:hidden">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Change your temporary password to continue.</span>
        </div>
      ) : null}

      <SidebarContent className="no-scrollbar group-data-[collapsible=icon]:overflow-y-auto!">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <NavLinkButton
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={
                      pathname === link.href ||
                      pathname.startsWith(`${link.href}/`)
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavLinkButton
              href="/dashboard"
              label="Back to Dashboard"
              icon={ArrowLeft}
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <motion.div
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <SidebarMenuButton onClick={() => signOut({ callbackUrl: "/" })}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </motion.div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** A nav link with a hover nudge and, when active, a glowing ITBD-blue bar
 *  on the leading edge — matches DashboardNav's active-link treatment. */
function NavLinkButton({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <motion.div
      className="relative"
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 z-10 h-5 w-0.5 -translate-y-1/2 rounded-full bg-itbd-blue shadow-[0_0_8px_var(--itbd-blue)]" />
      ) : null}
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link href={href}>
          <Icon className={active ? "text-itbd-blue" : undefined} />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </motion.div>
  );
}
