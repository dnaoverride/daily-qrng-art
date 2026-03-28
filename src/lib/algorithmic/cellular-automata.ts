import { QRNGStream } from "../qrng";
import type { CellularAutomataParams } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

/** Izračunava sledeću generaciju elementarnog CA na osnovu pravila */
function nextGeneration(current: Uint8Array, rule: number): Uint8Array {
  const len = current.length;
  const next: Uint8Array = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const l = current[(i - 1 + len) % len]!;
    const c = current[i]!;
    const r = current[(i + 1) % len]!;
    const pattern = (l << 2) | (c << 1) | r;
    next[i] = (rule >> pattern) & 1;
  }
  return next;
}

export function renderCellularAutomata(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: CellularAutomataParams
): void {
  const stream = new QRNGStream(values);
  const colors = getPaletteColors(params.palette);

  const cs = Math.max(1, Math.min(4, Math.round(params.cellSize)));
  const rule = Math.max(0, Math.min(255, Math.round(params.rule)));

  const cols = Math.floor(W / cs);
  const rows = Math.floor(H / cs);

  // Crna pozadina
  ctx.fillStyle = "rgb(5, 5, 15)";
  ctx.fillRect(0, 0, W, H);

  // Inicijalni red iz QRNG vrednosti
  let current: Uint8Array = new Uint8Array(cols);
  for (let i = 0; i < cols; i++) {
    current[i] = stream.next_u16() > 32767 ? 1 : 0;
  }

  const [r0, g0, b0] = colors[0]!;
  const [r1, g1, b1] = colors[1]!;
  const [r2, g2, b2] = colors[2]!;

  // Renderuj generacije odozgo na dole
  for (let row = 0; row < rows; row++) {
    const progress = row / rows;

    for (let col = 0; col < cols; col++) {
      if (current[col] === 1) {
        // Žive ćelije: gradijent boje od vrha ka dnu
        const t = progress;
        const r = Math.round(r0 + (r1 - r0) * t);
        const g = Math.round(g0 + (g1 - g0) * t);
        const b = Math.round(b0 + (b1 - b0) * t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        // Mrtve ćelije: tamna nijansa pozadine s blagim varijacijama
        const shade = 8 + Math.floor(progress * 6);
        ctx.fillStyle = `rgb(${shade},${shade},${Math.round(shade * 1.4)})`;
      }
      ctx.fillRect(col * cs, row * cs, cs, cs);
    }

    // Lagana horizontalna linija između generacija za "skeniranje"
    if (cs >= 2 && row % 4 === 0) {
      ctx.fillStyle = `rgba(${r2},${g2},${b2},0.04)`;
      ctx.fillRect(0, row * cs, W, 1);
    }

    current = nextGeneration(current, rule);
  }

  // Vignette overlay
  const vign = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.9);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);

  // Scanline efekat
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }
}
