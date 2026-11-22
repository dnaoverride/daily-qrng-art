"use client";

/*
 * Klijent za crtanje sličica: u workeru kad pregledač podržava OffscreenCanvas,
 * inače na glavnom thread-u, jedna po jedna (setTimeout između).
 */
import { drawItem, type StudioItem } from "./thumb-draw";

export { ART_W, ART_H, itemKey, DEFAULT_ALGO_PARAMS, type StudioItem } from "./thumb-draw";

type Done = (bitmap: ImageBitmap | null) => void;

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, Done>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") throw new Error("no worker");
    worker = new Worker(new URL("./thumb.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; bitmap?: ImageBitmap }>) => {
      const done = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (done) done(e.data.bitmap ?? null);
      else e.data.bitmap?.close(); // otkazano u međuvremenu
    };
    worker.onerror = () => {
      // Worker pao (npr. stari pregledač) → ubuduće crtaj na glavnom thread-u.
      worker = null;
      for (const done of pending.values()) done(null);
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/* Rezervni red na glavnom thread-u */
type Task = { run: () => void; cancelled: boolean };
const queue: Task[] = [];
let scheduled = false;
function pump() {
  scheduled = false;
  let task = queue.shift();
  while (task?.cancelled) task = queue.shift();
  task?.run();
  if (queue.length && !scheduled) {
    scheduled = true;
    setTimeout(pump, 0);
  }
}

/**
 * Nacrta stavku u `target` (veličine sličice). `onDone` se zove kad je gotovo.
 * Vraća funkciju za otkazivanje.
 */
export function requestThumb(
  target: HTMLCanvasElement,
  values: number[],
  item: StudioItem,
  onDone: () => void,
  opts: { priority?: boolean } = {}
): () => void {
  const w = getWorker();
  if (w) {
    const id = ++seq;
    let cancelled = false;
    pending.set(id, (bitmap) => {
      if (cancelled) return bitmap?.close();
      if (bitmap) {
        target.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
      } else {
        drawItem(target, values, item); // worker nije uspeo — nacrtaj ovde
      }
      onDone();
    });
    w.postMessage({
      type: "render",
      id,
      values,
      item,
      tw: target.width,
      th: target.height,
      priority: opts.priority ?? false,
    });
    return () => {
      cancelled = true;
      pending.delete(id);
      w.postMessage({ type: "cancel", id });
    };
  }
  const task: Task = {
    run: () => {
      drawItem(target, values, item);
      onDone();
    },
    cancelled: false,
  };
  if (opts.priority) queue.unshift(task);
  else queue.push(task);
  if (!scheduled) {
    scheduled = true;
    setTimeout(pump, 0);
  }
  return () => {
    task.cancelled = true;
  };
}
