"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArtCanvas } from "./ArtCanvas";
import { QRNGReveal } from "./QRNGReveal";
import { SaveFavoriteButton } from "./SaveFavoriteButton";
import { scenarioNameFor } from "@/lib/scenarios";
import { renderVersionForDate } from "@/lib/render-version";

interface ArtPageContentProps {
  date: string;
}

export function ArtPageContent({ date }: ArtPageContentProps) {
  const [values, setValues] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("art");

  useEffect(() => {
    fetch(`/api/art/${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.values) setValues(data.values);
        else setError(data.error || t("error"));
      })
      .catch(() => setError(t("errorLoad")));
  }, [date]);

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-zinc-500">{t("loading")}</p>
      </div>
    );
  }

  const scenarioName = scenarioNameFor(values, renderVersionForDate(date));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {t("title", { date })}
        </h1>
        <SaveFavoriteButton values={values} scenarioName={scenarioName} />
      </div>
      <div className="flex justify-center">
        <ArtCanvas values={values} date={date} />
      </div>
      <QRNGReveal values={values} date={date} />
    </div>
  );
}