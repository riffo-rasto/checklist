// Titik masuk: login / logout dan inisialisasi halaman. Harus dimuat paling akhir.

$('#login-form').onsubmit = async ev => {
  ev.preventDefault();
  try {
    show(await api('auth.php?action=login', 'POST', {username: $('#username').value, password: $('#password').value}));
  } catch (e) { $('#login-err').textContent = e.message; }
};
$('#logout').onclick = () => api('auth.php?action=logout', 'POST').finally(() => location.reload());

(async () => {
  $('#tanggal').value = iso(new Date()); thisMonth();
  const h = new Date().getHours();   // Pagi 07-15, Siang 15-23, Malam sisanya (ubah sesuai jadwal)
  $('#shift').value = h >= 7 && h < 15 ? 'Pagi' : h >= 15 && h < 23 ? 'Siang' : 'Malam';
  const u = await api('auth.php').catch(() => ({login: false}));
  u.login ? show(u) : $('#login-view').hidden = false;
})();
