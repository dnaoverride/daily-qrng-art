-- Drizzle migracija: User + Favorite (Drizzle ORM, ne Prisma)
-- Pokreni ovaj SQL ako drizzle-kit push ne radi, npr:
--   mysql -u qrng_user -p qrng_db < drizzle/0000_init.sql

CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `password` VARCHAR(191) NULL,
  `image` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `User_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Favorite` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NULL DEFAULT 'Bez naziva',
  `values` JSON NOT NULL,
  `scenarioName` VARCHAR(191) NULL,
  `isPublic` BOOLEAN NOT NULL DEFAULT false,
  `shareToken` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Favorite_shareToken_key` (`shareToken`),
  INDEX `Favorite_userId_idx` (`userId`),
  CONSTRAINT `Favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
