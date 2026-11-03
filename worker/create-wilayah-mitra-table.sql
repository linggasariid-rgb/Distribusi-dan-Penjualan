-- Master wilayah mitra (kecamatan / kota per Master Stokis & MSI).
-- Dipakai menu "Omzet per Kecamatan": nama mitra di penjualan_who
-- ("MST Az-Zahrah", "MSI Independen 24") dicocokkan ke nama_key di sini
-- setelah awalan MST/MSI dibuang ("AZ-ZAHRAH", "INDEPENDEN 24").
--
-- `grup` memisahkan daftar Master Stokis (MST + MSI) dari daftar Stokis (STK)
-- yang menyusul nanti, supaya nama yang kebetulan sama di dua daftar tidak
-- saling menimpa.
--
-- Hanya kolom wilayah yang disimpan -- alamat lengkap, nama KTP, dan nomor HP
-- dari Excel sumber sengaja TIDAK dikirim ke server.
--
-- SELURUH blok ini aman diulang (lihat catatan di create-kontak-mitra-table.sql).

CREATE TABLE IF NOT EXISTS public.wilayah_mitra (
  grup       TEXT NOT NULL DEFAULT 'MASTER',
  nama_key   TEXT NOT NULL,
  nama       TEXT NOT NULL,
  desa       TEXT,
  kecamatan  TEXT,
  kota       TEXT,
  provinsi   TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (grup, nama_key)
);

ALTER TABLE public.wilayah_mitra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon select wilayah_mitra" ON public.wilayah_mitra;
DROP POLICY IF EXISTS "anon insert wilayah_mitra" ON public.wilayah_mitra;
DROP POLICY IF EXISTS "anon update wilayah_mitra" ON public.wilayah_mitra;
DROP POLICY IF EXISTS "anon delete wilayah_mitra" ON public.wilayah_mitra;

CREATE POLICY "anon select wilayah_mitra" ON public.wilayah_mitra FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert wilayah_mitra" ON public.wilayah_mitra FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update wilayah_mitra" ON public.wilayah_mitra FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete wilayah_mitra" ON public.wilayah_mitra FOR DELETE TO anon USING (true);

-- PostgREST perlu memuat ulang skema supaya tabel baru langsung terlihat oleh API.
NOTIFY pgrst, 'reload schema';
