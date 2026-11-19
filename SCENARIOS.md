# QRNG Art — Scenariji i efekti

Analiza svih scenarija: šta se može iscrtati, koji efekti postoje, parametri i varijacije.

---

## 1. Uvod

**QRNG Art** je generativna umetnost zasnovana na kvantno nasumičnim brojevima (QRNG). Projekat ima **8 scenarija**, svaki crta jedinstvenu kompoziciju pomoću Canvas 2D.

### Verzije renderera

Od 2026-11-19 postoje dve verzije: **v1** (zamrznuta, `src/lib/scenarios/v1/`, sve slike pre `RENDER_V2_FROM`) i **v2** (aktivna, `src/lib/scenarios/*.ts`). Opisi u ovom dokumentu važe za v2; v1 je stanje od 2026-11-18. Detalji u [README](README.md#verzionisanje-renderera-render-v1--v2).

### Rarity hook-ovi (v2)

Svaki v2 scenario mora pozvati `hooks.sky({ horizonY, light })` odmah posle neba i `hooks.body({ x, y, r, kind })` posle sunca/meseca. `light`: pejzaž po sceni (sunrise/sunset = dusk), plaža i pustinja = day, šuma = day/dusk/night, jezero = day/night, zalazak = dusk (plavi sat = night), noćni grad = night, kosmos = night bez horizonta.

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

### 1. Plaža (`beach.ts`) — v2

> v1 (do `RENDER_V2_FROM`): plavo nebo, sunce, more sa elipsama-talasima, 3 sloja peska (ridgePoints), 2–5 palmi sa trapezoidnim deblom i ventilatorom od trouglastih peraja. Zamrznut u `scenarios/v1/beach.ts`.

- **Varijacije**: 6 paleta — tropical-noon, lagoon, sunset-beach, pastel-morning, moonlit, overcast; hue ±8
- **Redosled crtanja**: 1) nebo → 2) zvezde (noć) → (hooks.sky) → 3) sunce/mesec → (hooks.body) → 4) kumulusi → 5) more (dubina → plićina) → 6) staza odsjaja → 7) ostrvo / jedrilica → 8) linije talasa → 9) plićina uz obalu → 10) mokar + suv pesak → 11) pena + mehurići → 12) tekstura peska, školjke, morske zvezde → 13) suncobran → 14) palme → 15) galebovi
- **Parametri**:
  - Horizont: h × 0.40–0.52; obala levo/desno horizont + (h−horizont) × 0.35–0.70, krivina ±30 × s
  - Sunce: x = w × 0.15–0.85, r = 24–44 × s (mesec 16–28 × s)
  - Oblaci: 0–8 × količina palete, širina 90–310 × s (overcast 1.6×)
  - Palme: 1–4, visina (h−horizont) × 0.65–1.0 + 0–120 × s (krošnja u kadru), 7–11 listova × 26 lisaka
  - Detalji: ostrvo 35%, jedrilica 25%, suncobran 20%, 0–4 školjke/zvezde, galebovi 45%
- **Posebnosti**: strana svetla prati sunce; QRNG za odluke, `prngFromStream` za detalje

---

### 2. Zalazak (`ocean-sunset.ts`) — v2

> v1 (do `RENDER_V2_FROM`): fiksni 4-stop gradijent (hue 15–35 / 290–320 / 250–270 / 240), sunce uvek na horizontu, fiksna voda, 5–12 linija talasa. Zamrznut u `scenarios/v1/ocean-sunset.ts`.

- **Varijacije**: 8 paleta — classic, golden, pastel, crimson, tropical, lilac, smoky-amber, blue-hour (sunce ispod horizonta + zvezde); hue ±8, lightness ±0.04
- **Redosled crtanja**: 1) nebo (4 stopa iz palete) → 2) zvezde (samo blue-hour) → 3) sunce: radijalni sjaj (9–14 r) + jezgro sa gradijentom, klipovano iznad horizonta → 4) oblaci (0–9) obasjani odozdo → 5) izmaglica na horizontu → 6) voda (refleks neba → duboka boja) → 7) svetlosna staza → 8) linije talasa → 9) silueta → 10) ptice
- **Parametri**:
  - Horizont: h × 0.50–0.62
  - Sunce: x = w × 0.25–0.75, r = 26–56 × s, visina −0.5 r … +2.5 r (`pow(f, 1.4)` → češće nisko)
  - Oblaci: širina w × 0.12–0.42, visina 8–30 × s, 9–16 elipsi sa tanjim krajevima; dva sloja (svetli srp + telo pomereno za 0.22 ch)
  - Staza: 260–420 odsjaja, širina staze r × (1.2 + 5.5 t), gušće pri horizontu
  - Siluete: obala 30% (ridgePoints, spušta se ka moru), jedrilica 22%, svetionik na steni 12%; ptice 40% (2–7)
- **Posebnosti**: QRNG troši samo odluke; detalji iz `prngFromStream`; dimenzije × `s = w/1200`

---

### 3. Pustinja (`desert.ts`) — v2

> v1 (do `RENDER_V2_FROM`): toplo nebo (žuto/narandžasto/ružičasto), ravna podloga, 4 sloja oblih dina (ridgePoints), 45% kaktusi od elipsi ili palma. Zamrznut u `scenarios/v1/desert.ts`.

- **Varijacije**: 6 paleta — noon, golden-dunes, sahara-sunset, dusk-violet, night, red-rock; hue ±8
- **Redosled crtanja**: 1) nebo → 2) Mlečni put + zvezde (noć) → (hooks.sky) → 3) sunce/mesec → (hooks.body) → 4) toplotna izmaglica → 5) mese → 6) za svaki sloj: telo (gradijent) → senke strmih strana (klip na telo) → jaranice → svetla linija grebena → (oaza na srednjem sloju) → 7) karavan / kaktusi
- **Parametri**:
  - Horizont: h × 0.42–0.56; sunce x = w × 0.12–0.88, r = 24–48 × s (mesec 16–28 × s); u sumraku nisko (horizont × 0.6–0.9)
  - Slojevi: 4–5; podnožje horizont + (h−horizont) × (0.12 + 0.95 t); visina dina (h−horizont) × (0.18 + 0.35 t); haze 0.6 × (1−t); talasanje podnožja 5–15 × s
  - Dune: 3–5 po sloju; blaga strana 2.6–4.4 × visina, strma 0.9–1.4 × visina
  - Mese (butte): 1–3, svaka u svom delu širine; širina 70–220 × s (max pola slota), visina 60–150 × s; litica 25–40% visine; senka neprovidna, klipovana na obris (red-rock 100%, ostale 25–30%)
  - Prednji plan: karavan 3–6 kamila 25%, saguaro 1–3 30%, oaza 15%
- **Posebnosti**: strana svetla prati sunce (`lightDir`); QRNG za odluke, `prngFromStream` za geometriju

---

### 4. Noćni grad (`city-night.ts`) — v2

> v1 (do `RENDER_V2_FROM`): 2-stop tamnoplavo nebo, pravougaone siluete u jednom sloju, 15–40 nasumičnih okruglih prozora. Zamrznut u `scenarios/v1/city-night.ts`.

- **Varijacije**: 6 paleta — midnight, neon-violet, teal, smog-amber, winter, indigo; hue ±8. Reka 50% / ulica 50%. Mesec pun ili srp (45%).
- **Redosled crtanja**: 1) nebo (3 stopa, svetlosno zagađenje pri horizontu) → 2) zvezde (gustina po paleti) → 3) mesec: sjaj + disk (srp = evenodd isecanje) + „mora" → 4) tanki oblaci (45%) → 5) zgrade u 3 sloja + prozori, izmaglica posle 1. i 2. sloja → 6) reka sa odrazima ILI ulica sa svetiljkama
- **Parametri**:
  - Linija zgrada: reka h × 0.60–0.70, ulica h × 0.82–0.92; gustina 0.7–1.3
  - Slojevi: haze 0.62 / 0.35 / 0; visina groundY × (0.18–0.42 / 0.14–0.36 / 0.08–0.30); širina 30–70 / 40–90 / 50–120 × s; 12% zgrada 1.6× više
  - Krovovi: flat (2/7), stepped, spire (+antena), dome, slant, tower (vodotoranj)
  - Prozori: 3×4 × s, razmak 6/8 × s; 25% spratova mračno; udeo upaljenih 0.18 / 0.30 / 0.42 po sloju
  - Crvena svetla: slojevi 2–3, 35%, samo visoke zgrade ili spire
  - Mesec: x = w × 0.1–0.9, r = 16–32 × s
  - Reka: odrazi 0.8 visine zgrade, 2–5 vertikalnih crtica po zgradi, 40–80 odsjaja meseca
- **Posebnosti**: QRNG za odluke, `prngFromStream` za zgrade/prozore/zvezde; dimenzije × `s = w/1200`

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

### 6. Šuma (`forest.ts`) — v2

> v1 (do `RENDER_V2_FROM`): dan/sumrak/noć, nebo do horizonta, 3 sloja drveća od krugova (listopadno 65%) i konusa (četinari), zeleno tlo, ptice / sove / šišmiši / veverica. Zamrznut u `scenarios/v1/forest.ts`.

- **Varijacije**: 6 paleta — spring-morning, summer, autumn, golden-hour, night-fireflies, winter; hue ±8; udeo jelki 30–80%
- **Redosled crtanja**: 1) nebo → 2) zvezde (noć) → (hooks.sky) → 3) sunce/mesec → (hooks.body) → 4) 4 sloja brda: brdo → siluete drveća → (sneg) → magla → 5) sunčevi zraci → 6) proplanak + travke → 7) srna → 8a) manja stabla u srednjem planu → 8b) velika stabla sa strane → 9) svici (noć) ili ptice
- **Parametri**:
  - Horizont: h × 0.36–0.48; proplanak od horizont + (h−horizont) × 0.55–0.67
  - Sunce: x = w × 0.15–0.85, r = 24–44 × s (mesec 16–28 × s); zlatni sat nisko
  - Brda: amplituda 20–60 × s; siluete 14–40 × s; haze 0.75 → 0.05
  - Velika stabla: 2–4, visina (h−proplanak) × 0.6 + 180–340 × s; manja: 2–5, 50–120 × s
  - Jelka: 5–7 slojeva; listopadno: krošnja 0.38 × visina, 12–19 grozdova
  - Zraci: 5–10 (po paleti 0–90%); srna 25%; ptice 40%; svici 40–90
- **Posebnosti**: strana svetla prati sunce; noću hladno svetlo (`tint`); QRNG za odluke, `prngFromStream` za drveće i detalje
---

### 7. Jezero (`lake.ts`) — v2

> v1 (do `RENDER_V2_FROM`): horizont 1/3, plavo nebo, voda 2/3, uska traka brda, meki refleks sunca, ptice, 1–4 L-system drveta na obali. Zamrznut u `scenarios/v1/lake.ts`.

- **Varijacije**: 6 paleta — dawn-mist, day, golden, dusk, night, alpine-clear; hue ±8; sneg po verovatnoći palete (0.4–1)
- **Redosled crtanja**: gornja polovina [nebo → zvezde → (hooks.sky) → sunce/mesec → (hooks.body) → oblaci → ptice → daleke planine + sneg → izmaglica → bliže planine → šuma na obali] → ista gornja polovina preslikana u vodu → zatamnjenje vode → talasići → staza odsjaja → magla → prednji plan
- **Parametri**:
  - Horizont: h × 0.44–0.54; sunce x = w × 0.15–0.85, r = 22–44 × s (mesec 16–28 × s); u sumraku niže (horizont × 0.55–0.80)
  - Planine: daleke 3–6 vrhova, visina horizont × 0.42–0.62; bliže 2–5 vrhova, × 0.22–0.38; 1–2 pomoćna vrha po glavnom; šum 3 oktave (14/38/110, amp 0.09/0.045/0.02)
  - Šuma: jelke 10–32 × s (10% 1.6× više), razmak 3–10 × s
  - Odsjaj: 120–240 crtica; magla 2–4 trake × jačina palete
  - Prednji plan: mol 28%, čamac 22%, trska 50%; ptice 35% (ne noću)
- **Posebnosti**: pravi odraz drugim prolazom (`scale(1,-1)`); rarity događaji se ne preslikavaju; ispod dometa odraza boja zenita

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
| 2026-11-19 | Svi | Uvedeno verzionisanje renderera: trenutni scenariji zamrznuti kao **v1** u `src/lib/scenarios/v1/` (arhiva pre `RENDER_V2_FROM`). Sve dalje izmene u ovoj tabeli odnose se na **v2** (`src/lib/scenarios/*.ts`), osim ako nije drugačije navedeno. Vizuelno bez promene. |
| 2026-11-19 | Svi (v2) | Post-fx sloj (`src/lib/post-fx.ts`) posle svakog scenarija: S-kontrast, split-tone (5 parova), vinjeta, film grain. Troši 7 QRNG vrednosti posle scene. |
| 2026-11-19 | Zalazak (v2) | Prepisan: 8 paleta (uklj. plavi sat), sunce na različitim visinama sa mekim sjajem, oblaci obasjani odozdo, izmaglica, refleks neba u vodi, svetlosna staza u perspektivi, siluete (obala/jedrilica/svetionik), ptice. Detalji iz `prng.ts`. |
| 2026-11-19 | Noćni grad (v2) | Prepisan: 6 paleta, 3 sloja zgrada sa izmaglicom, 6 tipova krovova, prozori po spratovima, crvena svetla (35% visokih), pun mesec/srp, oblaci, reka sa odrazima ili ulica sa svetiljkama. |
| 2026-11-19 | Svi (v2) | Rarity hook-ovi: `hooks.sky(...)` posle neba (horizont + dan/sumrak/noć) i `hooks.body(...)` posle sunca/meseca u svih 8 scenarija. Retki događaji (duga, zvezde padalice, kometa, polarna svetlost, pomračenje, krvavi mesec, glitch) — vidi README → Rarity sistem. Obični dani nepromenjeni. |
| 2026-11-19 | Jezero (v2) | Prepisano kao planinsko jezero: 6 paleta, planine sa nazubljenim grebenom i snegom, šuma na obali, pravi odraz u vodi, talasići, odsjaj, magla, mol/čamac/trska. |
| 2026-11-19 | Pustinja (v2) | Prepisana: 6 paleta, asimetrične dune sa osvetljenom i senovitom stranom, talasasto podnožje, jaranice, mese, karavan, saguaro, oaza, Mlečni put noću. |
| 2026-11-19 | Šuma (v2) | Prepisana kao proplanak sa pogledom na šumovitu dolinu: 6 paleta (uklj. jesen i zimu), 4 sloja brda u magli, velike jelke i listopadna stabla sa dvobojnim krošnjama, zraci, srna, svici. |
| 2026-11-19 | Plaža (v2) | Prepisana kao tropska plaža: 6 paleta, kumulusi, zakrivljena obala sa plićinom, mokrim peskom i penom, palme sa punim listovima i dugim liskama, ostrvo, jedrilica, suncobran, školjke, galebovi. |

**Pravilo:** Pri svakoj izmeni scenarija dodati red u ovu tabelu (datum, scenarij, kratak opis).
