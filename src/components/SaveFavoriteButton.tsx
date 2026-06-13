"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { AlgoPreset } from "@/lib/algorithmic/preset-code";

interface SaveFavoriteButtonProps {
  values: number[];
  scenarioName?: string | null;
  algoPreset?: AlgoPreset | null;
}

export function SaveFavoriteButton({ values, scenarioName, algoPreset }: SaveFavoriteButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("favorites");

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    setOpen(true);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, title, scenarioName, algoPreset, isPublic }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? t("error"));
        return;
      }
      setSaved(true);
      setOpen(false);
      setTitle("");
      setIsPublic(false);
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {saved ? t("saved") : t("save")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {t("save")}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("titleLabel")}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("titlePlaceholder")}
                  maxLength={80}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 text-sm"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 accent-zinc-800"
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t("publicLabel")}</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? t("saving") : t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
