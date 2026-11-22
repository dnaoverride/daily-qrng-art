"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface StudioSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/**
 * Telefon: panel koji se izvlači odozdo (do 55% visine, skrol unutra) — glavna slika ostaje
 * vidljiva iznad panela, pa se promena vidi dok se podešava.
 * Zatvara se tapom van panela, prevlačenjem ručke nadole ili tasterom Esc.
 */
export function StudioSheet({ open, onClose, title, closeLabel, children }: StudioSheetProps) {
  const startY = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || !panel.current) return;
    const dy = Math.max(0, (e.touches[0]?.clientY ?? 0) - startY.current);
    panel.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current === null || !panel.current) return;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - startY.current;
    panel.current.style.transform = "";
    startY.current = null;
    if (dy > 70) onClose();
  };

  return (
    <div className={`md:hidden fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/15 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 max-h-[55vh] flex flex-col rounded-t-2xl bg-white dark:bg-zinc-900 shadow-2xl transition-transform duration-250 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div
          className="shrink-0 pt-2 pb-1 cursor-grab touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            <button type="button" onClick={onClose} className="min-h-9 px-2 text-sm text-zinc-500">
              {closeLabel}
            </button>
          </div>
        </div>
        <div
          className="overflow-y-auto overscroll-contain px-4 pt-2"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
