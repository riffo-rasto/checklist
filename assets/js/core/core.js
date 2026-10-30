// Dasar yang dipakai semua file lain: selektor, state sesi, jembatan ke API PHP, pesan dan error.
// Semua file JS dimuat sebagai script biasa (bukan ES module) berurutan, lihat daftar <script> di index.html.

const $ = s => document.querySelector(s);

const PRI = {P1: 'P1 – Kritis', P2: 'P2 – Tinggi', P3: 'P3 – Menengah', P4: 'P4 – Rutin', END: 'Penutup shift'};

let csrf = '', isAdmin = false;

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

const warn = e => e.status === 401 ? location.reload() : alert(e.message);

const dmy = s => s.split('-').reverse().join('/');
