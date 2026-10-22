<?php
// CRUD item checklist: hanya admin
require __DIR__ . '/config.php';
need_admin();
const PRIS = "'P1','P2','P3','P4','END'";

// Posisi baru = tepat setelah item terakhir di kelompok prioritasnya (urutan lain digeser)
function place(PDO $p, string $pri): int {
    $q = $p->prepare('SELECT COALESCE(MAX(urutan), 0) FROM checklist_items WHERE FIELD(prioritas, ' . PRIS . ') <= FIELD(?, ' . PRIS . ')');
    $q->execute([$pri]);
    $pos = (int)$q->fetchColumn() + 1;
    $p->prepare('UPDATE checklist_items SET urutan = urutan + 1 WHERE urutan >= ?')->execute([$pos]);
    return $pos;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_csrf();
    $b = body();
    $act = $b['action'] ?? '';
    $id = (int)($b['id'] ?? 0);
    $nama = trim($b['nama_item'] ?? '');
    $pri = $b['prioritas'] ?? '';
    $aktif = empty($b['aktif']) ? 0 : 1;
    $pdo = db();

    if ($act === 'create' || $act === 'update') {
        if ($nama === '' || mb_strlen($nama) > 255) out(['error' => 'Nama item wajib diisi (maksimal 255 karakter)'], 422);
        if (!in_array($pri, ['P1', 'P2', 'P3', 'P4', 'END'], true)) out(['error' => 'Prioritas tidak valid'], 422);
    }
    if ($act === 'create') {
        $pdo->beginTransaction();
        $pos = place($pdo, $pri);
        $pdo->prepare('INSERT INTO checklist_items (nama_item, prioritas, urutan, aktif) VALUES (?,?,?,?)')->execute([$nama, $pri, $pos, $aktif]);
        $pdo->commit();
        out(['ok' => true]);
    }
    if ($act === 'update') {
        $q = $pdo->prepare('SELECT prioritas FROM checklist_items WHERE id = ?');
        $q->execute([$id]);
        $old = $q->fetchColumn();
        if ($old === false) out(['error' => 'Item tidak ditemukan'], 404);
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE checklist_items SET nama_item = ?, prioritas = ?, aktif = ? WHERE id = ?')->execute([$nama, $pri, $aktif, $id]);
        if ($old !== $pri) {   // pindah kelompok: taruh di akhir kelompok baru
            $pdo->prepare('UPDATE checklist_items SET urutan = 0 WHERE id = ?')->execute([$id]);
            $pos = place($pdo, $pri);
            $pdo->prepare('UPDATE checklist_items SET urutan = ? WHERE id = ?')->execute([$pos, $id]);
        }
        $pdo->commit();
        out(['ok' => true]);
    }
    if ($act === 'move') {   // tukar urutan dengan tetangga di kelompok yang sama
        $up = ($b['dir'] ?? 0) < 0;
        $q = $pdo->prepare('SELECT id, urutan, prioritas FROM checklist_items WHERE id = ?');
        $q->execute([$id]);
        $me = $q->fetch();
        if (!$me) out(['error' => 'Item tidak ditemukan'], 404);
        $q = $pdo->prepare('SELECT id, urutan FROM checklist_items WHERE prioritas = ? AND urutan ' . ($up ? '< ? ORDER BY urutan DESC' : '> ? ORDER BY urutan ASC') . ' LIMIT 1');
        $q->execute([$me['prioritas'], $me['urutan']]);
        if ($nb = $q->fetch()) {
            $pdo->beginTransaction();
            $u = $pdo->prepare('UPDATE checklist_items SET urutan = ? WHERE id = ?');
            $u->execute([$nb['urutan'], $me['id']]);
            $u->execute([$me['urutan'], $nb['id']]);
            $pdo->commit();
        }
        out(['ok' => true]);
    }
    if ($act === 'delete') {
        try {
            $pdo->prepare('DELETE FROM checklist_items WHERE id = ?')->execute([$id]);
            out(['ok' => true, 'message' => 'Item dihapus']);
        } catch (PDOException $e) {   // sudah punya riwayat (foreign key) -> nonaktifkan saja
            $pdo->prepare('UPDATE checklist_items SET aktif = 0 WHERE id = ?')->execute([$id]);
            out(['ok' => true, 'message' => 'Item sudah punya riwayat checklist, jadi dinonaktifkan (tidak dihapus)']);
        }
    }
    out(['error' => 'Aksi tidak dikenal'], 422);
}
out(['items' => db()->query('SELECT id, nama_item, prioritas, urutan, aktif FROM checklist_items ORDER BY urutan')->fetchAll()]);
