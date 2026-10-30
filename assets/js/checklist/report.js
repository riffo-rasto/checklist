const download = fmt => {
  if (!$('#from').value || !$('#to').value) return;
  location.href = `api/export.php?from=${$('#from').value}&to=${$('#to').value}&format=${fmt}&foto=${$('#inc-foto').checked ? 1 : 0}&shift=${encodeURIComponent($('#f-shift').value)}&petugas=${encodeURIComponent($('#f-pet').value)}`;
};

$('#dl-csv').onclick = () => download('csv');
$('#dl-xlsx').onclick = () => download('xlsx');
const thisMonth = () => { const t = new Date(); $('#from').value = iso(new Date(t.getFullYear(), t.getMonth(), 1)); $('#to').value = iso(t); };
$('#this-month').onclick = thisMonth;

// ---- Rekap: tampilkan dulu di web (bisa difilter dan diurutkan), unduh belakangan

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

$('#print-rpt').onclick = () => window.print();   // di dialog cetak pilih "Save as PDF"
$('#only-bad').onchange = e => $('#rpt').classList.toggle('only', e.target.checked);
