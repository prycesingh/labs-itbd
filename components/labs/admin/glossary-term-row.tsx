"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type GlossaryTermRowProps = {
  term: {
    id: string;
    term: string;
    category: string;
    definition: string;
  };
};

export function GlossaryTermRow({ term }: GlossaryTermRowProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    const response = await fetch(`/api/labs/admin/glossary/${term.id}`, { method: "DELETE" });
    setDeleting(false);

    if (!response.ok) {
      toast.error("Unable to delete term.");
      return;
    }

    toast.success("Term deleted.");
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{term.term}</span>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
            {term.category}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/60">{term.definition}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={deleting}
        onClick={onDelete}
        aria-label={`Delete ${term.term}`}
        className="hover:text-orange-300"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
