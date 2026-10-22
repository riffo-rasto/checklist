<?php
// Evidence gambar: lihat (GET), unggah (POST multipart), hapus (POST JSON)
require __DIR__ . '/config.php';
require __DIR__ . '/lib_session.php';
need_login();
const EVIDENCE_DIR = '/var/www/noc-storage/evidence/';   // di luar web root, hanya bisa dibuka lewat file ini
$ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

// Item yang sudah disimpan (punya status) terkunci: foto tidak bisa ditambah/dihapus, kecuali oleh admin
function item_locked(int $sid, int $item): bool {
    if (($_SESSION['role'] ?? '') === 'admin') return false;
    $q = db()->prepare('SELECT status FROM checklist_entries WHERE session_id = ? AND item_id = ?');
    $q->execute([$sid, $item]);
    return (bool)$q->fetchColumn();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $q = db()->prepare('SELECT file, mime FROM evidence WHERE id = ?');
    $q->execute([(int)($_GET['id'] ?? 0)]);
    $r = $q->fetch();
    if (!$r || !is_file(EVIDENCE_DIR . $r['file'])) { http_response_code(404); exit; }
    header('Content-Type: ' . $r['mime']);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=86400');
    readfile(EVIDENCE_DIR . $r['file']);
    exit;
}
need_csrf();

if (!empty($_FILES['file'])) {
    $f = $_FILES['file'];
    if ($f['error'] !== UPLOAD_ERR_OK) out(['error' => 'Unggah gagal (kode ' . $f['error'] . '). Cek upload_max_filesize di php.ini'], 422);
    if ($f['size'] > 8 * 1024 * 1024) out(['error' => 'Maksimal 8 MB per gambar'], 422);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!isset($ext[$mime]) || !getimagesize($f['tmp_name'])) out(['error' => 'Hanya gambar JPG, PNG, atau WebP'], 422);
    $tgl = $_POST['tanggal'] ?? '';
    $sh = $_POST['shift'] ?? '';
    $item = (int)($_POST['item_id'] ?? 0);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tgl) || !in_array($sh, ['Pagi', 'Siang', 'Malam'], true)) out(['error' => 'Tanggal / shift tidak valid'], 422);

    $pdo = db();
    $sid = current_session($tgl, $sh, (int)$_SESSION['uid']);   // putaran terbaru; dibuat otomatis kalau belum ada
    if (item_locked((int)$sid, $item)) out(['error' => 'Item sudah disimpan dan terkunci, foto tidak bisa ditambah'], 403);
    $c = $pdo->prepare('SELECT COUNT(*) FROM evidence WHERE session_id = ? AND item_id = ?');
    $c->execute([$sid, $item]);
    if ($c->fetchColumn() >= 5) out(['error' => 'Maksimal 5 gambar per item'], 422);

    if (!is_dir(EVIDENCE_DIR) && !mkdir(EVIDENCE_DIR, 0750, true)) out(['error' => 'Folder penyimpanan evidence belum ada / tidak bisa dibuat'], 500);
    $name = bin2hex(random_bytes(16)) . '.' . $ext[$mime];      // nama acak, nama asli tidak dipakai
    if (!move_uploaded_file($f['tmp_name'], EVIDENCE_DIR . $name)) out(['error' => 'Gagal menyimpan file (cek izin folder evidence)'], 500);
    try {
        $pdo->prepare('INSERT INTO evidence (session_id, item_id, file, mime, user_id) VALUES (?,?,?,?,?)')
            ->execute([$sid, $item, $name, $mime, $_SESSION['uid']]);
    } catch (PDOException $e) {
        unlink(EVIDENCE_DIR . $name);
        out(['error' => 'Item tidak valid'], 422);
    }
    out(['id' => (int)$pdo->lastInsertId()]);
}

// hapus: hanya pengunggah atau admin
$id = (int)(body()['id'] ?? 0);
$q = db()->prepare('SELECT file, user_id, session_id, item_id FROM evidence WHERE id = ?');
$q->execute([$id]);
$r = $q->fetch();
if (!$r) out(['error' => 'Gambar tidak ditemukan'], 404);
if (item_locked((int)$r['session_id'], (int)$r['item_id'])) out(['error' => 'Item sudah disimpan dan terkunci, foto tidak bisa dihapus'], 403);
if ((int)$r['user_id'] !== (int)$_SESSION['uid'] && ($_SESSION['role'] ?? '') !== 'admin') out(['error' => 'Hanya pengunggah atau admin yang boleh menghapus'], 403);
db()->prepare('DELETE FROM evidence WHERE id = ?')->execute([$id]);
@unlink(EVIDENCE_DIR . $r['file']);
out(['ok' => true]);
