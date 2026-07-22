"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type GotchaEntry = {
  id: string;
  category: string;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
};

export function GotchasBrowser({ gotchas }: { gotchas: GotchaEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(() => {
    const seen = new Set<string>();
    gotchas.forEach((g) => seen.add(g.category));
    return ["All", ...Array.from(seen).sort()];
  }, [gotchas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gotchas
      .filter((g) => activeCategory === "All" || g.category === activeCategory)
      .filter((g) => {
        if (!q) return true;
        return `${g.title} ${g.symptom} ${g.cause} ${g.fix} ${g.category}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [gotchas, query, activeCategory]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search gotchas — e.g. NSG, replication, MFA, quota..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setActiveCategory(c)}>
            <Badge variant={c === activeCategory ? "default" : "outline"} className="cursor-pointer">
              {c}
            </Badge>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No gotchas match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((g) => (
            <div key={g.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{g.title}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {g.category}
                </Badge>
              </div>
              <div className="grid gap-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Symptom:</span>{" "}
                  <span dangerouslySetInnerHTML={{ __html: g.symptom }} />
                </p>
                <p>
                  <span className="font-medium text-foreground">Cause:</span>{" "}
                  <span dangerouslySetInnerHTML={{ __html: g.cause }} />
                </p>
                <p>
                  <span className="font-medium text-foreground">Fix:</span>{" "}
                  <span dangerouslySetInnerHTML={{ __html: g.fix }} />
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
