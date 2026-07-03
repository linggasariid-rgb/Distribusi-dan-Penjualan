# Dashboard Distribusi & Penjualan — PT. Tridaya Sinergi Indonesia

Google Apps Script web app untuk monitoring distribusi, penjualan, dan stok wilayah Jawa Barat.

## Fitur

- **Dashboard Distribusi** — Monitoring sisa hari stok per produk per cabang, filter by WHP (Bandung/Tasikmalaya)
- **Sales Dashboard** — KPI penjualan (bulan lalu, berjalan, growth, harian), ranking cabang, tren harian, perbandingan distribusi & penerimaan per gudang
- **Control Point** — Perbandingan stok BIZ (SAP) vs Update-STOCK (Excel) per cabang
- **Input Data** — Form paste Excel untuk: Penjualan WHO, Penjualan, Penerimaan, Penerimaan Pabrik, Distribusi, Stok BIZ, Stok Excel
- **Laporan Harian** — Rekap penjualan per hari dengan filter hari
- **Penjualan Pertanggal** — Rekap per tanggal dalam satu bulan
- **SalesHub** — Perbandingan penjualan antar periode dengan antarmuka modern (KPI card berwarna dinamis, pola tabel zebra striping yang lembut, dan custom highlight baris total)
- **Best Produk** — Ranking produk terlaris per bulan
- **Ringkasan Stok** — Status stok terkini semua cabang
- **Login & Role** — Super Admin / Admin WHP dengan akses terbatas per area
- **Dark Mode** — Toggle tema gelap/terang
- **Export** — Screenshot (PNG) & PDF

## Teknologi

- **Backend:** Google Apps Script (V8 runtime)
- **Frontend:** Vanilla JS, Tailwind CSS, Chart.js, html2canvas, jsPDF
- **Deployment:** clasp (Command Line Apps Script Projects)

## Struktur File

| File | Deskripsi |
|------|-----------|
| `code.gs` / `code.js` | Backend logic (duplikat, keduanya di-deploy) |
| `index.html` | Halaman utama (login, sidebar, routing) |
| `dashboard.html` | Semua konten dashboard (include via `<?!= include('dashboard'); ?>`) |
| `appsscript.json` | Konfigurasi project Apps Script |
| `.clasp.json` | Konfigurasi clasp deployment |

## Setup

1. Clone repo dan buka di [clasp](https://github.com/google/clasp)
2. Edit `SPREADSHEET_ID` di `code.gs` sesuai ID Google Sheet Anda
3. Pastikan sheet berikut ada di spreadsheet:
   - `Update-Penjualan WHO`
   - `Update-STOCK`
   - `BIZ` (atau `.BIZ`)
   - `Distribusi`
   - `Penerimaan`
4. Deploy sebagai Web App: `clasp push && clasp deploy`

## Konfigurasi Produk

Daftar produk, ukuran karton (ctn), target stok, alias, dan mapping WHP dikelola di objek `CONFIG.PRODUCT_INFO` dalam `code.gs`.

## Login

Login menggunakan script function `loginUser(username, password)` — kredensial dan role disimpan di sheet terpisah dalam spreadsheet yang sama.
