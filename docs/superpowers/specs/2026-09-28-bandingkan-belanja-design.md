# Bandingkan Belanja — Total Produk Bulan Ini vs Bulan Banding

**Tanggal:** 2026-09-28
**Status:** Disetujui user (brainstorming)

## Latar belakang

Menu `Rekap Belanja` yang sudah ada (lihat `2026-09-24-rekap-belanja-summary-design.md`)
menampilkan **rincian 20 produk** per customer per cabang untuk **satu bulan**. User
membutuhkan menu baru yang menjawab pertanyaan berbeda: *berapa total produk yang dibeli
setiap mitra bulan ini dibanding bulan yang dipilih sebagai pembanding, dan apakah naik
atau turun.*

Tiga fakta penting yang membentuk desain ini:

1. **Yang dibandingkan adalah jumlah produk (bungkus), bukan rupiah.** User koreksi
   eksplisit: "Total nya bukan rupiah tapi total produk". Konsekuensi: `product_prices`
   **tidak perlu** diambil di endpoint baru — agregasi jadi murni penjumlahan `products`.
2. **Tidak ada rincian produk.** Kolom `products` tidak pernah dikirim ke frontend.
3. **Nomor kontak tidak ada di database.** Tabel Supabase yang ada
   (`penjualan_who`, `branches`, `users`, `product_prices`, `stock`, `biz_stock`,
   `distribusi`, `penerimaan`, `penerimaan_cabang`, `mutasi_cabang`, `retur_cabang`)
   tidak punya kolom telepon/WA, dan tidak ada tabel master customer. User memiliki file
   Excel terpisah berisi `No. | NAMA | TYPE | PEMILIK | HP / Telepon` → necessitates
   tabel master baru + menu input baru.

### Kondisi data yang relevan (diverifikasi via API live 2026-09-28)

| | Agustus 2026 | September 2026 |
|---|---|---|
| Jumlah grup dari `report-belanja-stokis` | 48 | 568 |
| Isi `tipe_customer` | `MST`, `MSI`, `STK`, `ORE`, `ORM` (kode telanjang) | `MSI Independen 12`, `STK BIR ALI`, … (per mitra) |

Untuk Agustus 2026 ke bawah, `tipe_customer` tidak menyimpan nama mitra. Konsekuensi untuk
perbandingan: kunci `"MST"` (Agustus) **tidak akan** berpasangan dengan `"MST Sinergi
Kautsar"` (September), sehingga September terbaca semua "baru" dan Agustus semua "berhenti".
Ini transien — mulai Oktober 2026 (September ↔ Oktober) kedua bulan sudah bernama. Ditangani
dengan deteksi `punya_nama` + banner peringatan (§ "Peringatan data tanpa nama"), bukan
dengan mengubah data.

## Tujuan

1. Menu baru **Bandingkan Belanja** yang menampilkan **total produk** per mitra untuk
   **bulan ini** vs **bulan pembanding**, lengkap dengan penanda naik/turun.
2. Angka yang dibandingkan adalah **bungkus** (19 produk biasa, `HU` tidak dihitung) —
   identik dengan kolom *Total Bungkus* di Rekap Belanja.
3. Cakupan data hanya **MST, MSI, dan STK**.
4. Tiap baris menampilkan **nama pemilik** dan **nomor kontak**.
5. Kolom **Tipe** memberi tanda `MST` / `MSI` / `STK` per baris.
6. Simbol `▲` (naik) dan `▼` (turun) pada selisih.
7. Menu baru **Kontak Mitra** untuk mengisi data pemilik + kontak lewat paste dari Excel.
8. Export Excel dengan **nama file dinamis** mengikuti bulan yang dipilih.

## Arsitektur & Alur Data

```
                    ┌──────────────────────────────────────────────┐
Kontak Mitra       │ 1. paste blok Excel                          │
(kontakMitra.js)   │    header: No.|NAMA|TYPE|PEMILIK|HP/Telepon │
        │          └──────────────┬───────────────────────────────┘
        │ POST /api/kontak-mitra   │
        ▼                          ▼
┌───────────────────┐     ┌────────────────────────────────┐
│ kontak_mitra      │     │ penjualan_who (rentang 2 bulan)│
│ nama_key (unique) │◄────┤ product_prices  ✗ TIDAK diambil  │
└───────────────────┘     └──────────────┬─────────────────┘
      ▲                                  │ 1 query
      │ join by nama_key (di JS)          ▼
      │                    ┌──────────────────────────────────────┐
      └────────────────────┤ report-belanja-banding.js             │
                           │  agregasi per (bulan, cabang, nama)  │
                           │  HU di-skip, tipe != MST/MSI/STK      │
                           │  dibuang                              │
                           └──────────────┬───────────────────────┘
                                          │ GET /api/report-belanja-banding
                                          │     ?month=YYYY-MM&banding=YYYY-MM
                                          ▼
                           ┌──────────────────────────────────────┐
                           │ bandingkanBelanja.js                  │
                           │  group per CABANG + subtotal + grand  │
                           │  ▲/▼/= + Export Excel                 │
                           └──────────────────────────────────────┘
```

**Dua request, bukan tiga.** Satu request untuk data penjualan (satu rentang bulan),
satu untuk data kontak. `kontak_mitra` di-`SELECT` full di worker dan di-join di memori
lewat `Map` — jumlah barisnya ratusan, bukan ribuan, sehingga tidak perlu join SQL.

## Perubahan

### 1. Tabel baru `kontak_mitra` — `worker/create-kontak-mitra-table.sql` (baru)

```sql
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

-- Kolom UNIQUE sudah membuat indeks sendiri; tidak perlu idx_kontak_mitra_nama_key.

ALTER TABLE public.kontak_mitra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon select kontak_mitra" ON public.kontak_mitra FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert kontak_mitra" ON public.kontak_mitra FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update kontak_mitra" ON public.kontak_mitra FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete kontak_mitra" ON public.kontak_mitra FOR DELETE TO anon USING (true);
```

Empat policy itu wajib, bukan hiasan. Worker memakai `SUPABASE_ANON_KEY`, bukan service
key (`worker/src/index.js:52`), sehingga RLS benar-benar ditegakkan: tabel yang ada tapi
tanpa policy akan mengembalikan 0 baris atau error `42501` dari Worker. Gejalanya
menipu — data kontak terlihat tidak pernah tersimpan, padahal sebenarnya tidak pernah
terbaca. Pola ini sama dengan `worker/create-users-table.sql`.

`nama_key` adalah kunci pencocokan yang dihitung server dari `TYPE` + `NAMA`
(lihat `buildNamaKey`). Disimpan sudah ternormalisasi sehingga perbandingan di memori
cuma perbandingan string biasa.

### 2. `worker/src/routes/kontak-mitra.js` (baru)

Ekspor: `BULAN`-independent helpers + `handle` (POST) + `handleList` (GET).

**`findKontakColumns(headers)`** — deteksi posisi kolom dari header Excel yang dipaste.
Cocok **case-insensitive** setelah normalisasi (huruf besar semua, spasi jadi satu,
`/` jadi spasi). Beri skor per kolom dan ambil yang terbaik:

| Target | Kunci yang dicocokkan (setelah normalisasi) |
|---|---|
| `type` | `TYPE`, `TIPE` |
| `nama` | `NAMA` (tapi bukan `NAMA PEMILIK` / `NAMA PEMBELI` / `NAMA LENGKAP`) |
| `pemilik` | `PEMILIK`, `PEMILIK NAMA`, `NAMA PEMILIK`, `OWNER` |
| `kontak` | `HP`, `HP TELEPON`, `HP TELP`, `TELEPON`, `TELP`, `KONTAK`, `NO HP`, `WA`, `WHATSAPP` |

Kolom `No.`, `NO`, `NOMOR` **tidak** dipakai sebagai `kontak` (-number urut, bukan telepon).
Bila `type` dan `nama` tidak ditemukan, `findKontakColumns` mengembalikan `null` dan
backend menjawab `400` dengan pesan yang menyebut header yang bermasalah.

**`buildNamaKey(type, nama)`** — `(`${type} ${nama}`)` → uppercase, spasi dirapatkan,
trim. Contoh: `('MSI', ' Independen 12 ')` → `'MSI INDEPENDEN 12'`.

**`parseKontakRows(rows, headers)`** — memetakan setiap baris menjadi
`{ nama_key, nama, type, pemilik, kontak }`. Baris dilewati bila `nama_key` kosong.
`type` di-uppercase; `nama` disimpan apa adanya (supaya display enak dibaca).

**`handleList(db)`** — `GET` → `{ status: 'success', data: [...], total: n }`, urutan
`nama_key` asc.

**`handle(db, body)`** — `POST`. Body `{ clear: true }` → hapus semua
(`db.request('DELETE', 'kontak_mitra', {})`). Body `{ rows: [...] }` → **bulk upsert
satu request**: `db.request('POST', 'kontak_mitra', { data: payload, onConflict: 'nama_key' })`
dengan `payload` berupa array semua baris sekaligus, sehingga tidak ada N request.
`rows` berisi bentuk mentah `{ nama, type, pemilik, kontak }`; `nama_key` dihitung
backend agar client tidak perlu tahu aturan normalisasi. Baris tanpa `nama_key`_valid
dihitung sebagai `skipped` dan dilaporkan di response, bukan menggagalkan seluruh import.
Body tanpa `rows` dan tanpa `clear` → `400`.

Response upsert: `{ status: 'success', data: { saved: n, skipped: m } }`.
Response clear: `{ status: 'success', data: { cleared: n } }`.

**Kenapa bukan `DELETE`.** `callApi()` di `src/services/api.js` hanya bisa GET (via
`READ`) dan POST (via `WRITE`) — tidak ada jalur DELETE. Menambah dukungan DELETE ke
`api.js` berarti menyentuh infrastruktur bersama yang dipakai semua menu, demi satu
tombol. Karena itu "Hapus Semua" dikirim sebagai `POST` dengan body `{ clear: true }`
dan `worker/src/index.js` meneruskan method POST apa adanya ke `kontakMitra.handle()`.

### 3. `worker/src/routes/report-belanja-banding.js` (baru)

Ekspor: `MONTH_NAMES`, `detectTipe`, `computeBungkus`, `aggregateBulan`,
`detectPunyaNama`, `mergeRows`, `handle`.

**`detectTipe(tipeCustomer)`** — mengembalikan `'MST' | 'MSI' | 'STK' | ''`.
`UPPER` lalu prefix:

```js
u.startsWith('MSI') → 'MSI'
u.startsWith('MST') → 'MST'
u.startsWith('STK') → 'STK'
u.startsWith('STOKIS') → 'STK'
lainnya → ''
```

Prefix `MST` dan `MSI` tidak saling tumpang tindih, jadi urutan pemeriksaan tidak
berpengaruh. Perbedaan penting dari `detectCategory` yang sudah ada: fungsi itu
menggabungkan `MST`+`MSI` ke satu label `Master Stokis`; menu ini **memisahkannya**
karena user meminta tanda MST *atau* MSI.

**`computeBungkus(products)`** — menjumlahkan seluruh nilai `products` kecuali `HU`.
Tidak ada harga, tidak ada `product_prices`.

**`aggregateBulan(rows, month)`** — untuk setiap baris `penjualan_who` dengan
`tanggal.startsWith(month)`: `tipe = detectTipe(tipe_customer)`; `''` → buang.
`total += computeBungkus(products)`. Kunci grup = `` `${cabang}||${tipe_customer}` ``.
Mengembalikan `Map<key, { cabang, nama_customer, tipe, total }>`.

**`detectPunyaNama(groups)`** — mengembalikan `false` bila **satu saja** grup pada bulan
pembanding namanya persis salah satu kode tipe telanjang:
`MST`, `MSI`, `STK`, `STOKIS`, `ORE`, `ORM`, `KARYAWAN`, `TSIEMPLOYEE`, `TSIAPPS`, `APPS`.

Dua aturan yang sempat dipertimbangkan dan ditolak karena salah:

- **Deteksi lewat panjang karakter (`u.length <= 5`).** Terlihat elegan karena semua
  kode tipe memang pendek, tapi menyalahklasifikasikan nama asli yang pendek —
  `MST B`, `STK A`, `MST Z` semuanya 5 karakter. Kalau salah tangkap, bulan yang
  justru punya nama akan dilaporkan "belum punya nama", dan kolom Pemilik/Kontak
  ikut hilang — kebalikan dari yang diinginkan. Verifikasi terhadap data September
  2026 menunjukkan nama terpendek saat ini 6 karakter (`STK Dm`), jadi aturan
  panjang kebetulan belum salah pada data sekarang; itu keberuntungan, bukan jaminan.
- **Guard jumlah grup minimum.** Justru menyembunyikan peringatan yang benar: bulan
  dengan 2 grup berkode akan lolos tanpa tanda peringatan.

Daftar eksak lebih benar dan tidak perlu tebakan. Baris dengan nama kosong diabaikan.

Alasan pakai aturan "ada satu saja", bukan persentase: begitu **satu** baris berkode
telah muncul, ada baris di bulan ini yang tidak akan punya pasangan, sehingga tabel
sudah tidak akurat. Ambang persentase hanya menunda masalah, bukan menyelesaikannya.

**`mergeRows(mapIni, mapBanding, kontakMap)`** — union kunci dari kedua bulan:

```
key tidak ada di bulan ini  → ini_total = 0
key tidak ada di bulan banding → banding_total = 0
```

Tiap baris:

```json
{
  "cabang": "BANDUNG",
  "nama_customer": "MSI Independen 12",
  "tipe": "MSI",
  "pemilik": "Budi Santoso",
  "kontak": "08123456789",
  "ini_bungkus": 910,
  "banding_bungkus": 0
}
```

`pemilik` dan `kontak` diambil dari `kontakMap.get(namaKey(nama_customer))`, atau `null`
bila tidak ada kontak. **Backend tidak menghitung `selisih` maupun `%`** — selisih adalah
turunan tampilan, dihitung di frontend pada baris yang lolos filter cabang (sehingga
sort & subtotal ikut benar).

**`handle(db, month, banding)`** — ketika `month === banding`, bulan kedua **tidak
dikalikan dua**; `punya_nama = true` dan `banding_bungkus` selalu `0`.

Response:

```json
{
  "status": "success",
  "data": {
    "bulan_ini": "2026-09",
    "bulan_banding": "2026-08",
    "nama_bulan_ini": "September 2026",
    "nama_bulan_banding": "Agustus 2026",
    "punya_nama": false,
    "rows": [ … ]
  }
}
```

Validasi input: kedua parameter harus cocok `/^\d{4}-\d{2}$/` dan bulannya 01–12;
selain itu `400`. `month` kosong → default bulan berjalan (mengikuti perilaku
`report-belanja-stokis.js`).

**Tidak ada import dari `report-belanja-stokis.js`.** `kategori` tidak lagi dibutuhkan
karena tabel ini memakai `tipe` (MST/MSI/STK) sebagai label — tidak ada `import`,
tidak ada kolom `kategori` di response, tidak ada tooltip. Endpoint lama tidak tersentuh
sama sekali.

### 4. `worker/src/index.js` — registrasi route

```js
import * as reportBelanjaBanding from './routes/report-belanja-banding.js';
import * as kontakMitra from './routes/kontak-mitra.js';
```

- `GET  /api/report-belanja-banding?month=YYYY-MM&banding=YYYY-MM`
- `GET  /api/kontak-mitra`
- `POST /api/kontak-mitra`

Registered di sebelah route `report-belanja-stokis` yang sudah ada; route lama **tidak
disentuh**.

### 5. `index.html` — 2 menu baru + 2 view baru

**Menu `Bandingkan Belanja`**, grup `LAPORAN`, tepat setelah `menu-rekap-belanja`:
`id="menu-bandingkan-belanja"`, ikon `fas fa-right-left`. Mengikuti pola aktif menu
`rekap-belanja` (kelas flex inline, tanpa `sidebar-item-sub`) agar `setActiveMenu()`
di-`router.js` memakai styling hijau yang sama.

**Menu `Kontak Mitra`**, grup `STOK & ORDER` (data master), sebelum `menu-input-stok-excel`:
`id="menu-kontak-mitra"`, ikon `fas fa-address-book`.

**View `#bandingkan-belanja-view`**, `class="hidden space-y-6"`, berisi:

| id | elemen |
|---|---|
| `banding-month-ini` | `<input type="month">` |
| `banding-month-banding` | `<input type="month">` |
| `banding-branch` | `<select>`, opsi pertama `Semua Cabang` |
| `btn-banding-refresh` | `Terapkan` (`fa-sync-alt`) |
| `btn-banding-export` | `Export Excel` (`fa-file-excel`) |
| `banding-warning` | banner peringatan, `hidden` by default |
| `banding-loader` | spinner, teks `Menarik data transaksi...` |
| `banding-content` | wrapper tabel |
| `banding-thead` / `banding-tbody` / `banding-tfoot` | thead / tbody / tfoot |

**View `#kontak-mitra-view`**, `class="hidden space-y-6"`, berisi:

| id | elemen |
|---|---|
| `kontak-textarea` | `<textarea>` untuk paste blok Excel |
| `btn-kontak-simpan` | `Simpan Kontak` |
| `kontak-hint` | teks: `Header wajib: NAMA, TYPE, PEMILIK, HP / Telepon. Kolom No. diabaikan.` |
| `kontak-status` | pesan hasil import (jumlah tersimpan / dilewati / error header) |
| `kontak-loader` | spinner |
| `kontak-tbody` | tabel kontak tersimpan |
| `kontak-count` | jumlah baris tersimpan |
| `btn-kontak-hapus` | `Hapus Semua` (konfirmasi dulu) |

### 6. `src/config/routes.js` — API map

```js
READ['getBandingkanBelanja'] = { url: '/api/report-belanja-banding', params: ['month', 'banding'] }
READ['getKontakMitra']       = { url: '/api/kontak-mitra', params: [] }
WRITE['simpanKontakMitra']   = { url: '/api/kontak-mitra', params: ['rows'] }
WRITE['hapusKontakMitra']    = { url: '/api/kontak-mitra', params: ['clear'] }
```

Dua entri `WRITE` menunjuk URL yang sama; `callApi` membedakannya lewat isi body
(`{ rows: [...] }` vs `{ clear: true }`). `api.js` **tidak diubah**.

### 7. `src/events/sidebarEvents.js`

Tambahkan `'bandingkan-belanja'` dan `'kontak-mitra'` ke array `MENU_IDS`.

### 8. `src/router.js`

Dua cabang baru di rantai `else if` pada `switchMenu()`, mengikuti pola `rekap-belanja`
(remove `hidden`, set `page-title` + `page-icon`, `setActiveMenu()`, lazy `import()` modul
hanya saat tbody masih kosong).

```js
else if (menuName === 'bandingkan-belanja') {
  // view dibuka, title "Bandingkan Belanja", icon fa-right-left
  // lazy import('./modules/reports/bandingkanBelanja.js').initBandingkanBelanja()
}
else if (menuName === 'kontak-mitra') {
  // view dibuka, title "Kontak Mitra", icon fa-address-book
  // lazy import('./modules/kontakMitra/kontakMitra.js').initKontakMitra()
}
```

Tambahkan `'bandingkan-belanja': 'admin'` ke peta `menuAccess` (menu `kontak-mitra` tidak
perlu entri baru karena sudah default `'admin'`).

### 9. `src/modules/reports/bandingkanBelanja.js` (baru)

Ekspor: `groupPerCabang`, `hitungSelisih`, `exportBandingkanBelanja`, `initBandingkanBelanja`.

**Kolom tabel:**

```
Nama | Tipe | Cabang | Pemilik | Kontak | Total Bulan Ini
     | Total Bulan Banding | Selisih | % | Tren
```

Seluruh angka adalah **bungkus**; tidak ada kolom rupiah.

**`hitungSelisih(baris)`** — mengembalikan `{ selisih, persen, tren }` dari
`baris.ini_bungkus` dan `baris.banding_bungkus`:

| kondisi | selisih | persen | tren | badge |
|---|---|---|---|---|
| `banding === 0 && ini > 0` | `ini` | `null` | `'baru'` | `▲` hijau |
| `ini === 0 && banding > 0` | `-banding` | `-100` | `'berhenti'` | `▼` merah |
| `banding === 0 && ini === 0` | `0` | `null` | `'tetap'` | `=` abu |
| `selisih > 0` | `selisih` | `selisih / banding * 100` | `'naik'` | `▲` hijau |
| `selisih < 0` | `selisih` | `selisih / banding * 100` | `'turun'` | `▼` merah |
| `selisih === 0` | `0` | `0` | `'tetap'` | `=` abu |

`persen === null` dirender sebagai `—` agar tidak terjadi divide-by-zero.

**Badge tipe** — `MST` amber, `MSI` ungu, `STK` biru (mengikuti palet kategori yang sudah
dipakai di Rekap Belanja).

**Kontak** — `kontak` dirender sebagai tautan `https://wa.me/<angka saja>` dengan
`target="_blank" rel="noopener"`, didahului tombol `Salin` mengikuti pola `copy-wa` di
`distribution.js` dan `controlPoint.js`. `kontak` kosong → `—` abu muda.
Jika `punya_nama === false`, kolom `Pemilik` dan `Kontak` **tidak dirender sama sekali**
(tabel menyempit ke 8 kolom) karena tidak ada yang bisa dicocokkan.

**Grup & total** — `groupPerCabang(rows, sortKey)` adalah **fungsi baru** di
`bandingkanBelanja.js`, dimodelkan setelah `groupPerCabang()` yang sudah ada di
`rekapBelanja.js:1` dengan satu perbedaan: parameter `sortKey` kedua untuk menentukan
urutan baris di dalam cabang. Mengembalikan `[{ cabang, items: [...] }]` dengan urutan
cabang asc; di dalam tiap cabang urutan `sortKey` **desc**, nama customer asc sebagai
pemutus. Tiap cabang: baris header `=== CABANG: <nama> ===` (`colspan` = jumlah kolom
aktif, kelas `bg-slate-800 text-white`), baris-baris mitra, baris `SUBTOTAL CABANG <nama>`
(`colspan 3`). Footer: `GRAND TOTAL KESELURUHAN` dengan `colspan 3`.

**Sort** — default `sortKey = 'selisih'` desc. Header `Total Bulan Ini`,
`Total Bulan Banding`, dan `Selisih` bisa diklik untuk toggle asc/desc; klik ulang
membalik arah. Indikator `▲`/`▼` kecil di header saat aktif. `groupPerCabang` menerima
`sortKey` agar pengurutan di dalam cabang dan subtotal konsisten.

**Peringatan** — `punya_nama === false` → `#banding-warning` diisi:
`Bulan pembanding (Agustus 2026) masih memakai data tanpa nama mitra, sehingga selisih
per mitra tidak akurat. Pilih bulan yang sudah berisi nama, mis. September 2026.` dan
`#banding-warning` di-un-hide. Kolom `Selisih`, `%`, dan `Tren` diberi kelas `opacity-50`
dan `title` berisi penjelasan yang sama.

**Empty state** — `Tidak ada data belanja pada bulan yang dipilih.`

**Perilaku filter** — `Bulan Ini` dan `Bulan Banding` **tidak** punya listener `change`;
hanya tombol `Terapkan` yang memicu request. `Cabang` punya listener `change` →
render ulang **client-side** saja, seperti menu Rekap Belanja. Tombol `Export Excel`
mengexpor **hasil yang sedang tampil** (setelah filter cabang), dengan baris peringatan
disisipkan sebagai catatan kaki bila `punya_nama === false`.

**Inisialisasi** — default `Bulan Ini` = bulan berjalan, `Bulan Banding` = bulan
sebelumnya. `initBandingkanBelanja()` dipanggil sekali per page load (dijaga oleh
`#banding-tbody` kosong, mengikuti pola yang sudah dipakai router).

### 10. `src/modules/kontakMitra/kontakMitra.js` (baru)

Ekspor: `initKontakMitra`, `kontakToRows`, `saveKontakMitra`, `hapusKontakMitra`.

- `initKontakMitra()` — pasang listener `Simpan` / `Hapus Semua`, lalu
  `callApi('getKontakMitra')` dan render tabel.
- **Validasi sebelum request** — bila textarea kosong, `#kontak-status` berisi
  `Area paste masih kosong.` dan tidak ada request. Bila baris pertama tidak terdeteksi
  punya header `NAMA`/`TYPE`, tampilkan
  `Header tidak dikenali. Pastikan baris pertama berisi kolom NAMA dan TYPE.` dan
  tidak ada request.
- Payload `POST` dikirim sebagai baris mentah; `nama_key` dihitung backend.
- `#kontak-status` menampilkan `Berhasil menyimpan N kontak, M baris dilewati.`
  atau pesan error dari backend.
- Tabel: `No | NAMA | TYPE | PEMILIK | HP / Telepon`, baris `—` untuk `pemilik`/`kontak`
  kosong, plus teks ajakan bila tabel kosong:
  `Belum ada data kontak. Tempel blok dari Excel lalu klik Simpan.`
- `Hapus Semua` meminta konfirmasi via `confirm()` lalu
  `callApi('hapusKontakMitra', true)`, dan `worker/src/index.js` meneruskan POST ke
  `kontakMitra.handle()` yang memanggil `db.request('DELETE', 'kontak_mitra', {})`.

### 11. Export Excel — `exportBandingkanBelanja` di `bandingkanBelanja.js`

Mengikuti `exportRekapBelanja` yang sudah ada (library `XLSX` global dari
`xlsx-js-style@1.2.0`, sudah dideklarasikan di `index.html:14`).

**Nama file dinamis** — dibangun dari `nama_bulan_banding` + `nama_bulan_ini` yang
dikirim API, dipisah spasi/spasi agar tidak memotong kata:

```js
const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
                     'Agustus','September','Oktober','November','Desember'];
const namaBulan = (ym) => `${BULAN_NAMES[Number(ym.split('-')[1]) - 1]} ${ym.split('-')[0]}`;
const fileName = `Data Belanja ${namaBulan(banding)} VS ${namaBulan(ini)}.xlsx`;
```

Contoh hasil:

| Bulan Ini | Bulan Banding | Nama file |
|---|---|---|
| `2026-09` | `2026-08` | `Data Belanja Agustus 2026 VS September 2026.xlsx` |
| `2026-10` | `2026-07` | `Data Belanja Juli 2026 VS Oktober 2026.xlsx` |

**Nama sheet** tetap `Bandingkan Belanja` (18 karakter, aman di bawah batas 31).
Backend mengirim `nama_bulan_ini`/`nama_bulan_banding` supaya nama file dan isi tabel
selalu konsisten — nama bulan tidak dihitung ulang dari string `YYYY-MM` di frontend.

**Isi file:**

1. `PT TRIDAYA SINERGI INDONESIA`
2. `PERBANDINGAN BELANJA` (atau `PERBANDINGAN BELANJA <CABANG>` bila cabang difilter)
3. `BULAN INI: SEPTEMBER 2026`
4. `BULAN BANDING: AGUSTUS 2026`
5. baris kosong
6. header kolom: `NAMA | TIPE | CABANG | PEMILIK | HP / TELEPON | TOTAL <BLN INI> | TOTAL <BLN BANDING> | SELISIH | % | TREN`
   — nama bulan pada header memakai huruf kapital (pola `BULAN_NAMES` di
   `rekapBelanja.js:194`)
7. per cabang: baris `=== CABANG: <nama> ===`, baris mitra, `SUBTOTAL CABANG <nama>`, 2 baris kosong
8. `GRAND TOTAL KESELURUHAN`
9. bila `punya_nama === false`, tambahkan 2 baris kosong + catatan:
   `CATATAN: Bulan pembanding masih menggunakan data tanpa nama mitra. Selisih per mitra tidak akurat.`

Kolom `Tren` di file memakai karakter `▲ ▼ =` agar identik dengan layar. Styling header,
baris cabang, subtotal, dan grand total mengikuti `exportRekapBelanja` yang ada.
Guard yang sama dipertahankan: `XLSX` belum termuat → `alert('Library Excel belum siap.
Silakan refresh halaman.')`; tidak ada data → `alert('Tidak ada data untuk diexport.')`.

### 12. `dashboard.html`

Menu `#menu-bandingkan-belanja` dan `#menu-kontak-mitra` ditambahkan agar tidak ada menu
yatim. **View-nya tidak ikut ditambahkan** — file ini sudah tertinggal (menu `pengaturan`,
`penerimaan-cabang`, `mutasi`, `retur`, `riwayat-transaksi` sudah tidak ada) dan bukan
target deploy. Menambah menu tanpa view aman karena `MENU_IDS` memasang listener dengan
penjaga `if (el)`, dan `#menu-rekap-belanja` di file itu sudah berada dalam kondisi
yang sama sekarang.

## Peringatan data tanpa nama

`detectPunyaNama` (lihat § 3) menandai `false` bila ada **satu saja** grup pada bulan
pembanding namanya persis sama dengan kode tipenya (`MST`, `MSI`, `STK`, `ORE`, `ORM`),
dan jumlah grup-nya ≥ 3.

Responsnya:
- Banner kuning di atas tabel.
- Kolom `Pemilik` dan `Kontak` disembunyikan (tidak ada yang bisa dicocokkan).
- Nilai `Selisih`, `%`, dan `Tren` tampil dengan `opacity-50` + `title` penjelasan.
- Catatan kaki yang sama ditambahkan di file Excel.

Mulai Oktober 2026 (rentang September ↔ Oktober) kedua bulan sudah berisi nama sehingga
peringatan tidak muncul. **Tidak ada backfill** — sesuai keputusan spec
`2026-09-24-rekap-belanja-summary-design.md`.

## Batasan / keputusan

- **Tanpa rupiah.** Endpoint baru tidak pernah menyentuh `product_prices`; kolom nominal
  tidak ada di layar maupun di Excel.
- **Tanpa rincian produk.** Objek `products` tidak pernah dikirim ke frontend.
- **Tanpa backfill nama** untuk bulan lama.
- **Tanpa upload file.** Import kontak lewat paste, mengikuti pola `Input Stok Excel`
  yang sudah dipakai di menu lain.
- **`dashboard.html` tidak diberi view**, hanya menu. Alasannya file tersebut sudah
  tertinggal dan tidak pernah dipakai sebagai target deploy; fokus ada pada `index.html`
  (Cloudflare Pages). Yang penting tidak ada menu yatim: `sidebarEvents.js` memasang
  listener dengan penjaga `if (el)`, sehingga `#menu-*` yang tidak ada view-nya aman
  seperti `#menu-rekap-belanja` di file itu sekarang.
- Tidak ada paginasi: jumlah baris maksimum ± 577 per perbandingan (terverifikasi
  pada data September vs Agustus 2026), masih aman untuk dirender sebagai satu tabel.
  Kalau nanti sudah lewat ± 2.000 baris, barulah perlu dipaginasi.
- `buildNamaKey` dan normalisasi hanya ada di backend — client tidak pernah
  membangun kunci sendiri.

## Verifikasi

1. `node tests/kontak-mitra-backend.test.mjs` — semua lulus.
2. `node tests/bandingkan-belanja-backend.test.mjs` — semua lulus.
3. Smoke test `GET /api/report-belanja-banding?month=2026-09&banding=2026-08` terhadap
   data nyata. Angka di bawah sudah diverifikasi langsung ke `penjualan_who` memakai
   query dan agregasi yang sama dengan route ini:

   | Nilai | Angka terverifikasi |
   |---|---|
   | Baris mentah 2026-08-01 s/d 2026-09-30 | 5.205 |
   | Grup agregat Agustus 2026 | 29 |
   | Grup agregat September 2026 | 548 |
   | Baris union | 577 |
   | Total bungkus September 2026 | 1.024.944 |

   `punya_nama` harus `false` (Agustus masih berkode), `nama_bulan_banding` =
   `Agustus 2026`, `rows` = 577, dan **pasangan** (`ini > 0` dan `banding > 0`)
   = **0**. Nol pasangan itu fakta data, bukan cacat: Agustus tersimpan sebagai kode
   `MST`/`MSI`/`STK`, September sebagai nama asli, jadi tidak ada baris yang bisa
   dipasangkan. Justru itulah sebabnya banner peringatan wajib ada.
4. Smoke test `?month=2026-09&banding=2026-09`: `punya_nama = true`, seluruh
   `banding_bungkus = 0`, tidak ada pengali ganda.
5. `POST /api/kontak-mitra` dengan blok Excel berisi header
   `No.|NAMA|TYPE|PEMILIK|HP / Telepon` → `nama_key` terbentuk benar, termasuk baris
   dengan `NAMA` berawalan spasi dan `TYPE` huruf kecil.
6. `POST` diulang dengan baris yang sama → jumlah baris tidak bertambah (upsert).
7. Paste blok dengan header salah → `400` dengan pesan yang menyebut `NAMA`/`TYPE`.
8. Buka menu **Bandingkan Belanja** di browser: grup cabang, subtotal, grand total,
   `▲`/`▼`/`=` benar; klik `Terapkan` mengganti bulan; filter cabang hanya render ulang.
9. Buka **Kontak Mitra** di browser: paste → simpan → tabel terisi, kolom Pemilik/Kontak
   muncul di menu Bandingkan Belanja setelah `Terapkan` ulang.
10. Export Excel: nama file persis `Data Belanja Agustus 2026 VS September 2026.xlsx`
    untuk rentang 2026-08 vs 2026-09; isi kolom dan subtotal cocok dengan layar.

## File yang berubah

**Baru:**
- `worker/create-kontak-mitra-table.sql`
- `worker/src/routes/kontak-mitra.js`
- `worker/src/routes/report-belanja-banding.js`
- `src/modules/kontakMitra/kontakMitra.js`
- `src/modules/reports/bandingkanBelanja.js`
- `tests/kontak-mitra-backend.test.mjs`
- `tests/bandingkan-belanja-backend.test.mjs`

**Ubah:**
- `worker/src/index.js` — registrasi 3 route
- `index.html` — 2 menu, 2 view
- `dashboard.html` — 2 menu
- `src/config/routes.js` — 3 entri API
- `src/events/sidebarEvents.js` — `MENU_IDS`
- `src/router.js` — 2 cabang router + `menuAccess`
