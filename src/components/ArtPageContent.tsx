"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArtCanvas } from "./ArtCanvas";
import { QRNGReveal } from "./QRNGReveal";
import { SaveFavoriteButton } from "./SaveFavoriteButton";
import { SCENARIO_NAMES, NUM_SCENARIOS } from "@/lib/scenarios";

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

  const scenarioName =
    values.length >= 4
      ? SCENARIO_NAMES[((values[0]! ^ values[1]! ^ values[2]! ^ values[3]!) >>> 0) % NUM_SCENARIOS] ?? "Pejzaž"
      : null;

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