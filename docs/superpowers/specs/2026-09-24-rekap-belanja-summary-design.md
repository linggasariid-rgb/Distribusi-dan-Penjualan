# Rekap Belanja — Ringkasan Bulanan per Customer (Group per Cabang)

**Tanggal:** 2026-09-24
**Status:** Disetujui user (brainstorming)

## Latar belakang

Menu Rekap Belanja tidak menampilkan nama customer MST/MSI/STK untuk bulan-bulan lama.
Investigasi menemukan:

- Data `penjualan_who.tipe_customer` untuk **Agustus 2026 ke bawah** (≈20.568 baris) hanya
  berisi kode tipe (`MST`, `MSI`, `STK`, `ORE`, `ORM`) tanpa nama customer.
- Data **September 2026 ke atas** sudah berisi nama (mis. `MST M. Naufal Haidar`) karena
  diekstrak dari kolom nama saat input.
- Kolom nama di sumber Excel bernama **`NAMA CUSTOMER`**, sedangkan `save-penjualan-who.js`
  hanya mendeteksi header `NAMA PDM`, sehingga data yang dipaste dari sheet asli tidak
  menyimpan nama.
- Google Sheet sumber hanya memiliki kolom nama utk Jan–Jun + sebagian Juli; Agustus & backup
  tidak menyimpan nama. Diputuskan: **tidak ada backfill** data lama.

Konsep awal menu ini adalah ringkasan total belanja per customer dalam sebulan; tampilan
saat ini berubah menjadi detail per transaksi. User menginginkan kembali tampilan ringkasan.

## Tujuan

1. Tampilan Rekap Belanja menjadi **ringkasan bulanan per customer per cabang**.
2. Kolom: `Nama | Tipe | Cabang | [per produk] | Total Bungkus | Total Nominal`.
3. Dikelompokkan **per Cabang** (dengan subtotal cabang), lalu customer di dalamnya.
4. Export Excel mengikuti format ringkasan yang sama.
5. Data lama yang hanya punya kode tetap tampil sebagai kode (tanpa backfill).
6. Penyimpanan data baru menyimpan nama customer (deteksi kolom nama diperbaiki).

## Arsitektur & Alur Data

```
penjualan_who (bulan)
      │  diambil per rentang bulan + harga produk dihitung (logika lama dipertahankan)
      ▼
report-belanja-stokis.js  →  AGREGSI per (cabang, nama_customer)
      │  { nama_customer, kategori, cabang, products, total_bungkus, total_nominal }
      ▼
GET /api/report-belanja-stokis?month=…
      ▼
rekapBelanja.js  →  render tabel grup per CABANG + subtotal + grand total
      ▼
Export Excel  →  layout ringkasan (grup cabang + subtotal)
```

## Perubahan

### 1. `worker/src/routes/report-belanja-stokis.js`

Pertahankan logika lama yang masih berlaku:
- Tarik `product_prices` (`product_name, price_mst, price_stk`).
- Tarik `penjualan_who` per rentang bulan.
- Deteksi `kategori` dari prefix `tipe_customer`:
  - `MST`/`MSI` → `Master Stokis`
  - `STK`/`STOKIS` → `Stokis`
  - `KARYAWAN`/`ORE`/`TSIEMPLOYEE` → `Karyawan`
  - `APPS`/`ORM`/`TSIAPPS` → `Apps`
  - selain itu diskip.
- Hitung `total_bungkus` (tanpa `HU`) dan `total_nominal` per transaksi dengan harga sesuai kategori.

Ubah bagian output menjadi **agregasi**:
- Key grup = `cabang + '||' + nama_customer` (nama_customer = `tipe_customer`).
- Setiap transaksi: `products[p] += qty`, `total_bungkus += …`, `total_nominal += …`.
- Output dikembalikan dalam bentuk array grup dengan urutan **cabang asc, lalu nama_customer asc**.
- Payload tiap elemen:

```json
{
  "nama_customer": "MST M. Naufal Haidar",
  "kategori": "Master Stokis",
  "cabang": "TANGERANG",
  "products": { "SPS TSI": 240, "SSJ": 100, "HU": 0 },
  "total_bungkus": 1200,
  "total_nominal": 24500000
}
```

Catatan: `nama_customer` lama tanpa nama tetap berupa kode (`MST`); seluruh transaksi
ber-kode `MST` pada satu cabang akan berkumpul menjadi satu baris ringkasan ber-label `MST`.
Ini perilaku yang diinginkan (tanpa backfill).

### 2. `src/modules/reports/rekapBelanja.js`

- **Kolom header:** `Nama | Tipe | Cabang | <PRODUCT_COLS> | Total Bungkus | Total Nominal (Rp)`.
- **`Tipe`** = `kategori` (Master Stokis / Stokis / Karyawan / Apps).
- **Tampilkan** ringkasan: satu baris per customer per cabang.
- **Grup per cabang** (abjad): baris header `=== CABANG: <nama> ===` selebar penuh (colspan semua kolom) + baris customer di bawahnya.
- **Subtotal per cabang** (jumlah produk, bungkus, nominal) dengan warna seperti subtotal di export lama.
- **Footer**: `GRAND TOTAL KESELURUHAN`.
- Warna nama berdasar kategori (amber=Master Stokis, blue=Stokis, purple=Karyawan, emerald=Apps) — dipertahankan.
- Filter yang tetap ada: Bulan, Cabang (Semua Cabang / spesifik), Tipe (`ALL`/Master Stokis/Stokis/Karyawan/Apps).
- Empty state: "Tidak ada data belanja di bulan ini."

### 3. Export Excel (`exportRekapBelanja`)

Bangun ulang dari data ringkasan yang sama, layout meniru skema lama:
- Baris atas: `PT TRIDAYA SINERGI INDONESIA`, `REKAP BELANJA <tipe>`, cabang, `PERIODE <bulan>`.
- Header kolom: `NAMA | TIPE | CABANG | <produk> | TOTAL BUNGKUS | TOTAL NOMINAL (Rp)` — urutan sama dengan di layar.
- Grup per cabang: baris `=== CABANG: <nama> ===` + data customer, subtotal cabang, grand total.
- Styling baris header & subtotal (bold, isian warna slate/amber) dipertahankan seperti implementasi sekarang.
- Nama file tetap: `Rekap_Belanja_<cabang>_<tipe>_<bulan>.xlsx`.

### 4. `worker/src/routes/save-penjualan-who.js`

Perbaiki deteksi kolom nama:
- Header dianggap kolom nama bila **persis** `NAMA PDM` atau `NAMA CUSTOMER`,
  atau mengandung `NAMA` dan (`PDM` atau `CUSTOMER`).
- Sisanya tidak berubah: `tipe_customer = "<tipe> <nama>".trim()`.

## Batasan / keputusan

- **Tidak ada backfill nama** untuk bulan lama (Agustus ke bawah) — sesuai keputusan user.
- Detail per tanggal tidak lagi tampil di menu (diganti ringkasan). Endpoint detail tidak
  dipertahankan karena diputuskan tidak perlu (YAGNI).

## Verifikasi

1. Smoke test agregasi backend via script Node terhadap data nyata:
   - `2026-09`: harus menghasilkan baris bernama customer per cabang.
   - `2026-08`: menghasilkan baris ber-label kode tipe.
2. Buka menu Rekap Belanja di browser: ringkasan per cabang, subtotal, grand total benar.
3. Export Excel: file terbuka, kolom & total sesuai ringkasan.
4. Paste penjualan WHO dengan header `NAMA CUSTOMER` → `tipe_customer` tersimpan ber-nama.

## File yang berubah

- `worker/src/routes/report-belanja-stokis.js`
- `src/modules/reports/rekapBelanja.js`
- `worker/src/routes/save-penjualan-who.js`