# QRNG Art — Scenariji i efekti

Analiza svih scenarija: šta se može iscrtati, koji efekti postoje, parametri i varijacije.

---

## 1. Uvod

**QRNG Art** je generativna umetnost zasnovana na kvantno nasumičnim brojevima (QRNG). Projekat ima **8 scenarija**, svaki crta jedinstvenu kompoziciju pomoću Canvas 2D.

### Izbor scenarija

Scenarij se bira deterministički na osnovu prvih 4 uint16 vrednosti iz stream-a:

```
(v0 ^ v1 ^ v2 ^ v3) % 8  →  jednaka šansa (12.5%) za svaki scenarij
```

---

## 2. Deljeni primitivi i efekti

| Primitiv | Lokacija | Opis |
|----------|----------|------|
| `ridgePoints()` | [draw-utils.ts](src/lib/draw-utils.ts) | Kriva za brda/dune/plažu: anchor-based smoothstep + octave detalj, vraća `{x,y}[]` |
| `drawSunGlow()` | [draw-utils.ts](src/lib/draw-utils.ts) | Slojevi koncentričnih krugova za sunce/mesec (layers, alpha, glowSpread) |
| `hslToRgb`, `rgbString` | [color.ts](src/lib/color.ts) | HSL konverzija, RGB string za Canvas |

---

## 3. Tabela scenarija (pregled)

| # | Naziv | Fajl | Glavni elementi |
|---|-------|------|-----------------|
| 0 | Pejzaž | [landscape.ts](src/lib/landscape.ts) | nebo, brda, sunce/mesec, oblaci ili zvezde |
| 1 | Plaža | [beach.ts](src/lib/scenarios/beach.ts) | nebo, more, pesak, palme, talasi |
| 2 | Zalazak | [ocean-sunset.ts](src/lib/scenarios/ocean-sunset.ts) | zalazak neba (4 stopa), sunce na horizontu, refleks, talasi |
| 3 | Pustinja | [desert.ts](src/lib/scenarios/desert.ts) | toplo nebo, dune (4 sloja), sunce |
| 4 | Noćni grad | [city-night.ts](src/lib/scenarios/city-night.ts) | tamno nebo, zvezde, mesec, zgrade (siluete), prozori |
| 5 | Kosmos | [cosmos.ts](src/lib/scenarios/cosmos.ts) | zvezde, sunce, planete (3–7), prstenovi, sferični gradijent |
| 6 | Šuma | [forest.ts](src/lib/scenarios/forest.ts) | nebo, drveće (3 sloja), sunce/mesec, ptice/sova/šišmiš, light rays |
| 7 | Jezero | [lake.ts](src/lib/scenarios/lake.ts) | nebo, voda, refleks sunca, brda, ptice, talasi |

---

## 4. Detaljan pregled po scenariju

### 0. Pejzaž (`landscape.ts`)

- **Varijacije**: `sunrise` (25%), `day` (25%), `sunset` (25%), `night` (25%)
- **Redosled crtanja**: 1) nebo (3-stop linear gradient) → 2) zvezde (samo noć) → 3) tri sloja brda (ridgePoints) → 4) sunce/mesec (drawSunGlow) → 5) oblaci (samo dan)
- **Parametri**:
  - Brda: 3 sloja, amplitude ~160–70 po dubini, rough 0.55–0.7
  - Zvezde: 250–600, r 1–2px, svetlost 140–255
  - Oblaci: 6–14 oblaka, 6–14 blobova po oblaku
  - Sunce: pozicija (w×0.25–0.75, h×0.12–0.34), radius 50–120

---

### 1. Plaža (`beach.ts`)

- **Varijacije**: fiksno dnevno nebo, plava paleta
- **Redosled crtanja**: 1) nebo (3-stop gradient) → 2) sunce (drawSunGlow) → 3) more (3-stop gradient) → 4) talasi (8–16 elipsi, alpha 0.2–0.38) → 5) pesak (3 sloja ridgePoints) → 6) palme (2–5)
- **Parametri**:
  - Talasi: 8–16 elipsi, wa 70–180, wb 6–22
  - Pesak: amplitude ~14–26, rough 0.72–0.87
  - Palme: 2–5, trunk 80–160px, 6–10 peraja u ventilatoru
- **Posebnosti**: palme — trapezoidno deblo sa ringovima, drawPalmFronds (fan peraja)

---

### 2. Zalazak (`ocean-sunset.ts`)

- **Varijacije**: fiksno zalazak nad vodom
- **Redosled crtanja**: 1) nebo (4-stop gradient: toplo → ljubičasto → plavo → tamno) → 2) sunce na horizontu (drawSunGlow) → 3) voda (4-stop sa refleksom) → 4) talasi (5–12 ridgePoints stroke linija)
- **Parametri**:
  - Nebo: hue 15–35, 290–320, 250–270, 240
  - Talasi: amplitude 8–20, stroke rgba(255,255,255,0.4)
- **Posebnosti**: sunce tačno na Y=horizonY, jaki refleks u vodi (15% stopa)

---

### 3. Pustinja (`desert.ts`)

- **Varijacije**: fiksno toplo pustinjsko podne
- **Redosled crtanja**: 1) nebo (3-stop, toplo žuto/narandžasto/ružičasto) → 2) sunce (drawSunGlow) → 3) pesak (ravna podloga) → 4) dune (4 sloja ridgePoints)
- **Parametri**:
  - Dune: amplitude 45–80, rough 0.9, detailScale 0.06, anchorStep 60
  - Prva duna može da prelazi horizont (yBase = horizonY - 25 + 35)
  - Vegetacija (45% verovatnoće): 1–3 kaktusa (segmentirano) ili 1 palma (oaza)
- **Posebnosti**: 4 dune; opciono kaktusi/palme

---

### 4. Noćni grad (`city-night.ts`)

- **Varijacije**: fiksno noć
- **Redosled crtanja**: 1) nebo (2-stop tamno plavo) → 2) tlo → 3) zvezde (250–400) → 4) mesec (drawSunGlow) → 5) zgrade (siluete, 8–20) → 6) prozori (15–40 krugova unutar zgrada)
- **Parametri**:
  - Zgrade: širina 25–80, visina 20–70% h, razmak 5–25
  - Prozori: r 2–3px, žuto svetlo rgba(255,248,200,0.9)
- **Posebnosti**: zgrade kao pravougaonici, prozori nasumično unutar bounding box-a zgrada

---

### 5. Kosmos (`cosmos.ts`)

- **Varijacije**: paleta boja planeta (6 tipova: Mars, Jupiter, Zemlja/Neptun, Uran, siva, Venus)
- **Redosled crtanja**: 1) pozadina (2-stop tamno ljubičasto) → 2) zvezde (300–600) → 3) sunce (custom radial gradient + glow) → 4) za svaku planetu: prstenovi back pass → sfera → prstenovi front pass
- **Parametri**:
  - Planete: 3–7, radius 30–120, pozicija nasumična
  - Prstenovi: verovatnoća `pr<70 ? 0 : 0.25 + ((pr-70)/50)*0.35`, 4–7 eliptičnih prstenova
  - Sunce: pozicija w×0.15–0.85, h×0.1–0.4, r 8–18
- **Posebnosti**:
  - Jedinstveno sunce, svi planeti osvetljeni iz istog smera (hotspot usmeren ka suncu)
  - Prstenovi: occlusion — ellipse/circle presek, back arc (iza planete) i front arc (ispred)
  - `ellipseCircleIntersectionAngles(rx, ry, pr)` za uglove preseka elipse i kruga planete

---

### 6. Šuma (`forest.ts`)

- **Varijacije**: noć (25%) ili dan (75%); dan: plavo ili toplo nebo (50/50); noć: sova/šišmiš (50/50); dan: light rays; dan: eventualno srnjak (50%)
- **Redosled crtanja**: 1) nebo → 2) zvezde (noć) ili ptice (dan) ili sova/šišmiš (noć) → 3) sunce/mesec → 4) light rays (dan, 6–14) → 5) zemlja (3-stop gradient) → 6) drveće (3 sloja: 6–12, 8–14, 6–12) → 7) srnjak (dan, 50%)
- **Parametri**:
  - Drveće: 3 sloja dubine (scale 0.35, 0.65, 1.0); listopadno (65%) — sferični envelope; četinar (35%) — konusna krošnja
  - Ptice: 1–4, quadraticCurve za krila
  - Sova/šišmiš: 1–3, stroke stil
- **Posebnosti**: light rays kao linear gradient pruge; srnjak kao 2 elipse

---

### 7. Jezero (`lake.ts`)

- **Varijacije**: noć (30%) ili dan (70%)
- **Redosled crtanja**: 1) nebo (3-stop) → 2) ptice (2–6) → 3) sunce (drawSunGlow) → 4) voda (2-stop gradient) → 5) refleks sunca (elliptični radial gradient u vodi) → 6) brda (1–2 ridgePoints) → 7) talasi (2–4 šumne linije) → 8) obalsko drveće (1–4: samo listač)
- **Parametri**:
  - Refleks: reflexY = 2×horizonY - sunY, elliptičan (1.8×r × 0.5×r)
  - Talasi: ellipse-free, stroke linija sa šumom po Y
- **Posebnosti**: ogledalo neba u vodi, refleks sunca kao elipsa; obalsko drveće (samo listač, krošnja nagore) — rekurzivno grananje L-sistem ([tree-lsystem.ts](src/lib/tree-lsystem.ts))

---

## 5. Matrica: efekti po scenariju

| Efekat | Pejzaž | Plaža | Zalazak | Pustinja | Noćni grad | Kosmos | Šuma | Jezero |
|--------|--------|-------|---------|----------|------------|--------|------|--------|
| Linear gradient (nebo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Radial gradient | | | | | | ✓ (planete, sunce) | | ✓ (refleks) |
| drawSunGlow | ✓ | ✓ | ✓ | ✓ | ✓ (mesec) | (custom) | ✓ | ✓ |
| ridgePoints | ✓ | ✓ | ✓ | ✓ | | | | ✓ |
| Zvezde | ✓ (noć) | | | | ✓ | ✓ | ✓ (noć) | |
| Oblaci | ✓ (dan) | | | | | | | |
| Talasi | | ✓ | ✓ | | | | | ✓ |
| Ptice/životinje | | | | | | | ✓ | ✓ |
| Light rays | | | | | | | ✓ (dan) | |
| Prstenovi | | | | | | ✓ | | |

---

## 5a. Tipovi drveća/vegetacije po scenariju

Drveće i vegetacija prilagođeni scenariju (Weber model: fan fronds, Shape conical/spherical).

- **Plaža**: Palma — tapered deblo sa ringovima, fan peraja (6–10)
- **Šuma**: Listočad (65%) — sferična/elipsoidna krošnja (blobovi u envelope); Četinar (35%) — konusna krošnja (trougao/trapez)
- **Jezero**: Samo obalski listač — rekurzivno grananje nagore (L-system inspirisano)
- **Pustinja**: Kaktus (70% od vegetacije) — 2–4 segmenta; Palma (30%) — manja, tamnija (oaza)
- **Pejzaž, Zalazak, Grad, Kosmos**: bez drveća

---

## 6. Tehnički detalji

### QRNG stream

- `next_f()`: float [0, 1) iz uint16
- `next_int(a, b)`: ceo broj u [a, b] uključivo
- `next_u16()`: sirova uint16 vrednost
- Determinističnost: isti seed → ista slika

### Raspored crtanja (opšti princíp)

1. **Sky** — linear gradient, eventualno zvezde
2. **Sredina** — sunce/mesec, oblaci, light rays
3. **Foreground** — brda, objekti (palme, zgrade, drveće, planete)

### Kosmos — prstenovi

- Elipsa prstena presekana krugom planete: `ellipseCircleIntersectionAngles(rx, ry, pr)` računa uglove preseka
- **Back pass**: crtaju se samo delovi elipse iza planete (pre crtanja sfere)
- **Front pass**: crtaju se delovi ispred planete (posle sfere)
- Rezultat: prsteni realistično prelaze iza i ispred planete

---

## 7. Changelog scenarija

Izmene u scenarijima se beleže ovde. README.md referencira ovu sekciju.

| Datum | Scenarij | Izmena |
|-------|-----------|--------|
| 2026-03-05 | Pejzaž | Nebo: prirodne nijanse (plava, siva, tople); nikad zelena. Oblaci beli/svetlo sivi. Sunce toplo (hue 25–60). Halo meseca smanjen (5 slojeva, glowSpread 0.06). |
| 2026-03-05 | Plaža | Nebo plavo (skyHue 200–240). More plavo-tirkiz gradijent. |
| 2026-03-05 | Noćni grad | Popunjavanje podloge tamnom bojom pre zgrada da ne probija prethodni scenario. |
| 2026-03-05 | Šuma | Svaka krošnja ima stablo. Tlo zeleno. Ptice/sove/šišmiši/veverica. Stablo braon, krošnja zelena. |
| 2026-03-05 | Pustinja | Base sand fill pre dina. Dune oble (detailScale 0.06). Prva dina prekriva horizont. |
| 2026-03-05 | Kosmos | Zvezde pre planeta. Paleta 6 tipova boja. Jedinstveno sunce (hotspot usmeren prema njemu). Prstenovi: back/front arc za occlusion. Verovatnoća prstenova: pr≥70, 25–60%. |
| 2026-03-05 | Jezero | Horizont 1/3–2/3. Brda kao traka. Refleks meko (jedan gradijent). Ptice. Voda i brda plave nijanse. |
| 2026-03-05 | — | Dodata sekcija Changelog scenarija. README referencira SCENARIOS.md za detaljne izmene. |
| 2026-03-05 | Kosmos | Pozadina zatamnena (bgTop 0.045, bgBot 0.02) da se smanji kontrast sa senkama planeta. |
| 2026-03-05 | Kosmos | Jasnija granica planeta: tamna strana osvetljena (0.055 umesto 0.02), tanka obrisna linija (1px stroke). |
| 2026-03-05 | Kosmos | Boje: šest jasno različitih tipova (Mars, Jupiter, Zemlja, Uran, siva, Venus), bez preklapanja hue. Gradijent čuva saturaciju. Obris 2px, lightness 0.14. |
| 2026-03-05 | Kosmos | Sencenje umanjeno (shadow 0.32 umesto 0.06). Specular highlight ka suncu: svetla tačka (0.92) na poziciji usmerenoj ka izvoru svetlosti. |
| 2026-03-05 | Kosmos | Specular omekšan: peak 0.84, širi prelaz (stop 0.06, 0.18), mekši falloff. |
| 2026-03-05 | Kosmos | Specular vrh smanjen na 0.64. |
| 2026-03-05 | Pejzaž | Nebo uvek plavo. Sneg: crna ivica samo gde ima snega. Planine: zelene (90%, sat 0.4, svetlije) ili tamno sive (10%). |
| 2026-03-05 | Plaža | Palme: peraje u ventilatoru (6–10), drawPalmFronds; deblo sa ringovima. |
| 2026-03-05 | Šuma | Drveće: listopadno (65%) sferično, četinar (35%) konusno. |
| 2026-03-05 | Jezero | Obalsko drveće (1–4): vrba (weeping) ili listač. |
| 2026-03-05 | Pustinja | Vegetacija (45%): kaktusi (1–3) ili palma (oaza). |
| 2026-03-05 | — | Sekcija 5a Tipovi drveća po scenariju. |
| 2026-03-05 | Plaža | Palma peraje povećane 40–55% (lenBase 56–108, width 6–11). |
| 2026-03-05 | Šuma | Deblo se crta POSLE krošnje — uvek vidljivo (fix: krošnja ne prekriva deblo). |
| 2026-03-05 | Svi | Sunce/mesec: konzistentna veličina (sun 22–36 px, moon 14–26 px) na svim scenarijima. |
| 2026-03-05 | Jezero | Deblo obalskog drveća crta se posle krošnje — uvek vidljivo. |
| 2026-03-05 | Jezero | Vrba: 10–18 grana (bilo 5–11), debljina 2.5–4.5 px, duže grane. Listač: sferična krošnja od 5–10 blobova (kao Šuma). |
| 2026-03-05 | Jezero | Vrba i listač: rekurzivno grananje (L-system inspirisano) — tree-lsystem.ts, drawRecursiveBranch, fractal-like struktura. |
| 2026-03-05 | Jezero | Uklonjena vrba — samo listač (grane nagore), stil kao zeleno zaokruženo. |
| 2026-03-05 | Šuma | Fix: crownBaseY = trunkTopY + overlap (bor ne visi); sva debla crtana posle svih krošnji u sloju. |
| 2026-03-05 | Šuma | Fix: sva debla crtana posle SVIH krošnji (svi slojevi) — nijedna krošnja ne prekriva deblo. Veverica: dve crne tačkice kao oči. |
| 2026-03-05 | Šuma | Fix: painter's algorithm — svako drvo (krošnja+deblo) crta se kao celina, slojevi unazad; prednje drveće pravilno prekriva zadnje. |
| 2026-03-05 | Šuma | Fix: sva drveća sortiraju se po baseY (dubina) pa se crtaju — prednje (niže na platnu) prekrivaju zadnje. |
| 2026-03-05 | Šuma | Fix: nebo uvek plavo ili crvenkasto (zalazak); uklonjena zelena nijansa neba (accentHue 65–100). |

**Pravilo:** Pri svakoj izmeni scenarija dodati red u ovu tabelu (datum, scenarij, kratak opis).
