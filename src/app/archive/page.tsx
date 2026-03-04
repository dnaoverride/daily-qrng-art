import { Header } from "@/components/Header";
import Link from "next/link";

const PROJECT_START = "2025-03-01";

function getDateRange(start: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const startDate = new Date(sy!, sm! - 1, sd!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(startDate);
  while (d <= today) {
    dates.push(
      d.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).replace(/\//g, "-")
    );
    d.setDate(d.getDate() + 1);
  }

  return dates.reverse();
}

export default function ArchivePage() {
  const dates = getDateRange(PROJECT_START);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          Arhiva generisanih slika
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {dates.map((date) => (
            <Link
              key={date}
              href={`/art/${date}`}
              className="block p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded mb-2 flex items-center justify-center text-zinc-400 text-sm">
                {date}
              </div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {date}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
