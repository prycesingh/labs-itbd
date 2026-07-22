"use client";

// Microsoft Copilot Studio page for the Power Platform Admin Center
// simulator. Ported from itbd-lab/simulators/powerplatform/js/pp-copilot.js
// (929 lines): bot list, topics, knowledge sources, actions, a live test-chat
// panel, channels, analytics, and settings — consolidated from source's 12
// tabs (list / topics / authoring / knowledge / actions / genai / testing /
// channels / analytics / security / settings / publish) into 8 sensible
// sections. Authoring canvas, Generative AI settings, Security + governance
// and Publish are folded into Settings as read-only reference sections
// (matching source's own fidelity level — those tabs are static illustrative
// content in source, not real editors/mutations either) rather than kept as
// separate top-level tabs, since the already-built PpCopilotState /
// reducer.ts don't model per-topic authoring canvases, GenAI config, or a
// publish pipeline as real mutable state.
//
// Known source bugs fixed here, not replicated:
// 1. Source's test chat (`var testChat = [...]`) is an in-memory module
//    variable, lost on reload. This port reads/writes
//    `state.copilot.testChat` exclusively via the already-built
//    `SEND_COPILOT_TEST_MESSAGE` reducer action — no local useState array for
//    messages, so chat history survives navigation/reload like every other
//    piece of persisted state in this simulator.
// 2. Source's render() wraps every tab in `pp-content-frame` /
//    `pp-page-head` / `pp-tab-body` — classes with zero matching rules
//    anywhere in the real powerplatform.css (see pp-console.module.css's own
//    header comment). This port uses the real `styles.pageH1` / `styles.pageSub`
//    header classes and `styles.tabs`/`TabBar` that every other page in this
//    port uses.
//
// No native prompt()/alert()/confirm() anywhere — all confirmations route
// through toast (sonner), and the "+ New copilot" flow is a real Modal
// wizard (source's 5-step wizard collapsed to a single-step form, since only
// ADD_COPILOT_BOT exists as a reducer action — no multi-field intermediate
// mutations to stage across wizard steps).
//
// Channel toggling: source's openConnectChannel()/disconnectChannel() mutate
// `state.copilot.channels[key].state`, but no such action exists among the
// 36 already-built PpAction cases (only ADD_COPILOT_BOT and
// SEND_COPILOT_TEST_MESSAGE touch `copilot`). Per the porting brief, channels
// are rendered as a real read-only status list from `state.copilot.channels`
// (`{ name, enabled }[]`) rather than inventing a new mutation.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PpState } from "@/lib/labs/simulators/power-platform/types";
import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import {
  DataTable,
  EmptyState,
  Field,
  Modal,
  NativeSelect,
  StatRow,
  StatusPill,
  TabBar,
  type DataTableColumn,
} from "./pp-ui";
import styles from "./pp-console.module.css";

type Section = "bots" | "topics" | "knowledge" | "actions" | "test-chat" | "channels" | "analytics" | "settings";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "bots", label: "Bots" },
  { key: "topics", label: "Topics" },
  { key: "knowledge", label: "Knowledge sources" },
  { key: "actions", label: "Actions" },
  { key: "test-chat", label: "Test chat" },
  { key: "channels", label: "Channels" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
];

// Ported verbatim from source's `renderNewCopilotWiz()` step-2 language list.
const LANGUAGE_OPTIONS = [
  "English (en-US)",
  "English (en-GB)",
  "Hindi (hi-IN)",
  "Tamil (ta-IN)",
  "Spanish (es-ES)",
  "French (fr-FR)",
  "German (de-DE)",
  "Japanese (ja-JP)",
  "Chinese Simplified (zh-CN)",
];

const ENV_OPTIONS = ["Dev", "Test", "Production"];

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

// Static illustrative analytics content, ported verbatim from source's
// `tabAnalytics()` seed shape (source's `s.analytics.topTopics` /
// `topicUtilization`) — PpCopilotState has no `analytics` field, so this
// mirrors source's own fidelity level (a static reference dashboard) rather
// than fabricating a persisted analytics model.
const TOP_TOPICS = [
  { topic: "VPN connection issue", hits: 247, resolution: "92%" },
  { topic: "Email signature", hits: 198, resolution: "98%" },
  { topic: "Reset password", hits: 174, resolution: "88% (auto via Power Automate)" },
  { topic: "Office 365 license", hits: 142, resolution: "76%" },
  { topic: "New laptop request", hits: 89, resolution: "67% (escalated to procurement)" },
];

export function CopilotStudioPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [section, setSection] = useState<Section>("bots");

  const connectorById = useMemo(() => {
    const map = new Map<string, (typeof state.connectors)[number]>();
    for (const c of state.connectors) map.set(c.id, c);
    return map;
  }, [state.connectors]);

  const envNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const env of state.environments) map.set(env.id, env.name);
    return map;
  }, [state.environments]);

  return (
    <div>
      <div className={styles.pageH1}>Microsoft Copilot Studio</div>
      <div className={styles.pageSub}>
        Build, deploy, and analyze copilots — formerly Power Virtual Agents. Build conversational AI without code.
      </div>

      <TabBar tabs={SECTIONS} active={section} onChange={(key) => setSection(key as Section)} />

      {section === "bots" ? <BotsSection state={state} dispatch={dispatch} envNameById={envNameById} /> : null}
      {section === "topics" ? <TopicsSection state={state} /> : null}
      {section === "knowledge" ? <KnowledgeSection state={state} /> : null}
      {section === "actions" ? <ActionsSection state={state} connectorById={connectorById} /> : null}
      {section === "test-chat" ? <TestChatSection state={state} dispatch={dispatch} /> : null}
      {section === "channels" ? <ChannelsSection state={state} /> : null}
      {section === "analytics" ? <AnalyticsSection /> : null}
      {section === "settings" ? <SettingsSection state={state} /> : null}
    </div>
  );
}

// ===================================================================
// Bots
// ===================================================================

function BotsSection({
  state,
  dispatch,
  envNameById,
}: {
  state: PpState;
  dispatch: React.Dispatch<PpAction>;
  envNameById: Map<string, string>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [envId, setEnvId] = useState(state.environments[0]?.id ?? "");
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0]);

  const bots = state.copilot.copilots;

  function openModal() {
    setName("");
    setEnvId(state.environments[0]?.id ?? "");
    setLanguage(LANGUAGE_OPTIONS[0]);
    setModalOpen(true);
  }

  function createBot() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Copilot name is required");
      return;
    }
    if (bots.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A copilot with that name already exists");
      return;
    }
    dispatch({
      type: "ADD_COPILOT_BOT",
      bot: { id: genId("bot"), name: trimmed, envId, language, status: "Draft", sessions30d: 0 },
    });
    toast.success(`Created ${trimmed}`);
    setModalOpen(false);
  }

  const columns: DataTableColumn<(typeof bots)[number]>[] = [
    { key: "name", header: "Name", render: (b) => <strong>{b.name}</strong> },
    { key: "env", header: "Environment", render: (b) => envNameById.get(b.envId) ?? b.envId },
    { key: "language", header: "Language", render: (b) => b.language },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusPill tone={b.status === "Published" ? "default" : "warn"}>{b.status}</StatusPill>,
    },
    { key: "sessions30d", header: "Sessions (30d)", render: (b) => b.sessions30d },
  ];

  return (
    <div>
      <div className={styles.h3}>Copilots in tenant ({bots.length})</div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={openModal}>
          + New copilot
        </button>
      </div>

      <DataTable columns={columns} rows={bots} getRowKey={(b) => b.id} emptyMessage="No copilots yet." />

      {modalOpen ? (
        <Modal
          title="Create a copilot"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={createBot}>
                Create copilot
              </button>
            </>
          }
        >
          <Field label="Copilot name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance Approval Workflow" />
          </Field>
          <Field label="Environment">
            <NativeSelect
              value={envId}
              onChange={setEnvId}
              options={state.environments.map((e) => ({ value: e.id, label: e.name }))}
            />
          </Field>
          <Field label="Primary language">
            <NativeSelect value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))} />
          </Field>
          <p style={{ fontSize: 12, color: "#605e5c", marginTop: 12 }}>
            Creates a Draft copilot with 4 system topics (Greeting, Confused, End, Escalate). Add custom topics from the Topics
            tab.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// Topics — read-only list, matching source's tabTopics() table fidelity
// (source's "authoring canvas" is a static node-diagram mockup, not a real
// editor, so this port doesn't attempt an "Open canvas" action).
// ===================================================================

function TopicsSection({ state }: { state: PpState }) {
  const topics = state.copilot.topics;
  const columns: DataTableColumn<(typeof topics)[number]>[] = [
    { key: "name", header: "Name", render: (t) => <strong>{t.name}</strong> },
    { key: "trigger", header: "Trigger phrases", render: (t) => <span style={{ fontSize: 12, color: "#605e5c" }}>{t.trigger}</span> },
    { key: "nodeCount", header: "Nodes", render: (t) => t.nodeCount },
  ];

  return (
    <div>
      <div className={styles.h3}>Topics ({topics.length})</div>
      <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
        Topics are conversation flows. Each has trigger phrases and an authoring canvas (Ask question / Show message / Call
        action / Branch / Escalate).
      </p>
      <DataTable columns={columns} rows={topics} getRowKey={(t) => t.id} emptyMessage="No topics." />
    </div>
  );
}

// ===================================================================
// Knowledge sources — read-only list
// ===================================================================

function KnowledgeSection({ state }: { state: PpState }) {
  const knowledge = state.copilot.knowledge;
  const columns: DataTableColumn<(typeof knowledge)[number]>[] = [
    { key: "name", header: "Name", render: (k) => <strong>{k.name}</strong> },
    { key: "type", header: "Type", render: (k) => k.type },
    { key: "itemCount", header: "Items", render: (k) => k.itemCount },
  ];

  return (
    <div>
      <div className={styles.h3}>Knowledge sources ({knowledge.length})</div>
      <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
        Copilot retrieves answers from these sources via generative answers. Supports SharePoint, Dataverse, public URLs, and
        uploaded files.
      </p>
      <DataTable columns={columns} rows={knowledge} getRowKey={(k) => k.id} emptyMessage="No knowledge sources." />
    </div>
  );
}

// ===================================================================
// Actions — read-only, connector resolved via state.connectors
// ===================================================================

function ActionsSection({ state, connectorById }: { state: PpState; connectorById: Map<string, (typeof state.connectors)[number]> }) {
  const actions = state.copilot.actions;
  const columns: DataTableColumn<(typeof actions)[number]>[] = [
    { key: "name", header: "Name", render: (a) => <strong>{a.name}</strong> },
    {
      key: "connector",
      header: "Connector",
      render: (a) => (a.connectorId ? connectorById.get(a.connectorId)?.name ?? a.connectorId : <span style={{ color: "#605e5c" }}>—</span>),
    },
  ];

  return (
    <div>
      <div className={styles.h3}>Actions ({actions.length})</div>
      <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
        Actions extend the copilot beyond chat — call Power Automate flows, custom connectors, or REST APIs.
      </p>
      <DataTable columns={columns} rows={actions} getRowKey={(a) => a.id} emptyMessage="No actions." />
    </div>
  );
}

// ===================================================================
// Test chat — real persisted chat, reads/writes state.copilot.testChat via
// the SEND_COPILOT_TEST_MESSAGE reducer action (fixes source bug #1).
// ===================================================================

function TestChatSection({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [draft, setDraft] = useState("");
  const chat = state.copilot.testChat;

  function send() {
    const text = draft.trim();
    if (!text) return;
    dispatch({ type: "SEND_COPILOT_TEST_MESSAGE", text });
    setDraft("");
  }

  return (
    <div>
      <div className={styles.h3}>Test + debug</div>
      <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
        Live chat against the current draft. Try &ldquo;VPN not working&rdquo;, &ldquo;reset password&rdquo;, &ldquo;new
        laptop&rdquo;, or &ldquo;office license&rdquo;.
      </p>

      <div className={styles.card}>
        <div
          style={{
            background: "#f9f8f7",
            border: "1px solid #edebe9",
            borderRadius: 4,
            padding: 12,
            fontSize: 13,
            minHeight: 300,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {chat.length === 0 ? (
            <div style={{ color: "#605e5c", fontSize: 12, textAlign: "center", padding: 20 }}>
              No conversation yet. Type a message below to start.
            </div>
          ) : (
            chat.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, textAlign: m.from === "user" ? "right" : "left" }}>
                {m.from === "user" ? (
                  <span
                    style={{
                      background: "#742774",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: 14,
                      display: "inline-block",
                      maxWidth: "75%",
                    }}
                  >
                    {m.text}
                  </span>
                ) : (
                  <div>
                    <div>
                      <strong style={{ color: "#742774" }}>Bot:</strong> {m.text}
                    </div>
                    {m.confidence != null ? (
                      <div style={{ color: "#605e5c", fontSize: 11, marginTop: 2 }}>
                        confidence {m.confidence.toFixed(2)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ marginTop: 8, display: "flex", gap: 6 }}
        >
          <input
            className={styles.input}
            style={{ flex: 1 }}
            placeholder="Type a message and press Enter…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className={styles.btn}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// ===================================================================
// Channels — read-only status list (no channel-toggle reducer action exists;
// per the porting brief, do not invent one).
// ===================================================================

function ChannelsSection({ state }: { state: PpState }) {
  const channels = state.copilot.channels;
  const columns: DataTableColumn<(typeof channels)[number]>[] = [
    { key: "name", header: "Channel", render: (c) => <strong>{c.name}</strong> },
    {
      key: "enabled",
      header: "Status",
      render: (c) => <StatusPill tone={c.enabled ? "default" : "muted"}>{c.enabled ? "Enabled" : "Disabled"}</StatusPill>,
    },
  ];

  return (
    <div>
      <div className={styles.h3}>Channels</div>
      <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
        Deploy your copilot to where users are. Channel connection is managed outside this simulator.
      </p>
      <DataTable columns={columns} rows={channels} getRowKey={(c) => c.name} emptyMessage="No channels configured." />
    </div>
  );
}

// ===================================================================
// Analytics — static illustrative reference content, matching source's own
// fidelity level (no persisted analytics model in PpCopilotState).
// ===================================================================

function AnalyticsSection() {
  return (
    <div>
      <div className={styles.h3}>Analytics — last 7 days</div>
      <StatRow
        stats={[
          { label: "Total sessions", value: 1247, color: "#0078d4" },
          { label: "Escalation rate", value: "7% (89)", color: "#a4262c" },
          { label: "CSAT score", value: "4.2 / 5", color: "#107c10" },
          { label: "Avg session length", value: "2 min 14 sec", color: "#742774" },
        ]}
      />
      <div className={styles.h3}>Top topics by hits</div>
      <DataTable
        columns={[
          { key: "topic", header: "Topic", render: (t) => <strong>{t.topic}</strong> },
          { key: "hits", header: "Hits", render: (t) => t.hits },
          { key: "resolution", header: "Resolution rate", render: (t) => t.resolution },
        ]}
        rows={TOP_TOPICS}
        getRowKey={(t) => t.topic}
      />
      <div style={{ marginTop: 12, padding: 12, background: "#f4eaf7", borderLeft: "3px solid #742774", fontSize: 12 }}>
        <strong>Insight:</strong> Top 5 topics account for 68% of sessions. Bottom topics get &lt; 10 sessions/week — candidates
        for removal.
      </div>
    </div>
  );
}

// ===================================================================
// Settings — read-only reference display, folding in source's Generative AI
// settings / Security + governance / Publish tabs as static content (none of
// these are backed by real mutable state in PpCopilotState/reducer.ts).
// ===================================================================

function SettingsSection({ state }: { state: PpState }) {
  const selected = state.copilot.copilots[0];

  return (
    <div>
      <div className={styles.h3}>Copilot settings</div>
      {selected ? (
        <div className={styles.card}>
          <div className={styles.reviewGrid}>
            <div style={{ color: "#605e5c" }}>Bot name</div>
            <div>{selected.name}</div>
            <div style={{ color: "#605e5c" }}>Description</div>
            <div>Internal IT helpdesk assistant. Answers FAQs and handles password resets.</div>
            <div style={{ color: "#605e5c" }}>Language model</div>
            <div>Microsoft-hosted GPT-4 Turbo (default). Or bring your own OpenAI / Azure OpenAI key.</div>
            <div style={{ color: "#605e5c" }}>Generative AI moderation</div>
            <div>High (filters hate, sexual, violence, self-harm)</div>
            <div style={{ color: "#605e5c" }}>Conversation memory window</div>
            <div>20 turns (last 20 user + bot messages used as context)</div>
            <div style={{ color: "#605e5c" }}>Maximum session length</div>
            <div>30 minutes idle timeout</div>
            <div style={{ color: "#605e5c" }}>User authentication</div>
            <div>Required — Entra ID OAuth2. No anonymous access in Production.</div>
            <div style={{ color: "#605e5c" }}>Prompt injection defence</div>
            <div>On — system prompt isolation, suspicious user input detected before model call.</div>
          </div>
        </div>
      ) : (
        <EmptyState message="No copilots to configure yet." />
      )}
    </div>
  );
}
