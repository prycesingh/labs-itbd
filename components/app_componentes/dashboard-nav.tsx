"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LAB_CATALOG,
  resolveBreadcrumbTrail,
  SECTIONS,
  type NavSection,
} from "@/lib/dashboard-nav-data";
import { isAdminRole, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Dashboard sidebar — 3 flat top-level items (Lab Catalog, Communication Lab,
 * Technical Lab). Communication Lab and Technical Lab open a dropdown flyout
 * of their sub-links on click (shadcn sidebar-06 pattern) instead of a nested
 * always-expanded menu, keeping the rail short. Built on the shadcn Sidebar
 * primitive (click-toggle collapse/expand, mobile Sheet, cookie-persisted
 * state). Role-gated: admin-only sub-links and the Admin Panel are hidden
 * from non-admins.
 */
export function DashboardNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const pathname = usePathname();
  const isAdmin = isAdminRole((user.role ?? null) as Role | null);
  const activeSectionKey =
    resolveBreadcrumbTrail(pathname)?.section?.key ?? null;

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        // Desktop container: fixed position under the header, rounded top-right
        // corner, top border, diagonal blue-tinted gradient wash on its inner slot.
        "md:overflow-hidden md:rounded-tr-3xl md:border-itbd-blue md:border-t md:top-30! md:h-[calc(100svh-7.5rem)]!",
        "**:data-[slot=sidebar-inner]:rounded-r-2xl **:data-[slot=sidebar-inner]:bg-[linear-gradient(45deg,transparent_25%,color-mix(in_srgb,var(--itbd-blue)_15%,transparent)_50%,transparent_65%)]",
        // Mobile off-canvas sheet has no "sidebar-inner" slot to target — it IS
        // the SheetContent root, and it runs full viewport height (no single
        // top edge to border/round) — so only the gradient wash carries over,
        // applied directly to the sheet's own background.
        "bg-[linear-gradient(45deg,transparent_25%,color-mix(in_srgb,var(--itbd-blue)_15%,transparent)_50%,transparent_65%)]",
      )}
    >
      <SidebarHeader className="flex-row items-center justify-end">
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="no-scrollbar group-data-[collapsible=icon]:overflow-y-auto!">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NavLinkButton
                  href={LAB_CATALOG.href}
                  label={LAB_CATALOG.label}
                  icon={LAB_CATALOG.icon}
                  active={pathname === LAB_CATALOG.href}
                />
              </SidebarMenuItem>

              {SECTIONS.map((section) => (
                <NavSectionMenuItem
                  key={section.key}
                  section={section}
                  pathname={pathname}
                  isAdmin={isAdmin}
                  active={section.key === activeSectionKey}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {isAdmin ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <NavLinkButton
                href="/admin"
                label="Admin Panel"
                icon={ShieldCheck}
                active={pathname.startsWith("/admin")}
                emphasize
              />
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
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

/** A top-level section item (Communication Lab / Technical Lab) — clicking it
 *  opens a dropdown flyout listing its sub-links, grouped by subgroup when a
 *  section has more than one (e.g. Interview / Email Assessments). Admin-only
 *  links are filtered out for non-admins. */
function NavSectionMenuItem({
  section,
  pathname,
  isAdmin,
  active,
}: {
  section: NavSection;
  pathname: string;
  isAdmin: boolean;
  active: boolean;
}) {
  const { isMobile } = useSidebar();

  const subgroups = section.subgroups
    .map((sg) => ({
      ...sg,
      links: sg.links.filter((l) => (l.adminOnly ? isAdmin : true)),
    }))
    .filter((sg) => sg.links.length > 0);

  if (subgroups.length === 0) return null;

  const showSubgroupLabels = subgroups.length > 1;

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <motion.div
          className="relative"
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {active ? (
            <span className="absolute left-0 top-1/2 z-10 h-5 w-0.5 -translate-y-1/2 rounded-full bg-itbd-blue shadow-[0_0_8px_var(--itbd-blue)]" />
          ) : null}
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={active}
              tooltip={section.label}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <section.icon className={active ? "text-itbd-blue" : undefined} />
              <span>{section.label}</span>
              <ChevronRight className="ml-auto h-4 w-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
        </motion.div>
        <DropdownMenuContent
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
          sideOffset={12}
          className="itbd-glow-border relative min-w-60 overflow-hidden rounded-xl border-white/10 bg-black/90 p-1.5 backdrop-blur-xl"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <DropdownMenuLabel className="flex items-center gap-2 px-2 pt-1 pb-2 text-xs font-semibold tracking-widest text-white/40 uppercase">
            <section.icon className="h-3.5 w-3.5 text-itbd-blue" />
            {section.label}
          </DropdownMenuLabel>
          {subgroups.map((sg, i) => (
            <DropdownMenuGroup key={sg.label}>
              {i > 0 ? <DropdownMenuSeparator className="my-1.5 bg-white/10" /> : null}
              {showSubgroupLabels ? (
                <DropdownMenuLabel className="px-2 pt-1 text-[10px] font-semibold tracking-widest text-white/35 uppercase">
                  {sg.label}
                </DropdownMenuLabel>
              ) : null}
              {sg.links.map((link) => {
                const linkActive = pathname === link.href;
                return (
                  <DropdownMenuItem key={link.href} asChild className="p-0 focus:bg-transparent">
                    <Link
                      href={link.href}
                      data-active={linkActive}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white/70 transition-colors",
                        "hover:bg-itbd-blue/10 hover:text-white",
                        linkActive && "bg-itbd-blue/10 font-medium text-itbd-blue",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/50 transition-colors",
                          "group-hover:bg-itbd-blue/15 group-hover:text-itbd-blue",
                          linkActive && "bg-itbd-blue/15 text-itbd-blue",
                        )}
                      >
                        <link.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1">{link.label}</span>
                      {linkActive ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-itbd-blue shadow-[0_0_6px_var(--itbd-blue)]" />
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </SidebarMenuItem>
    </DropdownMenu>
  );
}

/** A nav link with a hover nudge and, when active, a glowing ITBD-blue bar
 *  on the leading edge — mirrors the accent treatment used elsewhere in the
 *  app for the active route. */
function NavLinkButton({
  href,
  label,
  icon: Icon,
  active,
  emphasize,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  emphasize?: boolean;
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
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className={emphasize && !active ? "text-primary" : undefined}
      >
        <Link href={href}>
          <Icon
            className={active || emphasize ? "text-itbd-blue" : undefined}
          />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </motion.div>
  );
}
