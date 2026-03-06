/**
 * Landscape renderer — Canvas 2D port iz Python qrng_landscape_batch.py
 * Client-safe, radi u browseru.
 */
import type { QRNGStream } from "./qrng";
import { hslToRgb, rgbString, type RGB } from "./color";
import { ridgePoints, drawSunGlow } from "./draw-utils";

export function renderLandscape(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const sceneRoll = stream.next_f();
  const scene =
    sceneRoll < 0.25
      ? "sunrise"
      : sceneRoll < 0.5
        ? "day"
        : sceneRoll < 0.75
          ? "sunset"
          : "night";

  const baseHue =
    scene === "night"
      ? stream.next_int(210, 250)
      : scene === "day"
        ? stream.next_int(200, 235)
        : stream.next_int(5, 50);
  const accentHue =
    scene === "night"
      ? (baseHue + stream.next_int(10, 40)) % 360
      : scene === "day"
        ? (baseHue + stream.next_int(10, 30)) % 360
        : baseHue + stream.next_int(0, 10);

  let skyTop: RGB;
  let skyBot: RGB;
  let skyMid: RGB | null = null;
  let glowColor: RGB;

  if (scene === "night") {
    skyTop = hslToRgb(baseHue, 0.45, 0.12);
    skyBot = hslToRgb((baseHue + 30) % 360, 0.55, 0.18);
    glowColor = hslToRgb(accentHue, 0.55, 0.65);
  } else {
    const warmShift = scene === "day" ? 0 : scene === "sunrise" ? 12 : 18;
    const sat = scene === "day" ? 0.4 : 0.45;
    skyTop = hslToRgb(
      (baseHue + warmShift) % 360,
      sat,
      scene === "day" ? 0.6 : scene === "sunrise" ? 0.55 : 0.5
    );
    skyMid = hslToRgb(
      (accentHue + warmShift) % 360,
      scene === "day" ? 0.35 : 0.45,
      scene === "day" ? 0.7 : 0.55
    );
    skyBot = hslToRgb(
      (accentHue + warmShift * 1.2) % 360,
      scene === "day" ? 0.3 : 0.4,
      scene === "day" ? 0.55 : 0.4
    );
    glowColor = hslToRgb(25 + stream.next_int(0, 35), 0.85, 0.55);
  }

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

  const horizon = Math.floor(h * (0.53 + 0.07 * stream.next_f()));

  for (let li = 0; li < 3; li++) {
    const depth = li / 2;
    const yBase = Math.floor(horizon + depth * 210);
    const amplitude = Math.floor(160 - depth * 70 + 40 * stream.next_f());
    const rough = 0.55 + 0.15 * stream.next_f();
    const pts = ridgePoints(stream, w, yBase, amplitude, rough, 6);

    const hillHue =
      scene === "night"
        ? (baseHue + 10 + li * 12) % 360
        : scene === "day"
          ? (110 + li * 8 + stream.next_int(0, 20)) % 360
          : (baseHue + 180 + li * 12) % 360;
    const col = hslToRgb(
      hillHue,
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

  const cx = Math.floor(w * (0.25 + 0.5 * stream.next_f()));
  const cy = Math.floor(h * (0.12 + 0.22 * stream.next_f()));
  const radius = Math.floor(50 + 70 * stream.next_f());
  const coreColor: RGB =
    scene !== "night" ? [255, 245, 220] : [235, 240, 255];

  drawSunGlow(
    ctx,
    cx,
    cy,
    radius,
    glowColor,
    coreColor,
    scene === "night" ? 5 : 18,
    scene === "night" ? 4 : 10,
    scene === "night" ? 5 : 12,
    scene === "night" ? 0.06 : 0.18
  );

  if (scene !== "night") {
    const clouds = stream.next_int(6, 14);
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < clouds; i++) {
      const baseX = stream.next_int(-100, w + 100);
      const baseY = stream.next_int(40, Math.floor(h * 0.45));
      const scale = 0.6 + 1.2 * stream.next_f();
      const blobs = stream.next_int(6, 14);
      const shade = stream.next_int(245, 255);
      for (let b = 0; b < blobs; b++) {
        const ox = (stream.next_f() - 0.5) * 220 * scale;
        const oy = (stream.next_f() - 0.5) * 70 * scale;
        const r = (40 + 70 * stream.next_f()) * scale;
        const cloudShade = Math.max(230, shade - stream.next_int(0, 20));
        ctx.fillStyle = `rgba(${cloudShade},${cloudShade},${cloudShade},0.75)`;
        ctx.beginPath();
        ctx.arc(baseX + ox, baseY + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
