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
