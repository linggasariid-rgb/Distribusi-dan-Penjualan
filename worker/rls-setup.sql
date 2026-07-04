-- ────────────────────────────────────────────────────────────────────────────
-- Row Level Security untuk tabel yang diakses Worker via anon key.
-- Jalankan SEKALI di Supabase SQL Editor SEBELUM mengganti secret
-- SUPABASE_ANON_KEY dari service-role key ke anon/public key asli --
-- tanpa RLS, anon key tanpa policy defaultnya DITOLAK total (bukan malah
-- terbuka), jadi urutannya: jalankan file ini dulu, baru ganti secret.
--
-- Filosofi: setiap tabel hanya diberi izin PERSIS operasi yang dipakai kode
-- Worker (lihat worker/src/routes/*.js) -- select untuk baca dashboard,
-- insert/update/delete seperlunya untuk menu Input Data. Tidak ada filter
-- per-baris (USING (true)) karena project ini tidak punya konsep
-- multi-tenant/per-user row ownership -- yang penting anon key TIDAK LAGI
-- otomatis bisa DELETE/TRUNCATE apapun seperti service-role key.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE penjualan_who ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribusi    ENABLE ROW LEVEL SECURITY;
ALTER TABLE penerimaan    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock         ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_stock     ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches      ENABLE ROW LEVEL SECURITY;

-- penjualan_who: dibaca oleh beranda/sales-hub/sales-report/best-products/distribution,
-- di-insert oleh menu "Paste WHO" (save-penjualan-who.js)
CREATE POLICY "anon select penjualan_who" ON penjualan_who FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert penjualan_who" ON penjualan_who FOR INSERT TO anon WITH CHECK (true);

-- distribusi: dibaca oleh beranda, di-insert oleh menu "Input Distribusi" (save-distribusi.js)
CREATE POLICY "anon select distribusi" ON distribusi FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert distribusi" ON distribusi FOR INSERT TO anon WITH CHECK (true);

-- penerimaan: dibaca oleh beranda, di-insert oleh menu "Penerimaan Pabrik" (save-penerimaan-pabrik.js)
CREATE POLICY "anon select penerimaan" ON penerimaan FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert penerimaan" ON penerimaan FOR INSERT TO anon WITH CHECK (true);

-- stock: dibaca oleh distribution/control-point, di-upsert oleh menu Update-STOCK
-- (save-stock.js, onConflict cabang -> butuh INSERT + UPDATE)
CREATE POLICY "anon select stock" ON stock FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert stock" ON stock FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update stock" ON stock FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- biz_stock: dibaca oleh control-point, di-insert + di-delete (per periode) oleh
-- menu BIZ (save-biz.js: hapus data periode lama lalu insert ulang)
CREATE POLICY "anon select biz_stock" ON biz_stock FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert biz_stock" ON biz_stock FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon delete biz_stock" ON biz_stock FOR DELETE TO anon USING (true);

-- branches: hanya dibaca oleh distribution.js (branchMap), tidak pernah ditulis dari Worker
CREATE POLICY "anon select branches" ON branches FOR SELECT TO anon USING (true);
