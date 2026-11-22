"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArchiveThumbnail } from "./ArchiveThumbnail";

interface MonthAccordionProps {
  /** Ključ meseca (npr. "2026-07") — za pamćenje otvorenih meseci. */
  monthKey: string;
  label: string;
  dates: string[];
  /** Indeks scenarija po datumu (računa server). */
  scenarios: Record<string, number>;
}

const OPEN_KEY = "archive:open";
const LAST_KEY = "archive:last";

function readOpen(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeOpen(monthKey: string, open: boolean) {
  try {
    const set = new Set(readOpen());
    if (open) set.add(monthKey);
    else set.delete(monthKey);
    sessionStorage.setItem(OPEN_KEY, JSON.stringify([...set]));
  } catch {
    /* sessionStorage nedostupan — ništa */
  }
}

export function MonthAccordion({ monthKey, label, dates, scenarios }: MonthAccordionProps) {
  const [open, setOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollTo = useRef<string | null>(null);

  // Posle povratka sa slike (Back): vrati otvorene mesece iz sessionStorage-a
  // i skroluj do poslednje otvorene slike.
  useEffect(() => {
    if (!readOpen().includes(monthKey)) return;
    try {
      const last = sessionStorage.getItem(LAST_KEY);
      if (last && dates.includes(last)) {
        scrollTo.current = last;
        sessionStorage.removeItem(LAST_KEY);
      }
    } catch {
      /* ništa */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stanje iz sessionStorage-a postoji samo na klijentu
    setOpen(true);
  }, [monthKey, dates]);

  useEffect(() => {
    if (!open || !scrollTo.current) return;
    const el = gridRef.current?.querySelector(`[data-date="${scrollTo.current}"]`);
    scrollTo.current = null;
    el?.scrollIntoView({ block: "center" });
  }, [open]);

  const toggle = () => {
    writeOpen(monthKey, !open);
    setOpen(!open);
  };

  const rememberDate = (date: string) => {
    try {
      sessionStorage.setItem(LAST_KEY, date);
    } catch {
      /* ništa */
    }
  };
  const t = useTranslations("archive");
  const tScenario = useTranslations("scenario");

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={toggle}
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
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {dates.map((date) => (
              <Link
                key={date}
                href={`/art/${date}`}
                data-date={date}
                onClick={() => rememberDate(date)}
                className="block p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <ArchiveThumbnail date={date} />
                <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {date}
                </p>
                {scenarios[date] !== undefined && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {tScenario(`s${scenarios[date]}`)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
