<?php
// Data rekap bersama (dipakai tampilan web dan export Excel): per tanggal + shift (+ putaran).
// Hanya item yang sudah DISIMPAN (punya status) yang masuk rekap; foto ikut hanya kalau itemnya sudah disimpan.
// Setiap item Warning/Down membawa daftar update tindak lanjutnya ('upd').
function build_report(string $from, string $to, string $shift = '', string $pet = ''): array {
    $ss = db()->prepare("SELECT s.id, s.tanggal, s.shift, s.putaran, u.nama AS petugas FROM checklist_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.tanggal BETWEEN ? AND ? AND (? = '' OR s.shift = ?) ORDER BY s.tanggal, FIELD(s.shift, 'Pagi', 'Siang', 'Malam'), s.putaran");
    $ss->execute([$from, $to, $shift, $shift]);
    $out = [];
    foreach ($ss as $r) $out[$r['id']] = $r + ['c' => ['OK' => 0, 'Warning' => 0, 'Down' => 0, 'N/A' => 0]];

    $rows = [];
    if ($out) {
        $in = implode(',', array_map('intval', array_keys($out)));   // id dari database sendiri
        $q = db()->query("SELECT e.id AS entry_id, e.session_id, i.id AS item_id, i.urutan, i.nama_item, e.status, e.catatan,
                TIME_FORMAT(e.jam_cek, '%H:%i') AS jam, u.nama AS petugas
            FROM checklist_entries e JOIN checklist_items i ON i.id = e.item_id LEFT JOIN users u ON u.id = e.user_id
            WHERE e.session_id IN ($in) AND e.status IS NOT NULL");
        foreach ($q as $r)
            $rows[$r['session_id']][$r['item_id']] = ['eid' => (int)$r['entry_id'], 'u' => (int)$r['urutan'], 'item' => $r['nama_item'], 'status' => (string)$r['status'],
                'catatan' => (string)$r['catatan'], 'jam' => (string)$r['jam'], 'petugas' => $r['petugas'] ?? $out[$r['session_id']]['petugas'],
                'ev' => [], 'upd' => []];

        $umap = [];   // id update -> [sesi, item, indeks]
        $uq = db()->query("SELECT u.id, e.session_id, e.item_id, u.tindakan, u.selesai, DATE_FORMAT(u.created_at, '%d/%m %H:%i') AS waktu, us.nama AS petugas
            FROM checklist_updates u JOIN checklist_entries e ON e.id = u.entry_id JOIN users us ON us.id = u.user_id
            WHERE e.session_id IN ($in) ORDER BY u.id");
        foreach ($uq as $u) {
            if (!isset($rows[$u['session_id']][$u['item_id']])) continue;
            $rows[$u['session_id']][$u['item_id']]['upd'][] = ['id' => (int)$u['id'], 'tindakan' => $u['tindakan'], 'selesai' => (bool)$u['selesai'],
                'waktu' => $u['waktu'], 'petugas' => $u['petugas'], 'ev' => []];
            $umap[(int)$u['id']] = [$u['session_id'], $u['item_id'], count($rows[$u['session_id']][$u['item_id']]['upd']) - 1];
        }
        foreach (db()->query("SELECT id, session_id, item_id, update_id FROM evidence WHERE session_id IN ($in) ORDER BY id") as $r) {
            if ($r['update_id'] === null) {   // foto biasa: hanya untuk item yang sudah disimpan
                if (isset($rows[$r['session_id']][$r['item_id']])) $rows[$r['session_id']][$r['item_id']]['ev'][] = (int)$r['id'];
            } elseif (isset($umap[(int)$r['update_id']])) {   // foto milik sebuah update
                [$sa, $ia, $xa] = $umap[(int)$r['update_id']];
                $rows[$sa][$ia]['upd'][$xa]['ev'][] = (int)$r['id'];
            }
        }
    }
    $res = [];
    foreach ($out as $sid => $s) {
        $list = $rows[$sid] ?? [];
        if ($pet !== '')   // filter petugas: item yang diisi atau di-update orang itu
            $list = array_values(array_filter($list, fn($r) => $r['petugas'] === $pet || array_filter($r['upd'], fn($u) => $u['petugas'] === $pet)));
        if (!$list) continue;
        usort($list, fn($a, $b) => $a['u'] <=> $b['u']);
        foreach ($list as $r) if (isset($s['c'][$r['status']])) $s['c'][$r['status']]++;
        $s['rows'] = array_map(fn($r) => array_diff_key($r, ['u' => 1]), $list);
        $res[] = $s;
    }
    return $res;
}
