import { QRNGStream } from "../qrng";
import type { VoronoiParams, RGBA } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

interface Site {
  x: number;
  y: number;
  color: RGBA;
}

export function renderVoronoi(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: VoronoiParams
): void {
  const stream = new QRNGStream(values);
  const colors = getPaletteColors(params.palette);
  const n = Math.max(20, Math.min(400, params.cells));

  // Kreiranje Voronoi čvorova iz QRNG vrednosti
  const sites: Site[] = [];
  for (let i = 0; i < n; i++) {
    const baseColor = colors[i % colors.length]!;
    // Blaga varijacija boje po ćeliji
    const variation = 40;
    const r = Math.max(0, Math.min(255, baseColor[0] + Math.floor((stream.next_f() - 0.5) * variation)));
    const g = Math.max(0, Math.min(255, baseColor[1] + Math.floor((stream.next_f() - 0.5) * variation)));
    const b = Math.max(0, Math.min(255, baseColor[2] + Math.floor((stream.next_f() - 0.5) * variation)));
    sites.push({
      x: stream.next_f() * W,
      y: stream.next_f() * H,
      color: [r, g, b, 255],
    });
  }

  // Pixel-level Voronoi — za svaki piksel nađi najbliži čvor
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;
  const bw = params.borderWidth;
  const bwSq = bw * bw;

  // Chunked rendering za performanse — batchevi od 50px visine
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let minDist = Infinity;
      let secondDist = Infinity;
      let closestSite: Site | null = null;

      for (const site of sites) {
        const dx = x - site.x;
        const dy = y - site.y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          secondDist = minDist;
          minDist = d;
          closestSite = site;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }

      const idx = (y * W + x) * 4;
      const isBorder = bw > 0 && (secondDist - minDist) < bwSq * 100;

      if (isBorder) {
        // Granica između ćelija
        const [r, g, b] = closestSite?.color ?? [255, 255, 255, 255];
        data[idx]     = Math.min(255, r + 40);
        data[idx + 1] = Math.min(255, g + 40);
        data[idx + 2] = Math.min(255, b + 40);
        data[idx + 3] = 255;
      } else if (closestSite) {
        // Boja ćelije sa laganim radijal gradijentom (tamnije ka sredini)
        const [r, g, b] = closestSite.color;
        const dCenter = Math.sqrt(minDist);
        const dimFactor = 0.85 + 0.15 * Math.min(1, dCenter / 120);
        data[idx]     = Math.round(r * dimFactor);
        data[idx + 1] = Math.round(g * dimFactor);
        data[idx + 2] = Math.round(b * dimFactor);
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Vignette overlay
  addVignette(ctx);
}

function addVignette(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
): void {
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}
