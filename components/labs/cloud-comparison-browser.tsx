"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
          No entries match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((c) => (
            <div key={c.id} className="grid gap-2 p-4 sm:grid-cols-[200px_1fr]">
              <div className="flex items-start gap-2">
                <span className="font-semibold">{c.label}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {c.category}
                </Badge>
              </div>
              <div className="text-sm">
                <div className="grid gap-1 sm:grid-cols-3">
                  <p>
                    <span className="font-medium text-itbd-blue">Azure:</span>{" "}
                    <span className="text-muted-foreground">{c.azureEquivalent ?? "—"}</span>
                  </p>
                  <p>
                    <span className="font-medium">AWS:</span>{" "}
                    <span className="text-muted-foreground">{c.awsEquivalent ?? "—"}</span>
                  </p>
                  <p>
                    <span className="font-medium">GCP:</span>{" "}
                    <span className="text-muted-foreground">{c.gcpEquivalent ?? "—"}</span>
                  </p>
                </div>
                {c.note ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Note:</span> {c.note}
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
