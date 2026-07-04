import { CONFIG } from '../config.js';

function parseNum(v) {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(String(v).trim().replace(/\./g,''), 10) || 0;
}

function getBizCabang(row) {
  const name = String(row[1]).trim();
  if (name) return name.toUpperCase();
  const first = String(row[0]).trim();
  if (first && isNaN(Number(first))) return first.toUpperCase();
  return '';
}

export async function handle(db, body) {
  const data = body.data;
  if (!Array.isArray(data) || data.length < 5) {
    return { status: 'error', message: 'Data BIZ tidak lengkap (min 5 baris)' };
  }

  const periode = (String(data[1]?.[8] || '')).replace('Stok Barang ALL Cabang Periode : ', '').trim() || 'unknown';
  const headers = data[3];

  const productCols = [];
  for (let j = 2; j < headers.length; j++) {
    const name = String(headers[j]).trim();
    if (name) productCols.push({ col: j, name });
  }

  try {
    await db._fetch(`/rest/v1/biz_stock?periode=eq.${encodeURIComponent(periode)}`, 'DELETE', null, {
      'apikey': db.headers['apikey'],
      'Authorization': db.headers['Authorization'],
      'Prefer': 'return=minimal',
    });
  } catch (_) {}

  let count = 0;
  for (let i = 4; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 2) continue;
    const cabang = getBizCabang(r);
    if (!cabang) continue;

    const products = {};
    for (const pc of productCols) {
      products[pc.name] = parseNum(r[pc.col]);
    }

    try {
      await db.request('POST', 'biz_stock', { data: { cabang, products, periode } });
      count++;
    } catch (e) {
      console.error(`BIZ error ${cabang}:`, e.message);
    }
  }

  return { status: 'success', message: `${count} baris data BIZ berhasil disimpan (periode: ${periode})` };
}
