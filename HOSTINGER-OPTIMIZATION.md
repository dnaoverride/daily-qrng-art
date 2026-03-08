# Hostinger Optimization Guide

Ovaj dokument definiše pravila i best practices za deploy aplikacije na Hostinger Node.js Business hosting. **Svaka nova izmena treba da prođe proveru u skladu sa ovim dokumentom.**

---

## 1. Ograničenja Hostinger Business plana

| Resurs | Limit | Implikacije |
|--------|-------|-------------|
| Node.js procesi | ~120 max | PM2 cluster 2–3 workera preporučeno |
| MySQL konekcije | ~25–50 po nalogu | Ograničiti pool po procesu (npr. 3) |
| CPU | Shared, throttled | Izbegavati CPU-heavy operacije u request path |
| IOPS | Ograničen | Minimizovati disk I/O |
| Memorija | Shared | In-memory kešovi ograničeni |

---

## 2. Arhitektura i resursi

### 2.1 Prisma singleton i connection pool
- **Obavezno:** Jedna instanca `PrismaClient` po procesu (singleton preko `globalThis`)
- **Obavezno:** `connection_limit=3` i `pool_timeout=10` u `DATABASE_URL` ili `datasources.db.url`
- Računica: 3 PM2 workera × 3 konekcije = 9 konekcija ka MySQL (ostaje rezerva)

### 2.2 Next.js konfiguracija
- `serverExternalPackages`: `["@napi-rs/canvas", "@prisma/client", "bcryptjs"]` — ne uklanjati
- `poweredByHeader: false` — sigurnosno, ne odaje stack
- `compress: false` — Hostinger/nginx radi gzip, izbegavati duplu kompresiju

### 2.3 In-memory keš
- `og-image` pngCache: do 30 PNG-ova u memoriji. Na PM2 cluster-u **svaki worker ima sopstvenu kopiju** — nema deljenog keša. Pri prvom zahtevu po workeru, mora se izrenderovati PNG.
- Cache eviction: FIFO (najstariji ključ). Za „danas“ sliku: ako je već u kešu, cache hit.

---

## 3. Pravila za stranice i API rute

### 3.1 Stranice — ISR umesto force-dynamic

| Stranica | `revalidate` | Razlog |
|----------|--------------|--------|
| `/` (home) | `86400` (24h) | Shell statičan, art se učitava client-side |
| `/archive` | `3600` (1h) | Lista datuma bez DB upita |
| `/art/[date]` | `86400` (24h) | Deterministički sadržaj po datumu |
| `/create-art` | — | Client-only, interaktivan |
| `/profile` | — | Auth + DB, user-specific |
| `/f/[token]` | `3600` (1h) | Javni share link, podaci se retko menjaju |

**Pravilo:** Ako stranica nema per-request user-specific podatke, koristiti ISR.

### 3.2 API rute — Cache-Control

| Ruta | Cache-Control | Razlog |
|------|---------------|--------|
| `/api/art/[date]` | `public, max-age=86400, s-maxage=86400, immutable` | Deterministički podaci |
| `/api/og-image` | `public, max-age=3600, s-maxage=86400` | PNG za share |
| `/api/generate` | — | Svaki poziv treba svežu entropiju |
| `/api/favorites`, `/api/favorites/[id]` | `no-store` | User-specific |

**Pravilo:** Privatne rute (auth, favorites) moraju imati `Cache-Control: no-store`.

### 3.3 Lazy loading
- **ArchiveThumbnail:** `IntersectionObserver` — fetch `/api/art/${date}` tek kad kartica uđe u viewport
- **Profile FavoriteCard:** Lazy load `values` kad kartica uđe u viewport
- Izbegavati N simultanih API poziva pri učitavanju stranice

---

## 4. Zabranjena praksa

- **NIKAD** `force-dynamic` na stranicama koje mogu biti keširane
- **NIKAD** globalni `Cache-Control: no-store` u `next.config.ts`
- **NIKAD** višestruko kreiranje `PrismaClient` (mora singleton)
- **NIKAD** fetch svih `values` za favorites list — uvek `select` bez `values` za list view
- **NIKAD** `DELETE` + `findUnique` — koristiti `deleteMany` sa `userId` u `where`
- **NIKAD** redundantni API pozivi posle lokalno ažuriranih podataka (npr. `loadFavorites()` posle `PATCH` — koristiti response)

---

## 5. Checklist pre deploymenta

- [ ] `next build` prolazi bez grešaka
- [ ] `prisma generate` i `prisma db push` / `prisma migrate deploy` izvršeni
- [ ] `DATABASE_URL` sadrži `connection_limit=3&pool_timeout=10` (ili je dodato u `PrismaClient` datasources)
- [ ] `.env` varijable podešene na Hostingeru (NEXTAUTH_SECRET, AUTH_SECRET, DATABASE_URL, NEXT_PUBLIC_SITE_URL)
- [ ] PM2 konfiguracija: max 2–3 instance
- [ ] Proveriti da `@napi-rs/canvas` native binary radi na Hostinger Linux (glibc kompatibilnost)
- [ ] Testirati OG image: `/api/og-image?date=YYYY-MM-DD` vraća PNG
- [ ] Testirati share link: `/f/[token]` za javni favorit

---

## 6. Monitoring i dijagnoza

### Resursi na Hostingeru
- **Max Processes:** ako dosegne limit, smanjiti PM2 instance ili povećati revalidate intervale
- **IOPS spike:** proveriti da li ima previše disk reada (npr. `node_modules` bez standalone builda)
- **CPU spike:** proveriti `/api/generate` (ANU fetch), `/api/og-image` (render), bcrypt pri registraciji

### Logovi
- Prisma loguje samo `error` u produkciji
- `[og-image]` greške u konzoli
- NextAuth greške pri login/register

### Česti problemi
| Simptom | Moguća uzroka |
|---------|----------------|
| 504 Gateway Timeout | CPU overload, predugački request |
| DB connection refused | Iskorišćen connection pool ili MySQL limit |
| OG slika ne radi | `@napi-rs/canvas` native addon ne radi na serveru |
| Spor login | bcrypt cost factor 12, shared CPU |

---

## 7. Buduće poboljšanja (nisk prioritet)

- **Rate limiting** na `/api/generate` — zaštita od ANU API abuse
- **LRU cache** za og-image umesto FIFO (evict najmanje korišćene, ne najstarije)
- **Server-side** generisanje vrednosti za `/art/[date]` i home — eliminacija dodatnog API round-tripa (ArtPageContent/DailyArtSection)

---

## 8. Referenca

- [README.md](README.md) — opšta dokumentacija
- [SCENARIOS.md](SCENARIOS.md) — izmene scenarija
