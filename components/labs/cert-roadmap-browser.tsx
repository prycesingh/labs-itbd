"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
      />
      <div className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <button key={t} type="button" onClick={() => setActiveTrack(t)}>
            <Badge variant={t === activeTrack ? "default" : "outline"} className="cursor-pointer">
              {t}
            </Badge>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No certifications match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>
                    {c.certCode} — {c.certName}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline">{c.level}</Badge>
                  <Badge variant="outline" className="uppercase">
                    {c.track}
                  </Badge>
                </div>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  {c.studyTime ? (
                    <>
                      <dt className="font-medium text-foreground">Study time</dt>
                      <dd>{c.studyTime}</dd>
                    </>
                  ) : null}
                  {c.examFormat ? (
                    <>
                      <dt className="font-medium text-foreground">Exam format</dt>
                      <dd>{c.examFormat}</dd>
                    </>
                  ) : null}
                  {c.passingScore ? (
                    <>
                      <dt className="font-medium text-foreground">Passing score</dt>
                      <dd>{c.passingScore}</dd>
                    </>
                  ) : null}
                  {c.pricing ? (
                    <>
                      <dt className="font-medium text-foreground">Pricing</dt>
                      <dd>{c.pricing}</dd>
                    </>
                  ) : null}
                </dl>
                {c.skills.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Skills covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {c.tips ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Tips:</span> {c.tips}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
