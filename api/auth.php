<?php
require __DIR__ . '/config.php';
$a = $_GET['action'] ?? 'me';
if ($a === 'login') {
    $b = body();
    $s = db()->prepare('SELECT * FROM users WHERE username = ? AND aktif = 1');
    $s->execute([trim($b['username'] ?? '')]);
    $u = $s->fetch();
    if (!$u || !password_verify($b['password'] ?? '', $u['password_hash'])) out(['error' => 'Username atau password salah'], 401);
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    $_SESSION['nama'] = $u['nama'];
    $_SESSION['role'] = $u['role'];
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
} elseif ($a === 'logout') {
    need_login(); need_csrf();
    session_destroy();
    out(['ok' => true]);
}
if (empty($_SESSION['uid'])) out(['login' => false]);
out(['login' => true, 'nama' => $_SESSION['nama'], 'role' => $_SESSION['role'], 'csrf' => $_SESSION['csrf']]);
