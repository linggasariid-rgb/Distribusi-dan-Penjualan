import assert from 'node:assert/strict';
import { normCabang as normB, normalizeBiayaRows, handleUpload, omzetPerCabang } from '../worker/src/routes/biaya-cabang.js';

// bacaKasKecil memakai XLSX.SSF untuk tanggal serial Excel -- stub kecil cukup.
globalThis.XLSX = {
  SSF: {
    parse_date_code: v => {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    },
  },
};
const { normCabang, keTanggal, bacaKasKecil, bacaEtoll, kenaliFile, ringkasCabang, ETOLL_CABANG } =
  await import('../src/modules/reports/biayaOmzet.js');

// --- nama cabang: frontend & backend harus sama ---
for (const [masuk, keluar] of [
  ['WHO BANDUNG (BDG)', 'BANDUNG'], ['Bandung', 'BANDUNG'], ['WHP BANDUNG (GDGBDG)', 'WHP BANDUNG'],
  ['WHP Bandung', 'WHP BANDUNG'], ['WHO CIBADUYUT (CBY)', 'CIBADUYUT'], ['  Tasikmalaya ', 'TASIKMALAYA'],
]) {
  assert.equal(normCabang(masuk), keluar, masuk);
  assert.equal(normB(masuk), keluar, 'backend ' + masuk);
}

// --- tanggal ---
assert.equal(keTanggal(46266), '2026-09-01', 'serial Excel');
assert.equal(keTanggal('03/09/2026'), '2026-09-03');
assert.equal(keTanggal('2026-09-30'), '2026-09-30');
assert.equal(keTanggal(''), '');

// --- bacaKasKecil ---
const kas = [
  ['', '', '', '', '', '', '', '', '', '', '', 'denom kas masuk'],
  ['Periode', 'Warehouse', 'Tanggal', 'Jam', 'No. Kas Keluar', 'No. Referensi', 'No. Kas Masuk', 'Nama', 'Nama', 'Code', 'Jenis Transaksi', 100000, 'kas keluar', 'kas masuk'],
  ['September', 'WHP Bandung', 46267, '11.07', 'KK-WHP-BDG-1', 'BP-1', 'KM-1', 'Rizki', '', '', 'Biaya Pengiriman via Pihak ketiga', 0, 300000, 48000],
  ['September', 'Bogor', 46268, '09.00', 'KK-WHO-BGR-2', 'BO-2', '', 'Fauzan', 'Roni', '6101-103', 'Biaya Pengisian ETOLL', 0, 300000, 0],
  ['September', 'Bogor', 46270, '10.00', 'Masuk Kas Kecil 1', '', 'KM-3', 'Masuk Kas Kecil', '', '', '', 0, 0, 5050000],
  ['September', 'Bogor', 46272, '10.00', 'KK-WHO-BGR-4', '', '', 'Admin', '', '1102-103', 'Setoran Tunai Kas Kecil', 0, 2500000, 0],
  ['September', 'Bandung', 46272, '10.00', 'KK-WHO-BDG-5', '', '', 'Eko', '', '0', 'Closing Kas', 0, 4289000, 0],
  ['September', 'Serang', 46273, '10.00', 'KK-WHO-SRG-6', '', 'KM-6', 'Siti', '', '0', 'Tukar Denom', 0, 100000, 100000],
  ['September', 'Bandung', 46275, '10.00', 'Masuk Kas Kecil 5', '', 'KM-7', 'Masuk Kas Kecil', '', '0', '0', 0, 1908000, 2500000],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];
const k = bacaKasKecil(kas);
assert.equal(k.error, '');
assert.equal(k.rows.length, 2, 'hanya baris biaya');
assert.equal(k.lewatNonBiaya, 5, 'masuk kas, setoran, closing, tukar denom, baris "0"');
assert.deepEqual(k.rows[0], {
  periode: '2026-09', cabang: 'WHP BANDUNG', tanggal: '2026-09-02', no_kas: 'KK-WHP-BDG-1', no_ref: 'BP-1',
  nama: 'Rizki', code: '', jenis: 'Biaya Pengiriman via Pihak ketiga', kas_keluar: 300000, kembalian: 48000,
});
assert.equal(k.rows[1].nama, 'Fauzan & Roni', 'dua kolom Nama digabung');

// --- bacaEtoll: hanya cabang yang e-toll-nya di luar kas kecil ---
const etoll = {
  Ringkasan: [['Rekap Pengeluaran BBM & Tol'], ['Periode', '01/09/2026 s.d. 30/09/2026']],
  Detail: [['No', 'Tanggal'], [1, '03/09/2026']],
  'Per Kartu Etoll': [
    ['No', 'Kartu Etoll', 'Warehouse', 'BBM (Rp)', 'Tol (Rp)', 'Total (Rp)', 'Jumlah Pembayaran'],
    [1, 'WHP BDG 2', 'WHP BANDUNG (GDGBDG)', 1650000, 1305000, 2955000, 11],
    [2, 'E toll 7', 'WHO CIBADUYUT (CBY)', 1800000, 384000, 2184000, 27],
    [3, 'KWG 02', 'WHO KARAWANG (KWG)', 0, 1193000, 1193000, 12],
    [4, 'E toll 5', 'WHO BANDUNG (BDG)', 444500, 0, 444500, 14],
    ['', 'TOTAL', '', 3894500, 2882000, 6776500, 64],
  ],
};
const e = bacaEtoll(etoll);
assert.equal(e.error, '');
assert.equal(e.periode, '2026-09');
assert.deepEqual(e.dilewati.map(d => d.cabang), ['KARAWANG'], 'Karawang isi e-toll lewat kas kecil');
assert.equal(e.rows.length, 5, 'BBM & Tol per kartu, nilai 0 tidak dibuat baris');
assert.equal(e.rows.reduce((a, r) => a + r.kas_keluar, 0), 2955000 + 2184000 + 444500);
assert.ok(e.rows.every(r => ETOLL_CABANG.includes(r.cabang)));
// periode cadangan dari sheet Detail
assert.equal(bacaEtoll({ ...etoll, Ringkasan: [] }).periode, '2026-09');

// --- bacaEtoll: format Oktober memakai kartu Flazz ---
const flazz = {
  Ringkasan: [['Rekap Pengeluaran BBM & Tol'], ['Periode', '01/10/2026 s.d. 31/10/2026']],
  Detail: [['No', 'Tanggal'], [1, '01/10/2026']],
  'Per Kartu Flazz': [
    ['No', 'Kartu Flazz', 'Warehouse', 'BBM Flazz (Rp)', 'Tol Flazz (Rp)', 'Total (Rp)', 'Jumlah Pembayaran'],
    [1, 'WHP BDG 3', 'Whp Bandung (GDGBDG)', 1620008, 1744500, 3364508, 22],
    [2, 'E toll 8', 'Who Cibaduyut (CBY)', 1062100, 420000, 1482100, 24],
    [3, 'E toll 6', 'Who Bandung (BDG)', 1300000, 112500, 1412500, 31],
    [4, 'BGR 01', 'Who Bogor (BGR)', 0, 1714500, 1714500, 29],
    ['', 'TOTAL', '', 3982108, 3991500, 7973608, 106],
  ],
};
const f = bacaEtoll(flazz);
assert.equal(f.error, '');
assert.equal(f.periode, '2026-10');
assert.deepEqual(f.dilewati.map(d => d.cabang), ['BOGOR'], 'Bogor isi Flazz lewat kas kecil');
assert.equal(f.rows.length, 6, 'BBM & Tol per kartu, nilai 0 tidak dibuat baris');
assert.equal(f.rows.reduce((a, r) => a + r.kas_keluar, 0), 3364508 + 1482100 + 1412500);

// --- kenaliFile ---
assert.equal(kenaliFile(etoll).sumber, 'ETOLL');
assert.equal(kenaliFile(flazz).sumber, 'ETOLL', 'file Flazz dikenali sebagai e-toll');
assert.equal(kenaliFile({ 'Kas Kecil': kas }).sumber, 'KAS_KECIL');
assert.ok(kenaliFile({ Sheet1: [['a', 'b']] }).error);

// --- backend: normalisasi & upload mengganti bulan + sumber ---
const norm = normalizeBiayaRows([...k.rows, { periode: 'salah', cabang: 'X', jenis: 'Y' }], 'KAS_KECIL');
assert.equal(norm.length, 2, 'periode tidak valid dibuang');
assert.equal(norm[0].biaya, 252000, 'biaya = kas keluar - kembalian');
{
  const calls = [];
  const db = { request: async (m, t, o) => calls.push({ m, t, o }) };
  assert.equal((await handleUpload(db, { sumber: 'LAIN', rows: k.rows })).status, 'error');
  const res = await handleUpload(db, { sumber: 'KAS_KECIL', rows: k.rows });
  assert.equal(res.status, 'success');
  assert.deepEqual(calls[0], { m: 'DELETE', t: 'biaya_cabang', o: { eq: { periode: '2026-09', sumber: 'KAS_KECIL' } } });
  assert.equal(calls[1].m, 'POST');
  assert.equal(calls[1].o.data.length, 2);
  assert.equal(res.data.per_periode['2026-09'].biaya, 252000 + 300000);
}

// --- omzet per cabang sama dengan Rekap Belanja (semua kategori) ---
const priceMap = { 'SPS TSI': { mst: 1000, karyawan: 900 } };
const om = omzetPerCabang([
  { tanggal: '2026-09-01', cabang: 'BANDUNG', tipe_customer: 'MST A', products: { 'SPS TSI': 10 } },
  { tanggal: '2026-09-01', cabang: 'BANDUNG', tipe_customer: 'ORE Online', products: { 'SPS TSI': 2 } },
  { tanggal: '2026-09-01', cabang: 'BANDUNG', tipe_customer: 'PELANGGAN', products: { 'SPS TSI': 99 } },
], priceMap, '2026-09');
assert.deepEqual(om, { BANDUNG: { omzet: 10 * 1000 + 2 * 900, bungkus: 12 } });

// --- ringkasCabang: WHO punya %; WHP tanpa omzet ---
const r = ringkasCabang({
  biaya: [
    { cabang: 'BANDUNG', sumber: 'KAS_KECIL', jenis: 'Biaya Retribusi', biaya: 1000 },
    { cabang: 'BANDUNG', sumber: 'ETOLL', jenis: 'E-toll BBM', biaya: 4000 },
    { cabang: 'WHP BANDUNG', sumber: 'ETOLL', jenis: 'E-toll Tol', biaya: 7000 },
  ],
  omzet: { BANDUNG: { omzet: 1000000, bungkus: 100 }, GARUT: { omzet: 500000, bungkus: 50 } },
});
const by = Object.fromEntries(r.map(g => [g.cabang, g]));
assert.equal(by.BANDUNG.total, 5000);
assert.equal(by.BANDUNG.kas, 1000);
assert.equal(by.BANDUNG.etoll, 4000);
assert.equal(by.BANDUNG.persen, 0.5);
assert.equal(by.BANDUNG.perBungkus, 50);
assert.equal(by.GARUT.total, 0, 'cabang dengan omzet tapi tanpa biaya tetap muncul');
assert.equal(by['WHP BANDUNG'].whp, true);
assert.equal(by['WHP BANDUNG'].persen, null, 'WHP tidak dibandingkan dengan omzet');

console.log('OK: semua tes biaya vs omzet lolos');
