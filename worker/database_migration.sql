-- ────────────────────────────────────────────────────────────────────────────
-- MIGRATION SCRIPT: In Transit & Perpetual Stock System
-- Jalankan script ini di Supabase SQL Editor Anda
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Modifikasi Tabel Eksisting
ALTER TABLE distribusi 
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'SHIPPED';

ALTER TABLE stock
ADD COLUMN IF NOT EXISTS in_transit JSONB DEFAULT '{}'::jsonb;

-- 2. Buat Tabel Baru
CREATE TABLE IF NOT EXISTS penerimaan_cabang (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tanggal DATE NOT NULL,
    gudang VARCHAR(100),
    cabang VARCHAR(100) NOT NULL,
    products JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS mutasi_cabang (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tanggal DATE NOT NULL,
    cabang_asal VARCHAR(100) NOT NULL,
    cabang_tujuan VARCHAR(100) NOT NULL,
    products JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS retur_cabang (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tanggal DATE NOT NULL,
    cabang VARCHAR(100) NOT NULL,
    keterangan TEXT,
    products JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 3. Fungsi Bantuan untuk Kalkulasi JSONB (Tambah & Kurang Kuantitas)
CREATE OR REPLACE FUNCTION jsonb_merge_sum(j1 JSONB, j2 JSONB, is_subtract BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    key TEXT;
    val1 NUMERIC;
    val2 NUMERIC;
    res JSONB := COALESCE(j1, '{}'::jsonb);
BEGIN
    FOR key, val2 IN SELECT * FROM jsonb_each_text(COALESCE(j2, '{}'::jsonb))
    LOOP
        val1 := COALESCE((res->>key)::NUMERIC, 0);
        IF is_subtract THEN
            res := jsonb_set(res, ARRAY[key], to_jsonb(val1 - val2));
        ELSE
            res := jsonb_set(res, ARRAY[key], to_jsonb(val1 + val2));
        END IF;
    END LOOP;
    RETURN res;
END;
$$;

-- 4. Triggers untuk Tabel STOCK (Perpetual Inventory)

-- A. Trigger Penjualan WHO (Mengurangi SOH)
CREATE OR REPLACE FUNCTION trg_penjualan_who() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, TRUE) WHERE cabang = NEW.cabang;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, FALSE) WHERE cabang = OLD.cabang;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, FALSE) WHERE cabang = OLD.cabang;
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, TRUE) WHERE cabang = NEW.cabang;
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_penjualan_who_stock ON penjualan_who;
CREATE TRIGGER trg_penjualan_who_stock AFTER INSERT OR UPDATE OR DELETE ON penjualan_who FOR EACH ROW EXECUTE FUNCTION trg_penjualan_who();


-- B. Trigger Distribusi (Menambah In Transit)
CREATE OR REPLACE FUNCTION trg_distribusi() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE stock SET in_transit = jsonb_merge_sum(in_transit, NEW.products, FALSE) WHERE cabang = NEW.cabang;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stock SET in_transit = jsonb_merge_sum(in_transit, OLD.products, TRUE) WHERE cabang = OLD.cabang;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE stock SET in_transit = jsonb_merge_sum(in_transit, OLD.products, TRUE) WHERE cabang = OLD.cabang;
        UPDATE stock SET in_transit = jsonb_merge_sum(in_transit, NEW.products, FALSE) WHERE cabang = NEW.cabang;
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_distribusi_stock ON distribusi;
CREATE TRIGGER trg_distribusi_stock AFTER INSERT OR UPDATE OR DELETE ON distribusi FOR EACH ROW EXECUTE FUNCTION trg_distribusi();


-- C. Trigger Penerimaan Cabang (Mengurangi In Transit, Menambah SOH)
CREATE OR REPLACE FUNCTION trg_penerimaan_cabang() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE stock SET 
            in_transit = jsonb_merge_sum(in_transit, NEW.products, TRUE),
            products = jsonb_merge_sum(products, NEW.products, FALSE)
        WHERE cabang = NEW.cabang;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stock SET 
            in_transit = jsonb_merge_sum(in_transit, OLD.products, FALSE),
            products = jsonb_merge_sum(products, OLD.products, TRUE)
        WHERE cabang = OLD.cabang;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE stock SET 
            in_transit = jsonb_merge_sum(in_transit, OLD.products, FALSE),
            products = jsonb_merge_sum(products, OLD.products, TRUE)
        WHERE cabang = OLD.cabang;
        UPDATE stock SET 
            in_transit = jsonb_merge_sum(in_transit, NEW.products, TRUE),
            products = jsonb_merge_sum(products, NEW.products, FALSE)
        WHERE cabang = NEW.cabang;
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_penerimaan_cabang_stock ON penerimaan_cabang;
CREATE TRIGGER trg_penerimaan_cabang_stock AFTER INSERT OR UPDATE OR DELETE ON penerimaan_cabang FOR EACH ROW EXECUTE FUNCTION trg_penerimaan_cabang();


-- D. Trigger Mutasi Cabang (Mengurangi SOH Asal, Menambah SOH Tujuan)
CREATE OR REPLACE FUNCTION trg_mutasi_cabang() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, TRUE) WHERE cabang = NEW.cabang_asal;
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, FALSE) WHERE cabang = NEW.cabang_tujuan;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, FALSE) WHERE cabang = OLD.cabang_asal;
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, TRUE) WHERE cabang = OLD.cabang_tujuan;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, FALSE) WHERE cabang = OLD.cabang_asal;
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, TRUE) WHERE cabang = OLD.cabang_tujuan;
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, TRUE) WHERE cabang = NEW.cabang_asal;
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, FALSE) WHERE cabang = NEW.cabang_tujuan;
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_mutasi_cabang_stock ON mutasi_cabang;
CREATE TRIGGER trg_mutasi_cabang_stock AFTER INSERT OR UPDATE OR DELETE ON mutasi_cabang FOR EACH ROW EXECUTE FUNCTION trg_mutasi_cabang();


-- E. Trigger Retur Cabang (Mengurangi SOH)
CREATE OR REPLACE FUNCTION trg_retur_cabang() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, TRUE) WHERE cabang = NEW.cabang;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, FALSE) WHERE cabang = OLD.cabang;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE stock SET products = jsonb_merge_sum(products, OLD.products, FALSE) WHERE cabang = OLD.cabang;
        UPDATE stock SET products = jsonb_merge_sum(products, NEW.products, TRUE) WHERE cabang = NEW.cabang;
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_retur_cabang_stock ON retur_cabang;
CREATE TRIGGER trg_retur_cabang_stock AFTER INSERT OR UPDATE OR DELETE ON retur_cabang FOR EACH ROW EXECUTE FUNCTION trg_retur_cabang();

-- 5. RLS Setup untuk Tabel Baru
ALTER TABLE penerimaan_cabang ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutasi_cabang ENABLE ROW LEVEL SECURITY;
ALTER TABLE retur_cabang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon select penerimaan_cabang" ON penerimaan_cabang FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert penerimaan_cabang" ON penerimaan_cabang FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon delete penerimaan_cabang" ON penerimaan_cabang FOR DELETE TO anon USING (true);

CREATE POLICY "anon select mutasi_cabang" ON mutasi_cabang FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert mutasi_cabang" ON mutasi_cabang FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon delete mutasi_cabang" ON mutasi_cabang FOR DELETE TO anon USING (true);

CREATE POLICY "anon select retur_cabang" ON retur_cabang FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert retur_cabang" ON retur_cabang FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon delete retur_cabang" ON retur_cabang FOR DELETE TO anon USING (true);
