"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
      />
      <div className="flex flex-wrap gap-2">
        {levels.map((l) => (
          <button key={l} type="button" onClick={() => setActiveLevel(l)}>
            <Badge variant={l === activeLevel ? "default" : "outline"} className="cursor-pointer">
              {l === "All" ? "All" : levelLabel(l)}
            </Badge>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No queries match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((entry) => (
            <div key={entry.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{entry.title}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {levelLabel(entry.level)}
                </Badge>
              </div>
              {entry.description ? (
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              ) : null}
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                <code>{entry.kqlQuery}</code>
              </pre>
              {entry.explanation ? (
                <div
                  className="text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h4]:mb-1 [&_h4]:font-medium [&_h4]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: entry.explanation }}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
