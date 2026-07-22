"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ArticleSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  sourcePage: string;
  summary: string | null;
  sortOrder: number;
};

export function ArticlesBrowser({ articles }: { articles: ArticleSummary[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(() => {
    const seen = new Set<string>();
    articles.forEach((a) => seen.add(a.category));
    return ["All", ...Array.from(seen).sort()];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles
      .filter((a) => activeCategory === "All" || a.category === activeCategory)
      .filter((a) => {
        if (!q) return true;
        return `${a.title} ${a.summary ?? ""} ${a.category}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }, [articles, query, activeCategory]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search articles — e.g. OSPF, Zero Trust, RAG, postmortem, Graph API..."
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
          No articles match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/labs/articles/${a.slug}`}
              className="grid gap-2 p-4 transition-colors hover:bg-accent sm:grid-cols-[220px_1fr]"
            >
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary">{a.title}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {a.category}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {a.summary ? <p>{a.summary}</p> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
