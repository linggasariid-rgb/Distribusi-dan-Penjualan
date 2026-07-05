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

  // Kalau tidak ada satupun kolom produk yang dikenali DAN tidak ada kolom JUMLAH --
  // berarti baris pertama yang dipaste bukan header yang valid (nama kolom tidak cocok,
  // atau header ikut kegeser/hilang). Tanpa pengecekan ini, semua baris tetap tersimpan
  // dengan products={} dan jumlah=0 tanpa ada tanda error apapun ke user.
  if (Object.keys(productCols).length === 0 && jumlahCol === -1) {
    return {
      status: 'error',
      message: 'Header kolom produk tidak dikenali. Pastikan baris pertama yang dipaste adalah baris header asli dari Excel (nama kolom produk seperti SPS TSI, SKM TSI, dst, dan kolom JUMLAH), bukan baris data.',
    };
  }

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

  // TIDAK ada dedup berbasis nilai (cabang+tanggal+tipe+jumlah+products) di sini --
  // baris dengan nilai identik adalah pola NORMAL di data ini (order standar dengan
  // jumlah/produk yang sama berulang), jadi dedup begini akan salah membuang transaksi
  // asli (insiden 2026-07-04: 4130 baris asli sempat terhapus karena disangka duplikat).
  // Proteksi klik-ganda tombol Simpan sudah ditangani di frontend (tombol di-disable
  // saat submit), jadi tidak perlu diulang di sini.
  for (let i = 0; i < rows.length; i += 500) {
    await db.request('POST', 'penjualan_who', { data: rows.slice(i, i + 500) });
  }
  return { status: 'success', message: `${rows.length} baris data penjualan WHO berhasil disimpan` };
}
