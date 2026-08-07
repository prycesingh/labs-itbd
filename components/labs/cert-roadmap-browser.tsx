"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CertRoadmapEntry = {
  id: string;
  certCode: string;
  certName: string;
  level: string;
  track: string;
  description: string;
  studyTime: string | null;
  examFormat: string | null;
  passingScore: string | null;
  pricing: string | null;
  relatedSims: string | null;
  skills: string[];
  tips: string | null;
  relatedSimulatorKeys: string[];
};

export function CertRoadmapBrowser({ certs }: { certs: CertRoadmapEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeTrack, setActiveTrack] = useState("All");
  const reduce = useReducedMotion();

  const tracks = useMemo(() => {
    const seen = new Set<string>();
    certs.forEach((c) => seen.add(c.track));
    return ["All", ...Array.from(seen).sort()];
  }, [certs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return certs
      .filter((c) => activeTrack === "All" || c.track === activeTrack)
      .filter((c) => {
        if (!q) return true;
        return `${c.certCode} ${c.certName} ${c.description} ${c.level} ${c.track} ${c.skills.join(" ")}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.certCode.localeCompare(b.certCode));
  }, [certs, query, activeTrack]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search certs — e.g. AZ-104, security, associate, KQL..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-white/10 bg-black/40 text-white placeholder:text-white/40 focus-visible:border-itbd-blue focus-visible:ring-itbd-blue/30"
      />
      <div className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTrack(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              t === activeTrack
                ? "border-itbd-blue/40 bg-itbd-blue/10 text-itbd-blue"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          No certifications match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-5 backdrop-blur-md"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
              />
              <div className="relative z-10 space-y-3 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {c.certCode} — {c.certName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-3 py-1 text-xs font-semibold text-itbd-blue">
                      {c.level}
                    </span>
                    <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-3 py-1 text-xs font-semibold text-itbd-blue uppercase">
                      {c.track}
                    </span>
                  </div>
                  <p className="mt-2 text-white/60">{c.description}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-white/60">
                  {c.studyTime ? (
                    <>
                      <dt className="font-medium text-white">Study time</dt>
                      <dd>{c.studyTime}</dd>
                    </>
                  ) : null}
                  {c.examFormat ? (
                    <>
                      <dt className="font-medium text-white">Exam format</dt>
                      <dd>{c.examFormat}</dd>
                    </>
                  ) : null}
                  {c.passingScore ? (
                    <>
                      <dt className="font-medium text-white">Passing score</dt>
                      <dd>{c.passingScore}</dd>
                    </>
                  ) : null}
                  {c.pricing ? (
                    <>
                      <dt className="font-medium text-white">Pricing</dt>
                      <dd>{c.pricing}</dd>
                    </>
                  ) : null}
                </dl>
                {c.skills.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-white/60">Skills covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {c.tips ? (
                  <p className="text-xs text-white/60">
                    <span className="font-medium text-white/80">Tips:</span> {c.tips}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
