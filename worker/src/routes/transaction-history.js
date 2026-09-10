import { ALLOWED_TABLES } from './input-history.js';

const SELECT_COLS = {
  penjualan_who: 'id,cabang,jumlah,created_at,tanggal,products',
  distribusi: 'id,cabang,jumlah,created_at,tanggal,products,gudang',
  penerimaan: 'id,gudang,jumlah,created_at,tanggal,products',
  penerimaan_cabang: 'id,cabang,created_at,tanggal,products,gudang',
  mutasi_cabang: 'id,cabang_asal,cabang_tujuan,created_at,tanggal,products',
  retur_cabang: 'id,cabang,created_at,tanggal,products,keterangan'
};

export async function handle(db, table, page = 1, limit = 50, startDate = '', endDate = '') {
  if (!ALLOWED_TABLES.includes(table)) {
    return { status: 'error', message: 'Tabel tidak dikenali' };
  }

  try {
    let queryArgs = {
      select: SELECT_COLS[table],
      order: 'created_at.desc',
      limit: limit,
      offset: (page - 1) * limit
    };
    
    if (startDate) {
      queryArgs.gte = { tanggal: startDate };
    }
    if (endDate) {
      queryArgs.lte = { tanggal: endDate };
    }

    const rows = await db.query(table, queryArgs);
    
    // Get total count
    let countArgs = { select: 'id' };
    if (startDate) countArgs.gte = { tanggal: startDate };
    if (endDate) countArgs.lte = { tanggal: endDate };
    const allRows = await db.query(table, countArgs);
    const totalCount = allRows.length;

    return { 
      status: 'success', 
      data: rows,
      total: totalCount,
      page: page,
      totalPages: Math.ceil(totalCount / limit)
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}
