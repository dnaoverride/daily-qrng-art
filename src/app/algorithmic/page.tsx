"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { parseFavoriteScenarioToPhilosophyId } from "@/lib/algorithmic/scenario-name";
import {
  buildPreset,
  decodePreset,
  encodePreset,
  presetShareUrl,
  type AlgoPreset,
} from "@/lib/algorithmic/preset-code";
import {
  applyPresetToState,
  type AlgoParamState,
} from "@/lib/algorithmic/preset-state";
import { randomizeParams } from "@/lib/algorithmic/randomize-params";
import {
  renderAlgorithmicToContext,
} from "@/lib/algorithmic/render-algorithmic";
import {
  EXPORT_PRESETS,
  exportAlgorithmicPng,
  type ExportPresetId,
} from "@/lib/algorithmic/export-png";
import { exportVariationSetZip } from "@/lib/algorithmic/export-set";
import {
  exportFlowFieldWebm,
  supportsWebmExport,
} from "@/lib/algorithmic/export-video";

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

function AlgorithmicPageInner() {
  const t = useTranslations("algorithmic");
  const searchParams = useSearchParams();
  const router = useRouter();
  const favoriteId = searchParams.get("favorite");
  const codeParam = searchParams.get("code");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const flowStateRef = useRef<FlowFieldState | null>(null);
  const loopStartRef = useRef<number>(0);
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

  const [lockPhilosophy, setLockPhilosophy] = useState(true);
  const [lockPalette, setLockPalette] = useState(false);
  const [exportPresetId, setExportPresetId] = useState<ExportPresetId>("hd");
  const [setExportCount, setSetExportCount] = useState(6);
  const [shareInput, setShareInput] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  function applyParamState(state: AlgoParamState) {
    setPhilosophy(state.philosophy);
    setFfParams(state.ffParams);
    setWaveParams(state.waveParams);
    setVoronoiParams(state.voronoiParams);
    setLSystemParams(state.lSystemParams);
    setCellularParams(state.cellularParams);
    setTruchetParams(state.truchetParams);
    setJuliaParams(state.juliaParams);
    setNewtonParams(state.newtonParams);
    setApollonianParams(state.apollonianParams);
  }

  function currentPreset(vals: number[]): AlgoPreset {
    return buildPreset(philosophy, getCurrentParams(), vals);
  }

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
    const state = initFlowField(vals, params, 0);
    flowStateRef.current = state;
    initFlowFieldCanvas(ctx, W, H);
    loopStartRef.current = performance.now();
    isAnimatingRef.current = true;
    setIsAnimating(true);

    const loopMs = 4000;

    function frame(now: number) {
      if (!isAnimatingRef.current) return;
      const phase = ((now - loopStartRef.current) % loopMs) / loopMs;
      drawFlowFieldFrame(ctx!, flowStateRef.current!, W, H, phase);
      animFrameRef.current = requestAnimationFrame(frame);
    }
    animFrameRef.current = requestAnimationFrame(frame);
  }

  function renderStaticToCanvas(
    ctx: CanvasRenderingContext2D,
    vals: number[],
    p: PhilosophyId
  ) {
    renderAlgorithmicToContext(ctx, p, vals, getParamsForPhilosophy(p), {
      width: W,
      height: H,
      flowFieldWarmupFrames: 120,
    });
  }

  function getParamsForPhilosophy(p: PhilosophyId): AlgoParams {
    switch (p) {
      case "flow-field": return ffParams;
      case "wave": return waveParams;
      case "voronoi": return voronoiParams;
      case "l-system": return lSystemParams;
      case "cellular-automata": return cellularParams;
      case "truchet": return truchetParams;
      case "julia": return juliaParams;
      case "newton": return newtonParams;
      case "apollonian": return apollonianParams;
    }
  }

  function renderStatic(vals: number[], p: PhilosophyId) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stopAnimation();
    renderStaticToCanvas(ctx, vals, p);
  }

  function renderCurrent(vals: number[], p: PhilosophyId = philosophy) {
    if (p === "flow-field") {
      startFlowFieldAnimation(vals, ffParams);
    } else {
      renderStatic(vals, p);
    }
  }

  function loadPreset(preset: AlgoPreset) {
    applyParamState(applyPresetToState(preset));
    setValues(preset.values);
    requestAnimationFrame(() => {
      if (preset.philosophy === "flow-field") {
        startFlowFieldAnimation(preset.values, preset.params as FlowFieldParams);
      } else {
        renderStatic(preset.values, preset.philosophy);
      }
    });
  }

  useEffect(() => {
    if (!codeParam || favoriteId) return;
    const preset = decodePreset(decodeURIComponent(codeParam));
    if (!preset) {
      setError(t("errorInvalidCode"));
      return;
    }
    loadPreset(preset);
    router.replace("/algorithmic");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  useEffect(() => {
    if (!favoriteId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/favorites/${favoriteId}`);
        const data = (await res.json()) as {
          favorite?: {
            values?: unknown;
            scenarioName?: string | null;
            algoPreset?: unknown;
          };
        };
        if (!alive || !res.ok || !data.favorite) {
          if (alive) {
            setError(t("errorLoadFavorite"));
            router.replace("/algorithmic");
          }
          return;
        }
        const raw = data.favorite.values;
        const vals = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? (JSON.parse(raw) as number[])
            : [];
        if (vals.length !== REQUIRED_COUNT) {
          if (alive) {
            setError(t("errorLoadFavorite"));
            router.replace("/algorithmic");
          }
          return;
        }

        const storedPreset = data.favorite.algoPreset as AlgoPreset | null | undefined;
        if (storedPreset?.philosophy && storedPreset.params) {
          if (!alive) return;
          loadPreset({ ...storedPreset, values: vals });
          router.replace("/algorithmic");
          return;
        }

        const pid = parseFavoriteScenarioToPhilosophyId(data.favorite.scenarioName);
        if (!pid) {
          if (alive) router.replace(`/create-art?favorite=${favoriteId}`);
          return;
        }
        if (!alive) return;
        setPhilosophy(pid);
        setValues(vals);
        requestAnimationFrame(() => {
          renderCurrent(vals, pid);
          router.replace("/algorithmic");
        });
      } catch {
        if (alive) {
          setError(t("errorLoadFavorite"));
          router.replace("/algorithmic");
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteId, router, t]);

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

  function handleRandomizeStyle() {
    if (!values) return;
    setError(null);
    const result = randomizeParams({
      keepPhilosophy: lockPhilosophy,
      keepPalette: lockPalette,
      currentPhilosophy: philosophy,
      currentParams: getCurrentParams(),
      values,
    });
    applyParamState(applyPresetToState(buildPreset(result.philosophy, result.params, values)));
    requestAnimationFrame(() => renderCurrent(values, result.philosophy));
  }

  async function handleCopyCode() {
    if (!values) return;
    const code = encodePreset(currentPreset(values));
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt(t("shareCode"), code);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function handleCopyLink() {
    if (!values) return;
    const url = presetShareUrl(currentPreset(values));
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t("shareLink"), url);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  function handleLoadShareCode() {
    setError(null);
    const preset = decodePreset(shareInput.trim());
    if (!preset) {
      setError(t("errorInvalidCode"));
      return;
    }
    loadPreset(preset);
    setShareInput("");
  }

  async function handleDownloadPng() {
    if (!values) return;
    if (isAnimating) stopAnimation();
    setExportBusy(true);
    try {
      await exportAlgorithmicPng(
        philosophy,
        values,
        getCurrentParams(),
        exportPresetId,
        `qrng-algorithmic-${philosophy}-${exportPresetId}.png`
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function handleExportSet() {
    if (!values) return;
    if (isAnimating) stopAnimation();
    setExportBusy(true);
    try {
      const preset = EXPORT_PRESETS.find((p) => p.id === exportPresetId) ?? EXPORT_PRESETS[0];
      await exportVariationSetZip(
        philosophy,
        values,
        getCurrentParams(),
        setExportCount,
        preset.width,
        preset.height,
        `qrng-set-${philosophy}.zip`
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function handleExportVideo() {
    if (!values || philosophy !== "flow-field") return;
    if (isAnimating) stopAnimation();
    setExportBusy(true);
    try {
      await exportFlowFieldWebm({
        values,
        params: ffParams,
        width: W,
        height: H,
        fps: 30,
        loopSeconds: 4,
        filename: `qrng-flow-field-loop.webm`,
      });
    } catch {
      setError(t("errorVideoExport"));
    } finally {
      setExportBusy(false);
    }
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
      {/* Layout van Tailwind responsive — plain CSS da sigurno radi na desktopu (Turbopack / v4) */}
      <style>{`
        .algo-art-workspace {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 1.5rem;
          width: 100%;
          box-sizing: border-box;
        }
        .algo-art-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .algo-art-main {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          flex: 1 1 0%;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }
        @media (min-width: 48rem) {
          .algo-art-workspace {
            flex-direction: row !important;
            align-items: flex-start;
            gap: 2rem;
          }
          .algo-art-sidebar {
            width: 20rem;
            max-width: 20rem;
          }
          .algo-art-main {
            width: auto;
            flex: 1 1 0%;
            min-width: 0;
          }
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

        <div className="algo-art-workspace">
          <aside className="algo-art-sidebar">
            {/* Akcioni dugmići */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRandom}
                disabled={loading || exportBusy}
                className="w-full px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {loading ? t("loading") : t("random")}
              </button>
              <button
                type="button"
                onClick={handleLoadToday}
                disabled={loading || exportBusy}
                className="w-full px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 text-sm"
              >
                {t("loadToday")}
              </button>
              {values && (
                <button
                  type="button"
                  onClick={handleRandomizeStyle}
                  disabled={exportBusy}
                  className="w-full px-4 py-2 rounded-lg border border-violet-700 text-violet-300 font-medium hover:bg-violet-950 transition-colors disabled:opacity-50 text-sm"
                >
                  {t("randomizeStyle")}
                </button>
              )}
            </div>

            {values && (
              <div className="flex gap-3 text-xs text-zinc-400">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockPhilosophy}
                    onChange={(e) => setLockPhilosophy(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  {t("lockPhilosophy")}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockPalette}
                    onChange={(e) => setLockPalette(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  {t("lockPalette")}
                </label>
              </div>
            )}

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

            {values && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-2">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {t("shareTitle")}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800"
                  >
                    {shareCopied ? t("copied") : t("copyCode")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800"
                  >
                    {t("copyLink")}
                  </button>
                </div>
                <input
                  type="text"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  placeholder={t("pasteCodePlaceholder")}
                  className="w-full px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs"
                />
                <button
                  type="button"
                  onClick={handleLoadShareCode}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800"
                >
                  {t("loadCode")}
                </button>
              </div>
            )}

            {/* Sačuvaj / PNG */}
            {values && (
              <div className="space-y-2">
                <SaveFavoriteButton
                  values={values}
                  scenarioName={`algo:${philosophy}`}
                  algoPreset={currentPreset(values)}
                />
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">{t("exportResolution")}</label>
                  <select
                    value={exportPresetId}
                    onChange={(e) => setExportPresetId(e.target.value as ExportPresetId)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-2 py-1.5"
                  >
                    {EXPORT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={exportBusy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors text-sm disabled:opacity-50"
                >
                  {exportBusy ? t("exporting") : t("downloadPng")}
                </button>
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-zinc-400 shrink-0">{t("setCount")}</label>
                  <input
                    type="number"
                    min={4}
                    max={12}
                    value={setExportCount}
                    onChange={(e) => setSetExportCount(Number(e.target.value))}
                    className="w-16 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={handleExportSet}
                    disabled={exportBusy}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {t("exportSet")}
                  </button>
                </div>
                {philosophy === "flow-field" && supportsWebmExport() && (
                  <button
                    type="button"
                    onClick={handleExportVideo}
                    disabled={exportBusy}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {t("exportVideo")}
                  </button>
                )}
              </div>
            )}
          </aside>

          <div className="algo-art-main">
            <div className="w-full">
              <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
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
              <div className="w-full">
                <QRNGReveal values={values} className="max-w-none mx-0" />
              </div>
            )}

            <section
              className="w-full space-y-3"
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

export default function AlgorithmicPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <AlgorithmicPageInner />
    </Suspense>
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
