// ---- Setting: CRUD item checklist
let editItem = null;
async function loadItems() {
  try {
    const d = await api('items.php');
    const tb = $('#i-rows'); tb.replaceChildren();
    d.items.forEach(it => {
      const tr = tb.insertRow();
      tr.insertCell().textContent = PRI[it.prioritas];
      tr.insertCell().textContent = it.nama_item;
      tr.insertCell().textContent = +it.aktif ? 'Aktif' : 'Nonaktif';
      const td = tr.insertCell();
      const mk = (t, f, c) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (c) b.className = c; b.onclick = f; td.append(b, ' '); };
      mk('▲', () => moveItem(it, -1)); mk('▼', () => moveItem(it, 1)); mk('Edit', () => fillItem(it)); mk('Hapus', () => delItem(it), 'ghost danger');
    });
  } catch (e) { warn(e); }
}
function fillItem(it) {
  editItem = it.id; $('#i-title').textContent = 'Edit item checklist';
  $('#i-nama').value = it.nama_item; $('#i-pri').value = it.prioritas; $('#i-aktif').checked = !!+it.aktif; $('#i-nama').focus();
}
function resetItemForm() {
  editItem = null; $('#i-title').textContent = 'Tambah item checklist';
  $('#i-nama').value = ''; $('#i-pri').value = 'P1'; $('#i-aktif').checked = true;
}
async function saveItem() {
  const m = $('#i-msg');
  try {
    await api('items.php', 'POST', {action: editItem ? 'update' : 'create', id: editItem, nama_item: $('#i-nama').value, prioritas: $('#i-pri').value, aktif: $('#i-aktif').checked});
    resetItemForm(); loadItems(); m.textContent = 'Item tersimpan'; m.className = 'ok';
  } catch (e) { if (e.status === 401) location.reload(); else { m.textContent = e.message; m.className = 'err'; } }
}
async function moveItem(it, dir) { try { await api('items.php', 'POST', {action: 'move', id: it.id, dir}); loadItems(); } catch (e) { warn(e); } }
async function delItem(it) {
  if (!confirm(`Hapus item "${it.nama_item}"?`)) return;
  try { const d = await api('items.php', 'POST', {action: 'delete', id: it.id}); alert(d.message); loadItems(); } catch (e) { warn(e); }
}
$('#i-save').onclick = saveItem;
$('#i-reset').onclick = resetItemForm;
