/**
 * Apollonian gasket: Descartes circle theorem + BFS po trojkama tangentnih krugova.
 * Početni skup: zakrivljenosti -1, 2, 2, 3 (klasični Descartes/Soddy četvorougao).
 * @see https://www.malinc.se/math/geometry/apolloniangasketen.php
 */

import type { ApollonianParams } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

type Vec2 = [number, number];

interface ACircle {
  bend: number;
  x: number;
  y: number;
  depth: number;
}

function vadd(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function vscale(s: number, a: Vec2): Vec2 {
  return [s * a[0], s * a[1]];
}

function vmul(a: Vec2, b: Vec2): Vec2 {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function vdiv(a: Vec2, b: Vec2): Vec2 {
  const br = b[0],
    bi = b[1];
  const d = br * br + bi * bi;
  if (d < 1e-20) return [NaN, NaN];
  return [(a[0] * br + a[1] * bi) / d, (a[1] * br - a[0] * bi) / d];
}

/** Glavni koren kompleksnog korena (drugi je suprotan). */
function csqrtPrincipal(re: number, im: number): Vec2 {
  const r = Math.hypot(re, im);
  if (r < 1e-15) return [0, 0];
  const sr = Math.sqrt((r + re) / 2);
  const si = im >= 0 ? Math.sqrt((r - re) / 2) : -Math.sqrt((r - re) / 2);
  return [sr, si];
}

function bendCenter(bend: number, x: number, y: number): Vec2 {
  return [bend * x, bend * y];
}

/** Descartes: dva moguća b4 za četvrti krug tangentan na tri data. */
function descartesBends(b1: number, b2: number, b3: number): [number, number] {
  const s = b1 + b2 + b3;
  const inner = b1 * b2 + b2 * b3 + b3 * b1;
  const t = 2 * Math.sqrt(Math.max(0, inner));
  return [s + t, s - t];
}

/** Četvrti krug(ovi) — do dva rešenja; centar iz kompleksnog proširenja. */
function fourthCirclesFromTriple(a: ACircle, b: ACircle, c: ACircle): ACircle[] {
  const b1 = a.bend,
    b2 = b.bend,
    b3 = c.bend;
  const bends = descartesBends(b1, b2, b3);
  const bz1 = bendCenter(b1, a.x, a.y);
  const bz2 = bendCenter(b2, b.x, b.y);
  const bz3 = bendCenter(b3, c.x, c.y);
  const sum = vadd(vadd(bz1, bz2), bz3);
  const Q = vadd(vadd(vmul(bz1, bz2), vmul(bz2, bz3)), vmul(bz3, bz1));
  const w = csqrtPrincipal(Q[0], Q[1]);
  const sqrtBranches: Vec2[] = [w, [-w[0], -w[1]]];

  const out: ACircle[] = [];
  const bSeen = new Set<string>();
  for (const b4 of bends) {
    if (Math.abs(b4) < 1e-8) continue;
    const bk = b4.toFixed(8);
    if (bSeen.has(bk)) continue;
    bSeen.add(bk);
    for (const root of sqrtBranches) {
      const num = vadd(sum, vscale(2, root));
      const z = vdiv(num, [b4, 0]);
      if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue;
      out.push({ bend: b4, x: z[0], y: z[1], depth: Math.max(a.depth, b.depth, c.depth) + 1 });
    }
  }
  return out;
}

function radius(c: ACircle): number {
  return 1 / Math.abs(c.bend);
}

function approxSameCircle(p: ACircle, q: ACircle, epsPos: number, epsR: number): boolean {
  const rp = radius(p),
    rq = radius(q);
  if (Math.abs(rp - rq) > epsR) return false;
  return Math.hypot(p.x - q.x, p.y - q.y) < epsPos;
}

function matchesAny(p: ACircle, list: ACircle[], epsPos: number, epsR: number): boolean {
  return list.some((q) => approxSameCircle(p, q, epsPos, epsR));
}

function tripleKey(i: number, j: number, k: number): string {
  const t = [i, j, k].sort((x, y) => x - y);
  return `${t[0]},${t[1]},${t[2]}`;
}

/** QRNG: mala perturbacija [-amp, amp] oko 0.5 normalizacije. */
function pert(v: number | undefined, amp: number): number {
  const u = (v ?? 32767) / 65535;
  return (u - 0.5) * 2 * amp;
}

/**
 * QRNG: prvih 12 vrednosti blago pomera bend i centre početna četiri kruga.
 */
function buildSeedCircles(values: number[]): ACircle[] {
  const ampB = 0.04;
  const ampXY = 0.012;
  const b0 = -1 + pert(values[0], ampB);
  const b1 = 2 + pert(values[1], ampB);
  const b2 = 2 + pert(values[2], ampB);
  const b3 = 3 + pert(values[3], ampB);
  const x1 = 0.5 + pert(values[4], ampXY);
  const y1 = 0 + pert(values[5], ampXY * 0.5);
  const x2 = -0.5 + pert(values[6], ampXY);
  const y2 = 0 + pert(values[7], ampXY * 0.5);
  const x3 = 0 + pert(values[8], ampXY);
  const y3 = 2 / 3 + pert(values[9], ampXY);
  return [
    { bend: b0, x: 0 + pert(values[10], ampXY * 0.3), y: 0 + pert(values[11], ampXY * 0.3), depth: 0 },
    { bend: b1, x: x1, y: y1, depth: 0 },
    { bend: b2, x: x2, y: y2, depth: 0 },
    { bend: b3, x: x3, y: y3, depth: 0 },
  ];
}

export function renderApollonian(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: ApollonianParams
): void {
  const colors = getPaletteColors(params.palette);
  const maxCircles = Math.max(500, Math.min(8000, Math.round(params.maxCircles)));
  const minRadiusPx = Math.max(0.5, Math.min(4, params.minRadiusPx));
  const lineW = Math.max(0.5, Math.min(2, params.lineWidth));

  const circles = buildSeedCircles(values);
  const seenTriples = new Set<string>();
  const queue: [number, number, number][] = [];

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 4; k++) {
        const key = tripleKey(i, j, k);
        seenTriples.add(key);
        queue.push([i, j, k]);
      }
    }
  }

  const epsPos = 1e-3;
  const epsR = 1e-3;

  while (queue.length > 0 && circles.length < maxCircles) {
    const [i, j, k] = queue.shift()!;
    const ci = circles[i]!,
      cj = circles[j]!,
      ck = circles[k]!;
    const candidates = fourthCirclesFromTriple(ci, cj, ck);

    for (const cand of candidates) {
      // Preskoči rešenje koje već postoji (npr. četvrti od početna četiri u istom četvorouglu).
      if (matchesAny(cand, circles, epsPos * 8, epsR * 8)) continue;
      if (!Number.isFinite(cand.bend) || Math.abs(cand.bend) < 1e-6) continue;

      const n = circles.length;
      circles.push(cand);
      if (circles.length >= maxCircles) break;

      const newTriples: [number, number, number][] = [
        [i, j, n],
        [i, k, n],
        [j, k, n],
      ];
      for (const [a, b, c] of newTriples) {
        const key = tripleKey(a, b, c);
        if (seenTriples.has(key)) continue;
        seenTriples.add(key);
        queue.push([a, b, c]);
      }
    }
  }

  const scale = 0.42 * Math.min(W, H);
  const cx0 = W / 2;
  const cy0 = H / 2;

  const drawList = circles.map((c, idx) => {
    const r = radius(c);
    const cx = cx0 + c.x * scale;
    const cy = cy0 - c.y * scale;
    const rPx = r * scale;
    const vi = values[(idx * 7 + 13) % 1000] ?? 0;
    const colorIdx = (c.depth + vi) % colors.length;
    return { cx, cy, rPx, colorIdx, r, depth: c.depth };
  });

  drawList.sort((a, b) => b.r - a.r);

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, W, H);

  for (const d of drawList) {
    if (d.rPx < minRadiusPx * 0.25) continue;
    const col = colors[d.colorIdx] ?? colors[0]!;
    const alpha = 0.25 + Math.min(0.55, d.depth * 0.04);
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, Math.max(minRadiusPx * 0.35, d.rPx), 0, Math.PI * 2);
    ctx.stroke();
  }
}
