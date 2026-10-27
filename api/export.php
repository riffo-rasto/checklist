<?php
require __DIR__ . '/config.php';
require __DIR__ . '/xlsx.php';
require __DIR__ . '/lib_report.php';
const EVIDENCE_DIR = '/var/www/noc-storage/evidence/';   // samakan dengan api/evidence.php
need_login();
$from = $_GET['from'] ?? '';
$to = $_GET['to'] ?? '';
$fmt = ($_GET['format'] ?? 'csv') === 'xlsx' ? 'xlsx' : 'csv';
foreach ([$from, $to] as $d) if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) out(['error' => 'Periode tidak valid'], 422);

$PRI = ['P1' => 'P1 – Kritis', 'P2' => 'P2 – Tinggi', 'P3' => 'P3 – Menengah', 'P4' => 'P4 – Rutin', 'END' => 'Penutup shift'];
$s = db()->prepare("SELECT s.tanggal, s.shift, s.putaran, i.id AS item_id, e.id AS entry_id, i.urutan, i.prioritas, i.nama_item, e.status, e.catatan,
        TIME_FORMAT(e.jam_cek, '%H:%i') AS jam, COALESCE(ue.nama, us.nama) AS petugas,
        DATE_FORMAT(e.diisi_pada, '%d/%m/%Y %H:%i') AS diisi
    FROM checklist_sessions s
    JOIN checklist_entries e ON e.session_id = s.id
    JOIN checklist_items i ON i.id = e.item_id
    JOIN users us ON us.id = s.user_id
    LEFT JOIN users ue ON ue.id = e.user_id
    WHERE s.tanggal BETWEEN ? AND ? AND e.status IS NOT NULL
    ORDER BY s.tanggal, FIELD(s.shift, 'Pagi', 'Siang', 'Malam'), s.putaran, i.urutan");
$s->execute([$from, $to]);

$dmy = fn($d) => date('d/m/Y', strtotime($d));
$head = ['Tanggal', 'Shift', 'Prioritas', 'Item Pengecekan', 'Status', 'Catatan / No. Tiket', 'Jam Cek', 'Petugas', 'Diisi Pada'];
// tindak lanjut (update) per entri untuk sheet Masalah
$tl = []; $pen = [];
$uq = db()->prepare("SELECT u.entry_id, u.tindakan, u.selesai, DATE_FORMAT(u.created_at, '%d/%m %H:%i') AS waktu, us.nama AS petugas
    FROM checklist_updates u JOIN checklist_entries e ON e.id = u.entry_id JOIN checklist_sessions s ON s.id = e.session_id JOIN users us ON us.id = u.user_id
    WHERE s.tanggal BETWEEN ? AND ? ORDER BY u.id");
$uq->execute([$from, $to]);
foreach ($uq as $u) { $tl[$u['entry_id']][] = $u['waktu'] . ' ' . $u['petugas'] . ': ' . $u['tindakan']; $pen[$u['entry_id']] = $u['selesai'] ? 'Selesai' : 'Proses'; }
$rows = []; $bad = []; $sum = []; $cols = []; $cell = []; $its = [];
foreach ($s as $r) {
    $st = (string)$r['status'];
    $tgl = $dmy($r['tanggal']);
    $k = $r['tanggal'] . '|' . $r['shift'] . '|' . $r['putaran'];   // satu kolom = satu tanggal + shift + putaran
    $r['shift'] .= $r['putaran'] > 1 ? ' #' . $r['putaran'] : '';    // label "Siang #2" untuk putaran ke-2
    $rows[] = [$tgl, $r['shift'], $PRI[$r['prioritas']], $r['nama_item'], $st, (string)$r['catatan'], (string)$r['jam'], (string)$r['petugas'], (string)$r['diisi']];
    $cols[$k] = substr($tgl, 0, 5) . ' ' . $r['shift'];
    $cell[$r['item_id']][$k] = $st;
    $its[$r['item_id']] = [$r['urutan'], $r['prioritas'], $r['nama_item']];
    $sum[$k] ??= ['t' => $tgl, 's' => $r['shift'], 'p' => [], 'OK' => 0, 'Warning' => 0, 'Down' => 0, 'N/A' => 0, 'n' => 0, 'bad' => []];
    $sum[$k]['p'][(string)$r['petugas']] = 1;
    if (isset($sum[$k][$st])) $sum[$k][$st]++;
    $sum[$k]['n']++;
    if ($st === 'Warning' || $st === 'Down') {
        $bad[] = [$tgl, $r['shift'], $PRI[$r['prioritas']], $r['nama_item'], $st, (string)$r['catatan'], (string)$r['jam'], (string)$r['petugas'],
            implode("\n", $tl[$r['entry_id']] ?? []), $pen[$r['entry_id']] ?? 'Belum'];
        $sum[$k]['bad'][] = $r['nama_item'] . ' [' . $st . ']' . ($r['catatan'] !== '' ? ': ' . $r['catatan'] : '');
    }
}
$name = "rekap_checklist_{$from}_{$to}.$fmt";

if ($fmt === 'csv') {
    // Titik koma + BOM + "sep=;" agar Excel (termasuk pengaturan regional Indonesia) memisah kolom dengan benar
    $safe = fn($v) => preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v;   // cegah formula injection
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$name\"");
    echo "\xEF\xBB\xBFsep=;\r\n";
    $o = fopen('php://output', 'w');
    fputcsv($o, $head, ';', '"', '\\');
    foreach ($rows as $r) fputcsv($o, array_map($safe, $r), ';', '"', '\\');
    exit;
}

// ---- Excel: Ringkasan, Masalah, Matriks, Detail
$meta = 'Periode ' . $dmy($from) . ' s.d. ' . $dmy($to) . ' · diunduh ' . date('d/m/Y H:i') . ' oleh ' . ($_SESSION['nama'] ?? '-');
$sumRows = array_map(fn($v) => [$v['t'], $v['s'], implode(', ', array_keys($v['p'])), $v['OK'], $v['Warning'], $v['Down'], $v['N/A'], $v['n'],
                                $v['bad'] ? implode("\n", $v['bad']) : '-'], array_values($sum));
if (!$bad) $bad = [['Tidak ada Warning / Down pada periode ini', '', '', '', '', '', '', '', '', '']];

// Matriks: baris = semua item aktif (plus item nonaktif yang punya data), kolom = tanggal + shift
foreach (db()->query('SELECT id, urutan, prioritas, nama_item FROM checklist_items WHERE aktif = 1') as $i)
    $its[$i['id']] ??= [$i['urutan'], $i['prioritas'], $i['nama_item']];
uasort($its, fn($a, $b) => $a[0] <=> $b[0]);
$mx = [];
foreach ($its as $id => [$u, $p, $n]) {
    $line = [$p === 'END' ? 'Akhir' : $p, $n];
    foreach (array_keys($cols) as $k) $line[] = $cell[$id][$k] ?? '';
    $mx[] = $line;
}

// Laporan: susunan seperti tampilan web (judul per sesi, item, status berwarna, update tindak lanjut); foto di kolom Foto 1-5
$withFoto = ($_GET['foto'] ?? '1') === '1';
$rep = build_report($from, $to);
$files = [];
if ($withFoto) {
    $ids = [];
    foreach ($rep as $sess) foreach ($sess['rows'] as $r) {
        foreach ($r['ev'] as $i) $ids[] = (int)$i;
        foreach ($r['upd'] as $u) foreach ($u['ev'] as $i) $ids[] = (int)$i;
    }
    if ($ids) foreach (db()->query('SELECT id, file, mime FROM evidence WHERE id IN (' . implode(',', $ids) . ')') as $e) $files[$e['id']] = $e;
}
$fotos = function (array $evIds) use (&$files): array {   // thumbnail untuk kolom Foto 1-5
    $img = [];
    foreach (array_slice($evIds, 0, 5) as $k => $id) {
        if (!isset($files[$id])) continue;
        $t = evidence_thumb(EVIDENCE_DIR . $files[$id]['file'], $files[$id]['mime']);
        if (!$t || !($d = @getimagesizefromstring($t[0]))) continue;
        $sc = min(112 / $d[0], 84 / $d[1]);   // muat dalam kotak 112 x 84 px
        $img[] = [5 + $k, $t[0], $t[1], max(1, (int)round($d[0] * $sc)), max(1, (int)round($d[1] * $sc))];
    }
    return $img;
};
$lap = [];
foreach ($rep as $sess) {
    $nf = 0;
    foreach ($sess['rows'] as $r) { $nf += count($r['ev']); foreach ($r['upd'] as $u) $nf += count($u['ev']); }
    $c = $sess['c'];
    $lap[] = ['banner' => $dmy($sess['tanggal']) . ' · ' . $sess['shift'] . ($sess['putaran'] > 1 ? ' · Putaran ' . $sess['putaran'] : '') . ' · ' . $sess['petugas']
        . "      OK {$c['OK']} · Warning {$c['Warning']} · Down {$c['Down']} · N/A {$c['N/A']} · $nf foto"];
    foreach ($sess['rows'] as $r) {
        $n = count($r['ev']);
        $cells = [$r['item'], $r['status'], $r['catatan'], $r['jam'], $r['petugas'], '', '', '', '', ''];
        if ($n && !$withFoto) $cells[5] = "$n foto (tidak disertakan)";
        $line = ['cells' => $cells, 'img' => $fotos($r['ev'])];
        if ($line['img']) $line['ht'] = 68;
        $lap[] = $line;
        foreach ($r['upd'] as $u) {   // update tindak lanjut tepat di bawah itemnya
            $n2 = count($u['ev']);
            $cells = ['    ↳ Update ' . $u['waktu'] . ' · ' . $u['petugas'], $u['selesai'] ? 'Selesai' : 'Proses', $u['tindakan'], '', '', '', '', '', '', ''];
            if ($n2 && !$withFoto) $cells[5] = "$n2 foto (tidak disertakan)";
            $ul = ['cells' => $cells, 'img' => $fotos($u['ev'])];
            if ($ul['img']) $ul['ht'] = 68;
            $lap[] = $ul;
        }
    }
    $lap[] = ['spacer' => 1];
}
if (!$lap) $lap = [['banner' => 'Tidak ada data pada periode ini']];

$tmp = xlsx_build([
    ['name' => 'Laporan', 'title' => 'LAPORAN CHECKLIST HARIAN NOC', 'sub' => $meta,
     'head' => ['Item pengecekan', 'Status', 'Catatan / No. tiket', 'Jam', 'Petugas', 'Foto 1', 'Foto 2', 'Foto 3', 'Foto 4', 'Foto 5'], 'rows' => $lap,
     'widths' => [42, 11, 30, 8, 14, 17, 17, 17, 17, 17], 'status' => 1, 'center' => [1, 3, 4, 5, 6, 7, 8, 9], 'nofilter' => true],
    ['name' => 'Ringkasan', 'title' => 'RINGKASAN CHECKLIST HARIAN NOC', 'sub' => $meta,
     'head' => ['Tanggal', 'Shift', 'Petugas', 'OK', 'Warning', 'Down', 'N/A', 'Item terisi', 'Item bermasalah (Warning / Down)'], 'rows' => $sumRows,
     'widths' => [13, 10, 26, 9, 10, 9, 9, 12, 70], 'center' => [0, 1, 3, 4, 5, 6, 7]],
    ['name' => 'Masalah', 'title' => 'DAFTAR MASALAH (WARNING & DOWN)', 'sub' => $meta,
     'head' => ['Tanggal', 'Shift', 'Prioritas', 'Item Pengecekan', 'Status', 'Catatan / No. Tiket', 'Jam Cek', 'Petugas', 'Tindak lanjut (update)', 'Penyelesaian'], 'rows' => $bad,
     'widths' => [12, 9, 15, 44, 11, 36, 9, 16, 50, 14], 'status' => [4, 9], 'center' => [0, 1, 2, 6, 9]],
    ['name' => 'Matriks', 'title' => 'MATRIKS STATUS PER ITEM', 'sub' => $meta,
     'head' => array_merge(['Prioritas', 'Item pengecekan'], array_values($cols)), 'rows' => $mx,
     'widths' => array_merge([10, 50], array_fill(0, count($cols), 11)), 'status' => $cols ? range(2, count($cols) + 1) : [],
     'center' => [0], 'fc' => 2],
    ['name' => 'Detail', 'title' => 'REKAP DETAIL CHECKLIST HARIAN NOC', 'sub' => $meta, 'head' => $head, 'rows' => $rows,
     'widths' => [12, 9, 15, 52, 11, 40, 9, 18, 17], 'status' => 4, 'center' => [0, 1, 2, 6, 8]],
]);
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header("Content-Disposition: attachment; filename=\"$name\"");
header('Content-Length: ' . filesize($tmp));
readfile($tmp);
unlink($tmp);
