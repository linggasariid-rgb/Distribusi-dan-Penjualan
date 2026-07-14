async function sha256(msg) {
  var msgBuffer = new TextEncoder().encode(msg);
  var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function(b){ return b.toString(16).padStart(2, '0') }).join('');
}

export async function list(db) {
  try {
    var data = await db.query('users', {
      select: 'id,username,name,role,whp,is_active,created_at,updated_at',
      order: 'created_at.asc'
    });
    return { status: 'success', data: data || [] };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export async function create(db, body) {
  var username = (body.username || '').toLowerCase().trim();
  var password = body.password || '';
  var name = (body.name || '').trim();
  var role = body.role || 'admin';
  var whp = body.whp || 'ALL';
  var is_active = body.is_active !== false;

  if (!username || !password || !name) {
    return { status: 'error', message: 'Username, password, dan nama harus diisi' };
  }
  if (password.length < 6) {
    return { status: 'error', message: 'Password minimal 6 karakter' };
  }
  var validRoles = ['super_admin', 'admin', 'admin_whp'];
  if (validRoles.indexOf(role) === -1) {
    return { status: 'error', message: 'Role tidak valid' };
  }

  var password_hash = await sha256(password);

  try {
    var existing = await db.query('users', { select: 'id', eq: { username: username }, limit: 1 });
    if (existing && existing.length > 0) {
      return { status: 'error', message: 'Username sudah digunakan' };
    }
  } catch (e) {
    return { status: 'error', message: 'Gagal cek username: ' + e.message };
  }

  try {
    await db.request('POST', 'users', {
      data: { username, password_hash, name, role, whp, is_active }
    });
    return { status: 'success', message: 'User berhasil ditambahkan' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export async function update(db, id, body) {
  var updates = {};
  if (body.name) updates.name = body.name.trim();
  if (body.role) updates.role = body.role;
  if (body.whp) updates.whp = body.whp;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  updates.updated_at = new Date().toISOString();

  if (body.password) {
    if (body.password.length < 6) {
      return { status: 'error', message: 'Password minimal 6 karakter' };
    }
    updates.password_hash = await sha256(body.password);
  }

  if (body.role) {
    var validRoles = ['super_admin', 'admin', 'admin_whp'];
    if (validRoles.indexOf(body.role) === -1) {
      return { status: 'error', message: 'Role tidak valid' };
    }
  }

  var path = `/rest/v1/users?id=eq.${encodeURIComponent(id)}`;
  var headers = { ...db.headers, Prefer: 'return=minimal', 'Content-Type': 'application/json' };
  var res = await fetch(`${db.url}${path}`, {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    var text = await res.text();
    return { status: 'error', message: `Gagal update: ${text.slice(0, 200)}` };
  }

  return { status: 'success', message: 'User berhasil diupdate' };
}

export async function remove(db, id) {
  if (!id) return { status: 'error', message: 'ID user harus diisi' };

  try {
    var user = await db.query('users', { select: 'username,role', eq: { id: id }, limit: 1 });
    if (user && user.length > 0 && user[0].role === 'super_admin') {
      var allSuperAdmins = await db.query('users', { select: 'id', eq: { role: 'super_admin' } });
      if (allSuperAdmins && allSuperAdmins.length <= 1) {
        return { status: 'error', message: 'Tidak bisa menghapus super admin terakhir' };
      }
    }
  } catch (e) {
    return { status: 'error', message: 'Gagal cek user: ' + e.message };
  }

  var path = `/rest/v1/users?id=eq.${encodeURIComponent(id)}`;
  var headers = { ...db.headers, Prefer: 'return=minimal' };
  var res = await fetch(`${db.url}${path}`, { method: 'DELETE', headers });
  if (!res.ok) {
    var text = await res.text();
    return { status: 'error', message: `Gagal menghapus: ${text.slice(0, 200)}` };
  }
  return { status: 'success', message: 'User berhasil dihapus' };
}
