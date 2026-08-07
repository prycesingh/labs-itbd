"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ServicesCatalogEntry = {
  id: string;
  category: string;
  name: string;
  icon: string | null;
  description: string;
  whenToUse: string | null;
  alternative: string | null;
  pricing: string | null;
};

export function ServicesCatalogBrowser({ entries }: { entries: ServicesCatalogEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const reduce = useReducedMotion();

  const categories = useMemo(() => {
    const seen = new Set<string>();
    entries.forEach((e) => seen.add(e.category));
    return ["All", ...Array.from(seen).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => activeCategory === "All" || e.category === activeCategory)
      .filter((e) => {
        if (!q) return true;
        return `${e.name} ${e.description} ${e.whenToUse ?? ""} ${e.alternative ?? ""} ${e.category}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, query, activeCategory]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search services — e.g. AKS, App Service, Cosmos DB, Key Vault..."
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
          No services match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 divide-y divide-white/10">
            {filtered.map((e, i) => (
              <motion.div
                key={e.id}
                className="grid gap-2 p-4 sm:grid-cols-[240px_1fr]"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
              >
                <div className="flex items-start gap-2">
                  {e.icon ? <span aria-hidden>{e.icon}</span> : null}
                  <span className="font-semibold text-white">{e.name}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                    {e.category}
                  </span>
                </div>
                <div className="text-sm text-white/60">
                  <p>{e.description}</p>
                  {e.whenToUse ? (
                    <p className="mt-1 text-xs">
                      <span className="font-medium text-white/80">When to use:</span> {e.whenToUse}
                    </p>
                  ) : null}
                  {e.alternative ? (
                    <p className="mt-1 text-xs">
                      <span className="font-medium text-white/80">Alternative:</span> {e.alternative}
                    </p>
                  ) : null}
                  {e.pricing ? (
                    <p className="mt-1 text-xs">
                      <span className="font-medium text-white/80">Pricing:</span> {e.pricing}
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
