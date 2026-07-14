import { ALLOWED_TABLES } from './input-history.js';

// Hard delete satu batch input (semua baris dengan created_at yang sama persis --
// created_at diisi otomatis oleh Supabase per request POST, jadi satu klik "Simpan
// Data" di frontend = satu timestamp unik = satu batch).
export async function handle(db, body) {
  const { table, createdAt } = body;
  if (!ALLOWED_TABLES.includes(table)) {
    return { status: 'error', message: 'Tabel tidak dikenali' };
  }
  if (!createdAt) {
    return { status: 'error', message: 'createdAt wajib diisi' };
  }

  const path = `/rest/v1/${table}?created_at=eq.${encodeURIComponent(createdAt)}`;
  const headers = { ...db.headers, Prefer: 'return=representation' };
  const deleted = await db._fetch(path, 'DELETE', null, headers);
  const count = Array.isArray(deleted) ? deleted.length : 0;

  if (count === 0) {
    return { status: 'error', message: 'Tidak ada data ditemukan untuk batch ini (mungkin sudah dihapus)' };
  }
  return { status: 'success', message: `${count} baris berhasil dihapus`, deleted: count };
}
