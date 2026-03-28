import { QRNGStream } from "../qrng";
import type { FlowFieldParams, RGBA } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

// Grid za vektorsko polje
const COLS = 24;
const ROWS = 14;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorIdx: number;
  age: number;
  maxAge: number;
}

export interface FlowFieldState {
  field: Float32Array;   // uglovi za svaki čvor mreže (COLS * ROWS)
  particles: Particle[];
  canvas: OffscreenCanvas | null;
  frameCount: number;
  colors: RGBA[];
  params: FlowFieldParams;
}

export function initFlowField(
  values: number[],
  params: FlowFieldParams
): FlowFieldState {
  const stream = new QRNGStream(values);

  // Inicijalizacija vektorskog polja iz QRNG vrednosti
  const field = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    // Ugao između 0 i 2π, skaliran sa QRNG vrednostima
    field[i] = stream.next_f() * Math.PI * 2;
  }

  const colors = getPaletteColors(params.palette);

  // Inicijalizacija čestica — pozicije iz QRNG vrednosti
  const particles: Particle[] = [];
  for (let i = 0; i < params.particles; i++) {
    particles.push({
      x: stream.next_f() * W,
      y: stream.next_f() * H,
      vx: 0,
      vy: 0,
      colorIdx: i % colors.length,
      age: Math.floor(stream.next_f() * 120),
      maxAge: 80 + Math.floor(stream.next_f() * 120),
    });
  }

  return { field, particles, canvas: null, frameCount: 0, colors, params };
}

export function drawFlowFieldFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  state: FlowFieldState
): void {
  const { field, particles, colors, params } = state;

  // Blago potamnjenje traga svakog frejma
  ctx.fillStyle = `rgba(5, 5, 15, ${params.trailAlpha})`;
  ctx.fillRect(0, 0, W, H);

  const cellW = W / COLS;
  const cellH = H / ROWS;
  const speed = params.speed;
  const tw = params.trailWidth;

  for (const p of particles) {
    // Nađi čvor mreže za trenutnu poziciju čestice
    const col = Math.floor(p.x / cellW);
    const row = Math.floor(p.y / cellH);
    const idx = Math.min(row, ROWS - 1) * COLS + Math.min(col, COLS - 1);
    const angle = field[idx] ?? 0;

    const prevX = p.x;
    const prevY = p.y;

    p.vx = p.vx * 0.85 + Math.cos(angle) * speed * 0.3;
    p.vy = p.vy * 0.85 + Math.sin(angle) * speed * 0.3;
    p.x += p.vx * speed;
    p.y += p.vy * speed;
    p.age++;

    // Restart čestice kad izađe iz okvira ili postane stara
    if (
      p.x < 0 || p.x > W ||
      p.y < 0 || p.y > H ||
      p.age > p.maxAge
    ) {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.vx = 0;
      p.vy = 0;
      p.age = 0;
      continue;
    }

    const [r, g, b] = colors[p.colorIdx]!;
    const alpha = 0.5 + 0.5 * (1 - p.age / p.maxAge);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = tw;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  state.frameCount++;
}

export function initFlowFieldCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
): void {
  ctx.fillStyle = "rgb(5, 5, 15)";
  ctx.fillRect(0, 0, W, H);
}
