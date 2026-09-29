import assert from 'node:assert/strict';
import { hitungTanggalSalesHub } from '../src/modules/saleshub/salesHub.js';

// Regression (29 Sep 2026): kolom "Tanggal Berakhir" tertinggal di 02/09/2026
// sementara "Backdate" sudah 28/09/2026. syncPrevDate() hanya menulis ke kolom
// "Periode Lalu", tidak pernah menyentuh Backdate, sehingga keduanya melenceng
// sendiri dan tabel Penjualan Harian melaporkan tanggal yang berbeda dari
// tabel bulanan.
{
  const t = hitungTanggalSalesHub('2026-09-29');
  assert.deepEqual(t, { end: '2026-09-29', prev: '2026-08-29', back: '2026-09-29' });
}

{
  // Kasus yang稀释 user: Backdate harus ikut berubah, tidak boleh nyangkut.
  const t = hitungTanggalSalesHub('2026-09-02');
  assert.equal(t.prev, '2026-08-02');
  assert.equal(t.back, '2026-09-02', 'Backdate wajib mengikuti Tanggal Berakhir');
}

{
  // Clamp akhir bulan: 31 Mar -> 28 Feb, bukan 31 Feb.
  const t = hitungTanggalSalesHub('2026-03-31');
  assert.deepEqual(t, { end: '2026-03-31', prev: '2026-02-28', back: '2026-03-31' });
}

{
  // Gulir tahun: Januari -> Desember tahun sebelumnya.
  const t = hitungTanggalSalesHub('2026-01-15');
  assert.deepEqual(t, { end: '2026-01-15', prev: '2025-12-15', back: '2026-01-15' });
}

{
  // Tahun kabisat.
  assert.equal(hitungTanggalSalesHub('2028-03-31').prev, '2028-02-29');
}

{
  // Nilai kosong tidak boleh menghasilkan "NaN" atau tanggal palsu.
  assert.deepEqual(hitungTanggalSalesHub(''), { end: '', prev: '', back: '' });
}

console.log('OK: tes sales-hub frontend lolos');
