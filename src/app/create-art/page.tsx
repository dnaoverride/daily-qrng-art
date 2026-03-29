"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArtCanvas } from "@/components/ArtCanvas";
import { QRNGReveal } from "@/components/QRNGReveal";
import { SaveFavoriteButton } from "@/components/SaveFavoriteButton";
import {
  SCENARIO_NAMES,
  NUM_SCENARIOS,
} from "@/lib/scenarios";
import { getTodayBelgrade } from "@/lib/date";
import { parseFavoriteScenarioToPhilosophyId } from "@/lib/algorithmic/scenario-name";

const REQUIRED_COUNT = 1000;

function parseValues(text: string): number[] | null {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== REQUIRED_COUNT) return null;
  const values: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    values.push((n >>> 0) & 0xffff);
  }
  return values;
}

function CreateArtPageInner() {
  const [input, setInput] = useState("");
  const [values, setValues] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const t = useTranslations("createArt");
  const searchParams = useSearchParams();
  const router = useRouter();
  const favoriteId = searchParams.get("favorite");

  useEffect(() => {
    if (!favoriteId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/favorites/${favoriteId}`);
        const data = (await res.json()) as {
          favorite?: { values?: unknown; scenarioName?: string | null };
        };
        if (!alive || !res.ok || !data.favorite) {
          if (alive) {
            setError(t("errorLoadFavorite"));
            router.replace("/create-art");
          }
          return;
        }
        const raw = data.favorite.values;
        const vals = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? (JSON.parse(raw) as number[])
            : [];
        if (vals.length !== REQUIRED_COUNT) {
          if (alive) {
            setError(t("errorLoadFavorite"));
            router.replace("/create-art");
          }
          return;
        }
        if (parseFavoriteScenarioToPhilosophyId(data.favorite.scenarioName) !== null) {
          if (alive) router.replace(`/algorithmic?favorite=${favoriteId}`);
          return;
        }
        if (!alive) return;
        setInput(vals.join(", "));
        setValues(vals);
        router.replace("/create-art");
      } catch {
        if (alive) {
          setError(t("errorLoadFavorite"));
          router.replace("/create-art");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [favoriteId, router, t]);

  function handleGenerate() {
    setError(null);
    const parsed = parseValues(input);
    if (!parsed) {
      setError(t("errorRequired"));
      setValues(null);
      return;
    }
    setValues(parsed);
  }

  async function handleLoadToday() {
    setError(null);
    const today = getTodayBelgrade();
    try {
      const res = await fetch(`/api/art/${today}`);
      if (!res.ok) throw new Error("Nije moguće učitati.");
      const data = (await res.json()) as { values?: number[] };
      if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) {
        throw new Error("Neispravan odgovor.");
      }
      setInput(data.values.join(", "));
      setValues(data.values);
    } catch {
      setError(t("errorLoadToday"));
    }
  }

  async function handleRandom() {
    setError(null);
    try {
      const res = await fetch("/api/generate");
      const text = await res.text();
      let data: { values?: number[] };
      try {
        data = JSON.parse(text) as { values?: number[] };
      } catch {
        throw new Error("not json");
      }
      if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) {
        throw new Error("Neispravan odgovor.");
      }
      setInput(data.values.join(", "));
      setValues(data.values);
    } catch {
      setError(t("errorRandom"));
    }
  }

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrng-art-${Date.now()}.png`;
    a.click();
  }

  const scenarioName =
    values && values.length >= 4
      ? SCENARIO_NAMES[
          ((values[0]! ^ values[1]! ^ values[2]! ^ values[3]!) >>> 0) %
            NUM_SCENARIOS
        ] ?? "Pejzaž"
      : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-20 pb-16 px-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-6">
          {t("title")}
        </h1>

        <div className="space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            rows={8}
            className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRandom}
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity"
            >
              {t("random")}
            </button>
            <button
              type="button"
              onClick={handleLoadToday}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t("loadToday")}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t("generate")}
            </button>
            {values && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t("downloadPng")}
                </button>
                <SaveFavoriteButton values={values} scenarioName={scenarioName} />
              </>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        {values && (
          <div className="mt-8">
            {scenarioName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                {t("scenario", { name: scenarioName })}
              </p>
            )}
            <ArtCanvas
              values={values}
              onCanvasReady={(el) => {
                canvasRef.current = el;
              }}
            />
            <QRNGReveal values={values} />
          </div>
        )}
      </main>
    </div>
  );
}

export default function CreateArtPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" />}>
      <CreateArtPageInner />
    </Suspense>
  );
}
