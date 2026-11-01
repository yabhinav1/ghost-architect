/** Calendar-day arithmetic on ISO dates (YYYY-MM-DD), independent of the local time zone. */
export function dayDiff(from: string, to: string): number {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);
}
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => isoDay(new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)));
