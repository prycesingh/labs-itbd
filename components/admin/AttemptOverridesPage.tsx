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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCombobox } from "@/components/admin/UserCombobox";
import { cn } from "@/lib/utils";
import { isAdminRole, type Role } from "@/lib/rbac";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { Mail, Mic, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

interface InterviewOverrideRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  moduleId: string;
  moduleName: string;
  dailyLimit: number;
  lockoutThreshold: number | null;
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

interface EmailAssessmentOverrideRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  dailyLimit: number;
  createdBy: string;
  updatedAt: string;
}

const DEFAULT_LOCKOUT_THRESHOLD = 3;

// Shared easing/timing for entrances — calm, purposeful, never bouncy.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function useRowVariants() {
  const reduce = useReducedMotion();
  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: 0.05 },
    },
  };
  const row: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
  };
  return { container, row };
}

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Brief blue→green success flash on a just-saved badge/row — a single,
 * deliberate accent per brand guidelines, not a standing color. */
function SuccessPulse({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-linear-to-r from-itbd-blue/25 to-itbd-green/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        />
      )}
    </AnimatePresence>
  );
}

function InterviewOverridesTab() {
  const { container, row } = useRowVariants();

  const [lockouts, setLockouts] = useState<LockoutRow[]>([]);
  const [loadingLockouts, setLoadingLockouts] = useState(true);

  const [overrides, setOverrides] = useState<InterviewOverrideRow[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [resetTarget, setResetTarget] = useState<InterviewOverrideRow | null>(
    null,
  );
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [modules, setModules] = useState<InterviewModuleOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState("3");
  const [lockoutThreshold, setLockoutThreshold] = useState("");
  const [saving, setSaving] = useState(false);

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
    const trimmedLockout = lockoutThreshold.trim();
    const parsedLockout = trimmedLockout ? Number(trimmedLockout) : undefined;
    if (
      parsedLockout !== undefined &&
      (!Number.isInteger(parsedLockout) || parsedLockout < 1)
    ) {
      toast.error("Lockout threshold must be a whole number of at least 1");
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
          ...(parsedLockout !== undefined
            ? { lockoutThreshold: parsedLockout }
            : {}),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to save override");
      }
      toast.success("Attempt limit updated");
      const refreshed = await fetch("/api/interview/admin/practice-overrides");
      const refreshedPayload = await refreshed.json().catch(() => null);
      const nextOverrides: InterviewOverrideRow[] = Array.isArray(refreshedPayload)
        ? refreshedPayload
        : [];
      setOverrides(nextOverrides);
      const saved = nextOverrides.find(
        (o) => o.userId === selectedUserId && o.moduleId === selectedModuleId,
      );
      if (saved) {
        setJustSavedId(saved.id);
        setTimeout(() => setJustSavedId(null), 900);
      }
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
    <div className="space-y-6">
      <FadeIn>
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Locked-out users today</CardTitle>
            <CardDescription>
              By default, 3 failed attempts on the same module the same day
              locks that module for the rest of the day (overridable per user
              below). This clears automatically at midnight and is separate
              from the daily-limit override.
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
                <motion.tbody
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="[&_tr:last-child]:border-0"
                >
                  {lockouts.map((rowData) => (
                    <motion.tr
                      key={`${rowData.userId}-${rowData.moduleId}`}
                      variants={row}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="font-medium">
                          {rowData.userName ?? rowData.userEmail}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rowData.userEmail}
                        </div>
                      </TableCell>
                      <TableCell>{rowData.moduleName}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{rowData.failedCount}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(rowData.lastFailureAt).toLocaleString()}
                      </TableCell>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.06}>
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Active overrides</CardTitle>
            <CardDescription>
              Users below have a custom daily attempt limit and/or lockout
              threshold for a specific module. Reset to revoke and revert them
              to the defaults (1/day, 3 failures to lock).
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
                    <TableHead>Lockout Threshold</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <motion.tbody
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="[&_tr:last-child]:border-0"
                >
                  <AnimatePresence>
                    {overrides.map((rowData) => (
                      <motion.tr
                        key={rowData.id}
                        variants={row}
                        exit={{ opacity: 0, x: -12, transition: { duration: 0.25 } }}
                        className="relative border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="relative">
                          <SuccessPulse active={justSavedId === rowData.id} />
                          <div className="relative font-medium">
                            {rowData.userName ?? rowData.userEmail}
                          </div>
                          <div className="relative text-xs text-muted-foreground">
                            {rowData.userEmail}
                          </div>
                        </TableCell>
                        <TableCell>{rowData.moduleName}</TableCell>
                        <TableCell>
                          <Badge>{rowData.dailyLimit}/day</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {rowData.lockoutThreshold ?? DEFAULT_LOCKOUT_THRESHOLD}{" "}
                            failures
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(rowData.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetTarget(rowData)}
                          >
                            Reset to default
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.12}>
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Grant an override</CardTitle>
            <CardDescription>
              Search for a user, pick a module, and set their daily attempt
              limit and/or lockout threshold for that module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  User
                </label>
                <UserCombobox
                  users={users}
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Module
                </label>
                <Select
                  value={selectedModuleId}
                  onValueChange={setSelectedModuleId}
                >
                  <SelectTrigger className="w-full">
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
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Daily limit
                </label>
                <Input
                  type="number"
                  min={1}
                  value={dailyLimit}
                  onChange={(event) => setDailyLimit(event.target.value)}
                  placeholder="Daily limit"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Lockout threshold (optional)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={lockoutThreshold}
                  onChange={(event) => setLockoutThreshold(event.target.value)}
                  placeholder="Default: 3 failed attempts"
                />
              </div>
            </div>

            <GreenButton
              onClick={async () => {
                await handleGrant();
              }}
              loading={saving}
            >
              Save override
            </GreenButton>
          </CardContent>
        </Card>
      </FadeIn>

      <ResetDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => !open && setResetTarget(null)}
        description={
          resetTarget
            ? `This will remove the custom limit for ${
                resetTarget.userName ?? resetTarget.userEmail
              } on "${resetTarget.moduleName}" and revert them to the defaults (1/day, 3 failures to lock).`
            : ""
        }
        onCancel={() => setResetTarget(null)}
        onConfirm={handleReset}
        confirming={resettingId === resetTarget?.id}
      />
    </div>
  );
}

function EmailAssessmentOverridesTab() {
  const { container, row } = useRowVariants();

  const [overrides, setOverrides] = useState<EmailAssessmentOverrideRow[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [resetTarget, setResetTarget] =
    useState<EmailAssessmentOverrideRow | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState("1");
  const [saving, setSaving] = useState(false);

  const fetchOverrides = useCallback(async () => {
    setLoadingOverrides(true);
    try {
      const res = await fetch("/api/emailAssessment/admin/practice-overrides");
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
      // Reused from the Interview override surface — a plain (id, name,
      // email) roster, not module-specific.
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

  useEffect(() => {
    fetchOverrides();
    fetchUsers();
  }, [fetchOverrides, fetchUsers]);

  const handleGrant = async () => {
    if (!selectedUserId) {
      toast.error("Select a user first");
      return;
    }
    const parsedLimit = Number(dailyLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      toast.error("Daily limit must be a whole number of at least 1");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/emailAssessment/admin/practice-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
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
        `/api/emailAssessment/admin/practice-overrides/${resetTarget.id}`,
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
    <div className="space-y-6">
      <FadeIn>
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Active daily-limit overrides</CardTitle>
            <CardDescription>
              By default, a candidate may start one 5-scenario assessment
              session per calendar day. Users below have a custom daily limit.
              Reset to revoke and revert them to the default of 1/day.
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
                    <TableHead>Daily Limit</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <motion.tbody
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="[&_tr:last-child]:border-0"
                >
                  <AnimatePresence>
                    {overrides.map((rowData) => (
                      <motion.tr
                        key={rowData.id}
                        variants={row}
                        exit={{ opacity: 0, x: -12, transition: { duration: 0.25 } }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="font-medium">
                            {rowData.userName ?? rowData.userEmail}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {rowData.userEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge>{rowData.dailyLimit}/day</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(rowData.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetTarget(rowData)}
                          >
                            Reset to default
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.06}>
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Grant an override</CardTitle>
            <CardDescription>
              Search for a user and set their daily assessment session limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  User
                </label>
                <UserCombobox
                  users={users}
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Daily limit
                </label>
                <Input
                  type="number"
                  min={1}
                  value={dailyLimit}
                  onChange={(event) => setDailyLimit(event.target.value)}
                  placeholder="Daily limit"
                />
              </div>
            </div>

            <GreenButton onClick={handleGrant} loading={saving}>
              Save override
            </GreenButton>
          </CardContent>
        </Card>
      </FadeIn>

      <ResetDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => !open && setResetTarget(null)}
        description={
          resetTarget
            ? `This will remove the ${resetTarget.dailyLimit}/day limit for ${
                resetTarget.userName ?? resetTarget.userEmail
              } and revert them to the default of 1/day.`
            : ""
        }
        onCancel={() => setResetTarget(null)}
        onConfirm={handleReset}
        confirming={resettingId === resetTarget?.id}
      />
    </div>
  );
}

function ResetDialog({
  open,
  onOpenChange,
  description,
  onCancel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent asChild>
        <motion.div
          initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          <DialogHeader>
            <DialogTitle>Reset to default?</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DefaultButton onClick={onCancel} className="bg-transparent border">
              Cancel
            </DefaultButton>
            <DefaultButton onClick={onConfirm} loading={confirming}>
              Reset to default
            </DefaultButton>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

type OverrideTab = "interview" | "emailAssessment";

export default function AttemptOverridesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<OverrideTab>("interview");

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = session?.user?.role;
    if (role && !isAdminRole(role as Role)) {
      router.push("/dashboard");
      toast.error("Access denied. Administrator role required.");
    }
  }, [session, status, router]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <span className="itbd-glow-border relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/40">
            <ShieldCheck className="h-5 w-5 text-itbd-blue" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">
              Practice Attempt Overrides
            </h1>
            <p className="text-sm text-muted-foreground">
              By default, candidates get one practice attempt per day. Grant a
              specific user a higher daily limit below.
            </p>
          </div>
        </div>
      </FadeIn>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as OverrideTab)}
      >
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-white/10 bg-black/30 p-1.5 sm:w-fit">
          <OverrideTabTrigger
            value="interview"
            icon={Mic}
            label="Interview"
            active={activeTab === "interview"}
          />
          <OverrideTabTrigger
            value="emailAssessment"
            icon={Mail}
            label="Email Assessment"
            active={activeTab === "emailAssessment"}
          />
        </TabsList>

        <div className="relative mt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -8 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              {activeTab === "interview" ? (
                <InterviewOverridesTab />
              ) : (
                <EmailAssessmentOverridesTab />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}

function OverrideTabTrigger({
  value,
  icon: Icon,
  label,
  active,
}: {
  value: OverrideTab;
  icon: typeof Mic;
  label: string;
  active: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative z-0 flex-1 gap-2 rounded-lg border-transparent bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors",
        "data-[state=active]:bg-transparent data-[state=active]:text-white",
        "dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent",
      )}
    >
      {active && (
        <motion.span
          layoutId="override-tab-active"
          className="absolute inset-0 -z-10 rounded-lg bg-linear-to-r from-itbd-blue/25 to-itbd-blue/10 ring-1 ring-itbd-blue/40"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className={cn("h-4 w-4", active ? "text-itbd-blue" : "opacity-60")} />
      {label}
    </TabsTrigger>
  );
}
