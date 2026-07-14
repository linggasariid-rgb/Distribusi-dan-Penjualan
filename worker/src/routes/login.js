var FALLBACK_USERS = {
  'superadmin':  { hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'super_admin', name: 'Super Admin',       whp: 'ALL' },
  'admin':       { hash: 'becf77f3ec82a43422b7712134d1860e3205c6ce778b08417a7389b43f2b4661', role: 'admin',       name: 'Admin',            whp: 'ALL' },
  'whp_tasik':   { hash: 'd557d6e83b48f14f16a6175d1731cd08ed922b937b13d9f4cee50d72426fb5e8', role: 'admin_whp',   name: 'Admin WHP Tasikmalaya', whp: 'WHP TASIKMALAYA' },
  'whp_bandung': { hash: '078a7c4715356e3c9b325ac65ac5f2257650db2792cf01468f0df684c50451bb', role: 'admin_whp',   name: 'Admin WHP Bandung',     whp: 'WHP BANDUNG' },
};

async function sha256(msg) {
  var msgBuffer = new TextEncoder().encode(msg);
  var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function(b){ return b.toString(16).padStart(2, '0') }).join('');
}

export async function handle(body, db) {
  var username = (body.username || '').toLowerCase().trim();
  var password = body.password || '';
  if (!username || !password) {
    return { status: 'error', message: 'Username dan password harus diisi' };
  }

  var hash = await sha256(password);

  if (db) {
    try {
      var data = await db.query('users', {
        select: 'username,password_hash,name,role,whp,is_active',
        eq: { username: username },
        limit: 1
      });
      if (data && data.length > 0) {
        var user = data[0];
        if (!user.is_active) {
          return { status: 'error', message: 'Akun tidak aktif' };
        }
        if (hash !== user.password_hash) {
          return { status: 'error', message: 'Password salah' };
        }
        return {
          status: 'success',
          role: user.role,
          name: user.name,
          whp: user.whp,
        };
      }
    } catch (e) {
      console.error('DB login error, using fallback:', e.message);
    }
  }

  var user = FALLBACK_USERS[username];
  if (!user) {
    return { status: 'error', message: 'Username tidak ditemukan' };
  }
  if (hash !== user.hash) {
    return { status: 'error', message: 'Password salah' };
  }
  return {
    status: 'success',
    role: user.role,
    name: user.name,
    whp: user.whp,
  };
}
