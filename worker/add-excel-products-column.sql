-- ────────────────────────────────────────────────────────────────────────────
-- Tambahkan kolom excel_products ke tabel stock, supaya Control Point bisa
-- menampilkan SNAPSHOT paste Stok Excel terakhir sebagai kolom "EXCEL",
-- TERPISAH dari products yang merupakan SOH live yang terus dipotong/ditambah
-- trigger penjualan_who / distribusi / penerimaan_cabang / mutasi_cabang /
-- retur_cabang.
--
-- Efek: sebelum migrasi ini, kolom "EXCEL" di Control Point ikut berubah-ubah
-- (jadi selisih) setiap kali ada input WHO/distribusi/mutasi/retur -- itu BUG.
-- Setelah migrasi ini + deploy worker versi baru:
--   * Input Stok Excel menyimpan salinan nilai paste di excel_products.
--   * Control Point membaca excel_products (fallback ke products untuk baris
--     lama yang belum pernah di-paste ulang sejak migrasi).
--
-- Jalankan SEKALI di Supabase SQL Editor SEBELUM deploy worker.
-- Aman untuk data lama: nilai NULL berarti belum ada snapshot -- bulangan
-- baca-nya menampilkan products (perilaku lama) sampai user paste ulang.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE stock ADD COLUMN IF NOT EXISTS excel_products jsonb;