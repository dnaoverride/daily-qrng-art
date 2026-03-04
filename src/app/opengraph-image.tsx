import { ImageResponse } from "next/og";
import { seedFromDate } from "@/lib/qrng-server";
import { QRNGStream } from "@/lib/qrng";

export const alt = "QRNG Art — umetnost iz kvantnog suma";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${h % 360}, ${s * 100}%, ${l * 100}%)`;
}

export default async function Image() {
  const today = new Date()
    .toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "-");

  const values = seedFromDate(today);
  const stream = new QRNGStream(values);

  const sceneRoll = stream.next_f();
  const scene =
    sceneRoll < 0.34 ? "sunrise" : sceneRoll < 0.67 ? "sunset" : "night";
  const baseHue = stream.next_int(0, 359);
  const accentHue = (baseHue + stream.next_int(90, 210)) % 360;

  let topColor: string;
  let bottomColor: string;
  const warmShift = scene === "night" ? 0 : scene === "sunrise" ? 25 : 45;

  if (scene === "night") {
    topColor = hslToCss(baseHue, 0.45, 0.12);
    bottomColor = hslToCss((baseHue + 30) % 360, 0.55, 0.18);
  } else {
    topColor = hslToCss((baseHue + warmShift) % 360, 0.55, scene === "sunrise" ? 0.55 : 0.5);
    bottomColor = hslToCss((accentHue + warmShift * 2) % 360, 0.75, 0.4);
  }

  const sceneLabel =
    scene === "sunrise" ? "Sunrise" : scene === "sunset" ? "Sunset" : "Night";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(to bottom, ${topColor}, ${bottomColor})`,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 80,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "white",
            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
            marginBottom: 8,
          }}
        >
          QRNG Art
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 4,
          }}
        >
          Art of the Day · {today}
        </div>
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {sceneLabel} · umetnost iz kvantnog suma
        </div>
      </div>
    ),
    { ...size }
  );
}
