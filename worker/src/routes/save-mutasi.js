import { buildProductColumnMap } from '../config.js';

function parseDate(str) {
  if (!str || str === '-') return null;
  const s = String(str).trim();
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let y = slashMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${slashMatch[2].padStart(2,'0')}-${slashMatch[1].padStart(2,'0')}`;
  }
  const dashMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    return `${dashMatch[1]}-${dashMatch[2].padStart(2,'0')}-${dashMatch[3].padStart(2,'0')}`;
  }
  return null;
}

function parseNum(v) {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(String(v).trim().replace(/\./g,''), 10) || 0;
}

export async function handle(db, body) {
  const data = body.data;
  if (!Array.isArray(data) || data.length < 2) {
    return { status: 'error', message: 'Data kosong atau tidak valid' };
  }

  const headers = data[0].map(h => String(h).trim());
  const productCols = buildProductColumnMap(headers);

  const tglCol = headers.findIndex(h => h.toUpperCase().includes('TANGGAL'));
  const asalCol = headers.findIndex(h => h.toUpperCase().includes('ASAL'));
  const tujuanCol = headers.findIndex(h => h.toUpperCase().includes('TUJUAN'));

  if (Object.keys(productCols).length === 0) {
    return { status: 'error', message: 'Header kolom produk tidak dikenali.' };
  }
  if (tglCol === -1 || asalCol === -1 || tujuanCol === -1) {
    return { status: 'error', message: 'Kolom TANGGAL, ASAL, atau TUJUAN tidak ditemukan.' };
  }

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 2) continue;
    
    const tanggal = parseDate(r[tglCol]);
    if (!tanggal) continue;

    const cabang_asal = String(r[asalCol]).trim().toUpperCase();
    const cabang_tujuan = String(r[tujuanCol]).trim().toUpperCase();
    if (!cabang_asal || !cabang_tujuan) continue;

    const products = {};
    for (const [key, idx] of Object.entries(productCols)) {
      products[key] = parseNum(r[idx]);
    }

    rows.push({ tanggal, cabang_asal, cabang_tujuan, products });
  }

  if (rows.length === 0) {
    return { status: 'error', message: 'Tidak ada baris data valid' };
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.request('POST', 'mutasi_cabang', { data: rows.slice(i, i + 500) });
  }

  return { status: 'success', message: `${rows.length} baris data mutasi berhasil disimpan` };
}
