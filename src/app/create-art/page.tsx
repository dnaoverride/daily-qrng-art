"use client";

import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { ArtCanvas } from "@/components/ArtCanvas";
import {
  SCENARIO_NAMES,
  NUM_SCENARIOS,
} from "@/lib/scenarios";
import { getTodayBelgrade } from "@/lib/date";

const REQUIRED_COUNT = 1000;

function parseValues(text: string): number[] | null {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== REQUIRED_COUNT) return null;
  const values: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    values.push((n >>> 0) & 0xffff);
  }
  return values;
}

export default function CreateArtPage() {
  const [input, setInput] = useState("");
  const [values, setValues] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function handleGenerate() {
    setError(null);
    const parsed = parseValues(input);
    if (!parsed) {
      setError(`Unesite tačno ${REQUIRED_COUNT} brojeva (0–65535), odvojenih zarezom, razmakom ili novim redom.`);
      setValues(null);
      return;
    }
    setValues(parsed);
  }

  async function handleLoadToday() {
    setError(null);
    const today = getTodayBelgrade();
    try {
      const res = await fetch(`/api/art/${today}`);
      if (!res.ok) throw new Error("Nije moguće učitati.");
      const data = (await res.json()) as { values?: number[] };
      if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) {
        throw new Error("Neispravan odgovor.");
      }
      setInput(data.values.join(", "));
      setValues(data.values);
    } catch {
      setError("Nije moguće učitati današnji art. Pokušajte ponovo.");
    }
  }

  async function handleRandom() {
    setError(null);
    try {
      const res = await fetch("/api/generate");
      if (!res.ok) throw new Error("Nije moguće učitati.");
      const data = (await res.json()) as { values?: number[] };
      if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) {
        throw new Error("Neispravan odgovor.");
      }
      setInput(data.values.join(", "));
      setValues(data.values);
    } catch {
      setError("Nije moguće učitati nasumične brojeve. Pokušajte ponovo.");
    }
  }

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrng-art-${Date.now()}.png`;
    a.click();
  }

  const scenarioName =
    values && values.length >= 4
      ? SCENARIO_NAMES[
          ((values[0]! ^ values[1]! ^ values[2]! ^ values[3]!) >>> 0) %
            NUM_SCENARIOS
        ] ?? "Pejzaž"
      : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="pt-20 pb-16 px-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-6">
          Playground — unesi 1000 brojeva
        </h1>

        <div className="space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${REQUIRED_COUNT} brojeva (0–65535), odvojenih zarezom, razmakom ili novim redom`}
            rows={8}
            className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity"
            >
              Generiši sliku
            </button>
            <button
              type="button"
              onClick={handleLoadToday}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Učitaj današnji art
            </button>
            <button
              type="button"
              onClick={handleRandom}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Nasumični brojevi
            </button>
            {values && (
              <button
                type="button"
                onClick={handleDownloadPng}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Preuzmi PNG
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        {values && (
          <div className="mt-8">
            {scenarioName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                Scenarij: {scenarioName}
              </p>
            )}
            <ArtCanvas
              values={values}
              onCanvasReady={(el) => {
                canvasRef.current = el;
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
