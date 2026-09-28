// Cek endpoint bandingkan-belanja terhadap data Supabase sungguhan.
//
// Berbeda dari test lain di folder ini, skrip iniBUTUH kredensial dan jaringan:
// ia membaca .env lalu memanggil database secara langsung. Jalankan manual
// sebelum deploy atau saat menyelidiki angka yang tidak sesuai di layar.
//
//   node tests/live-banding-check.mjs
//
// Angka harapan di bawah berasal dari data 2026-08 s/d 2026-09. Kalau bulan
// itu sudah berubah, sesuaikan yang relevan; yang paling penting adalah
// pemeriksaan yang bersifat invarian (tipe valid, tanpa duplikat, tanpa pengali
// ganda), bukan angka persisnya.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Supabase } from '../worker/src/supabase.js';
import { handle } from '../worker/src/routes/report-belanja-banding.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error('Tidak ada ' + envPath + '. Cek ini butuh SUPABASE_URL dan SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
for (const need of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!env[need]) {
    console.error('Variabel ' + need + ' tidak ada di .env.');
    process.exit(1);
  }
}
const db = new Supabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

let gagal = 0;
const cek = (nama, aktual, harap) => {
  const ok = aktual === harap;
  if (!ok) gagal++;
  console.log((ok ? '  OK   ' : '  GAGAL') + ' ' + nama + ' = ' + aktual + (ok ? '' : ' (harusnya ' + harap + ')'));
};

console.log('=== 1. September vs Agustus 2026 ===');
const r1 = await handle(db, '2026-09', '2026-08');
cek('status', r1.status, 'success');
cek('bulan_ini', r1.data.bulan_ini, '2026-09');
cek('bulan_banding', r1.data.bulan_banding, '2026-08');
cek('nama_bulan_ini', r1.data.nama_bulan_ini, 'September 2026');
cek('nama_bulan_banding', r1.data.nama_bulan_banding, 'Agustus 2026');
cek('punya_nama', r1.data.punya_nama, false);
cek('jumlah baris', r1.data.rows.length, 577);
const paired = r1.data.rows.filter(x => x.ini_bungkus > 0 && x.banding_bungkus > 0).length;
cek('pasangan', paired, 0);
cek('semua tipe valid', r1.data.rows.every(x => ['MST','MSI','STK'].includes(x.tipe)), true);
cek('semua angka finite', r1.data.rows.every(x => Number.isFinite(x.ini_bungkus) && Number.isFinite(x.banding_bungkus)), true);
cek('tidak ada duplikat', new Set(r1.data.rows.map(x => x.cabang + '||' + x.nama_customer)).size, r1.data.rows.length);
cek('semua pemilik null (kontak kosong)', r1.data.rows.every(x => x.pemilik === null), true);
let totalSep = 0; for (const x of r1.data.rows) totalSep += x.ini_bungkus;
cek('total bungkus September', totalSep, 1024944);

console.log('\n=== 2. Bulan sama: tidak ada pengali ganda ===');
const r2 = await handle(db, '2026-09', '2026-09');
cek('punya_nama', r2.data.punya_nama, true);
cek('semua banding_bungkus 0', r2.data.rows.every(x => x.banding_bungkus === 0), true);
cek('jumlah baris = jumlah grup Sept', r2.data.rows.length, 548);

console.log('\n=== 3. Bulan tidak valid ditolak ===');
for (const bad of ['2026-13', '2026-00', 'september', '2026-9', '2026-1x']) {
  const r = await handle(db, bad, '2026-09');
  cek('tolak ' + bad, r.status, 'error');
}
cek('tolak banding tidak valid', (await handle(db, '2026-09', '2026-13')).status, 'error');

console.log('\n=== 4. Default: bulan berjalan vs bulan sebelumnya ===');
const r4 = await handle(db, '', '');
cek('bulan_ini valid', /^\d{4}-\d{2}$/.test(r4.data.bulan_ini), true);
cek('bulan_banding valid', /^\d{4}-\d{2}$/.test(r4.data.bulan_banding), true);

console.log('\n' + (gagal === 0 ? 'SEMUA CEK LULOS' : gagal + ' CEK GAGAL'));
process.exit(gagal === 0 ? 0 : 1);
