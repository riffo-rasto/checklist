<?php
// Data rekap bersama (dipakai tampilan web dan export Excel): per tanggal + shift, lengkap dengan id evidence
function build_report(string $from, string $to): array {
    $ss = db()->prepare("SELECT s.id, s.tanggal, s.shift, u.nama AS petugas FROM checklist_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.tanggal BETWEEN ? AND ? ORDER BY s.tanggal, FIELD(s.shift, 'Pagi', 'Siang', 'Malam')");
    $ss->execute([$from, $to]);
    $out = [];
    foreach ($ss as $r) $out[$r['id']] = $r + ['c' => ['OK' => 0, 'Warning' => 0, 'Down' => 0, 'N/A' => 0]];

    $rows = [];
    if ($out) {
        $in = implode(',', array_map('intval', array_keys($out)));   // id dari database sendiri
        $q = db()->query("SELECT e.session_id, i.id AS item_id, i.urutan, i.nama_item, e.status, e.catatan,
                TIME_FORMAT(e.jam_cek, '%H:%i') AS jam, u.nama AS petugas
            FROM checklist_entries e JOIN checklist_items i ON i.id = e.item_id LEFT JOIN users u ON u.id = e.user_id
            WHERE e.session_id IN ($in)");
        foreach ($q as $r)
            $rows[$r['session_id']][$r['item_id']] = ['u' => (int)$r['urutan'], 'item' => $r['nama_item'], 'status' => (string)$r['status'],
                'catatan' => (string)$r['catatan'], 'jam' => (string)$r['jam'], 'petugas' => $r['petugas'] ?? $out[$r['session_id']]['petugas'], 'ev' => []];
        $ev = db()->query("SELECT v.id, v.session_id, v.item_id, i.urutan, i.nama_item FROM evidence v
            JOIN checklist_items i ON i.id = v.item_id WHERE v.session_id IN ($in) ORDER BY v.id");
        foreach ($ev as $r) {   // item yang hanya punya gambar (belum ada status) tetap ditampilkan
            $rows[$r['session_id']][$r['item_id']] ??= ['u' => (int)$r['urutan'], 'item' => $r['nama_item'], 'status' => '', 'catatan' => '',
                'jam' => '', 'petugas' => $out[$r['session_id']]['petugas'], 'ev' => []];
            $rows[$r['session_id']][$r['item_id']]['ev'][] = (int)$r['id'];
        }
    }
    $res = [];
    foreach ($out as $sid => $s) {
        $list = $rows[$sid] ?? [];
        if (!$list) continue;
        usort($list, fn($a, $b) => $a['u'] <=> $b['u']);
        foreach ($list as $r) if (isset($s['c'][$r['status']])) $s['c'][$r['status']]++;
        $s['rows'] = array_map(fn($r) => array_diff_key($r, ['u' => 1]), $list);
        unset($s['id']);
        $res[] = $s;
    }
    return $res;
}
