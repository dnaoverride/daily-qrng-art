"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArchiveThumbnail } from "./ArchiveThumbnail";

interface MonthAccordionProps {
  label: string;
  dates: string[];
}

export function MonthAccordion({ label, dates }: MonthAccordionProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("archive");

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors text-left"
      >
        <span className="font-medium text-zinc-800 dark:text-zinc-200 capitalize">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            {t("daysCount", { count: dates.length })}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {dates.map((date) => (
              <Link
                key={date}
                href={`/art/${date}`}
                className="block p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <ArchiveThumbnail date={date} />
                <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {date}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
