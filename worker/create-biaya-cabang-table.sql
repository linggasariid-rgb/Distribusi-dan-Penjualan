-- Biaya operasional cabang per bulan, dipakai menu "Biaya vs Omzet".
-- Sumber:
--   KAS_KECIL : file "Rekap Kas Kecil" -- hanya baris biaya (No. Kas Keluar "KK-...").
--               Masuk Kas Kecil, Setoran Tunai Kas Kecil, Closing Kas, dan Tukar
--               Denom TIDAK disimpan karena itu perpindahan uang, bukan biaya.
--   ETOLL     : sheet "Per Kartu Etoll" dari file "rekap-pengeluaran" (BBM & tol
--               yang dibayar pakai kartu e-toll).
-- Upload ulang untuk bulan + sumber yang sama mengganti seluruh baris lamanya.
--
-- SELURUH blok ini aman diulang (lihat catatan di create-kontak-mitra-table.sql).

CREATE TABLE IF NOT EXISTS public.biaya_cabang (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode     TEXT NOT NULL,            -- 'YYYY-MM'
  sumber      TEXT NOT NULL,            -- 'KAS_KECIL' | 'ETOLL'
  cabang      TEXT NOT NULL,            -- 'BANDUNG', 'WHP BANDUNG', ...
  tanggal     DATE,
  no_kas      TEXT,                     -- No. Kas Keluar
  no_ref      TEXT,                     -- No. Referensi, atau nama kartu e-toll
  nama        TEXT,
  code        TEXT,
  jenis       TEXT NOT NULL,            -- Jenis Transaksi, atau 'E-toll BBM' / 'E-toll Tol'
  kas_keluar  NUMERIC NOT NULL DEFAULT 0,
  kembalian   NUMERIC NOT NULL DEFAULT 0, -- kolom "kas masuk" pada baris biaya
  biaya       NUMERIC NOT NULL DEFAULT 0, -- kas_keluar - kembalian
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biaya_cabang_periode ON public.biaya_cabang (periode, sumber);

ALTER TABLE public.biaya_cabang ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon select biaya_cabang" ON public.biaya_cabang;
DROP POLICY IF EXISTS "anon insert biaya_cabang" ON public.biaya_cabang;
DROP POLICY IF EXISTS "anon update biaya_cabang" ON public.biaya_cabang;
DROP POLICY IF EXISTS "anon delete biaya_cabang" ON public.biaya_cabang;

CREATE POLICY "anon select biaya_cabang" ON public.biaya_cabang FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert biaya_cabang" ON public.biaya_cabang FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update biaya_cabang" ON public.biaya_cabang FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete biaya_cabang" ON public.biaya_cabang FOR DELETE TO anon USING (true);

NOTIFY pgrst, 'reload schema';
