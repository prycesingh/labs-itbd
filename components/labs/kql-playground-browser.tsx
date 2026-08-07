"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type KqlPlaygroundQuery = {
  id: string;
  level: string;
  title: string;
  description: string | null;
  kqlQuery: string;
  explanation: string | null;
};

const LEVEL_LABELS: Record<string, string> = {
  b: "Beginner",
  i: "Intermediate",
  a: "Advanced",
};

function levelLabel(level: string) {
  return LEVEL_LABELS[level] ?? level;
}

export function KqlPlaygroundBrowser({ queries }: { queries: KqlPlaygroundQuery[] }) {
  const [query, setQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState("All");
  const reduce = useReducedMotion();

  const levels = useMemo(() => {
    const seen = new Set<string>();
    queries.forEach((q) => seen.add(q.level));
    return ["All", ...Array.from(seen).sort()];
  }, [queries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return queries
      .filter((entry) => activeLevel === "All" || entry.level === activeLevel)
      .filter((entry) => {
        if (!q) return true;
        return `${entry.title} ${entry.description ?? ""} ${entry.kqlQuery} ${entry.explanation ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [queries, query, activeLevel]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search queries — e.g. summarize, join, impossible travel, beaconing..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-white/10 bg-black/40 text-white placeholder:text-white/40 focus-visible:border-itbd-blue focus-visible:ring-itbd-blue/30"
      />
      <div className="flex flex-wrap gap-2">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setActiveLevel(l)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              l === activeLevel
                ? "border-itbd-blue/40 bg-itbd-blue/10 text-itbd-blue"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white",
            )}
          >
            {l === "All" ? "All" : levelLabel(l)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          No queries match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 divide-y divide-white/10">
            {filtered.map((entry, i) => (
              <motion.div
                key={entry.id}
                className="space-y-2 p-4"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{entry.title}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                    {levelLabel(entry.level)}
                  </span>
                </div>
                {entry.description ? <p className="text-sm text-white/60">{entry.description}</p> : null}
                <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/60 p-3 text-xs text-white/80">
                  <code>{entry.kqlQuery}</code>
                </pre>
                {entry.explanation ? (
                  <div
                    className="text-sm text-white/60 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-white/80 [&_h4]:mb-1 [&_h4]:font-medium [&_h4]:text-white"
                    dangerouslySetInnerHTML={{ __html: entry.explanation }}
                  />
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
