<?php

declare(strict_types=1);

/**
 * QRNG Art — dopuna qrng_pool iz ANU Quantum Numbers API (v2) za Hostinger cron.
 *
 * Jedan poziv: type=hex16, length=1024, size=10 → 1024 bloka × 10 brojeva = 10.240 pravih
 * kvantnih uint16 → 10 redova po 1000 brojeva (ostatak od 240 se odbacuje).
 * Besplatno je 100 poziva mesečno; cron 2× dnevno = ~60 poziva/mes, do 20 redova dnevno.
 *
 * Cron (hPanel → Cron Jobs):   0 3,15 * * *   php /putanja/do/refill.php
 *
 * ⚠ DB_PASS i ANU_API_KEY popuni SAMO u kopiji na serveru (van public_html).
 *   U repou moraju ostati prazni — nikad ne commituj pravu lozinku ili ključ.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const DB_HOST = 'auth-db1575.hstgr.io';
const DB_NAME = 'u565895409_qrng';
const DB_USER = 'u565895409_qrng';
const DB_PASS = '';            // ← popuni na serveru
const ANU_API_KEY = '';        // ← popuni na serveru

const POOL_MIN = 500;          // dopunjuj dok je slobodnih redova manje od ovoga
const SET_SIZE = 1000;         // brojeva po redu (koliko troši jedna slika)
const ANU_LENGTH = 1024;       // blokova po pozivu (max 1024)
const ANU_BLOCK = 10;          // uint16 brojeva po bloku (max 10)

if (DB_PASS === '' || trim(ANU_API_KEY) === '') {
    fwrite(STDERR, "[ERROR] Popuni DB_PASS i ANU_API_KEY u refill.php na serveru.\n");
    exit(1);
}

echo '[START] ' . date('Y-m-d H:i:s') . "\n";

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $count = (int) $pdo->query('SELECT COUNT(*) FROM qrng_pool WHERE used = 0')->fetchColumn();
    echo "[POOL] {$count} slobodnih redova, cilj " . POOL_MIN . ".\n";

    if ($count >= POOL_MIN) {
        echo "[OK] Bazen je pun, ANU se ne zove.\n";
        exit(0);
    }

    $url = 'https://api.quantumnumbers.anu.edu.au/?length=' . ANU_LENGTH . '&type=hex16&size=' . ANU_BLOCK;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'x-api-key: ' . trim(ANU_API_KEY)],
        CURLOPT_USERAGENT => 'qrng-art/1.0',
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    unset($ch);

    if ($raw === false) {
        throw new RuntimeException('ANU zahtev nije uspeo: ' . $curlError);
    }
    if ($httpCode !== 200) {
        throw new RuntimeException("ANU je vratio HTTP {$httpCode}: " . substr((string) $raw, 0, 200));
    }

    $response = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $blocks = $response['data'] ?? null;
    if (($response['success'] ?? null) !== true || !is_array($blocks) || count($blocks) !== ANU_LENGTH) {
        throw new RuntimeException('ANU nije vratio ' . ANU_LENGTH . ' blokova.');
    }

    // Svaki blok: 40 hex znakova = 10 × 4 hex = 10 uint16 (0–65535).
    $numbers = [];
    foreach ($blocks as $block) {
        if (!is_string($block) || !preg_match('/^[0-9a-f]{' . (4 * ANU_BLOCK) . '}$/i', $block)) {
            throw new RuntimeException('ANU blok nije u hex16 formatu.');
        }
        foreach (str_split($block, 4) as $hex) {
            $numbers[] = (int) hexdec($hex);
        }
    }

    $sets = intdiv(count($numbers), SET_SIZE);   // 10240 → 10 redova
    $stmt = $pdo->prepare('INSERT INTO qrng_pool (`values`, fetchedAt, used) VALUES (?, NOW(3), 0)');
    $pdo->beginTransaction();
    for ($i = 0; $i < $sets; $i++) {
        $stmt->execute([json_encode(array_slice($numbers, $i * SET_SIZE, SET_SIZE), JSON_THROW_ON_ERROR)]);
    }
    $pdo->commit();
    echo "[OK] Upisano {$sets} redova (" . count($numbers) . " kvantnih brojeva iz jednog poziva).\n";

    // Brojevi vezanih dana su kopirani u daily_art, pa stari iskorišćeni redovi nisu potrebni.
    $deleted = $pdo->exec('DELETE FROM qrng_pool WHERE used = 1 AND fetchedAt < NOW() - INTERVAL 7 DAY');
    echo "[OK] Obrisano {$deleted} starih iskorišćenih redova.\n";
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . "\n");
    exit(1);
}
