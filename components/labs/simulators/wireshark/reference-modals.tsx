"use client";

// Four modal-content components for the Wireshark packet-capture simulator:
// Coloring Rules editor, Saved Filters browser, Protocol Reference, and TLS
// Keys reference. Rendered by the final simulator container when
// `WiresharkShell`'s `onOpenModal` sets one of "coloring-rules" |
// "saved-filters" | "protocol-reference" | "tls-keys" (see wireshark-shell.tsx).
//
// ===== Coloring Rules — bug fix (approved scope) =====
// Source (wireshark-stats.js `renderColoringRules()`, lines 441-460) renders
// a Coloring Rules editor with add/delete/reorder/enable markup
// (`#wsCrAdd`, `#wsCrReset`, `data-cr-enable`/`-name`/`-filter`/`-up`/`-down`/
// `-del`) but NO `addEventListener` anywhere in wireshark-main.js or
// wireshark-stats.js ever wires those attributes up — the entire editor was
// decorative dead markup. This component is a genuine, from-scratch
// implementation wired to the real reducer actions
// (ADD/UPDATE/DELETE/TOGGLE/REORDER_COLORING_RULE, RESET_COLORING_RULES) —
// every control here actually mutates state.
//
// ===== Saved Filters — bug fix (approved scope) =====
// Source's `_saveFilter()` (wireshark-main.js, lines 239-248) reads/writes a
// second, unsynchronized `localStorage.getItem('wshark_saved_filters')` list
// that source's own `state.savedFilters` never touches — two schemas that
// never agree. This suite already fixed that upstream (see reducer.ts's file
// header and types.ts's `WsSavedFilter`): there is exactly ONE canonical
// list, `state.savedFilters`, driven by `ADD_SAVED_FILTER`/
// `DELETE_SAVED_FILTER`. This modal reads/writes only that canonical list —
// no parallel storage of any kind is introduced here.
//
// ===== Protocol Reference / TLS Keys =====
// Source's wireshark-protocols.js (protocol glossary) and
// wireshark-tls-keys.js (TLS key-log + BPF capture-filter cheatsheet) are
// read-only reference material with no real interactivity to port (source's
// only "interactivity" was a `view` tab-switch reimplemented here with real
// React state via `TabBar`). Ported prose/tables below, plus the Protocol
// Reference modal also surfaces `getFieldCatalog()` from filter-engine.ts —
// the actual, authoritative, currently-supported display-filter field list
// (55 entries), which is more useful to a user writing filters than any
// static prose ever could be.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { WiresharkState, WsColoringRule } from "@/lib/labs/simulators/wireshark/types";
import type { WiresharkAction } from "@/lib/labs/simulators/wireshark/reducer";
import { compile, getFieldCatalog } from "@/lib/labs/simulators/wireshark/filter-engine";
import { Modal, DataTable, TabBar, EmptyState, type DataTableColumn } from "./wireshark-ui";
import styles from "./wireshark-console.module.css";

// ===================================================================
// ColoringRulesModal
// ===================================================================

let coloringRuleSeq = 0;
function nextColoringRuleId(): string {
  coloringRuleSeq += 1;
  return `cr-custom-${Date.now()}-${coloringRuleSeq}`;
}

function ColoringRuleRow({
  rule,
  index,
  total,
  dispatch,
}: {
  rule: WsColoringRule;
  index: number;
  total: number;
  dispatch: React.Dispatch<WiresharkAction>;
}) {
  // Local draft copies of name/filter so typing doesn't dispatch on every
  // keystroke — committed (validated) on blur, matching the task's "on
  // blur/save dispatch UPDATE_COLORING_RULE" instruction.
  const [name, setName] = useState(rule.name);
  const [filter, setFilter] = useState(rule.filter);
  const [error, setError] = useState<string | null>(null);

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(rule.name);
      return;
    }
    if (trimmed !== rule.name) {
      dispatch({ type: "UPDATE_COLORING_RULE", id: rule.id, patch: { name: trimmed } });
      toast.success(`Rule renamed to "${trimmed}".`);
    }
  }

  function commitFilter() {
    const result = compile(filter);
    if (!result.ok) {
      setError(result.error);
      toast.error(`Invalid filter for "${rule.name}": ${result.error}`);
      return;
    }
    setError(null);
    if (filter !== rule.filter) {
      dispatch({ type: "UPDATE_COLORING_RULE", id: rule.id, patch: { filter } });
      toast.success(`Filter updated for "${rule.name}".`);
    }
  }

  return (
    <div className={styles.colorRuleRow}>
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={() => dispatch({ type: "TOGGLE_COLORING_RULE", id: rule.id })}
        aria-label={rule.enabled ? `Disable rule ${rule.name}` : `Enable rule ${rule.name}`}
        title={rule.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
      />
      <div className={styles.colorRuleSwatch} style={{ background: rule.bg, color: rule.fg }}>
        {rule.name || "Rule"}
      </div>
      <input
        type="text"
        className={styles.colorRuleName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        aria-label="Rule name"
        title="Rule name"
      />
      <input
        type="text"
        className={styles.colorRuleFilter}
        style={error ? { color: "#a4262c", background: "#fde7e9" } : undefined}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onBlur={commitFilter}
        aria-label="Filter expression"
        aria-invalid={!!error}
        title={error ?? "Display filter expression — same syntax as the filter bar"}
      />
      <input
        type="color"
        value={rule.bg}
        onChange={(e) => dispatch({ type: "UPDATE_COLORING_RULE", id: rule.id, patch: { bg: e.target.value } })}
        aria-label="Background color"
        title="Background color"
      />
      <input
        type="color"
        value={rule.fg}
        onChange={(e) => dispatch({ type: "UPDATE_COLORING_RULE", id: rule.id, patch: { fg: e.target.value } })}
        aria-label="Text color"
        title="Text color"
      />
      <button
        type="button"
        className={styles.btn}
        disabled={index === 0}
        onClick={() => dispatch({ type: "REORDER_COLORING_RULE", id: rule.id, direction: "up" })}
        title="Move up"
        aria-label="Move rule up"
      >
        &uarr;
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={index === total - 1}
        onClick={() => dispatch({ type: "REORDER_COLORING_RULE", id: rule.id, direction: "down" })}
        title="Move down"
        aria-label="Move rule down"
      >
        &darr;
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          dispatch({ type: "DELETE_COLORING_RULE", id: rule.id });
          toast.success(`Rule "${rule.name}" deleted.`);
        }}
        title="Delete rule"
      >
        Delete
      </button>
    </div>
  );
}

export function ColoringRulesModal({
  state,
  dispatch,
  onClose,
}: {
  state: WiresharkState;
  dispatch: React.Dispatch<WiresharkAction>;
  onClose: () => void;
}) {
  function handleAddRule() {
    const rule: WsColoringRule = {
      id: nextColoringRuleId(),
      name: "New rule",
      filter: "",
      bg: "#ffffff",
      fg: "#1a1a1a",
      enabled: true,
    };
    dispatch({ type: "ADD_COLORING_RULE", rule });
    toast.success("Rule added — set a name and filter expression.");
  }

  function handleReset() {
    dispatch({ type: "RESET_COLORING_RULES" });
    toast.success("Coloring rules reset to defaults.");
  }

  return (
    <Modal
      title="Coloring Rules"
      onClose={onClose}
      width="820px"
      footer={
        <>
          <button type="button" className={styles.btn} onClick={handleReset}>
            Reset to Defaults
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddRule}>
            + Add Rule
          </button>
        </>
      }
    >
      <p className={styles.small} style={{ marginBottom: 8 }}>
        Rules are evaluated top-to-bottom. The first matching rule colors the packet in the list pane. Toggle a rule
        off to skip it without deleting it.
      </p>
      {state.coloringRules.length === 0 ? (
        <EmptyState message="No coloring rules. Add one, or reset to defaults." />
      ) : (
        <div className={styles.colorRuleList}>
          {state.coloringRules.map((rule, i) => (
            <ColoringRuleRow key={rule.id} rule={rule} index={i} total={state.coloringRules.length} dispatch={dispatch} />
          ))}
        </div>
      )}
    </Modal>
  );
}

// ===================================================================
// SavedFiltersModal
// ===================================================================

export function SavedFiltersModal({
  state,
  dispatch,
  onClose,
  onApply,
}: {
  state: WiresharkState;
  dispatch: React.Dispatch<WiresharkAction>;
  onClose: () => void;
  onApply?: (expr: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newExpr, setNewExpr] = useState("");

  function applyExpr(expr: string) {
    if (onApply) {
      onApply(expr);
    } else {
      dispatch({ type: "SET_DISPLAY_FILTER", expr });
      dispatch({ type: "ADD_RECENT_FILTER", expr });
    }
    toast.success("Filter applied.");
  }

  function handleAdd() {
    const name = newName.trim();
    const expr = newExpr.trim();
    if (!name || !expr) {
      toast.error("Enter both a name and a filter expression.");
      return;
    }
    const result = compile(expr);
    if (!result.ok) {
      toast.error(`Invalid filter expression: ${result.error}`);
      return;
    }
    dispatch({ type: "ADD_SAVED_FILTER", filter: { id: `sf-${Date.now()}`, name, expr } });
    toast.success(`Filter saved: ${name}`);
    setNewName("");
    setNewExpr("");
  }

  const columns: DataTableColumn<(typeof state.savedFilters)[number]>[] = [
    { key: "name", header: "Name", render: (f) => f.name },
    { key: "expr", header: "Expression", render: (f) => <code className={styles.mono}>{f.expr}</code> },
    {
      key: "actions",
      header: "",
      width: "150px",
      render: (f) => (
        <span className={styles.flex}>
          <button type="button" className={styles.btn} onClick={() => applyExpr(f.expr)}>
            Apply
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              dispatch({ type: "DELETE_SAVED_FILTER", id: f.id });
              toast.success(`Filter "${f.name}" deleted.`);
            }}
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  return (
    <Modal title="Display Filters" onClose={onClose} width="640px">
      <div className={styles.formRow}>
        <label>Name</label>
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Failed logins" />
      </div>
      <div className={styles.formRow}>
        <label>Expression</label>
        <input
          type="text"
          value={newExpr}
          onChange={(e) => setNewExpr(e.target.value)}
          placeholder='e.g. http.response.code == 401'
        />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAdd}>
          Save Filter
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        {state.savedFilters.length === 0 ? (
          <EmptyState message="No saved filters yet." />
        ) : (
          <DataTable columns={columns} rows={state.savedFilters} getRowKey={(f) => f.id} emptyMessage="No saved filters yet." />
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 12, marginBottom: 6, color: "#1a4a8a" }}>Recent</h4>
        {state.recentFilters.length === 0 ? (
          <p className={styles.small}>No recently applied filters.</p>
        ) : (
          <div className={styles.flex} style={{ flexWrap: "wrap", gap: 6 }}>
            {state.recentFilters.map((expr, i) => (
              <button
                key={`${expr}-${i}`}
                type="button"
                className={styles.btn}
                onClick={() => applyExpr(expr)}
                title="Click to apply"
              >
                <code className={styles.mono}>{expr}</code>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ===================================================================
// ProtocolReferenceModal
// ===================================================================
// Ported reference content from itbd-lab's wireshark-protocols.js (PROTOCOLS
// array — descriptions + common fields + filter examples for the major
// protocols this simulator's capture actually contains), condensed into data
// below. The field-catalog table underneath is the real, authoritative,
// currently-supported filter grammar (getFieldCatalog()), not static prose.

type ProtocolRef = {
  name: string;
  category: string;
  filterTag: string;
  description: string;
  fields: [string, string][];
  examples: string[];
};

const PROTOCOL_REFERENCE: ProtocolRef[] = [
  {
    name: "Ethernet II",
    category: "Layer 2",
    filterTag: "eth",
    description: "IEEE 802.3. 14-byte header: destination MAC (6) + source MAC (6) + EtherType (2).",
    fields: [
      ["eth.src / eth.dst", "Source / destination MAC address"],
      ["eth.addr", "Matches either source or destination MAC"],
    ],
    examples: ["eth.addr == 00:1c:b3:aa:11:01", "eth.src == 00:1c:b3:bb:22:32"],
  },
  {
    name: "IPv4",
    category: "Layer 3",
    filterTag: "ip",
    description: "RFC 791. 20-byte header (no options) carrying source/destination addresses for every routed packet.",
    fields: [
      ["ip.src / ip.dst", "Source / destination IPv4 address"],
      ["ip.addr", "Matches either source or destination address"],
    ],
    examples: ["ip.addr == 10.10.0.15", "ip.src == 10.10.0.50 and ip.dst == 10.10.0.15"],
  },
  {
    name: "TCP",
    category: "Layer 4",
    filterTag: "tcp",
    description:
      "RFC 9293. Reliable, ordered, connection-oriented transport. Three-way handshake (SYN / SYN-ACK / ACK), graceful close (FIN/ACK), and analysis flags for retransmissions.",
    fields: [
      ["tcp.srcport / tcp.dstport", "Source / destination TCP port"],
      ["tcp.port", "Matches either source or destination port"],
      ["tcp.flags.syn / .ack / .fin / .rst / .psh", "Individual TCP flag bits (1/0)"],
      ["tcp.analysis.retransmission", "True if this frame is a detected retransmission"],
      ["tcp.stream", "Stream identifier — group all frames of one connection"],
    ],
    examples: [
      'tcp.port == 443',
      'tcp.flags.syn == 1 && tcp.flags.ack == 0',
      "tcp.analysis.retransmission",
    ],
  },
  {
    name: "UDP",
    category: "Layer 4",
    filterTag: "udp",
    description: "RFC 768. Connectionless, no ordering or retransmission — used by DNS, DHCP, and other lightweight protocols in this capture.",
    fields: [
      ["udp.srcport / udp.dstport", "Source / destination UDP port"],
      ["udp.port", "Matches either source or destination port"],
    ],
    examples: ["udp.port == 53", "udp.port == 67 || udp.port == 68"],
  },
  {
    name: "DNS",
    category: "Layer 7",
    filterTag: "dns",
    description: "RFC 1035. Name resolution queries/responses, typically over UDP/53 in this capture.",
    fields: [
      ["dns.qry.name", "Queried hostname"],
      ["dns.qry.type", "Record type (A, AAAA, CNAME, MX, TXT, SRV...)"],
    ],
    examples: ['dns.qry.name contains "microsoft"', 'dns.qry.type == "AAAA"'],
  },
  {
    name: "HTTP",
    category: "Layer 7",
    filterTag: "http",
    description: "RFC 9110. Plaintext request/response over TCP — method, URI, host, and status code are all visible.",
    fields: [
      ["http.request.method", "GET, POST, PUT, DELETE, ..."],
      ["http.request.uri", "Requested path"],
      ["http.host", "Host header value"],
      ["http.response.code", "HTTP status code"],
    ],
    examples: ['http.request.method == "POST"', "http.response.code == 404", 'http.host == "web01.cloudlab.in"'],
  },
  {
    name: "TLS",
    category: "Layer 7",
    filterTag: "tls",
    description:
      "RFC 8446 (TLS 1.3) / RFC 5246 (TLS 1.2). Encrypted transport; only the ClientHello's SNI extension is visible in plaintext.",
    fields: [
      ["tls.handshake.type", "ClientHello, ServerHello, Certificate, Finished, ..."],
      ["tls.handshake.extensions_server_name", "SNI — hostname the client is requesting"],
    ],
    examples: ['tls.handshake.type == "ClientHello"', 'tls.handshake.extensions_server_name contains "microsoft"'],
  },
  {
    name: "SMB2",
    category: "File sharing",
    filterTag: "smb2",
    description: "Microsoft Server Message Block v2/3, TCP/445 — file share access, authentication (NTLMSSP), and read/write operations.",
    fields: [],
    examples: ["smb2", 'frame contains "Tree Connect"'],
  },
  {
    name: "LDAP",
    category: "Directory",
    filterTag: "ldap",
    description: "RFC 4511. Active-Directory-style bind/search/unbind exchanges against a directory service, typically over TCP/389.",
    fields: [],
    examples: ["ldap", 'frame contains "bindRequest"'],
  },
  {
    name: "Kerberos",
    category: "Authentication",
    filterTag: "kerberos",
    description: "RFC 4120. AD ticket-based authentication (AS-REQ/AS-REP, TGS-REQ/TGS-REP), typically over UDP or TCP/88.",
    fields: [],
    examples: ["kerberos"],
  },
  {
    name: "ARP",
    category: "Layer 2",
    filterTag: "arp",
    description: "RFC 826. Resolves IPv4 addresses to MAC addresses on the local segment via broadcast request/reply.",
    fields: [],
    examples: ["arp"],
  },
  {
    name: "DHCP",
    category: "Layer 7",
    filterTag: "dhcp",
    description: "RFC 2131. Discover/Offer/Request/ACK exchange that leases an IPv4 address to a client.",
    fields: [],
    examples: ["dhcp"],
  },
];

const COMMON_PORTS: [string, string][] = [
  ["20 / 21", "FTP data / control"],
  ["22", "SSH"],
  ["25", "SMTP"],
  ["53", "DNS"],
  ["67 / 68", "DHCP server / client"],
  ["80", "HTTP"],
  ["88", "Kerberos"],
  ["389", "LDAP"],
  ["443", "HTTPS / TLS"],
  ["445", "SMB"],
  ["3389", "RDP"],
];

function fieldTypeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function ProtocolReferenceModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"protocols" | "ports" | "fields">("protocols");
  const [search, setSearch] = useState("");

  const catalog = useMemo(() => getFieldCatalog(), []);
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((f) => f.field.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
  }, [catalog, search]);

  const fieldColumns: DataTableColumn<(typeof catalog)[number]>[] = [
    { key: "field", header: "Field", width: "260px", render: (f) => <code className={styles.mono}>{f.field}</code> },
    { key: "type", header: "Type", width: "90px", render: (f) => fieldTypeLabel(f.type) },
    { key: "description", header: "Description", render: (f) => f.description },
  ];

  return (
    <Modal title="Protocol Reference" onClose={onClose} width="760px">
      <TabBar
        tabs={[
          { key: "protocols", label: "Protocols" },
          { key: "ports", label: "Common Ports" },
          { key: "fields", label: "Display Filter Fields" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === "protocols" ? (
        <div>
          <p className={styles.small} style={{ marginBottom: 10 }}>
            Reference for the protocols present in this capture — field meanings and example display-filter
            expressions you can paste into the filter bar.
          </p>
          {PROTOCOL_REFERENCE.map((p) => (
            <div key={p.name} className={styles.helpSection}>
              <h4>
                {p.name} <code>{p.filterTag}</code>
                <span className={styles.small}> — {p.category}</span>
              </h4>
              <p className={styles.small}>{p.description}</p>
              {p.fields.length > 0 ? (
                <table className={styles.table} style={{ marginTop: 6 }}>
                  <tbody>
                    {p.fields.map(([field, desc]) => (
                      <tr key={field}>
                        <td style={{ width: 260 }}>
                          <code className={styles.mono}>{field}</code>
                        </td>
                        <td>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <pre>{p.examples.join("\n")}</pre>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "ports" ? (
        <div className={styles.helpSection}>
          <h4>Common port numbers</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Port</th>
                <th>Protocol</th>
              </tr>
            </thead>
            <tbody>
              {COMMON_PORTS.map(([port, label]) => (
                <tr key={port}>
                  <td>
                    <code className={styles.mono}>{port}</code>
                  </td>
                  <td>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "fields" ? (
        <div>
          <div className={styles.formRow}>
            <label>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by field name or description..."
            />
          </div>
          <p className={styles.small} style={{ marginBottom: 8 }}>
            The complete, authoritative set of fields this simulator&apos;s display filter engine understands ({catalog.length}{" "}
            total).
          </p>
          <DataTable
            columns={fieldColumns}
            rows={filteredCatalog}
            getRowKey={(f) => f.field}
            emptyMessage="No fields match your search."
          />
        </div>
      ) : null}
    </Modal>
  );
}

// ===================================================================
// TlsKeysModal
// ===================================================================
// Ported from itbd-lab's wireshark-tls-keys.js: the TLS/SSL session-key-log
// reference (tlsView()) and the BPF capture-filter cheat-sheet
// (captureView(), lines 156-174). WPA/Export-Objects/Profiles tabs from
// source are out of scope here (owned by other reference material or simply
// not part of this modal's brief) — this modal covers exactly the two
// sections named in the task: TLS handshake/key-log concepts, and the BPF
// capture-filter table.

const TLS_KEY_LOG_SAMPLE = `# SSL/TLS secrets log file, see https://nss.googlesource.com/nss/+/master/lib/ssl/sslsock.c
CLIENT_HANDSHAKE_TRAFFIC_SECRET 8f4b2a98... a1b2c3d4e5f6...
SERVER_HANDSHAKE_TRAFFIC_SECRET 8f4b2a98... 7e8d9c0b1a2f...
CLIENT_TRAFFIC_SECRET_0 8f4b2a98... 11223344556677889900aabbccddeeff...
SERVER_TRAFFIC_SECRET_0 8f4b2a98... ffeeddccbbaa99887766554433221100...
EXPORTER_SECRET 8f4b2a98... aabbccddeeff00112233445566778899...`;

const SSLKEYLOGFILE_SNIPPET = `# Windows (PowerShell)
setx SSLKEYLOGFILE "C:\\Users\\you\\Desktop\\sslkeys.log"

# Linux / macOS (shell)
export SSLKEYLOGFILE=$HOME/sslkeys.log

# Then launch the browser from that shell
firefox &`;

type BpfExample = { name: string; filter: string; desc: string };

const BPF_EXAMPLES: BpfExample[] = [
  { name: "HTTPS to one host", filter: "host 192.168.1.10 and tcp port 443", desc: "Captures only port 443 traffic to/from 192.168.1.10." },
  { name: "All HTTP traffic", filter: "tcp port 80 or tcp port 8080", desc: "Wide HTTP net including alt ports." },
  { name: "DNS queries only", filter: "udp port 53", desc: "Standard DNS." },
  { name: "Specific subnet", filter: "net 10.0.1.0/24", desc: "All traffic from/to the /24." },
  { name: "Exclude management", filter: "not (port 22 or port 3389)", desc: "Strip SSH/RDP noise." },
  {
    name: "TCP SYN only",
    filter: "tcp[tcpflags] & tcp-syn != 0 and tcp[tcpflags] & tcp-ack == 0",
    desc: "Catch new connection attempts.",
  },
  { name: "ARP only", filter: "arp", desc: "ARP-only capture." },
  { name: "VLAN 100 traffic", filter: "vlan and vlan 100", desc: "Tagged traffic on VLAN 100." },
  { name: "BGP keep-alives only", filter: "tcp port 179", desc: "BGP control plane." },
  { name: "Multicast only", filter: "ip multicast or ip6 multicast", desc: "IGMP/MLD traffic." },
];

export function TlsKeysModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"tls" | "capture">("tls");

  return (
    <Modal title="TLS Keys & Capture Filters" onClose={onClose} width="720px">
      <TabBar
        tabs={[
          { key: "tls", label: "TLS decryption" },
          { key: "capture", label: "Capture filters (BPF)" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === "tls" ? (
        <div>
          <div className={styles.helpSection}>
            <h4>TLS / SSL session key decryption</h4>
            <p className={styles.small}>
              Real Wireshark cannot decrypt TLS just by knowing the server&apos;s private key — modern cipher suites
              use forward secrecy, which makes a static private key useless for decryption. Session keys must be
              captured from the client itself via the <code>SSLKEYLOGFILE</code> environment variable.
            </p>
          </div>

          <div className={styles.helpSection}>
            <h4>Step 1 — Configure the client to log keys</h4>
            <pre>{SSLKEYLOGFILE_SNIPPET}</pre>
          </div>

          <div className={styles.helpSection}>
            <h4>Step 2 — Point Wireshark at the key log</h4>
            <p className={styles.small}>
              Edit menu &rarr; Preferences &rarr; Protocols &rarr; TLS &rarr; set &ldquo;(Pre)-Master-Secret log
              filename&rdquo; to the key-log path, click OK, then reload the capture — TLS streams decrypt inline.
            </p>
          </div>

          <div className={styles.helpSection}>
            <h4>Sample sslkeys.log (NSS key-log format)</h4>
            <pre>{TLS_KEY_LOG_SAMPLE}</pre>
          </div>

          <div className={styles.helpSection}>
            <h4>Server-side decryption</h4>
            <p className={styles.small}>
              Only works for TLS 1.0/1.1 with RSA key exchange (legacy, no forward secrecy). TLS 1.2 ECDHE and all of
              TLS 1.3 require client-side session keys — the server&apos;s private key alone is not sufficient.
            </p>
          </div>

          <div className={styles.helpSection}>
            <h4>In this simulator</h4>
            <p className={styles.small}>
              This is reference material only — TLS frames in this capture are simulated and already show handshake
              metadata (SNI, handshake type) without needing a real key log. There is nothing to configure here.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "capture" ? (
        <div>
          <div className={styles.helpSection}>
            <h4>Capture filters (BPF syntax)</h4>
            <p className={styles.small}>
              Applied at the kernel level before capture — discarded packets are never written to disk. Configured
              via Capture &rarr; Options &rarr; &ldquo;Capture filter for selected interfaces&rdquo;.
            </p>
            <table className={styles.table} style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Use case</th>
                  <th>BPF filter</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {BPF_EXAMPLES.map((b) => (
                  <tr key={b.name}>
                    <td>{b.name}</td>
                    <td>
                      <code className={styles.mono}>{b.filter}</code>
                    </td>
                    <td className={styles.small}>{b.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.helpSection}>
            <h4>BPF vs. display filter</h4>
            <p className={styles.small}>
              BPF runs in the kernel pre-capture (fast, lossless, but limited syntax). The display filter — the one
              live in this simulator&apos;s filter bar — applies post-capture and can match rich protocol fields
              (see the Protocol Reference modal). Capture filters are conceptual/reference-only here: this
              simulator&apos;s capture is auto-populated, so there is no live kernel-level filtering to configure —
              this table exists purely so the BPF cheat-sheet from real Wireshark isn&apos;t lost in the port.
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
