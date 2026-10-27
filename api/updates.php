<?php
// Update tindak lanjut untuk item Warning / Down: kolom tindakan + foto setelah penanganan.
// Hanya MENAMBAH catatan; status dan catatan asli checklist tidak diubah.
require __DIR__ . '/config.php';
need_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'Hanya POST'], 405);
need_csrf();
const EVIDENCE_DIR = '/var/www/noc-storage/evidence/';   // samakan dengan api/evidence.php
$types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

if (!empty($_POST['entry_id'])) {   // buat update (multipart: entry_id, tindakan, selesai, files[])
    $tindakan = trim($_POST['tindakan'] ?? '');
    if ($tindakan === '' || mb_strlen($tindakan) > 2000) out(['error' => 'Kolom tindakan wajib diisi (maksimal 2000 karakter)'], 422);
    $q = db()->prepare('SELECT id, session_id, item_id, status FROM checklist_entries WHERE id = ?');
    $q->execute([(int)$_POST['entry_id']]);
    $e = $q->fetch();
    if (!$e || !in_array($e['status'], ['Warning', 'Down'], true)) out(['error' => 'Update hanya untuk item berstatus Warning / Down'], 422);
    $c = db()->prepare('SELECT 1 FROM checklist_updates WHERE entry_id = ? AND selesai = 1 LIMIT 1');
    $c->execute([$e['id']]);
    if ($c->fetchColumn()) out(['error' => 'Masalah ini sudah dinyatakan selesai, update ditutup'], 422);

    $files = [];   // validasi semua foto dulu, baru simpan
    $fl = $_FILES['files'] ?? null;
    if ($fl && is_array($fl['name'])) foreach ($fl['name'] as $i => $_) {
        if ($fl['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        if ($fl['error'][$i] !== UPLOAD_ERR_OK) out(['error' => 'Unggah foto gagal (kode ' . $fl['error'][$i] . ')'], 422);
        $tmp = $fl['tmp_name'][$i];
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
        if ($fl['size'][$i] > 8 * 1024 * 1024 || !isset($types[$mime]) || !getimagesize($tmp)) out(['error' => 'Foto harus JPG / PNG / WebP, maksimal 8 MB'], 422);
        $files[] = [$tmp, $mime];
    }
    if (count($files) > 5) out(['error' => 'Maksimal 5 foto per update'], 422);
    if ($files && !is_dir(EVIDENCE_DIR) && !mkdir(EVIDENCE_DIR, 0750, true)) out(['error' => 'Folder penyimpanan evidence belum ada / tidak bisa dibuat'], 500);

    $pdo = db();
    $saved = [];
    $selesai = ($_POST['selesai'] ?? '') === '1';
    try {
        $pdo->beginTransaction();
        $now = date('Y-m-d H:i:s');
        $pdo->prepare('INSERT INTO checklist_updates (entry_id, user_id, tindakan, selesai, created_at) VALUES (?,?,?,?,?)')
            ->execute([$e['id'], $_SESSION['uid'], $tindakan, $selesai ? 1 : 0, $now]);
        $uid = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare('INSERT INTO evidence (session_id, item_id, file, mime, user_id, update_id) VALUES (?,?,?,?,?,?)');
        $evIds = [];
        foreach ($files as [$tmp, $mime]) {
            $name = bin2hex(random_bytes(16)) . '.' . $types[$mime];   // nama acak
            if (!move_uploaded_file($tmp, EVIDENCE_DIR . $name)) throw new RuntimeException('Gagal menyimpan file (cek izin folder evidence)');
            $saved[] = $name;
            $ins->execute([$e['session_id'], $e['item_id'], $name, $mime, $_SESSION['uid'], $uid]);
            $evIds[] = (int)$pdo->lastInsertId();
        }
        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($saved as $n) @unlink(EVIDENCE_DIR . $n);
        out(['error' => $ex instanceof RuntimeException ? $ex->getMessage() : 'Gagal menyimpan update'], 500);
    }
    out(['ok' => true, 'update' => ['id' => $uid, 'tindakan' => $tindakan, 'selesai' => $selesai,
        'waktu' => date('d/m H:i', strtotime($now)), 'petugas' => $_SESSION['nama'] ?? '', 'ev' => $evIds]]);
}

$b = body();   // hapus update: khusus admin
if (($b['action'] ?? '') === 'delete') {
    if (($_SESSION['role'] ?? '') !== 'admin') out(['error' => 'Hanya admin yang boleh menghapus update'], 403);
    $id = (int)($b['id'] ?? 0);
    $q = db()->prepare('SELECT file FROM evidence WHERE update_id = ?');
    $q->execute([$id]);
    foreach ($q->fetchAll() as $r) @unlink(EVIDENCE_DIR . $r['file']);
    db()->prepare('DELETE FROM checklist_updates WHERE id = ?')->execute([$id]);   // baris foto ikut terhapus (CASCADE)
    out(['ok' => true]);
}
out(['error' => 'Aksi tidak dikenal'], 422);
