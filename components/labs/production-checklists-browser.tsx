"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ProductionChecklistItem = {
  id: string;
  checklistName: string;
  category: string;
  item: string;
};

export function ProductionChecklistsBrowser({ items }: { items: ProductionChecklistItem[] }) {
  const [query, setQuery] = useState("");
  const [activeChecklist, setActiveChecklist] = useState("All");

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
      />
      <div className="flex flex-wrap gap-2">
        {checklistNames.map((c) => (
          <button key={c} type="button" onClick={() => setActiveChecklist(c)}>
            <Badge variant={c === activeChecklist ? "default" : "outline"} className="cursor-pointer">
              {c}
            </Badge>
          </button>
        ))}
      </div>
      {grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No checklist items match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([checklistName, byCategory]) => (
            <div key={checklistName} className="rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-2 font-semibold">{checklistName}</div>
              <div className="divide-y">
                {Array.from(byCategory.entries()).map(([category, categoryItems]) => (
                  <div key={category} className="p-4">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{category}</p>
                    <ul className="space-y-1.5 text-sm">
                      {categoryItems.map((item) => (
                        <li key={item.id} className="flex gap-2">
                          <span className="text-muted-foreground">□</span>
                          <span dangerouslySetInnerHTML={{ __html: item.item }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
