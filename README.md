# Dashboard Distribusi & Penjualan — PT. Tridaya Sinergi Indonesia

Dashboard monitoring distribusi, penjualan, dan stok wilayah Jawa Barat.

## Fitur

- **Dashboard Distribusi** — Monitoring sisa hari stok per produk per cabang, filter by WHP
- **Sales Dashboard** — KPI penjualan, ranking cabang, tren harian
- **Control Point** — Perbandingan stok BIZ (SAP) vs Update-STOCK (Excel)
- **Input Data** — Form paste Excel untuk semua tipe data
- **Laporan Harian & Penjualan Pertanggal** — Rekap penjualan
- **Rekap Belanja** — Rekap pembelanjaan khusus Master Stokis & Stokis
- **SalesHub** — Perbandingan penjualan antar periode
- **Best Produk** — Ranking produk terlaris
- **Ringkasan Stok** — Status stok terkini
- **Chat AI** — Asisten penjualan berbasis Gemini AI
- **Pengaturan** — Profil akun, manajemen user (super_admin), toggle dark mode
- **Manajemen Akun** — CRUD user (tambah/edit/hapus), role & WHP assignment. User tidak bisa edit/hapus akun sendiri
- **Login & Role** — Super Admin / Admin / Admin WHP
- **Dark Mode** — Toggle tema gelap/terang
- **Export** — Screenshot (PNG) & PDF

## Role

| Role | Akses |
|------|-------|
| `super_admin` | Full access + Manajemen Akun |
| `admin` | Dashboard, sales, distribusi, input data, laporan, chat AI |
| `admin_whp` | Terbatas sesuai WHP assignment, tanpa SalesHub |

## Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | Cloudflare Pages, Vanilla JS, Tailwind CSS, Chart.js |
| Styling | CSS Variable Design System (light/dark mode), Enterprise Gateway pattern |
| Typography | Fira Sans (UI) + Fira Code (mono/data) |
| Brand | Navy `#0F172A` / Green `#22C55E` |
| Backend | Cloudflare Workers (API), Google Apps Script (legacy) |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini API |
| Migration | Node.js script (`migrate.js`) |

## Struktur File

| File | Deskripsi |
|------|-----------|
| `worker/` | Cloudflare Workers API |
| `worker/src/index.js` | Entry point worker, routing |
| `worker/src/routes/` | Handler per endpoint (beranda, sales-hub, users, dll) |
| `worker/src/routes/users.js` | CRUD user (list, create, update, remove) |
| `worker/wrangler.toml` | Konfigurasi Cloudflare Workers |
| `worker/create-users-table.sql` | Migrasi tabel users + RLS policies + seed data |
| `migrate.js` | Script migrasi Google Sheets → Supabase |
| `Main.js` - `Sales.js` - dll | Backend GAS (legacy, masih dipakai) |
| `index.html` | Halaman utama SPA (login, sidebar, routing, seluruh konten dashboard) |
| `dashboard.html` | Salinan identik `index.html`, dijaga tetap sinkron |
| `worker/rls-setup.sql` | Row Level Security policy untuk Supabase |

## Setup Cloudflare Workers

**Sebelum deploy pertama kali**, jalankan SQL berikut di Supabase SQL Editor (Project > SQL Editor):

1. `worker/rls-setup.sql` — aktifkan RLS + policy untuk semua tabel existing
2. `worker/create-users-table.sql` — buat tabel `users` + RLS + seed 4 akun default

```bash
cd worker
npx wrangler secret put SUPABASE_ANON_KEY    # isi anon/public key ASLI dari Supabase
                                              # (Project Settings > API > Project API keys > anon/public)
                                              # JANGAN isi service_role key -- itu membypass RLS sepenuhnya
npx wrangler secret put GEMINI_API_KEY       # (opsional) untuk Chat AI
npx wrangler deploy
```

Subdomain `workers.dev` untuk akun Cloudflare harus sudah terdaftar terlebih dahulu sebelum `wrangler deploy`.

## Setup Migrasi Data

```bash
cp .env.example .env
# isi .env dengan credentials
node migrate.js
```

## Endpoints API (Workers)

| Endpoint | Deskripsi |
|----------|-----------|
| `GET /api/beranda?whp=...&selWhp=...&branch=...` | Data KPI beranda |
| `GET /api/sales-hub?whp=...&currDate=...&prevDate=...&backDate=...` | Sales Hub |
| `GET /api/sales-report?dayFilter=...&filterMonth=...&startMonth=...&whp=...` | Laporan harian/pertanggal |
| `GET /api/best-products/months` | Daftar bulan tersedia |
| `GET /api/best-products/data?month=...` | Ranking produk |
| `GET /api/report-belanja-stokis?month=...` | Laporan rekap belanja MST/MSI/STK |
| `GET /api/prices` | Mengambil harga produk dari database |
| `POST /api/prices` | Update harga produk (super_admin only) |
| `GET /api/control-point` | Control Point BIZ vs Stock |
| `GET /api/distribution?whp=...` | Data distribusi & sisa hari stok |
| `POST /api/login` | Login (username, password) |
| `POST /api/chat` | Chat AI (proxy ke Gemini) |
| `GET /api/users` | List semua user (super_admin only) |
| `POST /api/users` | Tambah user baru (super_admin only) |
| `PUT /api/users/:id` | Update user (super_admin only) |
| `DELETE /api/users/:id` | Hapus user (super_admin only) |
| `POST /api/save/penjualan-who` | Simpan paste data Penjualan WHO |
| `POST /api/save/distribusi` | Simpan input Distribusi |
| `POST /api/save/penerimaan-pabrik` | Simpan input Penerimaan Pabrik |
| `POST /api/save/stock` | Simpan/update paste data Update-STOCK |
| `POST /api/save/biz` | Simpan paste data BIZ (SAP) |

## Akun Default

| Username | Password | Role |
|----------|----------|------|
| `superadmin` | `admin123` | super_admin |
| `admin` | `admin123` | admin |
| `whp_tasik` | `admin123` | admin_whp (WHP TASIKMALAYA) |
| `whp_bandung` | `admin123` | admin_whp (WHP BANDUNG) |

## Recent Updates (September 2026)

- **Cabang Baru (Cibaduyut):** Penambahan konfigurasi untuk cabang `CIBADUYUT` secara hardcoded di `worker/src/config.js` dan Apps Script. Pemetaan WHP diubah menjadi `WHP BANDUNG` dan lead time 1 hari.
- **Pembersihan Cabang Lama:** `BANYUMAS`, `GUDANG BANDUNG`, dan `GUDANG TASIKMALAYA` telah dihapus secara permanen dari konfigurasi `STOCK_SHEET_ROW_ORDER` dan dari database `branches` di Supabase untuk merapikan tabel Ringkasan Stok.
- **Stok Excel Positional Update:** Struktur *copy-paste* stok Excel disesuaikan menjadi **13 baris** (tanpa Banyumas, diakhiri dengan Cibaduyut) agar pembacaan array 2 dimensi tepat sasaran saat menimpa tabel `stock`.
- **Perbaikan Kalender Best Produk:** Penanganan PostgreSQL exception `"date/time field value out of range"` pada bulan yang berjumlah kurang dari 31 hari (seperti September). Kalkulasi hari terakhir kini mendeteksi otomatis sesuai bulan `(new Date(y, m, 0).getDate())`.
- **Rekap Belanja Master Stokis & Stokis:** Penambahan modul pelaporan baru yang menampilkan rekap transaksi bulanan dengan tampilan *grouped* per nama customer, dilengkapi filter tipe dan cabang dinamis.
- **Pengaturan Harga Produk:** Implementasi tabel `product_prices` di Supabase. Harga kini dikelola langsung lewat database (bukan hardcoded) melalui antarmuka khusus di menu Pengaturan yang hanya dapat diakses oleh `super_admin`.
- **Ekstraksi NAMA PDM:** Fitur *paste* Excel Penjualan WHO kini mendeteksi nama asli customer (NAMA PDM) dan menggabungkannya ke kolom `tipe_customer` (misal: "MST Sinergi Kautsar"), sehingga nama muncul otomatis di laporan Rekap Belanja. Termasuk penambahan *aliases* nama panjang (seperti "Sin Precision White" -> SPW).
- **Export Excel Pro:** Export ke Excel menggunakan library `xlsx-js-style` yang mendukung warna header (*styling*), otomatisasi format angka ribuan, lebar kolom yang dihitung presisi, dan *grand total*.
- **Perbaikan Deteksi Tipe Customer:** Pembaruan logika di Cloudflare Workers (`sales-hub.js`) agar tipe customer (`MST`, `MSI`, `STK`, `Karyawan`, dan `Apps`) tetap terakumulasi secara benar di menu Perbandingan Penjualan meskipun format data mengandung tambahan suffix nama (misal: "MST Sinergi Kautsar").
- **Perbaikan Layout Export Screenshot:** Memperlebar dimensi bingkai canvas `html2canvas` pada menu Perbandingan Penjualan menjadi `3200px` secara penuh untuk memastikan kolom paling kanan (TOTAL) dan elemen lainnya sama sekali tidak terpotong saat diexport.
- **Deploy ke Cloudflare Pages:** Frontend aplikasi kini resmi di-deploy ke Cloudflare Pages pada project `distribusidanpenjualantsi` (URL: `https://distribusidanpenjualantsi.pages.dev`).
- **Rekap Belanja Karyawan & Apps:** Menambahkan dukungan pembacaan transaksi bertipe Karyawan (ORE) dan TSI Apps (ORM) pada modul Rekap Belanja agar selaras dengan total modul lain.
- **Pengaturan Harga Karyawan (ORE):** Menambahkan field pengaturan harga terpisah khusus Karyawan di menu Pengaturan (dengan mengalihfungsikan struktur kolom `price_stk` pada database). Transaksi TSI Apps dan Stokis secara otomatis meminjam harga Master Stokis (MST).
- **Export Group by Branch:** Menyempurnakan fitur Export Excel Rekap Belanja; jika diexport pada mode "Semua Cabang", data akan otomatis dipilah, dikelompokkan, dan diberikan subtotal per masing-masing cabang secara rapi.
