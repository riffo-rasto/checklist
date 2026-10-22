<?php
// Jalankan lewat terminal: php create_user.php admin "Nama Lengkap" password admin
require __DIR__ . '/config.php';
if (PHP_SAPI !== 'cli') exit('CLI only');
[, $u, $n, $p, $r] = $argv + [null, null, null, null, 'petugas'];
if (!$u || !$n || !$p) exit("Pemakaian: php create_user.php username \"Nama\" password [admin|petugas]\n");
db()->prepare('INSERT INTO users (username, nama, password_hash, role) VALUES (?,?,?,?)')
    ->execute([$u, $n, password_hash($p, PASSWORD_DEFAULT), $r === 'admin' ? 'admin' : 'petugas']);
echo "User dibuat\n";
