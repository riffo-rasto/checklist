<?php
// Data rekap untuk tampilan web (JSON)
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/access.php';
require __DIR__ . '/lib/report.php';
need_login(); need_app('noc');
$from = $_GET['from'] ?? '';
$to = $_GET['to'] ?? '';
foreach ([$from, $to] as $d) if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) out(['error' => 'Periode tidak valid'], 422);
out(['sessions' => build_report($from, $to)]);
