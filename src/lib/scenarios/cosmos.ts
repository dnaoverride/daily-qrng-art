/**
 * Kosmos — planete, zvezde, tamna pozadina.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString } from "../color";

const PLANET_COLOR_TYPES: {
  hueMin: number;
  hueMax: number;
  satMin: number;
  satMax: number;
}[] = [
  { hueMin: 0, hueMax: 18, satMin: 0.5, satMax: 0.7 },    // Mars — crveno-narandžasta
  { hueMin: 28, hueMax: 48, satMin: 0.45, satMax: 0.65 }, // Jupiter — oranžno-zlatna
  { hueMin: 195, hueMax: 218, satMin: 0.5, satMax: 0.7 }, // Zemlja/Neptun — plava
  { hueMin: 172, hueMax: 192, satMin: 0.45, satMax: 0.65 }, // Uran — tirkizno-plava
  { hueMin: 22, hueMax: 35, satMin: 0.2, satMax: 0.4 },   // Siva/stena — braon-siva
  { hueMin: 48, hueMax: 68, satMin: 0.35, satMax: 0.55 }, // Krem/Venus — žućkasto-bež
];

function pickPlanetColor(stream: QRNGStream): { hue: number; sat: number } {
  const t = stream.next_int(0, PLANET_COLOR_TYPES.length - 1);
  const type = PLANET_COLOR_TYPES[t]!;
  const hue = stream.next_int(type.hueMin, type.hueMax);
  const sat = type.satMin + stream.next_f() * (type.satMax - type.satMin);
  return { hue, sat };
}

function ellipseCircleIntersectionAngles(
  rx: number,
  ry: number,
  pr: number
): [number, number] | null {
  if (rx <= pr || ry <= 0) return null;
  const denom = ry * ry - rx * rx;
  if (Math.abs(denom) < 1e-10) return null;
  const sin2 = (pr * pr - rx * rx) / denom;
  if (sin2 < 0 || sin2 > 1) return null;
  const s = Math.sqrt(sin2);
  const a = Math.asin(s);
  return [a, Math.PI - a];
}

function drawPlanetRings(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pr: number,
  params: {
    outerRx: number;
    outerRy: number;
    tilt: number;
    numRings: number;
    ringColor: [number, number, number];
  },
  pass: "back" | "front"
): void {
  const { outerRx, outerRy, tilt, numRings, ringColor } = params;
  ctx.strokeStyle = rgbString(ringColor);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;

  for (let i = 0; i < numRings; i++) {
    const t = (i + 0.5) / numRings;
    const rx = pr * 1.02 + (outerRx - pr * 1.02) * t;
    const angles = ellipseCircleIntersectionAngles(rx, outerRy, pr);

    if (!angles) {
      ctx.beginPath();
      ctx.ellipse(px, py, rx, outerRy, tilt, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    const [t1, t2] = angles;
    const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    if (pass === "back") {
      ctx.beginPath();
      ctx.ellipse(px, py, rx, outerRy, tilt, normalize(t1), normalize(t2));
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(px, py, rx, outerRy, tilt, normalize(t2), normalize(t1 + Math.PI * 2));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function renderCosmos(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const bgTop = hslToRgb(250 + stream.next_int(0, 30), 0.55, 0.045);
  const bgBot = hslToRgb(270 + stream.next_int(0, 25), 0.45, 0.02);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, rgbString(bgTop));
  bgGrad.addColorStop(1, rgbString(bgBot));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const sunX = stream.next_int(w * 0.15, w * 0.85);
  const sunY = stream.next_int(h * 0.1, h * 0.4);
  const sunR = stream.next_int(8, 18);
  const sunColor = hslToRgb(45 + stream.next_int(-5, 15), 0.6, 0.95);
  const sunGlow = hslToRgb(40 + stream.next_int(-10, 10), 0.5, 0.7);

  const stars = stream.next_int(300, 600);
  for (let i = 0; i < stars; i++) {
    const x = stream.next_int(0, w - 1);
    const y = stream.next_int(0, h - 1);
    const b = stream.next_int(160, 255);
    const r = stream.next_f() < 0.85 ? 1 : stream.next_f() < 0.95 ? 2 : 3;
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const sunGrad = ctx.createRadialGradient(
    sunX - sunR * 0.3,
    sunY - sunR * 0.3,
    0,
    sunX,
    sunY,
    sunR * 2
  );
  sunGrad.addColorStop(0, rgbString(sunColor));
  sunGrad.addColorStop(0.5, rgbString(sunGlow));
  sunGrad.addColorStop(1, "transparent");
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbString(sunColor);
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 0.6, 0, Math.PI * 2);
  ctx.fill();

  const numPlanets = stream.next_int(3, 7);
  for (let i = 0; i < numPlanets; i++) {
    const px = stream.next_int(50, w - 50);
    const py = stream.next_int(80, h - 80);
    const pr = stream.next_int(30, 120);
    const { hue, sat } = pickPlanetColor(stream);

    const ringChance =
      pr < 70 ? 0 : 0.25 + ((pr - 70) / 50) * 0.35;
    const hasRings = stream.next_f() < ringChance;

    let ringParams: {
      outerRx: number;
      outerRy: number;
      tilt: number;
      numRings: number;
      ringColor: [number, number, number];
    } | null = null;
    if (hasRings) {
      ringParams = {
        outerRx: pr * (1.3 + stream.next_f() * 0.2),
        outerRy: pr * (0.07 + stream.next_f() * 0.03),
        tilt: (stream.next_f() - 0.5) * 0.1,
        numRings: stream.next_int(4, 7),
        ringColor: hslToRgb(45 + stream.next_int(-5, 15), 0.25, 0.7 + stream.next_f() * 0.2),
      };
      ctx.save();
      drawPlanetRings(ctx, px, py, pr, ringParams, "back");
      ctx.restore();
    }

    const dx = sunX - px;
    const dy = sunY - py;
    const dist = Math.hypot(dx, dy) || 1;
    const specularOffset = pr * 0.35;
    const hx = px + (dx / dist) * specularOffset;
    const hy = py + (dy / dist) * specularOffset;

    const planetGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, pr * 1.2);
    planetGrad.addColorStop(0, rgbString(hslToRgb(hue, sat * 0.4, 0.64)));
    planetGrad.addColorStop(0.06, rgbString(hslToRgb(hue, sat * 0.7, 0.56)));
    planetGrad.addColorStop(0.18, rgbString(hslToRgb(hue, sat * 0.85, 0.5)));
    planetGrad.addColorStop(0.35, rgbString(hslToRgb(hue, sat, 0.42)));
    planetGrad.addColorStop(0.7, rgbString(hslToRgb(hue, sat, 0.36)));
    planetGrad.addColorStop(1, rgbString(hslToRgb(hue, sat * 0.95, 0.32)));

    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgbString(hslToRgb(hue, sat * 0.5, 0.14));
    ctx.lineWidth = 2;
    ctx.stroke();

    if (ringParams) {
      ctx.save();
      drawPlanetRings(ctx, px, py, pr, ringParams, "front");
      ctx.restore();
    }
  }
}
