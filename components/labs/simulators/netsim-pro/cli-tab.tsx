"use client";

// NetSim Pro — CLI tab. Drives the 4 real command-tree parser engines
// (cisco, fortigate, editpath-shared[juniper/paloalto], linux) behind a
// genuine terminal-emulator-feeling UI: a vendor tab bar, a toolbar
// (clear/reset), a dark monospace scrollback, and a live input line with
// real prompt rendering, history recall (Up/Down), and Tab-completion.
//
// ===== Scoping choices (report these back) =====
//
// 1. Shared vs. per-vendor scrollback: `CliSessionState.history` (cli-types.ts)
//    is one flat `CliHistoryEntry[]` array with no vendor tag field, and this
//    component is not authorized to add one. So this implements (a): ONE
//    shared scrollback across all 5 vendor tabs. Switching vendors mid-session
//    does not clear or filter the transcript — it's still "one terminal
//    window," the user just changed which device prompt they're typing
//    against next. This is arguably realistic (an SSH session log spanning
//    multiple `ssh` hops) and is the only option the current types support
//    without a schema change.
//
// 2. Tab-completion display: there's no dedicated reducer action to print
//    suggestions into the shared history (and synthesizing a fake
//    `CliHistoryEntry` for a purely local, ephemeral hint felt like the wrong
//    use of the shared scrollback's actions log). Multiple matches are shown
//    in a small inline suggestion strip directly above the input line (local
//    component state only, cleared on next keystroke/submit) rather than
//    injected into scrollback. A single unambiguous match autofills the input
//    directly, matching real shell Tab behavior.

import { useEffect, useMemo, useRef, useState } from "react";

import type { NetSimState } from "@/lib/labs/simulators/netsim-pro/types";
import type { NetSimAction } from "@/lib/labs/simulators/netsim-pro/reducer";
import type { CliVendorId } from "@/lib/labs/simulators/netsim-pro/cli-types";
import { getCiscoPrompt, getCiscoSuggestions } from "@/lib/labs/simulators/netsim-pro/cli-engine-cisco";
import { getFortiPrompt, getFortiSuggestions } from "@/lib/labs/simulators/netsim-pro/cli-engine-fortigate";
import { getEditPathPrompt, getEditPathSuggestions } from "@/lib/labs/simulators/netsim-pro/cli-engine-editpath";
import { getLinuxPrompt, getLinuxSuggestions } from "@/lib/labs/simulators/netsim-pro/cli-engine-linux";
import { Badge, GhostButton, Modal, PrimaryButton } from "./netsim-ui";
import styles from "./netsim-console.module.css";

// ===== Vendor metadata (hardcoded per task — no reusable constant exists in
// content.ts for this; matches source's cli.js vendor table for flavor) =====
const VENDOR_TABS: { id: CliVendorId; icon: string; name: string }[] = [
  { id: "cisco", icon: "\u{1F7E2}", name: "Cisco IOS" },
  { id: "fortigate", icon: "\u{1F534}", name: "FortiGate" },
  { id: "paloalto", icon: "\u{1F7E0}", name: "Palo Alto" },
  { id: "juniper", icon: "\u{1F535}", name: "Juniper JunOS" },
  { id: "linux", icon: "\u{1F427}", name: "Linux" },
];

// Resolve the active vendor's live prompt string. juniper/paloalto share the
// editpath engine and need the vendor id passed through; getEditPathPrompt
// returns a single string with the `[edit ...]` banner baked in via an
// embedded "\n" when there's a nonempty edit path (see cli-engine-editpath.ts
// getEditPathPrompt/renderEditBanner) — not a structured {banner, prompt}.
// We split on that newline so the banner can render as its own dim line
// above the actual prompt instead of being jammed inline with it.
function resolvePromptLines(cli: NetSimState["cli"]): string[] {
  const vendor = cli.session.activeVendor;
  switch (vendor) {
    case "cisco":
      return [getCiscoPrompt(cli.cisco)];
    case "fortigate":
      return [getFortiPrompt(cli.fortigate)];
    case "juniper":
      return getEditPathPrompt(cli.juniper, "juniper").split("\n");
    case "paloalto":
      return getEditPathPrompt(cli.paloalto, "paloalto").split("\n");
    case "linux":
      return [getLinuxPrompt(cli.linux)];
  }
}

function resolveSuggestions(cli: NetSimState["cli"], partial: string): string[] {
  const vendor = cli.session.activeVendor;
  switch (vendor) {
    case "cisco":
      return getCiscoSuggestions(cli.cisco, partial);
    case "fortigate":
      return getFortiSuggestions(cli.fortigate, partial);
    case "juniper":
      return getEditPathSuggestions(cli.juniper, partial);
    case "paloalto":
      return getEditPathSuggestions(cli.paloalto, partial);
    case "linux":
      return getLinuxSuggestions(cli.linux, partial);
  }
}

// Replace the last (possibly partial) whitespace-delimited token of `input`
// with `word`, preserving everything before it — used for single-match
// autofill on Tab. Mirrors a real shell's completion-replaces-last-word
// behavior rather than naively appending.
function autofillLastToken(input: string, word: string): string {
  const m = input.match(/^(.*\s)?(\S*)$/);
  const prefix = m?.[1] ?? "";
  return `${prefix}${word} `;
}

export function CliTab({ state, dispatch }: { state: NetSimState; dispatch: React.Dispatch<NetSimAction> }) {
  const { cli } = state;
  const activeVendor = cli.session.activeVendor;

  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  // -1 means "not browsing history" (fresh input line). Otherwise indexes
  // into commandHistory from the end (0 = most recent).
  const historyIndexRef = useRef(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const promptLines = useMemo(() => resolvePromptLines(cli), [cli]);
  const livePrompt = promptLines[promptLines.length - 1];
  const bannerLines = promptLines.slice(0, -1);

  const activeMeta = VENDOR_TABS.find((v) => v.id === activeVendor) ?? VENDOR_TABS[0];

  // Auto-scroll to bottom whenever new scrollback entries arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cli.session.history.length]);

  // Focus the input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function focusInput() {
    // Deferred so it runs after the state update that may re-render the input.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function resetHistoryBrowsing() {
    historyIndexRef.current = -1;
  }

  function handleSubmit() {
    const command = inputValue;
    if (command.trim().length === 0) return;
    dispatch({ type: "RUN_CLI_COMMAND", command });
    setInputValue("");
    setSuggestions([]);
    resetHistoryBrowsing();
    focusInput();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSubmit();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const cmdHistory = cli.session.commandHistory;
      if (cmdHistory.length === 0) return;
      const nextIndex = historyIndexRef.current < 0 ? 0 : Math.min(historyIndexRef.current + 1, cmdHistory.length - 1);
      historyIndexRef.current = nextIndex;
      setInputValue(cmdHistory[cmdHistory.length - 1 - nextIndex]);
      setSuggestions([]);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const cmdHistory = cli.session.commandHistory;
      if (historyIndexRef.current < 0) return;
      const nextIndex = historyIndexRef.current - 1;
      if (nextIndex < 0) {
        historyIndexRef.current = -1;
        setInputValue("");
      } else {
        historyIndexRef.current = nextIndex;
        setInputValue(cmdHistory[cmdHistory.length - 1 - nextIndex]);
      }
      setSuggestions([]);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const matches = resolveSuggestions(cli, inputValue);
      if (matches.length === 1) {
        setInputValue((prev) => autofillLastToken(prev, matches[0]));
        setSuggestions([]);
      } else if (matches.length > 1) {
        setSuggestions(matches);
      } else {
        setSuggestions([]);
      }
      return;
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    if (suggestions.length > 0) setSuggestions([]);
    resetHistoryBrowsing();
  }

  function handleClear() {
    dispatch({ type: "CLEAR_CLI_HISTORY" });
    focusInput();
  }

  function handleConfirmReset() {
    dispatch({ type: "RESET_CLI_VENDOR_STATE", vendor: activeVendor });
    setShowResetModal(false);
    focusInput();
  }

  return (
    <div>
      {/* VENDOR TAB BAR */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {VENDOR_TABS.map((v) => {
          const isActive = v.id === activeVendor;
          return (
            <button
              key={v.id}
              type="button"
              className={`${styles.btn} ${isActive ? styles.btnPrimary : styles.btnGhost}`}
              onClick={() => {
                dispatch({ type: "SET_CLI_VENDOR", vendor: v.id });
                focusInput();
              }}
            >
              <span aria-hidden>{v.icon}</span> {v.name}
            </button>
          );
        })}
      </div>

      {/* TOOLBAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }} aria-hidden>
            {activeMeta.icon}
          </span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{activeMeta.name}</span>
          <Badge tone="blue">{cli.session.history.length} lines</Badge>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GhostButton small onClick={handleClear}>
            {"\u{1F9F9}"} Clear
          </GhostButton>
          <GhostButton small onClick={() => setShowResetModal(true)}>
            {"♻️"} Reset device
          </GhostButton>
        </div>
      </div>

      {/* TERMINAL SCROLLBACK — dark/monospace terminal look; scoped inline
          style is intentional here (see task note: this is the one place a
          terminal's black/monospace aesthetic legitimately needs its own
          look, distinct from the surrounding neu-card chrome). */}
      <div
        ref={scrollRef}
        style={{
          background: "#0a0a0f",
          border: "1px solid var(--glass-border)",
          borderRadius: 12,
          padding: 16,
          height: 420,
          overflowY: "auto",
          fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
          fontSize: 13,
          lineHeight: 1.6,
          color: "#d6f5d6",
        }}
      >
        {cli.session.history.length === 0 ? (
          <div style={{ color: "#5a6a5a" }}>Session started. Type a command below and press Enter.</div>
        ) : null}
        {cli.session.history.map((entry, i) => (
          <div key={i}>
            <div style={{ whiteSpace: "pre", color: "#7fd8ff" }}>
              {entry.prompt} {entry.command}
            </div>
            {entry.output.map((line, j) => (
              <div key={j} style={{ whiteSpace: "pre" }}>
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* SUGGESTION STRIP — local-only, ephemeral Tab-completion hints (see
          scoping choice 2 above); cleared on next keystroke or submit. */}
      {suggestions.length > 0 ? (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            fontFamily: "Consolas, Menlo, monospace",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {suggestions.map((s) => (
            <span key={s} style={{ color: "var(--accent)" }}>
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {/* INPUT LINE */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          background: "#0a0a0f",
          border: "1px solid var(--glass-border)",
          borderRadius: 12,
          padding: "10px 14px",
          fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
          fontSize: 13,
        }}
      >
        <div style={{ color: "#7fd8ff", whiteSpace: "pre" }}>
          {bannerLines.length > 0 ? (
            <>
              {bannerLines.map((b, i) => (
                <div key={i} style={{ color: "#5a6a5a" }}>
                  {b}
                </div>
              ))}
              {livePrompt}
            </>
          ) : (
            livePrompt
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#d6f5d6",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
          aria-label="CLI command input"
        />
      </div>

      {/* RESET DEVICE CONFIRMATION MODAL */}
      {showResetModal ? (
        <Modal
          title="Reset device?"
          onClose={() => setShowResetModal(false)}
          footer={
            <>
              <GhostButton onClick={() => setShowResetModal(false)}>Cancel</GhostButton>
              <PrimaryButton onClick={handleConfirmReset}>Reset {activeMeta.name}</PrimaryButton>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            This will reset <strong>{activeMeta.name}</strong> back to its factory-default configuration
            (interfaces, routes, policies, etc.). The shared terminal scrollback is not affected. This cannot be
            undone.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
