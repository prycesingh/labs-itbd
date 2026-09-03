/**
 * Delivery scoring (pace, pausing, fluency, expressiveness) is stored and
 * evaluated on a 1-5 band, unlike content scoring's 0-100 percentage — this
 * converts an averaged 1-5 delivery score to the same 0-100 scale so it can
 * sit next to a content score in the UI without the reader needing to know
 * two different scales are in play.
 */
export function average1To5ToPercentage(
  value: number | null | undefined,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const clamped = Math.max(1, Math.min(5, value));
  return Number((((clamped - 1) / 4) * 100).toFixed(2));
}
