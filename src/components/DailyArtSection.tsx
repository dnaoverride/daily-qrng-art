"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArtCanvas } from "./ArtCanvas";
import { QRNGReveal, type ValuesOrigin } from "./QRNGReveal";
import { dailyArtUrl } from "@/lib/date";
import { scenarioIndexFor } from "@/lib/scenarios";
import { renderVersionForDate } from "@/lib/render-version";
import { SceneStory } from "./SceneStory";
import { DownloadPng } from "./DownloadPng";

interface DailyArtSectionProps {
  date: string;
}

export function DailyArtSection({ date }: DailyArtSectionProps) {
  const [values, setValues] = useState<number[] | null>(null);
  const [origin, setOrigin] = useState<ValuesOrigin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("art");

  useEffect(() => {
    fetch(dailyArtUrl(date))
      .then((r) => r.json())
      .then((data) => {
        if (data.values) {
          setValues(data.values);
          setOrigin(data.source ? { source: data.source, fetchedAt: data.fetchedAt ?? null } : null);
        }
        else setError(data.error || t("errorLoad"));
      })
      .catch(() => setError(t("errorLoad")));
  }, [date, t]);

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px] bg-zinc-100 dark:bg-zinc-900 rounded-lg">
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="flex justify-center items-center min-h-[400px] bg-zinc-100 dark:bg-zinc-900 rounded-lg">
        <p className="text-zinc-500">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center">
        <ArtCanvas values={values} date={date} />
      </div>
      <DownloadPng values={values} date={date} className="mt-3 max-w-4xl mx-auto justify-end" />
      <QRNGReveal values={values} date={date} origin={origin} />
      <SceneStory index={scenarioIndexFor(values, renderVersionForDate(date))} className="mt-8 max-w-4xl mx-auto" />
    </div>
  );
}
