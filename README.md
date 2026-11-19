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

## Verzionisanje renderera (render v1 / v2)

**Zašto:** Svaka slika se crta iz sačuvanih brojeva (slika dana iz datuma, favoriti iz baze). Bez verzionisanja bi svaka izmena scenarija retroaktivno promenila **celu arhivu** i sve sačuvane favorite.

**Kako:**

- **v1** — zamrznuta kopija scenarija u [`src/lib/scenarios/v1/`](src/lib/scenarios/v1/) (router, svih 8 scenarija, `landscape.ts`, `draw-utils.ts`, `tree-lsystem.ts`, `color.ts`). **Ništa se tu ne menja**, nikad.
- **v2** — aktivni kod u [`src/lib/scenarios/*.ts`](src/lib/scenarios/), `src/lib/landscape.ts`, `draw-utils.ts`… Sva vizuelna poboljšanja i novi scenariji idu ovde.
- [`src/lib/render-version.ts`](src/lib/render-version.ts) određuje verziju **po datumu** (Europe/Belgrade):
  - datum `< RENDER_V2_FROM` → v1, datum `>= RENDER_V2_FROM` → v2
  - `RENDER_V2_FROM` dolazi iz `NEXT_PUBLIC_RENDER_V2_FROM`; ako nije postavljen, podrazumevano je `2099-01-01` → **produkcija ostaje na v1** dok se pri deploy-u ne postavi datum prelaska (vidi [DEPLOY-CHECKLIST.md](DEPLOY-CHECKLIST.md)).
- `renderArt(ctx, stream, w, h, version)` u [`router.ts`](src/lib/scenarios/router.ts) — bez `version` crta najnoviju (v2).

### Post-fx sloj (samo v2)

[`src/lib/post-fx.ts`](src/lib/post-fx.ts) — poziva se na kraju `renderArt` za v2, posle scenarija. Jedan prolaz kroz piksele (`getImageData`/`putImageData`), **bez `ctx.filter` i composite modova**, da browser i server (`@napi-rs/canvas`) daju isti rezultat.

| Efekat | Opseg | Napomena |
|---|---|---|
| S-kontrast | 0.12–0.24 | mešavina linearne i smoothstep krive po kanalu |
| Split-tone | jačina 0.4–0.75 | 5 kuriranih parova (amber-teal, peach-violet, gold-blue, rose-indigo, neutral-warm); senke imaju vrh oko L≈0.33 i opadaju ka crnoj, da tamne površine ne dobiju plavi cast |
| Vinjeta | 0.20–0.34 | eliptična, smoothstep od 35% udaljenosti |
| Film grain | 4–8 (0–255) | monohromatski, `mulberry32` PRNG, najvidljiviji u srednjim tonovima; skaliran sa širinom (thumbnail 600px dobija pola) |

Parametri se biraju iz QRNG stream-a **posle** scene (2 vrednosti za seed + 5 za parametre), pa ne menjaju samu kompoziciju.

**Ko koju verziju koristi:**

| Mesto | Verzija |
|---|---|
| Slika dana, `/art/[date]`, arhiva, `/api/og-image` | po datumu slike (`renderVersionForDate`) |
| `/create-art` — novi brojevi (ručno, „Nasumično", „Današnja") | po današnjem datumu (`currentRenderVersion`) |
| Favorit (profil, `/f/[token]`, otvaranje u `/create-art`) | po datumu nastanka favorita (`renderVersionForTimestamp(createdAt)`) |

**Poznato ograničenje:** favorit sačuvan danas iz *stare* arhivske slike (v1 datum) prikazuje se u v2, jer favorit ne pamti datum slike, samo datum snimanja. Rešava se kolonom `renderVersion` u `Favorite` tabeli kad bude potrebno.

**Provera determinističnosti:** pri uvođenju je v1 renderovan za 8 datuma (2026-11-10 … 2026-11-18) i hash piksela je identičan kodu pre izmene.

---

## Otvorena pitanja / TODO

- **Slika dana nije kvantna.** `/api/art/[date]` i `/api/og-image` koriste `seedFromDate()` iz [`src/lib/qrng-server.ts`](src/lib/qrng-server.ts): SHA-256 hash datuma → xorshift → 1000 brojeva. ANU QRNG i `qrng_pool` koristi samo `/api/generate` (`/create-art`, `/algorithmic`). Plan za kasnije: tabela `daily_art` (datum → 1000 brojeva), prvi zahtev dana uzima red iz `qrng_pool` i trajno ga vezuje za datum; stari datumi ostaju na `seedFromDate` da se arhiva ne promeni. Preduslov za sertifikat / „Usvoji dan" iz [CLAUDE-DEVELOPMENT-PROPOSAL.md](CLAUDE-DEVELOPMENT-PROPOSAL.md).

---

## Algoritmički art (`/algorithmic`) — layout u `<style>`

**Zašto:** Na Next.js 16 + Turbopack + Tailwind v4, responsive utility klase (`md:flex-row` itd.) za ovu stranu ponekad **ne daju očekivani desktop layout** (panel i platno ostaju jedan ispod drugog). Zato je raspored rešen **čistim CSS-om** u ugrađenom `<style>` bloku u [`src/app/algorithmic/page.tsx`](src/app/algorithmic/page.tsx), ne kroz Tailwind breakpoint-e za tu osu.

**Ponašanje:**

- **Uski ekran:** kolona — prvo sidebar (dugmad + parametri), ispod desna kolona (platno, QRNG otkrivanje, priča).
- **≥ 48rem (768px):** red — **levo** fiksni sidebar `20rem`, **desno** elastična kolona (`flex: 1 1 0%`, `min-width: 0`) sa platnom i tekstom ispod.

**Korišćene klase:** `algo-art-workspace` (spoljašnji flex kontejner), `algo-art-sidebar` (`<aside>`), `algo-art-main` (desna kolona).

**CSS (kopija logike — izvor istine je u `page.tsx`):**

```css
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
```

**U JSX-u** spoljašnji wrapper koristi `className="algo-art-workspace"`, parametarski panel `className="algo-art-sidebar"`, blok sa platnom i pričom `className="algo-art-main"`. `flex-direction: row !important` na desktopu namerno pojačava prioritet da drugi stilovi ne vrate kolonu.

**Napomena:** Ako menjaš raspored, prvo ažuriraj `<style>` u `algorithmic/page.tsx`, zatim ovaj odeljak u README da ostanu usklađeni.

### LUMEN-inspirisane funkcije (studio)

- **Share preset (`QAL1.` kod):** `/algorithmic?code=...` — philosophy, parametri i 1000 QRNG vrednosti.
- **Randomize style:** nasumični parametri uz lock filozofije/palete.
- **Hi-res PNG export:** 1200×675, 2400×1350, 3840×2160 (offscreen render).
- **Set export:** 4–12 varijacija istog stila u ZIP-u.
- **WebM loop (flow-field):** deterministički loop preko `loopPhase`.
- **Favorites `algoPreset`:** pun snapshot preset-a u bazi (kolona `algoPreset` JSON).

---

## Projektna struktura

```
src/
├── app/
│   ├── page.tsx              # Početna — današnji art
│   ├── layout.tsx            # Root layout + Providers (SessionProvider)
│   ├── create-art/page.tsx   # Igraonica — unesi 1000 brojeva, generiši, preuzmi PNG, snimi u omiljene
│   ├── algorithmic/page.tsx # Algoritmički art — layout u <style> (vidi sekciju u README)
│   ├── art/[date]/page.tsx   # Art po datumu
│   ├── archive/page.tsx      # Arhiva
│   ├── login/page.tsx        # Prijava / registracija
│   ├── profile/page.tsx      # Profil — omiljene slike korisnika
│   ├── f/[token]/page.tsx   # Javno deljenje omiljene slike
│   └── api/
│       ├── generate/route.ts      # GET → ANU QRNG ili entropy fallback
│       ├── art/[date]/route.ts    # GET → art za datum
│       ├── og-image/route.ts      # GET → PNG slika dana (Open Graph)
│       ├── auth/[...nextauth]/route.ts  # NextAuth GET/POST
│       ├── auth/register/route.ts # POST — registracija korisnika
│       └── favorites/
│           ├── route.ts           # GET (lista) + POST (dodaj)
│           └── [id]/route.ts     # GET, DELETE, PATCH (ažuriraj naslov/javnost)
├── lib/
│   ├── qrng.ts, qrng-server.ts
│   ├── color.ts, draw-utils.ts, date.ts
│   ├── auth.ts                 # NextAuth konfiguracija (Credentials + Drizzle)
│   ├── db.ts                   # Drizzle + mysql2 connection pool
│   ├── schema.ts               # Drizzle šema (User, Favorite)
│   ├── landscape.ts
│   ├── tree-lsystem.ts         # L-system rekurentno grananje (drveće)
│   ├── render-version.ts       # Verzija renderera po datumu (v1 zamrznut / v2 aktivan)
│   ├── post-fx.ts              # v2 post-fx: kontrast, split-tone, vinjeta, grain
│   └── scenarios/
│       ├── router.ts, index.ts # renderArt(..., version) — v2 + dispatch na v1
│       ├── beach.ts, ocean-sunset.ts, desert.ts
│       ├── city-night.ts, cosmos.ts, forest.ts, lake.ts
│       └── v1/                 # ZAMRZNUT render v1 (ne menjati — arhiva)
└── components/
    ├── ArtCanvas.tsx, Header.tsx, Providers.tsx
    ├── DailyArtSection.tsx, ArtPageContent.tsx
    ├── ArchiveThumbnail.tsx, QRNGReveal.tsx
    └── SaveFavoriteButton.tsx   # Modal za snimanje u omiljene

drizzle.config.ts   # Drizzle Kit konfiguracija
drizzle/
└── 0000_init.sql   # SQL fallback za inicijalizaciju (User, Favorite)

# prisma/ — legacy (više se ne koristi, projekat koristi Drizzle)
```

---

## Pokretanje

### Preduslovi

- **Node.js** 18+ (preporučeno 20+)
- **MySQL** — baza za korisnike i omiljene

### 1. Instalacija MySQL-a (Linux)

```bash
sudo apt update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

### 2. Kreiranje baze i korisnika

```bash
sudo mysql -u root -p
```

U MySQL konzoli:

```sql
CREATE DATABASE qrng_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'qrng_user'@'localhost' IDENTIFIED BY 'tvoja_lozinka';
GRANT ALL PRIVILEGES ON qrng_db.* TO 'qrng_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Instalacija zavisnosti

```bash
npm install
```

### 4. Konfiguracija okruženja

Kreiraj `.env.local` u root folderu (ili `.env`):

```env
# Obavezno za Auth.js
AUTH_SECRET="nasumicni-dugacak-string-minimum-32-karaktera"

# Obavezno za Drizzle/MySQL
DATABASE_URL="mysql://qrng_user:tvoja_lozinka@localhost:3306/qrng_db"

# Opciono — apsolutni URL sajta (za OG slike, share linkove)
NEXTAUTH_URL="http://localhost:9500"

# Opciono — od kog datuma se crta render v2 (YYYY-MM-DD). Bez ovoga: 2099-01-01 (sve v1)
NEXT_PUBLIC_RENDER_V2_FROM="2026-11-01"
```

- **AUTH_SECRET** — generiši sa `openssl rand -base64 32`
- **DATABASE_URL** — format za MySQL: `mysql://user:pass@host:port/dbname`
- **NEXTAUTH_URL** — u produkciji postavi na realan domen (npr. `https://qrng-art.com`)
- **NEXT_PUBLIC_RENDER_V2_FROM** — datum prelaska na render v2 (vidi [Verzionisanje renderera](#verzionisanje-renderera-render-v1--v2)). U `.env.development` je `2026-11-01`, pa se lokalno novembar crta u v2, a starije u v1 (lako poređenje u arhivi).

### 5. Inicijalizacija baze (Drizzle)

**Opcija A — Drizzle push (preporučeno):**

```bash
npm run db:push
```

**Opcija B — Ručni SQL (ako db:push ne radi):**

```bash
mysql -u qrng_user -p qrng_db < drizzle/0000_init.sql
```

### 6. Pokretanje razvojnog servera

```bash
npm run dev
```

Aplikacija je dostupna na **http://localhost:9500**.

### npm skripte

| Skripta | Opis |
|---------|------|
| `npm run dev` | Razvojni server (Next.js) na portu 9500 |
| `npm run build` | Build za produkciju |
| `npm start` | Pokreće produkcijsku verziju (posle `npm run build`) |
| `npm run lint` | ESLint provera |
| `npm run db:push` | Drizzle: push šeme u bazu (kreira/ ažurira tabele) |
| `npm run db:generate` | Drizzle: generiše SQL migracije iz schema.ts |
| `npm run db:migrate` | Drizzle: primenjuje generisane migracije |

---

## Novi paketi i funkcije

### Drizzle ORM + mysql2

- **Šta radi:** Povezuje aplikaciju sa MySQL bazom. Schema (`src/lib/schema.ts`) definiše modele: `User`, `Favorite`. Connection pool u `src/lib/db.ts`.
- **Zašto:** Auth.js treba tabelu korisnika; omiljene slike čuvaju `values` (1000 uint16) i metapodatke. Drizzle je lakši od Prisma za Hostinger (bez Rust query engine procesa).

### NextAuth (Auth.js v5)

- **Šta radi:** Autentifikacija — prijava/odjava, sesija, JWT. Credentials provider (email + lozinka). Sesije u JWT-u (bez database sesija).
- **Zašto:** Korisnici mogu da se registruju, prijave i snime omiljene slike.
- **Rute:** `/login`, `/api/auth/*`

### bcryptjs

- **Šta radi:** Hash-uje lozinke pre čuvanja u bazi. Nikad plain text.
- **Gde se koristi:** Registracija (`/api/auth/register`), Credentials provider u `auth.ts`.

### @napi-rs/canvas

- **Šta radi:** Server-side canvas rendering (Node.js). Koristi se za OG slike (`/api/og-image`).
- **Zašto:** Za share linkove (Viber, Facebook…) potrebna je stvarna PNG slika, ne React komponenta.

### next-intl

- **Šta radi:** Internacionalizacija — prevodi UI stringove iz `messages/sr.json`.
- **Zašto:** Ceo sajt na srpskom (šuma, Igraonica, Slika dana, itd.).

---

## API

| Endpoint | Opis |
|----------|------|
| `GET /api/generate` | Vraća 1000 uint16 vrednosti (ANU QRNG ili crypto fallback) |
| `GET /api/art/[date]` | Vraća art za datum (YYYY-MM-DD) — `{ values: number[] }` |
| `GET /api/og-image` | Vraća PNG sliku dana (1200×675) za og:image |
| `GET/POST /api/auth/[...nextauth]` | NextAuth rute (callback, session, signIn/Out) |
| `POST /api/auth/register` | Registracija (email, lozinka, ime) |
| `GET /api/favorites` | Lista omiljenih (za ulogovanog korisnika) |
| `POST /api/favorites` | Dodaj u omiljene (values, title?, scenarioName?, isPublic?) |
| `GET /api/favorites/[id]` | Jedna omiljena |
| `DELETE /api/favorites/[id]` | Obriši omiljenu |
| `PATCH /api/favorites/[id]` | Ažuriraj (title, isPublic) |

---

## Changelog

Svaki update aplikacije se beleži ovde. Format: datum, scenarij/fajl, opis promene. **Detaljne izmene scenarija** vidi u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija).

### 2026-11-19 — Post-fx sloj za render v2 (grana `claude`)

- **`src/lib/post-fx.ts`** — NOVO: `pickPostFxParams(stream)` + `applyPostFx(ctx, w, h, params)`. Jedan pixel prolaz: S-kontrast, split-tone (5 kuriranih parova), eliptična vinjeta, monohromatski film grain (`mulberry32`, skaliran na rezoluciju). Bez `ctx.filter`/composite modova radi istog izgleda u browseru i na serveru.
- **`src/lib/scenarios/router.ts`** — `renderArt` za v2 poziva `applyPostFx` posle scenarija. v1 nije dirnut.
- **Podešavanje** — prva verzija imala je prejak grain (7–13) i plavi cast u tamnim delovima; smanjeno na 4–8, grain najjači u srednjim tonovima, senke split-tone-a opadaju ka čistoj crnoj.
- **Verifikacija** — v1 hash piksela nepromenjen za 2026-11-10 … 18; pregledani pre/posle parovi za zalazak, šumu, pustinju, plažu, pejzaž (noć) i kosmos. `tsc` prolazi.
- **README** — podsekcija „Post-fx sloj (samo v2)" sa tabelom opsega, stavka u strukturi projekta.

### 2026-11-19 — Verzionisanje renderera (grana `claude`)

- **`src/lib/scenarios/v1/`** — NOVO: zamrznuta kopija celog renderera (router, 8 scenarija, `landscape.ts`, `draw-utils.ts`, `tree-lsystem.ts`, `color.ts`) sa prepravljenim importima. Funkcija `renderArtV1`. Ne menja se nikad; čuva izgled postojeće arhive.
- **`src/lib/render-version.ts`** — NOVO: `RenderVersion`, `RENDER_V2_FROM` (iz `NEXT_PUBLIC_RENDER_V2_FROM`, podrazumevano `2099-01-01`), `renderVersionForDate`, `renderVersionForTimestamp`, `currentRenderVersion`.
- **`src/lib/scenarios/router.ts`** — `renderArt(ctx, stream, w, h, version = 2)`: verzija 1 ide na `renderArtV1`, inače `renderArtV2` (postojeći kod, ovde idu poboljšanja).
- **`src/components/ArtCanvas.tsx`** — novi opcioni prop `renderVersion`; bez njega verzija po `date` propu, a bez datuma po današnjem danu.
- **`src/components/AlgoArtCanvas.tsx`** — novi opcioni prop `createdAt` → verzija po datumu nastanka favorita (samo za scenarije, algoritamski presetovi nisu pogođeni).
- **`src/app/profile/page.tsx`, `src/app/f/[token]/page.tsx`** — prosleđuju `createdAt` favorita u `AlgoArtCanvas`.
- **`src/app/create-art/page.tsx`** — favorit otvoren u Igraonici crta se u verziji svog `createdAt`; novi brojevi (unos, Nasumično, Današnja) u današnjoj verziji.
- **`src/app/api/og-image/route.ts`** — OG i arhivski thumbnail crtaju se u verziji datuma.
- **`.env.development`** — `NEXT_PUBLIC_RENDER_V2_FROM=2026-11-01` (samo lokalno).
- **Verifikacija** — v1, v2 i kod pre izmene daju identičan hash piksela za 2026-11-10 … 2026-11-18. `tsc --noEmit` prolazi. Vizuelno se još ništa ne menja (v2 == v1).
- **README** — nove sekcije „Verzionisanje renderera" i „Otvorena pitanja / TODO" (slika dana koristi `seedFromDate`, ne ANU QRNG; vezivanje QRNG-a za datum odloženo), env promenljiva u Pokretanju, ažurirana struktura projekta.
- **DEPLOY-CHECKLIST** — korak za `NEXT_PUBLIC_RENDER_V2_FROM` pri spajanju u `main`.
- **CLAUDE-DEVELOPMENT-PROPOSAL.md** — NOVO: analiza i predlog razvoja (vizuelno, monetizacija, roadmap).

### 2026-03-29

- **README** — Nova sekcija „Algoritmički art (`/algorithmic`) — layout u `<style>`”: objašnjenje zašto responsive layout ide kroz ugrađeni `<style>` u [`src/app/algorithmic/page.tsx`](src/app/algorithmic/page.tsx), kopija CSS-a (`.algo-art-workspace` / `.algo-art-sidebar` / `.algo-art-main`), napomena da izvor istine ostaje u `page.tsx`. U stablu projekta dodata stavka `algorithmic/page.tsx`.

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
- **Plaža** — Palma peraje povećane 40–55% (lenBase 56–108, width 6–11).
- **Šuma** — Deblo se crta posle krošnje da uvek bude vidljivo (krošnja ne sme da ga prekrije).
- **Svi scenariji** — Sunce/mesec: konzistentna veličina (sun 22–36 px, moon 14–26 px).
- **Jezero** — Deblo obalskog drveća crta se posle krošnje (kao Šuma).
- **Jezero** — Vrba i listač: L-system inspirisano rekurzivno grananje (tree-lsystem.ts).
- **Auth + Favorites** — Drizzle + NextAuth (Credentials), bcryptjs. Korisnici: registracija, prijava, profil, snimanje omiljenih, javno deljenje `/f/[token]`.
- **README** — Detaljna sekcija Pokretanje (preduslovi, `.env`, Drizzle init), npm skripte, pregled novih paketa (Drizzle, NextAuth, bcryptjs, @napi-rs/canvas, next-intl), ažurirana struktura projekta i API tabela.

### 2026-03-07 — Optimizacija resursa (Hostinger fix)

- **`src/lib/db.ts`** — KRITIČAN FIX: Prelazak sa Prisma na Drizzle + mysql2. Prisma je imala Rust query engine koji je spawnovao procese i prekoračavao Max Processes limit (120/120 na Hostingeru). Drizzle koristi mysql2 connection pool bez dodatnih child procesa.
- **`next.config.ts`** — KRITIČAN FIX: Uklonjen globalni `no-store` header koji je pokrivao sve URL-ove (`/:path*`). Ostao je samo keš za `/_next/static/`. Sada svaka ruta sama definiše svoju keš strategiju.
- **`src/components/ArchiveThumbnail.tsx`** — Dodat `IntersectionObserver` (rootMargin 200px): `fetch(/api/art/${date})` se poziva samo kada thumbnail uđe u viewport. Pre ovog fixa, N thumbnailova na arhivnoj strani istovremeno slalo N paralelnih zahteva serveru pri učitavanju stranice.
- **`src/app/api/og-image/route.ts`** — Dodat in-memory LRU keš (`Map<string, Buffer>`, max 30 unosa). OG slika je deterministička (isti datum → ista slika zauvek), pa se renderuje samo jednom po procesu. Pre toga, svaki Viber/Telegram share pokretao je puni canvas render + PNG enkodiranje.
- **`src/app/api/art/[date]/route.ts`** — Dodat `Cache-Control: public, max-age=86400, immutable` header. Ruta je deterministička, može se keširati u browseru i CDN-u.
- **`src/app/api/favorites/route.ts`** — Uklonjen `values` iz SELECT za list view. 1000 brojeva po favoritu se sada ne prenosi pri listanju, samo pri otvaranju jednog favorita. Dodat `no-store` header (privatni podaci).
- **`src/app/api/favorites/[id]/route.ts`** — DELETE i PATCH koriste Drizzle sa userId uslovom. Dodat `no-store` header.
- **`src/app/profile/page.tsx`** — `FavoriteCard` sada lazy-load-uje `values` putem `IntersectionObserver` — canvas se popunjava tek kada kartica uđe u viewport, ne odjednom za sve favorite.
- **`src/app/page.tsx`** — `force-dynamic` zamenjen sa `revalidate: 86400` (ISR). Stranica ne sadrži per-request dinamičke podatke.
- **`src/app/archive/page.tsx`** — `force-dynamic` zamenjen sa `revalidate: 3600` (ISR). Lista datuma je čista matematika.

### 2026-03-11 — Drizzle setup i README dokumentacija

- **README** — Ažurirana dokumentacija: Prisma zamenjena sa Drizzle u celoj sekciji Pokretanje. Dodati koraci: instalacija MySQL-a, kreiranje baze i korisnika, `npm run db:push`, SQL fallback `drizzle/0000_init.sql`.
- **Projektna struktura** — Prisma folder zamenjen sa `drizzle.config.ts` i `drizzle/0000_init.sql`. `db.ts` i `auth.ts` sada koriste Drizzle.
- **drizzle.config.ts** — Novi fajl za Drizzle Kit; učitava `.env` i `.env.local` za `DATABASE_URL`.
- **drizzle-kit** — Dodat u devDependencies. Nove skripte: `db:push`, `db:generate`, `db:migrate`.
- **drizzle/0000_init.sql** — SQL fallback za ručnu inicijalizaciju (samo `User` i `Favorite`, bez Prisma tabela).

---

## Konfiguracija

### Aplikacija

- **REQUIRED_COUNT** — 1000 brojeva za generisanje
- **Canvas** — 1200×675 px
- **Datum** — timezone `Europe/Belgrade` (srpsko vreme)
- **Port** — 9500 (dev)

### Okruženje (.env)

| Promenljiva | Obavezna | Opis |
|-------------|----------|------|
| `AUTH_SECRET` | Da | Min. 32 karaktera; `openssl rand -base64 32` |
| `DATABASE_URL` | Da | MySQL connection string (`mysql://user:pass@host:3306/db`) |
| `NEXTAUTH_URL` | Produkcija | Apsolutni URL sajta (za Auth callback i OG slike) |
