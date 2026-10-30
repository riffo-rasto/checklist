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
