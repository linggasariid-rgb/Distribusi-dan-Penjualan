# Dashboard Distribusi & Penjualan — PT. Tridaya Sinergi Indonesia

Google Apps Script web app untuk monitoring distribusi, penjualan, dan stok wilayah Jawa Barat.

## Fitur

- **Dashboard Distribusi** — Monitoring sisa hari stok per produk per cabang, filter by WHP (Bandung/Tasikmalaya)
- **Sales Dashboard** — KPI penjualan (bulan lalu, berjalan, growth, harian), ranking cabang, tren harian, perbandingan distribusi & penerimaan per gudang
- **Control Point** — Perbandingan stok BIZ (SAP) vs Update-STOCK (Excel) per cabang
- **Input Data** — Form paste Excel untuk: Penjualan WHO, Penjualan, Penerimaan, Penerimaan Pabrik, Distribusi, Stok BIZ, Stok Excel
- **Laporan Harian** — Rekap penjualan per hari dengan filter hari
- **Penjualan Pertanggal** — Rekap per tanggal dalam satu bulan
- **SalesHub** — Perbandingan penjualan antar periode dengan antarmuka modern (KPI card berwarna dinamis, pola tabel zebra striping yang lembut, custom highlight baris total, dan tabel perbandingan harian bulan berjalan vs bulan lalu)
- **Best Produk** — Ranking produk terlaris per bulan
- **Ringkasan Stok** — Status stok terkini semua cabang
- **Chat AI** — Asisten penjualan berbasis Gemini AI untuk tanya jawab data penjualan
- **Login & Role** — Super Admin / Admin WHP dengan akses terbatas per area
- **Dark Mode** — Toggle tema gelap/terang
- **Export** — Screenshot (PNG) & PDF (mendukung dark/light mode)

## Teknologi

- **Backend:** Google Apps Script (V8 runtime)
- **Frontend:** Vanilla JS, Tailwind CSS, Chart.js, html2canvas, jsPDF
- **AI:** Google Gemini API (Chat AI asisten penjualan)
- **Deployment:** clasp (Command Line Apps Script Projects)

## Struktur File

| File | Deskripsi |
|------|-----------|
| `Main.js` | Entry point (`doGet`, `include`) |
| `Config.js` | Konfigurasi produk, spreadsheet, dan mapping WHP |
| `DataAccess.js` | Layer akses data dengan caching |
| `Auth.js` | Autentikasi dan manajemen sesi (`loginUser`) |
| `Distribution.js` | Logika data distribusi & sisa hari stok |
| `Sales.js` | Data penjualan (dashboard, harian, sales hub, best produk) |
| `ControlPoint.js` | Perbandingan stok BIZ vs Update-STOCK |
| `DataEntry.js` | Form input & paste Excel (semua tipe data) |
| `Gemini.js` | Integrasi Gemini AI untuk Chat AI asisten penjualan |
| `Diagnostics.js` | Utility diagnostic cache |
| `code.gs` / `code.js` | Backend legacy (duplikat, keduanya di-deploy) |
| `index.html` | Halaman utama (login, sidebar, routing) |
| `dashboard.html` | Semua konten dashboard (include via `<?!= include('dashboard'); ?>`) |
| `appsscript.json` | Konfigurasi project Apps Script |
| `.clasp.json` | Konfigurasi clasp deployment |

## Setup

1. Clone repo dan buka di [clasp](https://github.com/google/clasp)
2. Edit `SPREADSHEET_ID` di `Config.js` sesuai ID Google Sheet Anda
3. Pastikan sheet berikut ada di spreadsheet:
   - `Update-Penjualan WHO`
   - `Update-STOCK`
   - `BIZ` (atau `.BIZ`)
   - `Distribusi`
   - `Penerimaan`
4. Deploy sebagai Web App: `clasp push && clasp deploy`

## Konfigurasi Produk

Daftar produk, ukuran karton (ctn), target stok, alias, dan mapping WHP dikelola di objek `CONFIG.PRODUCT_INFO` dalam `Config.js`.

## Login

Login menggunakan script function `loginUser(username, password)` — kredensial dan role disimpan di sheet terpisah dalam spreadsheet yang sama.
