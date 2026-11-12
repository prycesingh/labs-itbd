"use client";

import {
  ColumnHeader,
  type FilterOption,
  type SortDir,
} from "@/components/admin/column-header";
import DefaultButton from "@/components/app_componentes/customButtons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, FilterX, KeyRound, Search, ShieldOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Role = string;

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  /** Role allows break-glass password login (devAdmin/admin/executive). */
  canUseCredentials: boolean;
  /** Whitelisted devAdmin — role can't be changed from the panel. */
  isProtected: boolean;
  hasCredentials: boolean;
  mustChangePassword: boolean;
};

type SortKey = "name" | "role" | "credentials";

const CREDENTIAL_ORDER = ["Enabled", "Temp (must change)", "SSO only"] as const;

function credentialLabel(u: AdminUserRow): (typeof CREDENTIAL_ORDER)[number] {
  if (!u.hasCredentials) return "SSO only";
  return u.mustChangePassword ? "Temp (must change)" : "Enabled";
}

function rank(order: readonly string[], v: string) {
  const i = order.indexOf(v);
  return i === -1 ? order.length : i;
}

/** Distinct values of a column with row counts, in the given order. */
function optionsFor(
  rows: AdminUserRow[],
  valueOf: (u: AdminUserRow) => string,
  order: readonly string[],
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const u of rows) counts.set(valueOf(u), (counts.get(valueOf(u)) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => rank(order, a) - rank(order, b) || a.localeCompare(b))
    .map((v) => ({ value: v, label: v, count: counts.get(v) ?? 0 }));
}

export function UsersTable({
  users,
  currentUserId,
  grantableRoles,
  canManage,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  grantableRoles: { value: Role; description: string }[];
  /** users.manage — false renders the table read-only. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Excel-style search / sort / column filters
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [roleFilter, setRoleFilter] = useState<Set<string> | null>(null);
  const [credFilter, setCredFilter] = useState<Set<string> | null>(null);

  // Roles sort by authority (grantable order), not alphabetically.
  const roleOrder = useMemo(() => grantableRoles.map((r) => r.value), [grantableRoles]);
  const roleOptions = useMemo(
    () => optionsFor(users, (u) => u.role, roleOrder),
    [users, roleOrder],
  );
  const credOptions = useMemo(
    () => optionsFor(users, credentialLabel, CREDENTIAL_ORDER),
    [users],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = users.filter(
      (u) =>
        (!q ||
          u.email.toLowerCase().includes(q) ||
          (u.name ?? "").toLowerCase().includes(q)) &&
        (!roleFilter || roleFilter.has(u.role)) &&
        (!credFilter || credFilter.has(credentialLabel(u))),
    );
    if (!sort) return out;
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = (u: AdminUserRow) =>
      sort.key === "name"
        ? (u.name ?? u.email).toLowerCase()
        : sort.key === "role"
          ? rank(roleOrder, u.role)
          : rank(CREDENTIAL_ORDER, credentialLabel(u));
    return [...out].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
    });
  }, [users, query, roleFilter, credFilter, sort, roleOrder]);

  const hasFilters = Boolean(query.trim() || roleFilter || credFilter);
  const sortFor = (key: SortKey) => (sort?.key === key ? sort.dir : null);
  const setSortFor = (key: SortKey) => (dir: SortDir | null) =>
    setSort(dir ? { key, dir } : null);

  function clearAll() {
    setQuery("");
    setRoleFilter(null);
    setCredFilter(null);
    setSort(null);
  }

  async function changeRole(userId: string, role: string) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not update role.");
        return;
      }
      toast.success(data.message ?? "Role updated.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function provisionCredentials(userId: string) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/users/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not provision credentials.");
        return;
      }
      setTempPassword({ email: data.email, password: data.tempPassword });
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeCredentials(userId: string) {
    setBusyId(userId);
    try {
      const res = await fetch(
        `/api/admin/users/credentials?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not revoke credentials.");
        return;
      }
      toast.success(data.message ?? "Credentials revoked.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="pr-8 pl-9"
            aria-label="Search users by name or email"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-white/40 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <p className="text-sm text-white/50" aria-live="polite">
          Showing <span className="font-semibold text-white tabular-nums">{rows.length}</span> of{" "}
          <span className="tabular-nums">{users.length}</span> users
        </p>

        {hasFilters || sort ? (
          <Button size="sm" variant="ghost" onClick={clearAll} className="ml-auto text-white/70">
            <FilterX className="size-4" /> Clear all
          </Button>
        ) : null}
      </div>

      <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <ScrollArea className="h-[calc(100vh-23rem)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-black/90 backdrop-blur-md">
              <TableRow>
                <TableHead>
                  <ColumnHeader
                    label="User"
                    sort={sortFor("name")}
                    onSort={setSortFor("name")}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeader
                    label="Role"
                    sort={sortFor("role")}
                    onSort={setSortFor("role")}
                    options={roleOptions}
                    selected={roleFilter}
                    onFilterChange={setRoleFilter}
                    sortLabels={["Highest authority first", "Lowest authority first"]}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeader
                    label="Credentials"
                    sort={sortFor("credentials")}
                    onSort={setSortFor("credentials")}
                    options={credOptions}
                    selected={credFilter}
                    onFilterChange={setCredFilter}
                    sortLabels={["Password first", "SSO only first"]}
                  />
                </TableHead>
                <TableHead className="text-right text-xs font-semibold tracking-wider text-white/60 uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-16 text-center">
                    <p className="text-sm text-white/70">No users match these filters.</p>
                    <Button
                      size="sm"
                      variant="link"
                      onClick={clearAll}
                      className="mt-1 text-itbd-blue"
                    >
                      Clear all filters
                    </Button>
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((u) => {
                const isSelf = u.id === currentUserId;
                const locked = !canManage || isSelf || u.isProtected;
                const busy = busyId === u.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-white">
                        {u.name ?? "—"}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-itbd-blue">(you)</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-white/50">
                        {u.email}
                      </div>
                    </TableCell>

                    <TableCell>
                      {locked ? (
                        <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-2.5 py-0.5 text-xs font-semibold text-itbd-blue">
                          {u.role}
                          {u.isProtected ? " (protected)" : ""}
                        </span>
                      ) : (
                        <Select
                          value={u.role}
                          disabled={busy}
                          onValueChange={(v) => changeRole(u.id, v)}
                        >
                          <SelectTrigger className="w-40">
                            {/* Explicit children: show just the role name, not the
                                item's description, in the closed trigger. */}
                            <SelectValue>{u.role}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {grantableRoles.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                <span className="flex flex-col">
                                  <span>{r.value}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {r.description}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    <TableCell>
                      {u.hasCredentials ? (
                        <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-white/70">
                          {credentialLabel(u)}
                        </span>
                      ) : (
                        <span className="text-xs text-white/50">
                          SSO only
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Provision creds - only for roles with credentials.login */}
                        {canManage && u.canUseCredentials && !locked ? (
                          <DefaultButton
                            size="sm"
                            disabled={busy}
                            onClick={() => provisionCredentials(u.id)}
                          >
                            <KeyRound className="mr-1 h-3.5 w-3.5" />
                            {u.hasCredentials ? "Reset" : "Grant"} password
                          </DefaultButton>
                        ) : null}
                        {canManage && u.hasCredentials && !locked ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => revokeCredentials(u.id)}
                          >
                            <ShieldOff className="mr-1 h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Temp password reveal — shown once. */}
      <Dialog
        open={tempPassword !== null}
        onOpenChange={(open) => !open && setTempPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share this with <strong>{tempPassword?.email}</strong> securely.
              It is shown only once and they must change it on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
            <span className="flex-1 break-all">{tempPassword?.password}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (tempPassword) {
                  navigator.clipboard.writeText(tempPassword.password);
                  toast.success("Copied.");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <DialogFooter>
            <DefaultButton onClick={() => setTempPassword(null)}>Done</DefaultButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
