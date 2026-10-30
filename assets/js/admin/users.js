// ---- Panel admin: kelola pengguna
let editId = null;
async function loadUsers() {
  try {
    const d = await api('users.php');
    const tb = $('#u-rows'); tb.replaceChildren();
    d.users.forEach(u => {
      const tr = tb.insertRow();
      tr.insertCell().textContent = u.username;
      tr.insertCell().textContent = u.nama;
      tr.insertCell().textContent = ROLE_LABEL[u.role] || u.role;
      tr.insertCell().textContent = +u.aktif ? 'Aktif' : 'Nonaktif';
      const b = document.createElement('button'); b.textContent = 'Edit'; b.onclick = () => editUser(u);
      const del = document.createElement('button'); del.textContent = 'Hapus'; del.className = 'ghost danger'; del.onclick = () => delUser(u);
      tr.insertCell().append(b, ' ', del);
    });
  } catch (e) { onErr(e); }
}
function editUser(u) {
  editId = u.id;
  $('#u-title').textContent = 'Edit pengguna: ' + u.username;
  $('#u-username').value = u.username; $('#u-username').disabled = true;
  $('#u-nama').value = u.nama; $('#u-pass').value = ''; $('#u-pass').placeholder = 'Kosongkan jika tidak diganti';
  $('#u-role').value = u.role; $('#u-aktif').checked = !!+u.aktif;
  window.scrollTo(0, 0);
}
function resetUserForm() {
  editId = null;
  $('#u-title').textContent = 'Tambah pengguna';
  $('#u-username').disabled = false;
  ['#u-username', '#u-nama', '#u-pass'].forEach(s => $(s).value = '');
  $('#u-pass').placeholder = 'Minimal 8 karakter';
  $('#u-role').value = 'noc'; $('#u-aktif').checked = true;
}
async function saveUser() {
  const m = $('#u-msg');
  try {
    await api('users.php', 'POST', {
      action: editId ? 'update' : 'create', id: editId, username: $('#u-username').value, nama: $('#u-nama').value,
      password: $('#u-pass').value, role: $('#u-role').value, aktif: $('#u-aktif').checked
    });
    resetUserForm(); loadUsers(); m.textContent = 'Pengguna tersimpan'; m.className = 'ok';
  } catch (e) { if (e.status === 401) location.reload(); else { m.textContent = e.message; m.className = 'err'; } }
}
$('#u-save').onclick = saveUser;
$('#u-reset').onclick = resetUserForm;

async function delUser(u) {
  if (!confirm(`Hapus pengguna ${u.username}?`)) return;
  try { const d = await api('users.php', 'POST', {action: 'delete', id: u.id}); alert(d.message); loadUsers(); } catch (e) { warn(e); }
}
