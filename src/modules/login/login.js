import { attemptLogin } from '../../services/authService.js';
import { getUserWHP, getUserRole, getUserName, setUserSession, clearUserSession } from '../../state/authState.js';
import { requestNavigate } from '../../events/navigation.js';

export function doLogin() {
  var btn = document.getElementById('login-btn');
  var errEl = document.getElementById('login-error');
  var username = document.getElementById('login-user').value.trim().toLowerCase();
  var password = document.getElementById('login-pass').value;
  if (!username || !password) { alert('Isi username dan password'); return; }
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Memproses...';
  errEl.classList.add('hidden');
  attemptLogin(username, password).then(function(res){
    setUserSession({ whp: res.whp, role: res.role, name: res.name });
    document.getElementById('login-overlay').classList.add('hidden');
    updateUserBadge();
    applyMenuRestrictions();
    requestNavigate('beranda');
  }).catch(function(err){
    errEl.textContent = err.message || 'Login gagal'; errEl.classList.remove('hidden');
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Masuk Dashboard';
  });
}

export function doLogout() {
  clearUserSession();
  document.getElementById('login-overlay').classList.remove('hidden');
  location.reload();
}

export function updateUserBadge() {
  var whp = getUserWHP();
  var role = getUserRole();
  var name = getUserName();
  if (whp) {
    var labels = { admin: 'Admin', admin_whp: 'Admin WHP', super_admin: 'Super Admin' };
    var roleLabel = labels[role] || role;
    document.getElementById('user-info-text').textContent = name + ' (' + roleLabel + ')';
  }
}

export function applyMenuRestrictions() {
  var role = getUserRole() || 'admin';
  var superOnlyIds = ['menu-sales-dashboard','menu-penjualan-who','menu-penerimaan-pabrik','menu-input-distribusi','menu-best-products','menu-daily-report','menu-sales-per-date','menu-input-stok-excel'];
  var isSuper = role === 'super_admin';
  superOnlyIds.forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = isSuper ? '' : 'none';
  });
  var elSalesHub = document.getElementById('menu-sales-hub');
  if (elSalesHub) elSalesHub.style.display = role === 'admin_whp' ? 'none' : '';
}
