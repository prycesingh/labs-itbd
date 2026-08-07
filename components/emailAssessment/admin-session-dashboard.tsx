"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { GreenButton } from "@/components/app_componentes/customButtons";
import { Input } from "@/components/ui/input";

const MODULE_BASE = "/dashboard/emailAssessments";

type AdminSessionRow = {
  sessionIdentifier: string;
  displayId: string;
  displayName: string;
  candidateEmail: string;
  statusLabel: string;
  startedAt: string;
  lastSubmittedAt: string | null;
  submittedScenarios: number;
  totalScenarios: number;
  aiWeightedTotal: number | null;
  aiGrade: string | null;
  manualWeightedTotal: number | null;
  manualGrade: string | null;
  evaluatorScore: number | null;
};

export function AdminSessionDashboard({ sessions }: { sessions: AdminSessionRow[] }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const filteredSessions = sessions.filter((session) => {
    const haystack = [
      session.displayId,
      session.displayName,
      session.candidateEmail,
      session.statusLabel,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(deferredSearch.trim().toLowerCase());
  });

  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Session dashboard</h2>
          <p className="mt-1 text-sm text-white/60">
            Search and review session-level results, weighted totals, and response status.
          </p>
        </div>
        <Input
          placeholder="Filter by session ID, email, or status"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.18em] text-white/50">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">AI score</th>
                <th className="px-4 py-3">Evaluator score</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.sessionIdentifier} className="border-t border-white/10 align-top text-white/80">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{session.displayId}</p>
                    <p className="max-w-30 truncate text-xs text-white/50">
                      {session.displayName.slice(0, 8)}&hellip;
                    </p>
                  </td>
                  <td className="px-4 py-4">{session.candidateEmail}</td>
                  <td className="px-4 py-4">
                    {session.aiWeightedTotal != null ? (
                      `${session.aiWeightedTotal.toFixed(2)} / 10${session.aiGrade ? ` · ${session.aiGrade}` : ""}`
                    ) : (
                      <span className="text-white/50">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {session.evaluatorScore != null ? (
                      <span className="font-semibold text-itbd-blue">{session.evaluatorScore} / 10</span>
                    ) : (
                      <span className="text-white/40">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-white/50">
                      {session.submittedScenarios}/{session.totalScenarios} submitted
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-white/50">{session.startedAt}</td>
                  <td className="px-4 py-4">
                    <span className="w-fit rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-2.5 py-0.5 text-xs font-semibold text-itbd-blue">
                      {session.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <GreenButton size="sm" asChild>
                      <Link href={`${MODULE_BASE}/sessions/${session.sessionIdentifier}`}>View</Link>
                    </GreenButton>
                  </td>
                </tr>
              ))}
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/50">
                    No sessions matched the current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
