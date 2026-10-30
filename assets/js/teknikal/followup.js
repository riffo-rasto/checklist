// Update tindak lanjut laporan Teknikal (tindakan + foto, riwayat tersimpan), mirip fitur Update di Checklist NOC.
// Dipanggil dari tkDetail() di teknikal/laporan.js. Memakai: tkEl, tkThumb, tkDetail, api, shrink, warn, isAdmin.
// Update hanya bisa ditambah selagi status laporan belum "Selesai"; centang "Pekerjaan sudah selesai" menutup laporan (status = Selesai).
function tkUpdateBox(id, l, d) {
  const sec = tkEl('div', 'tk-sec'), ups = d.updates || [], closed = l.status === 'Selesai';
  const head = tkEl('div', 'uhead');
  head.append(tkEl('b', '', `Riwayat update (${ups.length})`),
    tkEl('span', 'chip ' + (closed ? 'ok' : 'warn'), closed ? '✔ Pekerjaan selesai' : (ups.length ? '⏳ Dalam penanganan' : 'Belum ada tindak lanjut')));
  const add = tkEl('button', 'primary small', '+ Update'); add.type = 'button';
  if (d.can_edit && !closed) head.append(add);
  sec.append(head);

  ups.forEach(u => {
    const li = tkEl('div', 'ui');
    li.append(tkEl('div', 'meta', `${u.waktu} · ${u.petugas}${u.selesai ? ' · ✔ Selesai' : ''}`), tkEl('div', 'tx', u.tindakan));
    if (u.ev.length) { const ph = tkEl('div', 'tk-ph'); u.ev.forEach(fid => ph.append(tkThumb(fid))); li.append(ph); }
    if (isAdmin) {
      const x = tkEl('button', 'ghost small danger', 'Hapus update'); x.type = 'button';
      x.onclick = async () => {
        if (!confirm('Hapus update ini beserta fotonya?')) return;
        try { await api('teknikal.php', 'POST', {action: 'update_delete', id: u.id}); tkDetail(id); } catch (e) { warn(e); }
      };
      li.append(x);
    }
    sec.append(li);
  });

  if (d.can_edit && !closed) {
    const f = tkEl('div', 'uform'); f.hidden = true;
    const ta = document.createElement('textarea'); ta.rows = 3; ta.maxLength = 2000; ta.placeholder = 'Tindakan yang dilakukan / hasil penanganan';
    const cl = tkEl('label', 'chk'), cb = document.createElement('input'); cb.type = 'checkbox'; cl.append(cb, ' Pekerjaan sudah selesai');
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.hidden = true;
    const pick = tkEl('button', 'ghost small', '📷 Pilih foto (maks. 5)'); pick.type = 'button';
    const cnt = tkEl('span', 'chip', 'Belum ada foto');
    pick.onclick = () => file.click();
    file.onchange = () => { cnt.textContent = file.files.length ? `${file.files.length} foto dipilih` : 'Belum ada foto'; };
    const fr = tkEl('div', 'uhead'); fr.append(pick, cnt, file);
    const send = tkEl('button', 'primary small', 'Kirim update'), cancel = tkEl('button', 'ghost small', 'Batal');
    send.type = 'button'; cancel.type = 'button';
    const fb = tkEl('div', 'uhead'); fb.append(send, cancel);
    cancel.onclick = () => { f.hidden = true; };
    add.onclick = () => { f.hidden = !f.hidden; if (!f.hidden) ta.focus(); };
    send.onclick = async () => {
      if (!ta.value.trim()) return alert('Isi kolom tindakan dulu');
      if (file.files.length > 5) return alert('Maksimal 5 foto per update');
      send.disabled = true;
      try {
        const fd = new FormData();
        fd.append('action', 'update_add'); fd.append('laporan_id', id); fd.append('tindakan', ta.value.trim()); fd.append('selesai', cb.checked ? 1 : 0);
        for (const fl of file.files) fd.append('files[]', await shrink(fl), 'foto.jpg');
        await api('teknikal.php', 'POST', fd);
        tkDetail(id);
      } catch (e) { send.disabled = false; warn(e); }
    };
    f.append(ta, cl, fr, fb); sec.append(f);
  }
  return sec;
}
