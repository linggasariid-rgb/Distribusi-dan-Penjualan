import assert from 'node:assert/strict';
import { findKontakColumns, buildNamaKey, parseKontakRows } from '../worker/src/routes/kontak-mitra.js';

// --- findKontakColumns: header persis seperti file Excel user ---
const H = ['No.', 'NAMA', 'TYPE', 'PEMILIK', 'HP / Telepon'];
assert.deepEqual(findKontakColumns(H), { type: 2, nama: 1, pemilik: 3, kontak: 4 });

// --- varian nama kolom ---
assert.deepEqual(findKontakColumns(['NAMA', 'TIPE', 'PEMILIK', 'TELEPON']),
  { type: 1, nama: 0, pemilik: 2, kontak: 3 });
assert.deepEqual(findKontakColumns(['NAMA CUSTOMER', 'TYPE', 'NAMA PEMILIK', 'NO HP']),
  { type: 1, nama: 0, pemilik: 2, kontak: 3 });
assert.deepEqual(findKontakColumns(['nama', 'type', 'owner', 'wa']),
  { type: 1, nama: 0, pemilik: 2, kontak: 3 });

// --- kolom 'No.' / 'NOMOR' TIDAK boleh dipakai sebagai kontak ---
assert.equal(findKontakColumns(['NAMA', 'TYPE', 'No', 'KONTAK']).kontak, 3);

// --- header tidak lengkap -> null ---
assert.equal(findKontakColumns(['NAMA', 'PEMILIK']), null, 'tanpa TYPE -> null');
assert.equal(findKontakColumns(['TYPE', 'PEMILIK', 'HP']), null, 'tanpa NAMA -> null');
assert.equal(findKontakColumns([]), null);

// --- kolom yang tidak ada -> -1 (frontend tidak menampilkan kolom itu) ---
assert.equal(findKontakColumns(['NAMA', 'TYPE', 'PEMILIK']).kontak, -1);

// --- 'NAMA' harus tidak tertangkap kolom pemilik ---
const c = findKontakColumns(['NAMA', 'TYPE', 'PEMILIK']);
assert.equal(c.nama, 0);
assert.equal(c.pemilik, 2);

// --- buildNamaKey ---
assert.equal(buildNamaKey('MSI', 'Independen 12'), 'MSI INDEPENDEN 12');
assert.equal(buildNamaKey('msi', '  Bir   Ali  '), 'MSI BIR ALI');
assert.equal(buildNamaKey('MST', ''), 'MST');
assert.equal(buildNamaKey('', 'Budi'), 'BUDI');

// --- parseKontakRows ---
const rows = [
  ['No.', 'NAMA', 'TYPE', 'PEMILIK', 'HP / Telepon'],
  ['1', ' Independen 12 ', 'msi', ' Budi  Santoso ', '0812-3456-789'],
  ['2', 'BIR ALI', 'STK', '', ''],
  ['', '', '', '', ''],
  ['3', 'SINDERGES', 'MST', 'Andi', '081299999999'],
];
const parsed = parseKontakRows(rows, rows[0]);
assert.equal(parsed.length, 3, 'baris kosong dilewati');
assert.deepEqual(parsed[0], {
  nama_key: 'MSI INDEPENDEN 12',
  nama: 'Independen 12',
  type: 'MSI',
  pemilik: 'Budi Santoso',
  kontak: '0812-3456-789',
});
assert.equal(parsed[1].nama_key, 'STK BIR ALI');
assert.equal(parsed[1].pemilik, '', 'kosong jadi string kosong');
assert.equal(parsed[2].nama_key, 'MST SINDERGES');

// --- parseKontakRows tanpa header -> array kosong ---
assert.deepEqual(parseKontakRows([['1', 'A', 'MST']], ['No.', 'NAMA', 'TYPE']), []);

console.log('OK: semua tes backend kontak mitra lolos');
