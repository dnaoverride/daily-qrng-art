"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArtCanvas } from "@/components/ArtCanvas";
import { QRNGReveal } from "@/components/QRNGReveal";
import { SaveFavoriteButton } from "@/components/SaveFavoriteButton";
import { NUM_SCENARIOS_V2, scenarioIndexFor, type RenderResult } from "@/lib/scenarios";
import { SCENE_CONTROLS, type SceneControls as Controls } from "@/lib/scenarios/controls-registry";
import { decodeControls, encodeControls } from "@/lib/scenarios/controls";
import { getTodayBelgrade } from "@/lib/date";
import { currentRenderVersion, renderVersionForTimestamp, type RenderVersion } from "@/lib/render-version";
import { PHILOSOPHIES, type AlgoParams, type PhilosophyId } from "@/lib/algorithmic/types";
import { buildPreset, decodePreset, encodePreset, type AlgoPreset } from "@/lib/algorithmic/preset-code";
import { encodeFavoriteScene, parseFavoriteScene, parseFavoriteScenarioToPhilosophyId } from "@/lib/algorithmic/scenario-name";
import { randomizeParams } from "@/lib/algorithmic/randomize-params";
import { EXPORT_PRESETS, exportAlgorithmicPng, type ExportPresetId } from "@/lib/algorithmic/export-png";
import { exportVariationSetZip } from "@/lib/algorithmic/export-set";
import { exportFlowFieldWebm, supportsWebmExport } from "@/lib/algorithmic/export-video";
import { AbstractCanvas } from "./AbstractCanvas";
import { AbstractControls } from "./AbstractControls";
import { SceneControls } from "./SceneControls";
import { StudioSheet } from "./StudioSheet";
import { StudioThumb } from "./StudioThumb";
import { DEFAULT_ALGO_PARAMS, itemKey, type StudioItem } from "./thumb-render";

const REQUIRED_COUNT = 1000;

type Mode = "scene" | "abstract";

const SCENE_ITEMS: StudioItem[] = [
  { kind: "scene", scenario: null },
  ...Array.from({ length: NUM_SCENARIOS_V2 }, (_, i) => ({ kind: "scene" as const, scenario: i })),
];
const ABSTRACT_ITEMS: StudioItem[] = PHILOSOPHIES.map((p) => ({ kind: "abstract" as const, id: p.id }));
/** Priča o algoritmu (isti tekstovi kao u starom /algorithmic). */
const STORY_KEY: Record<PhilosophyId, string> = {
  "flow-field": "storyFlowField",
  wave: "storyWave",
  voronoi: "storyVoronoi",
  "l-system": "storyLSystem",
  "cellular-automata": "storyCellular",
  truchet: "storyTruchet",
  julia: "storyJulia",
  newton: "storyNewton",
  apollonian: "storyApollonian",
};
const LABEL_KEY = Object.fromEntries(PHILOSOPHIES.map((p) => [p.id, p.labelKey])) as Record<PhilosophyId, string>;

function parseValues(text: string): number[] | null {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== REQUIRED_COUNT) return null;
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    out.push((n >>> 0) & 0xffff);
  }
  return out;
}

function parseScene(s: string | null): number | null {
  if (s === null || s === "auto") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n < NUM_SCENARIOS_V2 ? n : null;
}

function parseAbstract(a: string | null): PhilosophyId {
  return PHILOSOPHIES.find((p) => p.id === a)?.id ?? PHILOSOPHIES[0]!.id;
}

/** 1000 brojeva ↔ base64url (za deljeni link scene). */
function encodeValues(v: number[]): string {
  const bytes = new Uint8Array(v.length * 2);
  v.forEach((n, i) => {
    bytes[i * 2] = n & 0xff;
    bytes[i * 2 + 1] = (n >> 8) & 0xff;
  });
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeValues(s: string | null): number[] | null {
  if (!s) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    if (bin.length !== REQUIRED_COUNT * 2) return null;
    return Array.from({ length: REQUIRED_COUNT }, (_, i) => bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8));
  } catch {
    return null;
  }
}

async function fetchValues(url: string): Promise<number[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { values?: unknown };
  if (!Array.isArray(data.values) || data.values.length !== REQUIRED_COUNT) throw new Error("bad");
  return data.values as number[];
}

export function Studio() {
  const t = useTranslations("studio");
  const tScenario = useTranslations("scenario");
  const tAlgo = useTranslations("algorithmic");
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "abstract" ? "abstract" : "scene");
  const [scene, setScene] = useState<number | null>(parseScene(params.get("s")));
  const [abstract, setAbstract] = useState<PhilosophyId>(parseAbstract(params.get("a")));
  const [values, setValues] = useState<number[] | null>(null);
  const [drawId, setDrawId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [input, setInput] = useState("");
  // Kontrole scene po izboru u traci ("auto" ili indeks scene)
  const [sceneCtl, setSceneCtl] = useState<Record<string, Controls>>(() => ({
    [String(parseScene(params.get("s")) ?? "auto")]: decodeControls(params.get("c")),
  }));
  const [naturals, setNaturals] = useState<Record<string, boolean | number>>({});
  const [absParams, setAbsParams] = useState<Record<PhilosophyId, AlgoParams>>(() => ({ ...DEFAULT_ALGO_PARAMS }));
  const [lockPhilosophy, setLockPhilosophy] = useState(true);
  const [lockPalette, setLockPalette] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [exportPresetId, setExportPresetId] = useState<ExportPresetId>("hd");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const randomizeTick = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Stari favorit nastao pre v2 (bez ručne scene) crta se starim rendererom, kao u profilu.
  const [legacyVersion, setLegacyVersion] = useState<RenderVersion | null>(null);

  const show = useCallback((vals: number[]) => {
    setLegacyVersion(null);
    setValues(vals);
    setInput(vals.join(", "));
    setDrawId((d) => d + 1);
    // „Kvantni izbor" može postati druga scena → njegove kontrole više ne važe
    setSceneCtl((m) => ({ ...m, auto: {} }));
  }, []);

  const load = useCallback(
    async (url: string, errKey: "errorDraw" | "errorToday") => {
      setError(null);
      setLoading(true);
      try {
        show(await fetchValues(url));
      } catch {
        setError(t(errKey));
      } finally {
        setLoading(false);
      }
    },
    [show, t]
  );

  const handleDraw = () => load("/api/generate", "errorDraw");
  const handleToday = () => load(`/api/art/${getTodayBelgrade()}`, "errorToday");
  const handlePaste = () => {
    const parsed = parseValues(input);
    if (!parsed) {
      setError(t("errorPaste"));
      return;
    }
    setError(null);
    setPasteOpen(false);
    show(parsed);
  };

  // Omiljena slika (`?favorite=<id>`): brojevi + scena/kontrole ili apstrakcija/parametri.
  const loadFavorite = useCallback(
    async (id: string) => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/favorites/${encodeURIComponent(id)}`);
        const data = (await res.json()) as {
          favorite?: { values?: unknown; scenarioName?: string | null; algoPreset?: unknown; createdAt?: string };
        };
        const fav = data.favorite;
        const raw = fav?.values;
        const vals = Array.isArray(raw) ? raw : typeof raw === "string" ? (JSON.parse(raw) as unknown[]) : [];
        if (!res.ok || !fav || vals.length !== REQUIRED_COUNT) throw new Error("bad");
        const numbers = vals.map((n) => (Number(n) >>> 0) & 0xffff);

        setLegacyVersion(null);
        const preset = fav.algoPreset as AlgoPreset | null | undefined;
        const pid = preset?.philosophy ?? parseFavoriteScenarioToPhilosophyId(fav.scenarioName);
        if (pid) {
          setMode("abstract");
          setAbstract(pid);
          if (preset?.philosophy && preset.params) setAbsParams((m) => ({ ...m, [pid]: preset.params }));
        } else {
          const sc = parseFavoriteScene(fav.scenarioName);
          setMode("scene");
          setScene(sc?.scenario ?? null);
          setSceneCtl(sc ? { [String(sc.scenario)]: sc.controls } : {});
          if (!sc && fav.createdAt && renderVersionForTimestamp(fav.createdAt) === 1) setLegacyVersion(1);
        }
        setValues(numbers);
        setInput(numbers.join(", "));
        setDrawId((d) => d + 1);
      } catch {
        // Umesto favorita današnja slika, ali poruka ostaje (load briše grešku na početku).
        await load(`/api/art/${getTodayBelgrade()}`, "errorToday");
        setError(t("errorFavorite"));
      } finally {
        setLoading(false);
      }
    },
    [load, t]
  );

  // Prvi prikaz: omiljena slika, deljeni link (preset kod ili brojevi) ili današnji brojevi.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const favoriteId = params.get("favorite");
    if (favoriteId) {
      void loadFavorite(favoriteId);
      return;
    }
    const preset = params.get("code") ? decodePreset(params.get("code")!) : null;
    if (preset) {
      setMode("abstract");
      setAbstract(preset.philosophy);
      setAbsParams((m) => ({ ...m, [preset.philosophy]: preset.params }));
      setValues(preset.values);
      setInput(preset.values.join(", "));
      setDrawId((d) => d + 1);
      return;
    }
    const shared = decodeValues(params.get("v"));
    if (shared) {
      setValues(shared);
      setInput(shared.join(", "));
      setDrawId((d) => d + 1);
      return;
    }
    void load(`/api/art/${getTodayBelgrade()}`, "errorToday");
  }, [load, loadFavorite, params]);

  const ctlKey = String(scene ?? "auto");
  const controls = useMemo(() => sceneCtl[ctlKey] ?? {}, [sceneCtl, ctlKey]);
  const setControls = (update: (prev: Controls) => Controls) =>
    setSceneCtl((m) => ({ ...m, [ctlKey]: update(m[ctlKey] ?? {}) }));

  // Stanje u URL-u (bez brojeva — oni idu samo u „Kopiraj link").
  useEffect(() => {
    const q = new URLSearchParams();
    q.set("mode", mode);
    if (mode === "scene") {
      q.set("s", scene === null ? "auto" : String(scene));
      const c = encodeControls(controls);
      if (c) q.set("c", c);
    } else q.set("a", abstract);
    router.replace(`/studio?${q.toString()}`, { scroll: false });
  }, [mode, scene, abstract, controls, router]);

  const items = mode === "scene" ? SCENE_ITEMS : ABSTRACT_ITEMS;
  // v1 važi samo za „Kvantni izbor" starog favorita; ručna scena i kontrole su v2.
  const legacy = mode === "scene" && scene === null && legacyVersion === 1;
  const autoScene = values ? scenarioIndexFor(values, legacy ? 1 : currentRenderVersion()) : null;
  const effScene = scene ?? autoScene;
  const defs = !legacy && effScene !== null ? (SCENE_CONTROLS[effScene] ?? []) : [];
  const params0 = absParams[abstract];

  const onRendered = useCallback((r: RenderResult) => setNaturals(r.naturals), []);
  const onCanvasReady = useCallback((c: HTMLCanvasElement | null) => {
    canvasRef.current = c;
  }, []);

  const labelFor = (item: StudioItem): string => {
    if (item.kind === "abstract") return tAlgo(LABEL_KEY[item.id]);
    if (item.scenario === null) return `⚛ ${t("auto")}`;
    return tScenario(`s${item.scenario}`);
  };

  const isActive = (item: StudioItem): boolean =>
    item.kind === "scene" ? mode === "scene" && item.scenario === scene : mode === "abstract" && item.id === abstract;

  const select = (item: StudioItem) => {
    if (item.kind === "scene") setScene(item.scenario);
    else setAbstract(item.id);
  };

  const caption =
    mode === "abstract"
      ? tAlgo(LABEL_KEY[abstract])
      : scene === null
        ? `⚛ ${t("auto")}${autoScene !== null ? ` · ${tScenario(`s${autoScene}`)}` : ""}`
        : tScenario(`s${scene}`);

  /* ───────────── Akcije ───────────── */

  const handleRandomizeStyle = () => {
    if (!values) return;
    randomizeTick.current += 1;
    const r = randomizeParams({
      keepPhilosophy: lockPhilosophy,
      keepPalette: lockPalette,
      currentPhilosophy: abstract,
      currentParams: params0,
      values,
      tick: randomizeTick.current,
    });
    setAbsParams((m) => ({ ...m, [r.philosophy]: r.params }));
    setAbstract(r.philosophy);
  };

  const handlePng = async () => {
    if (!values) return;
    setBusy(true);
    try {
      if (mode === "abstract") {
        await exportAlgorithmicPng(abstract, values, params0, exportPresetId, `qrng-studio-${abstract}-${exportPresetId}.png`);
      } else if (canvasRef.current) {
        const a = document.createElement("a");
        a.href = canvasRef.current.toDataURL("image/png");
        a.download = `qrng-studio-${effScene ?? "scene"}-${Date.now()}.png`;
        a.click();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSet = async () => {
    if (!values) return;
    setBusy(true);
    try {
      const p = EXPORT_PRESETS.find((x) => x.id === exportPresetId) ?? EXPORT_PRESETS[0];
      await exportVariationSetZip(abstract, values, params0, 6, p.width, p.height, `qrng-set-${abstract}.zip`);
    } finally {
      setBusy(false);
    }
  };

  const handleVideo = async () => {
    if (!values || abstract !== "flow-field") return;
    setBusy(true);
    try {
      await exportFlowFieldWebm({
        values,
        params: params0 as Parameters<typeof exportFlowFieldWebm>[0]["params"],
        width: 1200,
        height: 675,
        fps: 30,
        loopSeconds: 4,
        filename: "qrng-flow-field-loop.webm",
      });
    } catch {
      setError(tAlgo("errorVideoExport"));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!values) return;
    const q = new URLSearchParams();
    q.set("mode", mode);
    if (mode === "abstract") {
      q.set("a", abstract);
      q.set("code", encodePreset(buildPreset(abstract, params0, values)));
    } else {
      q.set("s", scene === null ? "auto" : String(scene));
      const c = encodeControls(controls);
      if (c) q.set("c", c);
      q.set("v", encodeValues(values));
    }
    const url = `${window.location.origin}/studio?${q.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t("copyLink"), url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ───────────── Delovi UI-ja ───────────── */

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 active:bg-violet-700 transition-colors disabled:opacity-60";
  const btnSecondary =
    "inline-flex items-center justify-center min-h-11 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

  const pastePanel = (
    <div className="space-y-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("pastePlaceholder")}
        rows={5}
        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      <button type="button" onClick={handlePaste} className={`${btnSecondary} w-full`}>
        {t("pasteApply")}
      </button>
    </div>
  );

  const controlsPanel =
    mode === "scene" ? (
      legacy ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("legacyNote")}</p>
      ) : (
        defs.length > 0 && <SceneControls defs={defs} controls={controls} naturals={naturals} onChange={setControls} />
      )
    ) : (
      <AbstractControls
        id={abstract}
        params={params0}
        onChange={(p) => setAbsParams((m) => ({ ...m, [abstract]: p }))}
        onRandomize={handleRandomizeStyle}
        lockPhilosophy={lockPhilosophy}
        lockPalette={lockPalette}
        onLockPhilosophy={setLockPhilosophy}
        onLockPalette={setLockPalette}
        animate={animate}
        onAnimate={setAnimate}
      />
    );

  const exportPanel = values && (
    <div className="space-y-2">
      {mode === "abstract" && (
        <select
          value={exportPresetId}
          onChange={(e) => setExportPresetId(e.target.value as ExportPresetId)}
          aria-label={tAlgo("exportResolution")}
          className="w-full min-h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100"
        >
          {EXPORT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={handlePng} disabled={busy} className={btnSecondary}>
          {busy ? tAlgo("exporting") : `↓ ${t("downloadPng")}`}
        </button>
        <button type="button" onClick={handleCopyLink} className={btnSecondary}>
          {copied ? t("linkCopied") : t("copyLink")}
        </button>
      </div>
      {mode === "abstract" && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={handleSet} disabled={busy} className={btnSecondary}>
            {tAlgo("exportSet")}
          </button>
          {abstract === "flow-field" && supportsWebmExport() && (
            <button type="button" onClick={handleVideo} disabled={busy} className={btnSecondary}>
              {tAlgo("exportVideo")}
            </button>
          )}
        </div>
      )}
      <SaveFavoriteButton
        values={values}
        scenarioName={
          mode === "abstract"
            ? `algo:${abstract}`
            : effScene !== null
              ? encodeFavoriteScene(effScene, controls, scene !== null)
              : null
        }
        algoPreset={mode === "abstract" ? buildPreset(abstract, params0, values) : undefined}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-20 pb-32 md:pb-16 px-4 max-w-6xl xl:max-w-[110rem] mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center">{t("title")}</h1>
        <p className="text-center text-sm text-zinc-500 mt-1 mb-6 md:mb-5">{t("subtitle")}</p>

        <div className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_19rem] md:gap-8 md:items-start">
          {/* Desktop: akcije i izvoz levo (kontrole levo do 1280px, iznad toga u desnoj koloni) */}
          <aside className="studio-scroll hidden md:flex flex-col gap-5 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:pr-1">
            <div className="flex flex-col gap-2">
              <button type="button" onClick={handleDraw} disabled={loading} className={btnPrimary}>
                <span aria-hidden>⚛</span> {loading ? t("drawing") : t("draw")}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleToday} disabled={loading} className={btnSecondary}>
                  {t("today")}
                </button>
                <button
                  type="button"
                  onClick={() => setPasteOpen((o) => !o)}
                  aria-expanded={pasteOpen}
                  className={`${btnSecondary} px-2 text-sm`}
                >
                  {t("paste")}
                </button>
              </div>
              {pasteOpen && pastePanel}
            </div>
            {values && (
              <section className="space-y-3 xl:hidden">
                <h2 className={sectionTitle}>{mode === "scene" ? t("controls") : t("controlsAbstract")}</h2>
                {controlsPanel}
              </section>
            )}
            {values && (
              <section className="space-y-3">
                <h2 className={sectionTitle}>{t("share")}</h2>
                {exportPanel}
              </section>
            )}
          </aside>

          <section className="min-w-0">
            {/* Glavna slika */}
            <div key={drawId} className={`relative ${values ? "studio-reveal" : ""}`}>
              {values ? (
                mode === "scene" ? (
                  <ArtCanvas
                    values={values}
                    canvasClassName="max-w-none"
                    renderVersion={legacy ? 1 : undefined}
                    scenario={scene ?? undefined}
                    controls={legacy ? undefined : controls}
                    onRendered={onRendered}
                    onCanvasReady={onCanvasReady}
                  />
                ) : (
                  <AbstractCanvas
                    values={values}
                    id={abstract}
                    params={params0}
                    animate={animate}
                    onCanvasReady={onCanvasReady}
                  />
                )
              ) : (
                <div className="studio-shimmer aspect-video w-full rounded-lg" aria-hidden />
              )}
            </div>
            {/* Ime slike + prekidač Scene | Apstrakcija (desktop: u istom redu) */}
            <div className="md:mt-3 md:flex md:items-center md:justify-between md:gap-4">
              <p className="mt-2 md:mt-0 min-w-0 truncate text-center md:text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {values ? caption : " "}
              </p>
              <div role="tablist" className="mt-5 md:mt-0 mx-auto md:mx-0 flex w-fit shrink-0 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70 p-1">
                {(["scene", "abstract"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`min-h-9 px-4 rounded-md text-sm font-medium transition-colors ${
                      mode === m
                        ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {m === "scene" ? t("modeScene") : t("modeAbstract")}
                    <span className="ml-1.5 text-xs opacity-60">
                      {m === "scene" ? SCENE_ITEMS.length : ABSTRACT_ITEMS.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Traka sličica — swipe na telefonu */}
            <div className="mt-3 -mx-4 md:mx-0">
              {/* telefon: swipe traka; desktop: mreža bez skrolovanja */}
              <div className="studio-strip flex gap-2 overflow-x-auto snap-x snap-mandatory px-4 pt-1 pb-2 md:grid md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 md:overflow-visible md:snap-none md:px-0 md:pb-0">
                {values &&
                  items.map((item, i) => (
                    <StudioThumb
                      key={itemKey(item)}
                      values={values}
                      item={item}
                      label={labelFor(item)}
                      active={isActive(item)}
                      index={i}
                      onSelect={() => select(item)}
                    />
                  ))}
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            {/* Telefon: polje za brojeve ispod trake */}
            {pasteOpen && <div className="mt-4 md:hidden">{pastePanel}</div>}

            {values && (
              <div className="mt-6">
                <QRNGReveal values={values} className="max-w-none mx-0" />
              </div>
            )}

            {/* Priča o algoritmu (iz starog /algorithmic) */}
            {mode === "abstract" && (
              <section className="mt-6 space-y-3" aria-labelledby="studio-story-heading">
                <h2 id="studio-story-heading" className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">
                  {tAlgo("storyTitle")}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed">{tAlgo("storyIntro")}</p>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4">
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-400/90 mb-2">{tAlgo(LABEL_KEY[abstract])}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{tAlgo(STORY_KEY[abstract])}</p>
                </div>
              </section>
            )}
          </section>

          {/* Široki ekran: kontrole u desnoj koloni, uz sliku */}
          {values && (
            <aside className="studio-scroll hidden xl:flex flex-col gap-3 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <h2 className={sectionTitle}>{mode === "scene" ? t("controls") : t("controlsAbstract")}</h2>
              {controlsPanel}
            </aside>
          )}
        </div>
      </main>

      {/* Telefon: panel kontrola i izvoza */}
      <StudioSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={mode === "scene" ? t("controls") : t("controlsAbstract")}
        closeLabel={t("sheetClose")}
      >
        <div className="space-y-6">
          {controlsPanel}
          {exportPanel}
        </div>
      </StudioSheet>

      {/* Telefon: akciona traka na dnu */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-2">
          <button type="button" onClick={handleDraw} disabled={loading} className={`${btnPrimary} flex-1`}>
            <span aria-hidden>⚛</span> {loading ? t("drawing") : t("draw")}
          </button>
          <button type="button" onClick={handleToday} disabled={loading} className={btnSecondary}>
            {t("today")}
          </button>
          <button
            type="button"
            onClick={() => {
              // glavna slika u vidno polje, iznad panela
              window.scrollTo({ top: 0, behavior: "smooth" });
              setSheetOpen(true);
            }}
            disabled={!values}
            aria-label={mode === "scene" ? t("controls") : t("controlsAbstract")}
            className={`${btnSecondary} px-3 relative`}
          >
            <span aria-hidden>⚙</span>
            {mode === "scene" && Object.keys(controls).length > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen((o) => !o)}
            aria-expanded={pasteOpen}
            aria-label={t("paste")}
            className={`${btnSecondary} px-3`}
          >
            <span aria-hidden>⋯</span>
          </button>
        </div>
      </div>
    </div>
  );
}
