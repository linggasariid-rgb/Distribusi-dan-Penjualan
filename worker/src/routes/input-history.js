// Tabel input yang boleh dilihat/dihapus histori-nya lewat menu ini -- dibatasi ke
// tabel yang bersifat "append" (riwayat menumpuk per submit), BUKAN biz_stock/stock
// yang selalu di-replace utuh setiap paste (tidak ada histori batch untuk dihapus).
export const ALLOWED_TABLES = ['penjualan_who', 'distribusi', 'penerimaan'];

const SELECT_COLS = {
  penjualan_who: 'cabang,jumlah,created_at',
  distribusi: 'cabang,jumlah,created_at',
  penerimaan: 'gudang,jumlah,created_at',
};

export async function handle(db, table) {
  if (!ALLOWED_TABLES.includes(table)) {
    return { status: 'error', message: 'Tabel tidak dikenali' };
  }

  const since = new Date(Date.now() - 3 * 86400 * 1000).toISOString().split('T')[0];
  let rows;
  try {
    rows = await db.query(table, {
      select: SELECT_COLS[table],
      gte: { tanggal: since },
      order: 'created_at.desc',
    });
  } catch (err) {
    if (String(err.message).includes('created_at') && String(err.message).includes('does not exist')) {
      return { status: 'error', message: 'Tabel ini belum punya kolom created_at -- jalankan worker/add-created-at-migration.sql sekali di Supabase SQL Editor untuk mengaktifkan riwayat batch.' };
    }
    throw err;
  }

  const batches = new Map();
  for (const r of rows) {
    const key = r.created_at;
    if (!batches.has(key)) batches.set(key, { createdAt: key, count: 0, sumJumlah: 0, groups: new Set() });
    const b = batches.get(key);
    b.count++;
    b.sumJumlah += (r.jumlah || 0);
    b.groups.add(r.cabang || r.gudang || '');
  }

  const result = Array.from(batches.values())
    .map(b => ({ createdAt: b.createdAt, count: b.count, sumJumlah: b.sumJumlah, groupCount: b.groups.size }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { status: 'success', batches: result };
}
