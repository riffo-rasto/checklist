<?php
require __DIR__ . '/config.php';
need_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    need_csrf();
    $b = body();
    $tgl = $b['tanggal'] ?? '';
    $sh = $b['shift'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tgl) || !in_array($sh, ['Pagi', 'Siang', 'Malam'], true))
        out(['error' => 'Tanggal / shift tidak valid'], 422);

    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO checklist_sessions (tanggal, shift, user_id) VALUES (?,?,?)
                   ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)')->execute([$tgl, $sh, $_SESSION['uid']]);
    $q = $pdo->prepare('SELECT id FROM checklist_sessions WHERE tanggal = ? AND shift = ?');
    $q->execute([$tgl, $sh]);
    $sid = $q->fetchColumn();

    $ins = $pdo->prepare('INSERT INTO checklist_entries (session_id, item_id, status, catatan, jam_cek, user_id, diisi_pada) VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          user_id = IF(status <=> VALUES(status) AND catatan <=> VALUES(catatan) AND jam_cek <=> VALUES(jam_cek), user_id, VALUES(user_id)),
          diisi_pada = IF(status <=> VALUES(status) AND catatan <=> VALUES(catatan) AND jam_cek <=> VALUES(jam_cek), diisi_pada, VALUES(diisi_pada)),
          status = VALUES(status), catatan = VALUES(catatan), jam_cek = VALUES(jam_cek)');
    $del = $pdo->prepare('DELETE FROM checklist_entries WHERE session_id = ? AND item_id = ?');
    $chk = $pdo->prepare('SELECT status FROM checklist_entries WHERE session_id = ? AND item_id = ?');
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
    }
    $pdo->commit();
    out(['ok' => true]);
}

$tgl = $_GET['tanggal'] ?? date('Y-m-d');
$sh = $_GET['shift'] ?? 'Pagi';
$s = db()->prepare("SELECT i.id, i.nama_item, i.prioritas, e.status, e.catatan, TIME_FORMAT(e.jam_cek, '%H:%i') AS jam_cek,
        u.nama AS petugas, DATE_FORMAT(e.diisi_pada, '%d/%m %H:%i') AS diisi_pada
    FROM checklist_items i
    LEFT JOIN checklist_sessions s ON s.tanggal = ? AND s.shift = ?
    LEFT JOIN checklist_entries e ON e.session_id = s.id AND e.item_id = i.id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE i.aktif = 1 ORDER BY i.urutan");
$s->execute([$tgl, $sh]);
$items = $s->fetchAll();
$ev = db()->prepare('SELECT v.item_id, v.id FROM evidence v JOIN checklist_sessions s ON s.id = v.session_id WHERE s.tanggal = ? AND s.shift = ? ORDER BY v.id');
$ev->execute([$tgl, $sh]);
$map = [];
foreach ($ev as $r) $map[$r['item_id']][] = (int)$r['id'];
out(['items' => $items, 'evidence' => (object)$map]);
