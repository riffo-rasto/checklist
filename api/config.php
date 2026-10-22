<?php
ini_set('display_errors', '0');
ini_set('log_errors', '1');
date_default_timezone_set('Asia/Jakarta');
// Sesuaikan kredensial database (buat user MySQL khusus, jangan pakai root)
const DB_HOST = 'localhost', DB_NAME = 'noc_checklist', DB_USER = 'noc_user', DB_PASS = 'GANTI_PASSWORD';

if (PHP_SAPI !== 'cli') {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS'])]);
    session_start();
}
function db(): PDO {
    static $p;
    return $p ??= new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
}
function out($d, int $c = 200): void {
    http_response_code($c);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($d);
    exit;
}
function body(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
function need_login(): void { if (empty($_SESSION['uid'])) out(['error' => 'Sesi habis, silakan login ulang'], 401); }
function need_csrf(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) out(['error' => 'Token keamanan tidak valid'], 403);
}
function need_admin(): void {
    need_login();
    $s = db()->prepare("SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND aktif = 1");
    $s->execute([$_SESSION['uid']]);
    if (!$s->fetchColumn()) out(['error' => 'Hanya admin yang boleh mengakses'], 403);
}
