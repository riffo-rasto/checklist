<?php
// Hak akses aplikasi per peran: admin = semua, noc = Checklist NOC, teknis = Teknikal
function apps_for(string $role): array {
    return $role === 'admin' ? ['noc', 'teknikal'] : ($role === 'noc' ? ['noc'] : ($role === 'teknis' ? ['teknikal'] : []));
}
function need_app(string $app): void {
    if (!in_array($app, apps_for($_SESSION['role'] ?? ''), true)) out(['error' => 'Anda tidak punya akses ke aplikasi ini'], 403);
}
