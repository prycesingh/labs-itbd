"use client";

// Workbooks gallery + viewer — ported from
// itbd-lab/simulators/sentinel/js/sentinel-workbooks.js. Gallery lists the 30
// seeded workbooks with All/Saved/Templates tabs (Saved = state.pinnedWorkbooks,
// Templates = uninstalled, matching source's exact tab semantics where
// `installed` drove a "Saved" pill and non-installed rows were "Template"
// rows — this port additionally filters "Saved" by the real pinned-workbooks
// list rather than reusing `installed`, since pinning here is wired to a real
// reducer action, unlike source). Clicking a tile swaps the gallery for a
// full-panel viewer (source used a full content swap too, not a flyout) with
// cosmetic parameter dropdowns and workbook-appropriate chart sections chosen
// by name-substring matching, branch-for-branch matching source's wbSections().
//
// Source's one Math.random()-driven decorative line chart per workbook is
// replaced with a deterministic seeded sine trend (seed = workbook id hashed
// to a number), matching overview-page.tsx's "no Math.random(), still looks
// organic" convention — same trend shape on every render/reload for a given
// workbook, no noise store needed.
//
// Source's `_pin()` referenced `SentinelData.state.workbookSelected`, a field
// that was never set anywhere in source, so pinning always fell back to a
// generic "Workbook" label — that bug is not replicated here. Pin/unpin
// dispatches the real `TOGGLE_WORKBOOK_PIN` action, which already knows the
// real workbook id.

import { useState } from "react";
import { toast } from "sonner";

import type { SentinelState, SentinelWorkbook } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import { NativeSelect } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

type GalleryTab = "all" | "saved" | "templates";

type ChartSection = { title: string; type: "bar"; data: { l: string; v: number; c?: string }[] } | { title: string; type: "line" };

type WorkbookParams = { timeRange: string; workspace: string; subscription: string };

const DEFAULT_PARAMS: WorkbookParams = {
  timeRange: "Last 24 hours",
  workspace: "cloudlab-sentinel-ws",
  subscription: "CloudLab-Training-Sub",
};

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// Deterministic string hash (djb2) — turns a workbook id into a stable seed
// number so the same workbook always draws the same decorative trend line,
// with no Math.random() anywhere in this file.
function hashSeed(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (h * 33 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Deterministic replacement for source's per-point
// `40 + Math.sin(i/3)*20 + Math.random()*12` noise: same sine base, plus a
// second low-frequency sine (seeded by the workbook id) standing in for the
// random jitter term so the line still looks organic but is 100% stable
// across reloads for a given workbook.
function seededTrend(seed: number, points = 30): number[] {
  const jitterPhase = (seed % 1000) / 1000;
  const jitterFreq = 0.15 + ((seed >> 3) % 7) / 20;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const base = 40 + Math.sin(i / 3) * 20;
    const jitter = (Math.sin(i * jitterFreq + jitterPhase * Math.PI * 2) + 1) * 6; // 0..12, like source's 0..12 random term
    out.push(base + jitter);
  }
  return out;
}

function wbSections(wb: SentinelWorkbook): ChartSection[] {
  const name = wb.name;
  if (name.includes("Overview") || name.includes("Sentinel")) {
    return [
      {
        title: "Active incidents by severity",
        type: "bar",
        data: [
          { l: "High", v: 7, c: "#cf2030" },
          { l: "Medium", v: 11, c: "#d97900" },
          { l: "Low", v: 5, c: "#f7b500" },
          { l: "Informational", v: 2, c: "#707070" },
        ],
      },
      {
        title: "Events ingested (24h, by source)",
        type: "bar",
        data: [
          { l: "M365 Defender", v: 92340 },
          { l: "DNS", v: 152340 },
          { l: "Office 365", v: 71280 },
          { l: "Azure Activity", v: 28415 },
          { l: "Syslog", v: 22480 },
        ],
      },
      { title: "Daily ingestion trend (90d)", type: "line" },
      {
        title: "Top users by alert count",
        type: "bar",
        data: [
          { l: "sneha@cloudlab.in", v: 7 },
          { l: "vikram@cloudlab.in", v: 5 },
          { l: "rahul@cloudlab.in", v: 3 },
          { l: "admin@cloudlab.in", v: 2 },
        ],
      },
    ];
  }
  if (name.includes("Azure AD") || name.includes("Identity")) {
    return [
      {
        title: "Sign-ins by result",
        type: "bar",
        data: [
          { l: "Success", v: 18420, c: "#107c10" },
          { l: "Failure", v: 412, c: "#cf2030" },
          { l: "Interrupted", v: 128, c: "#d97900" },
        ],
      },
      {
        title: "Risky sign-ins by risk level",
        type: "bar",
        data: [
          { l: "High", v: 14, c: "#cf2030" },
          { l: "Medium", v: 48, c: "#d97900" },
          { l: "Low", v: 127, c: "#f7b500" },
        ],
      },
      {
        title: "Conditional Access policy hits",
        type: "bar",
        data: [
          { l: "Require MFA", v: 7820 },
          { l: "Block legacy auth", v: 412 },
          { l: "Geo-block", v: 24 },
        ],
      },
      { title: "Sign-ins over time", type: "line" },
    ];
  }
  if (name.includes("Office 365") || name.includes("Exchange") || name.includes("SharePoint")) {
    return [
      {
        title: "OfficeActivity by record type",
        type: "bar",
        data: [
          { l: "AzureActiveDirectory", v: 8420 },
          { l: "Exchange", v: 14200 },
          { l: "SharePoint", v: 9120 },
          { l: "OneDrive", v: 6240 },
        ],
      },
      {
        title: "Top mailbox audit operations",
        type: "bar",
        data: [
          { l: "MailItemsAccessed", v: 12880 },
          { l: "Send", v: 3240 },
          { l: "SoftDelete", v: 412 },
          { l: "HardDelete", v: 38 },
        ],
      },
      { title: "Exchange operations trend", type: "line" },
    ];
  }
  if (name.includes("MITRE")) {
    return [
      {
        title: "Coverage by tactic",
        type: "bar",
        data: [
          { l: "Initial Access", v: 8, c: "#0078d4" },
          { l: "Execution", v: 5, c: "#0078d4" },
          { l: "Persistence", v: 4, c: "#0078d4" },
          { l: "Privilege Escalation", v: 3, c: "#0078d4" },
          { l: "Defense Evasion", v: 5, c: "#0078d4" },
          { l: "Credential Access", v: 6, c: "#0078d4" },
          { l: "Lateral Movement", v: 2, c: "#0078d4" },
          { l: "Exfiltration", v: 3, c: "#0078d4" },
          { l: "Impact", v: 2, c: "#0078d4" },
        ],
      },
    ];
  }
  if (name.includes("Threat Intelligence")) {
    return [
      {
        title: "Indicators by type",
        type: "bar",
        data: [
          { l: "IPv4", v: 412 },
          { l: "Domain", v: 2204 },
          { l: "URL", v: 5796 },
          { l: "FileHash", v: 0 },
        ],
      },
      { title: "TI matches over time", type: "line" },
    ];
  }
  if (name.includes("Linux")) {
    return [
      {
        title: "Syslog facility distribution",
        type: "bar",
        data: [
          { l: "auth", v: 8420 },
          { l: "cron", v: 3120 },
          { l: "daemon", v: 1210 },
          { l: "kern", v: 240 },
        ],
      },
      {
        title: "Top hosts",
        type: "bar",
        data: [
          { l: "app-srv-01", v: 8420 },
          { l: "web-front-01", v: 3120 },
        ],
      },
    ];
  }
  if (name.includes("Windows")) {
    return [
      {
        title: "Top Event IDs",
        type: "bar",
        data: [
          { l: "4624 - Logon", v: 24200 },
          { l: "4625 - Failed logon", v: 412 },
          { l: "4688 - New process", v: 18420 },
          { l: "4720 - User created", v: 14 },
        ],
      },
      {
        title: "Events per host",
        type: "bar",
        data: [
          { l: "WIN-DC01", v: 14200 },
          { l: "FILE-SRV-01", v: 9120 },
          { l: "LAPTOP-SNEHA", v: 1820 },
        ],
      },
    ];
  }
  // generic fallback
  return [
    {
      title: "Data summary",
      type: "bar",
      data: [
        { l: "Series A", v: 120 },
        { l: "Series B", v: 340 },
        { l: "Series C", v: 80 },
      ],
    },
    { title: "Trend", type: "line" },
  ];
}

function BarChart({ title, data }: { title: string; data: { l: string; v: number; c?: string }[] }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className={styles.chart}>
      <h4>{title}</h4>
      {data.map((d) => {
        const pct = (d.v / max) * 100;
        return (
          <div className={styles.barRow} key={d.l}>
            <span className={styles.barRowLbl}>{d.l}</span>
            <span className={styles.barRowBar}>
              <span className={styles.barRowFill} style={{ width: `${pct}%`, ...(d.c ? { background: d.c } : {}) }} />
            </span>
            <span className={styles.barRowVal}>{formatNum(d.v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ title, seed }: { title: string; seed: number }) {
  const w = 720;
  const h = 130;
  const series = seededTrend(seed);
  const pts = series.map((v, i) => ({ x: i * (w / 29), y: h - v }));
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${poly} ${w},${h}`;
  return (
    <div className={styles.chart}>
      <h4>{title}</h4>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={140} preserveAspectRatio="none">
        <polyline fill="none" stroke="#0078d4" strokeWidth={2} points={poly} />
        <polyline fill="#0078d4" fillOpacity={0.12} stroke="none" points={area} />
      </svg>
    </div>
  );
}

function WorkbookViewer({
  workbook,
  pinned,
  onBack,
  onTogglePin,
}: {
  workbook: SentinelWorkbook;
  pinned: boolean;
  onBack: () => void;
  onTogglePin: () => void;
}) {
  const [params, setParams] = useState<WorkbookParams>(DEFAULT_PARAMS);
  const seed = hashSeed(workbook.id);
  const sections = wbSections(workbook);

  function setParam(key: keyof WorkbookParams, value: string) {
    setParams((p) => ({ ...p, [key]: value }));
    toast.info(`Parameter ${key} = ${value}`);
  }

  function handleSave() {
    toast.success(`Workbook saved at ${new Date().toLocaleTimeString()}`);
  }

  function handleEdit() {
    toast.info("Edit mode toggled");
  }

  return (
    <div>
      <button type="button" className={styles.btnOutline} style={{ marginBottom: 10 }} onClick={onBack}>
        &larr; Back to gallery
      </button>

      <div className={styles.card} style={{ background: "#0078d4", color: "#fff", borderColor: "#0078d4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Workbook</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{workbook.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
              {workbook.description} &middot; {workbook.publisher} &middot; v{workbook.version}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={styles.btnOutline} style={{ background: "#fff" }} onClick={handleSave}>
              Save
            </button>
            <button type="button" className={styles.btnOutline} style={{ background: "#fff" }} onClick={handleEdit}>
              Edit
            </button>
            <button type="button" className={styles.btnOutline} style={{ background: "#fff" }} onClick={onTogglePin}>
              {pinned ? "Unpin from dashboard" : "Pin to dashboard"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 2 }}>Time range</div>
            <NativeSelect
              value={params.timeRange}
              onChange={(v) => setParam("timeRange", v)}
              style={{ width: 200 }}
              options={[
                "Last 30 minutes",
                "Last 1 hour",
                "Last 4 hours",
                "Last 12 hours",
                "Last 24 hours",
                "Last 7 days",
                "Last 30 days",
              ].map((o) => ({ value: o, label: o }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 2 }}>Workspace</div>
            <NativeSelect
              value={params.workspace}
              onChange={(v) => setParam("workspace", v)}
              style={{ width: 200 }}
              options={[{ value: "cloudlab-sentinel-ws", label: "cloudlab-sentinel-ws" }]}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 2 }}>Subscription</div>
            <NativeSelect
              value={params.subscription}
              onChange={(v) => setParam("subscription", v)}
              style={{ width: 200 }}
              options={[{ value: "CloudLab-Training-Sub", label: "CloudLab-Training-Sub" }]}
            />
          </div>
        </div>
      </div>

      {sections.map((s) =>
        s.type === "bar" ? <BarChart key={s.title} title={s.title} data={s.data} /> : <LineChart key={s.title} title={s.title} seed={seed} />,
      )}
    </div>
  );
}

export function WorkbooksPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [tab, setTab] = useState<GalleryTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? state.workbooks.find((w) => w.id === selectedId) ?? null : null;

  if (selected) {
    return (
      <WorkbookViewer
        workbook={selected}
        pinned={state.pinnedWorkbooks.includes(selected.id)}
        onBack={() => setSelectedId(null)}
        onTogglePin={() => dispatch({ type: "TOGGLE_WORKBOOK_PIN", id: selected.id })}
      />
    );
  }

  const installedCount = state.workbooks.filter((w) => w.installed).length;
  const savedCount = state.pinnedWorkbooks.length;
  const templatesCount = state.workbooks.length - installedCount;

  const query = search.trim().toLowerCase();
  const workbooks = state.workbooks
    .filter((w) => {
      if (tab === "saved") return state.pinnedWorkbooks.includes(w.id);
      if (tab === "templates") return !w.installed;
      return true;
    })
    .filter((w) => {
      if (!query) return true;
      return (
        w.name.toLowerCase().includes(query) ||
        w.publisher.toLowerCase().includes(query) ||
        w.dataSource.toLowerCase().includes(query) ||
        w.categories.some((c) => c.toLowerCase().includes(query))
      );
    });

  return (
    <div>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statVal}>{state.workbooks.length}</div>
          <div className={styles.statLabel}>Available workbooks</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{installedCount}</div>
          <div className={styles.statLabel}>Saved workbooks</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{templatesCount}</div>
          <div className={styles.statLabel}>Templates</div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === "all" ? styles.tabActive : ""}`} onClick={() => setTab("all")}>
          All ({state.workbooks.length})
        </button>
        <button type="button" className={`${styles.tab} ${tab === "saved" ? styles.tabActive : ""}`} onClick={() => setTab("saved")}>
          Saved ({savedCount})
        </button>
        <button type="button" className={`${styles.tab} ${tab === "templates" ? styles.tabActive : ""}`} onClick={() => setTab("templates")}>
          Templates ({templatesCount})
        </button>
      </div>

      <div className={styles.filterRow}>
        <input
          className={styles.input}
          style={{ maxWidth: 320 }}
          type="text"
          placeholder="Search workbooks by name, publisher, or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tileGrid}>
        {workbooks.map((w) => (
          <div key={w.id} className={styles.tile} onClick={() => setSelectedId(w.id)}>
            <div className={styles.tileTitle}>{w.name}</div>
            <div className={styles.tileSub}>{w.description}</div>
            <div className={styles.tileFoot}>
              {w.installed ? <span className={`${styles.pill} ${styles.pillSuccess}`}>Saved</span> : <span className={`${styles.pill} ${styles.pillMuted}`}>Template</span>}
              {" · "}
              {w.publisher}
              {" · "}
              {w.categories.join(", ")}
            </div>
          </div>
        ))}
        {workbooks.length === 0 ? <div className={styles.empty}>No workbooks match this filter.</div> : null}
      </div>
    </div>
  );
}
