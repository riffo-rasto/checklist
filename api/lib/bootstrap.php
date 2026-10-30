<?php
// Dimuat paling awal oleh setiap endpoint (dan bin/create_user.php): pengaturan PHP, config.php, konstanta, helper, sesi.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require __DIR__ . '/../config.php';
if (function_exists('db')) {   // config.php lama (masih berisi fungsi) akan bentrok dengan lib/helpers.php
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    exit(json_encode(['error' => 'api/config.php masih versi lama. Ganti dengan versi baru dan salin hanya nilai DB_* (lihat README, bagian Memperbarui aplikasi).']));
}
// Lokasi foto: di luar web root, hanya bisa dibuka lewat endpoint setelah login (bisa diganti dari config.php)
defined('EVIDENCE_DIR') || define('EVIDENCE_DIR', '/var/www/noc-storage/evidence/');
defined('TEK_DIR') || define('TEK_DIR', '/var/www/noc-storage/teknikal/');
require __DIR__ . '/helpers.php';

if (PHP_SAPI !== 'cli') {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS'])]);
    session_start();
}
