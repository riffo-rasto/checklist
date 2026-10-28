<?php
// Manajemen pengguna: hanya admin
require __DIR__ . '/config.php';
need_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_csrf();
    $b = body();
    if (($b['action'] ?? '') === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if ($id === (int)$_SESSION['uid']) out(['error' => 'Akun sendiri tidak boleh dihapus'], 422);
        try {
            db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
            out(['ok' => true, 'message' => 'Pengguna dihapus']);
        } catch (PDOException $e) {   // punya riwayat checklist -> nonaktifkan saja
            db()->prepare('UPDATE users SET aktif = 0 WHERE id = ?')->execute([$id]);
            out(['ok' => true, 'message' => 'Pengguna punya riwayat checklist, jadi dinonaktifkan (tidak dihapus)']);
        }
    }
    $role = in_array($b['role'] ?? '', ['admin', 'noc', 'teknis'], true) ? $b['role'] : 'noc';
    $nama = trim($b['nama'] ?? '');
    $pw = $b['password'] ?? '';
    if ($nama === '') out(['error' => 'Nama wajib diisi'], 422);
    if ($pw !== '' && strlen($pw) < 8) out(['error' => 'Password minimal 8 karakter'], 422);

    if (($b['action'] ?? '') === 'create') {
        $un = trim($b['username'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $un)) out(['error' => 'Username 3-50 karakter: huruf, angka, _ . -'], 422);
        if ($pw === '') out(['error' => 'Password wajib diisi'], 422);
        try {
            db()->prepare('INSERT INTO users (username, nama, password_hash, role) VALUES (?,?,?,?)')
                ->execute([$un, $nama, password_hash($pw, PASSWORD_DEFAULT), $role]);
        } catch (PDOException $e) {
            out(['error' => 'Username sudah dipakai'], 409);
        }
        out(['ok' => true]);
    }

    $id = (int)($b['id'] ?? 0);
    $aktif = empty($b['aktif']) ? 0 : 1;
    if ($id === (int)$_SESSION['uid'] && ($role !== 'admin' || !$aktif))
        out(['error' => 'Akun sendiri tidak boleh diturunkan atau dinonaktifkan'], 422);
    $sql = 'UPDATE users SET nama = ?, role = ?, aktif = ?' . ($pw !== '' ? ', password_hash = ?' : '') . ' WHERE id = ?';
    $args = [$nama, $role, $aktif];
    if ($pw !== '') $args[] = password_hash($pw, PASSWORD_DEFAULT);
    $args[] = $id;
    db()->prepare($sql)->execute($args);
    out(['ok' => true]);
}

out(['users' => db()->query('SELECT id, username, nama, role, aktif FROM users ORDER BY username')->fetchAll()]);
