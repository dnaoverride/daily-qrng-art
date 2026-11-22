-- Kvantna slika dana (2026-11-22). Samo DODAJE tabelu — ništa ne briše.
-- Pokreni u phpMyAdmin-u (Hostinger) i lokalno (DBCode). NE koristiti drizzle-kit push.

CREATE TABLE IF NOT EXISTS `daily_art` (
  `date` VARCHAR(10) NOT NULL,
  `values` JSON NOT NULL,
  `source` VARCHAR(16) NOT NULL,
  `fetchedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
