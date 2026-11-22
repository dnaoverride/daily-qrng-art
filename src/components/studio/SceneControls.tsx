"use client";

import { useTranslations } from "next-intl";
import type { ControlDef, SceneControls as Controls } from "@/lib/scenarios/controls";

interface SceneControlsProps {
  defs: readonly ControlDef[];
  controls: Controls;
  /** Prirodne (kvantne) odluke iz poslednjeg crtanja — za „Auto (…)" oznaku. */
  naturals: Record<string, boolean | number>;
  /** Funkcijsko ažuriranje — više brzih klikova se ne gaze. */
  onChange: (update: (prev: Controls) => Controls) => void;
}

/**
 * Kontrole scene: izbori (paleta, lokacija, doba…) kao padajući meni sa „Auto ⚛",
 * elementi kao trostruki prekidač Auto · Uklj · Isklj.
 */
export function SceneControls({ defs, controls, naturals, onChange }: SceneControlsProps) {
  const t = useTranslations("studio");

  const set = (key: string, value: boolean | number | undefined) =>
    onChange((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });

  const optLabel = (def: ControlDef, o: string) => {
    const k = def.key === "palette" ? `pal.${o}` : `opt.${o}`;
    return t.has(k) ? t(k) : o.replace(/-/g, " ");
  };

  const choices = defs.filter((d) => d.type === "choice");
  const toggles = defs.filter((d) => d.type === "toggle");
  const dirty = Object.keys(controls).length > 0;

  return (
    <div className="space-y-4">
      {choices.map((def) => {
        const nat = naturals[def.key];
        const natName = typeof nat === "number" && def.options?.[nat] ? optLabel(def, def.options[nat]) : "";
        const val = controls[def.key];
        return (
          <label key={def.key} className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t(`ctl.${def.label}`)}</span>
            <select
              value={typeof val === "number" ? String(val) : ""}
              onChange={(e) => set(def.key, e.target.value === "" ? undefined : Number(e.target.value))}
              className="w-full min-h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">{natName ? t("autoNow", { value: natName }) : `${t("auto")} ⚛`}</option>
              {def.options?.map((o, i) => (
                <option key={o} value={i}>
                  {optLabel(def, o)}
                </option>
              ))}
            </select>
          </label>
        );
      })}

      {toggles.length > 0 && (
        <div className="space-y-2">
          {toggles.map((def) => {
            const val = controls[def.key];
            const nat = naturals[def.key];
            const state = typeof val === "boolean" ? (val ? "on" : "off") : "auto";
            const seg = (s: "auto" | "on" | "off", label: string) => (
              <button
                type="button"
                onClick={() => set(def.key, s === "auto" ? undefined : s === "on")}
                aria-pressed={state === s}
                className={`min-h-9 px-2.5 rounded-md text-xs font-medium transition-colors ${
                  state === s
                    ? s === "auto"
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            );
            return (
              <div key={def.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-800 dark:text-zinc-200 min-w-0 truncate">{t(`ctl.${def.label}`)}</span>
                <div className="flex shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800/70 p-0.5">
                  {seg("auto", typeof nat === "boolean" ? `⚛ ${nat ? t("natOn") : t("natOff")}` : `⚛ ${t("auto")}`)}
                  {seg("on", t("on"))}
                  {seg("off", t("off"))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange(() => ({}))}
        disabled={!dirty}
        className="w-full min-h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
      >
        {t("resetAll")}
      </button>
    </div>
  );
}
