"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type GlossaryTerm = {
  id: string;
  term: string;
  category: string;
  definition: string;
  example: string | null;
};

export function GlossaryBrowser({ terms }: { terms: GlossaryTerm[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(() => {
    const seen = new Set<string>();
    terms.forEach((t) => seen.add(t.category));
    return ["All", ...Array.from(seen).sort()];
  }, [terms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms
      .filter((t) => activeCategory === "All" || t.category === activeCategory)
      .filter((t) => {
        if (!q) return true;
        return `${t.term} ${t.definition} ${t.example ?? ""} ${t.category}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, query, activeCategory]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search terms — e.g. PIM, FSMO, OSPF, KQL, NSG, AiTM, MFA, GPO..."
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
          No terms match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((t) => (
            <div key={t.id} className="grid gap-2 p-4 sm:grid-cols-[220px_1fr]">
              <div className="flex items-start gap-2">
                <span className="font-semibold">{t.term}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {t.category}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{t.definition}</p>
                {t.example ? (
                  <p className="mt-1 text-xs">
                    <span className="font-medium">Example:</span> {t.example}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
