"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const reduce = useReducedMotion();

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
        className="border-white/10 bg-black/40 text-white placeholder:text-white/40 focus-visible:border-itbd-blue focus-visible:ring-itbd-blue/30"
      />
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              c === activeCategory
                ? "border-itbd-blue/40 bg-itbd-blue/10 text-itbd-blue"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          No terms match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 divide-y divide-white/10">
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                className="grid gap-2 p-4 sm:grid-cols-[220px_1fr]"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
              >
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-white">{t.term}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                    {t.category}
                  </span>
                </div>
                <div className="text-sm text-white/60">
                  <p>{t.definition}</p>
                  {t.example ? (
                    <p className="mt-1 text-xs">
                      <span className="font-medium text-white/80">Example:</span> {t.example}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
