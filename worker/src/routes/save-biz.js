import { CONFIG } from '../config.js';

// Satu slot data "current" -- setiap paste baru MENIMPA seluruh data BIZ yang ada,
// tidak per-periode (user tidak perlu isi tanggal/periode apapun, sesuai desain
// menu "Input Stok Excel" yang serupa: paste data mentah, replace semua).
const CURRENT_PERIODE = 'current';

function parseNum(v) {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(String(v).trim().replace(/\./g,''), 10) || 0;
}

// Tiap baris: [No, Cabang/Stokis, angka produk...] -- TANPA header. Cabang diambil
// dari kolom ke-2 (index 1); kalau kosong, fallback ke kolom pertama asal bukan angka
// (No.), port dari ControlPoint.js:68-74 (GAS legacy).
function getBizCabang(row) {
  const name = String(row[1] || '').trim();
  if (name) return name.toUpperCase();
  const first = String(row[0] || '').trim();
  if (first && isNaN(Number(first))) return first.toUpperCase();
  return '';
}

export async function handle(db, body) {
  const data = body.data;
  if (!Array.isArray(data) || data.length === 0) {
    return { status: 'error', message: 'Data kosong atau tidak valid' };
  }

  try {
    await db._fetch(`/rest/v1/biz_stock?periode=eq.${encodeURIComponent(CURRENT_PERIODE)}`, 'DELETE', null, {
      'apikey': db.headers['apikey'],
      'Authorization': db.headers['Authorization'],
      'Prefer': 'return=minimal',
    });
  } catch (_) {}

  const rows = [];
  for (const r of data) {
    if (!r || r.length < 2) continue;
    const cabang = getBizCabang(r);
    if (!cabang) continue;

    const products = {};
    CONFIG.BIZ_SHEET_COLUMN_ORDER.forEach((name, idx) => {
      products[name] = parseNum(r[idx + 2]); // kolom 0=No, 1=Cabang, 2..=produk
    });

    rows.push({ cabang, products, periode: CURRENT_PERIODE });
  }

  if (rows.length === 0) {
    return { status: 'error', message: 'Tidak ada baris data valid' };
  }

  // Kirim per-batch (bukan satu request per baris) -- Cloudflare Worker punya limit
  // subrequest per invocation, dan data BIZ bisa ratusan baris (cabang + banyak stokis).
  const BATCH_SIZE = 200;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await db.request('POST', 'biz_stock', { data: batch });
      count += batch.length;
    } catch (e) {
      console.error('BIZ batch error:', e.message);
    }
  }

  return { status: 'success', message: `${count} baris data BIZ berhasil disimpan` };
}
