import assert from 'node:assert/strict';
import { detectTipeMaster, namaTanpaTipe, aggregateMitra, buildTidakBelanja } from '../worker/src/routes/omzet-kecamatan.js';
import { buildWilayahKey, normalizeWilayahRows, normalizeKota, handle as simpanWilayah } from '../worker/src/routes/wilayah-mitra.js';
import { kunciWilayah, kelompokkan, ambilKolomWilayah, gabungBulan, hitungPerubahan } from '../src/modules/reports/omzetKecamatan.js';

// --- tipe: hanya MST & MSI ---
assert.equal(detectTipeMaster('MST Az-Zahrah'), 'MST');
assert.equal(detectTipeMaster('MSI Independen 24'), 'MSI');
assert.equal(detectTipeMaster('STK Haji Dede'), '');
assert.equal(detectTipeMaster('ORM Stokis Online Bandung'), '');
assert.equal(detectTipeMaster(null), '');

// --- kunci penjualan == kunci wilayah ---
assert.equal(namaTanpaTipe('MST Az-Zahrah'), buildWilayahKey('Az-Zahrah'));
assert.equal(namaTanpaTipe('MSI  Independen   24'), buildWilayahKey(' Independen 24 '));
assert.equal(namaTanpaTipe('MST M. Naufal Haidar'), 'M. NAUFAL HAIDAR');
// Awalan hanya dibuang kalau berdiri sendiri sebagai kata.
assert.equal(namaTanpaTipe('MSTAR Jaya'), 'MSTAR JAYA');

// --- normalizeWilayahRows: nama kosong dibuang, duplikat ditimpa ---
const norm = normalizeWilayahRows([
  { nama: 'Az-Zahrah', kecamatan: 'Pasar Kemis', kota: 'Kabupaten Tangerang' },
  { nama: '', kecamatan: 'X' },
  { nama: 'az-zahrah ', kecamatan: 'Cikupa', kota: 'Kabupaten Tangerang' },
  null,
]);
assert.equal(norm.length, 1);
assert.equal(norm[0].kecamatan, 'Cikupa', 'baris terakhir menang');

// --- handle simpan: grup tidak dikenal ditolak, batch dikirim dengan grup ---
{
  const calls = [];
  const db = { request: async (m, t, o) => calls.push({ m, t, o }) };
  assert.equal((await simpanWilayah(db, { rows: [{ nama: 'A' }], grup: 'HACK' })).status, 'error');
  assert.equal((await simpanWilayah(db, { rows: [] })).status, 'error');
  const res = await simpanWilayah(db, { rows: [{ nama: 'Az-Zahrah', kecamatan: 'Cikupa' }] });
  assert.equal(res.status, 'success');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].o.onConflict, 'grup,nama_key');
  assert.equal(calls[0].o.data[0].grup, 'MASTER');
  assert.equal(calls[0].o.data[0].nama_key, 'AZ-ZAHRAH');
}

// --- aggregateMitra: bungkus & omzet sama dengan Rekap Belanja ---
const priceMap = { 'SPS TSI': { mst: 1000, karyawan: 900 }, HU: { mst: 50, karyawan: 50 } };
const wilayah = new Map([['AZ-ZAHRAH', { kecamatan: 'Cikupa', kota: 'Kabupaten Tangerang', provinsi: 'Banten' }]]);
const mitra = aggregateMitra([
  { tanggal: '2026-09-01', cabang: 'TANGERANG', tipe_customer: 'MST Az-Zahrah', products: { 'SPS TSI': 10, HU: 2 } },
  { tanggal: '2026-09-05', cabang: 'TANGERANG', tipe_customer: 'MST Az-Zahrah', products: { 'SPS TSI': 5 } },
  { tanggal: '2026-09-05', cabang: 'TANGERANG', tipe_customer: 'MSI Independen 9', products: { 'SPS TSI': 3 } },
  { tanggal: '2026-09-05', cabang: 'TANGERANG', tipe_customer: 'STK Haji Dede', products: { 'SPS TSI': 99 } },
  { tanggal: '2026-08-31', cabang: 'TANGERANG', tipe_customer: 'MST Az-Zahrah', products: { 'SPS TSI': 99 } },
], priceMap, '2026-09', wilayah);
assert.equal(mitra.length, 2, 'STK dan bulan lain dibuang');
const az = mitra.find(m => m.nama_customer === 'MST Az-Zahrah');
assert.equal(az.bungkus, 15, 'HU tidak dihitung ke bungkus');
assert.equal(az.omzet, 15 * 1000 + 2 * 50, 'HU tetap masuk omzet, seperti Rekap Belanja');
assert.equal(az.kecamatan, 'Cikupa');
assert.equal(az.terpetakan, true);
const msi = mitra.find(m => m.tipe === 'MSI');
assert.equal(msi.terpetakan, false);

// --- frontend: kunci wilayah menyatukan ejaan ganda ---
assert.equal(kunciWilayah('Karang Bahagia'), kunciWilayah('Karangbahagia'));
assert.equal(kunciWilayah('KabupatenTasikmalaya'), kunciWilayah('Kabupaten Tasikmalaya'));

const grup = kelompokkan([
  { nama_customer: 'MST A', cabang: 'X', tipe: 'MST', terpetakan: true, kecamatan: 'Karang Bahagia', kota: 'Kabupaten Bekasi', bungkus: 10, omzet: 100 },
  { nama_customer: 'MST B', cabang: 'X', tipe: 'MST', terpetakan: true, kecamatan: 'Karangbahagia', kota: 'Kabupaten Bekasi', bungkus: 5, omzet: 50 },
  { nama_customer: 'MSI 1', cabang: 'X', tipe: 'MSI', terpetakan: false, kecamatan: '', kota: '', bungkus: 999, omzet: 9999 },
  { nama_customer: 'MST C', cabang: 'Y', tipe: 'MST', terpetakan: true, kecamatan: 'Cikupa', kota: 'Kabupaten Tangerang', bungkus: 30, omzet: 300 },
  { nama_customer: 'MST C', cabang: 'Z', tipe: 'MST', terpetakan: true, kecamatan: 'Cikupa', kota: 'Kabupaten Tangerang', bungkus: 1, omzet: 10 },
]);
assert.deepEqual(grup.map(k => k.label), ['Kabupaten Tangerang', 'Kabupaten Bekasi', '(Belum terpetakan)'],
  'urut omzet terbesar, belum terpetakan selalu terakhir');
assert.equal(grup[1].kecamatan.length, 1, 'ejaan ganda jadi satu kecamatan');
assert.equal(grup[1].kecamatan[0].label, 'Karang Bahagia', 'label yang berspasi dipilih');
assert.equal(grup[1].kecamatan[0].omzet, 150);
assert.equal(grup[0].kecamatan[0].jumlahMitra, 1, 'mitra sama di dua cabang dihitung sekali');
assert.equal(grup[0].omzet, 310);

// --- ambilKolomWilayah: header tidak di baris pertama, kolom pribadi tidak ikut ---
const aoa = [
  ['', ''],
  ['', ''],
  ['No', 'Master Stokis', 'ID Pemilik', 'Nama Pemilik', 'Nama KTP', 'Alamat', 'Desa / Kelurahan', 'Kecamatan', 'Kota / Kabupaten', 'Provinsi', 'HP / Telepon'],
  [1, 'Az-Zahrah', 'X1', 'Budi', 'Budi KTP', 'Jl. Rahasia 1', 'Desa A', 'Cikupa', 'Kabupaten Tangerang', 'Banten', '0812'],
  [2, '', '', '', '', '', '', '', '', '', ''],
];
const hasil = ambilKolomWilayah(aoa);
assert.equal(hasil.error, '');
assert.deepEqual(hasil.rows, [{ nama: 'Az-Zahrah', desa: 'Desa A', kecamatan: 'Cikupa', kota: 'Kabupaten Tangerang', provinsi: 'Banten' }]);
assert.ok(!JSON.stringify(hasil.rows).includes('0812'), 'nomor HP tidak ikut terkirim');
assert.ok(!JSON.stringify(hasil.rows).includes('Rahasia'), 'alamat tidak ikut terkirim');
assert.ok(ambilKolomWilayah([['Nama', 'Alamat']]).error, 'tanpa kolom kecamatan -> error');

// --- ambilKolomWilayah: "Member dihapus" dipisah, tidak ikut rows ---
{
  const h = ambilKolomWilayah([
    ['No', 'Master Stokis', 'ID Pemilik', 'Kecamatan', 'Tanggal Daftar'],
    [1, 'Bangka', 'AAA00212 / Member dihapus', 'Kecnya', 'MEMBER DIHAPUS'],
    [2, 'Az-Zahrah', 'X1', 'Cikupa', 45000],
  ]);
  assert.deepEqual(h.rows.map(r => r.nama), ['Az-Zahrah']);
  assert.deepEqual(h.dihapus, ['Bangka']);
}

// --- simpan wilayah: nama dihapus dibuang dari DB dan tidak ikut di-upsert ---
{
  const calls = [];
  const db = { request: async (m, t, o) => calls.push({ m, t, o }) };
  const res = await simpanWilayah(db, { rows: [{ nama: 'Az-Zahrah', kecamatan: 'Cikupa' }, { nama: 'Bangka', kecamatan: 'X' }], dihapus: ['Bangka '] });
  assert.equal(res.data.saved, 1);
  assert.equal(res.data.dihapus, 1);
  const del = calls.filter(c => c.m === 'DELETE');
  assert.equal(del.length, 1);
  assert.deepEqual(del[0].o.eq, { grup: 'MASTER', nama_key: 'BANGKA' });
  const post = calls.find(c => c.m === 'POST');
  assert.deepEqual(post.o.data.map(d => d.nama_key), ['AZ-ZAHRAH']);
}

// --- buildTidakBelanja ---
{
  const wil = [
    { nama_key: 'AZ-ZAHRAH', nama: 'Az-Zahrah', kecamatan: 'Cikupa', kota: 'Kab Tangerang' },
    { nama_key: 'INDEPENDEN 9', nama: 'Independen 9', kecamatan: 'Batujaya', kota: 'Kab Karawang' },
    { nama_key: 'INDEPENDEN 77', nama: 'Independen 77', kecamatan: '', kota: '' },
    { nama_key: 'SINERGI JAYA', nama: 'Sinergi Jaya', kecamatan: 'Klari', kota: 'Kab Karawang' },
  ];
  const sudahBeli = [{ nama_customer: 'MST Az-Zahrah' }];
  const riwayat = [
    { tipe_customer: 'MSI Independen 9', cabang: 'KARAWANG', tanggal: '2026-08-10' },
    { tipe_customer: 'MSI Independen 9', cabang: 'KARAWANG', tanggal: '2026-10-02' },
    { tipe_customer: 'MSI Independen 9', cabang: 'BOGOR', tanggal: '2026-08-01' },
    { tipe_customer: 'STK Sinergi Jaya', cabang: 'KARAWANG', tanggal: '2026-09-01' },
  ];
  const kontak = new Map([['MSI INDEPENDEN 9', { pemilik: 'Kardi', kontak: '0812' }]]);
  const tb = buildTidakBelanja(wil, sudahBeli, riwayat, kontak);
  const by = Object.fromEntries(tb.map(t => [t.nama_customer, t]));
  assert.equal(tb.length, 3, 'yang sudah belanja tidak ikut');
  assert.ok(!by['MST Az-Zahrah']);
  assert.equal(by['MSI Independen 9'].terakhir_belanja, '2026-10-02', 'tanggal terakhir, termasuk sesudah bulan ini');
  assert.equal(by['MSI Independen 9'].cabang, 'KARAWANG');
  assert.equal(by['MSI Independen 9'].pemilik, 'Kardi', 'pemilik dari kontak_mitra');
  assert.equal(by['MSI Independen 77'].tipe, 'MSI', '"Independen N" tanpa riwayat -> MSI');
  assert.equal(by['MSI Independen 77'].terpetakan, false);
  assert.equal(by['MST Sinergi Jaya'].tipe, 'MST', 'belanja sebagai STK tidak dihitung sebagai belanja MST');
  assert.equal(by['MST Sinergi Jaya'].terakhir_belanja, '');
}

// --- normalizeKota: "Kab." disamakan dengan "Kabupaten" ---
assert.equal(normalizeKota('Kab. Garut'), 'Kabupaten Garut');
assert.equal(normalizeKota('Kab Sukabumi'), 'Kabupaten Sukabumi');
assert.equal(normalizeKota('KabupatenTasikmalaya'), 'Kabupaten Tasikmalaya');
assert.equal(normalizeKota('Kabupaten Garut'), 'Kabupaten Garut');
assert.equal(normalizeKota('Kota Tangerang Selatan'), 'Kota Tangerang Selatan');
assert.equal(normalizeKota('Pangkal Pinang'), 'Pangkal Pinang');
assert.equal(normalizeKota(''), '');

// --- perbandingan dua bulan ---
{
  const base = { tipe: 'MST', terpetakan: true, kota: 'Kab X', kecamatan: 'Kec A' };
  const ini = [
    { ...base, cabang: 'C1', nama_customer: 'MST A', bungkus: 10, omzet: 1000 },
    { ...base, cabang: 'C1', nama_customer: 'MST Baru', bungkus: 5, omzet: 500 },
  ];
  const banding = [
    { ...base, cabang: 'C1', nama_customer: 'MST A', bungkus: 8, omzet: 800 },
    { ...base, cabang: 'C1', nama_customer: 'MST Stop', bungkus: 3, omzet: 300 },
  ];
  const g = gabungBulan(ini, banding);
  assert.equal(g.length, 3, 'union kedua bulan');
  const a = g.find(m => m.nama_customer === 'MST A');
  assert.equal(a.omzet, 1000);
  assert.equal(a.omzet_banding, 800);
  assert.equal(g.find(m => m.nama_customer === 'MST Stop').omzet, 0);

  const kel = kelompokkan(g);
  const kec = kel[0].kecamatan[0];
  assert.equal(kec.omzet, 1500);
  assert.equal(kec.omzet_banding, 1100);
  assert.equal(kec.mitraIni, 2, 'MST A + MST Baru');
  assert.equal(kec.mitraBanding, 2, 'MST A + MST Stop');
  assert.equal(kec.jumlahMitra, 3);

  assert.deepEqual(hitungPerubahan(1500, 1100).tren, 'naik');
  assert.equal(Math.round(hitungPerubahan(1500, 1000).persen), 50);
  assert.equal(hitungPerubahan(800, 1000).tren, 'turun');
  assert.equal(hitungPerubahan(500, 0).tren, 'baru');
  assert.equal(hitungPerubahan(500, 0).persen, null);
  assert.equal(hitungPerubahan(0, 300).tren, 'berhenti');
  assert.equal(hitungPerubahan(0, 300).persen, -100);
  assert.equal(hitungPerubahan(0, 0).tren, 'tetap');

  // Mode satu bulan tidak berubah: field banding default 0.
  const satu = kelompokkan(ini);
  assert.equal(satu[0].omzet, 1500);
  assert.equal(satu[0].omzet_banding, 0);
}

console.log('OK: semua tes omzet per kecamatan lolos');
