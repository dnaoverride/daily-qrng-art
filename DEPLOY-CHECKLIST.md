# Checklist pre push-a na produkciju

Proveri sve pre `git push origin main`.

---

## 1. Hostinger — Baza (phpMyAdmin)

Baza ne mora da bude prazna, ali mora da ima tabele koje app koristi (`User`, `Favorite`, `qrng_pool`).
Deploy na Hostingeru ne pokreće automatski `npm run db:push`.

Ako želiš da ih napraviš **ručno** (npr. za testiranje pre push-a), u phpMyAdmin → **SQL** tab nalepi i pokreni:

```sql
CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `password` VARCHAR(191) NULL,
  `image` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Favorite` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NULL DEFAULT 'Bez naziva',
  `values` JSON NOT NULL,
  `scenarioName` VARCHAR(191) NULL,
  `isPublic` TINYINT(1) NOT NULL DEFAULT 0,
  `shareToken` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Favorite_userId_idx` (`userId`),
  UNIQUE KEY `Favorite_shareToken_unique` (`shareToken`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opciono: kolona za pun algoritamski preset (L2 favorites)
-- ALTER TABLE `Favorite` ADD COLUMN `algoPreset` JSON NULL AFTER `scenarioName`;

CREATE TABLE IF NOT EXISTS `qrng_pool` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `values` JSON NOT NULL,
  `fetchedAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `qrng_pool_used_idx` (`used`, `fetchedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Napomena:** Ako u istoj bazi postoje stare Prisma tabele (`Account`, `Session`, `VerificationToken`, `_prisma_migrations`), one nisu potrebne za trenutni runtime i mogu ostati dok ih ne očistiš planski.

---

## 2. Hostinger — Environment Variables (Deployments panel)

U **hPanel > Deployments > Environment Variables** dodaj:

| Key | Vrednost | Napomena |
|-----|----------|----------|
| `DATABASE_URL` | `mysql://KORISNIK:LOZINKA@HOST:3306/IME_BAZE` | Host, user i baza iz hPanel > Databases |
| `AUTH_SECRET` | `openssl rand -base64 32` ili [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) | Obavezno novi za produkciju |
| `NEXTAUTH_SECRET` | isto kao `AUTH_SECRET` | Preporučeno zbog Auth.js kompatibilnosti |
| `NEXTAUTH_URL` | `https://qrng-art.com` | Bez trailing slash-a |
| `STUDIO_POOL_RESERVE` | *(opciono)* broj | Studio „Izvuci" ne uzima iz bazena kad je slobodnih redova ovoliko ili manje. Bez nje: `60`. |
| `DAILY_QUANTUM_FROM` | *(opciono)* `YYYY-MM-DD` | Prvi dan kvantne slike dana (`daily_art`). Bez nje: `2026-03-04` (cela arhiva kvantna). Vidi korak 2b. |
| `NEXT_PUBLIC_RENDER_V2_FROM` | *(opciono)* `YYYY-MM-DD` | Bez nje: `2000-01-01` → cela arhiva u v2. Postaviti samo ako treba vratiti stare datume na v1. Vidi korak 2a. |

### 2b. Kvantna slika dana (`daily_art`)

- [ ] U phpMyAdmin-u pokreni [`drizzle/0001_daily_art.sql`](drizzle/0001_daily_art.sql) (samo pravi tabelu `daily_art`, ništa ne briše). **Ne `drizzle-kit push`.**
- [ ] Cron `qrng-pool/refill.php` (ANU API v2): kopija na serveru van `public_html` sa popunjenim `DB_PASS` i `ANU_API_KEY`, hPanel → Cron Jobs `0 3,15 * * *`. Ručno pokreni jednom: treba da ispiše „Upisano 10 redova".
- [ ] Proveri da `qrng_pool` ima slobodnih redova (`SELECT COUNT(*) FROM qrng_pool WHERE used = 0`) i da cron `qrng-pool/refill.php` radi. Svaki dan troši jedan red (cela arhiva od 2026-03-04 ≈ 265 redova, vezuju se postepeno dok se arhiva otvara), plus svako „Izvuci" u Studiju. Stanje 2026-11-22: 500 slobodnih.
- [ ] Datum prelaska: podrazumevano `2026-03-04` (početak arhive → **sve slike u arhivi se menjaju**, odluka 2026-11-22), ili env `DAILY_QUANTUM_FROM`.
- [ ] Posle deploy-a otvori naslovnu: ispod slike treba da piše „Izvor: ANU QRNG … brojevi preuzeti …". U `daily_art` treba da postoji red za današnji datum sa `source = pool`.

### 2a. Render v2 (pri spajanju grane `claude` u `main`)

- [ ] **Odluka 2026-11-19: cela arhiva prelazi na v2** (podrazumevano `2000-01-01` u `src/lib/render-version.ts`) — env promenljiva nije potrebna
- [ ] Ako u Hostinger Environment Variables postoji stara `NEXT_PUBLIC_RENDER_V2_FROM`, obriši je ili postavi na `2000-01-01` **pre** build-a (vrednost se inline-uje u build)
- [ ] Posle deploy-a: sve slike u arhivi (i thumbnailovi, URL `&r=2.x`) su v2; stari OG preview-i na društvenim mrežama mogu ostati keširani kod njih
- [ ] Ne menjati ništa u `src/lib/scenarios/v1/`
- [ ] Ako je izgled v2 menjan od poslednjeg deploy-a: povećaj v2 u `RENDER_REVISION` (`src/lib/render-version.ts`), da browser/CDN ne služe stare thumbnailove

---

## 3. Lokalno — pre push-a

- [ ] `npm run build` prolazi lokalno
- [ ] Nema `console.log` sa lozinkama ili tajnim podacima
- [ ] `.env.local` nije commitovan (gitignored)
- [ ] `src/lib/schema.ts` i `drizzle.config.ts` su usklađeni
- [ ] Ako si menjao šemu: `npm run db:push` je prošao nad ciljnom bazom

---

## 4. Hostinger — Pre push-a (workaround za NPROC spike)

Pre `git push` da izbegneš 503 zbog max procesa (120):

- [ ] **hPanel → Hosting Plan → Resources Usage** → klikni **"Stop running processes"**

Time se gasi stare Node procese pre nego što novi build krene, da ne bi stari + novi build workers prešli limit.

---

## 5. Push

```bash
git add .
git status   # proveri da nema .env ili .env.local
git commit -m "Add migrations, deploy checklist"
git push origin main
```

---

## Redosled radnji (jednom)

1. Kreirati korisnika i bazu u Hostinger hPanel > Databases  
2. U Deployments dodati `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`  
3. Jednom inicijalizovati tabele (`npm run db:push` ili ručni SQL iz ovog dokumenta)  
4. **Pre svakog push-a:** Resources Usage → Stop running processes  
5. Pushovati na `main`  
6. Pratiti build u Hostinger Deployments panelu
