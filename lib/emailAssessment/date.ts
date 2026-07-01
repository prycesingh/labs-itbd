export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function differenceInSeconds(laterDate: Date, earlierDate: Date) {
  return Math.floor((laterDate.getTime() - earlierDate.getTime()) / 1_000);
}

export function isOnOrAfter(date: Date, compareDate: Date) {
  return date.getTime() >= compareDate.getTime();
}
