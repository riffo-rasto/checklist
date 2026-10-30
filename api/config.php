<?php
// Satu-satunya file yang perlu diedit saat instalasi: kredensial database dan zona waktu.
// Fungsi bantu (db, out, need_login, ...) ada di lib/helpers.php, jangan ditaruh di sini.
date_default_timezone_set('Asia/Jakarta');
// Sesuaikan kredensial database (buat user MySQL khusus, jangan pakai root)
const DB_HOST = 'localhost', DB_NAME = 'noc_checklist', DB_USER = 'noc_user', DB_PASS = 'GANTI_PASSWORD';
// Opsional: ubah lokasi penyimpanan foto (default di bawah). Folder harus di luar web root.
// const EVIDENCE_DIR = '/var/www/noc-storage/evidence/';
// const TEK_DIR = '/var/www/noc-storage/teknikal/';
