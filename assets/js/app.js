const $ = s => document.querySelector(s);
const STATUS = ['OK', 'Warning', 'Down', 'N/A'];
const PRI = {P1: 'P1 – Kritis', P2: 'P2 – Tinggi', P3: 'P3 – Menengah', P4: 'P4 – Rutin', END: 'Penutup shift'};
let csrf = '', items = [], evid = {}, isAdmin = false;
const iso = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

// Jembatan frontend -> backend PHP (JSON + cookie sesi + token CSRF)
async function api(path, method = 'GET', body) {
  const r = await fetch('api/' + path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body instanceof FormData ? {'X-CSRF-Token': csrf} : {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { throw new Error('Respon server bukan JSON: ' + t.slice(0, 200)); }
  if (!r.ok) { const e = new Error(d.error || 'Terjadi kesalahan'); e.status = r.status; throw e; }
  return d;
}
const msg = (t, err) => { const m = $('#msg'); m.textContent = t; m.className = err ? 'err' : 'ok'; };
const onErr = e => e.status === 401 ? location.reload() : msg(e.message, true);

// ---- Navigasi sidebar dan hak akses per peran (admin: semua, noc: Checklist NOC, teknis: Teknikal)
let apps = [], checklistReady = false, meId = 0;
const VIEWS = {checklist: 'tab-checklist', export: 'tab-export', users: 'tab-users', 'tek-dash': 'v-tek-dash', 'tek-list': 'v-tek-list', 'tek-form': 'v-tek-form', 'tek-detail': 'v-tek-detail'};
const TITLES = {checklist: 'Checklist NOC', export: 'Rekap & unduh', users: 'Setting', 'tek-dash': 'Teknikal · Dashboard', 'tek-list': 'Teknikal · Laporan', 'tek-form': 'Teknikal · Form laporan', 'tek-detail': 'Teknikal · Detail laporan'};
const ROLE_LABEL = {admin: 'Admin', noc: 'NOC', teknis: 'Teknis'};
const ROLE_FULL = {admin: 'ADMINISTRATOR', noc: 'NOC', teknis: 'TEKNIS'};
const allowed = v => v === 'users' ? isAdmin : v.startsWith('tek-') ? apps.includes('teknikal') : apps.includes('noc');
function closeSide() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }
function go(v, arg) {
  if (!allowed(v)) return;
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== VIEWS[v]);
  const nav = (v === 'tek-detail' || v === 'tek-form') ? 'tek-list' : v;
  document.querySelectorAll('.side [data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === nav));
  $('#crumb').textContent = TITLES[v];
  closeSide();
  if (v === 'checklist' && !checklistReady) { checklistReady = true; load(); }
  if (v === 'users') { loadUsers(); loadItems(); tekKatAdmin(); }
  if (v.startsWith('tek-')) tkGo(v, arg);
  window.scrollTo(0, 0);
}
$('#burger').onclick = () => {
  const sd = $('#side');
  if (innerWidth < 860) { sd.classList.toggle('open'); $('#scrim').hidden = !sd.classList.contains('open'); }
  else { sd.classList.toggle('min'); try { localStorage.setItem('sidemin', sd.classList.contains('min') ? '1' : ''); } catch (e) {} }
};
$('#scrim').onclick = closeSide;
// dropdown profil: Setting (admin) + Keluar
const closeP = () => { $('#ppanel').hidden = true; $('#pbtn').setAttribute('aria-expanded', 'false'); };
$('#pbtn').onclick = e => { e.stopPropagation(); const open = $('#ppanel').hidden; $('#ppanel').hidden = !open; $('#pbtn').setAttribute('aria-expanded', open ? 'true' : 'false'); };
document.addEventListener('click', e => { if (!$('#pmenu').contains(e.target)) closeP(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeP(); });
$('#u-setting').onclick = () => { closeP(); go('users'); };
document.querySelectorAll('.side [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

function show(u) {
  csrf = u.csrf; isAdmin = u.role === 'admin'; apps = u.apps || []; meId = u.id || 0;
  $('#clear-all').hidden = !isAdmin;
  $('#user').textContent = u.nama; $('#me-name').textContent = u.nama;
  $('#me-role').textContent = ROLE_FULL[u.role] || u.role;
  const ini = (u.nama || '?')[0].toUpperCase(); $('#av').textContent = ini; $('#av2').textContent = ini; $('#u-setting').hidden = !isAdmin;
  document.querySelectorAll('.nav-noc').forEach(e => e.hidden = !apps.includes('noc'));
  document.querySelectorAll('.nav-tek').forEach(e => e.hidden = !apps.includes('teknikal'));
  document.querySelectorAll('.nav-adm').forEach(e => e.hidden = !isAdmin);
  try { if (localStorage.getItem('sidemin') && innerWidth >= 860) $('#side').classList.add('min'); } catch (e) {}
  $('#login-view').hidden = true; $('#app-view').hidden = false;
  go(apps.includes('noc') ? 'checklist' : 'tek-dash');
}

async function load() {
  try {
    const d = await api(`checklist.php?tanggal=${$('#tanggal').value}&shift=${$('#shift').value}`);
    items = d.items; evid = d.evidence || {};
    const um = d.updates || {}; items.forEach(it => it.updates = um[it.entry_id] || []);
    render(); msg('');
  } catch (e) { onErr(e); }
}

// ---- Checklist: baris per item, dikelompokkan per prioritas
let isDirty = false;
function dirty(d) { isDirty = d; $('#dirty').textContent = d ? '● Belum disimpan' : ''; }
window.onbeforeunload = () => isDirty ? true : undefined;
const txt = r => r.querySelector('.cat'), tm = r => r.querySelector('.jam');

function mark(r) {   // warnai tombol aktif + tandai catatan wajib (Warning/Down)
  r.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.s === r.dataset.st));
  r.classList.toggle('need', ['Warning', 'Down'].includes(r.dataset.st) && !txt(r).value.trim());
}
function setStatus(r, s, onlyEmpty) {
  if (onlyEmpty && r.dataset.st) return;
  r.dataset.st = s;
  tm(r).value = s ? new Date().toTimeString().slice(0, 5) : '';   // jam = waktu klik; hilang kalau status dikosongkan
  mark(r); upd(); dirty(true);
}

function lock(r, on) {   // item tersimpan = terkunci (abu-abu); hanya admin yang boleh "Ubah"
  r.classList.toggle('done', on);
  r.querySelectorAll('.seg button').forEach(b => b.disabled = on);
  txt(r).readOnly = on;
  r.querySelector('.sv').hidden = on;
  r.querySelector('.clr-x').hidden = on;
  r.querySelector('.dn').hidden = !on;
  r.querySelector('.unlock').hidden = !(on && isAdmin);
  const ev = r.querySelector('.ev'); ev.dataset.locked = on ? '1' : ''; if (ev.redraw) ev.redraw();
  refreshUpd(r);
}
// ---- Update tindak lanjut untuk item Warning / Down yang sudah tersimpan
function refreshUpd(r) {
  const it = items[r.dataset.i], box = r.querySelector('.upd');
  if (!it || !box) return;
  const on = r.classList.contains('done') && ['Warning', 'Down'].includes(r.dataset.st) && it.entry_id;
  box.hidden = !on;
  if (!on) return;
  box.replaceChildren();
  const ups = it.updates || [], closed = ups.some(u => u.selesai);   // sudah ada update 'selesai' = masalah ditutup
  const head = document.createElement('div'); head.className = 'uhead';
  const chip = document.createElement('span'); chip.className = 'chip ' + (closed ? 'ok' : 'warn');
  chip.textContent = closed ? '✔ Masalah selesai' : (ups.length ? '⏳ Dalam penanganan' : 'Belum ada tindak lanjut');
  const add = document.createElement('button'); add.type = 'button'; add.className = 'primary small'; add.textContent = '+ Update';
  head.append(chip);
  if (!closed) head.append(add);   // masalah selesai: tombol Update hilang
  box.append(head);
  ups.forEach(u => {
    const li = document.createElement('div'); li.className = 'ui';
    const m = document.createElement('div'); m.className = 'meta'; m.textContent = `${u.waktu} · ${u.petugas}${u.selesai ? ' · ✔ Selesai' : ''}`;
    const tx = document.createElement('div'); tx.className = 'tx'; tx.textContent = u.tindakan;
    li.append(m, tx);
    if (u.ev.length) { const th = document.createElement('div'); th.className = 'ev'; u.ev.forEach(id => th.append(thumbLink(id))); li.append(th); }
    if (isAdmin) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'ghost small danger'; x.textContent = 'Hapus update';
      x.onclick = async () => {
        if (!confirm('Hapus update ini beserta fotonya?')) return;
        try { await api('updates.php', 'POST', {action: 'delete', id: u.id}); it.updates = it.updates.filter(v => v.id !== u.id); refreshUpd(r); } catch (e) { warn(e); }
      };
      li.append(x);
    }
    box.append(li);
  });
  const f = document.createElement('div'); f.className = 'uform'; f.hidden = true;
  const ta = document.createElement('textarea'); ta.rows = 3; ta.maxLength = 2000; ta.placeholder = 'Tindakan yang dilakukan / hasil penyelesaian';
  const cl = document.createElement('label'); cl.className = 'chk';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cl.append(cb, ' Masalah sudah selesai');
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.hidden = true;
  const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'ghost small'; pick.textContent = '📷 Pilih foto (maks. 5)';
  const cnt = document.createElement('span'); cnt.className = 'chip'; cnt.textContent = 'Belum ada foto';
  pick.onclick = () => file.click();
  file.onchange = () => { cnt.textContent = file.files.length ? `${file.files.length} foto dipilih` : 'Belum ada foto'; };
  const fr = document.createElement('div'); fr.className = 'uhead'; fr.append(pick, cnt, file);
  const send = document.createElement('button'); send.type = 'button'; send.className = 'primary small'; send.textContent = 'Kirim update';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'ghost small'; cancel.textContent = 'Batal';
  const fb = document.createElement('div'); fb.className = 'uhead'; fb.append(send, cancel);
  cancel.onclick = () => { f.hidden = true; };
  add.onclick = () => { f.hidden = !f.hidden; if (!f.hidden) ta.focus(); };
  send.onclick = async () => {
    if (!ta.value.trim()) return alert('Isi kolom tindakan dulu');
    if (file.files.length > 5) return alert('Maksimal 5 foto per update');
    send.disabled = true;
    try {
      const fd = new FormData();
      fd.append('entry_id', it.entry_id); fd.append('tindakan', ta.value.trim()); fd.append('selesai', cb.checked ? 1 : 0);
      for (const fl of file.files) fd.append('files[]', await shrink(fl), 'foto.jpg');
      const d = await api('updates.php', 'POST', fd);
      (it.updates = it.updates || []).push(d.update); refreshUpd(r);
    } catch (e) { send.disabled = false; warn(e); }
  };
  f.append(ta, cl, fr, fb); if (!closed) box.append(f);
}

function clearRow(r) {   // kosongkan satu baris (item yang sudah tersimpan tidak bisa dikosongkan)
  if (r.classList.contains('done')) return;
  r.dataset.st = ''; txt(r).value = ''; tm(r).value = '';
  mark(r); upd(); dirty(true);
}
const warn = e => e.status === 401 ? location.reload() : alert(e.message);

// ---- Evidence (gambar): dikecilkan di browser dulu, lalu diunggah ke api/evidence.php
function shrink(file, max = 1280) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('Gagal memproses gambar')), 'image/jpeg', 0.82);
    };
    img.onerror = () => rej(new Error('File bukan gambar yang valid'));
    img.src = url;
  });
}
function thumbLink(id) {
  const a = document.createElement('a'); a.href = 'api/evidence.php?id=' + id; a.target = '_blank';
  a.onclick = e => { e.preventDefault(); openViewer(a.href); };   // klik = tampil besar
  const im = document.createElement('img'); im.loading = 'lazy'; im.src = a.href; a.append(im);
  return a;
}
function openViewer(src) {   // tampilan foto besar; klik di mana saja atau tekan Esc untuk menutup
  const o = document.createElement('div'); o.className = 'viewer';
  const im = document.createElement('img'); im.src = src;
  const lk = document.createElement('a'); lk.href = src; lk.target = '_blank'; lk.textContent = 'Buka di tab baru';
  const esc = e => { if (e.key === 'Escape') close(); };
  const close = () => { o.remove(); document.removeEventListener('keydown', esc); };
  o.onclick = e => { if (e.target !== lk) close(); };
  document.addEventListener('keydown', esc);
  o.append(im, lk); document.body.append(o);
}
function evBox(it) {
  const box = document.createElement('div'); box.className = 'ev';
  const draw = () => {
    box.replaceChildren();
    const locked = box.dataset.locked === '1', ids = evid[it.id] || [];
    const chip = document.createElement('span'); chip.className = 'chip' + (ids.length ? ' ok' : '');
    chip.textContent = ids.length ? `✔ ${ids.length} foto terunggah` : (locked ? 'Tanpa foto' : 'Belum ada foto');
    box.append(chip);
    ids.forEach(id => {
      const w = document.createElement('span'); w.className = 'th';
      w.append(thumbLink(id));
      if (!locked) {   // foto hanya bisa dihapus sebelum item disimpan
        const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'Hapus foto';
        x.onclick = async () => {
          if (!confirm('Hapus foto ini?')) return;
          try { await api('evidence.php', 'POST', {action: 'delete', id}); evid[it.id] = evid[it.id].filter(v => v !== id); draw(); }
          catch (e) { onErr(e); }
        };
        w.append(x);
      }
      box.append(w);
    });
    if (locked) return;   // item sudah disimpan: tidak ada tambah/hapus foto lagi
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ghost small'; add.textContent = '📷 Tambah foto';
    add.disabled = ids.length >= 5; add.title = ids.length >= 5 ? 'Maksimal 5 foto per item' : '';
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = true; f.hidden = true;
    add.onclick = () => f.click();
    f.onchange = async () => {
      for (const file of f.files) {
        try {
          msg('Mengunggah foto…');
          const fd = new FormData();
          fd.append('tanggal', $('#tanggal').value); fd.append('shift', $('#shift').value); fd.append('item_id', it.id);
          fd.append('file', await shrink(file), 'evidence.jpg');
          const d = await api('evidence.php', 'POST', fd);
          (evid[it.id] = evid[it.id] || []).push(d.id); draw(); msg('Foto terunggah');
        } catch (e) { onErr(e); break; }
      }
    };
    box.append(add, f);
  };
  box.redraw = draw;
  draw();
  return box;
}

function makeRow(it, i) {
  const r = document.createElement('div');
  r.className = 'row'; r.dataset.i = i; r.dataset.st = it.status || '';
  const nm = document.createElement('div'); nm.className = 'nm';
  nm.append(it.nama_item);
  if (it.petugas) {
    const m = document.createElement('small'); m.className = 'meta';
    m.textContent = `Diisi ${it.petugas} · ${it.diisi_pada}`;
    nm.append(m);
  }
  const seg = document.createElement('div'); seg.className = 'seg';
  STATUS.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s; b.dataset.s = s;
    b.onclick = () => setStatus(r, r.dataset.st === s ? '' : s);   // klik lagi = kosongkan
    seg.append(b);
  });
  const ct = document.createElement('input'); ct.type = 'text'; ct.className = 'cat'; ct.placeholder = 'Catatan / No. tiket'; ct.value = it.catatan || '';
  const jm = document.createElement('input'); jm.type = 'text'; jm.className = 'jam'; jm.readOnly = true; jm.tabIndex = -1; jm.placeholder = 'Jam';
  jm.value = it.status ? (it.jam_cek || '') : '';   // jam otomatis, tidak bisa diketik
  ct.oninput = () => { mark(r); dirty(true); };
  const sv = document.createElement('button'); sv.type = 'button'; sv.className = 'primary small sv'; sv.textContent = 'Simpan';
  sv.title = 'Simpan item ini (setelah disimpan, item terkunci)'; sv.onclick = () => saveRow(r);
  const x = document.createElement('button'); x.type = 'button'; x.className = 'ghost small danger clr-x'; x.textContent = '✕'; x.title = 'Kosongkan item ini';
  x.onclick = () => clearRow(r);
  const dn = document.createElement('span'); dn.className = 'chip ok dn'; dn.textContent = '✔ Selesai';
  const ub = document.createElement('button'); ub.type = 'button'; ub.className = 'ghost small unlock'; ub.textContent = 'Ubah'; ub.title = 'Buka kunci (khusus admin)';
  ub.onclick = () => lock(r, false);
  const rx = document.createElement('div'); rx.className = 'rx'; rx.append(sv, x, dn, ub);
  const up = document.createElement('div'); up.className = 'upd'; up.hidden = true;   // tindak lanjut (Warning / Down)
  r.append(nm, seg, ct, jm, rx, evBox(it), up); mark(r);
  lock(r, !!it.status);   // item yang sudah tersimpan langsung terkunci
  return r;
}

function render() {
  const list = $('#list'); list.replaceChildren();
  let box, last = '';
  items.forEach((it, i) => {
    if (it.prioritas !== last) {
      last = it.prioritas;
      box = document.createElement('section'); box.className = 'grp ' + last;
      const g = box;
      const h = document.createElement('div'); h.className = 'grp-h';
      const t = document.createElement('b'); t.textContent = PRI[last];
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'ghost small'; ok.textContent = 'Semua OK';
      ok.onclick = () => g.querySelectorAll('.row').forEach(r => setStatus(r, 'OK', true));   // hanya yang masih kosong
      const label = PRI[last];   // disimpan di sini supaya tidak ikut berubah saat loop lanjut
      const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ghost small danger'; clr.textContent = 'Clear'; clr.title = 'Kosongkan item yang belum disimpan (data tersimpan tidak tersentuh)';
      clr.onclick = () => clearRows([...g.querySelectorAll('.row')], label);
      const act = document.createElement('div'); act.className = 'act'; act.append(ok, clr);
      h.append(t, act); g.append(h); list.append(g);
    }
    box.append(makeRow(it, i));
  });
  upd(); dirty(false);
}

function upd() {
  const rows = [...document.querySelectorAll('.row')], v = rows.map(r => r.dataset.st);
  const n = s => v.filter(x => x === s).length, saved = rows.filter(r => r.classList.contains('done')).length;
  $('#prog-text').textContent = `${saved} dari ${rows.length} item tersimpan`;
  $('#prog-bar').style.width = (rows.length ? saved / rows.length * 100 : 0) + '%';
  $('#summary').textContent = `OK ${n('OK')} · Warning ${n('Warning')} · Down ${n('Down')}`;
  const info = $('#saved-info');   // keterangan di bagian bawah
  info.textContent = saved ? `✔ Checklist telah terupdate (${saved} item tersimpan)` : 'Klik "Simpan" di tiap item untuk menyimpan.';
  info.className = saved ? 'ok' : 'meta';
}

// Clear per kelompok: hanya mengosongkan item yang BELUM disimpan (data tersimpan tidak tersentuh)
function clearRows(rows, label) {
  if (confirm(`Kosongkan item di ${label} yang belum disimpan? Item yang sudah tersimpan tidak terpengaruh.`)) rows.forEach(clearRow);
}
// Admin: Clear checklist = mulai putaran baru. Data yang sudah tersimpan TETAP ada di rekap.
async function clearChecklist() {
  if (!confirm('CLEAR checklist ini?\nChecklist dikosongkan supaya bisa diisi ulang. Data yang sudah tersimpan TETAP ada di rekap (tidak dihapus).')) return;
  try {
    const d = await api('admin_data.php', 'POST', {action: 'clear_checklist', tanggal: $('#tanggal').value, shift: $('#shift').value});
    await load(); msg(d.message);
  } catch (e) { onErr(e); }
}

// Simpan satu item. Setelah tersimpan item terkunci; server juga menolak perubahan (kecuali admin).
async function saveRow(r) {
  const st = r.dataset.st;
  if (!st) return msg('Pilih status dulu (OK / Warning / Down / N/A)', true);
  if (['Warning', 'Down'].includes(st) && !txt(r).value.trim()) { mark(r); return msg('Isi catatan untuk status Warning / Down', true); }
  try {
    const d = await api('checklist.php', 'POST', {tanggal: $('#tanggal').value, shift: $('#shift').value,
      entries: [{item_id: items[r.dataset.i].id, status: st, catatan: txt(r).value, jam_cek: tm(r).value}]});
    const it = items[r.dataset.i]; it.entry_id = (d.ids || {})[it.id]; it.updates = it.updates || [];
    markSaved(r); msg('');
  } catch (e) { onErr(e); }
}
function markSaved(r) {
  const nm = r.querySelector('.nm');
  let m = nm.querySelector('.meta');
  if (!m) { m = document.createElement('small'); m.className = 'meta'; nm.append(m); }
  const d = new Date(), p = n => String(n).padStart(2, '0');
  m.textContent = `Diisi ${$('#user').textContent} · ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  lock(r, true); upd();
  dirty([...document.querySelectorAll('.row:not(.done)')].some(x => x.dataset.st));
}

const download = fmt => {
  if (!$('#from').value || !$('#to').value) return;
  location.href = `api/export.php?from=${$('#from').value}&to=${$('#to').value}&format=${fmt}&foto=${$('#inc-foto').checked ? 1 : 0}&shift=${encodeURIComponent($('#f-shift').value)}&petugas=${encodeURIComponent($('#f-pet').value)}`;
};

$('#login-form').onsubmit = async ev => {
  ev.preventDefault();
  try {
    show(await api('auth.php?action=login', 'POST', {username: $('#username').value, password: $('#password').value}));
  } catch (e) { $('#login-err').textContent = e.message; }
};
$('#logout').onclick = () => api('auth.php?action=logout', 'POST').finally(() => location.reload());
$('#tanggal').onchange = $('#shift').onchange = load;
$('#dl-csv').onclick = () => download('csv');
$('#dl-xlsx').onclick = () => download('xlsx');
const thisMonth = () => { const t = new Date(); $('#from').value = iso(new Date(t.getFullYear(), t.getMonth(), 1)); $('#to').value = iso(t); };
$('#this-month').onclick = thisMonth;
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab-' + b.dataset.tab);
  if (b.dataset.tab === 'users') { loadUsers(); loadItems(); }
});

// ---- Panel admin: kelola pengguna
let editId = null;
async function loadUsers() {
  try {
    const d = await api('users.php');
    const tb = $('#u-rows'); tb.replaceChildren();
    d.users.forEach(u => {
      const tr = tb.insertRow();
      tr.insertCell().textContent = u.username;
      tr.insertCell().textContent = u.nama;
      tr.insertCell().textContent = ROLE_LABEL[u.role] || u.role;
      tr.insertCell().textContent = +u.aktif ? 'Aktif' : 'Nonaktif';
      const b = document.createElement('button'); b.textContent = 'Edit'; b.onclick = () => editUser(u);
      const del = document.createElement('button'); del.textContent = 'Hapus'; del.className = 'ghost danger'; del.onclick = () => delUser(u);
      tr.insertCell().append(b, ' ', del);
    });
  } catch (e) { onErr(e); }
}
function editUser(u) {
  editId = u.id;
  $('#u-title').textContent = 'Edit pengguna: ' + u.username;
  $('#u-username').value = u.username; $('#u-username').disabled = true;
  $('#u-nama').value = u.nama; $('#u-pass').value = ''; $('#u-pass').placeholder = 'Kosongkan jika tidak diganti';
  $('#u-role').value = u.role; $('#u-aktif').checked = !!+u.aktif;
  window.scrollTo(0, 0);
}
function resetUserForm() {
  editId = null;
  $('#u-title').textContent = 'Tambah pengguna';
  $('#u-username').disabled = false;
  ['#u-username', '#u-nama', '#u-pass'].forEach(s => $(s).value = '');
  $('#u-pass').placeholder = 'Minimal 8 karakter';
  $('#u-role').value = 'noc'; $('#u-aktif').checked = true;
}
async function saveUser() {
  const m = $('#u-msg');
  try {
    await api('users.php', 'POST', {
      action: editId ? 'update' : 'create', id: editId, username: $('#u-username').value, nama: $('#u-nama').value,
      password: $('#u-pass').value, role: $('#u-role').value, aktif: $('#u-aktif').checked
    });
    resetUserForm(); loadUsers(); m.textContent = 'Pengguna tersimpan'; m.className = 'ok';
  } catch (e) { if (e.status === 401) location.reload(); else { m.textContent = e.message; m.className = 'err'; } }
}
$('#u-save').onclick = saveUser;
$('#u-reset').onclick = resetUserForm;

async function delUser(u) {
  if (!confirm(`Hapus pengguna ${u.username}?`)) return;
  try { const d = await api('users.php', 'POST', {action: 'delete', id: u.id}); alert(d.message); loadUsers(); } catch (e) { warn(e); }
}

// ---- Setting: CRUD item checklist
let editItem = null;
async function loadItems() {
  try {
    const d = await api('items.php');
    const tb = $('#i-rows'); tb.replaceChildren();
    d.items.forEach(it => {
      const tr = tb.insertRow();
      tr.insertCell().textContent = PRI[it.prioritas];
      tr.insertCell().textContent = it.nama_item;
      tr.insertCell().textContent = +it.aktif ? 'Aktif' : 'Nonaktif';
      const td = tr.insertCell();
      const mk = (t, f, c) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (c) b.className = c; b.onclick = f; td.append(b, ' '); };
      mk('▲', () => moveItem(it, -1)); mk('▼', () => moveItem(it, 1)); mk('Edit', () => fillItem(it)); mk('Hapus', () => delItem(it), 'ghost danger');
    });
  } catch (e) { warn(e); }
}
function fillItem(it) {
  editItem = it.id; $('#i-title').textContent = 'Edit item checklist';
  $('#i-nama').value = it.nama_item; $('#i-pri').value = it.prioritas; $('#i-aktif').checked = !!+it.aktif; $('#i-nama').focus();
}
function resetItemForm() {
  editItem = null; $('#i-title').textContent = 'Tambah item checklist';
  $('#i-nama').value = ''; $('#i-pri').value = 'P1'; $('#i-aktif').checked = true;
}
async function saveItem() {
  const m = $('#i-msg');
  try {
    await api('items.php', 'POST', {action: editItem ? 'update' : 'create', id: editItem, nama_item: $('#i-nama').value, prioritas: $('#i-pri').value, aktif: $('#i-aktif').checked});
    resetItemForm(); loadItems(); m.textContent = 'Item tersimpan'; m.className = 'ok';
  } catch (e) { if (e.status === 401) location.reload(); else { m.textContent = e.message; m.className = 'err'; } }
}
async function moveItem(it, dir) { try { await api('items.php', 'POST', {action: 'move', id: it.id, dir}); loadItems(); } catch (e) { warn(e); } }
async function delItem(it) {
  if (!confirm(`Hapus item "${it.nama_item}"?`)) return;
  try { const d = await api('items.php', 'POST', {action: 'delete', id: it.id}); alert(d.message); loadItems(); } catch (e) { warn(e); }
}
$('#i-save').onclick = saveItem;
$('#i-reset').onclick = resetItemForm;

// ---- Rekap: tampilkan dulu di web (bisa difilter dan diurutkan), unduh belakangan
const dmy = s => s.split('-').reverse().join('/');
const SH = {Pagi: 0, Siang: 1, Malam: 2};
const pk = s => s.rows.map(r => r.petugas || '').sort()[0] || '';   // kunci urut petugas: nama pertama (A-Z) di item yang tampil
const SORTS = {
  'tgl-asc': (a, b) => a.tanggal.localeCompare(b.tanggal) || SH[a.shift] - SH[b.shift] || a.putaran - b.putaran,
  'tgl-desc': (a, b) => b.tanggal.localeCompare(a.tanggal) || SH[b.shift] - SH[a.shift] || b.putaran - a.putaran,
  'shift': (a, b) => SH[a.shift] - SH[b.shift] || a.tanggal.localeCompare(b.tanggal) || a.putaran - b.putaran,
  'pet': (a, b) => pk(a).localeCompare(pk(b)) || a.tanggal.localeCompare(b.tanggal) || SH[a.shift] - SH[b.shift]
};
let rpt = [];   // data rekap yang sedang ditampilkan (filter & urutan dikerjakan di browser)

async function preview() {
  const box = $('#rpt'); box.textContent = 'Memuat…';
  try {
    const d = await api(`report.php?from=${$('#from').value}&to=${$('#to').value}`);
    rpt = d.sessions;
    const names = new Set();   // daftar petugas untuk filter
    rpt.forEach(s => { s.rows.forEach(r => { names.add(r.petugas); (r.upd || []).forEach(u => names.add(u.petugas)); }); });
    const sel = $('#f-pet'), keep = sel.value;
    sel.replaceChildren(new Option('Semua', ''), ...[...names].filter(Boolean).sort((a, b) => a.localeCompare(b)).map(n => new Option(n, n)));
    sel.value = names.has(keep) ? keep : '';
    renderRpt();
  } catch (e) { box.textContent = e.message; if (e.status === 401) location.reload(); }
}

function renderRpt() {
  const box = $('#rpt'), fs = $('#f-shift').value, fp = $('#f-pet').value;
  box.replaceChildren();
  const list = rpt.filter(s => !fs || s.shift === fs)
    .map(s => ({...s, rows: fp ? s.rows.filter(r => r.petugas === fp || (r.upd || []).some(u => u.petugas === fp)) : s.rows}))
    .filter(s => s.rows.length)
    .sort(SORTS[$('#f-sort').value] || SORTS['tgl-asc']);
  if (!list.length) { box.textContent = rpt.length ? 'Tidak ada data yang cocok dengan filter.' : 'Tidak ada data pada periode ini.'; return; }
  const info = document.createElement('div'); info.className = 'meta';
  info.textContent = `${list.length} sesi · ${list.reduce((n, s) => n + s.rows.length, 0)} item`;
  box.append(info);
  list.forEach(s => {
    const cnt = {OK: 0, Warning: 0, Down: 0, 'N/A': 0};
    let nf = 0;
    s.rows.forEach(r => { if (r.status in cnt) cnt[r.status]++; nf += r.ev.length + (r.upd || []).reduce((n, u) => n + u.ev.length, 0); });
    const g = document.createElement('section'); g.className = 'grp';
    const h = document.createElement('div'); h.className = 'grp-h';
    const t = document.createElement('b'); t.textContent = `${dmy(s.tanggal)} · ${s.shift}${s.putaran > 1 ? ' · Putaran ' + s.putaran : ''}`;
    const c = document.createElement('span'); c.className = 'meta';
    c.textContent = `OK ${cnt.OK} · Warning ${cnt.Warning} · Down ${cnt.Down} · N/A ${cnt['N/A']} · 📷 ${nf} foto`;
    const right = document.createElement('span'); right.className = 'hr'; right.append(c);
    h.append(t, right); g.append(h);
    s.rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'rrow'; row.dataset.st = r.status;
      const n = document.createElement('div'); n.textContent = r.item;
      const st = document.createElement('span'); st.className = 'badge'; st.textContent = r.status || '–';
      const ct = document.createElement('div'); ct.className = 'meta'; ct.textContent = [r.catatan, r.jam, r.petugas].filter(Boolean).join(' · ');
      const ev = document.createElement('div'); ev.className = 'ev';
      if (r.ev.length) { const c1 = document.createElement('span'); c1.className = 'chip ok'; c1.textContent = `📷 ${r.ev.length} foto`; ev.append(c1); }
      r.ev.forEach(id => ev.append(thumbLink(id)));
      if ((r.upd || []).length) {
        const done = r.upd.some(u => u.selesai), c2 = document.createElement('span');
        c2.className = 'chip ' + (done ? 'ok' : 'warn'); c2.textContent = done ? '✔ Selesai' : '⏳ Proses'; ev.prepend(c2);
      }
      row.append(n, st, ct);
      if (isAdmin) {   // admin: hapus SATU item ini dari rekap (beserta foto dan update-nya)
        row.classList.add('adm');
        const del = document.createElement('button'); del.type = 'button'; del.className = 'ghost small danger'; del.textContent = 'Hapus';
        del.title = 'Hapus item ini dari rekap';
        del.onclick = async () => {
          const nu = (r.upd || []).length, fo = r.ev.length + (r.upd || []).reduce((k, u) => k + u.ev.length, 0);
          if (!confirm(`HAPUS item ini dari rekap?\n\n${r.item}\n${dmy(s.tanggal)} · ${s.shift}${s.putaran > 1 ? ' · Putaran ' + s.putaran : ''}\n\nIkut terhapus: ${fo} foto dan ${nu} update. Tidak bisa dikembalikan.`)) return;
          try { await api('admin_data.php', 'POST', {action: 'delete_entry', id: r.eid}); preview(); }
          catch (e) { alert(e.message); }
        };
        row.append(del);
      }
      row.append(ev); g.append(row);
      (r.upd || []).forEach(u => {   // update tindak lanjut tepat di bawah itemnya
        const ur = document.createElement('div'); ur.className = 'urow';
        const hd = document.createElement('div'); hd.className = 'meta'; hd.textContent = `↳ Update ${u.waktu} · ${u.petugas}${u.selesai ? ' · ✔ Masalah selesai' : ''}`;
        const tx = document.createElement('div'); tx.className = 'tx'; tx.textContent = u.tindakan;
        ur.append(hd, tx);
        if (u.ev.length) { const th = document.createElement('div'); th.className = 'ev'; u.ev.forEach(id => th.append(thumbLink(id))); ur.append(th); }
        g.append(ur);
      });
    });
    box.append(g);
  });
}
$('#show-rpt').onclick = preview;
['#f-shift', '#f-pet', '#f-sort'].forEach(s => $(s).onchange = renderRpt);
$('#clear-all').onclick = clearChecklist;
$('#print-rpt').onclick = () => window.print();   // di dialog cetak pilih "Save as PDF"
$('#only-bad').onchange = e => $('#rpt').classList.toggle('only', e.target.checked);

(async () => {
  $('#tanggal').value = iso(new Date()); thisMonth();
  const h = new Date().getHours();   // Pagi 07-15, Siang 15-23, Malam sisanya (ubah sesuai jadwal)
  $('#shift').value = h >= 7 && h < 15 ? 'Pagi' : h >= 15 && h < 23 ? 'Siang' : 'Malam';
  const u = await api('auth.php').catch(() => ({login: false}));
  u.login ? show(u) : $('#login-view').hidden = false;
})();
