"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CloudComparisonEntry = {
  id: string;
  category: string;
  label: string;
  azureEquivalent: string | null;
  awsEquivalent: string | null;
  gcpEquivalent: string | null;
  note: string | null;
};

export function CloudComparisonBrowser({ comparisons }: { comparisons: CloudComparisonEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const reduce = useReducedMotion();

  const categories = useMemo(() => {
    const seen = new Set<string>();
    comparisons.forEach((c) => seen.add(c.category));
    return ["All", ...Array.from(seen).sort()];
  }, [comparisons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return comparisons
      .filter((c) => activeCategory === "All" || c.category === activeCategory)
      .filter((c) => {
        if (!q) return true;
        return `${c.label} ${c.azureEquivalent ?? ""} ${c.awsEquivalent ?? ""} ${c.gcpEquivalent ?? ""} ${c.note ?? ""} ${c.category}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [comparisons, query, activeCategory]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search — e.g. VNet, load balancer, IAM, data warehouse..."
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
          No entries match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 divide-y divide-white/10">
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                className="grid gap-2 p-4 sm:grid-cols-[200px_1fr]"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
              >
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-white">{c.label}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                    {c.category}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="grid gap-1 sm:grid-cols-3">
                    <p>
                      <span className="font-medium text-itbd-blue">Azure:</span>{" "}
                      <span className="text-white/60">{c.azureEquivalent ?? "—"}</span>
                    </p>
                    <p>
                      <span className="font-medium text-white/80">AWS:</span>{" "}
                      <span className="text-white/60">{c.awsEquivalent ?? "—"}</span>
                    </p>
                    <p>
                      <span className="font-medium text-white/80">GCP:</span>{" "}
                      <span className="text-white/60">{c.gcpEquivalent ?? "—"}</span>
                    </p>
                  </div>
                  {c.note ? (
                    <p className="mt-1 text-xs text-white/60">
                      <span className="font-medium text-white/80">Note:</span> {c.note}
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
