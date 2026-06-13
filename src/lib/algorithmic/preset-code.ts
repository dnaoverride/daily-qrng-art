import type { AlgoParams, PhilosophyId } from "./types";

export const PRESET_VERSION = 1 as const;
export const PRESET_PREFIX = "QAL1.";

export interface AlgoPreset {
  version: typeof PRESET_VERSION;
  philosophy: PhilosophyId;
  params: AlgoParams;
  values: number[];
  seedHint: number;
  valuesHash: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function hashValues(values: number[]): string {
  let h = 2166136261;
  for (let i = 0; i < values.length; i++) {
    h ^= values[i]! & 0xffff;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildPreset(
  philosophy: PhilosophyId,
  params: AlgoParams,
  values: number[]
): AlgoPreset {
  return {
    version: PRESET_VERSION,
    philosophy,
    params,
    values,
    seedHint: values[0] ?? 0,
    valuesHash: hashValues(values),
  };
}

export function encodePreset(preset: AlgoPreset): string {
  const json = JSON.stringify(preset);
  const bytes = new TextEncoder().encode(json);
  return PRESET_PREFIX + toBase64Url(bytes);
}

export function decodePreset(code: string): AlgoPreset | null {
  const trimmed = code.trim();
  const raw = trimmed.startsWith(PRESET_PREFIX)
    ? trimmed.slice(PRESET_PREFIX.length)
    : trimmed;
  if (!raw) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(raw));
    const parsed = JSON.parse(json) as AlgoPreset;
    if (parsed.version !== PRESET_VERSION) return null;
    if (!parsed.philosophy || !parsed.params) return null;
    if (!Array.isArray(parsed.values) || parsed.values.length !== 1000) return null;
    if (parsed.valuesHash && hashValues(parsed.values) !== parsed.valuesHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function presetShareUrl(preset: AlgoPreset, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const code = encodeURIComponent(encodePreset(preset));
  return `${base}/algorithmic?code=${code}`;
}
