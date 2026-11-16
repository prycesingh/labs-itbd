"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Batch filter (+ "all trainers" for oversight) for the review queue.
 *  Changing a filter drops the selected trainee so the queue restarts. */
export function ReviewFilters({
  batches,
  canViewAll,
}: {
  batches: { id: number; name: string }[];
  canViewAll: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    next.delete("trainee");
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {batches.length > 0 && (
        <Select value={params.get("batch") ?? "any"} onValueChange={(v) => set("batch", v === "any" ? null : v)}>
          <SelectTrigger size="sm" className="w-48" aria-label="Filter by batch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Every batch</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {canViewAll && (
        <Select value={params.get("scope") === "all" ? "all" : "mine"} onValueChange={(v) => set("scope", v === "all" ? "all" : null)}>
          <SelectTrigger size="sm" className="w-40" aria-label="Whose trainees">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">My trainees</SelectItem>
            <SelectItem value="all">All trainers</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
