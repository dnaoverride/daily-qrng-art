/**
 * Landscape renderer — Canvas 2D port iz Python qrng_landscape_batch.py
 * Client-safe, radi u browseru.
 */

import type { QRNGStream } from "./qrng";

type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;

  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function rgbString([r, g, b]: RGB): string {
  return `rgb(${r},${g},${b})`;
}

export function renderLandscape(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const sceneRoll = stream.next_f();
  const scene =
    sceneRoll < 0.34
      ? "sunrise"
      : sceneRoll < 0.67
        ? "sunset"
        : "night";

  const baseHue = stream.next_int(0, 359);
  const accentHue = (baseHue + stream.next_int(90, 210)) % 360;

  let skyTop: RGB;
  let skyBot: RGB;
  let skyMid: RGB | null = null;
  let glowColor: RGB;

  if (scene === "night") {
    skyTop = hslToRgb(baseHue, 0.45, 0.12);
    skyBot = hslToRgb((baseHue + 30) % 360, 0.55, 0.18);
    glowColor = hslToRgb(accentHue, 0.55, 0.65);
  } else {
    const warmShift = scene === "sunrise" ? 25 : 45;
    skyTop = hslToRgb(
      (baseHue + warmShift) % 360,
      0.55,
      scene === "sunrise" ? 0.55 : 0.5
    );
    skyMid = hslToRgb((accentHue + warmShift) % 360, 0.65, 0.55);
    skyBot = hslToRgb((accentHue + warmShift * 2) % 360, 0.75, 0.4);
    glowColor = hslToRgb((accentHue + 15) % 360, 0.85, 0.55);
  }

  // Sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  if (scene === "night") {
    gradient.addColorStop(0, rgbString(skyTop));
    gradient.addColorStop(1, rgbString(skyBot));
  } else {
    gradient.addColorStop(0, rgbString(skyTop));
    gradient.addColorStop(0.55, rgbString(skyMid!));
    gradient.addColorStop(1, rgbString(skyBot));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Stars (night)
  if (scene === "night") {
    const stars = stream.next_int(250, 600);
    for (let i = 0; i < stars; i++) {
      const x = stream.next_int(0, w - 1);
      const y = stream.next_int(0, Math.floor(h * 0.65));
      const b = stream.next_int(140, 255);
      const r = stream.next_f() < 0.85 ? 1 : 2;
      ctx.fillStyle = `rgb(${b},${b},${b})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mountains (ridge points)
  const horizon = Math.floor(h * (0.53 + 0.07 * stream.next_f()));

  function ridgePoints(
    yBase: number,
    amplitude: number,
    roughness: number,
    step = 6
  ): { x: number; y: number }[] {
    const anchors: number[] = [];
    const anchorStep = 50;
    const numAnchors = Math.floor(w / anchorStep) + 3;
    for (let i = 0; i < numAnchors; i++) {
      anchors.push(stream.next_f());
    }

    function smoothstep(t: number): number {
      return t * t * (3 - 2 * t);
    }

    const pts: { x: number; y: number }[] = [];
    for (let x = 0; x <= w + step; x += step) {
      const ai = Math.floor(x / anchorStep);
      const t = (x % anchorStep) / anchorStep;
      const v0 = anchors[ai % anchors.length]!;
      const v1 = anchors[(ai + 1) % anchors.length]!;
      let v = lerp(v0, v1, smoothstep(t));

      let detail = 0;
      let octAmp = 0.45;
      for (let i = 0; i < 3; i++) {
        detail += (stream.next_f() - 0.5) * octAmp;
        octAmp *= roughness;
      }
      const y = Math.floor(
        yBase - (v - 0.5) * amplitude + detail * amplitude * 0.35
      );
      pts.push({ x, y });
    }
    return pts;
  }

  for (let li = 0; li < 3; li++) {
    const depth = li / 2;
    const yBase = Math.floor(horizon + depth * 210);
    const amplitude = Math.floor(160 - depth * 70 + 40 * stream.next_f());
    const rough = 0.55 + 0.15 * stream.next_f();
    const pts = ridgePoints(yBase, amplitude, rough, 6);

    const col = hslToRgb(
      (baseHue + (scene === "night" ? 10 : 180) + li * 12) % 360,
      0.35,
      (scene === "night" ? 0.1 : 0.22) +
        depth * (scene === "night" ? 0.12 : 0.18)
    );

    ctx.fillStyle = rgbString(col);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // Sun/Moon
  const cx = Math.floor(w * (0.25 + 0.5 * stream.next_f()));
  const cy = Math.floor(h * (0.12 + 0.22 * stream.next_f()));
  const radius = Math.floor(50 + 70 * stream.next_f());

  // Glow layers
  for (let k = 18; k >= 0; k--) {
    const rr = Math.floor(radius * (1 + k * 0.18));
    const alpha = 10 + k * (scene !== "night" ? 12 : 10);
    ctx.fillStyle = `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${alpha / 255})`;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  const coreColor: RGB =
    scene !== "night" ? [255, 245, 220] : [235, 240, 255];
  ctx.fillStyle = rgbString(coreColor);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Clouds (day only)
  if (scene !== "night") {
    const clouds = stream.next_int(6, 14);
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < clouds; i++) {
      const baseX = stream.next_int(-100, w + 100);
      const baseY = stream.next_int(40, Math.floor(h * 0.45));
      const scale = 0.6 + 1.2 * stream.next_f();
      const blobs = stream.next_int(6, 14);
      const shade = stream.next_int(215, 250);
      for (let b = 0; b < blobs; b++) {
        const ox = (stream.next_f() - 0.5) * 220 * scale;
        const oy = (stream.next_f() - 0.5) * 70 * scale;
        const r = (40 + 70 * stream.next_f()) * scale;
        ctx.fillStyle = `rgba(${shade},${shade},${shade},0.6)`;
        ctx.beginPath();
        ctx.arc(baseX + ox, baseY + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
