import { buildProductColumnMap } from '../config.js';

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

  const headers = Array.isArray(data[0]) ? data[0].map(h => String(h).trim()) : [];
  const productCols = buildProductColumnMap(headers);

  let count = 0;
  // Mulai dari i=1 -- baris 0 adalah header, bukan data cabang.
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 2) continue;
    const cabang = String(r[0] || '').trim().toUpperCase();
    if (!cabang || cabang === 'TOTAL') continue;

    const products = {};
    if (Object.keys(productCols).length > 0) {
      for (const [key, idx] of Object.entries(productCols)) {
        products[key] = parseNum(r[idx]);
      }
    } else {
      for (let j = 1; j < r.length; j++) {
        products[`Kolom${j}`] = parseNum(r[j]);
      }
    }

    try {
      await db.request('POST', 'stock', {
        data: { cabang, products },
        onConflict: 'cabang',
      });
      count++;
    } catch (e) {
      console.error(`Stock error ${cabang}:`, e.message);
    }
  }

  return { status: 'success', message: `${count} baris data stok berhasil disimpan` };
}
