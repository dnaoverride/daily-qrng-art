"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlgoArtCanvas } from "@/components/AlgoArtCanvas";
import { QRNGReveal } from "@/components/QRNGReveal";
import { PHILOSOPHIES } from "@/lib/algorithmic/types";

interface Favorite {
  id: string;
  title: string | null;
  scenarioName: string | null;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: string;
  // values se ne vraća u list view-u — preuzima se lazy kada kartica uđe u viewport
  values?: number[];
}

function FavoriteCard({
  fav,
  onDelete,
  onTogglePublic,
}: {
  fav: Favorite;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean, shareToken: string | null) => void;
}) {
  const t = useTranslations("profile");
  const tAlgo = useTranslations("algorithmic");
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [values, setValues] = useState<number[] | undefined>(fav.values);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    await fetch(`/api/favorites/${fav.id}`, { method: "DELETE" });
    onDelete(fav.id);
  }

  useEffect(() => {
    if (values) return;
    const card = cardRef.current;
    if (!card) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        fetch(`/api/favorites/${fav.id}`)
          .then((res) => res.json())
          .then((data: { favorite?: Favorite }) => {
            if (cancelled) return;
            const v = data.favorite?.values;
            const arr = Array.isArray(v)
              ? v
              : typeof v === "string"
                ? (JSON.parse(v) as number[])
                : null;
            if (arr && arr.length) setValues(arr);
          })
          .catch(() => {});
      },
      { rootMargin: "200px" }
    );
    observer.observe(card);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [fav.id, values]);

  async function handleTogglePublic() {
    setToggling(true);
    const res = await fetch(`/api/favorites/${fav.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !fav.isPublic }),
    });
    if (res.ok) {
      const data = await res.json() as { favorite: Favorite };
      onTogglePublic(fav.id, data.favorite.isPublic, data.favorite.shareToken ?? null);
    }
    setToggling(false);
  }

  function handleCopy() {
    if (!fav.shareToken) return;
    const url = `${window.location.origin}/f/${fav.shareToken}`;
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("copyLink"), url);
    }
    document.body.removeChild(textarea);
  }

  const date = new Date(fav.createdAt).toLocaleDateString("sr-Latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function getDisplayScenarioName(raw: string | null): string | null {
    if (!raw) return null;
    if (raw.startsWith("algo:")) {
      const id = raw.slice(5);
      const ph = PHILOSOPHIES.find((p) => p.id === id);
      if (ph) return tAlgo(ph.labelKey);
    }
    return raw;
  }

  const displayScenario = getDisplayScenarioName(fav.scenarioName ?? null);

  return (
    <div ref={cardRef} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
        {values ? (
          <AlgoArtCanvas values={values} scenarioName={fav.scenarioName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full animate-pulse bg-zinc-200 dark:bg-zinc-700" />
        )}
      </div>

      {values && values.length > 0 && (
        <div className="px-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40">
          <QRNGReveal values={values} className="mt-0 max-w-none mx-0" />
        </div>
      )}

      <div className="p-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {fav.title ?? t("noTitle")}
        </h3>
        {displayScenario && (
          <p className="text-xs text-zinc-400 mt-0.5">
            {t("scenario", { name: displayScenario })}
          </p>
        )}
        <p className="text-xs text-zinc-400 mt-0.5">{t("createdAt", { date })}</p>

        <div className="flex flex-wrap gap-2 mt-3">
          {fav.isPublic && fav.shareToken && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied ? t("copied") : t("copyLink")}
            </button>
          )}
          <button
            type="button"
            onClick={handleTogglePublic}
            disabled={toggling}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {fav.isPublic ? t("makePrivate") : t("makePublic")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 ml-auto"
          >
            {t("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("profile");

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const loadFavorites = useCallback(async () => {
    const res = await fetch("/api/favorites");
    if (res.ok) {
      const data = await res.json() as { favorites: Favorite[] };
      setFavorites(data.favorites);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void loadFavorites();
    }
  }, [status, loadFavorites]);

  function handleDelete(id: string) {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }

  function handleTogglePublic(id: string, isPublic: boolean, shareToken: string | null) {
    setFavorites((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, isPublic, shareToken } : f
      )
    );
  }

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-700 dark:text-zinc-300">
            {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {session?.user?.name ?? t("title")}
            </h1>
            <p className="text-sm text-zinc-500">{session?.user?.email}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
          {t("favorites")}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-pulse">
                <div className="aspect-video bg-zinc-100 dark:bg-zinc-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 mb-4">{t("empty")}</p>
            <Link
              href="/create-art"
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity text-sm"
            >
              {t("goToPlayground")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => (
              <FavoriteCard
                key={fav.id}
                fav={fav}
                onDelete={handleDelete}
                onTogglePublic={handleTogglePublic}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
