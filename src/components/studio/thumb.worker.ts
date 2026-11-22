/// <reference lib="webworker" />
/*
 * Studio: sličice se crtaju u workeru (OffscreenCanvas), pa glavni thread
 * ostaje slobodan za swipe i dodir, što je važno na telefonu.
 * Zadaci idu jedan po jedan; otkazani se preskaču.
 */
import { drawItem, type StudioItem } from "./thumb-draw";

type Req = { type: "render"; id: number; values: number[]; item: StudioItem; tw: number; th: number; priority?: boolean };
type Cancel = { type: "cancel"; id: number };

const ctxSelf = self as unknown as DedicatedWorkerGlobalScope;
const queue: Req[] = [];
let busy = false;

function next() {
  const req = queue.shift();
  if (!req) {
    busy = false;
    return;
  }
  try {
    const out = new OffscreenCanvas(req.tw, req.th);
    drawItem(out, req.values, req.item);
    const bitmap = out.transferToImageBitmap();
    ctxSelf.postMessage({ id: req.id, bitmap }, [bitmap]);
  } catch (e) {
    ctxSelf.postMessage({ id: req.id, error: String(e) });
  }
  setTimeout(next, 0);
}

ctxSelf.onmessage = (e: MessageEvent<Req | Cancel>) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    const i = queue.findIndex((r) => r.id === msg.id);
    if (i >= 0) queue.splice(i, 1);
    return;
  }
  // Glavna slika ide ispred sličica.
  if (msg.priority) queue.unshift(msg);
  else queue.push(msg);
  if (!busy) {
    busy = true;
    setTimeout(next, 0);
  }
};
