"use client";

// Watchlists (read/reference browsing) + Threat Intelligence (indicators +
// feeds) — ported from itbd-lab/simulators/sentinel/js/sentinel-watchlists-ti.js
// renderWatchlists()/renderThreatIntel(). Per the sub-phase's reconciliation
// decision, this file does NOT re-derive watchlist data from source (source's
// seedWatchlists() there is a second, structurally-incompatible model that was
// intentionally dropped) — `state.watchlists` here comes exclusively from the
// sentinel-data.js-derived shape already seeded in seedData.ts
// (buildWatchlists()). Only the Threat Intelligence indicator/feed shapes and
// the general "lookup table you reference in KQL" watchlist UX are ported
// from that file.
//
// Watchlists are read-heavy in this data model (there is no watchlist CRUD
// action in sentinelReducer) — matching the real Sentinel product's watchlist
// browsing experience, where most day-to-day interaction is looking up rows,
// not editing them in-portal. "+ New watchlist" is intentionally omitted here
// (see report) rather than wired to a no-op action, to avoid implying a
// creation flow this data model doesn't back.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  SentinelState,
  SentinelTiConfidence,
  SentinelTiIndicator,
  SentinelTiIndicatorType,
  SentinelWatchlist,
  SentinelWatchlistItem,
} from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatRow,
  StatusPill,
  statusTone,
} from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

// ===================== Watchlists =====================

// Confidence-style severity coloring for watchlists isn't applicable (they
// have no severity field) — rows are plain reference data, matching source's
// plain `<td>` watchlist table (no badges).

function watchlistKqlExample(wl: SentinelWatchlist): string {
  return `// Reference the '${wl.name}' watchlist in a query\nlet list = (_GetWatchlist('${wl.name}') | project ${wl.searchKey});\n<YourTable>\n| where ${wl.searchKey} in (list)`;
}

function WatchlistContentTable({ content }: { content: SentinelWatchlistItem[] }) {
  const columns = useMemo<string[]>(() => {
    const keys = new Set<string>();
    for (const row of content) {
      for (const key of Object.keys(row)) keys.add(key);
    }
    return Array.from(keys);
  }, [content]);

  const tableColumns: DataTableColumn<SentinelWatchlistItem>[] = columns.map((col) => ({
    key: col,
    header: col,
    render: (row) => row[col] ?? "",
  }));

  return (
    <DataTable
      columns={tableColumns}
      rows={content}
      getRowKey={(row) => `${content.indexOf(row)}-${columns.map((c) => row[c]).join("|")}`}
      emptyMessage="No sample rows."
    />
  );
}

function WatchlistDetailFlyout({ watchlist, onClose }: { watchlist: SentinelWatchlist; onClose: () => void }) {
  return (
    <Flyout title={watchlist.name} subtitle={`${watchlist.provider} · ${watchlist.itemCount} items`} onClose={onClose}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Description</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#424242" }}>{watchlist.description}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#605e5c" }}>Provider</div>
          <strong>{watchlist.provider}</strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Item count</div>
          <strong>{watchlist.itemCount}</strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Last updated</div>
          <strong>{watchlist.lastUpdated}</strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Search key</div>
          <strong style={{ fontFamily: "Consolas, monospace" }}>{watchlist.searchKey}</strong>
        </div>
      </div>

      <div className={styles.h3}>Sample data</div>
      {watchlist.content.length > 0 ? (
        <WatchlistContentTable content={watchlist.content} />
      ) : (
        <EmptyState message="This watchlist is backed by an external feed with no local sample data — it's a metadata pointer to a larger dataset (e.g. an HR/OSINT feed) rather than a small hand-authored list." />
      )}

      <div className={styles.h3} style={{ marginTop: 20 }}>
        KQL usage example
      </div>
      <pre className={styles.kql} style={{ minHeight: "auto" }}>
        {watchlistKqlExample(watchlist)}
      </pre>
    </Flyout>
  );
}

export function WatchlistsPage({ state }: { state: SentinelState }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (state.watchlists.find((w) => w.id === selectedId) ?? null) : null;

  const columns: DataTableColumn<SentinelWatchlist>[] = [
    { key: "name", header: "Name", render: (w) => <span className={styles.rowLink}>{w.name}</span> },
    { key: "provider", header: "Provider", render: (w) => w.provider },
    { key: "itemCount", header: "Items", render: (w) => w.itemCount },
    { key: "lastUpdated", header: "Last updated", render: (w) => w.lastUpdated },
    { key: "description", header: "Description", render: (w) => <span style={{ fontSize: 12, color: "#605e5c" }}>{w.description}</span> },
  ];

  return (
    <div>
      <div className={styles.sub}>Lookup tables you reference in KQL queries and analytics rules. Row click opens the watchlist's sample data and a usage example.</div>

      <DataTable columns={columns} rows={state.watchlists} getRowKey={(w) => w.id} onRowClick={(w) => setSelectedId(w.id)} />

      {selected ? <WatchlistDetailFlyout watchlist={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

// ===================== Threat Intelligence =====================

const TI_TYPES: SentinelTiIndicatorType[] = ["IP", "Domain", "URL", "FileHash", "Email"];
const TI_CONFIDENCE: SentinelTiConfidence[] = ["High", "Medium", "Low"];

function confidenceTone(confidence: SentinelTiConfidence): "err" | "warn" | "ok" {
  if (confidence === "High") return "err";
  if (confidence === "Medium") return "warn";
  return "ok";
}

type IndicatorDraft = {
  type: SentinelTiIndicatorType;
  value: string;
  threatType: string;
  confidence: SentinelTiConfidence;
  source: string;
  tags: string;
};

const EMPTY_DRAFT: IndicatorDraft = { type: "IP", value: "", threatType: "", confidence: "Medium", source: "Manual entry", tags: "" };

function AddIndicatorModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<SentinelAction> }) {
  const [draft, setDraft] = useState<IndicatorDraft>(EMPTY_DRAFT);

  function save() {
    const value = draft.value.trim();
    if (!value) {
      toast.error("Indicator value is required.");
      return;
    }
    const now = new Date().toISOString();
    const indicator: SentinelTiIndicator = {
      id: "ti-" + crypto.randomUUID(),
      type: draft.type,
      value,
      threatType: draft.threatType.trim() || "Generic",
      confidence: draft.confidence,
      source: draft.source.trim() || "Manual entry",
      firstSeen: now,
      lastSeen: now,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      active: true,
    };
    dispatch({ type: "ADD_TI_INDICATOR", indicator });
    toast.success(`Indicator added: ${indicator.type} = ${indicator.value}`);
    onClose();
  }

  return (
    <Modal title="Add threat intelligence indicator" onClose={onClose} footer={
      <>
        <button type="button" className={styles.btnOutline} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.btn} onClick={save}>
          Add indicator
        </button>
      </>
    }>
      <Field label="Type">
        <NativeSelect value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v as SentinelTiIndicatorType }))} options={TI_TYPES.map((t) => ({ value: t, label: t }))} />
      </Field>
      <Field label="Value" help="IP address, domain, URL, file hash, or email address.">
        <input className={styles.input} value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} placeholder="e.g. 198.51.100.34" />
      </Field>
      <Field label="Threat type" help="e.g. C2, Malware, Phishing, TOR, Botnet, APT">
        <input className={styles.input} value={draft.threatType} onChange={(e) => setDraft((d) => ({ ...d, threatType: e.target.value }))} placeholder="C2" />
      </Field>
      <Field label="Confidence">
        <NativeSelect value={draft.confidence} onChange={(v) => setDraft((d) => ({ ...d, confidence: v as SentinelTiConfidence }))} options={TI_CONFIDENCE.map((c) => ({ value: c, label: c }))} />
      </Field>
      <Field label="Source">
        <input className={styles.input} value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Manual entry" />
      </Field>
      <Field label="Tags" help="Comma-separated (e.g. ransomware, CobaltStrike).">
        <input className={styles.input} value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="ransomware, C2" />
      </Field>
    </Modal>
  );
}

function IndicatorsSection({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [showAdd, setShowAdd] = useState(false);
  const indicators = state.threatIntel.indicators;

  function remove(indicator: SentinelTiIndicator) {
    dispatch({ type: "DELETE_TI_INDICATOR", id: indicator.id });
    toast.success(`Indicator removed: ${indicator.value}`);
  }

  const columns: DataTableColumn<SentinelTiIndicator>[] = [
    { key: "type", header: "Type", render: (i) => <span className={styles.pill}>{i.type}</span> },
    { key: "value", header: "Value", render: (i) => <span style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>{i.value}</span> },
    { key: "threatType", header: "Threat type", render: (i) => i.threatType },
    { key: "confidence", header: "Confidence", render: (i) => <StatusPill tone={confidenceTone(i.confidence)}>{i.confidence}</StatusPill> },
    { key: "source", header: "Source", render: (i) => <span style={{ fontSize: 12, color: "#605e5c" }}>{i.source}</span> },
    { key: "firstSeen", header: "First seen", render: (i) => i.firstSeen },
    { key: "lastSeen", header: "Last seen", render: (i) => i.lastSeen },
    {
      key: "tags",
      header: "Tags",
      render: (i) => (
        <>
          {i.tags.map((t) => (
            <span key={t} className={styles.pill} style={{ marginRight: 4 }}>
              {t}
            </span>
          ))}
        </>
      ),
    },
    { key: "active", header: "Active", render: (i) => <StatusPill tone={i.active ? "ok" : "muted"}>{i.active ? "Active" : "Inactive"}</StatusPill> },
    {
      key: "actions",
      header: "",
      render: (i) => (
        <button
          type="button"
          className={styles.btnOutline}
          style={{ padding: "3px 8px", fontSize: 11 }}
          onClick={(e) => {
            e.stopPropagation();
            remove(i);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button type="button" className={styles.btn} onClick={() => setShowAdd(true)}>
          + Add indicator
        </button>
      </div>

      {indicators.length === 0 ? (
        <EmptyState message="No indicators yet." />
      ) : (
        <DataTable columns={columns} rows={indicators} getRowKey={(i) => i.id} />
      )}

      {showAdd ? <AddIndicatorModal dispatch={dispatch} onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}

function FeedsSection({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const feeds = state.threatIntel.feeds;

  const columns: DataTableColumn<(typeof feeds)[number]>[] = [
    { key: "name", header: "Name", render: (f) => <strong>{f.name}</strong> },
    { key: "provider", header: "Provider", render: (f) => f.provider },
    { key: "status", header: "Status", render: (f) => <StatusPill tone={statusTone(f.status)}>{f.status}</StatusPill> },
    { key: "indicatorCount", header: "Indicators", render: (f) => f.indicatorCount.toLocaleString() },
    { key: "lastSync", header: "Last sync", render: (f) => f.lastSync },
    {
      key: "actions",
      header: "",
      render: (f) => (
        <button
          type="button"
          className={styles.btnOutline}
          style={{ padding: "3px 8px", fontSize: 11 }}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "TOGGLE_TI_FEED", id: f.id });
            toast.success(f.status === "Connected" ? `${f.name} disconnected` : `${f.name} connected`);
          }}
        >
          {f.status === "Connected" ? "Disconnect" : "Connect"}
        </button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={feeds} getRowKey={(f) => f.id} />;
}

export function ThreatIntelPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [tab, setTab] = useState<"indicators" | "feeds">("indicators");

  const totalIndicators = state.threatIntel.indicators.length;
  const activeIndicators = state.threatIntel.indicators.filter((i) => i.active).length;
  const connectedFeeds = state.threatIntel.feeds.filter((f) => f.status === "Connected").length;

  return (
    <div>
      <div className={styles.sub}>STIX 2.x / TAXII 2.x compatible. Ingest indicators of compromise from feeds, match them against your data.</div>

      <StatRow
        stats={[
          { label: "Total indicators", value: totalIndicators },
          { label: "Active indicators", value: activeIndicators },
          { label: "Connected feeds", value: `${connectedFeeds} / ${state.threatIntel.feeds.length}` },
        ]}
      />

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === "indicators" ? styles.tabActive : ""}`} onClick={() => setTab("indicators")}>
          Indicators
        </button>
        <button type="button" className={`${styles.tab} ${tab === "feeds" ? styles.tabActive : ""}`} onClick={() => setTab("feeds")}>
          Feeds
        </button>
      </div>

      {tab === "indicators" ? <IndicatorsSection state={state} dispatch={dispatch} /> : <FeedsSection state={state} dispatch={dispatch} />}
    </div>
  );
}
