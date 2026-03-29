import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { getTodayBelgrade } from "@/lib/date";
import { ArchiveThumbnail } from "@/components/ArchiveThumbnail";
import { MonthAccordion } from "@/components/MonthAccordion";

export const revalidate = 3600;

const LAUNCH_DATE = "2026-03-04";

interface MonthGroup {
  key: string;
  label: string;
  dates: string[];
}

function getDateRange(start: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const startDate = new Date(sy!, sm! - 1, sd!);
  const todayStr = getTodayBelgrade();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const today = new Date(ty!, tm! - 1, td!);
  today.setHours(0, 0, 0, 0);

  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  while (d <= today) {
    dates.push(
      d
        .toLocaleDateString("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "-")
    );
    d.setDate(d.getDate() + 1);
  }

  return dates.reverse();
}

function groupByMonth(dates: string[], locale: string): MonthGroup[] {
  const intlLocale = locale === "sr" ? "sr-Latn-RS" : locale;
  const map = new Map<string, MonthGroup>();

  for (const date of dates) {
    const key = date.slice(0, 7); // "2026-03"
    if (!map.has(key)) {
      const [y, m] = key.split("-").map(Number);
      const label = new Intl.DateTimeFormat(intlLocale, {
        month: "long",
        year: "numeric",
      }).format(new Date(y!, m! - 1, 1));
      map.set(key, { key, label, dates: [] });
    }
    map.get(key)!.dates.push(date);
  }

  return Array.from(map.values());
}

export default async function ArchivePage() {
  const dates = getDateRange(LAUNCH_DATE);
  const t = await getTranslations("archive");
  const locale = await getLocale();

  const groups = groupByMonth(dates, locale);
  const currentKey = getTodayBelgrade().slice(0, 7);
  const currentGroup = groups.find((g) => g.key === currentKey);
  const prevGroups = groups.filter((g) => g.key !== currentKey);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
          {t("title")}
        </h1>

        {dates.length === 0 ? (
          <p className="text-zinc-500">{t("empty")}</p>
        ) : (
          <div className="space-y-10">
            {/* Tekući mesec — uvek otvoren */}
            {currentGroup && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
                  {t("currentMonth")}
                  <span className="ml-2 normal-case font-normal capitalize text-zinc-400 dark:text-zinc-500">
                    — {currentGroup.label}
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {currentGroup.dates.map((date) => (
                    <Link
                      key={date}
                      href={`/art/${date}`}
                      className="block p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                    >
                      <ArchiveThumbnail date={date} />
                      <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {date}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Prethodni meseci — accordion */}
            {prevGroups.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
                  {t("previousMonths")}
                </h2>
                <div className="space-y-3">
                  {prevGroups.map((group) => (
                    <MonthAccordion
                      key={group.key}
                      label={group.label}
                      dates={group.dates}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
