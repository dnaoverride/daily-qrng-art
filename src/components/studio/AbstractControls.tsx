"use client";

import { useTranslations } from "next-intl";
import { PALETTE_ORDER, type AlgoParams, type Palette, type PhilosophyId } from "@/lib/algorithmic/types";
import { PALETTE_LABEL_KEY, SLIDERS } from "./abstract-sliders";

interface AbstractControlsProps {
  id: PhilosophyId;
  params: AlgoParams;
  onChange: (params: AlgoParams) => void;
  onRandomize: () => void;
  lockPhilosophy: boolean;
  lockPalette: boolean;
  onLockPhilosophy: (v: boolean) => void;
  onLockPalette: (v: boolean) => void;
  /** Flow-field animacija */
  animate: boolean;
  onAnimate: (v: boolean) => void;
}

/** Parametri apstrakcije — isti opsezi i palete kao u starom /algorithmic. */
export function AbstractControls(p: AbstractControlsProps) {
  const t = useTranslations("algorithmic");
  const values = p.params as unknown as Record<string, number | string>;

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("palette")}</span>
        <select
          value={p.params.palette}
          onChange={(e) => p.onChange({ ...p.params, palette: e.target.value as Palette })}
          className="w-full min-h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {PALETTE_ORDER.map((v) => (
            <option key={v} value={v}>
              {t(PALETTE_LABEL_KEY[v]!)}
            </option>
          ))}
        </select>
      </label>

      {SLIDERS[p.id].map((s) => {
        const v = Number(values[s.key]);
        return (
          <label key={s.key} className="block space-y-1.5">
            <span className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>{t(s.label)}</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">{v.toFixed(s.decimals ?? 0)}</span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={v}
              onChange={(e) => p.onChange({ ...p.params, [s.key]: parseFloat(e.target.value) } as AlgoParams)}
              className="w-full accent-violet-600 h-6 cursor-pointer"
            />
          </label>
        );
      })}

      {p.id === "flow-field" && (
        <button
          type="button"
          onClick={() => p.onAnimate(!p.animate)}
          className="w-full min-h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {p.animate ? t("pause") : t("resume")}
        </button>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={p.onRandomize}
          className="w-full min-h-11 rounded-lg border border-violet-400 dark:border-violet-700 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950"
        >
          {t("randomizeStyle")}
        </button>
        <div className="flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={p.lockPhilosophy} onChange={(e) => p.onLockPhilosophy(e.target.checked)} />
            {t("lockPhilosophy")}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={p.lockPalette} onChange={(e) => p.onLockPalette(e.target.checked)} />
            {t("lockPalette")}
          </label>
        </div>
      </div>
    </div>
  );
}
