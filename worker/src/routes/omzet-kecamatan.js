// Omzet per kecamatan untuk Master Stokis (MST) dan MSI, satu bulan.
// Bungkus dan omzet dihitung dengan computeTransaction() yang sama dengan
// Rekap Belanja, jadi total di sini selalu sama dengan subtotal MST + MSI
// di menu Rekap Belanja. Pengelompokan per kecamatan dilakukan di frontend
// supaya filter cabang / kota tidak perlu memanggil API lagi.

import { computeTransaction } from './report-belanja-stokis.js';

export function detectTipeMaster(tipeCustomer) {
  const u = String(tipeCustomer == null ? '' : tipeCustomer).trim().toUpperCase();
  if (u.startsWith('MSI')) return 'MSI';
  if (u.startsWith('MST')) return 'MST';
  return '';
}

// "MST Az-Zahrah" -> "AZ-ZAHRAH", "MSI Independen 24" -> "INDEPENDEN 24".
// Harus menghasilkan kunci yang sama dengan buildWilayahKey() di wilayah-mitra.js.
export function namaTanpaTipe(tipeCustomer) {
  return String(tipeCustomer == null ? '' : tipeCustomer)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(MST|MSI)\b\s*/i, '')
    .toUpperCase();
}

export function aggregateMitra(rows, priceMap, month, wilayahMap) {
  const map = new Map();
  for (const r of rows) {
    const tipe = detectTipeMaster(r.tipe_customer);
    if (!tipe) continue;
    const t = computeTransaction(r, priceMap, month);
    if (!t) continue;

    const key = `${r.cabang}||${r.tipe_customer}`;
    let g = map.get(key);
    if (!g) {
      const w = wilayahMap.get(namaTanpaTipe(r.tipe_customer));
      g = {
        cabang: r.cabang,
        nama_customer: r.tipe_customer,
        tipe,
        kecamatan: w ? w.kecamatan || '' : '',
        kota: w ? w.kota || '' : '',
        provinsi: w ? w.provinsi || '' : '',
        terpetakan: !!(w && w.kecamatan),
        bungkus: 0,
        omzet: 0,
      };
      map.set(key, g);
    }
    g.bungkus += t.total_bungkus;
    g.omzet += t.total_nominal;
  }
  return [...map.values()];
}

// Tipe untuk mitra yang tidak belanja: pakai tipe dari belanja terakhirnya kalau
// ada; kalau tidak pernah, "Independen N" adalah MSI dan sisanya MST (pola ini
// berlaku untuk seluruh 239 MSI di data Agustus-Oktober 2026).
function tebakTipe(namaKey) {
  return /^INDEPENDEN\b/.test(namaKey) ? 'MSI' : 'MST';
}

// Mitra di data wilayah yang tidak muncul di penjualan bulan ini.
// `riwayat` = baris penjualan beberapa bulan sekitar bulan ini (tanpa products),
// dipakai untuk "terakhir belanja" dan cabang terakhirnya.
export function buildTidakBelanja(wilayahRows, mitra, riwayat, kontakMap) {
  const beli = new Set(mitra.map(m => namaTanpaTipe(m.nama_customer)));
  const terakhir = new Map();
  for (const r of riwayat || []) {
    const tipe = detectTipeMaster(r.tipe_customer);
    if (!tipe) continue;
    const k = namaTanpaTipe(r.tipe_customer);
    const t = terakhir.get(k);
    if (!t || r.tanggal > t.tanggal) terakhir.set(k, { tanggal: r.tanggal, cabang: r.cabang, tipe });
  }
  const out = [];
  for (const w of wilayahRows) {
    if (beli.has(w.nama_key)) continue;
    const t = terakhir.get(w.nama_key);
    const tipe = t ? t.tipe : tebakTipe(w.nama_key);
    const nama = `${tipe} ${w.nama || w.nama_key}`;
    const k = kontakMap && kontakMap.get(nama.replace(/\s+/g, ' ').trim().toUpperCase());
    out.push({
      nama_customer: nama,
      tipe,
      kecamatan: w.kecamatan || '',
      kota: w.kota || '',
      provinsi: w.provinsi || '',
      terpetakan: !!w.kecamatan,
      pemilik: k ? k.pemilik || '' : '',
      kontak: k ? k.kontak || '' : '',
      terakhir_belanja: t ? t.tanggal : '',
      cabang: t ? t.cabang : '',
    });
  }
  return out;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export async function handle(db, monthFilter) {
  let month = monthFilter;
  if (!month) {
    const now = new Date();
    month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { status: 'error', message: 'Format bulan harus YYYY-MM' };
  }
  const [yr, mo] = month.split('-').map(Number);
  const lastDay = new Date(yr, mo, 0).getDate();

  let wilayahRows;
  try {
    wilayahRows = await db.query('wilayah_mitra', {
      select: 'nama_key,nama,kecamatan,kota,provinsi',
      eq: { grup: 'MASTER' },
    });
  } catch (err) {
    return { status: 'error', message: 'Tabel wilayah_mitra belum dibuat di database. Jalankan worker/create-wilayah-mitra-table.sql di Supabase SQL Editor.' };
  }
  const wilayahMap = new Map(wilayahRows.map(w => [w.nama_key, w]));

  const pricesRaw = await db.query('product_prices', { select: 'product_name,price_mst,price_stk' });
  const priceMap = {};
  for (const p of pricesRaw) priceMap[p.product_name] = { mst: p.price_mst, karyawan: p.price_stk };

  const rows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,products',
    gte: { tanggal: `${month}-01` },
    lte: { tanggal: `${month}-${pad(lastDay)}` },
  });

  const mitra = aggregateMitra(rows, priceMap, month, wilayahMap);

  // Riwayat 6 bulan sebelum s/d hari ini, hanya untuk "terakhir belanja" mitra
  // yang tidak belanja bulan ini (termasuk kalau dia belanja lagi sesudahnya).
  const awalRiwayat = new Date(yr, mo - 7, 1);
  const riwayat = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal',
    gte: { tanggal: `${awalRiwayat.getFullYear()}-${pad(awalRiwayat.getMonth() + 1)}-01` },
  });

  let kontakRows = [];
  try {
    kontakRows = await db.query('kontak_mitra', { select: 'nama_key,pemilik,kontak' });
  } catch (err) {
    kontakRows = []; // tanpa tabel kontak, kolom pemilik/kontak dikosongkan
  }
  const kontakMap = new Map(kontakRows.map(k => [k.nama_key, k]));

  return {
    status: 'success',
    data: {
      bulan: month,
      jumlah_wilayah: wilayahRows.length,
      mitra,
      tidak_belanja: buildTidakBelanja(wilayahRows, mitra, riwayat, kontakMap),
    },
  };
}
