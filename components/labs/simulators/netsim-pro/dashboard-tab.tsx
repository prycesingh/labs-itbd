"use client";

// NetSim Pro — Dashboard tab. Ported from itbd-lab/simulators/network's
// `#tab-dashboard` markup (index.html:670-1031) and js/dashboard.js, with the
// two user-approved bug fixes built in from the start (see header notes on
// each section below) rather than reproducing source's dead/wrong numbers.
//
// ===== Scoping choices (report these back) =====
//
// 1. Per-module totals: Learn 40, Topology 5, Troubleshoot 8 (source said 16
//    — wrong), Scenarios 15 (source said 35 — wrong), Reference 6 (source
//    said 10 — wrong). These are the corrected totals per the task spec.
//
// 2. Topology has no real "completion" concept (it's a drawing canvas, not a
//    checklist) — rather than fabricate a fake progress metric, its card
//    shows the template count as a plain stat ("5 templates available") with
//    no progress bar, matching the task's suggested judgment call.
//
// 3. Reference likewise has no completion concept in source (cheat sheets
//    aren't "finished") — its card shows "6 cheat sheets available" with no
//    progress bar, for the same reason.
//
// 4. "Completed" stat card + hero ProgressRing are computed for real from
//    `state.progress.learn` + `state.progress.scenarios` (count of `true`
//    values) against a real total of 40 + 15 = 55 (Learn lessons + Scenarios
//    — the only two progress domains that track completion; Topology has no
//    completion state in `NetSimProgress`, Troubleshoot/Reference don't
//    either). This replaces source's hardcoded `total = 114` /
//    `"Total Lessons": 114` (dashboard.js:11, index.html:717), which never
//    matched any real content count.
//
// 5. Day Streak and Level stay as tasteful static placeholders (source never
//    computes these for real either — dashboard.js has no streak logic at
//    all) — no new streak-tracking infrastructure is introduced, per the
//    task's explicit instruction not to over-engineer this.
//
// 6. Fun fact: shown as a single fact that cycles on a lightweight
//    `setInterval` (matching source's `rotateFunFact()`, dashboard.js:60-65,
//    which picks a new random fact on each dashboard mount). Here it cycles
//    every 8s client-side via local `useState`/`useEffect`, kept lightweight
//    per the task's guidance.

import { useEffect, useState } from "react";

import type { NetSimState, NetSimTab } from "@/lib/labs/simulators/netsim-pro/types";
import { Badge, Card, GhostButton, HoloBorder, Kbd, ProgressBar, ProgressRing, StatCard } from "./netsim-ui";
import styles from "./netsim-console.module.css";

// ===== Fixed module totals (see scoping note 1) =====
const LEARN_TOTAL = 40;
const TOPOLOGY_TOTAL = 5;
const TROUBLESHOOT_TOTAL = 8;
const SCENARIOS_TOTAL = 15;
const REFERENCE_TOTAL = 6;

type ModuleCardDef = {
  tab: NetSimTab;
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
};

const MODULE_CARDS: ModuleCardDef[] = [
  { tab: "learn", icon: "\u{1F4DA}", title: "Learn", subtitle: "Theory & Concepts", accent: "#10b981" },
  { tab: "topology", icon: "\u{1F5A7}", title: "Topology Builder", subtitle: "Design Networks", accent: "#06b6d4" },
  { tab: "troubleshoot", icon: "\u{1F527}", title: "Troubleshooting", subtitle: "Flowcharts & Methods", accent: "#f59e0b" },
  { tab: "scenarios", icon: "\u{1F3AF}", title: "Scenarios", subtitle: "Real-world Challenges", accent: "#8b5cf6" },
  { tab: "reference", icon: "\u{1F4D6}", title: "Reference", subtitle: "Command Sheets", accent: "#ec4899" },
];

// Recommended Learning Path — 8 static rows, matching source's exact titles
// and target tabs 1:1 (index.html:857-929).
const LEARNING_PATH: { title: string; tab: NetSimTab }[] = [
  { title: "OSI Model & TCP/IP Basics", tab: "learn" },
  { title: "IP Addressing & Subnetting", tab: "learn" },
  { title: "Switch & VLAN Configuration", tab: "cli" },
  { title: "Routing Fundamentals", tab: "learn" },
  { title: "Troubleshoot: User Can't Access Internet", tab: "troubleshoot" },
  { title: "Build Your First Network Topology", tab: "topology" },
  { title: "Firewall & Security Basics", tab: "learn" },
  { title: "Solve Beginner Scenarios", tab: "scenarios" },
];

// Fun facts — verbatim from source (js/dashboard.js:47-58), mojibake fixed
// (source's em-dashes were mis-encoded as "â€”" from a lost UTF-8 round trip).
const FUN_FACTS: string[] = [
  "BGP (Border Gateway Protocol) is often called ‘the glue that holds the Internet together’ — it manages routing between all ISPs worldwide.",
  "The first message sent over ARPANET in 1969 was ‘LO’ — the system crashed before they could finish typing ‘LOGIN’.",
  "A single strand of fiber optic cable can carry over 10 Tbps of data — that's roughly 1.25 terabytes per second.",
  "The average ping time to the Moon would be about 2.5 seconds due to the 384,400 km distance.",
  "Ethernet was invented by Robert Metcalfe in 1973 at Xerox PARC. He named it after the ‘luminiferous ether’.",
  "The entire IPv4 address space (4.3 billion addresses) was officially exhausted in 2011.",
  "Wi-Fi doesn't actually stand for anything. It's a trademark of the Wi-Fi Alliance.",
  "Submarine cables carry over 95% of intercontinental data traffic. Satellites handle less than 5%.",
  "The first firewall was a packet filter developed by Digital Equipment Corporation in 1988.",
  "OSPF can converge a network of 1000+ routers in under 1 second with proper tuning.",
];

// Vendor coverage — static grid matching source (index.html:942-985).
const VENDOR_COVERAGE = [
  { dot: "\u{1F7E2}", name: "Cisco IOS", desc: "Routers, Switches, ASA", commands: "50+ commands" },
  { dot: "\u{1F534}", name: "FortiGate", desc: "FortiOS Firewall", commands: "30+ commands" },
  { dot: "\u{1F7E0}", name: "Palo Alto", desc: "PAN-OS NGFW", commands: "25+ commands" },
  { dot: "\u{1F535}", name: "Juniper", desc: "JunOS Routing/Security", commands: "25+ commands" },
  { dot: "\u{1F7E3}", name: "Meraki", desc: "Cloud-managed Dashboard", commands: "15+ commands" },
  { dot: "\u{1F427}", name: "Linux", desc: "Network Admin Tools", commands: "30+ commands" },
];

// Keyboard shortcuts — static grid matching source (index.html:988-1030).
const KEYBOARD_SHORTCUTS = [
  { keys: "1-7", desc: "Switch tabs" },
  { keys: "Ctrl+P", desc: "Print reference" },
  { keys: "↑ ↓", desc: "CLI command history" },
  { keys: "Tab", desc: "CLI auto-complete" },
  { keys: "?", desc: "CLI context help" },
  { keys: "Esc", desc: "Close modal/dialog" },
];

function countTrue(record: Record<string, boolean>): number {
  return Object.values(record).filter(Boolean).length;
}

export function DashboardTab({ state, onNavigate }: { state: NetSimState; onNavigate: (tab: NetSimTab) => void }) {
  // ===== Real progress computation (scoping note 4) =====
  const learnCompleted = countTrue(state.progress.learn);
  const scenariosCompleted = countTrue(state.progress.scenarios);
  const completedTotal = learnCompleted + scenariosCompleted;
  const overallTotal = LEARN_TOTAL + SCENARIOS_TOTAL; // 55

  const moduleProgress: Record<string, { completed: number; total: number } | null> = {
    learn: { completed: learnCompleted, total: LEARN_TOTAL },
    topology: null, // no completion concept — see scoping note 2
    troubleshoot: { completed: 0, total: TROUBLESHOOT_TOTAL }, // no per-flow completion tracked in NetSimProgress yet
    scenarios: { completed: scenariosCompleted, total: SCENARIOS_TOTAL },
    reference: null, // no completion concept — see scoping note 3
  };

  // ===== Fun fact rotator (scoping note 6) =====
  const [factIndex, setFactIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setFactIndex((i) => (i + 1) % FUN_FACTS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      {/* WELCOME HERO */}
      <HoloBorder className={undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              Good Evening, <span className={styles.holoText}>Network Engineer</span> {"\u{1F44B}"}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 500 }}>
              &ldquo;Master the fundamentals and the complex becomes simple.&rdquo;
            </p>
          </div>
          <ProgressRing value={completedTotal} max={overallTotal} label="Overall Progress" />
        </div>
      </HoloBorder>

      {/* STATS ROW */}
      <div className={styles.grid4} style={{ marginTop: 24, marginBottom: 24 }}>
        <StatCard icon="\u{1F525}" label="Day Streak" value={1} valueColor="#f59e0b" />
        <StatCard icon="✅" label="Completed" value={completedTotal} valueColor="#10b981" />
        <StatCard icon="\u{1F4CA}" label="Total Lessons & Scenarios" value={overallTotal} valueColor="#3b82f6" />
        <StatCard icon="\u{1F3C6}" label="Your Level" value="Beginner" valueColor="#8b5cf6" />
      </div>

      {/* MODULE CARDS */}
      <h2 className={styles.sectionTitle}>{"\u{1F5C2}️"} Learning Modules</h2>
      <div className={styles.grid3} style={{ marginBottom: 24 }}>
        {MODULE_CARDS.map((mod) => {
          const progress = moduleProgress[mod.tab];
          return (
            <Card key={mod.tab} clickable onClick={() => onNavigate(mod.tab)} className={undefined}>
              <div style={{ borderLeft: `3px solid ${mod.accent}`, marginLeft: -20, paddingLeft: 17, marginTop: -20, marginBottom: -20, paddingTop: 20, paddingBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 28 }}>{mod.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{mod.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{mod.subtitle}</div>
                  </div>
                </div>
                {progress ? (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      <ProgressBar value={progress.completed} max={progress.total} color={mod.accent} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
                      <span>
                        {progress.completed}/{progress.total} completed
                      </span>
                      <span style={{ color: mod.accent, fontWeight: 600 }}>
                        {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {mod.tab === "topology" ? `${TOPOLOGY_TOTAL} templates available` : `${REFERENCE_TOTAL} cheat sheets available`}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* QUICK ACTIONS + LEARNING PATH */}
      <div className={styles.grid2} style={{ marginBottom: 24 }}>
        {/* Quick Start */}
        <Card variant="neuFlat" className={undefined}>
          <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSm}`}>{"⚡"} Quick Start</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <GhostButton fullWidthLeft onClick={() => onNavigate("cli")}>
              {"\u{1F4BB}"} Practice CLI Commands
            </GhostButton>
            <GhostButton fullWidthLeft onClick={() => onNavigate("troubleshoot")}>
              {"\u{1F527}"} Troubleshooting Flowcharts
            </GhostButton>
            <GhostButton fullWidthLeft onClick={() => onNavigate("scenarios")}>
              {"\u{1F3AF}"} Solve a Scenario
            </GhostButton>
            <GhostButton fullWidthLeft onClick={() => onNavigate("topology")}>
              {"\u{1F5A7}"} Build a Network
            </GhostButton>
            <GhostButton fullWidthLeft onClick={() => onNavigate("reference")}>
              {"\u{1F4D6}"} Command Reference
            </GhostButton>
          </div>
        </Card>

        {/* Recommended Path */}
        <Card variant="neuFlat" className={undefined}>
          <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSm}`}>{"\u{1F6E4}️"} Recommended Learning Path</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {LEARNING_PATH.map((step, i) => (
              <div
                key={step.title}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={() => onNavigate(step.tab)}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: "var(--glass-bg)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{step.title}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* NETWORK FACT OF THE DAY */}
      <Card variant="glass" className={undefined}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{"\u{1F4A1}"} Did You Know?</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{FUN_FACTS[factIndex]}</p>
      </Card>

      {/* VENDOR COVERAGE */}
      <h2 className={styles.sectionTitle} style={{ marginTop: 24 }}>
        {"\u{1F3E2}"} Vendor Coverage
      </h2>
      <div className={styles.grid3} style={{ marginBottom: 24 }}>
        {VENDOR_COVERAGE.map((v) => (
          <Card key={v.name} className={undefined}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{v.dot}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0" }}>{v.desc}</div>
              <Badge tone="blue">{v.commands}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* KEYBOARD SHORTCUTS */}
      <Card variant="neuFlat" className={undefined}>
        <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSm}`}>{"⌨️"} Keyboard Shortcuts</h3>
        <div className={styles.grid3}>
          {KEYBOARD_SHORTCUTS.map((s) => (
            <div key={s.desc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <Kbd>{s.keys}</Kbd>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
