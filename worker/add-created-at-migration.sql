-- ────────────────────────────────────────────────────────────────────────────
-- Tambahkan kolom created_at ke tabel distribusi & penerimaan, supaya fitur
-- "Riwayat Input" (menu Input Distribusi & Input Penerimaan Pabrik) bisa
-- mengelompokkan baris per-batch submit dan menghapusnya, persis seperti yang
-- sudah bisa dilakukan di penjualan_who (tabel itu sudah punya created_at
-- bawaan Supabase). Jalankan SEKALI di Supabase SQL Editor.
--
-- Aman untuk data lama: baris yang sudah ada akan diisi waktu saat migrasi
-- ini dijalankan (bukan NULL), baris baru otomatis terisi waktu insert.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE distribusi ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE penerimaan ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
