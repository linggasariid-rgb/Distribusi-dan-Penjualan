import assert from 'node:assert/strict';
import { handle } from '../worker/src/routes/sales-hub.js';

// Pohon masalah (regression 2026-09-29): daftar cabang dibangun HANYA dari
// jendela bulan berjalan + bulan lalu, lalu dipakai lagi untuk memfilter baris
// snapshot per tanggal. Cabang yang transactinya baru mulai pada tanggal
// snapshot -- seperti CIBADUYUT, pertama ada 2026-09-03 -- hilang dari tabel
// Penjualan Harian meski tabel itu justru sedang menampilkan tanggal itu.
function fakeDb(rows) {
  return {
    query: (table, opts = {}) => {
      if (table !== 'penjualan_who') return Promise.resolve([]);
      let out = rows;
      if (opts.gte && opts.gte.tanggal) out = out.filter(r => r.tanggal >= opts.gte.tanggal);
      if (opts.lte && opts.lte.tanggal) out = out.filter(r => r.tanggal <= opts.lte.tanggal);
      if (opts.eq && opts.eq.tanggal) out = out.filter(r => r.tanggal === opts.eq.tanggal);
      return Promise.resolve(out);
    },
  };
}

const rows = [
  { cabang: 'BANDUNG',   tipe_customer: 'MST B', tanggal: '2026-09-01', jumlah: 10 },
  { cabang: 'BANDUNG',   tipe_customer: 'MST B', tanggal: '2026-09-02', jumlah: 5 },
  { cabang: 'BANDUNG',   tipe_customer: 'MST B', tanggal: '2026-08-01', jumlah: 7 },
  { cabang: 'CIBADUYUT', tipe_customer: 'MST C', tanggal: '2026-09-15', jumlah: 42 },
];

{
  const r = await handle(fakeDb(rows), '', '2026-09-02', '2026-08-02', '2026-09-15');
  assert.equal(r.status, 'success');
  assert.deepEqual(r.data.branches, ['BANDUNG', 'CIBADUYUT'],
    'cabang yang hanya ada di tanggal snapshot tetap harus masuk daftar');

  // Tabel bulanan: Cibaduyut memang belum ada di 1-2 Sep, jadi harus 0 --
  // ditampilkan, bukan dihilang.
  const blnIni = r.data.currentMonth.data.find(x => x.warehouse === 'CIBADUYUT');
  assert.ok(blnIni, 'baris CIBADUYUT harus ada di tabel bulan berjalan');
  assert.equal(blnIni.total, 0, 'nol karena memang belum ada transaksi di jendela itu');

  // Tabel Penjualan Harian: di 15 Sep ada transaksinya.
  const snap = r.data.dateSnapshots.find(s => s.date === '15 Sep 26');
  assert.ok(snap, 'snapshot 15 Sep harus ada');
  const snapCib = snap.data.find(x => x.warehouse === 'CIBADUYUT');
  assert.ok(snapCib, 'CIBADUYUT harus muncul di snapshot tanggal 15 Sep');
  assert.equal(snapCib.total, 42, 'snapshot harus berisi angka transaksi hari itu');
}

// Cabang yang benar-benar tidak ada di ketiga jendela tetap tidak boleh muncul.
{
  const r = await handle(fakeDb(rows), '', '2026-09-02', '2026-08-02', '2026-09-15');
  assert.equal(r.data.branches.includes('SERANG'), false, 'tanpa data -> tidak muncul');
}

// Cabang yang diabaikan tetap diabaikan meski ada di tanggal snapshot.
{
  const denganBanyumas = [...rows, { cabang: 'BANYUMAS', tipe_customer: 'MST X', tanggal: '2026-09-15', jumlah: 99 }];
  const r = await handle(fakeDb(denganBanyumas), '', '2026-09-02', '2026-08-02', '2026-09-15');
  assert.equal(r.data.branches.includes('BANYUMAS'), false, 'BANYUMAS tetap diabaikan');
}

// WHP tetap berlaku setelah daftar cabang diperluas.
{
  const semua = [
    ...rows,
    { cabang: 'TASIKMALAYA', tipe_customer: 'MST T', tanggal: '2026-09-01', jumlah: 3 },
    { cabang: 'GARUT',       tipe_customer: 'MST G', tanggal: '2026-09-15', jumlah: 4 },
  ];
  const r = await handle(fakeDb(semua), 'WHP TASIKMALAYA', '2026-09-02', '2026-08-02', '2026-09-15');
  assert.deepEqual(r.data.branches, ['GARUT', 'TASIKMALAYA'],
    'cabang dari snapshot ikut disaring oleh filter WHP');
}

// ─── Regression (30 Sep 2026): tanggal "Periode Lalu" diabaikan backend ───
// Kolom "Periode Lalu" bisa diedit user, tapi backend memotong jendela bulan
// lalu memakai currDayNum (hari dari "Tanggal Berakhir"), bukan tanggal yang
// dipilih user. Terbukti dari API: prevDate=2026-08-31, 2026-08-15, dan
// 2026-08-01 sama-sama mengembalikan previousTotal 1158965 -- filter tidak
// pernah berefek.
{
  const rowsPeriode = [
    { cabang: 'BANDUNG', tipe_customer: 'MST B', tanggal: '2026-08-31', jumlah: 100 },
    { cabang: 'BANDUNG', tipe_customer: 'MST B', tanggal: '2026-09-10', jumlah: 5 },
  ];

  const sampai31 = await handle(fakeDb(rowsPeriode), '', '2026-09-30', '2026-08-31', '2026-09-30');
  assert.equal(sampai31.data.kpis.previousTotal, 100,
    'Periode Lalu = 31 Agt harus ikut menghitung transaksi 31 Agt');

  const sampai15 = await handle(fakeDb(rowsPeriode), '', '2026-09-30', '2026-08-15', '2026-09-30');
  assert.equal(sampai15.data.kpis.previousTotal, 0,
    'Periode Lalu = 15 Agt harus memotong tepat di tanggal 15');
}

// Tanggal yang melebihi panjang bulan harus di-clamp, bukan melompat ke bulan berikutnya.
{
  const r = await handle(fakeDb([]), '', '2026-03-15', '2026-02-31', '2026-03-15');
  assert.equal(r.status, 'success');
  assert.equal(r.data.previousMonth.label, '2/2026', '31 Feb harus tetap di Februari');
}

// Perbandingan harian harus menutupi kedua sisi. Kalau bulan lalu lebih panjang
// dari bulan berjalan, hari-harine tidak boleh hilang hanya karena sisi bulan
// berjalan belum sampai.
{
  const rowsBanding = [
    { cabang: 'BANDUNG', tipe_customer: 'MST B', tanggal: '2026-08-31', jumlah: 7 },
    { cabang: 'BANDUNG', tipe_customer: 'MST B', tanggal: '2026-09-10', jumlah: 3 },
  ];
  const r = await handle(fakeDb(rowsBanding), '', '2026-09-10', '2026-08-31', '2026-09-10');
  const tgl31 = r.data.dailyComparison.find(d => d.date === '31/09');
  assert.ok(tgl31, 'hari ke-31 harus tampil walau bulan berjalan baru sampai tanggal 10');
  assert.equal(tgl31.previous, 7, 'sisi bulan lalu harus ikut terisi');
}

console.log('OK: tes sales-hub backend lolos');
