"use client";

import { Badge } from "@/components/ui/badge";
import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { isAdminRole, type Role } from "@/lib/rbac";
import { Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface InterviewModuleOption {
  id: string;
  name: string;
}

interface OverrideRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  moduleId: string;
  moduleName: string;
  dailyLimit: number;
  createdBy: string;
  updatedAt: string;
}

interface LockoutRow {
  userId: string;
  userName: string | null;
  userEmail: string;
  moduleId: string;
  moduleName: string;
  failedCount: number;
  lastFailureAt: string;
}

export default function AttemptOverridesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [lockouts, setLockouts] = useState<LockoutRow[]>([]);
  const [loadingLockouts, setLoadingLockouts] = useState(true);

  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [resetTarget, setResetTarget] = useState<OverrideRow | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [modules, setModules] = useState<InterviewModuleOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState("3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = session?.user?.role;
    if (role && !isAdminRole(role as Role)) {
      router.push("/dashboard");
      toast.error("Access denied. Administrator role required.");
    }
  }, [session, status, router]);

  const fetchLockouts = useCallback(async () => {
    setLoadingLockouts(true);
    try {
      const res = await fetch("/api/interview/admin/practice-overrides/lockouts");
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load lockouts");
      }
      setLockouts(Array.isArray(payload) ? payload : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast.error("Unable to load locked-out users", { description: message });
    } finally {
      setLoadingLockouts(false);
    }
  }, []);

  const fetchOverrides = useCallback(async () => {
    setLoadingOverrides(true);
    try {
      const res = await fetch("/api/interview/admin/practice-overrides");
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load overrides");
      }
      setOverrides(Array.isArray(payload) ? payload : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast.error("Unable to load attempt overrides", { description: message });
    } finally {
      setLoadingOverrides(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/interview/admin/practice-overrides/users");
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load users");
      }
      setUsers(Array.isArray(payload) ? payload : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast.error("Unable to load users", { description: message });
    }
  }, []);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch("/api/interview/admin/modules");
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load modules");
      }
      setModules(
        Array.isArray(payload)
          ? payload.map((m: { id: string; name: string }) => ({
              id: m.id,
              name: m.name,
            }))
          : [],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast.error("Unable to load modules", { description: message });
    }
  }, []);

  useEffect(() => {
    fetchLockouts();
    fetchOverrides();
    fetchUsers();
    fetchModules();
  }, [fetchLockouts, fetchOverrides, fetchUsers, fetchModules]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
    );
  }, [users, userSearch]);

  const handleGrant = async () => {
    if (!selectedUserId || !selectedModuleId) {
      toast.error("Select a user and a module first");
      return;
    }
    const parsedLimit = Number(dailyLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      toast.error("Daily limit must be a whole number of at least 1");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/interview/admin/practice-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          moduleId: selectedModuleId,
          dailyLimit: parsedLimit,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to save override");
      }
      toast.success("Attempt limit updated");
      await fetchOverrides();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      toast.error("Unable to save override", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResettingId(resetTarget.id);
    try {
      const res = await fetch(
        `/api/interview/admin/practice-overrides/${resetTarget.id}`,
        { method: "DELETE" },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to reset override");
      }
      setOverrides((prev) => prev.filter((o) => o.id !== resetTarget.id));
      toast.success("Reset to default limit (1/day)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset";
      toast.error("Unable to reset", { description: message });
    } finally {
      setResettingId(null);
      setResetTarget(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Practice Attempt Overrides</h1>
        <p className="text-sm text-muted-foreground">
          By default, a candidate may practice a module once per calendar day.
          Grant a specific user a higher daily limit for a specific module
          below.
        </p>
      </div>

      <Card className="border-cyan-500/20 bg-black/20">
        <CardHeader>
          <CardTitle>Locked-out users today</CardTitle>
          <CardDescription>
            3 failed attempts on the same module the same day locks that
            module for the rest of the day. This clears automatically at
            midnight and is not affected by a daily-limit override.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLockouts ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : lockouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users are currently locked out.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Failed Attempts Today</TableHead>
                  <TableHead>Last Failure At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lockouts.map((row) => (
                  <TableRow key={`${row.userId}-${row.moduleId}`}>
                    <TableCell>
                      <div className="font-medium">
                        {row.userName ?? row.userEmail}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.userEmail}
                      </div>
                    </TableCell>
                    <TableCell>{row.moduleName}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{row.failedCount}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.lastFailureAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-black/20">
        <CardHeader>
          <CardTitle>Active daily-limit overrides</CardTitle>
          <CardDescription>
            Users below have a custom daily attempt limit for a specific
            module. Reset to revoke it and revert them to the default of 1/day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOverrides ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users currently have a custom attempt limit.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Daily Limit</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {row.userName ?? row.userEmail}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.userEmail}
                      </div>
                    </TableCell>
                    <TableCell>{row.moduleName}</TableCell>
                    <TableCell>
                      <Badge>{row.dailyLimit}/day</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetTarget(row)}
                      >
                        Reset to default
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-black/20">
        <CardHeader>
          <CardTitle>Grant an override</CardTitle>
          <CardDescription>
            Search for a user, pick a module, and set their daily attempt
            limit for that module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search users by name or email"
              className="pl-9"
            />
          </div>

          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {filteredUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {(u.name ?? u.email) + " (" + u.email + ")"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min={1}
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
            placeholder="Daily limit"
          />

          <GreenButton onClick={handleGrant} loading={saving}>
            Save override
          </GreenButton>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => !open && setResetTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to default?</DialogTitle>
            <DialogDescription>
              {resetTarget
                ? `This will remove the ${resetTarget.dailyLimit}/day limit for ${
                    resetTarget.userName ?? resetTarget.userEmail
                  } on "${resetTarget.moduleName}" and revert them to the default of 1/day.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DefaultButton
              onClick={() => setResetTarget(null)}
              className="bg-transparent border"
            >
              Cancel
            </DefaultButton>
            <DefaultButton
              onClick={handleReset}
              loading={resettingId === resetTarget?.id}
            >
              Reset to default
            </DefaultButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
