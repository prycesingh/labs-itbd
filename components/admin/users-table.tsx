"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Copy, KeyRound, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Role = string;

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasCredentials: boolean;
  mustChangePassword: boolean;
};

export function UsersTable({
  users,
  currentUserId,
  grantableRoles,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  grantableRoles: Role[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{
    email: string;
    password: string;
  } | null>(null);

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
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Credentials</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const locked = isSelf || u.isSuperAdmin;
              const busy = busyId === u.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </TableCell>

                  <TableCell>
                    {locked ? (
                      <Badge variant={u.isAdmin ? "default" : "secondary"}>
                        {u.role}
                        {u.isSuperAdmin ? " (superadmin)" : ""}
                      </Badge>
                    ) : (
                      <Select
                        value={u.role}
                        disabled={busy}
                        onValueChange={(v) => changeRole(u.id, v)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {grantableRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>

                  <TableCell>
                    {u.hasCredentials ? (
                      <Badge variant="outline">
                        {u.mustChangePassword ? "Temp (must change)" : "Enabled"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        SSO only
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Provision creds — only for admins (creds imply admin) */}
                      {u.isAdmin && !u.isSuperAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => provisionCredentials(u.id)}
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          {u.hasCredentials ? "Reset" : "Grant"} password
                        </Button>
                      ) : null}
                      {u.hasCredentials && !u.isSuperAdmin ? (
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
            <Button onClick={() => setTempPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
