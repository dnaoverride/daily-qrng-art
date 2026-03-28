import { QRNGStream } from "../qrng";
import type { LSystemParams } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

// Pravilo: F → F[+F][-F]  (tačno 3× F po koraku → 3^d segmenata)
// NAPOMENA: F[+F]F[-F]F ima 5× F po koraku (5^d) — previše preklapanja, „gužva“ na platnu.
const RULE = "F[+F][-F]";

function expandLSystem(axiom: string, depth: number): string {
  let current = axiom;
  for (let i = 0; i < depth; i++) {
    let next = "";
    for (const ch of current) {
      next += ch === "F" ? RULE : ch;
    }
    current = next;
  }
  return current;
}

interface TurtleState {
  x: number;
  y: number;
  angle: number;
  length: number;
  nestingDepth: number; // actual bracket nesting level, for color/thickness
}

export function renderLSystem(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: LSystemParams
): void {
  const stream = new QRNGStream(values);
  const colors = getPaletteColors(params.palette);

  // Blagi radijalni fond da grane ne „padaju“ u crnu rupu
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.5, H * 0.85);
  bg.addColorStop(0, "rgb(18, 16, 40)");
  bg.addColorStop(1, "rgb(4, 4, 12)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const rawD = Number(params.depth);
  const depth = Number.isFinite(rawD)
    ? Math.max(3, Math.min(7, Math.round(rawD)))
    : 5;
  const baseAngleRad = (params.angle * Math.PI) / 180;
  const lf = params.lengthFactor;

  // Visina drveta ~ initLength × (1 + 2×lf + 2×lf² + …) grubo ≤ geoSum × initLength; stavljamo u ~72% visine platna
  const geoSum = (1 - Math.pow(lf, depth + 1)) / (1 - lf);
  const initLength = (H * 0.72) / geoSum;

  // Slight QRNG-seeded horizontal offset so each set gives a unique lean
  const startX = W / 2 + (stream.next_f() - 0.5) * W * 0.12;
  const startY = H * 0.93;

  const lstring = expandLSystem("F", depth);

  const stack: TurtleState[] = [];
  let state: TurtleState = {
    x: startX,
    y: startY,
    angle: -Math.PI / 2, // pointing up
    length: initLength,
    nestingDepth: 0,
  };

  for (const ch of lstring) {
    switch (ch) {
      case "F": {
        // QRNG perturbs both angle and length — every tree is unique
        const perturbAngle = (stream.next_f() - 0.5) * 0.14;
        const perturbLen = 0.88 + stream.next_f() * 0.24;
        const segLen = state.length * perturbLen;
        const angle = state.angle + perturbAngle;

        const nx = state.x + Math.cos(angle) * segLen;
        const ny = state.y + Math.sin(angle) * segLen;

        // Color interpolated by nesting depth: trunk = index 0, tips = last color
        const t = Math.min(state.nestingDepth / depth, 1);
        const ci = Math.floor(t * (colors.length - 1));
        const cf = t * (colors.length - 1) - ci;
        const c1 = colors[ci % colors.length]!;
        const c2 = colors[(ci + 1) % colors.length]!;
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * cf);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * cf);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * cf);

        // Trunk thick and opaque, tips thin and faint
        const alpha = 0.92 - t * 0.38;
        const lw = Math.max(0.85, 4.2 - state.nestingDepth * 0.38);

        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Lagani sjaj samo na debljim granama (čitljivost bez 15k senki)
        if (state.nestingDepth <= 2) {
          ctx.shadowColor = `rgba(${r},${g},${b},0.45)`;
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.moveTo(state.x, state.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.shadowBlur = 0;

        state.x = nx;
        state.y = ny;
        break;
      }
      case "+": {
        const perturb = (stream.next_f() - 0.5) * 0.14;
        state.angle += baseAngleRad + perturb;
        break;
      }
      case "-": {
        const perturb = (stream.next_f() - 0.5) * 0.14;
        state.angle -= baseAngleRad + perturb;
        break;
      }
      case "[": {
        // Save current state (with current nestingDepth), then go one level deeper
        stack.push({ ...state });
        state.nestingDepth += 1;
        state.length *= lf;
        break;
      }
      case "]": {
        // Restore parent state fully (position, angle, length, AND nestingDepth)
        const popped = stack.pop();
        if (popped) state = { ...popped };
        break;
      }
    }
  }

  // Vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.9);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}
