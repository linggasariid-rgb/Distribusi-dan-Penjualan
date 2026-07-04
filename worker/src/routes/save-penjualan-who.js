import { buildProductColumnMap } from '../config.js';

const MONTH_MAP = { jan:'01',feb:'02',mar:'03',apr:'04',mei:'05',jun:'06',jul:'07',ags:'08',sep:'09',okt:'10',nov:'11',des:'12' };

function parseDate(str) {
  if (!str || str === '-') return null;
  if (typeof str === 'number') {
    return new Date((str - 25569) * 86400 * 1000).toISOString().split('T')[0];
  }
  const s = String(str).trim();
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let y = slashMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${slashMatch[2].padStart(2,'0')}-${slashMatch[1].padStart(2,'0')}`;
  }
  const textMatch = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{2})$/);
  if (textMatch) {
    const m = MONTH_MAP[textMatch[2].toLowerCase()];
    if (m) return `20${textMatch[3]}-${m}-${textMatch[1].padStart(2,'0')}`;
  }
  return null;
}

function parseNum(v) {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(String(v).trim().replace(/\./g,''), 10) || 0;
}

function rowSignature(row) {
  return `${row.cabang}|${row.tanggal}|${row.tipe_customer}|${row.jumlah}|${JSON.stringify(row.products)}`;
}

export async function handle(db, body) {
  const data = body.data;
  if (!Array.isArray(data) || data.length < 2) {
    return { status: 'error', message: 'Data kosong atau tidak valid' };
  }

  const headers = data[0].map(h => String(h).trim());
  const productCols = buildProductColumnMap(headers);
  // Cari kolom JUMLAH lewat nama header, BUKAN r[r.length-1] -- rentan salah kolom kalau
  // baris yang dipaste user punya jumlah kolom lebih/kurang dari header (trailing cell
  // kosong/tambahan ikut kebawa saat copy-paste dari Excel).
  const jumlahCol = headers.findIndex(h => h.toUpperCase() === 'JUMLAH');

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 4) continue;
    const tanggal = parseDate(r[3]);
    if (!tanggal) continue;

    const products = {};
    for (const [key, idx] of Object.entries(productCols)) {
      products[key] = parseNum(r[idx]);
    }

    const jumlah = jumlahCol >= 0 ? parseNum(r[jumlahCol]) : Object.values(products).reduce((s, v) => s + v, 0);
    rows.push({
      bulan: (r[0] || '').toUpperCase(),
      cabang: (r[1] || '').toUpperCase().trim(),
      tipe_customer: r[2] || '',
      tanggal,
      products,
      jumlah,
    });
  }

  if (rows.length === 0) {
    return { status: 'error', message: 'Tidak ada baris data valid' };
  }

  // Proteksi submit ganda: buang baris yang isinya identik (cabang+tanggal+tipe+jumlah+products)
  // dengan baris yang sudah ada di database, atau duplikat di dalam batch yang sama --
  // mencegah data dobel kalau tombol simpan tidak sengaja tertekan dua kali.
  const dates = [...new Set(rows.map(r => r.tanggal))].sort();
  const existingRows = await db.query('penjualan_who', {
    select: 'cabang,tanggal,tipe_customer,jumlah,products',
    gte: { tanggal: dates[0] },
    lte: { tanggal: dates[dates.length - 1] },
  });
  const seen = new Set(existingRows.map(rowSignature));

  const rowsToInsert = [];
  let skipped = 0;
  for (const row of rows) {
    const sig = rowSignature(row);
    if (seen.has(sig)) { skipped++; continue; }
    seen.add(sig);
    rowsToInsert.push(row);
  }

  if (rowsToInsert.length === 0) {
    return { status: 'error', message: `Semua ${rows.length} baris sudah pernah tersimpan sebelumnya (terdeteksi duplikat)` };
  }

  for (let i = 0; i < rowsToInsert.length; i += 500) {
    await db.request('POST', 'penjualan_who', { data: rowsToInsert.slice(i, i + 500) });
  }
  const msg = skipped > 0
    ? `${rowsToInsert.length} baris data penjualan WHO berhasil disimpan (${skipped} baris duplikat dilewati)`
    : `${rowsToInsert.length} baris data penjualan WHO berhasil disimpan`;
  return { status: 'success', message: msg };
}
