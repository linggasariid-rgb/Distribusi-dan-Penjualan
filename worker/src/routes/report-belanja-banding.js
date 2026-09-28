// Perbandingan total produk dua bulan. Tanpa rupiah: product_prices tidak
// pernah disentuh. HU tidak dihitung ke total, sama seperti total_bungkus di
// report-belanja-stokis.js.

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Kode tipe yang berdiri sendiri sebagai "nama" -- artinya data bulan itu belum
// menyimpan nama mitra. Daftar eksak, bukan tebakan panjang karakter: "MST B"
// (5 karakter) adalah nama sungguhan dan TIDAK boleh ikut tertandai.
const KODE_TANPA_NAMA = new Set([
  'MST', 'MSI', 'STK', 'STOKIS', 'ORE', 'ORM', 'KARYAWAN', 'TSIEMPLOYEE', 'TSIAPPS', 'APPS',
]);

export function detectTipe(tipeCustomer) {
  const u = String(tipeCustomer == null ? '' : tipeCustomer).trim().toUpperCase();
  if (!u) return '';
  if (u.startsWith('MSI')) return 'MSI';
  if (u.startsWith('MST')) return 'MST';
  if (u.startsWith('STK') || u === 'STOKIS') return 'STK';
  return '';
}

export function computeBungkus(products) {
  if (!products || typeof products !== 'object') return 0;
  let total = 0;
  for (const [prodName, qty] of Object.entries(products)) {
    if (prodName === 'HU') continue;
    const n = Number(qty) || 0;
    if (n > 0) total += n;
  }
  return total;
}

export function aggregateBulan(rows, month) {
  const map = new Map();
  for (const r of rows) {
    if (!r || !r.tanggal || !r.tanggal.startsWith(month)) continue;
    const tipe = detectTipe(r.tipe_customer);
    if (!tipe) continue;

    const nama = r.tipe_customer;
    const key = `${r.cabang}||${nama}`;
    let g = map.get(key);
    if (!g) {
      g = { cabang: r.cabang, nama_customer: nama, tipe, total: 0 };
      map.set(key, g);
    }
    g.total += computeBungkus(r.products);
  }
  return map;
}

// Tanpa guard jumlah grup: begitu satu nama berupa kode telanjang, ada baris
// di bulan itu yang tidak akan punya pasangan, jadi perbandingannya sudah tidak
// akurat -- sekecil maupun sebanyak apa pun samplenya.
export function detectPunyaNama(groups) {
  if (!groups || groups.size === 0) return true;
  for (const g of groups.values()) {
    const u = String(g.nama_customer == null ? '' : g.nama_customer).trim().toUpperCase();
    if (u && KODE_TANPA_NAMA.has(u)) return false;
  }
  return true;
}

// Meniru buildNamaKey() di routes/kontak-mitra.js. Sengaja diduplikasi
// (bukan di-import) supaya file ini tidak bergantung pada route lain;
// normalisasi ini wajib identik di kedua sisi.
export function buildKontakKey(tipeCustomer) {
  return String(tipeCustomer == null ? '' : tipeCustomer).replace(/\s+/g, ' ').trim().toUpperCase();
}

export function mergeRows(mapIni, mapBanding, kontakMap) {
  const keys = new Set([...mapIni.keys(), ...mapBanding.keys()]);
  const rows = [];

  for (const key of keys) {
    const a = mapIni.get(key);
    const b = mapBanding.get(key);
    const src = a || b;
    const k = kontakMap && kontakMap.get(buildKontakKey(src.nama_customer));

    rows.push({
      cabang: src.cabang,
      nama_customer: src.nama_customer,
      tipe: src.tipe,
      pemilik: k ? k.pemilik : null,
      kontak: k ? k.kontak : null,
      ini_bungkus: a ? a.total : 0,
      banding_bungkus: b ? b.total : 0,
    });
  }

  return rows.sort((x, y) => {
    const cx = x.cabang || '', cy = y.cabang || '';
    if (cx !== cy) return cx.localeCompare(cy);
    return String(x.nama_customer).localeCompare(String(y.nama_customer));
  });
}

function namaBulan(ym) {
  const [yr, mo] = String(ym).split('-');
  return `${BULAN_NAMES[Number(mo) - 1] || mo} ${yr}`;
}

function lastDayOf(ym) {
  const [yr, mo] = ym.split('-');
  return new Date(Number(yr), Number(mo), 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym))) return false;
  const mo = Number(String(ym).split('-')[1]);
  return mo >= 1 && mo <= 12;
}

export async function handle(db, monthFilter, bandingFilter) {
  let bulanIni = monthFilter;
  if (!bulanIni) {
    const now = new Date();
    bulanIni = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
  let bulanBanding = bandingFilter;
  if (!bulanBanding) {
    const [yr, mo] = bulanIni.split('-');
    const d = new Date(Number(yr), Number(mo) - 2, 1);
    bulanBanding = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  if (!isMonth(bulanIni) || !isMonth(bulanBanding)) {
    return { status: 'error', message: 'Format bulan harus YYYY-MM' };
  }

  // Satu query untuk rentang dua bulan, bukan dua query terpisah.
  const bulanList = bulanIni === bulanBanding ? [bulanIni] : [bulanIni, bulanBanding];
  const urut = bulanList.slice().sort();
  const gte = `${urut[0]}-01`;
  const lteBulan = urut[urut.length - 1];
  const lte = `${lteBulan}-${pad(lastDayOf(lteBulan))}`;

  const rows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,products',
    gte: { tanggal: gte },
    lte: { tanggal: lte },
  });

  const mapIni = aggregateBulan(rows, bulanIni);
  // Bulan sama tidak boleh dihitung dua kali -> bulan banding sengaja dikosongkan.
  const mapBanding = bulanIni === bulanBanding ? new Map() : aggregateBulan(rows, bulanBanding);

  let kontakRows = [];
  try {
    kontakRows = await db.query('kontak_mitra', { select: 'nama_key,pemilik,kontak' });
  } catch (err) {
    // Tabel kontak belum ada -> tetap bisa bandingkan, kolom kontak null.
    kontakRows = [];
  }
  const kontakMap = new Map(kontakRows.map(c => [c.nama_key, c]));

  return {
    status: 'success',
    data: {
      bulan_ini: bulanIni,
      bulan_banding: bulanBanding,
      nama_bulan_ini: namaBulan(bulanIni),
      nama_bulan_banding: namaBulan(bulanBanding),
      punya_nama: bulanIni === bulanBanding ? true : detectPunyaNama(mapBanding),
      rows: mergeRows(mapIni, mapBanding, kontakMap),
    },
  };
}
