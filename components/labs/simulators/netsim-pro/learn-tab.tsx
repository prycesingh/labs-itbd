"use client";

// NetSim Pro — Learn tab. Ported from itbd-lab/simulators/network's
// `#tab-learn` markup (lesson content lives in content.ts, already extracted)
// and js/learn.js (toggleLesson/markLesson/filterLevels/updateLearnProgress).
//
// ===== Bug fix built in (user-approved, see task) =====
// Source's per-level "0/N completed" headers (index.html tab-learn section
// headers) are static text — never recomputed as lessons get marked studied.
// Here each level header's "X/N completed" is derived for real from
// `state.progress.learn` on every render (see `countCompletedForLevel`
// below), so it always reflects current progress instead of a frozen "0".
//
// Interaction mapping from source (js/learn.js):
// - toggleLesson(id)      -> dispatch(TOGGLE_LESSON_EXPANDED) toggling
//                            state.expandedLessons[lesson.id]
// - markLesson(id, val)   -> dispatch(MARK_LESSON) + notify() toast
//                            (source's NetSim.notify call, learn.js:38)
// - filterLevels(level)   -> dispatch(SET_LEVEL_FILTER); active button style
//                            driven by state.levelFilter instead of DOM
//                            className rewriting (learn.js:41-56)
// - updateLearnProgress() -> no longer needed as an imperative DOM pass:
//                            badge/button/opacity/border-left are derived
//                            directly from state.progress.learn on every
//                            render (learn.js:58-72 restored completed state
//                            the same way markLesson's true-branch did, so
//                            both call sites collapse into one render path).

import type { NetSimState } from "@/lib/labs/simulators/netsim-pro/types";
import type { LessonLevel, Lesson } from "@/lib/labs/simulators/netsim-pro/types";
import type { NetSimAction } from "@/lib/labs/simulators/netsim-pro/reducer";
import { LESSONS } from "@/lib/labs/simulators/netsim-pro/content";
import { Badge, Card, GhostButton, PrimaryButton, notify } from "./netsim-ui";
import styles from "./netsim-console.module.css";

// ===== Level metadata (source's exact icons/subtitles, index.html tab-learn) =====
type LevelDef = {
  level: LessonLevel;
  icon: string;
  label: string;
  subtitle: string;
  accent: string;
  total: number;
};

const LEVELS: LevelDef[] = [
  { level: "beginner", icon: "\u{1F7E2}", label: "Beginner", subtitle: "Networking Fundamentals — Start Here", accent: "#10b981", total: 9 },
  { level: "intermediate", icon: "\u{1F535}", label: "Intermediate", subtitle: "VLANs, Routing, STP, ACLs", accent: "#3b82f6", total: 9 },
  { level: "advanced", icon: "\u{1F7E1}", label: "Advanced", subtitle: "OSPF, BGP, VPN, Firewalls, QoS", accent: "#f59e0b", total: 8 },
  { level: "expert", icon: "\u{1F534}", label: "Expert", subtitle: "MPLS, SD-WAN, Zero Trust, Automation", accent: "#ef4444", total: 7 },
  { level: "master", icon: "\u{1F451}", label: "Master", subtitle: "Enterprise Architecture & Mastery — The Final Boss", accent: "#8b5cf6", total: 7 },
];

const FILTER_BUTTONS: { level: LessonLevel | "all"; label: string }[] = [
  { level: "all", label: "All" },
  { level: "beginner", label: "\u{1F7E2} Beginner" },
  { level: "intermediate", label: "\u{1F535} Intermediate" },
  { level: "advanced", label: "\u{1F7E1} Advanced" },
  { level: "expert", label: "\u{1F534} Expert" },
  { level: "master", label: "\u{1F451} Master" },
];

// Real completed-count for a level (fixes source's static "0/N completed").
function countCompletedForLevel(level: LessonLevel, learnProgress: Record<string, boolean>): number {
  return LESSONS.filter((l) => l.level === level && learnProgress[l.id] === true).length;
}

function LessonCard({
  lesson,
  expanded,
  done,
  onToggle,
  onMark,
}: {
  lesson: Lesson;
  expanded: boolean;
  done: boolean;
  onToggle: () => void;
  onMark: (next: boolean) => void;
}) {
  const levelLabel = LEVELS.find((l) => l.level === lesson.level)?.label ?? lesson.level;

  return (
    <div style={done ? { opacity: 0.7, borderLeft: "3px solid #10b981", borderRadius: 16 } : undefined}>
      <Card className={undefined}>
        <div className={styles.accordionHeader} onClick={onToggle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>{lesson.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{lesson.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Lesson {lesson.order} &middot; {levelLabel}
              </div>
            </div>
          </div>
          <span className={`${styles.accordionCaret} ${expanded ? styles.accordionCaretOpen : ""}`}>&#9656;</span>
        </div>

        {expanded ? (
          <div className={styles.accordionBody}>
            <div dangerouslySetInnerHTML={{ __html: lesson.bodyHtml }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              <Badge tone={done ? "green" : "yellow"}>{done ? "✅ Completed" : "Not Started"}</Badge>
              <PrimaryButton small onClick={() => onMark(!done)}>
                {done ? "↩️ Mark as Not Studied" : "✅ Mark as Studied"}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function LevelSection({
  def,
  state,
  dispatch,
}: {
  def: LevelDef;
  state: NetSimState;
  dispatch: React.Dispatch<NetSimAction>;
}) {
  const lessons = LESSONS.filter((l) => l.level === def.level).sort((a, b) => a.order - b.order);
  const completed = countCompletedForLevel(def.level, state.progress.learn);

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
          paddingLeft: 12,
          borderLeft: `3px solid ${def.accent}`,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700 }}>
            <span>{def.icon}</span>
            <span>{def.label}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{def.subtitle}</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: def.accent }}>
          {completed}/{def.total} completed
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            expanded={state.expandedLessons[lesson.id] ?? false}
            done={state.progress.learn[lesson.id] === true}
            onToggle={() => dispatch({ type: "TOGGLE_LESSON_EXPANDED", lessonId: lesson.id })}
            onMark={(next) => {
              dispatch({ type: "MARK_LESSON", lessonId: lesson.id, done: next });
              notify(next ? "Lesson marked as studied!" : "Lesson unmarked", next ? "success" : "info");
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function LearnTab({ state, dispatch }: { state: NetSimState; dispatch: React.Dispatch<NetSimAction> }) {
  return (
    <div>
      <h2 className={styles.sectionTitle}>{"\u{1F4DA}"} Learn</h2>
      <p className={styles.sectionSubtitle}>
        40 lessons across 5 levels — from networking fundamentals to enterprise architecture mastery.
      </p>

      {/* LEVEL FILTER BAR */}
      <div id="levelFilters" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {FILTER_BUTTONS.map((btn) => {
          const active = state.levelFilter === btn.level;
          const onClick = () => dispatch({ type: "SET_LEVEL_FILTER", level: btn.level });
          return active ? (
            <PrimaryButton key={btn.level} small onClick={onClick}>
              {btn.label}
            </PrimaryButton>
          ) : (
            <GhostButton key={btn.level} small onClick={onClick}>
              {btn.label}
            </GhostButton>
          );
        })}
      </div>

      {/* LEVEL SECTIONS */}
      {LEVELS.filter((def) => state.levelFilter === "all" || state.levelFilter === def.level).map((def) => (
        <LevelSection key={def.level} def={def} state={state} dispatch={dispatch} />
      ))}
    </div>
  );
}
