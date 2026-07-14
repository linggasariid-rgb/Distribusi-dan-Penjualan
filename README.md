# Dashboard Distribusi & Penjualan — PT. Tridaya Sinergi Indonesia

Dashboard monitoring distribusi, penjualan, dan stok wilayah Jawa Barat.

## Fitur

- **Dashboard Distribusi** — Monitoring sisa hari stok per produk per cabang, filter by WHP
- **Sales Dashboard** — KPI penjualan, ranking cabang, tren harian
- **Control Point** — Perbandingan stok BIZ (SAP) vs Update-STOCK (Excel)
- **Input Data** — Form paste Excel untuk semua tipe data
- **Laporan Harian & Penjualan Pertanggal** — Rekap penjualan
- **SalesHub** — Perbandingan penjualan antar periode
- **Best Produk** — Ranking produk terlaris
- **Ringkasan Stok** — Status stok terkini
- **Chat AI** — Asisten penjualan berbasis Gemini AI
- **Login & Role** — Super Admin / Admin WHP
- **Dark Mode** — Toggle tema gelap/terang
- **Export** — Screenshot (PNG) & PDF

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
| `worker/` | Cloudflare Workers API (pengganti GAS backend) |
| `worker/src/index.js` | Entry point worker, routing |
| `worker/src/routes/` | Handler per endpoint (beranda, sales-hub, dll) |
| `worker/wrangler.toml` | Konfigurasi Cloudflare Workers |
| `migrate.js` | Script migrasi Google Sheets → Supabase |
| `Main.js` - `Sales.js` - dll | Backend GAS (legacy, masih dipakai) |
| `index.html` | Halaman utama SPA (login, sidebar, routing, seluruh konten dashboard) |
| `dashboard.html` | Salinan identik `index.html`, dijaga tetap sinkron -- keduanya harus selalu sama isinya |
| `worker/rls-setup.sql` | Row Level Security policy untuk Supabase (jalankan sekali sebelum pakai anon key asli) |

## Setup Cloudflare Workers

**Sebelum deploy pertama kali**, jalankan `worker/rls-setup.sql` sekali di Supabase SQL Editor (Project > SQL Editor) untuk mengaktifkan Row Level Security + policy yang dibutuhkan Worker. Ini WAJIB dilakukan sebelum mengisi `SUPABASE_ANON_KEY` dengan anon key asli, karena RLS yang aktif tanpa policy justru akan menolak semua akses.

```bash
cd worker
npx wrangler secret put SUPABASE_ANON_KEY    # isi anon/public key ASLI dari Supabase
                                              # (Project Settings > API > Project API keys > anon/public)
                                              # JANGAN isi service_role key -- itu membypass RLS sepenuhnya
npx wrangler secret put GEMINI_API_KEY       # (opsional) untuk Chat AI
npx wrangler deploy
```

Subdomain `workers.dev` untuk akun Cloudflare harus sudah terdaftar terlebih dahulu (Workers & Pages > buka sekali untuk auto-generate, atau `PUT /accounts/{id}/workers/subdomain` via API) sebelum `wrangler deploy` bisa publish ke `https://api-distribusi.<subdomain>.workers.dev`.

## Setup Migrasi Data

```bash
cp .env.example .env
# isi .env dengan credentials
node migrate.js
```

## Endpoints API (Workers)

| Endpoint | Deskripsi |
|----------|-----------|
| `GET /api/beranda?whp=...&selWhp=...&branch=...` | Data KPI beranda (whp = pembatasan role, selWhp/branch = filter dropdown user) |
| `GET /api/sales-hub?whp=...&currDate=...&prevDate=...&backDate=...` | Sales Hub |
| `GET /api/sales-report?dayFilter=...&filterMonth=...&startMonth=...&whp=...` | Laporan harian/pertanggal |
| `GET /api/best-products/months` | Daftar bulan tersedia |
| `GET /api/best-products/data?month=...` | Ranking produk |
| `GET /api/control-point` | Control Point BIZ vs Stock (termasuk konsolidasi Tasikmalaya & WHP Bandung) |
| `GET /api/distribution?whp=...` | Data distribusi & sisa hari stok |
| `POST /api/login` | Login (username, password) -- verifikasi server-side |
| `POST /api/chat` | Chat AI (proxy ke Gemini) |
| `POST /api/save/penjualan-who` | Simpan paste data Penjualan WHO |
| `POST /api/save/distribusi` | Simpan input Distribusi |
| `POST /api/save/penerimaan-pabrik` | Simpan input Penerimaan Pabrik |
| `POST /api/save/stock` | Simpan/update paste data Update-STOCK |
| `POST /api/save/biz` | Simpan paste data BIZ (SAP) |
