"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { EmployeeSearch, lpRequest } from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export type TrainerListItem = {
  id: number;
  isActive: boolean;
  employeeId: number;
  empId: string;
  fullName: string;
  email: string;
  employeeActive: boolean;
};

export type HrisStatus = {
  total: number;
  active: number;
  lastSyncedAt: string | null;
  configured: boolean;
};

export function HrisSyncPanel({ status }: { status: HrisStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    const res = await lpRequest<{ fetched: number; deactivated: number }>(
      "/api/lab-practice/admin/hris-sync",
      { method: "POST" },
    );
    setBusy(false);
    if (res) {
      toast.success(`Synced ${res.fetched} employees (${res.deactivated} deactivated).`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-white/50">Active employees</dt>
          <dd className="text-lg font-semibold text-white">{status.active}</dd>
        </div>
        <div>
          <dt className="text-white/50">Cached total</dt>
          <dd className="text-lg font-semibold text-white">{status.total}</dd>
        </div>
        <div>
          <dt className="text-white/50">Last sync</dt>
          <dd className="text-white">
            {status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "Never"}
          </dd>
        </div>
      </dl>
      {!status.configured && (
        <p className="text-sm text-white/70">
          <span className="font-semibold text-itbd-blue">HRIS_API_KEY</span> is not set — add it to
          the environment to enable syncing.
        </p>
      )}
      <DefaultButton size="sm" onClick={sync} loading={busy} disabled={!status.configured}>
        <RefreshCw className="size-4" /> Sync now
      </DefaultButton>
    </div>
  );
}

export function TrainerRegistry({ trainers }: { trainers: TrainerListItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);

  async function register(employeeId: number, name: string) {
    setPending(employeeId);
    const ok = await lpRequest("/api/lab-practice/admin/trainers", {
      method: "POST",
      json: { employeeId },
    });
    setPending(null);
    if (ok) {
      toast.success(`${name} is now a trainer.`);
      router.refresh();
    }
  }

  async function toggle(t: TrainerListItem, isActive: boolean) {
    setPending(t.employeeId);
    const ok = await lpRequest(`/api/lab-practice/admin/trainers/${t.id}`, {
      method: "PATCH",
      json: { isActive },
    });
    setPending(null);
    if (ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white/80">Register a trainer</h3>
        <EmployeeSearch
          excludeIds={trainers.filter((t) => t.isActive).map((t) => t.employeeId)}
          onPick={(e) => register(e.id, e.fullName)}
        />
      </div>

      <div className="divide-y divide-white/10 rounded-lg border border-white/10">
        {trainers.length === 0 ? (
          <p className="p-4 text-sm text-white/50">No trainers registered yet.</p>
        ) : (
          trainers.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {t.fullName}{" "}
                  {!t.employeeActive && (
                    <Badge variant="outline" className="ml-1 text-white/60">
                      Left HRIS
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-white/50">
                  {t.email} · {t.empId}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-white/60">
                {t.isActive ? "Active" : "Inactive"}
                <Switch
                  checked={t.isActive}
                  disabled={pending === t.employeeId}
                  onCheckedChange={(v) => toggle(t, v)}
                  aria-label={`Trainer ${t.fullName} active`}
                />
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
