/**
 * Forest scenario — siluete drveća na sumrak/rano jutro.
 * Landscape nivo: tamne krošnje od 6-12 blobova, 3 sloja dubine, poboljšane light rays.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { drawSunGlow, fillStrokeEllipse } from "../draw-utils";

export function renderForest(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const isNight = stream.next_f() < 0.25;
  const isSunset = !isNight && stream.next_f() < 0.35;
  const greenHue = 100 + stream.next_int(0, 50);
  const skyHue = isNight ? 235 + stream.next_int(0, 25) : isSunset ? 15 + stream.next_int(0, 25) : 200 + stream.next_int(0, 40);
  const accentHue = isSunset ? skyHue + 10 : (skyHue + 25) % 360;
  const horizonY = Math.floor(h * (0.35 + 0.15 * stream.next_f()));

  const skyTop = hslToRgb(skyHue, isSunset ? 0.6 : 0.45, isNight ? 0.15 : isSunset ? 0.55 : 0.6);
  const skyMid = hslToRgb(accentHue, isSunset ? 0.55 : isNight ? 0.4 : 0.5, isNight ? 0.12 : isSunset ? 0.45 : 0.48);
  const skyBot = hslToRgb(isSunset ? Math.min(360, skyHue + 20) : skyHue + 10, isSunset ? 0.5 : 0.35, isNight ? 0.1 : isSunset ? 0.35 : 0.4);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(skyTop));
  skyGrad.addColorStop(0.45, rgbString(skyMid));
  skyGrad.addColorStop(1, rgbString(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const sunX = Math.floor(w * (0.2 + 0.6 * stream.next_f()));
  const sunY = Math.floor(horizonY * (0.15 + 0.3 * stream.next_f()));
  const sunR = isNight
    ? Math.floor(14 + 12 * stream.next_f())
    : Math.floor(22 + 14 * stream.next_f());
  const glowColor: RGB = isNight ? [235, 240, 255] : [255, 240, 200];
  const coreColor: RGB = isNight ? [245, 248, 255] : [255, 250, 230];
  drawSunGlow(ctx, sunX, sunY, sunR, glowColor, coreColor, isNight ? 10 : 16);

  if (isNight) {
    const stars = stream.next_int(200, 400);
    for (let i = 0; i < stars; i++) {
      const sx = stream.next_int(0, w - 1);
      const sy = stream.next_int(0, Math.floor(horizonY * 0.9));
      const sb = stream.next_int(140, 255);
      const sr = stream.next_f() < 0.9 ? 1 : 2;
      ctx.fillStyle = `rgb(${sb},${sb},${sb})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.strokeStyle = "rgba(180,175,200,0.5)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (stream.next_f() < 0.5) {
      const numOwls = stream.next_int(1, 2);
      for (let i = 0; i < numOwls; i++) {
        const ox = stream.next_int(80, w - 80);
        const oy = stream.next_int(50, Math.floor(horizonY * 0.7));
        const span = 18 + 12 * stream.next_f();
        const wingUp = stream.next_f() < 0.5;
        ctx.beginPath();
        ctx.arc(ox, oy - 4, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox - span, oy);
        ctx.quadraticCurveTo(ox, oy + (wingUp ? -10 : 8), ox + span, oy);
        ctx.stroke();
      }
    } else {
      const numBats = stream.next_int(1, 3);
      for (let i = 0; i < numBats; i++) {
        const bx = stream.next_int(80, w - 80);
        const by = stream.next_int(50, Math.floor(horizonY * 0.7));
        const span = 20 + 20 * stream.next_f();
        const wingUp = stream.next_f() < 0.5;
        ctx.beginPath();
        ctx.moveTo(bx - span, by);
        ctx.quadraticCurveTo(bx, by + (wingUp ? -12 : 10), bx + span, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else {
    const numBirds = stream.next_int(1, 4);
    ctx.save();
    ctx.strokeStyle = "rgba(60,50,40,0.6)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < numBirds; i++) {
      const bx = stream.next_int(60, w - 60);
      const by = stream.next_int(40, Math.floor(horizonY * 0.8));
      const span = 12 + 14 * stream.next_f();
      const wingUp = stream.next_f() < 0.5;
      ctx.beginPath();
      ctx.moveTo(bx - span, by);
      ctx.quadraticCurveTo(bx, by + (wingUp ? -8 : 6), bx + span, by);
      ctx.stroke();
    }
    ctx.restore();

    const lightRays = stream.next_int(6, 14);
    ctx.save();
    ctx.globalAlpha = 0.04 + 0.06 * stream.next_f();
    for (let i = 0; i < lightRays; i++) {
    const angle = -0.4 + 0.8 * stream.next_f();
    const x = w * (0.1 + 0.8 * stream.next_f());
    const grad = ctx.createLinearGradient(x, 0, x + Math.cos(angle) * w * 1.2, h);
    grad.addColorStop(0, "rgba(255,255,245,0.25)");
    grad.addColorStop(0.4, "rgba(255,255,245,0.08)");
    grad.addColorStop(1, "rgba(255,255,245,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  }

  const grassHue = 95 + stream.next_int(0, 35);
  const groundDark = hslToRgb(grassHue, 0.5, 0.12);
  const groundMid = hslToRgb(grassHue + 8, 0.45, 0.18);
  const groundLight = hslToRgb(grassHue + 15, 0.4, 0.26);
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, rgbString(groundMid));
  groundGrad.addColorStop(0.5, rgbString(groundDark));
  groundGrad.addColorStop(1, rgbString(groundLight));
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const layers = [
    { count: stream.next_int(6, 12), scale: 0.35, yRange: 0.15, alpha: 0.75 },
    { count: stream.next_int(8, 14), scale: 0.65, yRange: 0.28, alpha: 0.92 },
    { count: stream.next_int(6, 12), scale: 1.0, yRange: 0.45, alpha: 1.0 },
  ];

  type Tree = {
    baseY: number;
    layer: { scale: number; alpha: number };
    x: number;
    trunkH: number;
    trunkW: number;
    trunkTopY: number;
    crownBaseY: number;
    crownBaseX: number;
    crownHue: number;
    trunkHue: number;
    treeType: "deciduous" | "conifer";
    conifer?: { coneH: number; baseHalfW: number };
    deciduous?: { envelopeW: number; envelopeH: number; blobs: Array<{ ox: number; oy: number; r: number; hue: number; sat: number; light: number }> };
  };

  const trees: Tree[] = [];
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const x = stream.next_int(-80, w + 80);
      const baseY =
        horizonY +
        stream.next_int(0, Math.floor((h - horizonY) * layer.yRange));
      const trunkH = Math.floor((70 + 90 * stream.next_f()) * layer.scale);
      const treeType: "deciduous" | "conifer" =
        stream.next_f() < 0.65 ? "deciduous" : "conifer";
      const trunkW = Math.max(
        5,
        Math.floor((treeType === "conifer" ? 8 : 12) * layer.scale)
      );
      const trunkTopY = baseY - trunkH;
      const crownBaseY = trunkTopY + Math.floor(4 * layer.scale);
      const crownBaseX = x;
      const crownHue = greenHue + stream.next_int(-15, 25);
      const trunkHue = 25 + stream.next_int(0, 25);

      const tree: Tree = {
        baseY,
        layer,
        x,
        trunkH,
        trunkW,
        trunkTopY,
        crownBaseY,
        crownBaseX,
        crownHue,
        trunkHue,
        treeType,
      };

      if (treeType === "conifer") {
        tree.conifer = {
          coneH: (50 + 60 * stream.next_f()) * layer.scale,
          baseHalfW: (45 + 50 * stream.next_f()) * layer.scale,
        };
      } else {
        const envelopeW = 55 * layer.scale;
        const envelopeH = 50 * layer.scale;
        const blobs: { ox: number; oy: number; r: number; hue: number; sat: number; light: number }[] = [];
        const numBlobs = stream.next_int(6, 12);
        for (let b = 0; b < numBlobs; b++) {
          blobs.push({
            ox: (stream.next_f() - 0.5) * envelopeW * 2,
            oy: (stream.next_f() - 0.5) * envelopeH * 2,
            r: (18 + 45 * stream.next_f()) * layer.scale,
            hue: crownHue + stream.next_int(-10, 15),
            sat: 0.4 + 0.25 * stream.next_f(),
            light: 0.18 + 0.2 * stream.next_f(),
          });
        }
        tree.deciduous = { envelopeW, envelopeH, blobs };
      }
      trees.push(tree);
    }
  }

  trees.sort((a, b) => a.baseY - b.baseY);

  for (const tree of trees) {
    ctx.save();
    ctx.globalAlpha = tree.layer.alpha;

    if (tree.treeType === "conifer" && tree.conifer) {
      const { coneH, baseHalfW } = tree.conifer;
      const coneTopY = tree.crownBaseY - coneH;
      const darkGreen = hslToRgb(tree.crownHue, 0.5, 0.18 + 0.08 * tree.layer.scale);
      const midGreen = hslToRgb((tree.crownHue + 8) % 360, 0.45, 0.22 + 0.1 * tree.layer.scale);
      const lightGreen = hslToRgb((tree.crownHue + 15) % 360, 0.4, 0.28 + 0.08 * tree.layer.scale);
      ctx.fillStyle = rgbString(darkGreen);
      ctx.beginPath();
      ctx.moveTo(tree.crownBaseX - baseHalfW, tree.crownBaseY);
      ctx.lineTo(tree.crownBaseX + baseHalfW, tree.crownBaseY);
      ctx.lineTo(tree.crownBaseX + 2, coneTopY);
      ctx.lineTo(tree.crownBaseX - 2, coneTopY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgbString(midGreen);
      ctx.beginPath();
      ctx.moveTo(tree.crownBaseX - baseHalfW * 0.7, tree.crownBaseY - coneH * 0.35);
      ctx.lineTo(tree.crownBaseX + baseHalfW * 0.7, tree.crownBaseY - coneH * 0.35);
      ctx.lineTo(tree.crownBaseX, coneTopY + coneH * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgbString(lightGreen);
      ctx.beginPath();
      ctx.moveTo(tree.crownBaseX - baseHalfW * 0.35, tree.crownBaseY - coneH * 0.6);
      ctx.lineTo(tree.crownBaseX + baseHalfW * 0.35, tree.crownBaseY - coneH * 0.6);
      ctx.lineTo(tree.crownBaseX, coneTopY);
      ctx.closePath();
      ctx.fill();
    } else if (tree.deciduous) {
      for (const blob of tree.deciduous.blobs) {
        ctx.fillStyle = rgbString(hslToRgb(blob.hue, blob.sat, blob.light));
        ctx.beginPath();
        ctx.arc(tree.crownBaseX + blob.ox, tree.crownBaseY + blob.oy, blob.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const trunkColor = hslToRgb(tree.trunkHue, 0.4, 0.22 + 0.1 * tree.layer.scale);
    ctx.fillStyle = rgbString(trunkColor);
    ctx.fillRect(tree.x - tree.trunkW / 2, tree.trunkTopY, tree.trunkW, tree.trunkH);

    ctx.restore();
  }

  if (!isNight && stream.next_f() < 0.5) {
    const numCritters = stream.next_int(1, 3);
    for (let k = 0; k < numCritters; k++) {
      const bushyTail = stream.next_f() < 0.5;
      const sqX = stream.next_int(80, w - 80);
      const sqY = horizonY + Math.floor((h - horizonY) * (0.4 + 0.35 * stream.next_f()));
      const furHue = 28 + stream.next_int(0, 15);
      const bodyFill = rgbString(hslToRgb(furHue, 0.45, 0.28));
      const tailStrokeBrown = rgbString(hslToRgb(furHue, 0.4, 0.18));
      const earFill = rgbString(hslToRgb(furHue, 0.45, 0.22));
      const triangleEars = stream.next_f() < 0.5;

      const attachX = sqX - 12;
      const attachY = sqY;
      if (bushyTail) {
        for (let i = 0; i < 4; i++) {
          const t = i / 3;
          const ang = Math.PI * 1.05 + t * 0.38;
          const dist = 6 + i * 8;
          const tx = attachX + Math.cos(ang) * dist;
          const ty = attachY + Math.sin(ang) * dist;
          const rx = Math.max(1.2, 8 - i * 1.2);
          const ry = Math.max(1, 5.5 - i * 0.9);
          fillStrokeEllipse(
            ctx,
            tx,
            ty,
            rx,
            ry,
            rgbString(hslToRgb(furHue, 0.45, 0.24 + i * 0.02)),
            tailStrokeBrown,
            0.75
          );
        }
      } else {
        ctx.save();
        ctx.strokeStyle = rgbString(hslToRgb(340, 0.38, 0.7));
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(attachX, attachY);
        ctx.quadraticCurveTo(attachX - 10, attachY - 10, attachX - 6, attachY - 18);
        ctx.quadraticCurveTo(attachX + 4, attachY - 24, attachX - 3, attachY - 30);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.ellipse(sqX, sqY, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sqX + 12, sqY - 4, 10, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();

      const hx = sqX + 12;
      const hy = sqY - 4;
      ctx.fillStyle = earFill;
      if (triangleEars) {
        ctx.beginPath();
        ctx.moveTo(hx - 3, hy - 9);
        ctx.lineTo(hx - 13, hy - 2);
        ctx.lineTo(hx - 2, hy + 1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx + 5, hy - 10);
        ctx.lineTo(hx + 15, hy - 3);
        ctx.lineTo(hx + 4, hy);
        ctx.closePath();
        ctx.fill();
      } else {
        const er = 6;
        ctx.beginPath();
        ctx.moveTo(hx - 9 - er, hy - 3);
        ctx.arc(hx - 9, hy - 3, er, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx + 9 - er, hy - 3);
        ctx.arc(hx + 9, hy - 3, er, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = "rgb(0,0,0)";
      ctx.beginPath();
      ctx.arc(sqX + 10, sqY - 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sqX + 16, sqY - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
