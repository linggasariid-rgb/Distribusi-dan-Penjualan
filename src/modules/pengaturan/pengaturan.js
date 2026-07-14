import { callApi } from '../../services/api.js';
import { getUserName, getUserRole, getUserWHP } from '../../state/authState.js';
import { showToast } from '../../ui/toast.js';
import { showConfirmModal } from '../../ui/modal.js';

var usersData = [];
var editingUserId = null;

function roleBadge(role) {
  var colors = {
    super_admin: 'background:var(--color-accent-light);color:var(--color-accent)',
    admin: 'background:var(--color-info-light);color:var(--color-info)',
    admin_whp: 'background:var(--color-warning-light);color:var(--color-warning)',
  };
  var labels = { super_admin: 'Super Admin', admin: 'Admin', admin_whp: 'Admin WHP' };
  return '<span style="' + (colors[role] || '') + ';padding:0.2rem 0.6rem;border-radius:var(--radius-full);font-size:0.7rem;font-weight:600">' + (labels[role] || role) + '</span>';
}

function statusBadge(isActive) {
  if (isActive) return '<span style="background:var(--color-success-light);color:var(--color-success);padding:0.2rem 0.6rem;border-radius:var(--radius-full);font-size:0.7rem;font-weight:600">Aktif</span>';
  return '<span style="background:var(--color-danger-light);color:var(--color-danger);padding:0.2rem 0.6rem;border-radius:var(--radius-full);font-size:0.7rem;font-weight:600">Nonaktif</span>';
}

export async function loadUsers() {
  var container = document.getElementById('users-table-body');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="6" class="text-center py-6" style="color:var(--color-text-muted)"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat data...</td></tr>';

  try {
    var res = await callApi('getUsers');
    usersData = res.data || [];
    renderUsersTable();
  } catch (e) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-6" style="color:var(--color-danger)"><i class="fas fa-exclamation-triangle mr-2"></i>Gagal memuat data user</td></tr>';
  }
}

function renderUsersTable() {
  var container = document.getElementById('users-table-body');
  if (!container) return;

  if (usersData.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-6" style="color:var(--color-text-muted)"><i class="fas fa-users mr-2"></i>Belum ada user</td></tr>';
    return;
  }

  var currentUsername = getUserName();
  var html = '';
  usersData.forEach(function(user, i) {
    var isSelf = user.username === currentUsername;
    html += '<tr style="border-bottom:1px solid var(--color-border)">';
    html += '<td class="py-3 px-4 text-sm" style="color:var(--color-text-muted)">' + (i + 1) + '</td>';
    html += '<td class="py-3 px-4"><span class="font-semibold text-sm" style="color:var(--color-text)">' + escHtml(user.username) + '</span></td>';
    html += '<td class="py-3 px-4 text-sm" style="color:var(--color-text)">' + escHtml(user.name) + '</td>';
    html += '<td class="py-3 px-4">' + roleBadge(user.role) + '</td>';
    html += '<td class="py-3 px-4 text-xs" style="color:var(--color-text-muted)">' + escHtml(user.whp) + '</td>';
    html += '<td class="py-3 px-4">' + statusBadge(user.is_active) + '</td>';
    html += '<td class="py-3 px-4">';
    if (isSelf) {
      html += '<span style="color:var(--color-text-muted);font-size:0.75rem">Akun Anda</span>';
    } else {
      html += '<div class="flex items-center gap-2">';
      html += '<button onclick="window._editUser(\'' + user.id + '\')" class="btn-icon" title="Edit" style="color:var(--color-info);background:var(--color-info-light);width:2rem;height:2rem;border-radius:var(--radius-sm);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border:none"><i class="fas fa-pen text-xs"></i></button>';
      html += '<button onclick="window._deleteUser(\'' + user.id + '\',\'' + escHtml(user.username) + '\')" class="btn-icon" title="Hapus" style="color:var(--color-danger);background:var(--color-danger-light);width:2rem;height:2rem;border-radius:var(--radius-sm);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border:none"><i class="fas fa-trash text-xs"></i></button>';
      html += '</div>';
    }
    html += '</td>';
    html += '</tr>';
  });
  container.innerHTML = html;
}

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function getRoleOptions(selected) {
  var roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'admin_whp', label: 'Admin WHP' },
  ];
  return roles.map(function(r) {
    return '<option value="' + r.value + '"' + (r.value === selected ? ' selected' : '') + '>' + r.label + '</option>';
  }).join('');
}

function getWhpOptions(selected) {
  var whps = [
    { value: 'ALL', label: 'ALL' },
    { value: 'WHP BANDUNG', label: 'WHP Bandung' },
    { value: 'WHP TASIKMALAYA', label: 'WHP Tasikmalaya' },
  ];
  return whps.map(function(w) {
    return '<option value="' + w.value + '"' + (w.value === selected ? ' selected' : '') + '>' + w.label + '</option>';
  }).join('');
}

function showUserModal(title, data, isEdit) {
  var modal = document.getElementById('userModal');
  var modalTitle = document.getElementById('userModalTitle');
  var form = document.getElementById('userForm');
  var errEl = document.getElementById('userModalError');

  modalTitle.textContent = title;
  errEl.classList.add('hidden');
  form.reset();

  if (data) {
    document.getElementById('user-form-id').value = data.id || '';
    document.getElementById('user-form-username').value = data.username || '';
    document.getElementById('user-form-name').value = data.name || '';
    document.getElementById('user-form-role').value = data.role || 'admin';
    document.getElementById('user-form-whp').value = data.whp || 'ALL';
    document.getElementById('user-form-active').checked = data.is_active !== false;
    if (isEdit) {
      document.getElementById('user-form-username').disabled = true;
      document.getElementById('user-form-password').required = false;
      document.getElementById('user-form-password').placeholder = 'Kosongkan jika tidak diubah';
    }
  } else {
    document.getElementById('user-form-id').value = '';
    document.getElementById('user-form-username').disabled = false;
    document.getElementById('user-form-password').required = true;
    document.getElementById('user-form-password').placeholder = 'Minimal 6 karakter';
  }

  editingUserId = isEdit ? data.id : null;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function hideUserModal() {
  var modal = document.getElementById('userModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  editingUserId = null;
  document.getElementById('user-form-username').disabled = false;
  document.getElementById('user-form-password').required = true;
  document.getElementById('user-form-password').placeholder = 'Minimal 6 karakter';
}

async function saveUser() {
  var form = document.getElementById('userForm');
  var errEl = document.getElementById('userModalError');
  var submitBtn = document.getElementById('userFormSubmit');

  var id = document.getElementById('user-form-id').value;
  var username = document.getElementById('user-form-username').value.trim();
  var password = document.getElementById('user-form-password').value;
  var name = document.getElementById('user-form-name').value.trim();
  var role = document.getElementById('user-form-role').value;
  var whp = document.getElementById('user-form-whp').value;
  var is_active = document.getElementById('user-form-active').checked;

  errEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';

  try {
    if (editingUserId) {
      var body = { name: name, role: role, whp: whp, is_active: is_active };
      if (password) body.password = password;
      var url = BASE_URL() + '/api/users/' + editingUserId;
      var res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      showToast('User berhasil diupdate');
    } else {
      if (!username || !password || !name) {
        throw new Error('Semua field wajib diisi');
      }
      var res = await fetch(BASE_URL() + '/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password, name: name, role: role, whp: whp, is_active: is_active })
      });
      var data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      showToast('User berhasil ditambahkan');
    }
    hideUserModal();
    loadUsers();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan';
  }
}

function BASE_URL() {
  return 'https://api-distribusi.distribusi-tsi.workers.dev';
}

window._editUser = function(id) {
  var user = usersData.find(function(u) { return u.id === id; });
  if (user) showUserModal('Edit User', user, true);
};

window._deleteUser = function(id, username) {
  showConfirmModal('Yakin ingin menghapus user "' + username + '"?', async function() {
    try {
      var res = await fetch(BASE_URL() + '/api/users/' + id, { method: 'DELETE' });
      var data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      showToast('User berhasil dihapus');
      loadUsers();
    } catch (e) {
      showToast(e.message || 'Gagal menghapus user', 'error');
    }
  }, {
    title: 'Hapus User',
    yesText: 'Ya, Hapus',
    yesStyle: { background: 'var(--color-danger)', color: 'white' },
    noText: 'Batal'
  });
};

export function initPengaturanView() {
  var nameEl = document.getElementById('settings-user-name');
  var roleEl = document.getElementById('settings-user-role');
  var whpEl = document.getElementById('settings-user-whp');
  var name = getUserName() || '-';
  var role = getUserRole() || '-';
  var whp = getUserWHP() || '-';
  var roleLabels = { admin: 'Admin', admin_whp: 'Admin WHP', super_admin: 'Super Admin' };
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = roleLabels[role] || role;
  if (whpEl) whpEl.textContent = whp;

  var themeBtn = document.getElementById('settings-theme-toggle');
  var themeDot = document.getElementById('settings-theme-dot');
  function syncThemeToggle() {
    var isDark = document.documentElement.classList.contains('dark');
    if (themeBtn) themeBtn.style.background = isDark ? '#22C55E' : 'var(--color-border)';
    if (themeDot) themeDot.style.transform = isDark ? 'translateX(22px)' : 'translateX(2px)';
  }
  syncThemeToggle();
  if (themeBtn) {
    themeBtn.onclick = function() {
      document.documentElement.classList.toggle('dark');
      syncThemeToggle();
    };
  }

  var role = getUserRole();
  var adminSection = document.getElementById('admin-user-management');
  if (adminSection) {
    adminSection.style.display = role === 'super_admin' ? '' : 'none';
  }

  if (role === 'super_admin') {
    loadUsers();

    var addBtn = document.getElementById('add-user-btn');
    if (addBtn) {
      addBtn.onclick = function() {
        showUserModal('Tambah User Baru', null, false);
      };
    }

    var userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.onsubmit = function(e) {
        e.preventDefault();
        saveUser();
      };
    }

    var modalClose = document.getElementById('userModalClose');
    if (modalClose) modalClose.onclick = hideUserModal;

    var modalCancel = document.getElementById('userModalCancel');
    if (modalCancel) modalCancel.onclick = hideUserModal;
  }
}
