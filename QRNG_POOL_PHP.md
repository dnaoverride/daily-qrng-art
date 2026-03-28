# QRNG Pool — PHP Cron + MySQL Cache

## Zašto

ANU QRNG API je besplatan javni servis bez garantovanog rate limita. Direktan poziv pri svakom korisničkom kliku na „Nasumični QRNG" troši API kvotu i usporava odgovor (~1–2s). Rešenje: PHP cron skripta tiho puni MySQL bazen unapred preuzetim setovima; Next.js `/api/generate` samo čita iz baze.

---

## Arhitektura

```
Cron (svaki 1 min)
  └── refill.php
        ├── broji neiskorišćene setove u qrng_pool
        ├── ako count < 50 → 1× fetch ANU API → INSERT
        └── briše stare iskorišćene redove (>7 dana)

Korisnik klikne "Nasumični QRNG"
  └── Next.js GET /api/generate
        ├── SELECT najstariji neiskorišćeni red iz qrng_pool
        ├── UPDATE used=1, usedAt=NOW()
        └── fallback: crypto.randomBytes ako je pool prazan
```

---

## Baza podataka: tabela `qrng_pool`

### Kreiranje (phpMyAdmin → SQL tab → Execute)

```sql
CREATE TABLE IF NOT EXISTS `qrng_pool` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `values`    JSON         NOT NULL,
  `fetchedAt` DATETIME(3)  NOT NULL,
  `usedAt`    DATETIME(3)  NULL,
  `used`      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `qrng_pool_used_idx` (`used`, `fetchedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Nema drizzle-kit migracije na produkciji** — tabela se kreira jednom ručno.

### Veličina na disku

- 1 set = 1000 × uint16 = ~2 KB JSON
- 50 setova = ~100 KB
- 100 setova = ~200 KB (zanemarljivo)

---

## PHP skripta: `~/qrng-pool/refill.php`

Skripta je **van Next.js projekta** — smeštena direktno na Hostinger serveru, npr. `~/qrng-pool/refill.php`.

```php
<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');

echo "[START] " . date('Y-m-d H:i:s') . "\n";
flush();

define('POOL_MIN', 50);
define('DB_HOST',  'auth-db1575.hstgr.io');  // ← Hostinger remote DB host
define('DB_NAME',  'YOUR_DB_NAME');            // ← popuni
define('DB_USER',  'YOUR_DB_USER');            // ← popuni
define('DB_PASS',  'YOUR_DB_PASS');            // ← popuni

echo "[STEP 1] Connecting to DB: " . DB_HOST . " / " . DB_NAME . "\n";
flush();

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "[STEP 1] DB connected OK\n";
    flush();
} catch (PDOException $e) {
    echo "[ERROR] DB connect failed: " . $e->getMessage() . "\n";
    exit(1);
}

echo "[STEP 2] Counting unused sets in pool...\n";
flush();

$count = (int)$pdo->query("SELECT COUNT(*) FROM qrng_pool WHERE used = 0")->fetchColumn();
echo "[STEP 2] Pool has $count unused sets (min " . POOL_MIN . ")\n";
flush();

if ($count >= POOL_MIN) {
    echo "[OK] Pool full. Nothing to do.\n";
    exit(0);
}

echo "[STEP 3] Fetching from ANU QRNG API via cURL...\n";
flush();

$url = "https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_USERAGENT      => 'qrng-art/1.0 (+php-cron; respectful-rate)',
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true,
]);
$raw      = curl_exec($ch);
$errno    = curl_errno($ch);
$errmsg   = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "[STEP 3] cURL done. HTTP: $httpCode, errno: $errno, errmsg: '$errmsg'\n";
echo "[STEP 3] Raw response (first 300 chars): " . substr((string)$raw, 0, 300) . "\n";
flush();

if ($raw === false || $errno !== 0) {
    echo "[WARN] ANU fetch failed (cURL $errno: $errmsg). Will retry next run.\n";
    exit(1);
}

echo "[STEP 4] Decoding JSON...\n";
flush();

$obj = json_decode($raw, true);
echo "[STEP 4] success=" . json_encode($obj['success'] ?? null) . ", data count=" . count($obj['data'] ?? []) . "\n";
flush();

if (
    empty($obj['success'])
    || !isset($obj['data'])
    || !is_array($obj['data'])
    || count($obj['data']) !== 1000
) {
    echo "[WARN] Invalid ANU response.\n";
    exit(1);
}

echo "[STEP 5] Inserting into qrng_pool...\n";
flush();

$values = json_encode(array_map('intval', $obj['data']));
$stmt = $pdo->prepare(
    "INSERT INTO qrng_pool (`values`, fetchedAt, used) VALUES (?, NOW(3), 0)"
);
$stmt->execute([$values]);
echo "[STEP 5] Insert OK\n";
flush();

$deleted = $pdo->exec(
    "DELETE FROM qrng_pool WHERE used = 1 AND fetchedAt < NOW() - INTERVAL 7 DAY"
);

$newCount = $count + 1;
echo "[OK] Done. Pool: $count -> $newCount / " . POOL_MIN . ". Cleaned: $deleted old rows.\n";
```

---

## Hostinger: Cron Job podešavanje

1. Hostinger panel → **Hosting** → tvoj nalog → **Advanced** → **Cron Jobs**
2. Dodaj novi cron:

| Polje    | Vrednost                                                                        |
|----------|---------------------------------------------------------------------------------|
| Command  | `/usr/bin/php /home/KORISNIK/qrng-pool/refill.php >> /home/KORISNIK/qrng-pool/refill.log 2>&1` |
| Minute   | `*`                                                                             |
| Hour     | `*`                                                                             |
| Day      | `*`                                                                             |
| Month    | `*`                                                                             |
| Weekday  | `*`                                                                             |

> Zameni `KORISNIK` sa tvojim Hostinger korisničkim imenom.

### Log praćenje

```bash
tail -f ~/qrng-pool/refill.log
```

Tipičan izlaz kada je pool pun:
```
[OK] Pool has 50 sets (min 50). Nothing to do.
```

Tipičan izlaz kada puni:
```
[OK] Inserted 1 set. Pool: 49 → 50 / 50. Cleaned: 0 old rows.
```

---

## Next.js: `/api/generate/route.ts`

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qrng_pool } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { randomEntropySeed } from "@/lib/qrng-server";

export async function GET() {
  try {
    // Uzmi najstariji neiskorišćeni set iz pool-a
    const [row] = await db
      .select()
      .from(qrng_pool)
      .where(eq(qrng_pool.used, false))
      .orderBy(asc(qrng_pool.fetchedAt))
      .limit(1);

    if (row) {
      await db.update(qrng_pool)
        .set({ used: true, usedAt: new Date() })
        .where(eq(qrng_pool.id, row.id));

      const values = Array.isArray(row.values)
        ? row.values
        : JSON.parse(row.values as string) as number[];

      return NextResponse.json({ values, source: "qrng" });
    }
  } catch (e) {
    console.error("qrng_pool read error:", e);
  }

  // Fallback: kriptografski slučajni brojevi (ne kvantni, ali reproducibilni za datu sesiju)
  return NextResponse.json({ values: randomEntropySeed(), source: "entropy" });
}
```

---

## Drizzle schema: `src/lib/schema.ts`

Dodati pored postojećih tabela:

```ts
import { int } from "drizzle-orm/mysql-core";

export const qrng_pool = mysqlTable("qrng_pool", {
  id:        int("id").autoincrement().primaryKey(),
  values:    json("values").notNull().$type<number[]>(),
  fetchedAt: datetime("fetchedAt", { fsp: 3 }).notNull(),
  usedAt:    datetime("usedAt",    { fsp: 3 }),
  used:      boolean("used").notNull().default(false),
}, (t) => [index("qrng_pool_used_idx").on(t.used, t.fetchedAt)]);
```

> Tabela se kreira SQL skriptom u phpMyAdmin (vidi gore), **ne** drizzle-kit migrate.

---

## Inicijalno punjenje

Posle kreiranja tabele i podešavanja crona, pool se puni automatski:
- Svake minute: 1 set
- Do 50 setova: ~50 minuta
- Posle toga: cron proverava ali ništa ne radi dok ima ≥50 neiskorišćenih setova

Za brže inicijalno punjenje, možeš ručno pokrenuti skriptu više puta uzastopno iz SSH-a:

```bash
for i in $(seq 1 50); do php ~/qrng-pool/refill.php; sleep 2; done
```

---

## Bezbednost

- Fajl `refill.php` je van web root-a (`~/qrng-pool/`, nije u `public_html`) — nije dostupan putem HTTP-a
- DB kredencijali su hardcoded u fajlu koji nije u git repozitorijumu
- ANU API se poziva max 1×/minuti (konzervativno, ne preopterećuje servis)
