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

  // Blokira zelenu (55–165); nebo = plava ili narandžasto/crvenkasto — gura u plavu da ne bude zelenkasto-smede
  const GREEN_LO = 55;
  const GREEN_HI = 165;
  const avoidGreen = (h: number) =>
    h >= GREEN_LO && h <= GREEN_HI
      ? h < 110
        ? 40
        : 200
      : h; // ispod 110 → narandžasto; iznad → plava

  let baseHue =
    scene === "night"
      ? stream.next_int(210, 250)
      : stream.next_int(200, 235); // sve dnevne scene: plavo nebo
  let accentHue =
    scene === "night"
      ? (baseHue + stream.next_int(10, 40)) % 360
      : (baseHue + stream.next_int(10, 30)) % 360;
  baseHue = avoidGreen(baseHue);
  accentHue = avoidGreen(accentHue);

  let skyTop: RGB;
  let skyBot: RGB;
  let skyMid: RGB | null = null;
  let glowColor: RGB;

  if (scene === "night") {
    skyTop = hslToRgb(baseHue, 0.45, 0.12);
    skyBot = hslToRgb((baseHue + 30) % 360, 0.55, 0.18);
    glowColor = hslToRgb(accentHue, 0.55, 0.65);
  } else {
    // Dan/sunrise/sunset — uvek plavo nebo (200–235)
    const skyHue = stream.next_int(200, 235);
    skyTop = hslToRgb(skyHue, 0.4, 0.6);
    skyMid = hslToRgb((skyHue + 8) % 360, 0.35, 0.7);
    skyBot = hslToRgb((skyHue + 15) % 360, 0.3, 0.55);
    glowColor = hslToRgb(10 + stream.next_int(0, 40), 0.85, 0.55);
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
  // Zeleno (šuma) ili tamno siva (kamenje) — zelena dominantna (90%)
  const mountainsStyle = stream.next_f() < 0.9 ? "green" : "stone";

  for (let li = 0; li < 3; li++) {
    const depth = li / 2;
    const yBase = Math.floor(horizon + depth * 210);
    const amplitude = Math.floor(160 - depth * 70 + 40 * stream.next_f());
    const rough = 0.45 + 0.12 * stream.next_f(); // manja grubost = blaži vrhovi
    const pts = ridgePoints(stream, w, yBase, amplitude, rough, 8, 0.2);

    let col: RGB;
    if (mountainsStyle === "stone") {
      // Tamno siva kao kamenje — nizak saturation, tamne nijanse
      const light =
        0.12 + depth * 0.08 + 0.03 * stream.next_f();
      col = hslToRgb(220, 0.06, light); // blaga hladna siva
    } else {
      // Uvek zelene nijanse (100–150) — nikad plave iz baseHue
      const hillHue = (100 + li * 10 + stream.next_int(0, 30)) % 360;
      col = hslToRgb(
        hillHue,
        0.4,
        (scene === "night" ? 0.1 : 0.26) +
          depth * (scene === "night" ? 0.12 : 0.18)
      );
    }

    // Sneg na vrhovima — ~15–20% visine, oštra ivica (minimalan prelaz)
    const minY = Math.min(...pts.map((p) => p.y));
    const grad = ctx.createLinearGradient(0, minY, 0, h);
    const snowWhite =
      scene === "night" ? "rgb(230,235,245)" : "rgb(255,255,255)";
    grad.addColorStop(0, snowWhite);
    grad.addColorStop(0.17, snowWhite);
    grad.addColorStop(0.19, rgbString(col)); // oštra ivica
    grad.addColorStop(1, rgbString(col));

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Tanka crna ivica SAMO gde ima snega — isključivo unutar snežnih kapica
    const snowLineY = minY + (h - minY) * 0.18;
    const crossings: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      if ((a.y <= snowLineY && b.y >= snowLineY) || (a.y >= snowLineY && b.y <= snowLineY)) {
        const t = (snowLineY - a.y) / (b.y - a.y);
        crossings.push({ x: a.x + t * (b.x - a.x), y: snowLineY });
      }
    }
    crossings.sort((a, b) => a.x - b.x);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    for (let c = 0; c < crossings.length - 1; c++) {
      const p0 = crossings[c]!;
      const p1 = crossings[c + 1]!;
      const ridgeBetween = pts.filter((p) => p.x >= p0.x - 1 && p.x <= p1.x + 1);
      const hasValley = ridgeBetween.some((p) => p.y > snowLineY);
      if (!hasValley && ridgeBetween.length > 0) {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const cx = Math.floor(w * (0.25 + 0.5 * stream.next_f()));
  const cy = Math.floor(h * (0.12 + 0.22 * stream.next_f()));
  // Manji sunce + blag halo (ne Venera) — radius ~20–58, glow manji
  const radius =
    scene === "night"
      ? Math.floor(28 + 38 * stream.next_f())
      : Math.floor(20 + 39 * stream.next_f());
  const coreColor: RGB =
    scene !== "night" ? [255, 245, 220] : [235, 240, 255];

  drawSunGlow(
    ctx,
    cx,
    cy,
    radius,
    glowColor,
    coreColor,
    scene === "night" ? 5 : 10,
    scene === "night" ? 4 : 10,
    scene === "night" ? 5 : 8,
    scene === "night" ? 0.06 : 0.09
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
