import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hitungTanggalSalesHub, prevDateOtomatis } from '../src/modules/saleshub/salesHub.js';

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

// ─── Regression (30 Sep 2026): filter "Periode Lalu" mati ──────────────
// User mengubah tanggal "Periode Lalu" ke periode berikutnya, tapi angka
// penjualan tidak berubah. Penyebabnya bukan di backend: `#sh-prev-date`
// tidak punya listener `change` sama sekali, jadi loadSalesHubData() tidak
// pernah dipanggil dan DOM masih menampilkan hasil render sebelumnya.

// Wiring: setiap input tanggal yang bisa diedit user WAJIB punya listener
// change, kalau tidak yang terjadi adalah filter diam-diam tidak berefek.
{
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const src = fs.readFileSync(path.join(ROOT, 'src/events/filterEvents.js'), 'utf8');
  for (const id of ['sh-end-date', 'sh-prev-date', 'sh-backdate']) {
    const bound = new RegExp(
      "getElementById\\('" + id + "'\\)[\\s\\S]{0,200}?addEventListener\\(\\s*'change'"
    ).test(src);
    assert.ok(bound, '#' + id + ' tidak punya listener change -> filter tidak berefek');
  }
}

// prevDateOtomatis: nilai "Periode Lalu" yang masih turunan otomatis dari
// "Tanggal Berakhir" boleh ditimpa, tapi yang sudah diedit manual harus
// dihormati. Tanpa ini, begitu user memilih periode sendiri, setiap perubahan
// "Tanggal Berakhir" menimpa pilihan itu.
{
  assert.equal(prevDateOtomatis('2026-09-30', ''), '2026-08-30', 'kosong -> isi otomatis');
  assert.equal(
    prevDateOtomatis('2026-09-30', '2026-08-30'),
    '2026-08-30',
    'masih sama dengan turunan -> aman ditimpa'
  );
  assert.equal(
    prevDateOtomatis('2026-10-15', '2026-08-30'),
    '2026-08-30',
    'sudah diedit manual -> jangan ditimpa'
  );
  assert.equal(prevDateOtomatis('2026-03-31', '2026-02-28'), '2026-02-28', 'clamp tetap berlaku');
}

console.log('OK: tes sales-hub frontend lolos');
