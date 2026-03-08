import { notFound } from "next/navigation";
import Link from "next/link";
import { ArtCanvas } from "@/components/ArtCanvas";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedFavoritePage({ params }: PageProps) {
  const { token } = await params;
  const t = await getTranslations("shared");

  const favorite = await prisma.favorite.findUnique({
    where: { shareToken: token },
    include: { user: { select: { name: true } } },
  });

  if (!favorite || !favorite.isPublic) {
    notFound();
  }

  const values = Array.isArray(favorite.values) ? (favorite.values as number[]) : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {favorite.title ?? t("noTitle")}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {favorite.scenarioName && (
              <span className="text-sm text-zinc-500">
                {t("scenario", { name: favorite.scenarioName })}
              </span>
            )}
            {favorite.user?.name && (
              <span className="text-sm text-zinc-400">
                {t("observer", { name: favorite.user.name })}
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
          <ArtCanvas values={values} />
        </div>

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
