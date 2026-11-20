/** Trenutni datum u Belgrade timezone (YYYY-MM-DD), resetuje se u 00:00 srpsko vreme */
export function getTodayBelgrade(): string {
  return new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Belgrade",
  }).replace(/\//g, "-");
}

/** Prvi dan arhive (pokretanje sajta). */
export const ARCHIVE_START = "2026-03-04";

/** Pomera YYYY-MM-DD za `days` dana (UTC aritmetika, bez DST problema). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

/** Prethodni/sledeći dan u arhivi, ili null van opsega [ARCHIVE_START, danas]. */
export function archiveNeighbors(
  date: string,
  today: string = getTodayBelgrade()
): { prev: string | null; next: string | null } {
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  return {
    prev: prev >= ARCHIVE_START && prev <= today ? prev : null,
    next: next >= ARCHIVE_START && next <= today ? next : null,
  };
}
