"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { SaveFavoriteButton } from "@/components/SaveFavoriteButton";
import { QRNGReveal } from "@/components/QRNGReveal";
import { getTodayBelgrade } from "@/lib/date";
import {
  PHILOSOPHIES,
  PALETTE_ORDER,
  DEFAULT_FLOW_FIELD,
  DEFAULT_WAVE,
  DEFAULT_VORONOI,
  DEFAULT_L_SYSTEM,
  DEFAULT_CELLULAR,
  DEFAULT_TRUCHET,
  DEFAULT_JULIA,
  DEFAULT_NEWTON,
  DEFAULT_APOLLONIAN,
} from "@/lib/algorithmic/types";
import type {
  PhilosophyId,
  FlowFieldParams,
  WaveParams,
  VoronoiParams,
  LSystemParams,
  CellularAutomataParams,
  TruchetParams,
  JuliaParams,
  NewtonParams,
  ApollonianParams,
  Palette,
  AlgoParams,
} from "@/lib/algorithmic/types";
import {
  initFlowField,
  drawFlowFieldFrame,
  initFlowFieldCanvas,
  type FlowFieldState,
} from "@/lib/algorithmic/flow-field";
import { renderWaveInterference } from "@/lib/algorithmic/wave-interference";
import { renderVoronoi } from "@/lib/algorithmic/voronoi";
import { renderLSystem } from "@/lib/algorithmic/l-system";
import { renderCellularAutomata } from "@/lib/algorithmic/cellular-automata";
import { renderTruchet } from "@/lib/algorithmic/truchet";
import { renderJulia } from "@/lib/algorithmic/julia";
import { renderNewton } from "@/lib/algorithmic/newton";
import { renderApollonian } from "@/lib/algorithmic/apollonian";

const W = 1200;
const H = 675;
const REQUIRED_COUNT = 1000;

const PALETTE_LABEL_KEY: Record<Palette, string> = {
  quantum: "paletteQuantum",
  warm: "paletteWarm",
  cool: "paletteCool",
  mono: "paletteMono",
  sunset: "paletteSunset",
  neon: "paletteNeon",
  forest: "paletteForest",
  ocean: "paletteOcean",
  aurora: "paletteAurora",
  ember: "paletteEmber",
};

// Filozofije grupisane po tipu za prikaz
const NON_FRACTAL_IDS: PhilosophyId[] = ["flow-field", "wave", "voronoi", "l-system", "cellular-automata", "truchet"];
const FRACTAL_IDS: PhilosophyId[] = ["julia", "newton", "apollonian"];

function scenarioStoryText(
  philosophy: PhilosophyId,
  t: (key: string) => string
): string {
  switch (philosophy) {
    case "flow-field":
      return t("storyFlowField");
    case "wave":
      return t("storyWave");
    case "voronoi":
      return t("storyVoronoi");
    case "l-system":
      return t("storyLSystem");
    case "cellular-automata":
      return t("storyCellular");
    case "truchet":
      return t("storyTruchet");
    case "julia":
      return t("storyJulia");
    case "newton":
      return t("storyNewton");
    case "apollonian":
      return t("storyApollonian");
  }
}

export default function AlgorithmicPage() {
  const t = useTranslations("algorithmic");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const flowStateRef = useRef<FlowFieldState | null>(null);
  const isAnimatingRef = useRef(false);

  const [philosophy, setPhilosophy] = useState<PhilosophyId>("flow-field");
  const [values, setValues] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const [ffParams, setFfParams] = useState<FlowFieldParams>({ ...DEFAULT_FLOW_FIELD });
  const [waveParams, setWaveParams] = useState<WaveParams>({ ...DEFAULT_WAVE });
  const [voronoiParams, setVoronoiParams] = useState<VoronoiParams>({ ...DEFAULT_VORONOI });
  const [lSystemParams, setLSystemParams] = useState<LSystemParams>({ ...DEFAULT_L_SYSTEM });
  const [cellularParams, setCellularParams] = useState<CellularAutomataParams>({ ...DEFAULT_CELLULAR });
  const [truchetParams, setTruchetParams] = useState<TruchetParams>({ ...DEFAULT_TRUCHET });
  const [juliaParams, setJuliaParams] = useState<JuliaParams>({ ...DEFAULT_JULIA });
  const [newtonParams, setNewtonParams] = useState<NewtonParams>({ ...DEFAULT_NEWTON });
  const [apollonianParams, setApollonianParams] = useState<ApollonianParams>({
    ...DEFAULT_APOLLONIAN,
  });

  function getCurrentParams(): AlgoParams {
    switch (philosophy) {
      case "flow-field":        return ffParams;
      case "wave":              return waveParams;
      case "voronoi":           return voronoiParams;
      case "l-system":          return lSystemParams;
      case "cellular-automata": return cellularParams;
      case "truchet":           return truchetParams;
      case "julia":             return juliaParams;
      case "newton":            return newtonParams;
      case "apollonian":        return apollonianParams;
    }
  }

  function stopAnimation() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    isAnimatingRef.current = false;
    setIsAnimating(false);
  }

  function startFlowFieldAnimation(vals: number[], params: FlowFieldParams) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stopAnimation();
    const state = initFlowField(vals, params);
    flowStateRef.current = state;
    initFlowFieldCanvas(ctx);
    isAnimatingRef.current = true;
    setIsAnimating(true);

    function frame() {
      if (!isAnimatingRef.current) return;
      drawFlowFieldFrame(ctx!, flowStateRef.current!);
      animFrameRef.current = requestAnimationFrame(frame);
    }
    animFrameRef.current = requestAnimationFrame(frame);
  }

  function renderStatic(vals: number[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stopAnimation();

    switch (philosophy) {
      case "wave":              renderWaveInterference(ctx, vals, waveParams); break;
      case "voronoi":           renderVoronoi(ctx, vals, voronoiParams); break;
      case "l-system":          renderLSystem(ctx, vals, lSystemParams); break;
      case "cellular-automata": renderCellularAutomata(ctx, vals, cellularParams); break;
      case "truchet":           renderTruchet(ctx, vals, truchetParams); break;
      case "julia":             renderJulia(ctx, vals, juliaParams); break;
      case "newton":            renderNewton(ctx, vals, newtonParams); break;
      case "apollonian":        renderApollonian(ctx, vals, apollonianParams); break;
    }
  }

  function renderCurrent(vals: number[]) {
    if (philosophy === "flow-field") {
      startFlowFieldAnimation(vals, ffParams);
    } else {
      renderStatic(vals);
    }
  }

  useEffect(() => {
    stopAnimation();
    if (values) renderCurrent(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [philosophy]);

  useEffect(() => {
    return () => stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRandom() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate");
      const text = await res.text();
      let data: { values?: number[] };
      try {
        data = JSON.parse(text) as { values?: number[] };
      } catch {
        throw new Error("not json");
      }
      if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) throw new Error();
      setValues(data.values);
      renderCurrent(data.values);
    } catch {
      setError(t("errorRandom"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadToday() {
    setError(null);
    setLoading(true);
    try {
      const today = getTodayBelgrade();
      const res = await fetch(`/api/art/${today}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { values?: number[] };
      if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) throw new Error();
      setValues(data.values);
      renderCurrent(data.values);
    } catch {
      setError(t("errorToday"));
    } finally {
      setLoading(false);
    }
  }

  function handleRegenerate() {
    if (values) renderCurrent(values);
  }

  function handleDownloadPng() {
    if (isAnimating) stopAnimation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrng-algorithmic-${philosophy}-${Date.now()}.png`;
    a.click();
  }

  function handleToggleAnimation() {
    if (!values) return;
    if (isAnimating) {
      stopAnimation();
    } else if (philosophy === "flow-field") {
      startFlowFieldAnimation(values, ffParams);
    }
  }

  function setPalette(v: Palette) {
    switch (philosophy) {
      case "flow-field":        setFfParams((p) => ({ ...p, palette: v })); break;
      case "wave":              setWaveParams((p) => ({ ...p, palette: v })); break;
      case "voronoi":           setVoronoiParams((p) => ({ ...p, palette: v })); break;
      case "l-system":          setLSystemParams((p) => ({ ...p, palette: v })); break;
      case "cellular-automata": setCellularParams((p) => ({ ...p, palette: v })); break;
      case "truchet":           setTruchetParams((p) => ({ ...p, palette: v })); break;
      case "julia":             setJuliaParams((p) => ({ ...p, palette: v })); break;
      case "newton":            setNewtonParams((p) => ({ ...p, palette: v })); break;
      case "apollonian":        setApollonianParams((p) => ({ ...p, palette: v })); break;
    }
  }

  const scenarioLabel = PHILOSOPHIES.find((p) => p.id === philosophy)?.labelKey ?? "flow-field";
  const nonFractals = PHILOSOPHIES.filter((p) => NON_FRACTAL_IDS.includes(p.id));
  const fractals    = PHILOSOPHIES.filter((p) => FRACTAL_IDS.includes(p.id));

  return (
    <div className="min-h-screen bg-zinc-950">
      <style>{`
        .algo-layout { display:flex; flex-direction:column; gap:1.5rem; }
        .algo-sidebar { width:100%; flex-shrink:0; }
        .algo-main    { flex:1 1 0%; display:flex; flex-direction:column; gap:1.5rem; min-width:0; }
        .algo-section { width:100%; max-width:56rem; margin-left:auto; margin-right:auto; }
        @media (min-width:600px) {
          .algo-layout  { flex-direction:row; }
          .algo-sidebar { width:20rem; }
          .algo-section { margin-left:0; margin-right:0; }
        }
      `}</style>
      <main className="pt-20 pb-16 px-4 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 text-center mb-2">
          {t("title")}
        </h1>
        <p className="text-center text-sm text-zinc-500 mb-6">
          {t("subtitle")}
        </p>

        {/* Izbor filozofije — dve grupe */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs text-zinc-500 self-center mr-1">{t("groupGenerative")}</span>
            {nonFractals.map((ph) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => setPhilosophy(ph.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  philosophy === ph.id
                    ? "bg-zinc-100 text-zinc-900"
                    : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {t(ph.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs text-zinc-500 self-center mr-1">{t("groupFractal")}</span>
            {fractals.map((ph) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => setPhilosophy(ph.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  philosophy === ph.id
                    ? "bg-violet-500 text-white"
                    : "border border-violet-800 text-violet-400 hover:border-violet-600 hover:text-violet-200"
                }`}
              >
                {t(ph.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col [@media(min-width:640px)]:flex-row gap-6">
          {/* Mobilni: slajderi → slika → QRNG priča (uvek ispod platna). Desktop: panel | slika+priča */}
          <aside className="algo-sidebar space-y-6">
            {/* Akcioni dugmići */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRandom}
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {loading ? t("loading") : t("random")}
              </button>
              <button
                type="button"
                onClick={handleLoadToday}
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 text-sm"
              >
                {t("loadToday")}
              </button>
              {values && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors text-sm"
                >
                  {t("regenerate")}
                </button>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {/* Parametri */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {t("params")}
              </h2>

              {/* Paleta — zajednička za sve */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">{t("palette")}</label>
                <select
                  value={getCurrentParams().palette}
                  onChange={(e) => setPalette(e.target.value as Palette)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                >
                  {PALETTE_ORDER.map((value) => (
                    <option key={value} value={value}>
                      {t(PALETTE_LABEL_KEY[value])}
                    </option>
                  ))}
                </select>
              </div>

              {/* Flow Field parametri */}
              {philosophy === "flow-field" && (
                <>
                  <SliderRow label={t("particles")} value={ffParams.particles}
                    min={100} max={1000} step={50}
                    onChange={(v) => setFfParams((p) => ({ ...p, particles: v }))} />
                  <SliderRow label={t("speed")} value={ffParams.speed}
                    min={0.5} max={4} step={0.1} decimals={1}
                    onChange={(v) => setFfParams((p) => ({ ...p, speed: v }))} />
                  <SliderRow label={t("trailWidth")} value={ffParams.trailWidth}
                    min={0.5} max={3} step={0.1} decimals={1}
                    onChange={(v) => setFfParams((p) => ({ ...p, trailWidth: v }))} />
                  <SliderRow label={t("trailAlpha")} value={ffParams.trailAlpha}
                    min={0.01} max={0.15} step={0.01} decimals={2}
                    onChange={(v) => setFfParams((p) => ({ ...p, trailAlpha: v }))} />
                </>
              )}

              {/* Wave parametri */}
              {philosophy === "wave" && (
                <>
                  <SliderRow label={t("waves")} value={waveParams.waves}
                    min={4} max={24} step={1}
                    onChange={(v) => setWaveParams((p) => ({ ...p, waves: v }))} />
                  <SliderRow label={t("amplitude")} value={waveParams.amplitude}
                    min={0.3} max={1.0} step={0.05} decimals={2}
                    onChange={(v) => setWaveParams((p) => ({ ...p, amplitude: v }))} />
                  <SliderRow label={t("contrast")} value={waveParams.contrast}
                    min={1.0} max={3.0} step={0.1} decimals={1}
                    onChange={(v) => setWaveParams((p) => ({ ...p, contrast: v }))} />
                </>
              )}

              {/* Voronoi parametri */}
              {philosophy === "voronoi" && (
                <>
                  <SliderRow label={t("cells")} value={voronoiParams.cells}
                    min={20} max={400} step={10}
                    onChange={(v) => setVoronoiParams((p) => ({ ...p, cells: v }))} />
                  <SliderRow label={t("borderWidth")} value={voronoiParams.borderWidth}
                    min={0} max={4} step={0.5} decimals={1}
                    onChange={(v) => setVoronoiParams((p) => ({ ...p, borderWidth: v }))} />
                </>
              )}

              {/* L-System parametri */}
              {philosophy === "l-system" && (
                <>
                  <SliderRow label={t("lsDepth")} value={lSystemParams.depth}
                    min={3} max={7} step={1}
                    onChange={(v) => setLSystemParams((p) => ({ ...p, depth: v }))} />
                  <SliderRow label={t("lsAngle")} value={lSystemParams.angle}
                    min={15} max={45} step={1}
                    onChange={(v) => setLSystemParams((p) => ({ ...p, angle: v }))} />
                  <SliderRow label={t("lsLengthFactor")} value={lSystemParams.lengthFactor}
                    min={0.5} max={0.85} step={0.01} decimals={2}
                    onChange={(v) => setLSystemParams((p) => ({ ...p, lengthFactor: v }))} />
                </>
              )}

              {/* Cellular Automata parametri */}
              {philosophy === "cellular-automata" && (
                <>
                  <SliderRow label={t("caRule")} value={cellularParams.rule}
                    min={0} max={255} step={1}
                    onChange={(v) => setCellularParams((p) => ({ ...p, rule: v }))} />
                  <SliderRow label={t("caCellSize")} value={cellularParams.cellSize}
                    min={1} max={4} step={1}
                    onChange={(v) => setCellularParams((p) => ({ ...p, cellSize: v }))} />
                </>
              )}

              {/* Truchet parametri */}
              {philosophy === "truchet" && (
                <>
                  <SliderRow label={t("trTileSize")} value={truchetParams.tileSize}
                    min={20} max={80} step={5}
                    onChange={(v) => setTruchetParams((p) => ({ ...p, tileSize: v }))} />
                  <SliderRow label={t("trLineWidth")} value={truchetParams.lineWidth}
                    min={1} max={8} step={0.5} decimals={1}
                    onChange={(v) => setTruchetParams((p) => ({ ...p, lineWidth: v }))} />
                </>
              )}

              {/* Julia parametri */}
              {philosophy === "julia" && (
                <>
                  <SliderRow label={t("juliaMaxIter")} value={juliaParams.maxIter}
                    min={50} max={300} step={10}
                    onChange={(v) => setJuliaParams((p) => ({ ...p, maxIter: v }))} />
                  <SliderRow label={t("juliaZoom")} value={juliaParams.zoom}
                    min={0.5} max={3.0} step={0.1} decimals={1}
                    onChange={(v) => setJuliaParams((p) => ({ ...p, zoom: v }))} />
                </>
              )}

              {/* Newton parametri */}
              {philosophy === "newton" && (
                <>
                  <SliderRow label={t("newtonDegree")} value={newtonParams.degree}
                    min={3} max={7} step={1}
                    onChange={(v) => setNewtonParams((p) => ({ ...p, degree: v }))} />
                  <SliderRow label={t("newtonMaxIter")} value={newtonParams.maxIter}
                    min={20} max={150} step={5}
                    onChange={(v) => setNewtonParams((p) => ({ ...p, maxIter: v }))} />
                  <SliderRow label={t("newtonZoom")} value={newtonParams.zoom}
                    min={0.5} max={3.0} step={0.1} decimals={1}
                    onChange={(v) => setNewtonParams((p) => ({ ...p, zoom: v }))} />
                </>
              )}

              {/* Apollonian gasket parametri */}
              {philosophy === "apollonian" && (
                <>
                  <SliderRow label={t("apollonianMaxCircles")} value={apollonianParams.maxCircles}
                    min={500} max={8000} step={100}
                    onChange={(v) => setApollonianParams((p) => ({ ...p, maxCircles: v }))} />
                  <SliderRow label={t("apollonianMinRadius")} value={apollonianParams.minRadiusPx}
                    min={0.5} max={4} step={0.1} decimals={1}
                    onChange={(v) => setApollonianParams((p) => ({ ...p, minRadiusPx: v }))} />
                  <SliderRow label={t("apollonianLineWidth")} value={apollonianParams.lineWidth}
                    min={0.5} max={2} step={0.1} decimals={1}
                    onChange={(v) => setApollonianParams((p) => ({ ...p, lineWidth: v }))} />
                </>
              )}
            </div>

            {/* Animacija toggle (samo za Flow Field) */}
            {philosophy === "flow-field" && values && (
              <button
                type="button"
                onClick={handleToggleAnimation}
                className="w-full px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors text-sm"
              >
                {isAnimating ? t("pause") : t("resume")}
              </button>
            )}

            {/* Sačuvaj / PNG */}
            {values && (
              <div className="space-y-2">
                <SaveFavoriteButton
                  values={values}
                  scenarioName={`algo:${philosophy}`}
                />
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG
                </button>
              </div>
            )}
          </aside>

          <div className="algo-main">
            <div className="algo-section">
              <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  className="w-full h-auto block"
                  style={{ aspectRatio: `${W} / ${H}` }}
                />
                {!values && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                    <div className="text-4xl mb-3 opacity-30">⬡</div>
                    <p className="text-sm">{t("emptyHint")}</p>
                  </div>
                )}
                {isAnimating && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-zinc-300">{t("live")}</span>
                  </div>
                )}
              </div>
            </div>

            {values && (
              <div className="algo-section">
                <QRNGReveal values={values} className="max-w-none mx-0" />
              </div>
            )}

            <section
              className="algo-section space-y-3"
              aria-labelledby="algorithmic-story-heading"
            >
              <h2
                id="algorithmic-story-heading"
                className="text-sm font-semibold text-zinc-300"
              >
                {t("storyTitle")}
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t("storyIntro")}
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="text-xs font-medium text-violet-400/90 mb-2">
                  {t(scenarioLabel)}
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {scenarioStoryText(philosophy, t as (key: string) => string)}
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, decimals = 0, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">{value.toFixed(decimals)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-zinc-300 h-1.5 rounded-full bg-zinc-700 appearance-none cursor-pointer"
      />
    </div>
  );
}
