export type LabBestScore = { score: number; timeSec: number; hintsUsed: number; when: string };
export type LabScores = Record<string, LabBestScore>;

const STORAGE_KEY = "azure_lab_scores";

export function loadLabScores(): LabScores {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as LabScores;
  } catch {
    return {};
  }
}

export function saveLabScore(id: string, score: LabBestScore): LabScores {
  const scores = loadLabScores();
  const prev = scores[id];
  if (!prev || score.score > prev.score) {
    scores[id] = score;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    }
  }
  return scores;
}
