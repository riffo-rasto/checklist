// Checklist NOC: daftar item per prioritas, status, simpan, kunci, clear.

const STATUS = ['OK', 'Warning', 'Down', 'N/A'];

let items = [], evid = {};

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

function clearRow(r) {   // kosongkan satu baris (item yang sudah tersimpan tidak bisa dikosongkan)
  if (r.classList.contains('done')) return;
  r.dataset.st = ''; txt(r).value = ''; tm(r).value = '';
  mark(r); upd(); dirty(true);
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

$('#tanggal').onchange = $('#shift').onchange = load;

$('#clear-all').onclick = clearChecklist;
