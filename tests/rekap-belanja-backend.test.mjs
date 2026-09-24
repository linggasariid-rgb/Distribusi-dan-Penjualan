import assert from 'node:assert/strict';
import { detectCategory, computeTransaction, aggregateSummary } from '../worker/src/routes/report-belanja-stokis.js';

// detectCategory
assert.equal(detectCategory('MST'), 'Master Stokis');
assert.equal(detectCategory('MSI INDEPENDEN 4'), 'Master Stokis');
assert.equal(detectCategory('STK BIR ALI'), 'Stokis');
assert.equal(detectCategory('STOKIS'), 'Stokis');
assert.equal(detectCategory('ORE STOKIS ONLINE'), 'Karyawan');
assert.equal(detectCategory('TSIEMPLOYEE'), 'Karyawan');
assert.equal(detectCategory('ORM STOKIS ONLINE'), 'Apps');
assert.equal(detectCategory('TSIAPPS'), 'Apps');
assert.equal(detectCategory('PELANGGAN'), '');

// computeTransaction
const priceMap = { 'SPS TSI': { mst: 10000, karyawan: 8000 }, HU: { mst: 9000, karyawan: 8000 } };
const t = computeTransaction(
  { tanggal: '2026-09-23', cabang: 'BANDUNG', tipe_customer: 'MST X', products: { 'SPS TSI': 50, HU: 2 } },
  priceMap, '2026-09'
);
assert.equal(t.kategori, 'Master Stokis');
assert.equal(t.total_bungkus, 50, 'HU tidak dihitung bungkus');
assert.equal(t.total_nominal, 50 * 10000 + 2 * 9000, 'HU tetap dihitung nominal');
assert.equal(computeTransaction({ tanggal: '2026-08-01', cabang: 'B', tipe_customer: 'MST', products: {} }, priceMap, '2026-09'), null, 'tanggal di luar bulan -> null');
assert.equal(computeTransaction({ tanggal: '2026-09-01', cabang: 'B', tipe_customer: 'ASING', products: {} }, priceMap, '2026-09'), null, 'tipe tak dikenal -> null');

const k = computeTransaction(
  { tanggal: '2026-09-23', cabang: 'BANDUNG', tipe_customer: 'KARYAWAN Y', products: { 'SPS TSI': 10, HU: 1 } },
  priceMap, '2026-09'
);
assert.equal(k.total_bungkus, 10, 'Karyawan: HU tetap tidak dihitung bungkus');
assert.equal(k.total_nominal, 10 * 8000 + 1 * 9000, 'Karyawan: HU tetap pakai price_mst');

// aggregateSummary
const rows = [
  { tanggal: '2026-09-23', cabang: 'BANDUNG', nama_customer: 'MST B', kategori: 'Master Stokis', products: { 'SPS TSI': 10 }, total_bungkus: 10, total_nominal: 100000 },
  { tanggal: '2026-09-22', cabang: 'BANDUNG', nama_customer: 'MST B', kategori: 'Master Stokis', products: { 'SPS TSI': 5, HU: 3 }, total_bungkus: 5, total_nominal: 50000 },
  { tanggal: '2026-09-21', cabang: 'GARUT',  nama_customer: 'STK A', kategori: 'Stokis', products: { 'SKM TSI': 7 }, total_bungkus: 7, total_nominal: 70000 },
];
const s = aggregateSummary(rows);
assert.equal(s.length, 2);
assert.equal(s[0].cabang, 'BANDUNG', 'urut cabang asc');
assert.equal(s[0].nama_customer, 'MST B');
assert.equal(s[0].products['SPS TSI'], 15, 'produk dijumlahkan');
assert.equal(s[0].products['HU'], 3);
assert.equal(s[0].total_bungkus, 15);
assert.equal(s[0].total_nominal, 150000);
assert.equal(s[1].cabang, 'GARUT');

const sameName = aggregateSummary([
  { tanggal: '2026-09-01', cabang: 'BANDUNG', nama_customer: 'MST X', kategori: 'Master Stokis', products: { 'SPS TSI': 1 }, total_bungkus: 1, total_nominal: 10000 },
  { tanggal: '2026-09-02', cabang: 'GARUT', nama_customer: 'MST X', kategori: 'Master Stokis', products: { 'SPS TSI': 2 }, total_bungkus: 2, total_nominal: 20000 },
]);
assert.equal(sameName.length, 2, 'satu grup per (cabang, nama_customer)');

console.log('OK: semua tes backend rekap belanja lolos');