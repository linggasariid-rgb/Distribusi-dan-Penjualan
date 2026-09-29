// Cek endpoint bandingkan-belanja terhadap data Supabase sungguhan.
//
// Berbeda dari test lain di folder ini, skrip ini BUTUH kredensial dan jaringan:
// ia membaca .env lalu memanggil database secara langsung. Jalankan manual
// sebelum deploy atau saat menyelidiki angka yang tidak sesuai di layar.
//
//   node tests/live-banding-check.mjs
//
// Semua pemeriksaan di bawah bersifat INVARIAN, bukan angka persis. Versi
// sebelumnya meng-hardcode jumlah baris dan total bungkus (577 / 1.024.944),
// lalu gagal begitu ada upload baru -- termasuk upload yang sepenuhnya normal.
// Data penjualan bertambah setiap bulan, jadi test yang memegangnya pada angka
// tertentu hanya dijamin gagal dan tidak pernah menangkap bug. Yang diuji
// justru sifat yang HARUS berlaku apa pun isinya: tipe valid, tanpa duplikat,
// tanpa pengali ganda, dan bulan tanpa nama terbaca.
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
// Untuk nilai yang benar varyabel (jumlah baris, total bungkus), cukup dipastikan
// bertipe benar dan tidak negatif, bukan dibandingkan ke angka tetap.
const cekTipe = (nama, aktual, predsikat) => {
  const ok = predsikat(aktual);
  if (!ok) gagal++;
  console.log((ok ? '  OK   ' : '  GAGAL') + ' ' + nama + ' = ' + aktual + (ok ? '' : ' (melanggar invarian)'));
};

const KODE_TANPA_NAMA = new Set([
  'MST', 'MSI', 'STK', 'STOKIS', 'ORE', 'ORM', 'KARYAWAN', 'TSIEMPLOYEE', 'TSIAPPS', 'APPS',
]);

// Dua bulan yang paling sering dibandingkan. Bisa diubah lewat env tanpa
// menyentuh file, supaya test ini tidak perlu diedit setiap kali bulan berganti.
const BULAN_INI = process.env.BULAN_INI || '2026-09';
const BULAN_BANDING = process.env.BULAN_BANDING || '2026-08';

console.log('=== 1. ' + BULAN_INI + ' vs ' + BULAN_BANDING + ' ===');
const r1 = await handle(db, BULAN_INI, BULAN_BANDING);
cek('status', r1.status, 'success');
cek('bulan_ini', r1.data.bulan_ini, BULAN_INI);
cek('bulan_banding', r1.data.bulan_banding, BULAN_BANDING);
cekTipe('jumlah baris', r1.data.rows.length, n => Number.isInteger(n) && n > 0);
const totalIni1 = r1.data.rows.reduce((s, x) => s + x.ini_bungkus, 0);
cekTipe('total bungkus bulan ini', totalIni1, n => Number.isFinite(n) && n > 0);
cek('semua tipe valid', r1.data.rows.every(x => ['MST', 'MSI', 'STK'].includes(x.tipe)), true);
cek('semua angka finite', r1.data.rows.every(x => Number.isFinite(x.ini_bungkus) && Number.isFinite(x.banding_bungkus)), true);
cek('tidak ada duplikat', new Set(r1.data.rows.map(x => x.cabang + '||' + x.nama_customer)).size, r1.data.rows.length);

// punya_nama harus terikat ke bulan yang BENAR-benar tanpa nama, bukan hanya
// bulan pembanding. Dulu hanya bulan pembanding yang dicek, sehingga
// "Agustus vs September" lolos sebagai punya_nama=true, banner peringatan
// disembunyikan, dan angka yang tidak berpasangan ditampilkan seolah sah.
const iniTanpaNama = r1.data.rows.some(x => KODE_TANPA_NAMA.has(String(x.nama_customer).toUpperCase()));
cek('punya_nama konsisten dengan isi data', r1.data.punya_nama, !iniTanpaNama);
cek('daftar bulan tanpa nama terisi saat ada kode polos',
  r1.data.bulan_tanpa_nama.length > 0, iniTanpaNama);
if (r1.data.bulan_tanpa_nama.length) {
  console.log('       bulan terdeteksi tanpa nama: ' + r1.data.bulan_tanpa_nama.join(', '));
  cek('daftar hanya berisi bulan yang dibandingkan',
    r1.data.bulan_tanpa_nama.every(n => n === r1.data.nama_bulan_ini || n === r1.data.nama_bulan_banding), true);
} else {
  console.log('       kedua bulan sudah punya nama mitra.');
}

console.log('\n=== 2. Bulan sama: tidak ada pengali ganda ===');
const r2 = await handle(db, BULAN_INI, BULAN_INI);
const totalIni2 = r2.data.rows.reduce((s, x) => s + x.ini_bungkus, 0);
cek('semua banding_bungkus 0', r2.data.rows.every(x => x.banding_bungkus === 0), true);
// Bulan yang sama tidak boleh menggandakan total: kasus 1 dan 2 harus
// menghasilkan angka bulan ini yang identik.
cek('total bulan ini tidak berganda saat bulan sama', totalIni2, totalIni1);
cek('jumlah baris bulan sama tidak melebihi gabungan', r2.data.rows.length <= r1.data.rows.length, true);
// Bulan yang sama tidak boleh masuk daftar bulan tanpa nama dua kali.
cek('bulan_tanpa_nama tanpa duplikat',
  new Set(r2.data.bulan_tanpa_nama).size, r2.data.bulan_tanpa_nama.length);

console.log('\n=== 3. Arah terbalik: bulan tanpa nama dipindah ke "Bulan Ini" ===');
const r3 = await handle(db, BULAN_BANDING, BULAN_INI);
cek('punya_nama tidak bocor lewat arah pembanding', r3.data.punya_nama, r1.data.punya_nama);
cek('daftar bulan tanpa nama sama walau dibalik',
  r3.data.bulan_tanpa_nama.join(', '), r1.data.bulan_tanpa_nama.join(', '));

console.log('\n=== 4. Bulan tidak valid ditolak ===');
for (const bad of ['2026-13', '2026-00', 'september', '2026-9', '2026-1x']) {
  cek('tolak ' + bad, (await handle(db, bad, '2026-09')).status, 'error');
}
cek('tolak banding tidak valid', (await handle(db, '2026-09', '2026-13')).status, 'error');

console.log('\n=== 5. Default: bulan berjalan vs bulan sebelumnya ===');
const r4 = await handle(db, '', '');
cek('bulan_ini valid', /^\d{4}-\d{2}$/.test(r4.data.bulan_ini), true);
cek('bulan_banding valid', /^\d{4}-\d{2}$/.test(r4.data.bulan_banding), true);

console.log('\n' + (gagal === 0 ? 'SEMUA CEK LULOS' : gagal + ' CEK GAGAL'));
process.exit(gagal === 0 ? 0 : 1);
