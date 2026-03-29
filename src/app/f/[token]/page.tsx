import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { AlgoArtCanvas } from "@/components/AlgoArtCanvas";
import { QRNGReveal } from "@/components/QRNGReveal";
import { PHILOSOPHIES } from "@/lib/algorithmic/types";
import { db } from "@/lib/db";
import { favorites, users } from "@/lib/schema";
import { getTranslations } from "next-intl/server";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedFavoritePage({ params }: PageProps) {
  const { token } = await params;
  const t = await getTranslations("shared");

  const rows = await db
    .select({
      id: favorites.id,
      title: favorites.title,
      values: favorites.values,
      scenarioName: favorites.scenarioName,
      isPublic: favorites.isPublic,
      createdAt: favorites.createdAt,
      userName: users.name,
    })
    .from(favorites)
    .leftJoin(users, eq(favorites.userId, users.id))
    .where(eq(favorites.shareToken, token))
    .limit(1);

  if (!rows.length || !rows[0].isPublic) {
    notFound();
  }

  const favorite = rows[0];
  const rawValues = favorite.values;
  const values = Array.isArray(rawValues)
    ? rawValues
    : typeof rawValues === "string"
      ? (JSON.parse(rawValues) as number[])
      : [];

  const tAlgo = await getTranslations("algorithmic");

  function getDisplayScenarioName(raw: string | null | undefined): string | null {
    if (!raw) return null;
    if (raw.startsWith("algo:")) {
      const id = raw.slice(5);
      const ph = PHILOSOPHIES.find((p) => p.id === id);
      if (ph) return tAlgo(ph.labelKey);
    }
    return raw;
  }

  const displayScenario = getDisplayScenarioName(favorite.scenarioName);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {favorite.title ?? t("noTitle")}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {displayScenario && (
              <span className="text-sm text-zinc-500">
                {t("scenario", { name: displayScenario })}
              </span>
            )}
            {favorite.userName && (
              <span className="text-sm text-zinc-400">
                {t("observer", { name: favorite.userName })}
              </span>
            )}
            <span className="text-sm text-zinc-400">
              {new Date(favorite.createdAt).toLocaleDateString("sr-Latn", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <AlgoArtCanvas
            values={values}
            scenarioName={favorite.scenarioName}
            className="w-full max-w-4xl h-auto rounded-lg shadow-xl"
          />
        </div>

        {values.length > 0 && (
          <div className="mb-8 max-w-4xl mx-auto">
            <QRNGReveal values={values} className="max-w-none mx-0" />
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/create-art"
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm"
          >
            {t("goToPlayground")}
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity text-sm"
          >
            {t("goHome")}
          </Link>
        </div>
      </main>
    </div>
  );
}
