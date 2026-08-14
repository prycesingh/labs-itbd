export function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
