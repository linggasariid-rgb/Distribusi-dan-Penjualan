import assert from 'node:assert/strict';
import { findNamaColumn, handle } from '../worker/src/routes/save-penjualan-who.js';

assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA CUSTOMER', 'SPS TSI']), 4, 'NAMA CUSTOMER terdeteksi');
assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA PDM', 'SPS TSI']), 4, 'NAMA PDM tetap terdeteksi');
assert.equal(findNamaColumn(['NAMA PEMBELI CUSTOMER', 'SPS TSI']), 0, 'header mengandung NAMA+CUSTOMER');
assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'SPS TSI']), -1, 'tanpa kolom nama');

// --- rekaman request, untuk memeriksa urutan DELETE lalu POST ---
function recorder() {
  const calls = [];
  return {
    calls,
    db: {
      request: (...a) => { calls.push(a); return Promise.resolve(null); },
    },
  };
}

// Baris yang valid: BULAN, CABANG, TIPE, TANGGAL, NAMA PDM, JUMLAH
// TANGGAL harus bisa diparse -> "1 Ags 26" -> 2026-08-01
function makeRow(bulan, tipe, nama, jumlah) {
  return [bulan, 'BANDUNG', tipe, '1 Ags 26', nama, jumlah];
}
const HEAD = ['BULAN', 'CABANG', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA PDM', 'JUMLAH'];

// --- default (tanpa replace): hanya POST, tidak boleh ada DELETE ---
{
  const { calls, db } = recorder();
  const res = await handle(db, { data: [HEAD, makeRow('AGUSTUS', 'MSI', 'Independen 12', '10')] });
  assert.equal(res.status, 'success');
  assert.equal(calls.length, 1, 'hanya satu request');
  assert.equal(calls[0][0], 'POST', 'tanpa replace tidak boleh DELETE');
  assert.equal(calls[0][2].data[0].tipe_customer, 'MSI Independen 12',
    'TIPE + NAMA PDM digabung menjadi nama asli');
}

// --- replace: DELETE bulan terkait dulu, baru POST ---
{
  const { calls, db } = recorder();
  const res = await handle(db, {
    replace: true,
    data: [
      HEAD,
      makeRow('AGUSTUS', 'MSI', 'Independen 12', '10'),
      makeRow('AGUSTUS', 'MST', 'Sinderges', '5'),
    ],
  });
  assert.equal(res.status, 'success');

  const del = calls.filter(c => c[0] === 'DELETE');
  const post = calls.filter(c => c[0] === 'POST');
  assert.equal(del.length, 1, 'satu DELETE untuk satu bulan');
  assert.deepEqual(del[0][2].eq, { bulan: 'AGUSTUS' }, 'hanya bulan AGUSTUS yang dihapus');
  assert.equal(del[0][1], 'penjualan_who');
  assert.equal(post.length, 1, 'satu POST');
  assert.equal(post[0][2].data.length, 2);

  // Urutan wajib DELETE sebelum POST, kalau tidak data dobel.
  assert.ok(calls.indexOf(del[0]) < calls.indexOf(post[0]), 'DELETE harus sebelum POST');
  assert.ok(res.message.includes('AGUSTUS'), 'pesan menyebut bulan yang dihapus');
}

// --- replace dengan dua bulan: dua DELETE terpisah, bukan hapus semua ---
{
  const { calls, db } = recorder();
  await handle(db, {
    replace: true,
    data: [HEAD, makeRow('AGUSTUS', 'MSI', 'A', '1'), makeRow('SEPTEMBER', 'MST', 'B', '2')],
  });
  const del = calls.filter(c => c[0] === 'DELETE');
  assert.equal(del.length, 2, 'dua bulan -> dua DELETE');
  assert.deepEqual(del.map(c => c[2].eq.bulan).sort(), ['AGUSTUS', 'SEPTEMBER']);
}

// --- replace dengan bulan yang tidak dikenal: TIDAK BOLEH hapus apa pun ---
{
  const { calls, db } = recorder();
  const res = await handle(db, { replace: true, data: [HEAD, ['-', 'BANDUNG', 'MSI', '1 Ags 26', 'A', '1']] });
  assert.equal(res.status, 'error', 'bulan kosong -> error');
  assert.equal(calls.filter(c => c[0] === 'DELETE').length, 0, 'tidak boleh ada DELETE sama sekali');
  assert.equal(calls.filter(c => c[0] === 'POST').length, 0, 'tidak boleh ada POST');
}

// --- replace dengan data kosong: tidak boleh hapus apa pun ---
{
  const { calls, db } = recorder();
  const res = await handle(db, { replace: true, data: [] });
  assert.equal(res.status, 'error');
  assert.equal(calls.length, 0, 'data kosong tidak boleh menyentuh database');
}

// --- header rusak: validasi harus gagal SEBELUM delete, supaya tidak ada data hilang ---
{
  const { calls, db } = recorder();
  const res = await handle(db, { replace: true, data: [['A', 'B'], ['1', '2']] });
  assert.equal(res.status, 'error', 'header tidak dikenali -> error');
  assert.equal(calls.filter(c => c[0] === 'DELETE').length, 0, 'header salah tidak boleh menghapus data');
}

console.log('OK: tes save penjualan WHO lolos');