// Biaya operasional cabang (kas kecil + e-toll) dibanding omzet, per bulan.
// Frontend sudah membaca Excel dan hanya mengirim baris biaya
// (lihat bacaKasKecil() / bacaEtoll() di biayaOmzet.js); di sini baris itu
// divalidasi, dinormalisasi, lalu menggantikan data lama bulan + sumber yang sama.

import { computeTransaction } from './report-belanja-stokis.js';

const SUMBER_VALID = new Set(['KAS_KECIL', 'ETOLL']);

function clean(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// "WHO BANDUNG (BDG)" / "Bandung" -> "BANDUNG"; "WHP BANDUNG (GDGBDG)" / "WHP Bandung" -> "WHP BANDUNG".
// Hasilnya sama dengan nama cabang di penjualan_who, jadi bisa langsung dipasangkan ke omzet.
export function normCabang(w) {
  return clean(w)
    .toUpperCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/^WHO\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function angka(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeBiayaRows(rows, sumber) {
  const out = [];
  for (const r of rows || []) {
    if (!r || typeof r !== 'object') continue;
    const periode = clean(r.periode);
    const cabang = normCabang(r.cabang);
    const jenis = clean(r.jenis);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode) || !cabang || !jenis) continue;
    const kas_keluar = angka(r.kas_keluar);
    const kembalian = angka(r.kembalian);
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(clean(r.tanggal)) ? clean(r.tanggal) : null;
    out.push({
      periode, sumber, cabang, tanggal,
      no_kas: clean(r.no_kas) || null,
      no_ref: clean(r.no_ref) || null,
      nama: clean(r.nama) || null,
      code: clean(r.code) || null,
      jenis, kas_keluar, kembalian,
      biaya: kas_keluar - kembalian,
    });
  }
  return out;
}

export async function handleUpload(db, body) {
  const sumber = String((body && body.sumber) || '').toUpperCase();
  if (!SUMBER_VALID.has(sumber)) return { status: 'error', message: 'Sumber tidak dikenal: ' + sumber };
  const rows = normalizeBiayaRows(body && body.rows, sumber);
  if (rows.length === 0) return { status: 'error', message: 'Tidak ada baris biaya yang valid di file ini.' };

  // Ganti seluruh data bulan + sumber yang ada di file -- upload ulang file yang
  // sudah dikoreksi tidak boleh membuat biaya terhitung dua kali.
  const periodeList = [...new Set(rows.map(r => r.periode))].sort();
  for (const periode of periodeList) {
    await db.request('DELETE', 'biaya_cabang', { eq: { periode, sumber } });
  }
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.request('POST', 'biaya_cabang', { data: rows.slice(i, i + BATCH) });
  }
  const perPeriode = {};
  for (const r of rows) {
    perPeriode[r.periode] ??= { baris: 0, biaya: 0 };
    perPeriode[r.periode].baris++;
    perPeriode[r.periode].biaya += r.biaya;
  }
  return { status: 'success', data: { sumber, periode: periodeList, per_periode: perPeriode, saved: rows.length } };
}

// Omzet & bungkus per cabang untuk satu bulan -- sama persis dengan total per
// cabang di menu Rekap Belanja (semua kategori pembeli).
export function omzetPerCabang(penjualan, priceMap, month) {
  const out = {};
  for (const r of penjualan) {
    const t = computeTransaction(r, priceMap, month);
    if (!t) continue;
    const c = normCabang(r.cabang);
    if (!c) continue;
    out[c] ??= { omzet: 0, bungkus: 0 };
    out[c].omzet += t.total_nominal;
    out[c].bungkus += t.total_bungkus;
  }
  return out;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

async function dataBulan(db, month) {
  const [yr, mo] = month.split('-').map(Number);
  const lastDay = new Date(yr, mo, 0).getDate();
  const [biaya, prices, penjualan] = await Promise.all([
    db.query('biaya_cabang', {
      select: 'cabang,sumber,tanggal,no_kas,no_ref,nama,code,jenis,kas_keluar,kembalian,biaya',
      eq: { periode: month },
    }),
    db.query('product_prices', { select: 'product_name,price_mst,price_stk' }),
    db.query('penjualan_who', {
      select: 'cabang,tipe_customer,tanggal,products',
      gte: { tanggal: `${month}-01` },
      lte: { tanggal: `${month}-${pad(lastDay)}` },
    }),
  ]);
  const priceMap = {};
  for (const p of prices) priceMap[p.product_name] = { mst: p.price_mst, karyawan: p.price_stk };
  return {
    bulan: month,
    biaya,
    omzet: omzetPerCabang(penjualan, priceMap, month),
    sumber_ada: [...new Set(biaya.map(b => b.sumber))].sort(),
  };
}

export async function handleReport(db, monthFilter) {
  let month = clean(monthFilter);
  try {
    if (!month) {
      // Tanpa bulan: pakai bulan terakhir yang sudah diupload.
      const last = await db.query('biaya_cabang', { select: 'periode', order: 'periode.desc', limit: 1 });
      if (!last.length) return { status: 'success', data: { bulan: '', biaya: [], omzet: {}, sumber_ada: [] } };
      month = last[0].periode;
    }
  } catch (err) {
    return { status: 'error', message: 'Tabel biaya_cabang belum dibuat di database. Jalankan worker/create-biaya-cabang-table.sql di Supabase SQL Editor.' };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { status: 'error', message: 'Format bulan harus YYYY-MM' };
  return { status: 'success', data: await dataBulan(db, month) };
}
