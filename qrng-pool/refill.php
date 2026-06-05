<?php
/**
 * QRNG Pool Refill
 * Pokreće se svakih 1 minut putem Hostinger Cron Jobs.
 * Fetchuje 1 set od ANU QRNG API-ja ako je pool ispod POOL_MIN.
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
echo "[START] " . date('Y-m-d H:i:s') . "\n";
flush();

define('POOL_MIN', 500);   // minimalan broj neiskorišćenih setova u bazi
define('DB_HOST',  'auth-db1575.hstgr.io');
define('DB_NAME',  'u565895409_qrng');   // ← popuni
define('DB_USER',  'u565895409_qrng');   // ← popuni
define('DB_PASS',  '');   // ← popuni

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
echo "[STEP 3] Fetching from ANU QRNG API...\n";
flush();
$url = "https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_USERAGENT      => 'qrng-art/1.0 (+php-cron; respectful-rate)',
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_VERBOSE        => false,
]);
$raw    = curl_exec($ch);
$errno  = curl_errno($ch);
$errmsg = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo "[STEP 3] cURL done. HTTP code: $httpCode, errno: $errno, errmsg: '$errmsg'\n";
echo "[STEP 3] Raw response (first 300 chars): " . substr((string)$raw, 0, 300) . "\n";
flush();
if ($raw === false || $errno !== 0) {
    echo "[WARN] ANU fetch failed (cURL $errno: $errmsg). Will retry next run.\n";
    exit(1);
}
echo "[STEP 4] Decoding JSON...\n";
flush();
$obj = json_decode($raw, true);
echo "[STEP 4] json_decode result: success=" . json_encode($obj['success'] ?? null) . ", data count=" . count($obj['data'] ?? []) . "\n";
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
