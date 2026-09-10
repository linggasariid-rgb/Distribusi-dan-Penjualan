import { ALLOWED_TABLES } from './input-history.js';

export async function handle(db, body) {
  const { table, id } = body;
  if (!ALLOWED_TABLES.includes(table)) {
    return { status: 'error', message: 'Tabel tidak dikenali' };
  }
  if (!id) {
    return { status: 'error', message: 'ID wajib diisi' };
  }

  const path = `/rest/v1/${table}?id=eq.${id}`;
  const headers = { ...db.headers, Prefer: 'return=representation' };
  const deleted = await db._fetch(path, 'DELETE', null, headers);
  const count = Array.isArray(deleted) ? deleted.length : 0;

  if (count === 0) {
    return { status: 'error', message: 'Tidak ada data ditemukan untuk baris ini (mungkin sudah dihapus)' };
  }
  return { status: 'success', message: `Baris berhasil dihapus`, deleted: count };
}
