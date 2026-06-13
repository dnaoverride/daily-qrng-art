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
