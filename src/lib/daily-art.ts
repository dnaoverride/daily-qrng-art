/**
 * Server-only: brojevi za sliku dana.
 *
 * - Datum pre DAILY_QUANTUM_FROM → seedFromDate (SHA-256 datuma), kao do sada, pa se
 *   stara arhiva ne menja.
 * - Datum od DAILY_QUANTUM_FROM do danas → red u `daily_art`. Prvi zahtev za taj dan uzima
 *   1000 kvantnih brojeva (qrng_pool → direktno ANU → entropija, ako ANU nije dostupan)
 *   i TRAJNO ih vezuje za datum. Svaki sledeći zahtev čita isti red.
 * - Budući datum (posle današnjeg) → nema slike (ne može se „izvući" unapred).
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { daily_art } from "./schema";
import { fetchQRNG, randomEntropySeed, seedFromDate } from "./qrng-server";
import { ARCHIVE_START, getTodayBelgrade } from "./date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Odluka 2026-11-22: cela arhiva (od prvog dana sajta) je kvantna.
const DEFAULT_FROM = ARCHIVE_START;

/** Prvi dan kvantne slike dana (env DAILY_QUANTUM_FROM, YYYY-MM-DD). */
export const DAILY_QUANTUM_FROM: string = (() => {
  const env = process.env.DAILY_QUANTUM_FROM;
  return env && DATE_RE.test(env) ? env : DEFAULT_FROM;
})();

export type ValuesSource = "date" | "pool" | "qrng" | "entropy";

export interface DailyValues {
  values: number[];
  source: ValuesSource;
  /** ISO vreme preuzimanja iz ANU (null za "date"). */
  fetchedAt: string | null;
}

export class FutureDateError extends Error {}

function parseValues(raw: unknown): number[] | null {
  try {
    const v = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.length === 1000 ? v.map((n) => Number(n) & 0xffff) : null;
  } catch {
    return null;
  }
}

/**
 * 1000 kvantnih brojeva: najstariji neiskorišćen red iz qrng_pool (atomski označen kao
 * iskorišćen), pa direktno ANU, pa kriptografska entropija. Deli ga i /api/generate.
 */
export interface ClaimedValues {
  values: number[];
  source: Exclude<ValuesSource, "date">;
  fetchedAt: Date;
  /** id reda u qrng_pool (samo za source "pool"). */
  poolId?: number;
}

export async function claimQuantumValues(): Promise<ClaimedValues> {
  try {
    // Jedna naredba zauzima najstariji slobodan red (UPDATE … ORDER BY … LIMIT 1) i pamti
    // njegov id u LAST_INSERT_ID() te konekcije → potpuno atomski, i kada arhiva odjednom
    // traži 20+ dana. Transakcija garantuje istu konekciju za oba upita.
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await db.transaction(async (tx) => {
        const [res] = (await tx.execute(
          sql`UPDATE qrng_pool SET used = 1, usedAt = NOW(3), id = LAST_INSERT_ID(id) WHERE used = 0 ORDER BY fetchedAt ASC LIMIT 1`
        )) as unknown as [{ affectedRows: number }];
        if (!res.affectedRows) return null;
        const [rows] = (await tx.execute(
          sql`SELECT id, \`values\`, fetchedAt FROM qrng_pool WHERE id = LAST_INSERT_ID()`
        )) as unknown as [{ id: number; values: unknown; fetchedAt: Date }[]];
        return rows[0] ?? null;
      });
      if (!row) {
        console.warn("[qrng] Pool is empty, falling back to direct ANU fetch");
        break;
      }
      const values = parseValues(row.values);
      if (values) return { values, source: "pool", fetchedAt: new Date(row.fetchedAt), poolId: row.id };
      console.warn("[qrng] Pool row invalid length or parse failed, skipping row id", row.id);
    }
  } catch (e) {
    console.warn("[qrng] Pool read failed, falling back to direct ANU fetch:", e);
  }

  try {
    return { values: await fetchQRNG(), source: "qrng", fetchedAt: new Date() };
  } catch (e) {
    console.warn("[qrng] Direct ANU fetch failed, falling back to entropy:", e);
  }
  return { values: randomEntropySeed(), source: "entropy", fetchedAt: new Date() };
}

// Vezani dani se nikad ne menjaju → keš u memoriji (ograničen).
const cache = new Map<string, DailyValues>();
const MAX_CACHE = 400;
function remember(date: string, v: DailyValues): DailyValues {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(date, v);
  return v;
}

function rowToDaily(row: { values: unknown; source: string; fetchedAt: Date }): DailyValues | null {
  const values = parseValues(row.values);
  if (!values) return null;
  return { values, source: row.source as ValuesSource, fetchedAt: new Date(row.fetchedAt).toISOString() };
}

/** Da li datum koristi kvantne brojeve iz daily_art (a ne seedFromDate). */
export function isQuantumDate(date: string): boolean {
  return date >= DAILY_QUANTUM_FROM;
}

/** Brojevi za sliku dana. Baca FutureDateError za datum posle današnjeg (od prelaska). */
export async function getDailyValues(date: string): Promise<DailyValues> {
  if (!isQuantumDate(date)) return { values: seedFromDate(date), source: "date", fetchedAt: null };
  if (date > getTodayBelgrade()) throw new FutureDateError(date);

  const hit = cache.get(date);
  if (hit) return hit;

  // Istovremeni zahtevi za isti dan u ovom procesu dele jedan upit/zauzimanje.
  let p = inflight.get(date);
  if (!p) {
    p = loadOrBind(date).finally(() => inflight.delete(date));
    inflight.set(date, p);
  }
  return p;
}

const inflight = new Map<string, Promise<DailyValues>>();

async function loadOrBind(date: string): Promise<DailyValues> {
  const [existing] = await db.select().from(daily_art).where(eq(daily_art.date, date)).limit(1);
  const found = existing && rowToDaily(existing);
  if (found) return remember(date, found);

  // Prvi zahtev za ovaj dan: uzmi kvantne brojeve i veži ih. Ako je neko drugi u
  // međuvremenu upisao red (isti primarni ključ), važi NJEGOV red — svi vide istu sliku.
  const q = await claimQuantumValues();
  const now = new Date();
  await db
    .insert(daily_art)
    .values({ date, values: q.values, source: q.source, fetchedAt: q.fetchedAt, createdAt: now })
    .onDuplicateKeyUpdate({ set: { date } });
  const [row] = await db.select().from(daily_art).where(eq(daily_art.date, date)).limit(1);
  const bound = row && rowToDaily(row);
  if (!bound) throw new Error(`daily_art: red za ${date} nije čitljiv`);

  // Izgubili smo trku (drugi proces je vezao dan pre nas) → vrati naš red u bazen.
  if (q.poolId !== undefined && bound.values.some((v, i) => v !== q.values[i])) {
    await db
      .execute(sql`UPDATE qrng_pool SET used = 0, usedAt = NULL WHERE id = ${q.poolId}`)
      .catch((e) => console.warn("[qrng] Could not return pool row", q.poolId, e));
  }
  return remember(date, bound);
}

/**
 * Za više datuma odjednom (arhiva): jedan upit, BEZ vezivanja novih dana. Dan koji još
 * nema red izostaje iz rezultata (arhiva tada nema ime scene), a vezuje se kad se otvori
 * njegova sličica ili stranica — postepeno, umesto ~260 dana u jednom zahtevu.
 */
export async function getDailyValuesMany(dates: string[]): Promise<Record<string, DailyValues>> {
  const out: Record<string, DailyValues> = {};
  const today = getTodayBelgrade();
  const need: string[] = [];
  for (const d of dates) {
    if (!isQuantumDate(d)) out[d] = { values: seedFromDate(d), source: "date", fetchedAt: null };
    else if (d <= today) {
      const hit = cache.get(d);
      if (hit) out[d] = hit;
      else need.push(d);
    }
  }
  if (need.length) {
    const rows = await db.select().from(daily_art).where(inArray(daily_art.date, need));
    for (const r of rows) {
      const v = rowToDaily(r);
      if (v) out[r.date] = remember(r.date, v);
    }
  }
  return out;
}
