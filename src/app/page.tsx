import { ArtCanvas } from "@/components/ArtCanvas";
import { Header } from "@/components/Header";
import { DailyArtSection } from "@/components/DailyArtSection";
import { getTodayBelgrade } from "@/lib/date";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = getTodayBelgrade();
  const t = await getTranslations("home");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-6">
          {t("title")}
        </h1>
        <DailyArtSection date={today} />
        <section className="mt-12 max-w-2xl mx-auto space-y-4 text-zinc-600 dark:text-zinc-400 text-center leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {t("howTitle")}
          </h2>
          <p>
            {t("paragraph1Prefix")}
            <strong className="text-zinc-800 dark:text-zinc-200">{t("paragraph1Strong")}</strong>
            {t("paragraph1Suffix")}
          </p>
          <p>{t("paragraph2")}</p>
        </section>
      </main>
    </div>
  );
}
