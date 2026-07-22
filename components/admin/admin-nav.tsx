"use client";

import { cn } from "@/lib/utils";
import { KeyRound, ShieldAlert, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; icon: React.ReactNode };

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
    {
      href: "/admin/password",
      label: "My Password",
      icon: <KeyRound className="h-4 w-4" />,
    },
    ...(isSuperAdmin
      ? [
          {
            href: "/admin/users",
            label: "User Management",
            icon: <Users className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b p-4">
        <Link href="/admin" className="text-lg font-semibold text-primary">
          Admin Panel
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {user.name ?? user.email}
        </p>
        {user.role ? (
          <p className="text-[10px] uppercase text-muted-foreground">
            {user.role}
          </p>
        ) : null}
      </div>

      {mustChangePassword ? (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Change your temporary password to continue.</span>
        </div>
      ) : null}

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {links.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/dashboard"
          className="mb-1 block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          ← Back to Dashboard
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
