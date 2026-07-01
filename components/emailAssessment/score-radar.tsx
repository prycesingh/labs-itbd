"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import type { CategoryScores } from "@/DB/emailAssessmentSchema";

const labels: Record<keyof CategoryScores, string> = {
  professionalTone: "Tone",
  grammarLanguage: "Grammar",
  clarityEmpathyRespect: "Clarity",
  structure: "Structure",
  completeness: "Completeness",
};

const maxValues: CategoryScores = {
  professionalTone: 20,
  grammarLanguage: 20,
  clarityEmpathyRespect: 30,
  structure: 15,
  completeness: 15,
};

export function ScoreRadar({ scores }: { scores: CategoryScores }) {
  const data = Object.entries(scores).map(([key, value]) => ({
    category: labels[key as keyof CategoryScores],
    score: Math.round((value / maxValues[key as keyof CategoryScores]) * 100),
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="category" />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
          <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.28} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
