"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const reduce = useReducedMotion();

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
          No gotchas match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 divide-y divide-white/10">
            {filtered.map((g, i) => (
              <motion.div
                key={g.id}
                className="space-y-2 p-4"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{g.title}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                    {g.category}
                  </span>
                </div>
                <div className="grid gap-1 text-sm text-white/60">
                  <p>
                    <span className="font-medium text-white/80">Symptom:</span>{" "}
                    <span dangerouslySetInnerHTML={{ __html: g.symptom }} />
                  </p>
                  <p>
                    <span className="font-medium text-white/80">Cause:</span>{" "}
                    <span dangerouslySetInnerHTML={{ __html: g.cause }} />
                  </p>
                  <p>
                    <span className="font-medium text-white/80">Fix:</span>{" "}
                    <span dangerouslySetInnerHTML={{ __html: g.fix }} />
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
