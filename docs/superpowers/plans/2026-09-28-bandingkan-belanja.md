# Bandingkan Belanja + Kontak Mitra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan dua menu baru — "Bandingkan Belanja" (total produk per mitra, bulan ini vs bulan pembanding, dengan penanda ▲/▼) dan "Kontak Mitra" (master nama pemilik + nomor telepon per MST/MSI/STK).

**Architecture:** Dua route Worker baru. `report-belanja-banding.js` menarik `penjualan_who` sekali untuk rentang dua bulan, menjumlahkan kuantitas produk (tanpa `HU`, tanpa harga), mengagregasi per `(cabang, tipe_customer)`, lalu menggabungkannya dengan `kontak_mitra` di memori. `kontak-mitra.js` menangani GET/POST tabel master baru. Di sisi klien, `bandingkanBelanja.js` dan `kontakMitra.js` menjadi modul vanilla-JS yang di-lazy-load dari router, mengikuti pola `rekapBelanja.js`.

**Tech Stack:** Cloudflare Workers (ESM, `nodejs_compat`), Supabase/PostgREST via wrapper `worker/src/supabase.js`, Vanilla JS SPA (ES modules, tanpa framework), Tailwind CSS + FontAwesome 6.5.1, SheetJS `xlsx-js-style@1.2.0` (global `XLSX`), test `node:assert/strict` polos tanpa framework.

## Global Constraints

- **Satuan angka adalah BUNGKUS (jumlah produk), bukan rupiah.** `product_prices` tidak boleh disentuh sama sekali di route baru. Tidak ada kolom nominal di layar maupun Excel.
- **`HU` tidak dihitung** ke total — identik dengan `total_bungkus` di `report-belanja-stokis.js:21`.
- **Cakupan data hanya `MST`, `MSI`, `STK`.** `MST` dan `MSI` harus **terpisah** (beda dari `detectCategory` yang menyatukannya menjadi `Master Stokis`). Tipe lain dibuang.
- **`callApi()` hanya mendukung GET dan POST.** Tidak ada jalur DELETE — jangan mengubah `src/services/api.js`. "Hapus Semua" dikirim sebagai `POST` dengan body `{ clear: true }`.
- **`nama_key` hanya boleh dibangun di backend.** Client mengirim `{ nama, type, pemilik, kontak }` mentah; backend yang menormalisasi.
- **`nama_key` = `TYPE` + `NAMA`, uppercase, spasi dirapatkan.** Contoh: `('MSI', ' Independen 12 ')` → `'MSI INDEPENDEN 12'`.
- **Tidak ada backfill** data nama untuk bulan lama (Agustus 2026 ke bawah).
- **Test dijalankan dari repo root:** `node tests/<file>.test.mjs`. Tidak ada test framework; jangan menambah dependency.
- **Route lama tidak boleh diubah.** `report-belanja-stokis.js`, `rekapBelanja.js`, dan test-nya harus tetap lulus.
- Komentar kode dan identifier memakai bahasa Indonesia agar konsisten dengan file yang ada.
- FontAwesome 6.5.1 sudah dimuat — hanya pakai ikon dari FA6 Free.

---

## File Structure

**Baru:**

| Path | Tanggung jawab |
|---|---|
| `worker/create-kontak-mitra-table.sql` | DDL tabel `kontak_mitra` + index + RLS |
| `worker/src/routes/kontak-mitra.js` | Deteksi header Excel, normalisasi `nama_key`, parse baris, GET list, POST upsert/clear |
| `worker/src/routes/report-belanja-banding.js` | Deteksi tipe, agregasi dua bulan, deteksi `punya_nama`, merge + join kontak |
| `src/modules/kontakMitra/kontakMitra.js` | UI paste/simpan/hapus + render tabel kontak |
| `src/modules/reports/bandingkanBelanja.js` | Fetch data, hitung selisih, render tabel ▲/▼, export Excel |
| `tests/kontak-mitra-backend.test.mjs` | Test `findKontakColumns`, `buildNamaKey`, `parseKontakRows` |
| `tests/bandingkan-belanja-backend.test.mjs` | Test `detectTipe`, `computeBungkus`, `aggregateBulan`, `detectPunyaNama`, `mergeRows` |

**Ubah:**

| Path | Perubahan |
|---|---|
| `worker/src/index.js` | Import + 2 blok route |
| `src/config/routes.js` | 2 entri `READ`, 2 entri `WRITE` |
| `src/events/sidebarEvents.js` | 2 id baru di `MENU_IDS` |
| `src/router.js` | 4 `const` view/menu baru, 2 hide, 2 reset, 2 cabang router |
| `index.html` | 2 menu + 2 view |
| `dashboard.html` | 2 menu saja (tanpa view) |

---

## Task 1: Tabel `kontak_mitra` + parser header Excel

Endpoint ini tidak bisa dipakai sebelum tabelnya ada, dan parser-nya adalah bagian paling rawan salah baca — jadi keduanya satu task.

**Files:**
- Create: `worker/create-kontak-mitra-table.sql`
- Create: `worker/src/routes/kontak-mitra.js` (hanya bagian parser dulu)
- Create: `tests/kontak-mitra-backend.test.mjs`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `findKontakColumns(headers: string[]): { type, nama, pemilik, kontak } | null` — indeks kolom, `null` bila `type` atau `nama` tidak ditemukan.
  - `buildNamaKey(type: string, nama: string): string`
  - `parseKontakRows(rows: string[][], headers: string[]): { nama_key, nama, type, pemilik, kontak }[]`

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/kontak-mitra-backend.test.mjs`:

```js
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
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `node tests/kontak-mitra-backend.test.mjs`
Expected: FAIL dengan `Cannot find module '../worker/src/routes/kontak-mitra.js'` (atau `ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Buat file SQL**

`worker/create-kontak-mitra-table.sql`:

```sql
-- Master kontak mitra (MST / MSI / STK).
-- Dipakai oleh menu "Kontak Mitra" (input paste dari Excel) dan
-- ditampilkan di menu "Bandingkan Belanja" sebagai kolom Pemilik + Kontak.
--
-- SELURUH blok ini aman diulang: Supabase/Postgres tidak punya
-- "CREATE POLICY IF NOT EXISTS", jadi policy-nya di-drop dulu. Tanpa ini, jalan
-- kedua berhenti di error "policy already exists" -- dan karena satu error
-- membatalkan seluruh batch, tabel pun bisa tertinggal tidak tercreated.

CREATE TABLE IF NOT EXISTS public.kontak_mitra (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_key   TEXT NOT NULL UNIQUE,
  nama       TEXT NOT NULL,
  type       TEXT NOT NULL,
  pemilik    TEXT,
  kontak     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kolom UNIQUE sudah membuat indeks sendiri, jadi tidak perlu idx_kontak_mitra_nama_key.

ALTER TABLE public.kontak_mitra ENABLE ROW LEVEL SECURITY;

-- WAJIB: Worker memakai SUPABASE_ANON_KEY (worker/src/index.js:52), bukan
-- service key, jadi RLS ikut berlaku. Tanpa policy di bawah, TABEL ADA tapi
-- setiap query dari Worker mengembalikan 0 baris atau error 42501 -- gejalanya
-- seperti "kontak tidak pernah tersimpan", padahal datanya sudah masuk.
-- Ikuti pola yang sama dengan create-users-table.sql.
DROP POLICY IF EXISTS "anon select kontak_mitra" ON public.kontak_mitra;
DROP POLICY IF EXISTS "anon insert kontak_mitra" ON public.kontak_mitra;
DROP POLICY IF EXISTS "anon update kontak_mitra" ON public.kontak_mitra;
DROP POLICY IF EXISTS "anon delete kontak_mitra" ON public.kontak_mitra;

CREATE POLICY "anon select kontak_mitra" ON public.kontak_mitra FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert kontak_mitra" ON public.kontak_mitra FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update kontak_mitra" ON public.kontak_mitra FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete kontak_mitra" ON public.kontak_mitra FOR DELETE TO anon USING (true);
```

**Penting: pastikan tidak ada sisa SQL lain di baris yang sama.** Kalau SQL
Editor complains soal `users` atau tabel lain yang tidak ada hubungannya dengan
`kontak_mitra`, berarti blok yang dijalankan bukan yang di atas. Blok di atas
hanya boleh berisi `CREATE TABLE`, `ALTER TABLE`, `DROP POLICY`, `CREATE POLICY`
untuk `kontak_mitra`.

Jalankan di Supabase SQL Editor **sebelum** Task 2, karena Task 2 akan query ke
tabel ini. Verifikasi:

Run di Supabase SQL Editor: `select count(*) from public.kontak_mitra;`
Expected: `0` (tabel ada, kosong).

Lalu pastikan policy-nya benar-benar ada, jangan andalkan "SQL-nya tidak error":

Run di Supabase SQL Editor:
```sql
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'kontak_mitra' order by policyname;
```
Expected: 4 baris (`anon delete`, `anon insert`, `anon select`, `anon update`). Kalau 0 baris, endpoint akan diam-diam selalu kosong -- itu blocker, jangan lanjut ke Task 2.

- [ ] **Step 4: Implementasikan parser**

`worker/src/routes/kontak-mitra.js`:

```js
// Master kontak mitra: parser header Excel + normalisasi kunci.
// Tanpa harga, tanpa rupiah — hanya nama, tipe, pemilik, nomor telepon.

function normalizeHeader(h) {
  return String(h == null ? '' : h)
    .toUpperCase()
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kunci-kunci yang dikenali per kolom. `nama` diperiksa terpisah karena
// string "NAMA" ikut muncul di dalam "NAMA PEMILIK".
const TYPE_KEYS    = ['TYPE', 'TIPE'];
const NAMA_KEYS    = ['NAMA', 'NAMA CUSTOMER', 'NAMA STOKIS'];
const PEMILIK_KEYS = ['PEMILIK', 'NAMA PEMILIK', 'PEMILIK NAMA', 'OWNER', 'PIC'];
const KONTAK_KEYS  = ['HP', 'HP TELEPON', 'HP TELP', 'NO HP', 'NAMA HP',
                      'TELEPON', 'TELP', 'NO TELFON', 'KONTAK', 'WA', 'WHATSAPP'];

// Cari indeks kolom pertama yang header-nya persis salah satu dari `keys`.
// Header dinormalisasi lebih dulu supaya "HP / Telepon" -> "HP TELEPON".
function findColumn(headers, keys) {
  const norm = headers.map(normalizeHeader);
  for (const key of keys) {
    const idx = norm.indexOf(key);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function findKontakColumns(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return null;

  const type = findColumn(headers, TYPE_KEYS);
  const nama = findColumn(headers, NAMA_KEYS);
  // Tanpa TYPE atau NAMA, baris tidak bisa di-match ke penjualan -> tolak.
  if (type < 0 || nama < 0) return null;

  return {
    type,
    nama,
    pemilik: findColumn(headers, PEMILIK_KEYS),
    kontak: findColumn(headers, KONTAK_KEYS),
  };
}

function clean(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// Kunci pencocokan ke penjualan_who.tipe_customer.
// "MSI Independen 12" -> "MSI INDEPENDEN 12"
export function buildNamaKey(type, nama) {
  return clean(`${type} ${nama}`).toUpperCase();
}

export function parseKontakRows(rows, headers) {
  const cols = findKontakColumns(headers);
  if (!cols) return [];

  const out = [];
  // Baris 0 adalah header -- bukan data, jadi dilewati. Tanpa ini, baris header
  // ikut terparse dan muncul sebagai kontak palsu: tipe "TYPE", nama "NAMA".
  for (const r of rows.slice(1)) {
    if (!Array.isArray(r)) continue;
    const type = clean(r[cols.type]).toUpperCase();
    const nama = clean(r[cols.nama]);
    if (!type || !nama) continue; // baris tidak lengkap -> dilewati

    out.push({
      nama_key: buildNamaKey(type, nama),
      nama,
      type,
      pemilik: cols.pemilik >= 0 ? clean(r[cols.pemilik]) : '',
      kontak: cols.kontak >= 0 ? clean(r[cols.kontak]) : '',
    });
  }
  return out;
}
```

- [ ] **Step 5: Jalankan test, harus lolos**

Run: `node tests/kontak-mitra-backend.test.mjs`
Expected: `OK: semua tes backend kontak mitra lolos`

- [ ] **Step 6: Pastikan route lama tidak rusak**

Run: `node tests/rekap-belanja-backend.test.mjs`
Expected: `OK: semua tes backend rekap belanja lolos`

- [ ] **Step 7: Commit**

```bash
git add worker/create-kontak-mitra-table.sql worker/src/routes/kontak-mitra.js tests/kontak-mitra-backend.test.mjs
git commit -m "feat: tabel kontak_mitra + parser header excel dan normalisasi nama_key"
```

---

## Task 2: Endpoint `kontak_mitra` (GET / POST)

Menyambung parser dari Task 1 ke database. Bisa diuji end-to-end lewat smoke test HTTP.

**Files:**
- Modify: `worker/src/routes/kontak-mitra.js` (tambah `handleList` dan `handle` di bagian bawah)
- Modify: `worker/src/index.js` (import + blok route)

**Interfaces:**
- Consumes: `parseKontakRows`, `findKontakColumns`, `buildNamaKey` dari Task 1.
- Produces:
  - `handleList(db) => Promise<{ status, data, total }>`
  - `handle(db, body) => Promise<{ status, data }>` — `body.rows` → bulk upsert; `body.clear === true` → hapus semua.
  - Route `GET /api/kontak-mitra`, `POST /api/kontak-mitra` di Worker.

- [ ] **Step 1: Tambah `handleList` dan `handle`**

Tambahkan di akhir `worker/src/routes/kontak-mitra.js`:

```js
export async function handleList(db) {
  const rows = await db.query('kontak_mitra', {
    select: 'nama_key,nama,type,pemilik,kontak',
    order: 'nama_key.asc',
  });
  return { status: 'success', data: rows, total: rows.length };
}

export async function handle(db, body) {
  // "Hapus Semua" dikirim sebagai POST { clear: true } karena callApi()
  // di frontend tidak punya jalur DELETE.
  if (body && body.clear === true) {
    await db.request('DELETE', 'kontak_mitra', {});
    return { status: 'success', data: { cleared: true } };
  }

  const rows = body && body.rows;
  if (!Array.isArray(rows)) {
    return { status: 'error', message: 'Data tidak valid:(rows array tidak ditemukan)' };
  }

  const parsed = parseKontakRows(rows, rows[0]);
  if (parsed.length === 0) {
    return { status: 'error', message: 'Header tidak dikenali. Pastikan baris pertama berisi kolom NAMA dan TYPE.' };
  }

  const now = new Date().toISOString();
  // Satu request untuk seluruh baris: array payload + on_conflict = upsert.
  await db.request('POST', 'kontak_mitra', {
    data: parsed.map(p => ({ ...p, updated_at: now })),
    onConflict: 'nama_key',
  });

  return { status: 'success', data: { saved: parsed.length, skipped: rows.length - 1 - parsed.length } };
}
```

- [ ] **Step 2: Registrasikan route di Worker**

Di `worker/src/index.js`, tambahkan import setelah baris 25 (`reportBelanjaStokis`):

```js
import * as kontakMitra from './routes/kontak-mitra.js';
```

Lalu tambahkan blok route setelah blok `/api/report-belanja-stokis` (sekitar baris 125):

```js
      if (path === '/api/kontak-mitra' || path === '/api/kontak-mitra/') {
        if (request.method === 'POST') {
          const body = await request.json();
          return json(await kontakMitra.handle(db, body));
        }
        return json(await kontakMitra.handleList(db));
      }
```

- [ ] **Step 3: Deploy Worker**

Run: `npx wrangler deploy`
Expected: output `Uploaded` lalu `Published`. Catat URL Worker (tetap `https://api-distribusi.distribusi-tsi.workers.dev`).

- [ ] **Step 4: Smoke test GET**

Run:
```powershell
Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/kontak-mitra" -TimeoutSec 60
```
Expected: `@{ status = "success"; total = 0; data = ... }` — `total` = `0`, `data` array kosong. Kalau error `relation "public.kontak_mitra" does not exist`, SQL di Task 1 belum dijalankan.

- [ ] **Step 5: Smoke test POST (bulk upsert)**

Run:
```powershell
$body = @{ rows = @(
  @('No.','NAMA','TYPE','PEMILIK','HP / Telepon'),
  @('1',' Independen 12 ','msi',' Budi  Santoso ','0812-3456-789'),
  @('2','BIR ALI','STK','','')
)} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/kontak-mitra" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
```
Expected: `@{ status = "success"; data = @{ saved = 2; skipped = 0 } }`

- [ ] **Step 6: Smoke test upsert idempoten**

Jalankan perintah Step 5 **lagi** dengan body yang sama, lalu GET lagi.
Expected: `saved = 2` lagi, dan `total` dari GET **tetap 2** (bukan 4) — membuktikan `on_conflict: nama_key` bekerja.

- [ ] **Step 7: Smoke test header tidak dikenal**

Run:
```powershell
$bad = @{ rows = @(@('Kolom A','Kolom B'), @('1','2')) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/kontak-mitra" -Method Post -ContentType "application/json" -Body $bad -TimeoutSec 60
```
Expected: `@{ status = "error"; message = "Header tidak dikenali. Pastikan baris pertama berisi kolom NAMA dan TYPE." }`

- [ ] **Step 8: Bersihkan data smoke test**

Run:
```powershell
Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/kontak-mitra" -Method Post -ContentType "application/json" -Body '{"clear":true}' -TimeoutSec 60
```
Expected: `@{ status = "success"; data = @{ cleared = True } }`, lalu GET mengembalikan `total = 0`.

- [ ] **Step 9: Jalankan test unit, harus tetap lolos**

Run: `node tests/kontak-mitra-backend.test.mjs`
Expected: `OK: semua tes backend kontak mitra lolos`

- [ ] **Step 10: Commit**

```bash
git add worker/src/routes/kontak-mitra.js worker/src/index.js
git commit -m "feat: endpoint kontak mitra (list, bulk upsert, hapus semua)"
```

---

## Task 3: Agregasi dua bulan + join kontak (backend Bandingkan Belanja)

Ini inti perhitungan. `product_prices` sengaja tidak dipakai.

**Files:**
- Create: `worker/src/routes/report-belanja-banding.js`
- Create: `tests/bandingkan-belanja-backend.test.mjs`
- Modify: `worker/src/index.js` (import + blok route)

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `detectTipe(tipeCustomer: string): 'MST' | 'MSI' | 'STK' | ''`
  - `computeBungkus(products: object): number`
  - `aggregateBulan(rows: object[], month: string): Map<string, { cabang, nama_customer, tipe, total }>`
  - `detectPunyaNama(groups: Map): boolean`
  - `mergeRows(mapIni: Map, mapBanding: Map, kontakMap: Map): object[]`
  - `buildNamaKeyClientSafe(tipeCustomer: string): string` — helper lokal yang meniru `buildNamaKey` untuk join, karena `report-belanja-banding.js` tidak mengimpor dari `kontak-mitra.js` (lihat catatan di Step 4).
  - `handle(db, month, banding): Promise<{ status, data }>`
  - Route `GET /api/report-belanja-banding?month=&banding=` di Worker.

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/bandingkan-belanja-backend.test.mjs`:

```js
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
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `node tests/bandingkan-belanja-backend.test.mjs`
Expected: FAIL dengan `ERR_MODULE_NOT_FOUND` untuk `report-belanja-banding.js`.

- [ ] **Step 3: Implementasikan agregasi & merge**

`worker/src/routes/report-belanja-banding.js`:

```js
// Perbandingan total produk dua bulan. Tanpa rupiah: product_prices tidak
// pernah disentuh. HU tidak dihitung ke total, sama seperti total_bungkus di
// report-belanja-stokis.js.

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Kode tipe yang berdiri sendiri sebagai "nama" -- artinya data bulan itu belum
// menyimpan nama mitra. Daftar eksak, bukan tebakan panjang karakter: "MST B"
// (5 karakter) adalah nama sungguhan dan TIDAK boleh ikut tertandai.
const KODE_TANPA_NAMA = new Set([
  'MST', 'MSI', 'STK', 'STOKIS', 'ORE', 'ORM', 'KARYAWAN', 'TSIEMPLOYEE', 'TSIAPPS', 'APPS',
]);

export function detectTipe(tipeCustomer) {
  const u = String(tipeCustomer == null ? '' : tipeCustomer).trim().toUpperCase();
  if (!u) return '';
  if (u.startsWith('MSI')) return 'MSI';
  if (u.startsWith('MST')) return 'MST';
  if (u.startsWith('STK') || u === 'STOKIS') return 'STK';
  return '';
}

export function computeBungkus(products) {
  if (!products || typeof products !== 'object') return 0;
  let total = 0;
  for (const [prodName, qty] of Object.entries(products)) {
    if (prodName === 'HU') continue;
    const n = Number(qty) || 0;
    if (n > 0) total += n;
  }
  return total;
}

export function aggregateBulan(rows, month) {
  const map = new Map();
  for (const r of rows) {
    if (!r || !r.tanggal || !r.tanggal.startsWith(month)) continue;
    const tipe = detectTipe(r.tipe_customer);
    if (!tipe) continue;

    const nama = r.tipe_customer;
    const key = `${r.cabang}||${nama}`;
    let g = map.get(key);
    if (!g) {
      g = { cabang: r.cabang, nama_customer: nama, tipe, total: 0 };
      map.set(key, g);
    }
    g.total += computeBungkus(r.products);
  }
  return map;
}

// Tanpa guard jumlah grup: begitu satu nama berupa kode telanjang, ada baris
// di bulan itu yang tidak akan punya pasangan, jadi perbandingannya sudah tidak
// akurat -- sekecil maupun sebanyak apa pun samplenya.
export function detectPunyaNama(groups) {
  if (!groups || groups.size === 0) return true;
  for (const g of groups.values()) {
    const u = String(g.nama_customer == null ? '' : g.nama_customer).trim().toUpperCase();
    if (u && KODE_TANPA_NAMA.has(u)) return false;
  }
  return true;
}

// Meniru buildNamaKey() di routes/kontak-mitra.js. Sengaja diduplikasi
// (bukan di-import) supaya file ini tidak bergantung pada route lain;
// normalisasi ini wajib identik di kedua sisi.
export function buildKontakKey(tipeCustomer) {
  return String(tipeCustomer == null ? '' : tipeCustomer).replace(/\s+/g, ' ').trim().toUpperCase();
}

export function mergeRows(mapIni, mapBanding, kontakMap) {
  const keys = new Set([...mapIni.keys(), ...mapBanding.keys()]);
  const rows = [];

  for (const key of keys) {
    const a = mapIni.get(key);
    const b = mapBanding.get(key);
    const src = a || b;
    const k = kontakMap && kontakMap.get(buildKontakKey(src.nama_customer));

    rows.push({
      cabang: src.cabang,
      nama_customer: src.nama_customer,
      tipe: src.tipe,
      pemilik: k ? k.pemilik : null,
      kontak: k ? k.kontak : null,
      ini_bungkus: a ? a.total : 0,
      banding_bungkus: b ? b.total : 0,
    });
  }

  return rows.sort((x, y) => {
    const cx = x.cabang || '', cy = y.cabang || '';
    if (cx !== cy) return cx.localeCompare(cy);
    return String(x.nama_customer).localeCompare(String(y.nama_customer));
  });
}

function namaBulan(ym) {
  const [yr, mo] = String(ym).split('-');
  return `${BULAN_NAMES[Number(mo) - 1] || mo} ${yr}`;
}

function lastDayOf(ym) {
  const [yr, mo] = ym.split('-');
  return new Date(Number(yr), Number(mo), 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym))) return false;
  const mo = Number(String(ym).split('-')[1]);
  return mo >= 1 && mo <= 12;
}

export async function handle(db, monthFilter, bandingFilter) {
  let bulanIni = monthFilter;
  if (!bulanIni) {
    const now = new Date();
    bulanIni = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
  let bulanBanding = bandingFilter;
  if (!bulanBanding) {
    const [yr, mo] = bulanIni.split('-');
    const d = new Date(Number(yr), Number(mo) - 2, 1);
    bulanBanding = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  if (!isMonth(bulanIni) || !isMonth(bulanBanding)) {
    return { status: 'error', message: 'Format bulan harus YYYY-MM' };
  }

  // Satu query untuk rentang dua bulan, bukan dua query terpisah.
  const bulanList = bulanIni === bulanBanding ? [bulanIni] : [bulanIni, bulanBanding];
  const urut = bulanList.slice().sort();
  const gte = `${urut[0]}-01`;
  const lteBulan = urut[urut.length - 1];
  const lte = `${lteBulan}-${pad(lastDayOf(lteBulan))}`;

  const rows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,products',
    gte: { tanggal: gte },
    lte: { tanggal: lte },
  });

  const mapIni = aggregateBulan(rows, bulanIni);
  // Bulan sama tidak boleh dihitung dua kali -> bulan banding sengaja dikosongkan.
  const mapBanding = bulanIni === bulanBanding ? new Map() : aggregateBulan(rows, bulanBanding);

  let kontakRows = [];
  try {
    kontakRows = await db.query('kontak_mitra', { select: 'nama_key,pemilik,kontak' });
  } catch (err) {
    // Tabel kontak belum ada -> tetap bisa bandingkan, kolom kontak null.
    kontakRows = [];
  }
  const kontakMap = new Map(kontakRows.map(c => [c.nama_key, c]));

  return {
    status: 'success',
    data: {
      bulan_ini: bulanIni,
      bulan_banding: bulanBanding,
      nama_bulan_ini: namaBulan(bulanIni),
      nama_bulan_banding: namaBulan(bulanBanding),
      punya_nama: bulanIni === bulanBanding ? true : detectPunyaNama(mapBanding),
      rows: mergeRows(mapIni, mapBanding, kontakMap),
    },
  };
}
```

- [ ] **Step 4: Jalankan test, harus lolos**

Run: `node tests/bandingkan-belanja-backend.test.mjs`
Expected: `OK: semua tes backend bandingkan belanja lolos`

Kalau ada assertion gagal di `mergeRows`, periksa bahwa `buildKontakKey` menyamakan spasi ganda dan letter-case dengan `buildNamaKey` di `kontak-mitra.js`.

- [ ] **Step 5: Registrasikan route**

Di `worker/src/index.js`, tambahkan import setelah `import * as kontakMitra ...`:

```js
import * as reportBelanjaBanding from './routes/report-belanja-banding.js';
```

Lalu tambahkan blok route tepat setelah blok `/api/report-belanja-stokis`:

```js
      if (path === '/api/report-belanja-banding') {
        const monthFilter = url.searchParams.get('month') || '';
        const bandingFilter = url.searchParams.get('banding') || '';
        return json(await reportBelanjaBanding.handle(db, monthFilter, bandingFilter));
      }
```

- [ ] **Step 6: Deploy Worker**

Run: `npx wrangler deploy`
Expected: `Published`.

- [ ] **Step 7: Smoke test September vs Agustus**

Run:
```powershell
$r = Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/report-belanja-banding?month=2026-09&banding=2026-08" -TimeoutSec 90
"bulan_ini=$($r.data.bulan_ini) nama=$($r.data.nama_bulan_ini)"
"bulan_banding=$($r.data.bulan_banding) nama=$($r.data.nama_bulan_banding)"
"punya_nama=$($r.data.punya_nama)  rows=$($r.data.rows.Count)"
$r.data.rows | Select-Object -First 5 | Format-Table cabang, nama_customer, tipe, pemilik, kontak, ini_bungkus, banding_bungkus -AutoSize
```
Expected:
- `nama_bulan_ini` = `September 2026`, `nama_bulan_banding` = `Agustus 2026`
- `punya_nama` = `False` (Agustus masih data kode)
- `rows` = `577`

Angka di bawah sudah diverifikasi langsung ke `penjualan_who` memakai query dan
agregasi yang sama persis dengan route ini, jadi Ini angka pastI, bukan tebakan:

| Nilai | Angka terverifikasi |
|---|---|
| Baris mentah `penjualan_who` 2026-08-01 s/d 2026-09-30 | 5.205 |
| Grup agregat Agustus 2026 | 29 |
| Grup agregat September 2026 | 548 |
| Baris union | 577 (548 + 29, nol tumpang tindih) |
| Total bungkus September 2026 | 1.024.944 |
| Distribusi tipe September | MSI 236, MST 70, STK 242 |
| Distribusi tipe Agustus | MSI 10, MST 9, STK 10 |

Tiga nilai berikut yang paling menentukan, karena hanya mereka yang membuktikan
aturan penggabungan benar-benar bekerja:

```powershell
"hanya di Sep : $(($r.data.rows | Where-Object { $_.banding_bungkus -eq 0 }).Count)"
"hanya di Agu : $(($r.data.rows | Where-Object { $_.ini_bungkus -eq 0 }).Count)"
"pasangan    : $(($r.data.rows | Where-Object { $_.ini_bungkus -gt 0 -and $_.banding_bungkus -gt 0 }).Count)"
```

Expected:
- `hanya di Sep` = `548`
- `hanya di Agu` = `29`
- `pasangan` = **`0`**

Nol pasangan itu bukan bug, melainkan kondisi data yang apa adanya: Agustus
masih disimpan sebagai kode `MST`/`MSI`/`STK` sedangkan September sebagai nama
asli, jadi tidak satu baris pun bisa dipasangkan. Angka itulah yang sampai ke
user, dan justru itu sebabnya banner peringatan di Task 5 Step 11 wajib ada --
perbandingannya memang belum akurat. Sebaliknya, kalau muncul ratusan baris
berpasangan, berarti `aggregateBulan` atau `mergeRows` salah dan harus dicek
ulang.

- Baris contoh memuat `tipe` = `MSI`/`MST`/`STK` saja, `pemilik`/`kontak` = kosong (kontak_mitra masih kosong setelah Task 2 Step 8)
- Tidak ada baris dengan `tipe` kosong

- [ ] **Step 8: Smoke test bulan sama**

Run:
```powershell
$s = Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/report-belanja-banding?month=2026-09&banding=2026-09" -TimeoutSec 90
"punya_nama=$($s.data.punya_nama) rows=$($s.data.rows.Count) band_total=$((($s.data.rows | Measure-Object banding_bungkus -Sum).Sum))"
```
Expected: `punya_nama = True`, `band_total = 0` — membuktikan tidak ada pengali ganda.

- [ ] **Step 9: Smoke test join kontak**

Run:
```powershell
$c = Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/kontak-mitra" -Method Post -ContentType "application/json" -Body '{"rows":[["No.","NAMA","TYPE","PEMILIK","HP / Telepon"],["1","Independen 12","MSI","Budi Santoso","08123456789"]]}' -TimeoutSec 60
$j = Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/report-belanja-banding?month=2026-09&banding=2026-08" -TimeoutSec 90
$j.data.rows | Where-Object { $_.nama_customer -like 'MSI Independen 12*' } | Select-Object nama_customer, tipe, pemilik, kontak | Format-Table -AutoSize
```
Expected: baris `MSI Independen 12` (dan turunannya) menampilkan `pemilik = Budi Santoso`, `kontak = 08123456789`. Kalau `null`, `nama_key` di `kontak_mitra` tidak cocok dengan normalisasi `tipe_customer` — cek spasi/letter-case.

- [ ] **Step 10: Bersihkan data smoke test**

Run:
```powershell
Invoke-RestMethod -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/kontak-mitra" -Method Post -ContentType "application/json" -Body '{"clear":true}' -TimeoutSec 60
```
Expected: `cleared = True`.

- [ ] **Step 11: Pastikan semua testbackend masih lolos**

Run:
```powershell
node tests/rekap-belanja-backend.test.mjs
node tests/kontak-mitra-backend.test.mjs
node tests/bandingkan-belanja-backend.test.mjs
```
Expected: ketiga baris `OK: ... lolos`.

- [ ] **Step 12: Commit**

```bash
git add worker/src/routes/report-belanja-banding.js worker/src/index.js tests/bandingkan-belanja-backend.test.mjs
git commit -m "feat: endpoint bandingkan belanja (total produk dua bulan, join kontak mitra)"
```

---

## Task 4: Menu "Kontak Mitra" (UI)

Endpoint-nya sudah ada; task ini hanya menambah lapisan UI untuk mengisinya.

**Files:**
- Modify: `index.html` (menu + view)
- Modify: `dashboard.html` (menu saja)
- Modify: `src/config/routes.js`
- Modify: `src/events/sidebarEvents.js`
- Create: `src/modules/kontakMitra/kontakMitra.js`
- Modify: `src/router.js`

**Interfaces:**
- Consumes: `getKontakMitra`, `simpanKontakMitra`, `hapusKontakMitra` via `callApi` (didaftarkan di `src/config/routes.js` pada langkah yang sama).
- Produces: `initKontakMitra(): void`, `kontakToRows(text: string): string[][]`, `saveKontakMitra()`, `hapusKontakMitra()`.

- [ ] **Step 1: Tambah 3 entri API**

`src/config/routes.js` — di dalam `READ`, tambahkan setelah baris `getRekapBelanja`:

```js
  getKontakMitra: { url: '/api/kontak-mitra', params: [] },
```

dan di dalam `WRITE`, tambahkan setelah `savePrices`:

```js
  simpanKontakMitra: { url: '/api/kontak-mitra', params: ['rows'] },
  hapusKontakMitra: { url: '/api/kontak-mitra', params: ['clear'] },
```

- [ ] **Step 2: Tambahkan menu di `index.html`**

Di dalam blok `STOK & ORDER` (sebelum `menu-input-stok-excel` pada baris 112), tambahkan:

```html
          <div id="menu-kontak-mitra" class="sidebar-item-sub">
            <i class="fas fa-address-book w-4 text-center"></i><span>Kontak Mitra</span>
          </div>
```

Menu ini memakai `sidebar-item-sub` (berbeda dari `menu-rekap-belanja`) supaya `setActiveMenu()` di `router.js` memakai jalur `.active` yang sudah benar.

- [ ] **Step 3: Tambahkan view di `index.html``

Tambahkan setelah penutup `</div>` view Rekap Belanja (baris 487), sebelum view berikutnya:

```html
    <!-- Kontak Mitra View -->
    <div id="kontak-mitra-view" class="hidden space-y-6">
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div class="flex items-center gap-2 mb-3">
          <i class="fas fa-address-book text-emerald-600"></i>
          <h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider">Kontak Mitra</h3>
        </div>
        <p id="kontak-hint" class="text-xs text-slate-500 mb-3">
          Salin blok dari Excel lalu tempel di bawah. Header wajib: <span class="font-mono font-semibold text-slate-700">NAMA</span>, <span class="font-mono font-semibold text-slate-700">TYPE</span>, <span class="font-mono font-semibold text-slate-700">PEMILIK</span>, <span class="font-mono font-semibold text-slate-700">HP / Telepon</span>. Kolom <span class="font-mono">No.</span> diabaikan.
        </p>
        <textarea id="kontak-textarea" rows="8" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="No.	NAMA	TYPE	PEMILIK	HP / Telepon&#10;1	MSI Independen 12	MSI	Budi Santoso	08123456789"></textarea>
        <div class="flex flex-wrap items-center gap-3 mt-3">
          <button id="btn-kontak-simpan" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all text-sm flex items-center gap-2">
            <i class="fas fa-save"></i> Simpan Kontak
          </button>
          <button id="btn-kontak-hapus" class="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2">
            <i class="fas fa-trash"></i> Hapus Semua
          </button>
          <span id="kontak-status" class="text-sm font-semibold text-slate-500"></span>
        </div>
      </div>

      <div id="kontak-loader" class="hidden flex-col items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mb-4"></div>
        <p class="text-slate-500 font-semibold animate-pulse">Menarik data kontak...</p>
      </div>

      <div id="kontak-content" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Tersimpan</span>
          <span id="kontak-count" class="text-xs font-bold text-slate-700">0 kontak</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 text-left">No</th>
                <th class="px-4 py-3 text-left">NAMA</th>
                <th class="px-4 py-3 text-left">TYPE</th>
                <th class="px-4 py-3 text-left">PEMILIK</th>
                <th class="px-4 py-3 text-left">HP / Telepon</th>
              </tr>
            </thead>
            <tbody id="kontak-tbody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Tambah menu di `dashboard.html`**

Cari blok `STOK & ORDER` di `dashboard.html` dan sisipkan menu yang sama sebelum `menu-input-stok-excel`:

```html
          <div id="menu-kontak-mitra" class="sidebar-item-sub">
            <i class="fas fa-address-book w-4 text-center"></i><span>Kontak Mitra</span>
          </div>
```

View-nya **tidak** ditambahkan ke `dashboard.html` — file itu sudah tertinggal dan bukan target deploy. Menu tanpa view aman karena `MENU_IDS` memasang listener dengan penjaga `if (el)`.

- [ ] **Step 5: Daftar di `MENU_IDS`**

`src/events/sidebarEvents.js` — ubah baris 10:

```js
  'best-products', 'rekap-belanja', 'kontak-mitra', 'pengaturan', 'chat-ai'
```

- [ ] **Step 6: Kabela router**

`src/router.js` — tambahkan dua `const` setelah baris 107 (`const menuFormOrder`):

```js
  const menuKontakMitra = document.getElementById('menu-kontak-mitra');
  const kontakMitraView = document.getElementById('kontak-mitra-view');
```

Setelah baris 139 (`if (formOrderView) formOrderView.classList.add('hidden');`) tambahkan:

```js
  if (kontakMitraView) kontakMitraView.classList.add('hidden');
```

Dan tambahkan `menuKontakMitra` ke array `allMenus` (baris 157):

```js
    menuRekapBelanja, menuFormOrder, menuPenerimaanCabang, menuMutasi, menuRetur, menuRiwayatTransaksi,
    menuKontakMitra];
```

- [ ] **Step 7: Tambah cabang router**

`src/router.js` — tambahkan sebelum `else { // 'distribusi'` (baris 345):

```js
  else if (menuName === 'kontak-mitra') {
    if (kontakMitraView) kontakMitraView.classList.remove('hidden');
    pageTitle.innerText = "Kontak Mitra";
    pageIcon.className = "fas fa-address-book";
    setActiveMenu(menuKontakMitra);
    const kcBody = document.getElementById('kontak-tbody');
    if (!kcBody || kcBody.innerHTML.trim() === '') {
      import('./modules/kontakMitra/kontakMitra.js').then(m => m.initKontakMitra());
    }
  }
```

- [ ] **Step 8: Implementasikan modul**

`src/modules/kontakMitra/kontakMitra.js`:

```js
import { callApi } from '../../services/api.js';

let allKontak = [];

// Potong teks jadi array baris x kolom. Tab adalah pemisah kolom (hasil
// paste dari Excel), koma atau titik koma hanya jadi pemisah bila tidak
// ada tab sama sekali.
export function kontakToRows(text) {
  return text.split('\n')
    .map(r => r.replace(/\r$/, ''))
    .filter(r => r.trim() !== '')
    .map(r => (r.includes('\t') ? r.split('\t') : r.split(/[;,]/)));
}

function setStatus(msg, cls) {
  const el = document.getElementById('kontak-status');
  el.textContent = msg;
  el.className = 'text-sm font-semibold ' + cls;
}

function renderKontak() {
  const tbody = document.getElementById('kontak-tbody');
  document.getElementById('kontak-count').textContent = allKontak.length + ' kontak';

  if (allKontak.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Belum ada data kontak. Tempel blok dari Excel lalu klik Simpan.</td></tr>';
    return;
  }

  let html = '';
  allKontak.forEach((k, i) => {
    html += `<tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-2 text-slate-400 font-mono">${i + 1}</td>
      <td class="px-4 py-2 font-bold text-slate-700 whitespace-nowrap">${k.nama}</td>
      <td class="px-4 py-2 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${
        k.type === 'MST' ? 'bg-amber-100 text-amber-700'
        : k.type === 'MSI' ? 'bg-purple-100 text-purple-700'
        : 'bg-blue-100 text-blue-700'}">${k.type}</span></td>
      <td class="px-4 py-2 text-slate-600 whitespace-nowrap">${k.pemilik || '<span class="text-slate-300">—</span>'}</td>
      <td class="px-4 py-2 text-slate-600 font-mono whitespace-nowrap">${k.kontak || '<span class="text-slate-300">—</span>'}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function loadKontak() {
  const loader = document.getElementById('kontak-loader');
  loader.classList.remove('hidden');
  loader.classList.add('flex');

  return callApi('getKontakMitra')
    .then(res => {
      allKontak = res.data || [];
      renderKontak();
    })
    .catch(err => setStatus('Gagal memuat kontak: ' + err.message, 'text-red-600'))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    });
}

export function saveKontakMitra() {
  const raw = document.getElementById('kontak-textarea').value.trim();

  if (!raw) {
    setStatus('Area paste masih kosong.', 'text-amber-600');
    return;
  }

  const rows = kontakToRows(raw);
  if (rows.length < 2) {
    setStatus('Minimal 2 baris (header + 1 data).', 'text-amber-600');
    return;
  }

  const header = rows[0].join(' ').toUpperCase();
  if (header.indexOf('NAMA') < 0 || header.indexOf('TYPE') < 0) {
    setStatus('Header tidak dikenali. Pastikan baris pertama berisi kolom NAMA dan TYPE.', 'text-amber-600');
    return;
  }

  const loader = document.getElementById('kontak-loader');
  loader.classList.remove('hidden');
  loader.classList.add('flex');

  callApi('simpanKontakMitra', rows)
    .then(res => {
      const d = res.data || {};
      setStatus('Berhasil menyimpan ' + d.saved + ' kontak' +
        (d.skipped > 0 ? ', ' + d.skipped + ' baris dilewati.' : '.'), 'text-emerald-600');
      document.getElementById('kontak-textarea').value = '';
      return loadKontak();
    })
    .catch(err => setStatus(err.message, 'text-red-600'))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    });
}

export function hapusKontakMitra() {
  if (!confirm('Hapus SEMUA data kontak mitra? Tindakan ini tidak bisa dibatalkan.')) return;

  const loader = document.getElementById('kontak-loader');
  loader.classList.remove('hidden');
  loader.classList.add('flex');

  callApi('hapusKontakMitra', true)
    .then(() => {
      setStatus('Semua data kontak dihapus.', 'text-emerald-600');
      return loadKontak();
    })
    .catch(err => setStatus(err.message, 'text-red-600'))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    });
}

export function initKontakMitra() {
  document.getElementById('btn-kontak-simpan').addEventListener('click', saveKontakMitra);
  document.getElementById('btn-kontak-hapus').addEventListener('click', hapusKontakMitra);
  setStatus('', 'text-slate-500');
  loadKontak();
}
```

- [ ] **Step 9: Cek sintaks semua file JS yang diubah**

Run:
```powershell
node --check src/modules/kontakMitra/kontakMitra.js
node --check src/router.js
node --check src/events/sidebarEvents.js
node --check src/config/routes.js
```
Expected: tidak ada output (semua lolos).

- [ ] **Step 10: Commit**

```bash
git add index.html dashboard.html src/config/routes.js src/events/sidebarEvents.js src/router.js src/modules/kontakMitra/kontakMitra.js
git commit -m "feat: menu Kontak Mitra (paste excel, simpan, hapus semua)"
```

---

## Task 5: Menu "Bandingkan Belanja" — tabel & ▲/▼

Tabel saja; export Excel di Task 6.

**Files:**
- Create: `src/modules/reports/bandingkanBelanja.js`
- Modify: `index.html` (menu + view)
- Modify: `dashboard.html` (menu saja)
- Modify: `src/config/routes.js`
- Modify: `src/events/sidebarEvents.js`
- Modify: `src/router.js`

**Interfaces:**
- Consumes: `getBandingkanBelanja` via `callApi`; `report-belanja-banding.handle` dari Task 3.
- Produces:
  - `hitungSelisih(baris: { ini_bungkus: number, banding_bungkus: number }): { selisih: number, persen: number|null, tren: 'baru'|'berhenti'|'naik'|'turun'|'tetap' }`
  - `groupPerCabang(items: object[], sortKey: string): { cabang: string, items: object[] }[]`
  - `initBandingkanBelanja(): void`
  - `loadBandingkanBelanja(): Promise<void>`
  - State modul: `let state = { bulanIni, bulanBanding, namaBulanIni, namaBulanBanding, punyaNama, rows, sortKey, sortDir }` — dipakai Task 6 untuk export.

- [ ] **Step 1: Tambah entri API**

`src/config/routes.js` — di `READ`, tambahkan setelah `getKontakMitra`:

```js
  getBandingkanBelanja: { url: '/api/report-belanja-banding', params: ['month', 'banding'] },
```

- [ ] **Step 2: Tambahkan menu di `index.html`**

Di dalam blok `LAPORAN`, tepat setelah penutup `menu-rekap-belanja` (baris 154), tambahkan:

```html
          <div id="menu-bandingkan-belanja" class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 hover:text-white rounded-xl font-medium transition-colors text-slate-400 cursor-pointer text-xs">
            <i class="fas fa-right-left w-4 text-center"></i><span>Bandingkan Belanja</span>
          </div>
```

Kelas inline (bukan `sidebar-item-sub`) mengikuti `menu-rekap-belanja` supaya `setActiveMenu()` memakai styling hijau yang sama.

- [ ] **Step 3: Tambahkan view di `index.html`**

Tambahkan setelah penutup view Kontak Mitra:

```html
    <!-- Bandingkan Belanja View -->
    <div id="bandingkan-belanja-view" class="hidden space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bulan Ini</label>
            <input type="month" id="banding-month-ini" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">vs Bulan Banding</label>
            <input type="month" id="banding-month-banding" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cabang</label>
            <select id="banding-branch" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="ALL">Semua Cabang</option>
            </select>
          </div>
          <button id="btn-banding-refresh" class="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"><i class="fas fa-sync-alt mr-2"></i>Terapkan</button>
        </div>
        <button id="btn-banding-export" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all text-sm flex items-center gap-2">
          <i class="fas fa-file-excel"></i> Export Excel
        </button>
      </div>

      <div id="banding-warning" class="hidden items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
        <i class="fas fa-exclamation-triangle mt-0.5"></i>
        <p id="banding-warning-text" class="text-sm font-semibold"></p>
      </div>

      <div id="banding-loader" class="hidden flex-col items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mb-4"></div>
        <p class="text-slate-500 font-semibold animate-pulse">Menarik data transaksi...</p>
      </div>

      <div id="banding-content" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead id="banding-thead" class="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200"></thead>
            <tbody id="banding-tbody" class="divide-y divide-slate-100"></tbody>
            <tfoot id="banding-tfoot" class="bg-slate-50 font-bold text-slate-800 border-t border-slate-200"></tfoot>
          </table>
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Tambah menu di `dashboard.html`**

Sisipkan di blok `LAPORAN`, setelah `menu-rekap-belanja`:

```html
          <div id="menu-bandingkan-belanja" class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 hover:text-white rounded-xl font-medium transition-colors text-slate-400 cursor-pointer text-xs">
            <i class="fas fa-right-left w-4 text-center"></i><span>Bandingkan Belanja</span>
          </div>
```

- [ ] **Step 5: Daftar di `MENU_IDS`**

`src/events/sidebarEvents.js` — ubah baris 10:

```js
  'best-products', 'rekap-belanja', 'bandingkan-belanja', 'kontak-mitra', 'pengaturan', 'chat-ai'
```

- [ ] **Step 6: Kabela router**

`src/router.js` — setelah baris 107 (`const menuFormOrder`) tambahkan:

```js
  const menuBandingkanBelanja = document.getElementById('menu-bandingkan-belanja');
  const bandingkanBelanjaView = document.getElementById('bandingkan-belanja-view');
```

Setelah baris `if (kontakMitraView) kontakMitraView.classList.add('hidden');` (dari Task 4) tambahkan:

```js
  if (bandingkanBelanjaView) bandingkanBelanjaView.classList.add('hidden');
```

Tambahkan `menuBandingkanBelanja` ke array `allMenus`:

```js
    menuKontakMitra, menuBandingkanBelanja];
```

- [ ] **Step 7: Tambah cabang router**

Sebelum `else { // 'distribusi'`, tambahkan:

```js
  else if (menuName === 'bandingkan-belanja') {
    if (bandingkanBelanjaView) bandingkanBelanjaView.classList.remove('hidden');
    pageTitle.innerText = "Bandingkan Belanja";
    pageIcon.className = "fas fa-right-left";
    setActiveMenu(menuBandingkanBelanja);
    const bbBody = document.getElementById('banding-tbody');
    if (!bbBody || bbBody.innerHTML.trim() === '') {
      import('./modules/reports/bandingkanBelanja.js').then(m => m.initBandingkanBelanja());
    }
  }
```

- [ ] **Step 8: Implementasikan modul**

`src/modules/reports/bandingkanBelanja.js`:

```js
import { callApi } from '../../services/api.js';

let state = {
  bulanIni: '',
  bulanBanding: '',
  namaBulanIni: '',
  namaBulanBanding: '',
  punyaNama: true,
  rows: [],
  sortKey: 'selisih',
  sortDir: -1,
};

// Jumlah kolom: Nama, Tipe, Cabang, Pemilik, Kontak, Total Ini,
// Total Banding, Selisih, %, Tren. Kolom Pemilik+Kontak disembunyikan
// saat punyaNama === false, jadi 8 kolom.
function kolomAktif() {
  return state.punyaNama ? 10 : 8;
}

export function hitungSelisih(baris) {
  const ini = Number(baris.ini_bungkus) || 0;
  const banding = Number(baris.banding_bungkus) || 0;
  const selisih = ini - banding;

  if (banding === 0 && ini > 0) return { selisih, persen: null, tren: 'baru' };
  if (ini === 0 && banding > 0) return { selisih, persen: -100, tren: 'berhenti' };
  if (banding === 0 && ini === 0) return { selisih: 0, persen: null, tren: 'tetap' };

  return {
    selisih,
    persen: (selisih / banding) * 100,
    tren: selisih > 0 ? 'naik' : selisih < 0 ? 'turun' : 'tetap',
  };
}

const TREN = {
  baru:     { simbol: '▲', warna: 'text-emerald-600', label: 'Naik' },
  naik:     { simbol: '▲', warna: 'text-emerald-600', label: 'Naik' },
  turun:    { simbol: '▼', warna: 'text-red-600', label: 'Turun' },
  berhenti: { simbol: '▼', warna: 'text-red-600', label: 'Berhenti' },
  tetap:    { simbol: '=', warna: 'text-slate-400', label: 'Sama' },
};

function nilaiSort(item, key) {
  if (key === 'ini_bungkus' || key === 'banding_bungkus') return Number(item[key]) || 0;
  return hitungSelisih(item).selisih;
}

export function groupPerCabang(items, sortKey) {
  const map = {};
  for (const r of items) {
    const cab = r.cabang || '(TANPA CABANG)';
    if (!map[cab]) map[cab] = [];
    map[cab].push(r);
  }
  const dir = state.sortDir;
  return Object.keys(map).sort().map(cab => ({
    cabang: cab,
    items: map[cab].sort((a, b) => {
      const d = nilaiSort(a, sortKey) - nilaiSort(b, sortKey);
      if (d !== 0) return d * dir;
      return String(a.nama_customer).localeCompare(String(b.nama_customer));
    }),
  }));
}

function populateBranchFilter() {
  const sel = document.getElementById('banding-branch');
  const cabang = [...new Set(state.rows.map(r => r.cabang).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">Semua Cabang</option>';
  cabang.forEach(c => sel.add(new Option(c, c)));
}

function getFiltered() {
  const v = document.getElementById('banding-branch').value;
  return v === 'ALL' ? state.rows : state.rows.filter(r => r.cabang === v);
}

function sortIndicator(key) {
  if (state.sortKey !== key) return '';
  return state.sortDir === -1 ? ' &#9660;' : ' &#9650;';
}

function renderWarning() {
  const box = document.getElementById('banding-warning');
  const txt = document.getElementById('banding-warning-text');
  if (state.punyaNama) {
    box.classList.add('hidden');
    box.classList.remove('flex');
    return;
  }
  txt.textContent = 'Bulan pembanding (' + state.namaBulanBanding +
    ') masih memakai data tanpa nama mitra, sehingga selisih per mitra tidak akurat. ' +
    'Pilih bulan yang sudah berisi nama.';
  box.classList.remove('hidden');
  box.classList.add('flex');
}

function renderBanding() {
  renderWarning();

  const thead = document.getElementById('banding-thead');
  const tbody = document.getElementById('banding-tbody');
  const tfoot = document.getElementById('banding-tfoot');
  const cols = kolomAktif();

  const thSort = (key, label, extra) =>
    `<th data-sort="${key}" class="px-4 py-3 ${extra} cursor-pointer select-none hover:bg-slate-100">${label}${sortIndicator(key)}</th>`;

  let headHtml = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Nama</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Tipe</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Cabang</th>`;
  if (state.punyaNama) {
    headHtml += `<th class="px-4 py-3 text-left whitespace-nowrap">Pemilik</th>
      <th class="px-4 py-3 text-left whitespace-nowrap">Kontak</th>`;
  }
  headHtml += thSort('ini_bungkus', 'Total ' + state.namaBulanIni, 'text-right')
    + thSort('banding_bungkus', 'Total ' + state.namaBulanBanding, 'text-right')
    + thSort('selisih', 'Selisih', 'text-right')
    + `<th class="px-4 py-3 text-right whitespace-nowrap">%</th>
    <th class="px-4 py-3 text-center whitespace-nowrap">Tren</th></tr>`;
  thead.innerHTML = headHtml;

  thead.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (state.sortKey === key) state.sortDir = -state.sortDir;
      else { state.sortKey = key; state.sortDir = -1; }
      renderBanding();
    });
  });

  const filtered = getFiltered();
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + cols +
      '" class="px-4 py-8 text-center text-slate-500">Tidak ada data belanja pada bulan yang dipilih.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  const redup = state.punyaNama ? '' : 'opacity-50';
  const title = 'Selisih tidak akurat: bulan pembanding memakai data tanpa nama mitra.';
  const num = n => Number(n || 0).toLocaleString('id-ID');
  const badge = t => {
    const cls = t === 'MST' ? 'bg-amber-100 text-amber-700'
      : t === 'MSI' ? 'bg-purple-100 text-purple-700'
      : 'bg-blue-100 text-blue-700';
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${cls}">${t}</span>`;
  };

  const sections = groupPerCabang(filtered, state.sortKey);
  let bodyHtml = '';
  let grandIni = 0, grandBanding = 0, grandSelisih = 0;

  sections.forEach(sec => {
    let cabIni = 0, cabBanding = 0;
    bodyHtml += `<tr class="bg-slate-800 text-white">
      <td colspan="${cols}" class="px-4 py-2 font-bold uppercase tracking-wider">=== CABANG: ${sec.cabang} ===</td>
    </tr>`;

    sec.items.forEach(item => {
      const s = hitungSelisih(item);
      const tr = TREN[s.tren];
      cabIni += item.ini_bungkus;
      cabBanding += item.banding_bungkus;
      grandIni += item.ini_bungkus;
      grandBanding += item.banding_bungkus;
      grandSelisih += s.selisih;

      bodyHtml += `<tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-2 font-bold text-slate-700 whitespace-nowrap">${item.nama_customer}</td>
        <td class="px-4 py-2 whitespace-nowrap">${badge(item.tipe)}</td>
        <td class="px-4 py-2 text-slate-600 whitespace-nowrap">${item.cabang || '(TANPA CABANG)'}</td>`;

      if (state.punyaNama) {
        const pemilik = item.pemilik
          ? `<span class="text-slate-600">${item.pemilik}</span>`
          : '<span class="text-slate-300">—</span>';
        const kontak = item.kontak
          ? `<a href="https://wa.me/${String(item.kontak).replace(/\D/g, '')}" target="_blank" rel="noopener" class="text-emerald-600 hover:underline font-mono">${item.kontak}</a>`
          : '<span class="text-slate-300">—</span>';
        bodyHtml += `<td class="px-4 py-2 whitespace-nowrap">${pemilik}</td>
          <td class="px-4 py-2 whitespace-nowrap">${kontak}</td>`;
      }

      const persenTxt = s.persen === null ? '—'
        : (s.persen > 0 ? '+' : '') + s.persen.toFixed(1) + '%';

      bodyHtml += `<td class="px-4 py-2 text-right font-mono text-slate-700">${num(item.ini_bungkus)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-500">${num(item.banding_bungkus)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold ${tr.warna} ${redup}" title="${title}">${tr.simbol} ${s.selisih > 0 ? '+' : ''}${num(s.selisih)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold ${tr.warna} ${redup}" title="${title}">${persenTxt}</td>
        <td class="px-4 py-2 text-center font-bold ${tr.warna} ${redup}" title="${title}">${tr.simbol}<span class="sr-only">${tr.label}</span></td>
      </tr>`;
    });

    bodyHtml += `<tr class="bg-slate-100 font-bold text-sm">
      <td colspan="3" class="px-4 py-2 uppercase tracking-wider">SUBTOTAL CABANG ${sec.cabang}</td>`;
    if (state.punyaNama) bodyHtml += `<td colspan="2"></td>`;
    bodyHtml += `<td class="px-4 py-2 text-right font-mono">${num(cabIni)}</td>
      <td class="px-4 py-2 text-right font-mono">${num(cabBanding)}</td>
      <td class="px-4 py-2 text-right font-mono">${cabIni - cabBanding > 0 ? '+' : ''}${num(cabIni - cabBanding)}</td>
      <td colspan="2"></td></tr>`;
  });

  tbody.innerHTML = bodyHtml;

  tfoot.innerHTML = `<tr>
    <td colspan="3" class="px-4 py-3 text-right uppercase tracking-wider">GRAND TOTAL KESELURUHAN</td>
    ${state.punyaNama ? '<td colspan="2"></td>' : ''}
    <td class="px-4 py-3 text-right font-mono">${num(grandIni)}</td>
    <td class="px-4 py-3 text-right font-mono">${num(grandBanding)}</td>
    <td class="px-4 py-3 text-right font-mono">${grandSelisih > 0 ? '+' : ''}${num(grandSelisih)}</td>
    <td colspan="2"></td></tr>`;
}

export function loadBandingkanBelanja() {
  const bulanIni = document.getElementById('banding-month-ini').value;
  const bulanBanding = document.getElementById('banding-month-banding').value;

  if (!bulanIni || !bulanBanding) {
    alert('Pilih Bulan Ini dan Bulan Banding terlebih dahulu.');
    return Promise.resolve();
  }

  const loader = document.getElementById('banding-loader');
  const content = document.getElementById('banding-content');
  loader.classList.remove('hidden');
  loader.classList.add('flex');
  content.classList.add('hidden');

  return callApi('getBandingkanBelanja', bulanIni, bulanBanding)
    .then(res => {
      const d = res.data || {};
      state.bulanIni = d.bulan_ini || bulanIni;
      state.bulanBanding = d.bulan_banding || bulanBanding;
      state.namaBulanIni = d.nama_bulan_ini || bulanIni;
      state.namaBulanBanding = d.nama_bulan_banding || bulanBanding;
      state.punyaNama = d.punya_nama !== false;
      state.rows = d.rows || [];
      state.sortKey = 'selisih';
      state.sortDir = -1;
      populateBranchFilter();
      renderBanding();
    })
    .catch(err => {
      alert('Gagal memuat perbandingan belanja: ' + err.message);
    })
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    });
}

export function initBandingkanBelanja() {
  const iniEl = document.getElementById('banding-month-ini');
  const bandingEl = document.getElementById('banding-month-banding');

  const now = new Date();
  if (iniEl && !iniEl.value) {
    iniEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  if (bandingEl && !bandingEl.value) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    bandingEl.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  document.getElementById('btn-banding-refresh').addEventListener('click', loadBandingkanBelanja);
  document.getElementById('banding-branch').addEventListener('change', renderBanding);

  loadBandingkanBelanja();
}
```

**Catatan Task 6:** tombol `btn-banding-export` sengaja **belum** punya listener di langkah ini; Task 6 yang menambahkannya.

- [ ] **Step 9: Cek sintaks**

Run: `node --check src/modules/reports/bandingkanBelanja.js`
Expected: tidak ada output.

- [ ] **Step 10: Deploy frontend**

Run: `npx wrangler pages deploy . --project-name undistribusidanpenjualantsi`
Expected: `Deployment complete!`

- [ ] **Step 11: Verifikasi manual di browser**

Buka `https://distribusidanpenjualantsi.pages.dev`, login, lalu:
1. Klik menu **Bandingkan Belanja** di grup LAPORAN. Title halaman = "Bandingkan Belanja", ikon `fa-right-left`.
2. `Bulan Ini` terisi `2026-09`, `Bulan Banding` terisi `2026-08` (bulan sebelumnya).
3. Klik **Terapkan** → tabel muncul, kelompok per cabang, ada `SUBTOTAL CABANG` dan `GRAND TOTAL KESELURUHAN`.
4. Banner **kuning** tampil karena Agustus belum punya nama; kolom **Pemilik** dan **Kontak** tidak ada; kolom `Selisih`/`%`/`Tren` redup (opacity).
5. Kolom `Tren` hanya berisi `▲` / `▼` / `=`.
6. Klik header `Selisih` → urut berubah; klik lagi → arah berbalik.
7. Ubah dropdown **Cabang** ke cabang tertentu → tabel ter-render ulang tanpa request baru (panel `Network` di devtools harus tetap kosong).
8. Pilih `Bulan Banding` = `2026-09` (sama dengan Bulan Ini) → klik Terapkan → banner **hilang**, kolom Pemilik/Kontak **muncul**, semua `Total Bulan Banding` = `0`, semua Tren `▲`.

- [ ] **Step 12: Commit**

```bash
git add index.html dashboard.html src/config/routes.js src/events/sidebarEvents.js src/router.js src/modules/reports/bandingkanBelanja.js
git commit -m "feat: menu Bandingkan Belanja (total produk dua bulan, tren naik/turun)"
```

---

## Task 6: Export Excel Bandingkan Belanja

Nama file dinamis adalah seluruh point of task ini.

**Files:**
- Modify: `src/modules/reports/bandingkanBelanja.js` (tambah `exportBandingkanBelanja` + import)

**Interfaces:**
- Consumes: `state` modul & `groupPerCabang()` dari Task 5.
- Produces: `exportBandingkanBelanja(): void` — terpasang ke `#btn-banding-export`.

- [ ] **Step 1: Tambahkan import `showToast`**

Di bagian atas `src/modules/reports/bandingkanBelanja.js`, ubah baris import:

```js
import { callApi } from '../../services/api.js';
import { showToast } from '../../ui/toast.js';
```

- [ ] **Step 2: Tambahkan `exportBandingkanBelanja`**

Tambahkan di akhir file:

```js
const BULAN_NAMES = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI',
                     'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

// "2026-08" -> "AGUSTUS 2026"
function bulanTeks(ym, names) {
  const list = names || BULAN_NAMES;
  const [yr, mo] = String(ym).split('-');
  return `${list[Number(mo) - 1] || mo} ${yr}`;
}

export function exportBandingkanBelanja() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }

  const filtered = getFiltered();
  if (filtered.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const cabangFilter = document.getElementById('banding-branch').value;
  const cabangHeader = cabangFilter === 'ALL' ? 'SEMUA CABANG' : cabangFilter;
  const kolom = kolomAktif();

  const rows = [];
  rows.push(['PT TRIDAYA SINERGI INDONESIA']);
  rows.push([`PERBANDINGAN BELANJA ${cabangHeader}`]);
  rows.push([`BULAN INI: ${bulanTeks(state.bulanIni)}`]);
  rows.push([`BULAN BANDING: ${bulanTeks(state.bulanBanding)}`]);
  rows.push([]);

  const header = ['NAMA', 'TIPE', 'CABANG'];
  if (state.punyaNama) header.push('PEMILIK', 'HP / TELEPON');
  header.push(
    `TOTAL ${bulanTeks(state.bulanIni)}`,
    `TOTAL ${bulanTeks(state.bulanBanding)}`,
    'SELISIH', '%', 'TREN'
  );
  rows.push(header);

  const sections = groupPerCabang(filtered, state.sortKey);
  let grandIni = 0, grandBanding = 0, grandSelisih = 0;

  sections.forEach(sec => {
    rows.push([`=== CABANG: ${sec.cabang} ===`]);
    let cabIni = 0, cabBanding = 0;

    sec.items.forEach(item => {
      const s = hitungSelisih(item);
      cabIni += item.ini_bungkus;
      cabBanding += item.banding_bungkus;
      grandIni += item.ini_bungkus;
      grandBanding += item.banding_bungkus;
      grandSelisih += s.selisih;

      const row = [item.nama_customer, item.tipe, item.cabang || '(TANPA CABANG)'];
      if (state.punyaNama) row.push(item.pemilik || '', item.kontak || '');
      row.push(
        item.ini_bungkus,
        item.banding_bungkus,
        s.selisih,
        s.persen === null ? '' : Number(s.persen.toFixed(1)),
        TREN[s.tren].simbol
      );
      rows.push(row);
    });

    const sub = ['', '', `SUBTOTAL CABANG ${sec.cabang}`];
    if (state.punyaNama) sub.push('', '');
    sub.push(cabIni, cabBanding, cabIni - cabBanding, '', '');
    rows.push(sub);
    rows.push([]);
    rows.push([]);
  });

  const grand = ['', '', 'GRAND TOTAL KESELURUHAN'];
  if (state.punyaNama) grand.push('', '');
  grand.push(grandIni, grandBanding, grandSelisih, '', '');
  rows.push(grand);

  if (!state.punyaNama) {
    rows.push([]);
    rows.push([]);
    rows.push(['CATATAN: Bulan pembanding masih menggunakan data tanpa nama mitra. Selisih per mitra tidak akurat.']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Styling mengikuti exportRekapBelanja() di rekapBelanja.js
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = ws[key];
    const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10) - 1;
    if (typeof cell.v === 'number') cell.z = '#,##0';

    if (rowNum === 5) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  rows.forEach((rData, rIdx) => {
    if (rIdx <= 5) return;
    // Label cabang ada di kolom 0; label subtotal & grand total ada di kolom 2.
    const isCabang = rData[0] && String(rData[0]).includes('=== CABANG');
    const isTotal = rData[2] && (String(rData[2]).includes('GRAND TOTAL') || String(rData[2]).includes('SUBTOTAL CABANG'));
    if (!isCabang && !isTotal) return;

    for (let c = 0; c < kolom; c++) {
      const ref = XLSX.utils.encode_cell({ c, r: rIdx });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };
      ws[ref].s = isCabang
        ? { font: { bold: true, color: { rgb: '0F172A' } }, fill: { fgColor: { rgb: 'E2E8F0' } } }
        : { font: { bold: true }, fill: { fgColor: { rgb: 'CBD5E1' } } };
    }
  });

  const colWidths = [];
  for (let c = 0; c < kolom; c++) {
    let min = 10;
    if (c === 0) min = 32;            // NAMA
    else if (c === 1) min = 10;       // TIPE
    else if (c === 2) min = 16;       // CABANG
    else if (c >= kolom - 5) min = 18; // kolom angka + header
    const max = Math.max(min, ...rows.map(r => String(r[c] == null ? '' : r[c]).length));
    colWidths.push({ wch: max });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bandingkan Belanja');

  // Nama file dinamis mengikuti bulan yang dipilih user.
  const namaIni = bulanTeks(state.bulanIni, null).toLowerCase();
  const namaBanding = bulanTeks(state.bulanBanding, null).toLowerCase();
  const fileName = `Data Belanja ${kapitalisasi(namaBanding)} VS ${kapitalisasi(namaIni)}.xlsx`;

  XLSX.writeFile(wb, fileName);
  showToast('File Excel berhasil diunduh: ' + fileName, 'success');
}

function kapitalisasi(teks) {
  return teks.replace(/\b[a-z]/g, c => c.toUpperCase());
}
```

Nama file memakai `bulanTeks` sendiri, bukan `state.namaBulanIni` yang dipakai untuk header kolom di layar — keduanya menghasilkan teks yang sama untuk bulan yang sah, tapi memisahkannya membuat nama file tidak bergantung pada urutan render.

**Perhatikan indeks kolom saat styling:** label cabang ada di `rData[0]`, sedangkan label subtotal dan grand total ada di `rData[2]`. Keduanya harus dicek terpisah, persis seperti di `exportRekapBelanja()` (`rekapBelanja.js:283-306`).

- [ ] **Step 3: Pasang listener tombol export**

Di `initBandingkanBelanja()` (Task 5, Step 8), tambahkan satu baris setelah listener `banding-branch`:

```js
  document.getElementById('btn-banding-export').addEventListener('click', exportBandingkanBelanja);
```

- [ ] **Step 4: Cek sintaks**

Run: `node --check src/modules/reports/bandingkanBelanja.js`
Expected: tidak ada output.

- [ ] **Step 5: Deploy frontend**

Run: `npx wrangler pages deploy . --project-name undistribusidanpenjualantsi`
Expected: `Deployment complete!`

- [ ] **Step 6: Verifikasi nama file di browser**

Buka `https://distribusidanpenjualantsi.pages.dev` → menu **Bandingkan Belanja**:
1. Set `Bulan Ini` = `2026-09`, `Bulan Banding` = `2026-08` → klik **Terapkan** → klik **Export Excel**.
   Expected: file terunduh bernama **`Data Belanja Agustus 2026 VS September 2026.xlsx`**.
2. Buka file itu. Expected:
   - Baris 1 `PT TRIDAYA SINERGI INDONESIA`
   - Baris 2 `PERBANDINGAN BELANJA SEMUA CABANG`
   - Baris 3 `BULAN INI: SEPTEMBER 2026`
   - Baris 4 `BULAN BANDING: AGUSTUS 2026`
   - Baris 6 = header kolom; kolom total = `TOTAL SEPTEMBER 2026` dan `TOTAL AGUSTUS 2026`
   - Ada baris `=== CABANG: ... ===`, `SUBTOTAL CABANG ...`, dan `GRAND TOTAL KESELURUHAN`
   - Kolom `TREN` berisi `▲`/`▼`/`=`
   - Ada catatan kaki `CATATAN: ... tidak akurat.` (karena Agustus tanpa nama)
   - **Tidak ada** kolom nominal / rupiah di mana pun
3. Ulangi dengan `Bulan Ini` = `2026-10`, `Bulan Banding` = `2026-07`.
   Expected: nama file **`Data Belanja Juli 2026 VS Oktober 2026.xlsx`**.
4. Filter `Cabang` ke `BANDUNG`, lalu export.
   Expected: baris 2 menjadi `PERBANDINGAN BELANJA BANDUNG`, dan hanya data BANDUNG di file.
5. Klik **Export Excel** saat tabel kosong (filter cabang tanpa data).
   Expected: alert `Tidak ada data untuk diexport.`

- [ ] **Step 7: Jalankan seluruh test**

Run:
```powershell
node tests/rekap-belanja-backend.test.mjs
node tests/rekap-belanja-frontend.test.mjs
node tests/kontak-mitra-backend.test.mjs
node tests/bandingkan-belanja-backend.test.mjs
node tests/save-penjualan-who.test.mjs
```
Expected: semua baris `OK: ... lolos`, tidak ada AssertionError.

- [ ] **Step 8: Commit**

```bash
git add src/modules/reports/bandingkanBelanja.js
git commit -m "feat: export excel bandingkan belanja, nama file dinamis per bulan terpilih"
```

---

## Catatan akhir untuk implementer

- **Jangan** mengubah `worker/src/routes/report-belanja-stokis.js`, `src/modules/reports/rekapBelanja.js`, atau `src/services/api.js`. Pertahankan `tests/rekap-belanja-*.test.mjs` tetap hijau — itu regresinya.
- `worker/dist/index.js` adalah artefak build lama yang **tidak** dipakai (`wrangler.toml` menunjuk `src/index.js`). Jangan edit.
- Kalau Step 7 Task 3 memberi `rows` jauh berbeda dari 568 + 48, itu wajar — bandingkan yang penting: `punya_nama = False`, semua `tipe` terisi, dan tidak ada barus yang dobel.
- Tanpa `npx wrangler login` yang aktif, `wrangler deploy` akan gagal. Jalankan sekali lebih dulu bila perlu.
