=== Plan: Menghitung Stok Akhir WHP & WHO (Kumulatif) ===

## Latar Belakang
- WHP Bandung & WHP Tasikmalaya: stok bertambah dari penerimaan pabrik, berkurang dari distribusi
- WHO: stok bertambah dari penerimaan (via distribusi ke WHO/penerimaan_cabang), berkurang dari penjualan WHO
- Penerimaan pabrik akan dirinci per produk (products JSON)
- Distribusi ke WHO diinput via menu Distribusi
- Hitung kumulatif. Abaikan data lama (mulai dari perubahan ke per-produk)
- Integrasikan ke menu 'Ringkasan Stok'

## Status
PLAN MODE - Read-only. Belum ada perubahan file.

## Rumus
**A) WHP (Bandung/Tasikmalaya)**: StokAkhir = Σ penerimaan_pabrik(gudang=WHP) + Σ transfer_masuk - Σ distribusi(gudang=WHP)
**B) WHO**: StokAkhir = Σ penerimaan_cabang(cabang='WHO') - Σ penjualan_who

## Tabel yang Terlibat
penerimaan, distribusi, penerimaan_cabang, penjualan_who, stock

## Perubahan yang Direncanakan
1. DB: ALTER TABLE penerimaan ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '{}'::jsonb
2. Backend: ubah save-penerimaan-pabrik.js (parse produk via buildProductColumnMap, simpan products)
3. Frontend: ubah inputPabrik.js (format multi-kolom produk mirip penerimaan_cabang)
4. Backend: tambah route stok-akhir (kumulatif, hitung transfer antar-WHP, normalisasi)
5. Frontend: integrasi ke Ringkasan Stok (summary.js) - WHP/WHO pakai mutasi kumulatif, cabang biasa tetap snapshot Excel

## Catatan
Transfer antar-WHP: distribusi gudang!=WHP & cabang tujuan masuk WHP (berdasarkan CONFIG.WHP_MAPPING). Distribusi WHP->WHO mengurangi WHP, WHO bertambah via penerimaan_cabang.
