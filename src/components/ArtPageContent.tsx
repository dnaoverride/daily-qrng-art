"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArtCanvas } from "./ArtCanvas";
import { QRNGReveal, type ValuesOrigin } from "./QRNGReveal";
import { SaveFavoriteButton } from "./SaveFavoriteButton";
import { DownloadPng } from "./DownloadPng";
import { scenarioIndexFor, scenarioNameFor } from "@/lib/scenarios";
import { SceneStory } from "./SceneStory";
import { renderVersionForDate } from "@/lib/render-version";
import { archiveNeighbors, dailyArtUrl } from "@/lib/date";

type Nav = { prev: string | null; next: string | null };
const NO_NAV: Nav = { prev: null, next: null };
const subscribeNever = () => () => {};
// Stabilan objekat po datumu (useSyncExternalStore traži istu referencu dok se ništa ne menja).
const navCache = new Map<string, Nav>();
function neighborsFor(date: string): Nav {
  let n = navCache.get(date);
  if (!n) {
    n = archiveNeighbors(date);
    navCache.set(date, n);
  }
  return n;
}

function Chevron({
  dir,
  size,
  className = "",
}: {
  dir: "prev" | "next";
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/** Kratak datum za tooltip strelice: „19. nov" / "Nov 19". */
function shortDate(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn-RS" : locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/**
 * Okrugla „frosted glass" strelica preko leve/desne ivice slike.
 * Poluprovidna dok miš nije nad slikom, puna na hover; na dodir uvek vidljiva.
 * Kad nema susednog dana (prvi dan arhive / danas) — ne prikazuje se.
 */
function OverlayArrow({
  target,
  label,
  dir,
  locale,
}: {
  target: string | null;
  label: string;
  dir: "prev" | "next";
  locale: string;
}) {
  if (!target) return null;
  const pos = dir === "prev" ? "left-2 sm:left-3" : "right-2 sm:right-3";
  const nudge = dir === "prev" ? "group-hover/arrow:-translate-x-0.5" : "group-hover/arrow:translate-x-0.5";
  return (
    <Link
      href={`/art/${target}`}
      aria-label={`${label} (${shortDate(target, locale)})`}
      title={`${label} · ${shortDate(target, locale)}`}
      className={`group/arrow absolute top-1/2 -translate-y-1/2 ${pos} z-10 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white shadow-lg backdrop-blur-md transition-all duration-200 opacity-80 [@media(hover:hover)]:opacity-55 group-hover/art:opacity-100 hover:!opacity-100 hover:bg-black/45 hover:scale-105 active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}
    >
      <Chevron dir={dir} size={20} className={`h-5 w-5 sm:h-6 sm:w-6 drop-shadow transition-transform ${nudge}`} />
    </Link>
  );
}

interface ArtPageContentProps {
  date: string;
}

export function ArtPageContent({ date }: ArtPageContentProps) {
  const [values, setValues] = useState<number[] | null>(null);
  const [origin, setOrigin] = useState<ValuesOrigin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("art");
  const router = useRouter();
  const locale = useLocale();
  // Susedni dani se računaju na klijentu (danas po Beogradu), da nema razlike između
  // keširanog servera i stvarnog datuma. Server i hidratacija: bez strelica.
  const nav = useSyncExternalStore(subscribeNever, () => neighborsFor(date), () => NO_NAV);

  // Strelice na tastaturi: ← noviji dan, → stariji dan (isto kao strelice na slici).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "ArrowLeft" && nav.next) router.push(`/art/${nav.next}`);
      else if (e.key === "ArrowRight" && nav.prev) router.push(`/art/${nav.prev}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, router]);

  useEffect(() => {
    fetch(dailyArtUrl(date))
      .then((r) => r.json())
      .then((data) => {
        if (data.values) {
          setValues(data.values);
          setOrigin(data.source ? { source: data.source, fetchedAt: data.fetchedAt ?? null } : null);
        }
        else setError(data.error || t("error"));
      })
      .catch(() => setError(t("errorLoad")));
  }, [date, t]);

  useEffect(() => {
    if (nav.prev) router.prefetch(`/art/${nav.prev}`);
    if (nav.next) router.prefetch(`/art/${nav.next}`);
  }, [nav, router]);

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
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {t("title", { date })}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DownloadPng values={values} date={date} />
          <SaveFavoriteButton values={values} scenarioName={scenarioName} />
        </div>
      </div>
      <div className="flex justify-center">
        <ArtCanvas
          values={values}
          date={date}
          overlay={
            <>
              {/* Levo = noviji dan, desno = stariji (kao listanje arhive unazad). */}
              <OverlayArrow target={nav.next} label={t("next")} dir="prev" locale={locale} />
              <OverlayArrow target={nav.prev} label={t("prev")} dir="next" locale={locale} />
            </>
          }
        />
      </div>
      <QRNGReveal values={values} date={date} origin={origin} />
      <SceneStory index={scenarioIndexFor(values, renderVersionForDate(date))} className="mt-8 max-w-4xl mx-auto" />
    </div>
  );
}