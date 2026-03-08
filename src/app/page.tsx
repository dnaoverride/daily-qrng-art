import Link from "next/link";
import { DailyArtSection } from "@/components/DailyArtSection";
import { getTodayBelgrade } from "@/lib/date";
import { getTranslations } from "next-intl/server";

// Revalidate svakih 24h — stranica ne sadrži per-request dinamičke podatke,
// art sekcija se učitava client-side pa ISR nema štete.
export const revalidate = 86400;

export default async function Home() {
  const today = getTodayBelgrade();
  const t = await getTranslations("home");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-6">
          {t("title")}
        </h1>
        <DailyArtSection date={today} />
        <section className="mt-12 max-w-2xl mx-auto space-y-4 text-zinc-600 dark:text-zinc-400 text-center leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {t("howTitle")}
          </h2>
          <p>{t("paragraph1")}</p>
          <p>{t("paragraph2")}</p>
          <p>{t("paragraph3")}</p>
          <p>
            {t("paragraph4Prefix")}
            <Link
              href="/create-art"
              className="font-medium text-zinc-800 dark:text-zinc-200 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {t("paragraph4Link")}
            </Link>
            {t("paragraph4Suffix")}
          </p>
        </section>
      </main>
    </div>
  );
}
