"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
    <div className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{term.term}</span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {term.category}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{term.definition}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={deleting}
        onClick={onDelete}
        aria-label={`Delete ${term.term}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
