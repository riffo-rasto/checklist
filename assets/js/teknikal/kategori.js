// Setting (admin): kategori Teknikal. Memakai tkEl dan tkLoadKat dari teknikal/laporan.js.

let ktEdit = 0;

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

$('#kt-save').onclick = ktSave; $('#kt-reset').onclick = ktReset;
