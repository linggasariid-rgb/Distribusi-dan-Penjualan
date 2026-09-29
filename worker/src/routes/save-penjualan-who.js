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

// Kata yang menandai kolom nama mitra. Daftar ini diperluas karena kondisi
// sebelumnya hanya menerima "NAMA PDM"/"NAMA CUSTOMER" -- ejaan lain seperti
// "NAMA MITRA" atau "NAMA PELANGGAN" dilewati tanpa error, dan semua baris
//Incident 2026-09-28: bulan AGUSTUS 2026 (2787 baris, 100%) tersimpan hanya
// sebagai kode MST/MSI/STK/ORE/ORM tanpa nama, padahal September memakai nama
// asli dengan cara input yang sama persis.
const NAMA_KEYWORDS = ['PDM', 'CUSTOMER', 'MITRA', 'PELANGGAN', 'TOKO', 'DISTRIBUTOR', 'PEMBELI', 'NASABAH', 'SUPLIER'];

export function findNamaColumn(headers) {
  // Dua pintu: yang persis sama, lalu yang cukup mengandung NAMA + kata penanda.
  const exact = headers.findIndex(h => {
    const u = String(h || '').toUpperCase().trim();
    return u === 'NAMA PDM' || u === 'NAMA CUSTOMER' || u === 'NAMA MITRA' || u === 'NAMA PELANGGAN';
  });
  if (exact >= 0) return exact;

  return headers.findIndex(h => {
    const u = String(h || '').toUpperCase().trim();
    if (!u.includes('NAMA')) return false;
    return NAMA_KEYWORDS.some(k => u.includes(k));
  });
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

  // Cari kolom nama customer: "NAMA PDM" ATAU "NAMA CUSTOMER" (nama header asli sheet).
  const namaPdmCol = findNamaColumn(headers);
  // Tidak berhenti di sini. Data tanpa nama TETAP disimpan (user boleh sengaja
  // menginput kode), tapi frontend diberi tahu supaya bisa menampilkan
  // peringatan. Sebelumnya kondisi ini diam-diam saja, dan itu penyebab 2787
  // baris Agustus tersimpan tanpa nama tanpa ada yang menyadarinya.
  const namaColTidakDitemukan = namaPdmCol < 0;
  // Header yang MIRIP tapi bukan kolom nama ikut dihitung, supaya pesan
  // peringatan bisa memberi petunjuk konkret.
  const headerMirip = namaColTidakDitemukan
    ? headers.filter(h => {
        const u = String(h || '').toUpperCase().trim();
        return u && /NAMA|CUSTOMER|MITRA|PELANGGAN|TOKO|DISTRIBUTOR|PEMBELI/.test(u);
      }).join(', ')
    : '';

  const rows = [];
  // Berapa baris yang benar-benar menghasilkan nama. Kolom nama bisa ADA tapi
  // isinya kosong -- itu menghasilkan 100% kode polos persis seperti kolom yang
  // tidak terdeteksi, jadi keduanya harus bisa memicu peringatan.
  let namaTerisi = 0;
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 4) continue;
    const tanggal = parseDate(r[3]);
    if (!tanggal) continue;

    const products = {};
    for (const [key, idx] of Object.entries(productCols)) {
      products[key] = parseNum(r[idx]);
    }

    // Ambil tipe dari kolom ke-3 (MST/MSI/STK)
    const tipe = String(r[2] || '').trim();
    // Gabungkan dengan NAMA PDM: simpan sebagai "MST Sinergi Kautsar"
    // sehingga kolom tipe_customer mengandung keduanya sekaligus
    let tipeCustomer = tipe;
    if (namaPdmCol >= 0) {
      const namaPdm = String(r[namaPdmCol] || '').trim();
      if (namaPdm) {
        tipeCustomer = `${tipe} ${namaPdm}`.trim(); // contoh: "MST Sinergi Kautsar"
        namaTerisi++;
      }
    }

    const jumlah = jumlahCol >= 0 ? parseNum(r[jumlahCol]) : Object.values(products).reduce((s, v) => s + v, 0);
    rows.push({
      bulan: (r[0] || '').toUpperCase(),
      cabang: (r[1] || '').toUpperCase().trim(),
      tipe_customer: tipeCustomer,
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
  //
  // Mode "ganti": sebelum insert, hapus SELURUH baris bulan-bulan yang ada di upload.
  // Tanpa ini, upload ulang hanya menambah baris di atas baris lama sehingga total bulan
  // jadi sekitar dobel -- justru penyebab utama data Agustus lama (yang hanya berisi kode
  // MST/MSI/STK tanpa nama) tidak bisa dikoreksi.
  //
  // Pengaman penting:
  // 1. Hapus hanya bulan yang BENAR-BENAR ada di baris hasil parse. Kalau daftar ini
  //    kosong, jangan hapus apa pun -- cek dilakukan SEBELUM delete.
  // 2. Parse dan validasi harus sudah selesai sebelum delete, supaya tidak ada keadaan
  //    "sudah terhapus tapi tidak ada yang bisa dimasukkan lagi" akibat header/format
  //    yang salah.
  // 3. Hapus per bulan, bukan sekaligus semua, supaya pesan hasil bisa menyebutkan bulan
  //    mana saja yang terpengaruh.
  if (body.replace === true) {
    // Samakan konvensi bulan dengan parseDate: '-' berarti kosong, bukan nama bulan.
    // Tanpa ini, baris dengan BULAN='-' menghasilkan bulan='-' yang truthy, dan
    // DELETE WHERE bulan='-' akan ikut dijalankan.
    const months = [...new Set(rows.map(r => r.bulan).filter(b => b && b !== '-').map(b => String(b).trim()).filter(Boolean))].sort();
    if (months.length === 0) {
      return { status: 'error', message: 'Tidak ada bulan valid di data, tidak ada yang dihapus.' };
    }

    for (const bulan of months) {
      await db.request('DELETE', 'penjualan_who', { eq: { bulan } });
    }

    for (let i = 0; i < rows.length; i += 500) {
      await db.request('POST', 'penjualan_who', { data: rows.slice(i, i + 500) });
    }
    return {
      status: 'success',
      message: `${rows.length} baris disimpan. Data lama bulan ${months.join(', ')} dihapus terlebih dahulu.`,
      peringatan: pesanPeringatanNama(namaColTidakDitemukan, headerMirip, namaTerisi, rows.length, headers[namaPdmCol]),
    };
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.request('POST', 'penjualan_who', { data: rows.slice(i, i + 500) });
  }
  return {
    status: 'success',
    message: `${rows.length} baris data penjualan WHO berhasil disimpan`,
    peringatan: pesanPeringatanNama(namaColTidakDitemukan, headerMirip, namaTerisi, rows.length, headers[namaPdmCol]),
  };
}

function pesanPeringatanNama(tidakDitemukan, headerMirip, namaTerisi, totalBaris, namaTerdeteksi) {
  if (tidakDitemukan) {
    return 'Kolom nama mitra tidak ditemukan pada baris header, jadi SEMUA baris tersimpan '
      + 'hanya sebagai kode (MST/MSI/STK) tanpa nama. Perbandingan Belanja tidak akan '
      + 'menampilkan kolom Pemilik/Kontak untuk data ini. Pastikan baris pertama yang '
      + 'dipaste adalah header asli dari Excel dan kolomnya bernama NAMA PDM, NAMA CUSTOMER, '
      + 'atau NAMA MITRA.'
      + (headerMirip ? ` Kolom yang mirip nama tapi tidak dikenali: "${headerMirip}".` : '');
  }
  if (namaTerisi === 0 && totalBaris > 0) {
    // Sebut nama kolomnya yang persis. "Kolom nama mitra" saja tidak cukup --
    // user perlu tahu sel mana di file Excel-nya yang harus diisi, dan file bisa
    // punya beberapa kolom mirip nama sekaligus.
    return `Kolom "${namaTerdeteksi || 'nama mitra'}" ditemukan pada header, tetapi SEMUA `
      + totalBaris + ' baris kosong di kolom itu, jadi semua data tersimpan hanya sebagai '
      + 'kode tanpa nama. Periksa lagi file Excel Anda: kemungkinan baris header ikut '
      + 'ter-paste sebagai baris data, atau kolom nama belum diisi.';
  }
  return null;
}
