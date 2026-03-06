"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface QRNGRevealProps {
  values: number[];
  date?: string;
}

export function QRNGReveal({ values, date }: QRNGRevealProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useTranslations("qrngReveal");

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(values));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-left"
      >
        <span className="text-zinc-600 dark:text-zinc-400 text-sm">
          {t("toggle")}
        </span>
        <svg
          className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-zinc-500">
              {t("count", { count: values.length })}{date ? ` · ${date}` : ""}
            </span>
            <button
              type="button"
              onClick={copyJson}
              className="text-xs px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              {copied ? t("copied") : t("copyJson")}
            </button>
          </div>
          <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto max-h-48 overflow-y-auto font-mono">
            {values
              .reduce<number[][]>((rows, v, i) => {
                if (i % 20 === 0) rows.push([]);
                rows[rows.length - 1]!.push(v);
                return rows;
              }, [])
              .map((row) => row.join(", "))
              .join(",\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
