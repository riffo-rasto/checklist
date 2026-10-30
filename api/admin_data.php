<?php
// Khusus admin:
//  - clear_checklist : kosongkan checklist (mulai putaran baru). Data yang sudah tersimpan TETAP ada di rekap.
//  - delete_session  : HAPUS rekap satu sesi secara permanen, termasuk foto (baris database + file)
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/checklist_session.php';
need_admin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'Hanya POST'], 405);
need_csrf();

function drop_evidence(array $rows): int {   // hapus foto: baris database + file di server
    foreach ($rows as $r) {
        db()->prepare('DELETE FROM evidence WHERE id = ?')->execute([$r['id']]);
        @unlink(EVIDENCE_DIR . $r['file']);
    }
    return count($rows);
}

$b = body();
$act = $b['action'] ?? '';

if ($act === 'clear_checklist') {
    $tgl = $b['tanggal'] ?? '';
    $sh = $b['shift'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tgl) || !in_array($sh, ['Pagi', 'Siang', 'Malam'], true)) out(['error' => 'Tanggal / shift tidak valid'], 422);
    $sid = current_session($tgl, $sh, (int)$_SESSION['uid'], false);
    if (!$sid) out(['ok' => true, 'message' => 'Checklist sudah kosong']);

    // foto dari item yang tidak pernah disimpan tidak termasuk rekap mana pun, jadi dibuang agar tidak tertinggal di server
    $q = db()->prepare('SELECT v.id, v.file FROM evidence v WHERE v.session_id = ? AND v.update_id IS NULL AND NOT EXISTS
        (SELECT 1 FROM checklist_entries e WHERE e.session_id = v.session_id AND e.item_id = v.item_id AND e.status IS NOT NULL)');
    $q->execute([$sid]);
    drop_evidence($q->fetchAll());

    $c = db()->prepare('SELECT COUNT(*) FROM checklist_entries WHERE session_id = ? AND status IS NOT NULL');
    $c->execute([$sid]);
    if ((int)$c->fetchColumn() > 0) {   // ada data tersimpan: biarkan di rekap, buka putaran baru yang kosong
        db()->prepare('INSERT INTO checklist_sessions (tanggal, shift, user_id, putaran) SELECT tanggal, shift, ?, putaran + 1 FROM checklist_sessions WHERE id = ?')
            ->execute([$_SESSION['uid'], $sid]);
        out(['ok' => true, 'message' => 'Checklist dikosongkan. Data sebelumnya tetap tersimpan di rekap.']);
    }
    out(['ok' => true, 'message' => 'Checklist dikosongkan']);
}

if ($act === 'delete_entry') {   // hapus SATU item dari rekap: foto (file + baris), update, dan entrinya
    $id = (int)($b['id'] ?? 0);
    $q = db()->prepare('SELECT session_id, item_id FROM checklist_entries WHERE id = ?');
    $q->execute([$id]);
    $e = $q->fetch();
    if (!$e) out(['ok' => true, 'message' => 'Item sudah tidak ada']);
    $q = db()->prepare('SELECT id, file FROM evidence WHERE session_id = ? AND item_id = ?');   // foto biasa + foto milik update item ini
    $q->execute([$e['session_id'], $e['item_id']]);
    $n = drop_evidence($q->fetchAll());
    db()->prepare('DELETE FROM checklist_entries WHERE id = ?')->execute([$id]);   // update ikut terhapus (CASCADE)
    out(['ok' => true, 'message' => "Item dihapus ($n foto ikut dihapus)"]);
}
if ($act === 'delete_session') {
    $id = (int)($b['id'] ?? 0);
    $q = db()->prepare('SELECT id, file FROM evidence WHERE session_id = ?');
    $q->execute([$id]);
    $n = drop_evidence($q->fetchAll());
    db()->prepare('DELETE FROM checklist_sessions WHERE id = ?')->execute([$id]);   // entri ikut terhapus (CASCADE)
    out(['ok' => true, 'message' => "Rekap dihapus ($n foto ikut dihapus)"]);
}
out(['error' => 'Aksi tidak dikenal'], 422);
