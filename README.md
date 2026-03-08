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
│   ├── layout.tsx            # Root layout + Providers (SessionProvider)
│   ├── create-art/page.tsx   # Igraonica — unesi 1000 brojeva, generiši, preuzmi PNG, snimi u omiljene
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
│   ├── auth.ts                 # NextAuth konfiguracija (Credentials + Prisma)
│   ├── db.ts                   # Prisma client singleton
│   ├── landscape.ts
│   ├── tree-lsystem.ts         # L-system rekurentno grananje (drveće)
│   └── scenarios/
│       ├── router.ts, index.ts
│       ├── beach.ts, ocean-sunset.ts, desert.ts
│       ├── city-night.ts, cosmos.ts, forest.ts, lake.ts
└── components/
    ├── ArtCanvas.tsx, Header.tsx, Providers.tsx
    ├── DailyArtSection.tsx, ArtPageContent.tsx
    ├── ArchiveThumbnail.tsx, QRNGReveal.tsx
    └── SaveFavoriteButton.tsx   # Modal za snimanje u omiljene

prisma/
├── schema.prisma   # User, Account, Session, VerificationToken, Favorite
└── migrations/     # SQL migracije
```

---

## Pokretanje

### Preduslovi

- **Node.js** 18+ (preporučeno 20+)
- **MySQL** — baza za korisnike i omiljene

### 1. Instalacija

```bash
npm install
```

### 2. Konfiguracija okruženja

Kreiraj `.env` u root folderu:

```env
# Obavezno za Auth.js
AUTH_SECRET="nasumicni-dugacak-string-minimum-32-karaktera"

# Obavezno za Prisma (MySQL)
DATABASE_URL="mysql://KORISNIK:LOZINKA@HOST:3306/IME_BAZE"

# Opciono — apsolutni URL sajta (za OG slike, share linkove)
NEXTAUTH_URL="http://localhost:9500"
```

- **AUTH_SECRET** — generiši sa `openssl rand -base64 32`
- **DATABASE_URL** — format za MySQL: `mysql://user:pass@host:port/dbname`
- **NEXTAUTH_URL** — u produkciji postavi na realan domen (npr. `https://qrng-art.dnasoftwaresolutions.com`)

### 3. Baza podataka (Prisma)

```bash
# Generiši Prisma client i primeni migracije
npx prisma generate
npx prisma migrate deploy   # ili: npx prisma migrate dev (prvi put / dev)
```

Ako baza još ne postoji, kreiraj je u MySQL-u, pa pokreni `migrate deploy` ili `migrate dev`.

### 4. Pokretanje razvojnog servera

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
| `npx prisma generate` | Regeneriše Prisma client iz schema.prisma |
| `npx prisma migrate dev` | Kreira novu migraciju i primenjuje je (dev) |
| `npx prisma migrate deploy` | Primena postojećih migracija (produkcija) |
| `npx prisma studio` | GUI za pregled/editovanje baze |

---

## Novi paketi i funkcije

### Prisma (ORM)

- **Šta radi:** Povezuje aplikaciju sa MySQL bazom. Schema (`prisma/schema.prisma`) definiše modele: `User`, `Account`, `Session`, `VerificationToken`, `Favorite`.
- **Zašto:** Auth.js treba tabelu korisnika; omiljene slike čuvaju `values` (1000 uint16) i metapodatke.

### NextAuth (Auth.js v5)

- **Šta radi:** Autentifikacija — prijava/odjava, sesija, JWT. Credentials provider (email + lozinka). Prisma adapter čuva sesije i naloge.
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
- **Auth + Favorites** — Prisma 5, NextAuth (Credentials), bcryptjs. Korisnici: registracija, prijava, profil, snimanje omiljenih, javno deljenje `/f/[token]`.
- **README** — Detaljna sekcija Pokretanje (prerequisites, .env, Prisma migrate), npm skripte, pregled novih paketa (Prisma, NextAuth, bcryptjs, @napi-rs/canvas, next-intl), ažurirana struktura projekta i API tabela.

### 2026-03-07 — Optimizacija resursa (Hostinger fix)

- **`src/lib/db.ts`** — KRITIČAN FIX: Prisma singleton se sada čuva i u produkciji (`globalForPrisma.prisma = prisma` bez uslova). Pre ovog fixa, svaki HTTP zahtev u produkciji spawnovao je novi Prisma query engine (Rust child process), direktno uzrokujući prekoračenje Max Processes limita (120/120 na Hostingeru).
- **`next.config.ts`** — KRITIČAN FIX: Uklonjen globalni `no-store` header koji je pokrivao sve URL-ove (`/:path*`). Ostao je samo keš za `/_next/static/`. Sada svaka ruta sama definiše svoju keš strategiju.
- **`src/components/ArchiveThumbnail.tsx`** — Dodat `IntersectionObserver` (rootMargin 200px): `fetch(/api/art/${date})` se poziva samo kada thumbnail uđe u viewport. Pre ovog fixa, N thumbnailova na arhivnoj strani istovremeno slalo N paralelnih zahteva serveru pri učitavanju stranice.
- **`src/app/api/og-image/route.ts`** — Dodat in-memory LRU keš (`Map<string, Buffer>`, max 30 unosa). OG slika je deterministička (isti datum → ista slika zauvek), pa se renderuje samo jednom po procesu. Pre toga, svaki Viber/Telegram share pokretao je puni canvas render + PNG enkodiranje.
- **`src/app/api/art/[date]/route.ts`** — Dodat `Cache-Control: public, max-age=86400, immutable` header. Ruta je deterministička, može se keširati u browseru i CDN-u.
- **`src/app/api/favorites/route.ts`** — Uklonjen `values` iz SELECT za list view. 1000 brojeva po favoritu se sada ne prenosi pri listanju, samo pri otvaranju jednog favorita. Dodat `no-store` header (privatni podaci).
- **`src/app/api/favorites/[id]/route.ts`** — DELETE sada koristi `deleteMany({ where: { id, userId } })` (1 query umesto 2). PATCH koristi `updateMany` sa userId uslovom. Dodat `no-store` header.
- **`src/app/profile/page.tsx`** — `FavoriteCard` sada lazy-load-uje `values` putem `IntersectionObserver` — canvas se popunjava tek kada kartica uđe u viewport, ne odjednom za sve favorite.
- **`src/app/page.tsx`** — `force-dynamic` zamenjen sa `revalidate: 86400` (ISR). Stranica ne sadrži per-request dinamičke podatke.
- **`src/app/archive/page.tsx`** — `force-dynamic` zamenjen sa `revalidate: 3600` (ISR). Lista datuma je čista matematika.

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
