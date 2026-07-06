# Fix: Header "Total" Hilang & Warna Header Tidak Lengkap

## Root Cause
`tailwind.config.js` hanya menscan `['./index.html', './dashboard.html']` — kelas utility Tailwind (`bg-orange-400`, `text-white`, `bg-blue-100`, `bg-green-100`, dll) yang dipakai di file **JavaScript** tidak terdeteksi oleh JIT scanner → ketinggalan di `tailwind.min.css`.

Akibat:
- `bg-orange-400` header **Total** tidak ada → background putih
- `text-white` di header **Total** tidak ada → teks putih di background putih = nggak terbaca
- `bg-blue-100` / `bg-green-100` di header kolom lain juga hilang

## Langkah Fix
1. **Edit `tailwind.config.js`** baris `content:` → tambah `'./src/**/*.js'`
   - Before: `content: ['./index.html', './dashboard.html'],`
   - After:  `content: ['./index.html', './dashboard.html', './src/**/*.js'],`

2. **Rebuild CSS**
   ```
   npm run build:css
   ```

3. **Deploy ulang** Frontend ke Cloudflare Pages
   ```
   npx wrangler pages deploy $env:TEMP\opencode\distribusi-deploy --project-name distribusidanpenjualantsi
   ```
