import { QRNGStream } from "../qrng";
import type { FlowFieldParams, RGBA } from "./types";
import { getPaletteColors } from "./types";

const DEFAULT_W = 1200;
const DEFAULT_H = 675;

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
  respawnSeed: number;
}

export interface FlowFieldState {
  baseField: Float32Array;
  particles: Particle[];
  frameCount: number;
  colors: RGBA[];
  params: FlowFieldParams;
  respawnStream: QRNGStream;
  width: number;
  height: number;
}

export function initFlowField(
  values: number[],
  params: FlowFieldParams,
  initialPhase = 0
): FlowFieldState {
  const stream = new QRNGStream(values);
  const respawnStream = new QRNGStream(values);

  const baseField = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    baseField[i] = stream.next_f() * Math.PI * 2;
  }

  const colors = getPaletteColors(params.palette);
  const particles: Particle[] = [];

  for (let i = 0; i < params.particles; i++) {
    particles.push({
      x: stream.next_f() * DEFAULT_W,
      y: stream.next_f() * DEFAULT_H,
      vx: 0,
      vy: 0,
      colorIdx: i % colors.length,
      age: Math.floor(stream.next_f() * 120),
      maxAge: 80 + Math.floor(stream.next_f() * 120),
      respawnSeed: i,
    });
  }

  const state: FlowFieldState = {
    baseField,
    particles,
    frameCount: 0,
    colors,
    params,
    respawnStream,
    width: DEFAULT_W,
    height: DEFAULT_H,
  };

  if (initialPhase > 0) {
    applyPhaseToField(state, initialPhase);
  }

  return state;
}

function applyPhaseToField(state: FlowFieldState, phase: number): Float32Array {
  const offset = phase * Math.PI * 2;
  const field = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    field[i] = state.baseField[i]! + offset;
  }
  return field;
}

function respawnParticle(p: Particle, stream: QRNGStream, w: number, h: number): void {
  p.x = stream.next_f() * w;
  p.y = stream.next_f() * h;
  p.vx = 0;
  p.vy = 0;
  p.age = 0;
  p.maxAge = 80 + Math.floor(stream.next_f() * 120);
}

export function drawFlowFieldFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  state: FlowFieldState,
  w = DEFAULT_W,
  h = DEFAULT_H,
  loopPhase?: number
): void {
  const { particles, colors, params } = state;
  state.width = w;
  state.height = h;

  const field =
    loopPhase !== undefined
      ? applyPhaseToField(state, loopPhase)
      : applyPhaseToField(state, (state.frameCount % 360) / 360);

  ctx.fillStyle = `rgba(5, 5, 15, ${params.trailAlpha})`;
  ctx.fillRect(0, 0, w, h);

  const cellW = w / COLS;
  const cellH = h / ROWS;
  const speed = params.speed;
  const tw = params.trailWidth;

  for (const p of particles) {
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

    if (p.x < 0 || p.x > w || p.y < 0 || p.y > h || p.age > p.maxAge) {
      respawnParticle(p, state.respawnStream, w, h);
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w = DEFAULT_W,
  h = DEFAULT_H
): void {
  ctx.fillStyle = "rgb(5, 5, 15)";
  ctx.fillRect(0, 0, w, h);
}
