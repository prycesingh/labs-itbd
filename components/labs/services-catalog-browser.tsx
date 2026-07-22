"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
          No services match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((e) => (
            <div key={e.id} className="grid gap-2 p-4 sm:grid-cols-[240px_1fr]">
              <div className="flex items-start gap-2">
                {e.icon ? <span aria-hidden>{e.icon}</span> : null}
                <span className="font-semibold">{e.name}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {e.category}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{e.description}</p>
                {e.whenToUse ? (
                  <p className="mt-1 text-xs">
                    <span className="font-medium">When to use:</span> {e.whenToUse}
                  </p>
                ) : null}
                {e.alternative ? (
                  <p className="mt-1 text-xs">
                    <span className="font-medium">Alternative:</span> {e.alternative}
                  </p>
                ) : null}
                {e.pricing ? (
                  <p className="mt-1 text-xs">
                    <span className="font-medium">Pricing:</span> {e.pricing}
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
