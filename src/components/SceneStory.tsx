"use client";

import { useTranslations } from "next-intl";
import { SCENE_CONTROLS } from "@/lib/scenarios/controls-registry";

interface SceneStoryProps {
  /** Indeks scene (v2), isti kao `scenario.sN`. */
  index: number;
  className?: string;
}

/**
 * Kratka priča o sceni: šta prikazuje i šta kvantni brojevi u njoj biraju.
 * Spisak izbora dolazi iz registra kontrola scene (isti kao u Studiju), pa je uvek tačan.
 */
export function SceneStory({ index, className = "" }: SceneStoryProps) {
  const t = useTranslations("sceneStory");
  const tScenario = useTranslations("scenario");
  const tStudio = useTranslations("studio");
  if (!t.has(`s${index}`)) return null;
  const choices = (SCENE_CONTROLS[index] ?? []).map((def) => tStudio(`ctl.${def.label}`));

  return (
    <section className={`space-y-3 ${className}`} aria-labelledby="scene-story-heading">
      <h2 id="scene-story-heading" className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">
        {t("title")}
      </h2>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 space-y-2">
        <p className="text-xs font-medium text-violet-700 dark:text-violet-400/90">{tScenario(`s${index}`)}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{t(`s${index}`)}</p>
        {choices.length > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("chooses")}</span> {choices.join(", ")}.
          </p>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed">{t("intro")}</p>
      <details className="group text-sm text-zinc-600 dark:text-zinc-500">
        <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
          {t("technical")}
        </summary>
        <p className="mt-2 leading-relaxed">{t("technicalText")}</p>
      </details>
    </section>
  );
}
