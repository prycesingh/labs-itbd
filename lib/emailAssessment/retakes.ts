import { addDays, isOnOrAfter } from "@/lib/emailAssessment/date";

export const RETAKE_COOLDOWN_DAYS = 3;

export function nextRetakeAt(lastSubmittedAt: Date) {
  return addDays(lastSubmittedAt, RETAKE_COOLDOWN_DAYS);
}

export function canRetake(lastSubmittedAt: Date | null | undefined, now = new Date()) {
  if (!lastSubmittedAt) {
    return { allowed: true, nextEligibleAt: null };
  }

  const nextEligibleAt = nextRetakeAt(lastSubmittedAt);

  return {
    allowed: isOnOrAfter(now, nextEligibleAt),
    nextEligibleAt,
  };
}

export function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
