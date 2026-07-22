"use client";

// Artifacts / Feeds page for the Azure DevOps simulator. Ported from
// itbd-lab/simulators/azure-devops/js/ado-artifacts.js — a feed tree
// (npm-internal/nuget-internal/maven-internal) + per-feed package list +
// package detail modal (version history with an arithmetic download split,
// NOT random data) + a "Connect to feed" modal that generates real
// .npmrc/nuget.config/Maven settings.xml snippets per feed type.
//
// Source's create/manage affordances here (`+ Create feed`, `Retention`,
// `Permissions`, `+ Add upstream source`) have no onclick handlers at all in
// ado-artifacts.js — they're decoration. This port keeps that scope: those
// buttons fire a `toast.info(...)` only, they do not dispatch ADD_FEED /
// ADD_PACKAGE (those reducer actions exist for other agents/flows to use,
// not because this page fabricates fake CRUD around them).

import { useState } from "react";

import type { AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import type { AdoFeed, AdoPackage } from "@/lib/labs/simulators/azure-devops/types";
import { toast } from "sonner";

import { DataTable, Modal, StatusPill } from "./ado-ui";
import styles from "./ado-console.module.css";

// ===== Connect-to-feed snippet templates =====
// Ported verbatim from ado-artifacts.js `renderConnectSnippet(type)` — the
// exact registry URLs / XML shown to the user when they want to configure
// their local package manager against one of the seeded feeds. Source keys
// this by `feed.type` ('npm' | 'nuget' | otherwise treated as maven); the
// URLs/artifact ids in the snippets are the source's fixed org
// ("cloudlab-training") — not derived from feed.name, matching source.
type ConnectSnippet = { fileLabel: string; fileSnippet: string; usageLabel: string; usageSnippet: string };

function connectSnippetFor(type: AdoFeed["type"]): ConnectSnippet {
  if (type === "npm") {
    return {
      fileLabel: ".npmrc",
      fileSnippet:
        "registry=https://pkgs.dev.azure.com/cloudlab-training/_packaging/npm-internal/npm/registry/\n" +
        "always-auth=true\n" +
        "\n" +
        "// .npmrc — run \"vsts-npm-auth\" or pipe a PAT to get a token",
      usageLabel: "Install",
      usageSnippet: "npm install --save @cloudlab/ui-components",
    };
  }
  if (type === "NuGet") {
    return {
      fileLabel: "nuget.config",
      fileSnippet:
        '<?xml version="1.0" encoding="utf-8"?>\n' +
        "<configuration>\n" +
        "  <packageSources>\n" +
        '    <add key="cloudlab-internal" value="https://pkgs.dev.azure.com/cloudlab-training/_packaging/nuget-internal/nuget/v3/index.json" />\n' +
        "  </packageSources>\n" +
        "</configuration>",
      usageLabel: "Install",
      usageSnippet: "dotnet add package CloudLab.Auth --version 3.4.0",
    };
  }
  // Maven
  return {
    fileLabel: "~/.m2/settings.xml",
    fileSnippet:
      "<settings>\n" +
      "  <servers>\n" +
      "    <server>\n" +
      "      <id>cloudlab-internal</id>\n" +
      "      <username>cloudlab-training</username>\n" +
      "      <password>${env.AZURE_ARTIFACTS_PAT}</password>\n" +
      "    </server>\n" +
      "  </servers>\n" +
      "  <profiles>\n" +
      "    <profile>\n" +
      "      <id>cloudlab</id>\n" +
      "      <repositories>\n" +
      "        <repository>\n" +
      "          <id>cloudlab-internal</id>\n" +
      "          <url>https://pkgs.dev.azure.com/cloudlab-training/_packaging/maven-internal/maven/v1</url>\n" +
      "          <releases><enabled>true</enabled></releases>\n" +
      "          <snapshots><enabled>true</enabled></snapshots>\n" +
      "        </repository>\n" +
      "      </repositories>\n" +
      "    </profile>\n" +
      "  </profiles>\n" +
      "</settings>",
    usageLabel: "Dependency",
    usageSnippet:
      "<dependency>\n  <groupId>in.cloudlab</groupId>\n  <artifactId>auth-sdk</artifactId>\n  <version>2.0.0</version>\n</dependency>",
  };
}

async function copySnippet(label: string, snippet: string) {
  try {
    await navigator.clipboard.writeText(snippet);
    toast.success(`${label} copied to clipboard.`);
  } catch {
    toast.error(`Could not copy ${label}.`);
  }
}

function ConnectSnippetBlock({ type }: { type: AdoFeed["type"] }) {
  const snip = connectSnippetFor(type);
  return (
    <div>
      <div className={styles.snipH}>{snip.fileLabel}</div>
      <pre className={styles.snip}>{snip.fileSnippet}</pre>
      <button type="button" className={styles.btnSubtle} onClick={() => copySnippet(snip.fileLabel, snip.fileSnippet)}>
        Copy
      </button>
      <div className={styles.snipH}>{snip.usageLabel}</div>
      <pre className={styles.snip}>{snip.usageSnippet}</pre>
      <button type="button" className={styles.btnSubtle} onClick={() => copySnippet(snip.usageLabel, snip.usageSnippet)}>
        Copy
      </button>
    </div>
  );
}

// ===== Package detail modal =====
// Ported verbatim from ado-artifacts.js `openPackage(feedId, pkgName)` — a
// version-history table where each row's download count is an ARITHMETIC
// split of the package's total downloads, not per-version real data:
// version 0 (latest) gets 55% of total downloads, every other version
// splits the remaining 45% evenly across the rest. `publishedOn` in source
// is fabricated at render time from `i * 14` days back from "now"; this port
// instead uses the seeded `AdoPackageVersion.publishedOn` field directly
// since that's real persisted seed data here (not recomputed each render).
function downloadSplit(totalDownloads: number, index: number, versionCount: number): number {
  const share = index === 0 ? 0.55 : 0.45 / (versionCount - 1 || 1);
  return Math.round(totalDownloads * share);
}

function PackageDetailModal({ feed, pkg, onClose }: { feed: AdoFeed; pkg: AdoPackage; onClose: () => void }) {
  return (
    <Modal title={`Package: ${pkg.name}`} onClose={onClose} width="760px" footer={<button type="button" className={styles.btnOutline} onClick={onClose}>Close</button>}>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Versions
      </div>
      <DataTable<(typeof pkg.versions)[number]>
        columns={[
          {
            key: "version",
            header: "Version",
            render: (v) => (
              <>
                {v.version} {pkg.versions[0].version === v.version ? <StatusPill tone="done">Latest</StatusPill> : null}
              </>
            ),
          },
          { key: "published", header: "Published", render: (v) => v.publishedOn },
          {
            key: "downloads",
            header: "Downloads",
            render: (v) => downloadSplit(pkg.downloads, pkg.versions.indexOf(v), pkg.versions.length).toLocaleString(),
          },
          {
            key: "actions",
            header: "",
            render: () => (
              <button type="button" className={styles.btnLink} onClick={() => toast.info(`Downloading ${pkg.name}…`)}>
                Download
              </button>
            ),
          },
        ]}
        rows={pkg.versions}
        getRowKey={(v) => v.version}
      />

      <div className={styles.h3}>Retention</div>
      <div>
        Retention policy: keep last <strong>3</strong> versions, delete after <strong>180 days</strong> of no downloads.
      </div>

      <div className={styles.h3}>Connect</div>
      <ConnectSnippetBlock type={feed.type} />
    </Modal>
  );
}

// ===== Connect-to-feed modal (toolbar entry point) =====
// Ported from ado-artifacts.js `openConnect()` — a tabbed dialog, one tab per
// seeded feed, each showing that feed's connect snippet.
function ConnectToFeedModal({ feeds, onClose }: { feeds: AdoFeed[]; onClose: () => void }) {
  const [activeFeedId, setActiveFeedId] = useState(feeds[0]?.id ?? "");
  const activeFeed = feeds.find((f) => f.id === activeFeedId) ?? feeds[0];

  return (
    <Modal title="Connect to feed" onClose={onClose} width="720px" footer={<button type="button" className={styles.btnOutline} onClick={onClose}>Close</button>}>
      <div className={styles.tabs}>
        {feeds.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.tab} ${activeFeedId === f.id ? styles.tabActive : ""}`}
            onClick={() => setActiveFeedId(f.id)}
          >
            {f.type}
          </button>
        ))}
      </div>
      {activeFeed ? <ConnectSnippetBlock type={activeFeed.type} /> : null}
    </Modal>
  );
}

// ===== Feed detail (package list) =====
function FeedDetail({
  feed,
  onOpenPackage,
  onOpenConnect,
}: {
  feed: AdoFeed;
  onOpenPackage: (pkg: AdoPackage) => void;
  onOpenConnect: () => void;
}) {
  return (
    <div>
      <div className={styles.h2} style={{ marginTop: 0 }}>
        {feed.name} · {feed.type}
      </div>
      <div className={styles.pageSub}>
        Upstream sources: {feed.upstream.map((u) => (
          <code key={u} className={styles.codeInline}>
            {u}
          </code>
        ))}
      </div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btnSubtle} onClick={onOpenConnect}>
          Connect to feed
        </button>
        <button type="button" className={styles.btnSubtle} onClick={() => toast.info("Retention policy management is not available in this simulator.")}>
          Retention
        </button>
        <button type="button" className={styles.btnSubtle} onClick={() => toast.info("Feed permissions management is not available in this simulator.")}>
          Permissions
        </button>
      </div>
      <DataTable<AdoPackage>
        columns={[
          { key: "name", header: "Package", render: (p) => p.name },
          {
            key: "latest",
            header: "Latest version",
            render: (p) => (
              <>
                {p.versions[0]?.version} <StatusPill tone="done">Latest</StatusPill>
              </>
            ),
          },
          { key: "versions", header: "Versions", render: (p) => p.versions.length },
          { key: "downloads", header: "Downloads", render: (p) => p.downloads.toLocaleString() },
        ]}
        rows={feed.packages}
        getRowKey={(p) => p.name}
        onRowClick={onOpenPackage}
        emptyMessage="No packages published to this feed yet."
      />
    </div>
  );
}

// ===== Main page =====
export function ArtifactsPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  void dispatch; // Reserved for ADD_FEED/ADD_PACKAGE — this page's create/manage
  // affordances are toast-only decoration per source's actual (thin) scope
  // here (ado-artifacts.js's "+ Create feed" etc. have no onclick handlers).

  const feeds = state.feeds;
  const [selectedFeedId, setSelectedFeedId] = useState<string>(feeds[0]?.id ?? "");
  const [openPackage, setOpenPackage] = useState<{ feed: AdoFeed; pkg: AdoPackage } | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId) ?? feeds[0];

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Feeds</div>
      <div className={styles.pageSub}>Internal package feeds (npm, NuGet, Maven).</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => toast.info("Create feed wizard is not available in this simulator.")}>
          + Create feed
        </button>
        <button type="button" className={styles.btnSubtle} onClick={() => setConnectOpen(true)}>
          Connect to feed
        </button>
      </div>

      <div className={styles.afGrid}>
        <div className={styles.afTree}>
          {feeds.map((f) => (
            <div
              key={f.id}
              className={`${styles.afFeed} ${f.id === selectedFeedId ? styles.afFeedActive : ""}`}
              onClick={() => setSelectedFeedId(f.id)}
            >
              <div className={styles.afFeedName}>{f.name}</div>
              <div className={styles.afFeedType}>
                {f.type} · {f.packages.length} packages
              </div>
            </div>
          ))}
        </div>
        <div className={styles.afDetail}>
          {selectedFeed ? (
            <FeedDetail
              feed={selectedFeed}
              onOpenPackage={(pkg) => setOpenPackage({ feed: selectedFeed, pkg })}
              onOpenConnect={() => setConnectOpen(true)}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.h2}>Upstream sources</div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => toast.info("Add upstream source wizard is not available in this simulator.")}>
          + Add upstream source
        </button>
      </div>
      <DataTable<{ feedName: string; upstream: string; type: AdoFeed["type"] }>
        columns={[
          { key: "feedName", header: "Internal feed", render: (r) => r.feedName },
          { key: "upstream", header: "Upstream URL", render: (r) => r.upstream },
          { key: "type", header: "Type", render: (r) => r.type },
          { key: "status", header: "Status", render: () => <StatusPill tone="done">Connected</StatusPill> },
        ]}
        rows={feeds.flatMap((f) => f.upstream.map((u) => ({ feedName: f.name, upstream: u, type: f.type })))}
        getRowKey={(r) => `${r.feedName}-${r.upstream}`}
      />

      {openPackage ? (
        <PackageDetailModal feed={openPackage.feed} pkg={openPackage.pkg} onClose={() => setOpenPackage(null)} />
      ) : null}
      {connectOpen ? <ConnectToFeedModal feeds={feeds} onClose={() => setConnectOpen(false)} /> : null}
    </div>
  );
}
