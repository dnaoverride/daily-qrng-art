"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EXPORT_PRESETS, type ExportPresetId } from "@/lib/algorithmic/export-png";
import { exportScenePng } from "@/lib/scene-export";
import { renderVersionForDate } from "@/lib/render-version";

/** Preuzimanje slike dana / arhive u PNG: 1200×675, 2400×1350 ili 3840×2160. */
export function DownloadPng({ values, date, className = "" }: { values: number[]; date: string; className?: string }) {
  const t = useTranslations("algorithmic");
  const [preset, setPreset] = useState<ExportPresetId>("hd");
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await exportScenePng(values, renderVersionForDate(date), {}, preset, `qrng-art-${date}-${preset}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value as ExportPresetId)}
        aria-label={t("exportResolution")}
        className="min-h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm text-zinc-900 dark:text-zinc-100"
      >
        {EXPORT_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="min-h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy ? t("exporting") : `↓ ${t("downloadPng")}`}
      </button>
    </div>
  );
}
