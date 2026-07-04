const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) {}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1znxLIojUXuPNjL9O2b3l_knG6cgY0sSVmTeKh78Dwbw';
const SUPABASE_URL = process.env.SUPABASE_URL || 'REMOVED_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'REMOVED_SECRET';
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || 'service-account.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH))),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

const PRODUCTS = [
  'SPS TSI','SKM TSI','SM','SP19 TSI','SPF','SMM','ST','SSJ','STM','SKMF',
  'SK','SNN ORG','SNN Mind','SNN Menthol','SPW','SP','KMK','KOOR','SSE','HU'
];

const BIZ_PRODUCT_MAP = {
  'Sin Platinum Special': 'SPS TSI', 'Sin Kujang Mas': 'SKM TSI',
  'Sinergi Mind': 'SM', 'Sin Provost 19': 'SP19 TSI',
  'Sin Platinum Filter': 'SPF', 'Sinergi Mind Menthol': 'SMM',
  'Sin Trust': 'ST', 'Sin Sapu Jagat': 'SSJ',
  'Sin Trust Menthol': 'STM', 'Sin Kujang Mas Filter': 'SKMF',
  'Sin Krakatau': 'SK', 'Sin New Normal Org': 'SNN ORG',
  'Sin New Normal Mind': 'SNN Mind', 'Sin New Normal Menthol': 'SNN Menthol',
  'Kartu Hu versi Baru': 'HU', 'Kopi Mana Kopi': 'KMK',
  'Kopi Original': 'KOOR', 'SIN Precision White': 'SPW',
  'SIN Precision': 'SP', 'SIN Encode': 'SSE',
};

function parseDate(str) {
  if (!str || str === '-') return null;
  if (typeof str === 'number') {
    return new Date((str - 25569) * 86400 * 1000).toISOString().split('T')[0];
  }
  const parts = String(str).split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return null;
}

function parseNum(v) {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(String(v).replace(/\./g,''), 10) || 0;
}

function getBizCabang(row) {
  const name = String(row[1]).trim();
  if (name) return name.toUpperCase();
  const first = String(row[0]).trim();
  if (first && isNaN(Number(first))) return first.toUpperCase();
  return '';
}

async function migratePenjualanWho() {
  console.log('\n--- Update-Penjualan WHO ---');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'Update-Penjualan WHO',
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) { console.log('  kosong'); return; }

  const headers = rows[0];
  const productCols = PRODUCTS.map(p => headers.indexOf(p)).filter(i => i >= 0);
  if (productCols.length === 0) {
    console.log('  Tidak ada kolom produk yang cocok!');
    console.log('  Headers:', headers.join(', '));
    return;
  }

  const batch = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 4) continue;
    const tanggal = parseDate(r[3]);
    if (!tanggal) continue;
    const products = {};
    productCols.forEach(idx => { products[headers[idx]] = parseNum(r[idx]); });
    batch.push({
      bulan: (r[0] || '').toUpperCase(),
      cabang: (r[1] || '').toUpperCase(),
      tipe_customer: r[2] || '',
      tanggal, products,
      jumlah: parseNum(r[r.length - 1]),
    });
  }
  if (batch.length === 0) { console.log('  tidak ada data valid'); return; }

  for (let i = 0; i < batch.length; i += 500) {
    const { error } = await supabase.from('penjualan_who').insert(batch.slice(i, i + 500));
    if (error) { console.error('  Error:', error.message); return; }
  }
  console.log(`  ${batch.length} rows`);
}

async function migrateStock() {
  console.log('\n--- Update-STOCK ---');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'Update-STOCK',
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) { console.log('  kosong'); return; }

  const headers = rows[0];
  const productCols = PRODUCTS.map(p => headers.indexOf(p)).filter(i => i >= 0);

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cabang = (r[0] || '').trim().toUpperCase();
    if (!cabang || cabang === 'TOTAL' || cabang.includes('WHP')) continue;
    const products = {};
    productCols.forEach(idx => { products[headers[idx]] = parseNum(r[idx]); });
    const { error } = await supabase.from('stock').upsert(
      { cabang, products },
      { onConflict: 'cabang', ignoreDuplicates: false }
    );
    if (error) console.error(`  Error ${cabang}:`, error.message);
    else count++;
  }
  console.log(`  ${count} rows`);
}

async function migrateDistribusi() {
  console.log('\n--- Distribusi ---');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'Distribusi',
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) { console.log('  kosong'); return; }

  const batch = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 4) continue;
    const tanggal = parseDate(r[0]);
    if (!tanggal) continue;
    batch.push({
      tanggal,
      gudang: (r[1] || '').trim(),
      cabang: (r[2] || '').trim().toUpperCase(),
      jumlah: parseNum(r[3]),
    });
  }
  if (batch.length === 0) { console.log('  tidak ada data valid'); return; }

  for (let i = 0; i < batch.length; i += 500) {
    const { error } = await supabase.from('distribusi').insert(batch.slice(i, i + 500));
    if (error) { console.error('  Error:', error.message); return; }
  }
  console.log(`  ${batch.length} rows`);
}

async function migratePenerimaan() {
  console.log('\n--- Penerimaan ---');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'Penerimaan',
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) { console.log('  kosong'); return; }

  const batch = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    const tanggal = parseDate(r[0]);
    if (!tanggal) continue;
    batch.push({
      tanggal,
      gudang: (r[1] || '').trim(),
      jumlah: parseNum(r[2]),
    });
  }
  if (batch.length === 0) { console.log('  tidak ada data valid'); return; }

  const { error } = await supabase.from('penerimaan').insert(batch);
  if (error) { console.error('  Error:', error.message); return; }
  console.log(`  ${batch.length} rows`);
}

async function migrateBiz() {
  console.log('\n--- BIZ ---');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'BIZ',
  });
  const rows = res.data.values;
  if (!rows || rows.length < 5) { console.log('  kosong atau data tidak cukup'); return; }

  const periode = (rows[1]?.[8] || '').replace('Stok Barang ALL Cabang Periode : ', '').trim() || 'unknown';
  const headers = rows[3];

  const productCols = [];
  for (let j = 2; j < headers.length; j++) {
    const name = String(headers[j]).trim();
    if (name) productCols.push({ col: j, name });
  }

  // Hapus data periode sebelumnya
  await supabase.from('biz_stock').delete().eq('periode', periode);

  let count = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const cabang = getBizCabang(r);
    if (!cabang) continue;

    const products = {};
    productCols.forEach(pc => { products[pc.name] = parseNum(r[pc.col]); });

    const { error } = await supabase.from('biz_stock').insert({ cabang, products, periode });
    if (error) console.error(`  Error ${cabang}:`, error.message);
    else count++;
  }
  console.log(`  ${count} rows (periode: ${periode})`);
}

async function seedBranches() {
  console.log('\n--- Seed Branches ---');
  const allCabang = new Set();

  // Collect from all sheets
  const who = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Update-Penjualan WHO' })).data.values;
  if (who) for (let i = 1; i < who.length; i++) { const c = (who[i]?.[1] || '').trim().toUpperCase(); if (c) allCabang.add(c); }

  const stock = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Update-STOCK' })).data.values;
  if (stock) for (let i = 1; i < stock.length; i++) { const c = (stock[i]?.[0] || '').trim().toUpperCase(); if (c && c !== 'TOTAL' && !c.includes('WHP')) allCabang.add(c); }

  const dist = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Distribusi' })).data.values;
  if (dist) for (let i = 1; i < dist.length; i++) { const c = (dist[i]?.[2] || '').trim().toUpperCase(); if (c) allCabang.add(c); }

  const penerimaan = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Penerimaan' })).data.values;
  if (penerimaan) for (let i = 1; i < penerimaan.length; i++) { const c = (penerimaan[i]?.[1] || '').trim().toUpperCase(); if (c) allCabang.add(c); }

  const { data: existing } = await supabase.from('branches').select('name');
  const existingNames = new Set((existing || []).map(b => b.name));
  const missing = [...allCabang].filter(c => !existingNames.has(c)).sort();

  if (missing.length === 0) { console.log('  Semua cabang sudah ada'); return; }
  console.log('  Cabang baru:', missing);

  for (const name of missing) {
    const isGudang = name.startsWith('GUDANG ');
    const whp = isGudang ? name.replace('GUDANG ', '') : (name === 'BANYUMAS' ? 'BANDUNG' : 'BANDUNG');
    const { error } = await supabase.from('branches').insert({
      name, whp, is_full_time: false, lead_time: isGudang ? 1 : 3, is_active: true,
    });
    if (error) console.error(`  Error ${name}:`, error.message);
    else console.log(`  + ${name} (whp: ${whp})`);
  }
}

async function main() {
  console.log('=== MIGRASI GOOGLE SHEETS -> SUPABASE ===');
  await seedBranches();
  await migratePenjualanWho();
  await migrateStock();
  await migrateDistribusi();
  await migratePenerimaan();
  await migrateBiz();
  console.log('\n=== SELESAI ===');
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
