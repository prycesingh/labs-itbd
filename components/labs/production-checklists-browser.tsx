"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProductionChecklistItem = {
  id: string;
  checklistName: string;
  category: string;
  item: string;
};

export function ProductionChecklistsBrowser({ items }: { items: ProductionChecklistItem[] }) {
  const [query, setQuery] = useState("");
  const [activeChecklist, setActiveChecklist] = useState("All");
  const reduce = useReducedMotion();

  const checklistNames = useMemo(() => {
    const seen = new Set<string>();
    items.forEach((i) => seen.add(i.checklistName));
    return ["All", ...Array.from(seen).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => activeChecklist === "All" || i.checklistName === activeChecklist).filter((i) => {
      if (!q) return true;
      return `${i.checklistName} ${i.category} ${i.item}`.toLowerCase().includes(q);
    });
  }, [items, query, activeChecklist]);

  const grouped = useMemo(() => {
    const byChecklist = new Map<string, Map<string, ProductionChecklistItem[]>>();
    for (const item of filtered) {
      if (!byChecklist.has(item.checklistName)) byChecklist.set(item.checklistName, new Map());
      const byCategory = byChecklist.get(item.checklistName)!;
      if (!byCategory.has(item.category)) byCategory.set(item.category, []);
      byCategory.get(item.category)!.push(item);
    }
    return Array.from(byChecklist.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search checklist items — e.g. NSG, backup, encryption, autoscale..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-white/10 bg-black/40 text-white placeholder:text-white/40 focus-visible:border-itbd-blue focus-visible:ring-itbd-blue/30"
      />
      <div className="flex flex-wrap gap-2">
        {checklistNames.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveChecklist(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              c === activeChecklist
                ? "border-itbd-blue/40 bg-itbd-blue/10 text-itbd-blue"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          No checklist items match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([checklistName, byCategory], groupIndex) => (
            <motion.div
              key={checklistName}
              className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(groupIndex, 12) * 0.03 }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
              />
              <div className="relative z-10 border-b border-white/10 bg-white/5 px-4 py-2 font-semibold text-white">
                {checklistName}
              </div>
              <div className="relative z-10 divide-y divide-white/10">
                {Array.from(byCategory.entries()).map(([category, categoryItems]) => (
                  <div key={category} className="p-4">
                    <p className="mb-2 text-xs font-medium text-white/60 uppercase">{category}</p>
                    <ul className="space-y-1.5 text-sm text-white/80">
                      {categoryItems.map((item) => (
                        <li key={item.id} className="flex gap-2">
                          <span className="text-white/40">□</span>
                          <span dangerouslySetInnerHTML={{ __html: item.item }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
