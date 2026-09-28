import assert from 'node:assert/strict';
import {
  detectTipe, computeBungkus, aggregateBulan, detectPunyaNama, mergeRows, buildKontakKey
} from '../worker/src/routes/report-belanja-banding.js';

// --- detectTipe: MST / MSI harus TERPISAH ---
assert.equal(detectTipe('MST'), 'MST');
assert.equal(detectTipe('MSI'), 'MSI');
assert.equal(detectTipe('STK'), 'STK');
assert.equal(detectTipe('STOKIS'), 'STK');
assert.equal(detectTipe('MST M. Naufal Haidar'), 'MST');
assert.equal(detectTipe('MSI Independen 12'), 'MSI');
assert.equal(detectTipe('STK BIR ALI'), 'STK');
assert.equal(detectTipe('msi independen 12'), 'MSI', 'case-insensitive');
assert.equal(detectTipe('ORE STOKIS ONLINE'), '', 'karyawan dibuang');
assert.equal(detectTipe('ORM STOKIS ONLINE'), '', 'apps dibuang');
assert.equal(detectTipe('PELANGGAN'), '');
assert.equal(detectTipe(''), '');
assert.equal(detectTipe(null), '');

// --- computeBungkus: HU tidak dihitung, tanpa harga ---
assert.equal(computeBungkus({ 'SPS TSI': 50, HU: 2 }), 50, 'HU di luar total');
assert.equal(computeBungkus({ 'SPS TSI': 10, 'SKM TSI': 5 }), 15);
assert.equal(computeBungkus({ HU: 7 }), 0, 'HU saja -> 0');
assert.equal(computeBungkus({}), 0);
assert.equal(computeBungkus(null), 0, 'products null -> 0');
assert.equal(computeBungkus({ 'SPS TSI': '12' }), 12, 'qty string di-coerce');

// --- aggregateBulan ---
const rows = [
  { tanggal: '2026-09-23', cabang: 'BANDUNG', tipe_customer: 'MST B',       products: { 'SPS TSI': 10 } },
  { tanggal: '2026-09-22', cabang: 'BANDUNG', tipe_customer: 'MST B',       products: { 'SPS TSI': 5, HU: 3 } },
  { tanggal: '2026-09-21', cabang: 'GARUT',  tipe_customer: 'STK A',       products: { 'SKM TSI': 7 } },
  { tanggal: '2026-08-05', cabang: 'BANDUNG', tipe_customer: 'MST B',       products: { 'SPS TSI': 99 } },
  { tanggal: '2026-09-10', cabang: 'BANDUNG', tipe_customer: 'ORE STOKIS',  products: { 'SPS TSI': 88 } },
];
const sep = aggregateBulan(rows, '2026-09');
assert.equal(sep.size, 2, 'baris ORE dibuang');
assert.equal(sep.get('BANDUNG||MST B').total, 15, 'HU tidak ikut, bulan lain terfilter');
assert.equal(sep.get('BANDUNG||MST B').tipe, 'MST');
assert.equal(sep.get('BANDUNG||MST B').cabang, 'BANDUNG');
assert.equal(sep.get('GARUT||STK A').total, 7);

const agu = aggregateBulan(rows, '2026-08');
assert.equal(agu.size, 1, 'hanya baris Agustus');
assert.equal(agu.get('BANDUNG||MST B').total, 99);

// --- detectPunyaNama ---
assert.equal(detectPunyaNama(sep), true, 'semua nama asli -> punya nama');
const kodeOnly = new Map([
  ['BANDUNG||MST', { nama_customer: 'MST' }],
  ['BANDUNG||MSI', { nama_customer: 'MSI' }],
  ['BANDUNG||STK', { nama_customer: 'STK' }],
]);
assert.equal(detectPunyaNama(kodeOnly), false, 'ada kode telanjang -> belum ada nama');
assert.equal(detectPunyaNama(new Map()), true, 'bulang -> dianggap punya nama');
assert.equal(detectPunyaNama(new Map([['a', { nama_customer: 'MST' }]])), false,
  'satu grup berkode pun harus ditandai, sekecil apa pun samplenya');

// Nama pendek yang ASLINYA nama -> tidak boleh ikut tertandai.
for (const nama of ['MST A', 'MST B', 'MST Z', 'STK A', 'STK B']) {
  const g = new Map([['X||' + nama, { nama_customer: nama }]]);
  assert.equal(detectPunyaNama(g), true, nama + ' adalah nama asli, bukan kode');
}
for (const kode of ['MST', 'MSI', 'STK', 'STOKIS']) {
  const g = new Map([['X||' + kode, { nama_customer: kode }]]);
  assert.equal(detectPunyaNama(g), false, kode + ' adalah kode telanjang');
}

// --- buildKontakKey ---
assert.equal(buildKontakKey('MSI Independen 12'), 'MSI INDEPENDEN 12');
assert.equal(buildKontakKey('MST  M.   Naufal  '), 'MST M. NAUFAL');

// --- mergeRows: union kedua bulan + join kontak ---
const kontakMap = new Map([
  ['MSI INDEPENDEN 12', { pemilik: 'Budi Santoso', kontak: '08123456789' }],
]);
const merged = mergeRows(sep, agu, kontakMap);
const byName = Object.fromEntries(merged.map(r => [r.nama_customer, r]));
assert.equal(merged.length, 2, 'union: 2 dari Sep + 1 dari Agu, tumpang tindih 1');
assert.equal(byName['MST B'].ini_bungkus, 15);
assert.equal(byName['MST B'].banding_bungkus, 99);
assert.equal(byName['STK A'].ini_bungkus, 7);
assert.equal(byName['STK A'].banding_bungkus, 0, 'tidak ada di Agustus -> 0');
assert.equal(byName['STK A'].pemilik, null, 'tanpa kontak -> null');
assert.equal(byName['STK A'].kontak, null);
assert.equal(merged.find(r => r.nama_customer === 'STK A').tipe, 'STK');

// baris hanya di bulan pembanding harus muncul dengan ini_bungkus = 0
const onlyBanding = new Map([['BOGOR||MST Z', { cabang: 'BOGOR', nama_customer: 'MST Z', tipe: 'MST', total: 42 }]]);
const m2 = mergeRows(new Map(), onlyBanding, new Map());
assert.equal(m2.length, 1);
assert.equal(m2[0].ini_bungkus, 0);
assert.equal(m2[0].banding_bungkus, 42);

// baris tanpa cabang tidak boleh crash
const noCab = new Map([['||MST X', { cabang: null, nama_customer: 'MST X', tipe: 'MST', total: 5 }]]);
assert.equal(mergeRows(noCab, new Map(), new Map())[0].cabang, null);

console.log('OK: semua tes backend bandingkan belanja lolos');
