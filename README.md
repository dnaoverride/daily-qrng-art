# QRNG Art

Umetnost generisana iz kvantnog suma (ANU QRNG). Svaki dan nova slika — reproducibilna umetnost iz haosa.

1000 kvantno generisanih brojeva (0–65535) određuje sve: boju neba, broj zvezda, oblik planina, poziciju sunca ili meseca, oblake, drveće, vodu. Isti set brojeva uvek daje istu sliku.

**Napomena:** SVAKI update aplikacije mora se beležiti u [Changelog](#changelog). Izmene scenarija dodatno dokumentuj u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija).

---

## Kako radi

### Izbor scenarija

Prvih 4 broja se XOR-uje, rezultat se deli sa 8 i dobija se indeks scenarija (0–7). Time se postiže ravnomernija distribucija između scenarija.

```ts
const mix = (v0 ^ v1 ^ v2 ^ v3) >>> 0;
const scenarioIndex = mix % NUM_SCENARIOS;
```

### QRNGStream

[`src/lib/qrng.ts`](src/lib/qrng.ts) — klasa koja troši 1000 uint16 vrednosti i nudi:

- `next_u16()` — sledeći 16-bitni broj
- `next_f()` — float 0–1
- `next_int(a, b)` — ceo broj u rasponu [a, b]

Izvor: [ANU QRNG API](https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16). Fallback na `crypto.getRandomValues` ako API nije dostupan.

### Zajednički utilities

- [`src/lib/color.ts`](src/lib/color.ts) — `hslToRgb`, `rgbString`, tip `RGB`
- [`src/lib/draw-utils.ts`](src/lib/draw-utils.ts) — `ridgePoints` (smoothstep + octave noise za krive), `drawSunGlow` (slojevi glow-a za sunce/mesec)

---

## Scenariji (8)

| # | Naziv | Fajl | Opis |
|---|-------|------|------|
| 0 | Pejzaž | [landscape.ts](src/lib/landscape.ts) | sunrise/day/sunset/night, planine, oblaci, sunce/mesec |
| 1 | Plaža | [beach.ts](src/lib/scenarios/beach.ts) | plavo nebo, sunce, more, pesak (ridgePoints), palme |
| 2 | Zalazak | [ocean-sunset.ts](src/lib/scenarios/ocean-sunset.ts) | zalazak nad vodom, gradijent neba, refleks |
| 3 | Pustinja | [desert.ts](src/lib/scenarios/desert.ts) | toplo nebo, dune (ridgePoints), base sand fill |
| 4 | Noćni grad | [city-night.ts](src/lib/scenarios/city-night.ts) | tamno nebo, zvezde, mesec, zgrade-siluete, prozori |
| 5 | Kosmos | [cosmos.ts](src/lib/scenarios/cosmos.ts) | planete, zvezde (crtaju se pre planeta) |
| 6 | Šuma | [forest.ts](src/lib/scenarios/forest.ts) | dan/noć, drveće (stablo + krošnja), ptice/sove/šišmiši/veverica |
| 7 | Jezero | [lake.ts](src/lib/scenarios/lake.ts) | nebo, voda 2/3, brda-traka, refleks, ptice |

---

## Važne odluke i ispravke

### Pejzaž

- Nebo nikad zelena: avoidGreen za hue 85–165. Plava (day/night) ili narandžasto/crvenkasto (sunrise/sunset)
- Oblaci beli ili svetlo sivi
- Sunce uvek toplo (hue 25–60), ne plavo

### Plaža

- Nebo plavo (hue 200–240)
- More plavo-tirkiz gradijent

### Noćni grad

- Popunjavanje podloge ispod horizonta tamnom bojom (`fillRect`) da ne probija boja prethodnog scenarija (npr. zelena iz Šume)

### Šuma

- Svaka krošnja mora imati stablo koje se vidi i doseže do zemlje
- Drveće na različitim visinama (varijabilan baseY)
- Tlo zeleno (travnata podloga)
- Dan: ptice (1–4)
- Noć (25%): sove (1–2) ili šišmiši (1–3)
- Dan: opciono veverica (50% šansa)

### Pustinja

- Base sand fill pre crtanja dina da zelena iz prethodnog scenarija ne probija
- Dune oble (ridgePoints sa roughness, detailScale) — ne oštre/račvaste

### Kosmos

- Zvezde se crtaju pre planeta (da ostanu iza planeta)
- Planete: paleta od 6 tipova boja; jedan zajednički izvor svetla (sunce) — hotspot gradijenta usmeren prema suncu; tamnija noćna polutka (0.02 na ivici); prstenovi za veće planete (pr≥70)

### Jezero

- Horizont 1/3–2/3 (voda zauzima ~2/3 visine)
- Brda kao uska traka na horizontu, ne do dna slike
- Refleks sunca/meseca — jedan radijalni gradijent (meko), bez višestrukih kružnica
- Ptice u nebu
- Voda plava (waterHue 200–235); brda plava (hillHue 210–240), ne zelena

---

## Projektna struktura

```
src/
├── app/
│   ├── page.tsx              # Početna — današnji art
│   ├── create-art/page.tsx   # Playground — unesi 1000 brojeva
│   ├── art/[date]/page.tsx   # Art po datumu
│   ├── archive/page.tsx      # Arhiva
│   └── api/
│       ├── generate/route.ts # GET → ANU QRNG ili entropy fallback
│       └── art/[date]/route.ts
├── lib/
│   ├── qrng.ts, qrng-server.ts
│   ├── color.ts, draw-utils.ts, date.ts
│   ├── landscape.ts
│   └── scenarios/
│       ├── router.ts         # renderArt, NUM_SCENARIOS
│       ├── index.ts          # SCENARIO_NAMES
│       ├── beach.ts
│       ├── ocean-sunset.ts
│       ├── desert.ts
│       ├── city-night.ts
│       ├── cosmos.ts
│       ├── forest.ts
│       └── lake.ts
└── components/
    ├── ArtCanvas.tsx
    ├── Header.tsx
    ├── DailyArtSection.tsx
    ├── ArtPageContent.tsx
    ├── ArchiveThumbnail.tsx
    └── QRNGReveal.tsx
```

---

## Pokretanje

```bash
npm install
npm run dev   # http://localhost:9500
```

```bash
npm run build
npm start     # produkcija
```

---

## API

| Endpoint | Opis |
|----------|------|
| `GET /api/generate` | Vraća 1000 uint16 vrednosti (ANU QRNG ili crypto fallback) |
| `GET /api/art/[date]` | Vraća art za datum (YYYY-MM-DD) — `{ values: number[] }` |

---

## Changelog

Svaki update aplikacije se beleži ovde. Format: datum, scenarij/fajl, opis promene. **Detaljne izmene scenarija** vidi u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija).

### 2026-03-05

- **Pejzaž** — Nebo: ograničene hue vrednosti na prirodne (plava, siva, tople); nikad zelena (85–165). Dodata scena "day" (plavo nebo). Oblaci beli/svetlo sivi (240–255). Sunce uvek toplo (hue 25–60), ne plavo.
- **Pejzaž** — Halo oko meseca smanjen i diskretniji: manje slojeva (5), manji spread (0.06), niži alpha. (`drawSunGlow` dobio opcioni `glowSpread`.)
- **Plaža** — Nebo plavo (skyHue 200–240). More plavo-tirkiz gradijent.
- **Noćni grad** — Popunjavanje podloge ispod horizonta tamnom bojom pre zgrada (`fillRect`), da ne probija boja prethodnog scenarija.
- **Šuma** — Svaka krošnja mora imati stablo. Drveće na različitim visinama. Tlo zeleno (travnata podloga). Dan: ptice; noć: sove/šišmiši; dan: veverica (50%). Stablo braon, krošnja zelena.
- **Pustinja** — Base sand fill pre dina. Dune oble (ridgePoints detailScale 0.06, roughness 0.9). Prva dina prekriva horizont.
- **Kosmos** — Zvezde se crtaju pre planeta.
- **Kosmos** — Planete: planetarne boje, manje difuzan gradijent. Prstenovi: SVG pristup (back/front arc). Jedan zajednički izvor svetla (sunce): hotspot usmeren prema suncu, tamnija noćna polutka.
- **Jezero** — Horizont 1/3–2/3 (voda 2/3). Brda kao uska traka. Refleks: jedan radijalni gradijent (meko). Ptice. Voda i brda plave nijanse.
- **README** — Inicijalna dokumentacija. Pravilo: SVAKI update se beleži u Changelog.
- **Dokumentacija** — Izmene scenarija se beleže u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija), README referencira tu sekciju.
- **Kosmos** — Pozadina zatamnena. Šest različitih boja. Umanjeno sencenje, specular highlight ka suncu (svetla tačka 0.92).
- **Share / Open Graph** — `/api/og-image` renderuje pravu sliku dana (PNG). Obrisan opengraph-image.tsx (imao prednost nad metadata). og:image koristi apsolutni URL.

---

## Konfiguracija

- **REQUIRED_COUNT** — 1000 brojeva za generisanje
- **Canvas** — 1200×675 px
- **Datum** — timezone `Europe/Belgrade` (srpsko vreme)
- **Port** — 9500 (dev)
