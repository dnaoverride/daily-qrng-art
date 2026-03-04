/** Trenutni datum u Belgrade timezone (YYYY-MM-DD), resetuje se u 00:00 srpsko vreme */
export function getTodayBelgrade(): string {
  return new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Belgrade",
  }).replace(/\//g, "-");
}
