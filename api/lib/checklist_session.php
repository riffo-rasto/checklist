<?php
// Sesi checklist aktif = putaran terbaru untuk tanggal + shift (dibuat otomatis kalau belum ada)
function current_session(string $tgl, string $sh, int $uid, bool $create = true): int {
    $find = function () use ($tgl, $sh): int {
        $q = db()->prepare('SELECT id FROM checklist_sessions WHERE tanggal = ? AND shift = ? ORDER BY putaran DESC LIMIT 1');
        $q->execute([$tgl, $sh]);
        return (int)$q->fetchColumn();
    };
    $id = $find();
    if ($id || !$create) return $id;
    try {
        db()->prepare('INSERT INTO checklist_sessions (tanggal, shift, user_id, putaran) VALUES (?,?,?,1)')->execute([$tgl, $sh, $uid]);
        return (int)db()->lastInsertId();
    } catch (PDOException $e) {   // dibuat bersamaan oleh orang lain
        return $find();
    }
}
