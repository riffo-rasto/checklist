<?php
// Aplikasi Teknikal: laporan pekerjaan teknisi (CRUD + foto + dashboard). Akses: admin dan teknis.
require __DIR__ . '/config.php';
require __DIR__ . '/lib_access.php';
need_login();
need_app('teknikal');
const TEK_DIR = '/var/www/noc-storage/teknikal/';   // di luar web root; foto hanya lewat file ini setelah login
const T_STATUS = ['Open', 'In Progress', 'Selesai'];
const T_JENIS = ['Preventive', 'Corrective', 'Instalasi', 'Survey', 'Lainnya'];
$uid = (int)$_SESSION['uid'];
$types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

function laporan(int $id): ?array {
    $q = db()->prepare('SELECT l.*, k.nama AS kategori, u.nama AS teknisi FROM tek_laporan l
        LEFT JOIN tek_kategori k ON k.id = l.kategori_id JOIN users u ON u.id = l.user_id WHERE l.id = ?');
    $q->execute([$id]);
    return $q->fetch() ?: null;
}
function can_edit(array $l): bool { return ($_SESSION['role'] ?? '') === 'admin' || (int)$l['user_id'] === (int)$_SESSION['uid']; }
function need_edit(?array $l): array {
    if (!$l) out(['error' => 'Laporan tidak ditemukan'], 404);
    if (!can_edit($l)) out(['error' => 'Hanya pembuat laporan atau admin yang boleh mengubah'], 403);
    return $l;
}
$isDate = fn($d) => (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$d);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['foto'])) {   // tampilkan foto
        $q = db()->prepare('SELECT file, mime FROM tek_foto WHERE id = ?');
        $q->execute([(int)$_GET['foto']]);
        $r = $q->fetch();
        if (!$r || !is_file(TEK_DIR . $r['file'])) { http_response_code(404); exit; }
        header('Content-Type: ' . $r['mime']);
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=86400');
        readfile(TEK_DIR . $r['file']);
        exit;
    }
    $act = $_GET['action'] ?? '';
    if ($act === 'kategori') out(['kategori' => db()->query('SELECT id, nama FROM tek_kategori WHERE aktif = 1 ORDER BY nama')->fetchAll()]);
    if ($act === 'kategori_all') {
        need_admin();
        out(['kategori' => db()->query('SELECT k.id, k.nama, k.aktif, (SELECT COUNT(*) FROM tek_laporan l WHERE l.kategori_id = k.id) AS dipakai FROM tek_kategori k ORDER BY k.nama')->fetchAll()]);
    }
    if ($act === 'dashboard') {
        $c = db()->query("SELECT COUNT(*) AS total, SUM(status = 'Open') AS op, SUM(status = 'In Progress') AS pr, SUM(status = 'Selesai') AS se FROM tek_laporan")->fetch();
        $kat = db()->query("SELECT COALESCE(k.nama, '(tanpa kategori)') AS nama, COUNT(*) AS n FROM tek_laporan l LEFT JOIN tek_kategori k ON k.id = l.kategori_id GROUP BY k.id, k.nama ORDER BY n DESC")->fetchAll();
        $rec = db()->query("SELECT l.id, l.tanggal, l.lokasi, l.judul, l.status, u.nama AS teknisi FROM tek_laporan l JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 8")->fetchAll();
        out(['total' => (int)$c['total'], 'open' => (int)$c['op'], 'progress' => (int)$c['pr'], 'selesai' => (int)$c['se'], 'kategori' => $kat, 'recent' => $rec]);
    }
    if ($act === 'list') {
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        if (!$isDate($from) || !$isDate($to)) out(['error' => 'Periode tidak valid'], 422);
        $st = in_array($_GET['status'] ?? '', T_STATUS, true) ? $_GET['status'] : '';
        $kat = (int)($_GET['kategori'] ?? 0);
        $q = trim($_GET['q'] ?? ''); $like = '%' . $q . '%';
        $mine = !empty($_GET['mine']) ? $uid : 0;
        $s = db()->prepare("SELECT l.id, l.tanggal, l.lokasi, k.nama AS kategori, l.jenis, l.judul, l.status, u.nama AS teknisi,
                (SELECT COUNT(*) FROM tek_foto f WHERE f.laporan_id = l.id) AS foto
            FROM tek_laporan l LEFT JOIN tek_kategori k ON k.id = l.kategori_id JOIN users u ON u.id = l.user_id
            WHERE l.tanggal BETWEEN ? AND ? AND (? = '' OR l.status = ?) AND (? = 0 OR l.kategori_id = ?)
              AND (? = '' OR l.judul LIKE ? OR l.lokasi LIKE ? OR l.uraian LIKE ?) AND (? = 0 OR l.user_id = ?)
            ORDER BY l.tanggal DESC, l.id DESC LIMIT 500");
        $s->execute([$from, $to, $st, $st, $kat, $kat, $q, $like, $like, $like, $mine, $mine]);
        out(['rows' => $s->fetchAll()]);
    }
    if ($act === 'get') {
        $l = laporan((int)($_GET['id'] ?? 0));
        if (!$l) out(['error' => 'Laporan tidak ditemukan'], 404);
        $f = db()->prepare('SELECT id, jenis FROM tek_foto WHERE laporan_id = ? ORDER BY id');
        $f->execute([$l['id']]);
        out(['laporan' => $l, 'fotos' => $f->fetchAll(), 'can_edit' => can_edit($l)]);
    }
    out(['error' => 'Aksi tidak dikenal'], 422);
}

need_csrf();
$b = !empty($_POST) ? $_POST : body();   // multipart (foto) atau JSON
$act = $b['action'] ?? '';

if ($act === 'save') {
    $id = (int)($b['id'] ?? 0);
    $tgl = $b['tanggal'] ?? ''; $lok = trim($b['lokasi'] ?? ''); $jud = trim($b['judul'] ?? '');
    $ura = trim($b['uraian'] ?? ''); $tin = trim($b['tindakan'] ?? '');
    $jenis = in_array($b['jenis'] ?? '', T_JENIS, true) ? $b['jenis'] : 'Corrective';
    $st = in_array($b['status'] ?? '', T_STATUS, true) ? $b['status'] : 'Open';
    $kat = (int)($b['kategori_id'] ?? 0) ?: null;
    if (!$isDate($tgl) || $lok === '' || $jud === '' || mb_strlen($lok) > 150 || mb_strlen($jud) > 200 || mb_strlen($ura) > 5000 || mb_strlen($tin) > 5000)
        out(['error' => 'Tanggal, lokasi, dan judul wajib diisi (lokasi maks. 150, judul maks. 200 karakter)'], 422);
    $now = date('Y-m-d H:i:s');
    try {
        if ($id) {
            need_edit(laporan($id));
            db()->prepare('UPDATE tek_laporan SET tanggal = ?, lokasi = ?, kategori_id = ?, jenis = ?, judul = ?, uraian = ?, tindakan = ?, status = ?, updated_at = ? WHERE id = ?')
                ->execute([$tgl, $lok, $kat, $jenis, $jud, $ura, $tin, $st, $now, $id]);
        } else {
            db()->prepare('INSERT INTO tek_laporan (tanggal, lokasi, kategori_id, jenis, judul, uraian, tindakan, status, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
                ->execute([$tgl, $lok, $kat, $jenis, $jud, $ura, $tin, $st, $uid, $now]);
            $id = (int)db()->lastInsertId();
        }
    } catch (PDOException $e) { out(['error' => 'Kategori tidak valid'], 422); }
    out(['ok' => true, 'id' => $id]);
}

if ($act === 'status') {
    $l = need_edit(laporan((int)($b['id'] ?? 0)));
    if (!in_array($b['status'] ?? '', T_STATUS, true)) out(['error' => 'Status tidak valid'], 422);
    db()->prepare('UPDATE tek_laporan SET status = ?, updated_at = ? WHERE id = ?')->execute([$b['status'], date('Y-m-d H:i:s'), $l['id']]);
    out(['ok' => true]);
}

if ($act === 'foto') {   // multipart: laporan_id, jenis, files[]
    $l = need_edit(laporan((int)($b['laporan_id'] ?? 0)));
    $jenis = in_array($b['jenis'] ?? '', ['Sebelum', 'Sesudah', 'Lainnya'], true) ? $b['jenis'] : 'Lainnya';
    $files = [];
    $fl = $_FILES['files'] ?? null;
    if ($fl && is_array($fl['name'])) foreach ($fl['name'] as $i => $_) {
        if ($fl['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        if ($fl['error'][$i] !== UPLOAD_ERR_OK) out(['error' => 'Unggah foto gagal (kode ' . $fl['error'][$i] . ')'], 422);
        $tmp = $fl['tmp_name'][$i];
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
        if ($fl['size'][$i] > 8 * 1024 * 1024 || !isset($types[$mime]) || !getimagesize($tmp)) out(['error' => 'Foto harus JPG / PNG / WebP, maksimal 8 MB'], 422);
        $files[] = [$tmp, $mime];
    }
    if (!$files) out(['error' => 'Tidak ada foto yang dikirim'], 422);
    $c = db()->prepare('SELECT COUNT(*) FROM tek_foto WHERE laporan_id = ?');
    $c->execute([$l['id']]);
    if ((int)$c->fetchColumn() + count($files) > 20) out(['error' => 'Maksimal 20 foto per laporan'], 422);
    if (!is_dir(TEK_DIR) && !mkdir(TEK_DIR, 0750, true)) out(['error' => 'Folder penyimpanan foto Teknikal belum ada / tidak bisa dibuat'], 500);
    $saved = []; $ids = [];
    try {
        $ins = db()->prepare('INSERT INTO tek_foto (laporan_id, jenis, file, mime, user_id, created_at) VALUES (?,?,?,?,?,?)');
        foreach ($files as [$tmp, $mime]) {
            $name = bin2hex(random_bytes(16)) . '.' . $types[$mime];
            if (!move_uploaded_file($tmp, TEK_DIR . $name)) throw new RuntimeException('Gagal menyimpan file (cek izin folder teknikal)');
            $saved[] = $name;
            $ins->execute([$l['id'], $jenis, $name, $mime, $uid, date('Y-m-d H:i:s')]);
            $ids[] = (int)db()->lastInsertId();
        }
    } catch (Throwable $ex) {
        foreach ($saved as $n) @unlink(TEK_DIR . $n);
        out(['error' => $ex instanceof RuntimeException ? $ex->getMessage() : 'Gagal menyimpan foto'], 500);
    }
    out(['ok' => true, 'ids' => $ids]);
}

if ($act === 'delete_foto') {
    $q = db()->prepare('SELECT file, laporan_id FROM tek_foto WHERE id = ?');
    $q->execute([(int)($b['id'] ?? 0)]);
    $r = $q->fetch();
    if (!$r) out(['ok' => true]);
    need_edit(laporan((int)$r['laporan_id']));
    db()->prepare('DELETE FROM tek_foto WHERE id = ?')->execute([(int)$b['id']]);
    @unlink(TEK_DIR . $r['file']);
    out(['ok' => true]);
}

if ($act === 'delete') {   // hapus laporan beserta foto: khusus admin
    need_admin();
    $id = (int)($b['id'] ?? 0);
    $q = db()->prepare('SELECT file FROM tek_foto WHERE laporan_id = ?');
    $q->execute([$id]);
    foreach ($q->fetchAll() as $r) @unlink(TEK_DIR . $r['file']);
    db()->prepare('DELETE FROM tek_laporan WHERE id = ?')->execute([$id]);   // baris foto ikut terhapus (CASCADE)
    out(['ok' => true]);
}

if ($act === 'kategori_save') {
    need_admin();
    $id = (int)($b['id'] ?? 0); $nm = trim($b['nama'] ?? ''); $ak = empty($b['aktif']) ? 0 : 1;
    if ($nm === '' || mb_strlen($nm) > 60) out(['error' => 'Nama kategori wajib diisi (maksimal 60 karakter)'], 422);
    try {
        if ($id) db()->prepare('UPDATE tek_kategori SET nama = ?, aktif = ? WHERE id = ?')->execute([$nm, $ak, $id]);
        else db()->prepare('INSERT INTO tek_kategori (nama, aktif) VALUES (?,?)')->execute([$nm, $ak]);
    } catch (PDOException $e) { out(['error' => 'Nama kategori sudah dipakai'], 409); }
    out(['ok' => true]);
}
if ($act === 'kategori_delete') {
    need_admin();
    $id = (int)($b['id'] ?? 0);
    try {
        db()->prepare('DELETE FROM tek_kategori WHERE id = ?')->execute([$id]);
        out(['ok' => true, 'message' => 'Kategori dihapus']);
    } catch (PDOException $e) {   // sudah dipakai laporan -> nonaktifkan saja
        db()->prepare('UPDATE tek_kategori SET aktif = 0 WHERE id = ?')->execute([$id]);
        out(['ok' => true, 'message' => 'Kategori sudah dipakai laporan, jadi dinonaktifkan (tidak dihapus)']);
    }
}
out(['error' => 'Aksi tidak dikenal'], 422);
