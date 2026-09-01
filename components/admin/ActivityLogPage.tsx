"use client";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import { ComboboxUser, UserCombobox } from "@/components/admin/UserCombobox";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Loader2,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

// Single-series bar charts throughout this page use ITBD Blue only — per the
// brand palette, green/orange are emergency-only, so a "closed palette" chart
// here means one accent color, not a multi-hue categorical scheme.
const CHART_CONFIG = {
  value: { label: "Value", color: "var(--itbd-blue)" },
} satisfies ChartConfig;

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** Truncates a label for the Y-axis tick so long page/user names don't blow out the chart's left margin. */
function truncateLabel(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** Formats a duration in seconds as "2h 14m" / "42m" / "18s", for display only. */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

type PageVisitRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  path: string;
  visitedAt: string;
};

type PageVisitsResponse = {
  rows: PageVisitRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SummaryEntry = {
  label: string;
  section: string | null;
  visits: number;
  uniqueUsers: number;
};

type SummaryResponse = {
  summary: SummaryEntry[];
  days: number;
  totalVisits: number;
};

type TopUser = {
  userId: string;
  userName: string | null;
  userEmail: string;
  totalSeconds: number;
  sessionCount: number;
};

type SiteTimeResponse = {
  days: number;
  totalSeconds: number;
  activeUserCount: number;
  topUsers: TopUser[];
};

export function ActivityLogPage({ users }: { users: ComboboxUser[] }) {
  const [days, setDays] = useState("30");
  const [pageVisits, setPageVisits] = useState<SummaryResponse | null>(null);
  const [siteTime, setSiteTime] = useState<SiteTimeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(`/api/admin/page-visits/summary?days=${days}`).then((res) => {
        if (!res.ok) throw new Error("Failed to load page-visit summary");
        return res.json() as Promise<SummaryResponse>;
      }),
      fetch(`/api/admin/site-time/summary?days=${days}`).then((res) => {
        if (!res.ok) throw new Error("Failed to load site-time summary");
        return res.json() as Promise<SiteTimeResponse>;
      }),
    ])
      .then(([visits, time]) => {
        if (!cancelled) {
          setPageVisits(visits);
          setSiteTime(time);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load activity data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const topPage = pageVisits?.summary[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/60">
          Overview across the dashboard and admin panel.
        </p>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Eye}
          label="Total visits"
          value={loading ? "—" : String(pageVisits?.totalVisits ?? 0)}
        />
        <StatCard
          icon={Clock}
          label="Total time"
          value={loading ? "—" : formatDuration(siteTime?.totalSeconds ?? 0)}
        />
        <StatCard
          icon={Users}
          label="Active users"
          value={loading ? "—" : String(siteTime?.activeUserCount ?? 0)}
          sublabel={`Last ${days} days`}
        />
        <StatCard
          icon={FileText}
          label="Top page"
          value={loading ? "—" : (topPage?.label ?? "—")}
          sublabel={topPage ? `${topPage.visits} visits` : undefined}
          valueClassName="truncate text-base"
        />
      </div>

      <DashboardSection
        title="Most Visited Pages"
        chart={
          <RankedBarChart
            data={(pageVisits?.summary ?? []).map((entry) => ({
              label: entry.label,
              fullLabel: entry.section ? `${entry.section} · ${entry.label}` : entry.label,
              value: entry.visits,
              detail: `${entry.uniqueUsers} users`,
            }))}
            loading={loading}
            emptyMessage="No page visits recorded in this range."
            valueFormatter={(v) => `${v}`}
          />
        }
        list={
          <RankedList
            items={(pageVisits?.summary ?? []).map((entry, index) => ({
              key: `${entry.section}::${entry.label}`,
              rank: index + 1,
              primary: entry.label,
              secondary: entry.section,
              value: `${entry.visits} visits`,
              detail: `${entry.uniqueUsers} users`,
            }))}
            loading={loading}
            emptyMessage="No page visits recorded in this range."
          />
        }
      />

      <DashboardSection
        title="Most Active Users"
        chart={
          <RankedBarChart
            data={(siteTime?.topUsers ?? []).map((user, index) => ({
              label: `#${index + 1} ${user.userName ?? user.userEmail}`,
              fullLabel: user.userName ?? user.userEmail,
              value: user.totalSeconds,
              detail: `${user.sessionCount} sessions`,
            }))}
            loading={loading}
            emptyMessage="No site time recorded in this range."
            valueFormatter={(v) => formatDuration(v)}
          />
        }
        list={
          <RankedList
            items={(siteTime?.topUsers ?? []).map((user, index) => ({
              key: user.userId,
              rank: index + 1,
              primary: user.userName ?? "—",
              secondary: user.userEmail,
              value: formatDuration(user.totalSeconds),
              detail: `${user.sessionCount} sessions`,
            }))}
            loading={loading}
            emptyMessage="No site time recorded in this range."
          />
        }
      />

      <RawActivityLog users={users} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-cyan-500/20 bg-black/20 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-itbd-blue/30 bg-itbd-blue/10">
        <Icon className="h-4 w-4 text-itbd-blue" />
      </div>
      <div className="min-w-0">
        <p className={cn("text-xl font-semibold text-white", valueClassName)}>
          {value}
        </p>
        <p className="truncate text-[11px] font-medium text-white/50">
          {label}
          {sublabel ? <span className="text-white/35"> &middot; {sublabel}</span> : null}
        </p>
      </div>
    </div>
  );
}

function DashboardSection({
  title,
  chart,
  list,
}: {
  title: string;
  chart: React.ReactNode;
  list: React.ReactNode;
}) {
  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="border-b border-white/10 p-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
        <div className="border-white/10 p-4 lg:border-r">{chart}</div>
        <div className="p-4">{list}</div>
      </div>
    </div>
  );
}

function RankedBarChart({
  data,
  loading,
  emptyMessage,
  valueFormatter,
}: {
  data: { label: string; fullLabel: string; value: number; detail: string }[];
  loading: boolean;
  emptyMessage: string;
  valueFormatter: (value: number) => string;
}) {
  const chartHeight = Math.max(200, data.length * 32);

  if (loading && !data.length) {
    return (
      <div className="flex h-52 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-itbd-blue" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <p className="flex h-52 items-center justify-center text-center text-sm text-white/50">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ScrollArea className="h-72">
      <ChartContainer
        config={CHART_CONFIG}
        className="aspect-auto w-full"
        style={{ height: chartHeight }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            tickFormatter={(v: string) => truncateLabel(v, 18)}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <ChartTooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, _name, item) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{item.payload.fullLabel}</span>
                    <span className="text-muted-foreground">
                      {valueFormatter(Number(value))} &middot; {item.payload.detail}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} maxBarSize={18} />
        </BarChart>
      </ChartContainer>
    </ScrollArea>
  );
}

function RankedList({
  items,
  loading,
  emptyMessage,
}: {
  items: { key: string; rank: number; primary: string; secondary: string | null; value: string; detail: string }[];
  loading: boolean;
  emptyMessage: string;
}) {
  if (loading && !items.length) {
    return (
      <div className="flex h-52 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-itbd-blue" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="flex h-52 items-center justify-center text-center text-sm text-white/50">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ScrollArea className="h-72">
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5"
          >
            <span className="w-5 shrink-0 text-xs text-white/40">#{item.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{item.primary}</p>
              {item.secondary ? (
                <p className="truncate text-xs text-white/50">{item.secondary}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-itbd-blue">{item.value}</p>
              <p className="text-[11px] text-white/40">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

function RawActivityLog({ users }: { users: ComboboxUser[] }) {
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageVisitsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page) });
    if (userId) params.set("userId", userId);

    fetch(`/api/admin/page-visits?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load activity log");
        return res.json() as Promise<PageVisitsResponse>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load activity log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, page]);

  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-white">Raw Log</h2>
        <div className="flex items-center gap-2">
          <UserCombobox
            users={users}
            value={userId}
            onValueChange={(v) => {
              setUserId(v);
              setPage(1);
            }}
            placeholder="Filter by user"
            className="w-72"
          />
          {userId ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setUserId("");
                setPage(1);
              }}
              aria-label="Clear user filter"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-itbd-blue" />
        </div>
      ) : (
        <>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-black/90 backdrop-blur-md">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Visited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.length ? (
                  data.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium text-white">
                          {row.userName ?? "—"}
                        </div>
                        <div className="text-xs text-white/50">{row.userEmail}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-white/80">
                        {row.path}
                      </TableCell>
                      <TableCell className="text-right text-xs text-white/60">
                        {new Date(row.visitedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-white/50">
                      No page visits recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {data && data.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-white/10 p-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Previous
              </Button>
              <span className="text-xs text-white/50">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
