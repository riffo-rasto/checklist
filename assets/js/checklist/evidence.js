// Foto evidence per item checklist (tambah / hapus sebelum item disimpan).

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
