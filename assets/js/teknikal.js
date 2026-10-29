// ===== Aplikasi Teknikal: laporan pekerjaan teknisi =====
// Memakai fungsi dari app.js: $, api, go, warn, shrink, openViewer, dmy, isAdmin
const TK_CLS = {'Open': 'o', 'In Progress': 'p', 'Selesai': 's'};
let tkKat = null, tkTek = [], tkEditId = 0, ktEdit = 0;
const tkNo = n => 'TK-' + String(n).padStart(5, '0');
const tkEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const tkBadge = s => tkEl('span', 'bd ' + (TK_CLS[s] || ''), s);
const tkIso = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

function tkThumb(id, onDel) {   // thumbnail foto; klik = tampil besar
  const w = tkEl('span', 'th'), a = document.createElement('a'), im = document.createElement('img');
  a.href = 'api/teknikal.php?foto=' + id; a.target = '_blank';
  a.onclick = e => { e.preventDefault(); openViewer(a.href); };
  im.loading = 'lazy'; im.src = a.href; a.append(im); w.append(a);
  if (onDel) { const x = tkEl('button', '', '×'); x.type = 'button'; x.title = 'Hapus foto'; x.onclick = onDel; w.append(x); }
  return w;
}

async function tkLoadKat(force) {   // daftar kategori untuk dropdown form dan filter
  if (tkKat && !force) return;
  tkKat = (await api('teknikal.php?action=kategori')).kategori;
  tkTek = (await api('teknikal.php?action=teknisi')).teknisi;   // hanya user berperan teknis
  const opts = first => [new Option(first, ''), ...tkKat.map(k => new Option(k.nama, k.id))];
  const kf = $('#tk-f-kat').value, kk = $('#tk-kat').value;
  $('#tk-f-kat').replaceChildren(...opts('Semua kategori')); $('#tk-f-kat').value = kf;
  $('#tk-kat').replaceChildren(...opts('— pilih —')); $('#tk-kat').value = kk;
}

async function tkGo(v, arg) {   // dipanggil dari go() di app.js
  try {
    await tkLoadKat();
    if (v === 'tek-dash') await tkDash();
    else if (v === 'tek-list') await tkList();
    else if (v === 'tek-form') await tkForm(arg);
    else if (v === 'tek-detail') await tkDetail(arg);
  } catch (e) { warn(e); }
}

async function tkDash() {
  const d = await api('teknikal.php?action=dashboard');
  $('#tk-total').textContent = d.total; $('#tk-open').textContent = d.open; $('#tk-prog').textContent = d.progress; $('#tk-done').textContent = d.selesai;
  const rc = $('#tk-recent'); rc.replaceChildren();
  if (!d.recent.length) rc.textContent = 'Belum ada laporan.';
  d.recent.forEach(r => {
    const row = tkEl('div', 'tk-item'), a = tkEl('div');
    row.onclick = () => go('tek-detail', r.id);
    a.append(tkEl('b', '', r.judul), tkEl('div', 'meta', `${tkNo(r.id)} · ${dmy(r.tanggal)} · ${r.lokasi} · ${r.teknisi}`));
    row.append(a, tkBadge(r.status)); rc.append(row);
  });
  const bk = $('#tk-bykat'); bk.replaceChildren();
  const mx = Math.max(1, ...d.kategori.map(k => +k.n));
  d.kategori.forEach(k => {
    const r = tkEl('div', 'tk-bar'), trk = tkEl('div', 'trk'), b = tkEl('i');
    b.style.width = (k.n / mx * 100) + '%'; trk.append(b);
    r.append(tkEl('span', '', k.nama), trk, tkEl('b', '', k.n)); bk.append(r);
  });
}

async function tkList() {
  const p = new URLSearchParams({action: 'list', from: $('#tk-f-from').value, to: $('#tk-f-to').value, status: $('#tk-f-status').value,
    kategori: $('#tk-f-kat').value || 0, q: $('#tk-f-q').value.trim(), mine: $('#tk-f-mine').checked ? 1 : 0});
  const d = await api('teknikal.php?' + p);
  const tb = $('#tk-rows'); tb.replaceChildren();
  $('#tk-count').textContent = `${d.rows.length} laporan`;
  d.rows.forEach(r => {
    const tr = tb.insertRow(); tr.className = 'click'; tr.onclick = () => go('tek-detail', r.id);
    [tkNo(r.id), dmy(r.tanggal), r.lokasi, r.kategori || '–', r.jenis, r.judul].forEach(t => tr.insertCell().textContent = t);
    tr.insertCell().append(tkBadge(r.status));
    tr.insertCell().textContent = r.teknisi;
    tr.insertCell().textContent = +r.foto ? '📷 ' + r.foto : '–';
  });
  if (!d.rows.length) { const c = tb.insertRow().insertCell(); c.colSpan = 9; c.textContent = 'Tidak ada laporan pada filter ini.'; }
}

function tkCnt() {
  [['#tk-fsebelum', '#tk-c1'], ['#tk-fsesudah', '#tk-c2']].forEach(([f, c]) => {
    const n = $(f).files.length; $(c).textContent = n ? `${n} foto dipilih` : 'Belum ada foto'; $(c).className = 'chip' + (n ? ' ok' : '');
  });
}

function tkFillTek(extra) {   // admin: pilih teknisi; teknis: hanya dirinya sendiri (terkunci)
  const sel = $('#tk-tek'); sel.replaceChildren();
  if (isAdmin) sel.append(new Option('— pilih teknisi —', ''));
  tkTek.filter(t => isAdmin || +t.id === meId).forEach(t => sel.append(new Option(t.nama, t.id)));
  if (extra && !tkTek.some(t => +t.id === +extra.id)) sel.append(new Option(extra.nama, extra.id));   // pemilik lama yang bukan teknis tetap tampil saat edit
}

async function tkForm(id) {
  tkEditId = id || 0;
  $('#tk-ftitle').textContent = id ? `Edit laporan ${tkNo(id)}` : 'Laporan baru';
  ['#tk-lok', '#tk-judul', '#tk-uraian', '#tk-tindakan'].forEach(s => $(s).value = '');
  $('#tk-tgl').value = tkIso(new Date()); $('#tk-kat').value = ''; $('#tk-jenis').value = 'Corrective'; $('#tk-status').value = 'Open';
  ['#tk-fsebelum', '#tk-fsesudah'].forEach(s => $(s).value = ''); tkCnt(); $('#tk-msg').textContent = '';
  tkFillTek(null); $('#tk-tek').value = isAdmin ? '' : meId; $('#tk-tek').disabled = !isAdmin;
  if (!id) return;
  const d = await api(`teknikal.php?action=get&id=${id}`), l = d.laporan;
  if (!d.can_edit) { alert('Hanya pembuat laporan atau admin yang boleh mengubah'); return go('tek-detail', id); }
  $('#tk-tgl').value = l.tanggal; $('#tk-lok').value = l.lokasi; $('#tk-kat').value = l.kategori_id || ''; $('#tk-jenis').value = l.jenis;
  $('#tk-judul').value = l.judul; $('#tk-uraian').value = l.uraian || ''; $('#tk-tindakan').value = l.tindakan || ''; $('#tk-status').value = l.status;
  tkFillTek(isAdmin ? {id: l.user_id, nama: l.teknisi} : null); $('#tk-tek').value = l.user_id;
}

async function tkUpload(id, jenis, files) {   // foto dikecilkan di browser dulu
  if (!files.length) return;
  const fd = new FormData(); fd.append('action', 'foto'); fd.append('laporan_id', id); fd.append('jenis', jenis);
  for (const f of files) fd.append('files[]', await shrink(f), 'foto.jpg');
  await api('teknikal.php', 'POST', fd);
}

async function tkSave() {
  const m = $('#tk-msg'); m.className = 'err'; m.textContent = '';
  if (!$('#tk-lok').value.trim() || !$('#tk-judul').value.trim()) { m.textContent = 'Lokasi dan judul wajib diisi'; return; }
  if (isAdmin && !$('#tk-tek').value) { m.textContent = 'Pilih teknisi'; return; }
  $('#tk-save').disabled = true;
  try {
    const d = await api('teknikal.php', 'POST', {action: 'save', id: tkEditId, tanggal: $('#tk-tgl').value, lokasi: $('#tk-lok').value,
      kategori_id: $('#tk-kat').value, jenis: $('#tk-jenis').value, judul: $('#tk-judul').value, uraian: $('#tk-uraian').value,
      tindakan: $('#tk-tindakan').value, status: $('#tk-status').value, teknisi_id: $('#tk-tek').value});
    tkEditId = d.id;   // kalau upload foto gagal, simpan ulang memperbarui laporan yang sama
    await tkUpload(d.id, 'Sebelum', $('#tk-fsebelum').files);
    await tkUpload(d.id, 'Sesudah', $('#tk-fsesudah').files);
    go('tek-detail', d.id);
  } catch (e) { if (e.status === 401) return location.reload(); m.textContent = e.message; }
  finally { $('#tk-save').disabled = false; }
}

async function tkDetail(id) {
  const box = $('#tk-detail'); box.textContent = 'Memuat…';
  const d = await api(`teknikal.php?action=get&id=${id}`), l = d.laporan;
  box.replaceChildren();
  const head = tkEl('div', 'tk-head'), t = tkEl('div');
  t.append(tkEl('div', 'meta', tkNo(l.id)), tkEl('h2', '', l.judul)); head.append(t, tkBadge(l.status)); box.append(head);
  const grid = tkEl('div', 'tk-meta');
  [['Tanggal', dmy(l.tanggal)], ['Lokasi', l.lokasi], ['Kategori', l.kategori || '–'], ['Jenis', l.jenis], ['Teknisi', l.teknisi], ['Dibuat', l.created_at]]
    .forEach(([k, v]) => { const c = tkEl('div'); c.append(tkEl('small', 'meta', k), tkEl('div', '', v)); grid.append(c); });
  box.append(grid);
  [['Uraian temuan / pekerjaan', l.uraian], ['Tindakan', l.tindakan]].forEach(([k, v]) => {
    const s = tkEl('div', 'tk-sec'); s.append(tkEl('b', '', k), tkEl('div', 'tx', v || '–')); box.append(s);
  });
  ['Sebelum', 'Sesudah', 'Lainnya'].forEach(j => {
    const fs = d.fotos.filter(f => f.jenis === j);
    if (!fs.length) return;
    const s = tkEl('div', 'tk-sec'), ph = tkEl('div', 'tk-ph');
    fs.forEach(f => ph.append(tkThumb(f.id, d.can_edit ? async () => {
      if (!confirm('Hapus foto ini?')) return;
      try { await api('teknikal.php', 'POST', {action: 'delete_foto', id: f.id}); tkDetail(id); } catch (e) { warn(e); }
    } : null)));
    s.append(tkEl('b', '', `Foto ${j.toLowerCase()} (${fs.length})`), ph); box.append(s);
  });
  const bar = tkEl('div', 'bar');
  if (d.can_edit) {
    const sel = document.createElement('select'); ['Open', 'In Progress', 'Selesai'].forEach(s => sel.append(new Option(s))); sel.value = l.status;
    const ub = tkEl('button', '', 'Ubah status');
    ub.onclick = async () => { try { await api('teknikal.php', 'POST', {action: 'status', id, status: sel.value}); tkDetail(id); } catch (e) { warn(e); } };
    const pj = document.createElement('select'); ['Sebelum', 'Sesudah', 'Lainnya'].forEach(s => pj.append(new Option(s)));
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = true;
    const up = tkEl('button', '', '+ Tambah foto');
    up.onclick = async () => {
      if (!fi.files.length) return alert('Pilih foto dulu');
      try { await tkUpload(id, pj.value, fi.files); tkDetail(id); } catch (e) { warn(e); }
    };
    const ed = tkEl('button', 'primary', 'Edit'); ed.onclick = () => go('tek-form', id);
    bar.append(sel, ub, pj, fi, up, ed);
  }
  if (isAdmin) {
    const dl = tkEl('button', 'ghost danger', 'Hapus laporan');
    dl.onclick = async () => {
      if (!confirm(`HAPUS laporan ${tkNo(id)} beserta semua fotonya?\nTidak bisa dikembalikan.`)) return;
      try { await api('teknikal.php', 'POST', {action: 'delete', id}); go('tek-list'); } catch (e) { warn(e); }
    };
    bar.append(dl);
  }
  const back = tkEl('button', 'ghost', '← Daftar laporan'); back.onclick = () => go('tek-list'); bar.append(back);
  box.append(bar);
}

// ---- Setting (admin): kategori Teknikal
async function tekKatAdmin() {
  try {
    const d = await api('teknikal.php?action=kategori_all'), tb = $('#kt-rows'); tb.replaceChildren();
    d.kategori.forEach(k => {
      const tr = tb.insertRow();
      tr.insertCell().textContent = k.nama; tr.insertCell().textContent = k.dipakai + ' laporan'; tr.insertCell().textContent = +k.aktif ? 'Aktif' : 'Nonaktif';
      const td = tr.insertCell(), ed = tkEl('button', '', 'Edit'), dl = tkEl('button', 'ghost danger', 'Hapus');
      ed.onclick = () => { ktEdit = k.id; $('#kt-title').textContent = 'Edit kategori'; $('#kt-nama').value = k.nama; $('#kt-aktif').checked = !!+k.aktif; $('#kt-nama').focus(); };
      dl.onclick = async () => {
        if (!confirm(`Hapus kategori ${k.nama}?`)) return;
        try { const r = await api('teknikal.php', 'POST', {action: 'kategori_delete', id: k.id}); alert(r.message); tekKatAdmin(); tkLoadKat(true); } catch (e) { warn(e); }
      };
      td.append(ed, ' ', dl);
    });
  } catch (e) { warn(e); }
}
function ktReset() { ktEdit = 0; $('#kt-title').textContent = 'Tambah kategori'; $('#kt-nama').value = ''; $('#kt-aktif').checked = true; }
async function ktSave() {
  const m = $('#kt-msg');
  try {
    await api('teknikal.php', 'POST', {action: 'kategori_save', id: ktEdit, nama: $('#kt-nama').value, aktif: $('#kt-aktif').checked});
    ktReset(); tekKatAdmin(); tkLoadKat(true); m.textContent = 'Kategori tersimpan'; m.className = 'ok';
  } catch (e) { if (e.status === 401) location.reload(); else { m.textContent = e.message; m.className = 'err'; } }
}

// ---- pemasangan event
(() => {
  const t = new Date();
  $('#tk-f-from').value = tkIso(new Date(t.getFullYear(), t.getMonth(), 1)); $('#tk-f-to').value = tkIso(t);
  $('#tk-apply').onclick = () => tkGo('tek-list');
  document.querySelectorAll('[data-new]').forEach(b => b.onclick = () => go('tek-form'));
  document.querySelectorAll('.sc[data-st]').forEach(c => c.onclick = () => { $('#tk-f-status').value = c.dataset.st; go('tek-list'); });
  $('#tk-save').onclick = tkSave;
  $('#tk-cancel').onclick = () => tkEditId ? go('tek-detail', tkEditId) : go('tek-list');
  $('#tk-p1').onclick = () => $('#tk-fsebelum').click(); $('#tk-p2').onclick = () => $('#tk-fsesudah').click();
  $('#tk-fsebelum').onchange = $('#tk-fsesudah').onchange = tkCnt;
  $('#kt-save').onclick = ktSave; $('#kt-reset').onclick = ktReset;
})();
