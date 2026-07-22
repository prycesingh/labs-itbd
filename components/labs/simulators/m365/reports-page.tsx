"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { M365State } from "@/lib/labs/simulators/m365/types";
import { BarListCard, ChartCard, CircularGauge, Pill, StatRow } from "./m365-ui";
import styles from "./m365-console.module.css";

const TIME_RANGES = [7, 30, 90, 180] as const;

const SERIES_LENGTH = 30;
const SEED = 20260709;

function nextRand(seed: number): number {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}

function buildSeries(seed: number, length: number, base: number, spread: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < length; i++) {
    s = nextRand(s);
    const jitter = (s % 1000) / 1000;
    out.push(Math.round(base + jitter * spread));
  }
  return out;
}

type SyntheticSeries = {
  emailSent: number[];
  teamsActiveUsers: number[];
  oneDriveFilesShared: number[];
  sharepointFilesViewed: number[];
};

function buildAllSeries(seed: number): SyntheticSeries {
  return {
    emailSent: buildSeries(seed, SERIES_LENGTH, 1800, 900),
    teamsActiveUsers: buildSeries(seed + 1, SERIES_LENGTH, 60, 40),
    oneDriveFilesShared: buildSeries(seed + 2, SERIES_LENGTH, 320, 180),
    sharepointFilesViewed: buildSeries(seed + 3, SERIES_LENGTH, 540, 260),
  };
}

function maskUser(name: string, index: number, anon: boolean): string {
  return anon ? `User ${index + 1}` : name;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

type ReportKey =
  | "apps-usage"
  | "email-activity"
  | "mailbox-usage"
  | "teams-activity"
  | "onedrive-activity"
  | "sharepoint-usage"
  | "groups-activity"
  | "adoption-score"
  | "network-connectivity"
  | "active-users"
  | "settings";

type ReportTile = { key: ReportKey; title: string; kpi: (state: M365State, series: SyntheticSeries) => string };

const REPORT_TILES: ReportTile[] = [
  { key: "apps-usage", title: "Microsoft 365 apps usage", kpi: (s) => `${s.users.filter((u) => u.accountEnabled).length} active app users` },
  { key: "email-activity", title: "Email activity", kpi: (_s, series) => `${sum(series.emailSent).toLocaleString()} sent (30d)` },
  { key: "mailbox-usage", title: "Mailbox usage", kpi: (s) => `${s.exchange.mailboxes.length} mailboxes` },
  { key: "teams-activity", title: "Teams activity", kpi: (s) => `${s.teams.filter((t) => !t.archived).length} active teams` },
  { key: "onedrive-activity", title: "OneDrive activity", kpi: (_s, series) => `${sum(series.oneDriveFilesShared).toLocaleString()} files shared (30d)` },
  { key: "sharepoint-usage", title: "SharePoint site usage", kpi: (s) => `${s.sharepointSites.length} active sites` },
  { key: "groups-activity", title: "Microsoft 365 groups activity", kpi: (s) => `${s.groups.filter((g) => g.type === "Microsoft 365").length} groups` },
  { key: "active-users", title: "Microsoft 365 active users", kpi: (s) => `${s.users.filter((u) => u.accountEnabled).length} of ${s.users.length} active` },
  { key: "adoption-score", title: "Adoption Score", kpi: () => "62 / 100" },
  { key: "network-connectivity", title: "Network connectivity", kpi: () => "8 offices monitored" },
];

const ADOPTION_CATEGORIES: { name: string; current: number; max: number; driver: string }[] = [
  { name: "Communication", current: 78, max: 100, driver: "Teams chats and Outlook email volume are strong; Yammer usage remains low." },
  { name: "Meetings", current: 82, max: 100, driver: "High Teams meeting volume with most cameras on during calls." },
  { name: "Content collaboration", current: 68, max: 100, driver: "Most files now live in OneDrive/SharePoint, some network-share holdouts remain." },
  { name: "Teamwork", current: 65, max: 100, driver: "Several Teams show no activity in 30+ days and should be reviewed for archiving." },
  { name: "Mobility", current: 71, max: 100, driver: "Mobile sign-ins are a growing share of total activity across Outlook and Teams." },
];

type OfficeRow = { city: string; country: string; latencyMs: number; bandwidthMbps: number };

const OFFICES: OfficeRow[] = [
  { city: "Bengaluru HQ", country: "India", latencyMs: 12, bandwidthMbps: 1000 },
  { city: "Pune", country: "India", latencyMs: 18, bandwidthMbps: 500 },
  { city: "Mumbai", country: "India", latencyMs: 24, bandwidthMbps: 200 },
  { city: "Delhi", country: "India", latencyMs: 28, bandwidthMbps: 200 },
  { city: "Hyderabad", country: "India", latencyMs: 22, bandwidthMbps: 200 },
  { city: "Chennai", country: "India", latencyMs: 38, bandwidthMbps: 100 },
];

function officeScore(o: OfficeRow): "Good" | "Fair" | "Poor" {
  if (o.latencyMs <= 25 && o.bandwidthMbps >= 200) return "Good";
  if (o.latencyMs <= 40) return "Fair";
  return "Poor";
}

export function ReportsPage({ state }: { state: M365State }) {
  const [range, setRange] = useState<number>(30);
  const [selected, setSelected] = useState<ReportKey | null>(null);
  const [anon, setAnon] = useState(false);
  const [seedTick, setSeedTick] = useState(0);

  const series = useMemo(() => buildAllSeries(SEED + seedTick), [seedTick]);

  const refreshData = () => {
    setSeedTick((t) => t + 1);
    toast.success("Report data refreshed.");
  };

  const mailboxRows = state.exchange.mailboxes.slice(0, 8);
  const siteRows = state.sharepointSites.slice(0, 8);
  const teamRows = state.teams.slice(0, 8);
  const groupRows = state.groups.filter((g) => g.type === "Microsoft 365").slice(0, 8);

  if (selected === "settings") {
    return (
      <div>
        <h1 className={styles.pageH1}>Reports settings</h1>
        <p className={styles.pageSub}>Control how report data is displayed and refreshed.</p>
        <button type="button" className={styles.btnSubtle} onClick={() => setSelected(null)}>
          ← Back to reports
        </button>
        <div className={styles.card} style={{ marginTop: 12 }}>
          <div className={styles.cardTitle}>Display anonymous identifiers</div>
          <div className={styles.checkboxRow}>
            <input type="checkbox" id="anonToggle" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            <label htmlFor="anonToggle">Mask user names in report tables (User 1, User 2, …)</label>
          </div>
        </div>
        <div className={styles.card} style={{ marginTop: 12 }}>
          <div className={styles.cardTitle}>Report cache</div>
          <p className={styles.pageSub} style={{ marginBottom: 10 }}>Regenerate the synthetic usage series backing the charts on this page.</p>
          <button type="button" className={styles.btn} onClick={refreshData}>
            Refresh data now
          </button>
        </div>
      </div>
    );
  }

  if (selected) {
    const tile = REPORT_TILES.find((t) => t.key === selected);
    return (
      <div>
        <h1 className={styles.pageH1}>{tile?.title ?? "Report"}</h1>
        <button type="button" className={styles.btnSubtle} onClick={() => setSelected(null)}>
          ← Back to reports
        </button>

        {selected === "apps-usage" ? (
          <>
            <StatRow
              stats={[
                { label: "Licensed users", value: state.users.filter((u) => u.licenses.length > 0).length },
                { label: "Total users", value: state.users.length },
                { label: "M365 licenses", value: state.licenses.length },
              ]}
            />
            <BarListCard
              title="Licenses by purchased seats"
              rows={state.licenses.slice(0, 8).map((l) => ({ label: l.name, value: l.purchased }))}
            />
          </>
        ) : null}

        {selected === "email-activity" ? (
          <>
            <StatRow
              stats={[
                { label: "Emails sent (30d)", value: sum(series.emailSent).toLocaleString() },
                { label: "Mailboxes", value: state.exchange.mailboxes.length },
                { label: "Transport rules", value: state.exchange.transportRules.length },
              ]}
            />
            <ChartCard title="Emails sent per day" series={series.emailSent} />
          </>
        ) : null}

        {selected === "mailbox-usage" ? (
          <>
            <StatRow
              stats={[
                { label: "Mailboxes", value: state.exchange.mailboxes.length },
                { label: "On litigation hold", value: state.exchange.mailboxes.filter((m) => m.litigationHold).length },
              ]}
            />
            <div className={styles.tableWrap} style={{ marginTop: 12 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Display name</th>
                    <th>Type</th>
                    <th>Size (MB)</th>
                    <th>Quota (GB)</th>
                  </tr>
                </thead>
                <tbody>
                  {mailboxRows.length ? (
                    mailboxRows.map((m, i) => (
                      <tr key={m.email}>
                        <td>{maskUser(m.displayName, i, anon)}</td>
                        <td>{m.type}</td>
                        <td>{m.sizeMB.toLocaleString()}</td>
                        <td>{m.quotaGB}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.center}>No mailboxes.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {selected === "teams-activity" ? (
          <>
            <StatRow
              stats={[
                { label: "Active users (avg/day)", value: Math.round(sum(series.teamsActiveUsers) / SERIES_LENGTH) },
                { label: "Teams", value: state.teams.length },
                { label: "Active teams", value: state.teams.filter((t) => !t.archived).length },
              ]}
            />
            <ChartCard title="Teams active users per day" series={series.teamsActiveUsers} />
            <BarListCard title="Members by team" rows={teamRows.map((t) => ({ label: t.name, value: t.members }))} />
          </>
        ) : null}

        {selected === "onedrive-activity" ? (
          <>
            <StatRow
              stats={[
                { label: "Files shared (30d)", value: sum(series.oneDriveFilesShared).toLocaleString() },
                { label: "Users", value: state.users.filter((u) => u.accountEnabled).length },
              ]}
            />
            <ChartCard title="OneDrive files shared per day" series={series.oneDriveFilesShared} />
          </>
        ) : null}

        {selected === "sharepoint-usage" ? (
          <>
            <StatRow
              stats={[
                { label: "Files viewed (30d)", value: sum(series.sharepointFilesViewed).toLocaleString() },
                { label: "Sites", value: state.sharepointSites.length },
              ]}
            />
            <ChartCard title="Files viewed or edited per day" series={series.sharepointFilesViewed} />
            <BarListCard title="Storage used by site (GB)" rows={siteRows.map((s) => ({ label: s.name, value: Math.round(s.storageGB), max: s.quotaGB }))} />
          </>
        ) : null}

        {selected === "groups-activity" ? (
          <>
            <StatRow
              stats={[
                { label: "Microsoft 365 groups", value: state.groups.filter((g) => g.type === "Microsoft 365").length },
                { label: "All groups", value: state.groups.length },
              ]}
            />
            <BarListCard title="Members by group" rows={groupRows.map((g) => ({ label: g.name, value: g.members.length }))} />
          </>
        ) : null}

        {selected === "active-users" ? (
          <>
            <StatRow
              stats={[
                { label: "Active", value: state.users.filter((u) => u.accountEnabled).length },
                { label: "Blocked", value: state.users.filter((u) => !u.accountEnabled).length },
                { label: "MFA enabled", value: state.users.filter((u) => u.mfaEnabled).length },
              ]}
            />
            <div className={styles.tableWrap} style={{ marginTop: 12 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Display name</th>
                    <th>Department</th>
                    <th>Last sign-in</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.slice(0, 8).map((u, i) => (
                    <tr key={u.id}>
                      <td>{maskUser(u.displayName, i, anon)}</td>
                      <td>{u.department}</td>
                      <td>{new Date(u.lastSignIn).toLocaleDateString()}</td>
                      <td>{u.accountEnabled ? <Pill tone="ok">Active</Pill> : <Pill tone="err">Blocked</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {selected === "adoption-score" ? (
          <>
            <div className={styles.card} style={{ marginTop: 12 }}>
              <CircularGauge current={62} max={100} label="Adoption Score" />
            </div>
            <div className={styles.h2}>Category breakdown</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {ADOPTION_CATEGORIES.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.current} / {c.max}</td>
                      <td>{c.driver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {selected === "network-connectivity" ? (
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Office</th>
                  <th>Country</th>
                  <th>Latency</th>
                  <th>Bandwidth</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {OFFICES.map((o) => {
                  const scoreLabel = officeScore(o);
                  const tone = scoreLabel === "Good" ? "ok" : scoreLabel === "Fair" ? "warn" : "err";
                  return (
                    <tr key={o.city}>
                      <td>{o.city}</td>
                      <td>{o.country}</td>
                      <td>{o.latencyMs} ms</td>
                      <td>{o.bandwidthMbps} Mbps</td>
                      <td><Pill tone={tone}>{scoreLabel}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Reports</h1>
      <p className={styles.pageSub}>Usage and adoption reports for {state.tenant.name}.</p>

      <div className={styles.filterRow}>
        {TIME_RANGES.map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.filterChip} ${range === d ? styles.filterChipActive : ""}`}
            onClick={() => setRange(d)}
          >
            Last {d} days
          </button>
        ))}
        <button type="button" className={styles.btnSubtle} onClick={() => setSelected("settings")}>
          Report settings
        </button>
      </div>

      <div className={styles.cardGrid}>
        {REPORT_TILES.map((t) => (
          <div key={t.key} className={styles.tile} onClick={() => setSelected(t.key)}>
            <div className={styles.tileTitle}>{t.title}</div>
            <div className={styles.tileSub}>{t.kpi(state, series)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
