<?php
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/access.php';
require __DIR__ . '/lib/checklist_session.php';
need_login(); need_app('noc');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_csrf();
    $b = body();
    $tgl = $b['tanggal'] ?? '';
    $sh = $b['shift'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tgl) || !in_array($sh, ['Pagi', 'Siang', 'Malam'], true))
        out(['error' => 'Tanggal / shift tidak valid'], 422);

    $sid = current_session($tgl, $sh, (int)$_SESSION['uid']);   // putaran terbaru untuk tanggal + shift
    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE checklist_sessions SET user_id = ? WHERE id = ?')->execute([$_SESSION['uid'], $sid]);

    $ins = $pdo->prepare('INSERT INTO checklist_entries (session_id, item_id, status, catatan, jam_cek, user_id, diisi_pada) VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          user_id = IF(status <=> VALUES(status) AND catatan <=> VALUES(catatan) AND jam_cek <=> VALUES(jam_cek), user_id, VALUES(user_id)),
          diisi_pada = IF(status <=> VALUES(status) AND catatan <=> VALUES(catatan) AND jam_cek <=> VALUES(jam_cek), diisi_pada, VALUES(diisi_pada)),
          status = VALUES(status), catatan = VALUES(catatan), jam_cek = VALUES(jam_cek)');
    $del = $pdo->prepare('DELETE FROM checklist_entries WHERE session_id = ? AND item_id = ?');
    $chk = $pdo->prepare('SELECT status FROM checklist_entries WHERE session_id = ? AND item_id = ?');
    $ids = [];   // id entri yang tersimpan (dipakai tombol Update)
    foreach ($b['entries'] ?? [] as $e) {
        $chk->execute([$sid, (int)($e['item_id'] ?? 0)]);
        if ($chk->fetchColumn() && ($_SESSION['role'] ?? '') !== 'admin') {   // item yang sudah tersimpan terkunci (kecuali admin)
            $pdo->rollBack();
            out(['error' => 'Item ini sudah disimpan dan terkunci'], 403);
        }
        $st = in_array($e['status'] ?? '', ['OK', 'Warning', 'Down', 'N/A'], true) ? $e['status'] : null;
        $ct = trim($e['catatan'] ?? '');
        if (in_array($st, ['Warning', 'Down'], true) && $ct === '') {
            $pdo->rollBack();
            out(['error' => 'Catatan wajib diisi untuk status Warning / Down'], 422);
        }
        $jam = preg_match('/^\d{2}:\d{2}$/', $e['jam_cek'] ?? '') ? $e['jam_cek'] : null;
        if ($st === null) $jam = null;   // tanpa status, jam tidak disimpan
        if ($st === null && $ct === '' && $jam === null) { $del->execute([$sid, (int)$e['item_id']]); continue; }   // item dikosongkan
        // user_id & diisi_pada hanya berubah kalau isi item berubah (lihat IF(...) di query)
        $ins->execute([$sid, (int)$e['item_id'], $st, $ct, $jam, $_SESSION['uid'], date('Y-m-d H:i:s')]);
        $chk2 = $pdo->prepare('SELECT id FROM checklist_entries WHERE session_id = ? AND item_id = ?');
        $chk2->execute([$sid, (int)$e['item_id']]);
        $ids[(int)$e['item_id']] = (int)$chk2->fetchColumn();
    }
    $pdo->commit();
    out(['ok' => true, 'ids' => (object)$ids]);
}

$tgl = $_GET['tanggal'] ?? date('Y-m-d');
$sh = $_GET['shift'] ?? 'Pagi';
$s = db()->prepare("SELECT i.id, e.id AS entry_id, i.nama_item, i.prioritas, e.status, e.catatan, TIME_FORMAT(e.jam_cek, '%H:%i') AS jam_cek,
        u.nama AS petugas, DATE_FORMAT(e.diisi_pada, '%d/%m %H:%i') AS diisi_pada
    FROM checklist_items i
    LEFT JOIN checklist_sessions s ON s.tanggal = ? AND s.shift = ? AND s.putaran = (SELECT MAX(x.putaran) FROM checklist_sessions x WHERE x.tanggal = ? AND x.shift = ?)
    LEFT JOIN checklist_entries e ON e.session_id = s.id AND e.item_id = i.id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE i.aktif = 1 ORDER BY i.urutan");
$s->execute([$tgl, $sh, $tgl, $sh]);
$items = $s->fetchAll();
$sid = current_session($tgl, $sh, (int)$_SESSION['uid'], false);
$map = []; $updmap = [];
if ($sid) {
    $ev = db()->prepare('SELECT item_id, id FROM evidence WHERE session_id = ? AND update_id IS NULL ORDER BY id');
    $ev->execute([$sid]);
    foreach ($ev as $r) $map[$r['item_id']][] = (int)$r['id'];
    // update tindak lanjut (item Warning / Down) beserta foto-fotonya
    $uq = db()->prepare("SELECT u.id, u.entry_id, u.tindakan, u.selesai, DATE_FORMAT(u.created_at, '%d/%m %H:%i') AS waktu, us.nama AS petugas
        FROM checklist_updates u JOIN checklist_entries e ON e.id = u.entry_id JOIN users us ON us.id = u.user_id
        WHERE e.session_id = ? ORDER BY u.id");
    $uq->execute([$sid]);
    $pos = [];
    foreach ($uq as $u) {
        $updmap[$u['entry_id']][] = ['id' => (int)$u['id'], 'tindakan' => $u['tindakan'], 'selesai' => (bool)$u['selesai'],
            'waktu' => $u['waktu'], 'petugas' => $u['petugas'], 'ev' => []];
        $pos[(int)$u['id']] = [$u['entry_id'], count($updmap[$u['entry_id']]) - 1];
    }
    $ue = db()->prepare('SELECT id, update_id FROM evidence WHERE session_id = ? AND update_id IS NOT NULL ORDER BY id');
    $ue->execute([$sid]);
    foreach ($ue as $r) if (isset($pos[(int)$r['update_id']])) { [$en, $ix] = $pos[(int)$r['update_id']]; $updmap[$en][$ix]['ev'][] = (int)$r['id']; }
}
out(['items' => $items, 'evidence' => (object)$map, 'updates' => (object)$updmap]);
