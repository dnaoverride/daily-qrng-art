# Checklist pre push-a na produkciju

Proveri sve pre `git push origin main`.

---

## 1. Hostinger — Baza (phpMyAdmin)

Baza treba da bude **prazna** — `prisma migrate deploy` kreira sve tabele automatski pri buildu.

Ako želiš da ih napraviš **ručno** (npr. za testiranje pre push-a), u phpMyAdmin → **SQL** tab nalepi i pokreni:

```sql
-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,
    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,
    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Favorite` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL DEFAULT 'Bez naziva',
    `values` JSON NOT NULL,
    `scenarioName` VARCHAR(191) NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `shareToken` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Favorite_shareToken_key`(`shareToken`),
    INDEX `Favorite_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
```

**Napomena:** Ako ručno kreiraš tabele, `prisma migrate deploy` će pri prvom buildu prijaviti da su migracije već primenjene (ili može da padne zbog “table already exists”). Zato je bolje ostaviti bazu **praznu** i pustiti da `prisma migrate deploy` sve uradi.

---

## 2. Hostinger — Environment Variables (Deployments panel)

U **hPanel > Deployments > Environment Variables** dodaj:

| Key | Vrednost | Napomena |
|-----|----------|----------|
| `DATABASE_URL` | `mysql://KORISNIK:LOZINKA@localhost:3306/IME_BAZE` | Iz hPanel > Databases |
| `AUTH_SECRET` | `openssl rand -base64 32` ili [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) | Obavezno novi za produkciju |
| `NEXTAUTH_URL` | `https://qrng-art.dnasoftwaresolutions.com` | Bez trailing slash-a |

---

## 3. Lokalno — pre push-a

- [ ] `npm run build` prolazi lokalno
- [ ] Nema `console.log` sa lozinkama ili tajnim podacima
- [ ] `.env.local` nije commitovan (gitignored)
- [ ] Migracije su u repou (`prisma/migrations/`)

---

## 4. Push

```bash
git add .
git status   # proveri da nema .env ili .env.local
git commit -m "Add migrations, deploy checklist"
git push origin main
```

---

## Redosled radnji (jednom)

1. Kreirati korisnika i bazu u Hostinger hPanel > Databases  
2. Ostaviti bazu praznu (bez ručno kreiranih tabela)  
3. U Deployments dodati `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`  
4. Pushovati na `main`  
5. Pratiti build u Hostinger Deployments panelu
