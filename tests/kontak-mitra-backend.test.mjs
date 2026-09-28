import assert from 'node:assert/strict';
import { findKontakColumns, buildNamaKey, parseKontakRows, handle } from '../worker/src/routes/kontak-mitra.js';
import { Supabase } from '../worker/src/supabase.js';

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

// --- handle: "Hapus Semua" harus DELETE dengan WHERE clause ---
// Regresi: request tanpa filter ditolak PostgREST dengan "DELETE requires a
// WHERE clause", jadi tombol Hapus Semua tidak pernah berhasil.
async function testClear() {
  const calls = [];
  const db = { request: (...args) => { calls.push(args); return Promise.resolve(null); } };

  const res = await handle(db, { clear: true });
  assert.equal(res.status, 'success');
  assert.equal(res.data.cleared, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'DELETE', 'harus DELETE');
  assert.equal(calls[0][1], 'kontak_mitra');
  assert.ok(calls[0][2].notNull && calls[0][2].notNull.includes('nama_key'),
    'DELETE harus memakai filter nama_key not.is.null');

  // --- handle: simpan -> POST dengan on_conflict nama_key ---
  calls.length = 0;
  const rows = [['No.', 'NAMA', 'TYPE', 'PEMILIK', 'HP / Telepon'], ['1', 'Independen 12', 'MSI', 'Budi', '0812']];
  const res2 = await handle(db, { rows });
  assert.equal(res2.status, 'success');
  assert.equal(res2.data.saved, 1);
  assert.equal(calls[0][0], 'POST');
  assert.equal(calls[0][2].onConflict, 'nama_key');
  assert.equal(calls[0][2].data[0].nama_key, 'MSI INDEPENDEN 12');

  // --- handle: tanpa rows dan tanpa clear -> error, jangan sampai DELETE/POST ---
  calls.length = 0;
  const res3 = await handle(db, {});
  assert.equal(res3.status, 'error');
  assert.equal(calls.length, 0, 'tidak boleh menembak request apa pun');
}

// --- Supabase.request: query string dibangun dengan benar ---
async function testRequestQuery() {
  const seen = [];
  const db = new Supabase('https://example.supabase.co', 'anon-key');
  db._fetch = (path, method, body, headers) => { seen.push({ path, method }); return Promise.resolve(null); };

  await db.request('DELETE', 'kontak_mitra', { notNull: ['nama_key'] });
  assert.equal(seen[0].path, '/rest/v1/kontak_mitra?nama_key=not.is.null');
  assert.equal(seen[0].method, 'DELETE');

  seen.length = 0;
  await db.request('POST', 'product_prices', { data: [], onConflict: 'x' });
  assert.equal(seen[0].path, '/rest/v1/product_prices?on_conflict=x',
    'on_conflict tidak boleh berubah bentuk untuk pemanggil lama');

  seen.length = 0;
  await db.request('POST', 't', { data: [], onConflict: 'y', notNull: ['a'] });
  assert.equal(seen[0].path, '/rest/v1/t?a=not.is.null&on_conflict=y');

  seen.length = 0;
  await db.request('DELETE', 't', { eq: { nama_key: 'MSI A' } });
  assert.equal(seen[0].path, '/rest/v1/t?nama_key=eq.MSI%20A');
}

await testClear();
await testRequestQuery();

console.log('OK: semua tes backend kontak mitra lolos');
