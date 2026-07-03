// ──── USER MANIFEST ─────────────────────────────────────────────────────────
//
// Role & Akses:
//   super_admin → Semua menu & semua cabang (10 cabang)
//   admin       → Menu: distribusi, stok + semua cabang
//   admin_whp   → Menu: distribusi, stok + cabang sesuai WHP
//
// WHP Mapping:
//   WHP BANDUNG      → Bandung, Purwakarta, Karawang, Sukabumi, Bogor, Tangerang, Serang
//   WHP TASIKMALAYA  → Tasikmalaya, Garut, Cirebon
//
// Akun:
//   superadmin  / admin123   → super_admin (full akses)
//   admin       / admin456   → admin (semua cabang)
//   whp_tasik   / tasik123   → admin_whp (Tasikmalaya, Garut, Cirebon)
//   whp_bandung / bandung123 → admin_whp (Bandung, Purwakarta, ..., Serang)
// ─────────────────────────────────────────────────────────────────────────────
var USERS = {
  'superadmin':  { passwordHash: _hashPw('admin123'),  role: 'super_admin', name: 'Super Admin',       whp: null },
  'admin':       { passwordHash: _hashPw('admin456'),  role: 'admin',       name: 'Admin',            whp: null },
  'whp_tasik':   { passwordHash: _hashPw('tasik123'),  role: 'admin_whp',   name: 'Admin WHP Tasikmalaya', whp: 'WHP TASIKMALAYA' },
  'whp_bandung': { passwordHash: _hashPw('bandung123'), role: 'admin_whp',  name: 'Admin WHP Bandung',     whp: 'WHP BANDUNG' }
};

function _hashPw(pw) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    hex += ('0' + (digest[i] & 0xFF).toString(16)).slice(-2);
  }
  return hex;
}

function loginUser(username, password) {
  var user = USERS[username.toLowerCase().trim()];
  if (!user) return { status: 'error', message: 'Username tidak ditemukan' };
  if (_hashPw(password) !== user.passwordHash) return { status: 'error', message: 'Password salah' };
  return { status: 'success', role: user.role, name: user.name, whp: user.whp };
}
