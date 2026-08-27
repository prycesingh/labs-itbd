"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComboboxUser, UserCombobox } from "@/components/admin/UserCombobox";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronLeft, ChevronRight, List, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

export function ActivityLogPage({ users }: { users: ComboboxUser[] }) {
  const [tab, setTab] = useState<"summary" | "log">("summary");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "summary" | "log")}>
      <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-white/10 bg-black/30 p-1.5 sm:w-fit">
        <ActivityTabTrigger value="summary" icon={BarChart3} label="Most Visited" active={tab === "summary"} />
        <ActivityTabTrigger value="log" icon={List} label="Raw Log" active={tab === "log"} />
      </TabsList>

      <div className="mt-4">
        {tab === "summary" ? <MostVisitedSummary /> : <RawActivityLog users={users} />}
      </div>
    </Tabs>
  );
}

function ActivityTabTrigger({
  value,
  icon: Icon,
  label,
  active,
}: {
  value: string;
  icon: typeof BarChart3;
  label: string;
  active: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative z-0 flex-1 gap-2 rounded-lg border-transparent bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors",
        "data-[state=active]:bg-transparent data-[state=active]:text-white",
      )}
    >
      {active ? (
        <span className="absolute inset-0 -z-10 rounded-lg bg-itbd-blue/15" />
      ) : null}
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
  );
}

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function MostVisitedSummary() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/admin/page-visits/summary?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load summary");
        return res.json() as Promise<SummaryResponse>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load activity summary");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const maxVisits = data?.summary[0]?.visits ?? 0;

  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
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
        {data ? (
          <p className="text-xs text-white/50">{data.totalVisits} total visits</p>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-itbd-blue" />
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-26rem)]">
          <div className="space-y-3 p-4">
            {data?.summary.length ? (
              data.summary.map((entry) => (
                <div key={`${entry.section}::${entry.label}`} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-white">{entry.label}</span>
                      {entry.section ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-white/20 text-[10px] text-white/50"
                        >
                          {entry.section}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-white/60">
                      {entry.visits} visits &middot; {entry.uniqueUsers} users
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-itbd-blue"
                      style={{
                        width: `${maxVisits > 0 ? Math.max(2, (entry.visits / maxVisits) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-sm text-white/50">
                No page visits recorded in this range.
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
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
        {data ? (
          <p className="text-xs text-white/50">{data.total} total visits</p>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-itbd-blue" />
        </div>
      ) : (
        <>
          <ScrollArea className="h-[calc(100vh-26rem)]">
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
