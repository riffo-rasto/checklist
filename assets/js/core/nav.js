// ---- Navigasi sidebar dan hak akses per peran (admin: semua, noc: Checklist NOC, teknis: Teknikal)
let apps = [], checklistReady = false, meId = 0;
const VIEWS = {checklist: 'tab-checklist', export: 'tab-export', users: 'tab-users', 'tek-dash': 'v-tek-dash', 'tek-list': 'v-tek-list', 'tek-form': 'v-tek-form', 'tek-detail': 'v-tek-detail'};
const TITLES = {checklist: 'Checklist NOC', export: 'Rekap & unduh', users: 'Setting', 'tek-dash': 'Teknikal · Dashboard', 'tek-list': 'Teknikal · Laporan', 'tek-form': 'Teknikal · Form laporan', 'tek-detail': 'Teknikal · Detail laporan'};
const ROLE_LABEL = {admin: 'Admin', noc: 'NOC', teknis: 'Teknis'};
const ROLE_FULL = {admin: 'ADMINISTRATOR', noc: 'NOC', teknis: 'TEKNIS'};
const allowed = v => v === 'users' ? isAdmin : v.startsWith('tek-') ? apps.includes('teknikal') : apps.includes('noc');
function closeSide() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }
function go(v, arg) {
  if (!allowed(v)) return;
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== VIEWS[v]);
  const nav = (v === 'tek-detail' || v === 'tek-form') ? 'tek-list' : v;
  document.querySelectorAll('.side [data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === nav));
  $('#crumb').textContent = TITLES[v];
  closeSide();
  if (v === 'checklist' && !checklistReady) { checklistReady = true; load(); }
  if (v === 'users') { loadUsers(); loadItems(); tekKatAdmin(); }
  if (v.startsWith('tek-')) tkGo(v, arg);
  window.scrollTo(0, 0);
}
$('#burger').onclick = () => {
  const sd = $('#side');
  if (innerWidth < 860) { sd.classList.toggle('open'); $('#scrim').hidden = !sd.classList.contains('open'); }
  else { sd.classList.toggle('min'); try { localStorage.setItem('sidemin', sd.classList.contains('min') ? '1' : ''); } catch (e) {} }
};
$('#scrim').onclick = closeSide;
// dropdown profil: Setting (admin) + Keluar
const closeP = () => { $('#ppanel').hidden = true; $('#pbtn').setAttribute('aria-expanded', 'false'); };
$('#pbtn').onclick = e => { e.stopPropagation(); const open = $('#ppanel').hidden; $('#ppanel').hidden = !open; $('#pbtn').setAttribute('aria-expanded', open ? 'true' : 'false'); };
document.addEventListener('click', e => { if (!$('#pmenu').contains(e.target)) closeP(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeP(); });
$('#u-setting').onclick = () => { closeP(); go('users'); };
document.querySelectorAll('.side [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

function show(u) {
  csrf = u.csrf; isAdmin = u.role === 'admin'; apps = u.apps || []; meId = u.id || 0;
  $('#clear-all').hidden = !isAdmin;
  $('#user').textContent = u.nama; $('#me-name').textContent = u.nama;
  $('#me-role').textContent = ROLE_FULL[u.role] || u.role;
  const ini = (u.nama || '?')[0].toUpperCase(); $('#av').textContent = ini; $('#av2').textContent = ini; $('#u-setting').hidden = !isAdmin;
  document.querySelectorAll('.nav-noc').forEach(e => e.hidden = !apps.includes('noc'));
  document.querySelectorAll('.nav-tek').forEach(e => e.hidden = !apps.includes('teknikal'));
  document.querySelectorAll('.nav-adm').forEach(e => e.hidden = !isAdmin);
  try { if (localStorage.getItem('sidemin') && innerWidth >= 860) $('#side').classList.add('min'); } catch (e) {}
  $('#login-view').hidden = true; $('#app-view').hidden = false;
  go(apps.includes('noc') ? 'checklist' : 'tek-dash');
}
