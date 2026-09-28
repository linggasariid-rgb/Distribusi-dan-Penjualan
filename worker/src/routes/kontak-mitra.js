// Master kontak mitra: parser header Excel + normalisasi kunci.
// Tanpa harga, tanpa rupiah — hanya nama, tipe, pemilik, nomor telepon.

function normalizeHeader(h) {
  return String(h == null ? '' : h)
    .toUpperCase()
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kunci-kunci yang dikenali per kolom. `nama` diperiksa terpisah karena
// string "NAMA" ikut muncul di dalam "NAMA PEMILIK".
const TYPE_KEYS    = ['TYPE', 'TIPE'];
const NAMA_KEYS    = ['NAMA', 'NAMA CUSTOMER', 'NAMA STOKIS'];
const PEMILIK_KEYS = ['PEMILIK', 'NAMA PEMILIK', 'PEMILIK NAMA', 'OWNER', 'PIC'];
const KONTAK_KEYS  = ['HP', 'HP TELEPON', 'HP TELP', 'NO HP', 'NAMA HP',
                      'TELEPON', 'TELP', 'NO TELFON', 'KONTAK', 'WA', 'WHATSAPP'];

// Cari indeks kolom pertama yang header-nya persis salah satu dari `keys`.
// Header dinormalisasi lebih dulu supaya "HP / Telepon" -> "HP TELEPON".
function findColumn(headers, keys) {
  const norm = headers.map(normalizeHeader);
  for (const key of keys) {
    const idx = norm.indexOf(key);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function findKontakColumns(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return null;

  const type = findColumn(headers, TYPE_KEYS);
  const nama = findColumn(headers, NAMA_KEYS);
  // Tanpa TYPE atau NAMA, baris tidak bisa di-match ke penjualan -> tolak.
  if (type < 0 || nama < 0) return null;

  return {
    type,
    nama,
    pemilik: findColumn(headers, PEMILIK_KEYS),
    kontak: findColumn(headers, KONTAK_KEYS),
  };
}

function clean(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// Kunci pencocokan ke penjualan_who.tipe_customer.
// "MSI Independen 12" -> "MSI INDEPENDEN 12"
export function buildNamaKey(type, nama) {
  return clean(`${type} ${nama}`).toUpperCase();
}

export function parseKontakRows(rows, headers) {
  const cols = findKontakColumns(headers);
  if (!cols) return [];

  const out = [];
  // Baris 0 adalah header -- bukan data, jadi dilewati. Tanpa ini, baris header
  // ikut terparse dan muncul sebagai kontak palsu: tipe "TYPE", nama "NAMA".
  for (const r of rows.slice(1)) {
    if (!Array.isArray(r)) continue;
    const type = clean(r[cols.type]).toUpperCase();
    const nama = clean(r[cols.nama]);
    if (!type || !nama) continue; // baris tidak lengkap -> dilewati

    out.push({
      nama_key: buildNamaKey(type, nama),
      nama,
      type,
      pemilik: cols.pemilik >= 0 ? clean(r[cols.pemilik]) : '',
      kontak: cols.kontak >= 0 ? clean(r[cols.kontak]) : '',
    });
  }
  return out;
}
