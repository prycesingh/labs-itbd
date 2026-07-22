"use client";

import { useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";

export function SeedContentButton() {
  const [loading, setLoading] = useState(false);

  async function runSeed() {
    setLoading(true);
    try {
      const res = await fetch("/api/labs/admin/seed", { method: "POST" });
      if (!res.ok) {
        toast.error("Seed failed.");
        return;
      }
      const data = await res.json();
      toast.success(
        `Glossary: ${data.glossary.inserted} added, ${data.glossary.skipped} already present. ` +
          `Quizzes: ${data.quizzes.certsInserted} certs, ${data.quizzes.questionsInserted} questions added. ` +
          `Services: ${data.servicesCatalog.inserted} added. Cloud comparison: ${data.cloudComparison.inserted} added. ` +
          `Gotchas: ${data.gotchas.inserted} added. Cert roadmap: ${data.certRoadmap.inserted} added. ` +
          `Checklists: ${data.productionChecklists.inserted} added. KQL: ${data.kqlPlayground.inserted} added. ` +
          `Flowchart steps: ${data.troubleshootFlowcharts.inserted} added.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DefaultButton onClick={runSeed} loading={loading}>
      Import glossary + quiz content
    </DefaultButton>
  );
}
