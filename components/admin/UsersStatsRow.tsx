import type { Role } from "@/lib/rbac";
import { KeyRound, ShieldCheck, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-cyan-500/20 bg-black/20 px-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-itbd-blue/30 bg-itbd-blue/10">
        <Icon className="h-3.5 w-3.5 text-itbd-blue" />
      </div>
      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold text-white">{value}</span>
          <span className="text-[11px] font-medium text-white/60">{label}</span>
        </p>
        {sublabel ? (
          <p className="truncate text-[10px] text-white/45">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}

export function UsersStatsRow({
  totalUsers,
  activeUsers,
  activeDays,
  superAdminCount,
  adminCount,
  credentialsCount,
  pendingPasswordChangeCount,
  roleBreakdown,
}: {
  totalUsers: number;
  activeUsers: number;
  activeDays: number;
  superAdminCount: number;
  adminCount: number;
  credentialsCount: number;
  pendingPasswordChangeCount: number;
  roleBreakdown: { role: Role; count: number }[];
}) {
  const roleSublabel = roleBreakdown
    .map(({ role, count }) => `${count} ${role}`)
    .join(" · ");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-fit xl:min-w-0 xl:grid-cols-2">
      <StatCard icon={Users} label="Total users" value={totalUsers} />
      <StatCard
        icon={UserCheck}
        label="Active"
        value={activeUsers}
        sublabel={`Last ${activeDays} days`}
      />
      <StatCard
        icon={ShieldCheck}
        label="Admin roles"
        value={superAdminCount + adminCount}
        sublabel={roleSublabel || `${superAdminCount} superadmin · ${adminCount} admin`}
      />
      <StatCard
        icon={KeyRound}
        label="Credential logins"
        value={credentialsCount}
        sublabel={
          pendingPasswordChangeCount > 0
            ? `${pendingPasswordChangeCount} pending change`
            : "All confirmed"
        }
      />
    </div>
  );
}
