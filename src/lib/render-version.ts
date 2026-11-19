/**
 * Verzionisanje renderera (client-safe).
 *
 * Svaka slika se crta iz sačuvanih brojeva, pa bi svaka izmena scenarija
 * retroaktivno promenila celu arhivu. Zato:
 *   - v1 = zamrznut kod u src/lib/scenarios/v1/ (ne menja se nikad)
 *   - v2 = aktivni kod u src/lib/scenarios/*.ts (ovde idu poboljšanja)
 *
 * Verzija se određuje po DATUMU (YYYY-MM-DD, Europe/Belgrade):
 *   datum < RENDER_V2_FROM  → v1
 *   datum >= RENDER_V2_FROM → v2
 *
 * RENDER_V2_FROM se čita iz NEXT_PUBLIC_RENDER_V2_FROM (inline-uje se u build).
 * Podrazumevano je daleka budućnost, pa produkcija ostaje na v1 dok se pri
 * deploy-u eksplicitno ne postavi datum prelaska (vidi DEPLOY-CHECKLIST.md).
 */
import { getTodayBelgrade } from "./date";

export type RenderVersion = 1 | 2;

export const LATEST_RENDER_VERSION: RenderVersion = 2;

const DEFAULT_V2_FROM = "2099-01-01";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const RENDER_V2_FROM: string = (() => {
  const env = process.env.NEXT_PUBLIC_RENDER_V2_FROM;
  return env && DATE_RE.test(env) ? env : DEFAULT_V2_FROM;
})();

/**
 * Revizija izgleda po verziji — ulazi u URL i keš ključ thumbnail/OG slika,
 * da browser/CDN ne služe staru sliku posle izmene renderera.
 * v1 je zamrznut (nikad se ne menja). v2 POVEĆATI pri svakoj vizuelnoj izmeni v2
 * koja ide na produkciju (vidi README → Verzionisanje renderera).
 */
export const RENDER_REVISION: Record<RenderVersion, string> = {
  1: "1",
  2: "2.1",
};

/** Verzija za datum slike (YYYY-MM-DD). Nevalidan datum → v1 (bezbedno). */
export function renderVersionForDate(date: string): RenderVersion {
  if (!DATE_RE.test(date)) return 1;
  return date >= RENDER_V2_FROM ? 2 : 1;
}

/** Revizija za datum slike — za cache-busting URL-ova (`&r=`). */
export function renderRevisionForDate(date: string): string {
  return RENDER_REVISION[renderVersionForDate(date)];
}

/** Verzija za trenutak nastanka (npr. favorit.createdAt), po beogradskom datumu. */
export function renderVersionForTimestamp(ts: Date | string | number): RenderVersion {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 1;
  const date = d
    .toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Belgrade",
    })
    .replace(/\//g, "-");
  return renderVersionForDate(date);
}

/** Verzija za sliku koja nastaje sada (create-art, studio). */
export function currentRenderVersion(): RenderVersion {
  return renderVersionForDate(getTodayBelgrade());
}
