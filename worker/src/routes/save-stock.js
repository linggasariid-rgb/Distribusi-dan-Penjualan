import { CONFIG } from '../config.js';

// Urutan kolom produk PERSIS sama dengan kolom B-W di sheet "Update-STOCK"
// (setelah itu ada kolom "Jumlah"/"Karton" yang sengaja diabaikan, itu nilai turunan).
const PRODUCT_COLUMN_ORDER = Object.keys(CONFIG.PRODUCT_INFO);

function parseNum(v) {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(String(v).trim().replace(/\./g,''), 10) || 0;
}

// Menu "Input Stok Excel" meminta user paste TANPA kolom cabang (instruksi UI: "kolom B
// sampai W, tanpa kolom A/Cabang", urutan baris harus sama dengan sheet Update-STOCK).
// Jadi tidak ada header/nama cabang untuk dicocokkan -- pemetaan MURNI posisional:
// baris ke-N -> CONFIG.STOCK_SHEET_ROW_ORDER[N], kolom ke-M -> PRODUCT_COLUMN_ORDER[M].
// Port dari DataEntry.js:223-275 (savePastedDataUpdateStock, GAS legacy) yang juga
// menulis positional ke sheet, bukan mencocokkan nama header.
export async function handle(db, body) {
  const data = body.data;
  if (!Array.isArray(data) || data.length < 1) {
    return { status: 'error', message: 'Data kosong atau tidak valid' };
  }

  // Kalau baris pertama ternyata berisi teks (bukan angka) -- kemungkinan header yang
  // tidak sengaja ikut ter-paste -- buang baris itu.
  let rows = data;
  const firstRow = data[0] || [];
  const looksLikeHeader = firstRow.some(c => {
    const s = String(c || '').trim();
    return s !== '' && s !== '-' && isNaN(Number(s.replace(/\./g, '')));
  });
  if (looksLikeHeader) rows = data.slice(1);

  if (rows.length === 0) {
    return { status: 'error', message: 'Tidak ada baris data valid' };
  }
  if (rows.length > CONFIG.STOCK_SHEET_ROW_ORDER.length) {
    return {
      status: 'error',
      message: `Terlalu banyak baris (${rows.length}) -- maksimal ${CONFIG.STOCK_SHEET_ROW_ORDER.length} cabang sesuai urutan Update-STOCK.`,
    };
  }

  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const cabang = CONFIG.STOCK_SHEET_ROW_ORDER[i];
    const r = rows[i];
    const products = {};
    PRODUCT_COLUMN_ORDER.forEach((key, colIdx) => { products[key] = parseNum(r[colIdx]); });

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

  return { status: 'success', message: `${count} baris data stok berhasil disimpan (urutan: ${CONFIG.STOCK_SHEET_ROW_ORDER.slice(0, count).join(', ')})` };
}
