<?php
// Khusus admin: CLEAR item checklist & HAPUS rekap per tanggal + shift, termasuk foto (baris database + file)
require __DIR__ . '/config.php';
need_admin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'Hanya POST'], 405);
need_csrf();
const EVIDENCE_DIR = '/var/www/noc-storage/evidence/';   // samakan dengan api/evidence.php

function drop_evidence(int $sid, array $items = []): int {   // hapus foto: baris database + file di server
    $q = db()->prepare('SELECT id, file FROM evidence WHERE session_id = ?' . ($items ? ' AND item_id IN (' . implode(',', $items) . ')' : ''));
    $q->execute([$sid]);
    $rows = $q->fetchAll();
    foreach ($rows as $r) {
        db()->prepare('DELETE FROM evidence WHERE id = ?')->execute([$r['id']]);
        @unlink(EVIDENCE_DIR . $r['file']);
    }
    return count($rows);
}

$b = body();
$tgl = $b['tanggal'] ?? '';
$sh = $b['shift'] ?? '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tgl) || !in_array($sh, ['Pagi', 'Siang', 'Malam'], true)) out(['error' => 'Tanggal / shift tidak valid'], 422);
$q = db()->prepare('SELECT id FROM checklist_sessions WHERE tanggal = ? AND shift = ?');
$q->execute([$tgl, $sh]);
$sid = (int)$q->fetchColumn();
if (!$sid) out(['ok' => true, 'message' => 'Tidak ada data untuk dibersihkan']);

$act = $b['action'] ?? '';
if ($act === 'clear_items') {   // kosongkan item terpilih (status, catatan, jam, foto); sesi tetap ada
    $ids = array_values(array_filter(array_map('intval', $b['item_ids'] ?? [])));
    if (!$ids) out(['error' => 'Tidak ada item dipilih'], 422);
    db()->prepare('DELETE FROM checklist_entries WHERE session_id = ? AND item_id IN (' . implode(',', $ids) . ')')->execute([$sid]);
    $n = drop_evidence($sid, $ids);
    out(['ok' => true, 'message' => "Dibersihkan ($n foto dihapus)"]);
}
if ($act === 'delete_session') {   // hapus seluruh rekap sesi ini
    $n = drop_evidence($sid);
    db()->prepare('DELETE FROM checklist_sessions WHERE id = ?')->execute([$sid]);   // entri ikut terhapus (CASCADE)
    out(['ok' => true, 'message' => "Rekap dihapus ($n foto ikut dihapus)"]);
}
out(['error' => 'Aksi tidak dikenal'], 422);
