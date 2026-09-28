-- Master kontak mitra (MST / MSI / STK).
-- Dipakai oleh menu "Kontak Mitra" (input paste dari Excel) dan
-- ditampilkan di menu "Bandingkan Belanja" sebagai kolom Pemilik + Kontak.
--
-- SELURUH blok ini aman diulang: Supabase/Postgres tidak punya
-- "CREATE POLICY IF NOT EXISTS", jadi policy-nya di-drop dulu. Tanpa ini, jalan
-- kedua berhenti di error "policy already exists" -- dan karena satu error
-- membatalkan seluruh batch, tabel pun bisa tertinggal tidak tercreated.

CREATE TABLE IF NOT EXISTS public.kontak_mitra (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_key   TEXT NOT NULL UNIQUE,
  nama       TEXT NOT NULL,
  type       TEXT NOT NULL,
  pemilik    TEXT,
  kontak     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kolom UNIQUE sudah membuat indeks sendiri, jadi tidak perlu idx_kontak_mitra_nama_key.

ALTER TABLE public.kontak_mitra ENABLE ROW LEVEL SECURITY;

-- WAJIB: Worker memakai SUPABASE_ANON_KEY (worker/src/index.js:52), bukan
-- service key, jadi RLS ikut berlaku. Tanpa policy di bawah, TABEL ADA tapi
-- setiap query dari Worker mengembalikan 0 baris atau error 42501 -- gejalanya
-- seperti "kontak tidak pernah tersimpan", padahal datanya sudah masuk.
-- Ikuti pola yang sama dengan create-users-table.sql.
DROP POLICY IF EXISTS "anon select kontak_mitra" ON public.kontak_mitra;
DROP POLICY IF EXISTS "anon insert kontak_mitra" ON public.kontak_mitra;
DROP POLICY IF EXISTS "anon update kontak_mitra" ON public.kontak_mitra;
DROP POLICY IF EXISTS "anon delete kontak_mitra" ON public.kontak_mitra;

CREATE POLICY "anon select kontak_mitra" ON public.kontak_mitra FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert kontak_mitra" ON public.kontak_mitra FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update kontak_mitra" ON public.kontak_mitra FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon delete kontak_mitra" ON public.kontak_mitra FOR DELETE TO anon USING (true);
