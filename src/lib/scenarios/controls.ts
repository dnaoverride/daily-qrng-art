/**
 * Kontrole scene za Studio (samo v2).
 *
 * Svaka scena i dalje donosi svoje odluke iz QRNG-a („Auto ⚛"); kontrola samo
 * zamenjuje rezultat odluke. Pravila:
 *  - stream se troši ISTO sa i bez kontrola (odluka se računa pa se zameni),
 *    pa su ostale kvantne odluke iste;
 *  - bez kontrola (dnevna slika, arhiva, OG, sličice) sve vraća prirodnu vrednost
 *    → izgled je bit-identičan;
 *  - `optional()` crta opcioni element tako da uključivanje/isključivanje
 *    menja samo taj element (rand se troši identično ili iz posebnog forka).
 */
import { mulberry32, type Rand } from "../prng";

export type SceneControls = Record<string, boolean | number>;

/** Polja koja router dodaje na SceneHooks. */
export interface ControlHooks {
  controls?: SceneControls;
  /** Seme za fork PRNG-a (iz brojeva), za elemente koji su forsirano uključeni. */
  forkSeed?: number;
  /** Router: beleži prirodne (kvantne) odluke, da UI pokaže „Auto (uklj/isklj/ime)". */
  report?: (key: string, natural: boolean | number) => void;
}

/** Prekidač: override iz kontrola ili prirodna (kvantna) odluka. */
export function toggle(hooks: ControlHooks, key: string, natural: boolean): boolean {
  hooks.report?.(key, natural);
  const v = hooks.controls?.[key];
  return typeof v === "boolean" ? v : natural;
}

/** Izbor (paleta, lokacija, doba…): override indeks ili prirodna odluka. */
export function choice(hooks: ControlHooks, key: string, natural: number, count: number): number {
  hooks.report?.(key, natural);
  const v = hooks.controls?.[key];
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < count ? v : natural;
}

/** Da li korisnik menja ovaj ključ (za scenarije koji sami rešavaju fork). */
export function isOverridden(hooks: ControlHooks, key: string): boolean {
  return hooks.controls?.[key] !== undefined;
}

function hashKey(seed: number, key: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  return h || 1;
}

/** Nezavisan PRNG za element (isti za isti ključ — i u odrazu). */
export function forkRand(hooks: ControlHooks, key: string): Rand {
  return mulberry32(hashKey(hooks.forkSeed ?? 1, key));
}

type Ctx = CanvasRenderingContext2D;
let sink: Ctx | null = null;

/** 1×1 platno u koje se „crta" isključen element da bi se rand potrošio identično. */
export function sinkCtx(): Ctx {
  if (!sink) {
    const c =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1)
        : Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
    sink = c.getContext("2d") as unknown as Ctx;
  }
  sink.setTransform(1, 0, 0, 1, 0, 0);
  return sink;
}

/**
 * Opcioni element.
 *  - prirodno uključen, bez override-a → draw(ctx, rand)   (kao pre kontrola)
 *  - prirodno uključen, isključen       → draw(sink, rand)  (rand potrošen isto, ništa se ne vidi)
 *  - prirodno isključen, uključen       → draw(ctx, fork)   (glavni rand netaknut)
 *  - prirodno isključen, bez override-a → ništa
 * Vraća da li je element vidljiv.
 */
export function optional(
  ctx: Ctx,
  hooks: ControlHooks,
  key: string,
  natural: boolean,
  rand: Rand,
  draw: (ctx: Ctx, rand: Rand) => void
): boolean {
  const on = toggle(hooks, key, natural);
  if (natural && on) draw(ctx, rand);
  else if (natural && !on) draw(sinkCtx(), rand);
  else if (!natural && on) draw(ctx, forkRand(hooks, key));
  return on;
}

/* ───────────── Registar kontrola po scenariju (za UI) ───────────── */

export interface ControlDef {
  key: string;
  type: "toggle" | "choice";
  /** Ključ prevoda: messages → studio.ctl.<label> */
  label: string;
  /** Za choice: ključevi prevoda opcija (messages → studio.opt.<opcija>), po indeksu. */
  options?: string[];
}

/** Kontrole u tekstu (URL `c=` i favorit): `birds:off,clouds:on,palette:3`. */
export function encodeControls(c: SceneControls): string {
  return Object.entries(c)
    .map(([k, v]) => `${k}:${typeof v === "boolean" ? (v ? "on" : "off") : v}`)
    .join(",");
}

export function decodeControls(s: string | null | undefined): SceneControls {
  const out: SceneControls = {};
  for (const part of (s ?? "").split(",")) {
    const [k, v] = part.split(":");
    if (!k || v === undefined || !/^\w+$/.test(k)) continue;
    if (v === "on" || v === "off") out[k] = v === "on";
    else if (/^\d+$/.test(v)) out[k] = Number(v);
  }
  return out;
}
