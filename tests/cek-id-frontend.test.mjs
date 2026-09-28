// Cek silang: setiap getElementById di modul baru harus ada di index.html,
// dan setiap menu/view yang dirujuk router harus punya pasangannya.
import fs from 'node:fs';

const html = fs.readFileSync('D:/Distribusi dan Penjualan/index.html', 'utf8');
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

let gagal = 0;
const cek = (nama, ok, detail) => {
  if (!ok) gagal++;
  console.log((ok ? '  OK   ' : '  GAGAL') + ' ' + nama + (detail ? ' -> ' + detail : ''));
};

function cekModul(path, label, adaIdLolos) {
  const src = fs.readFileSync(path, 'utf8');
  const ids = [...new Set([...src.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
  console.log('--- ' + label + ' (' + ids.length + " id) ---");
  for (const id of ids) {
    if (adaIdLolos && !adaIdLolos(id)) continue;
    cek(label + ' #' + id, htmlIds.has(id), htmlIds.has(id) ? '' : 'tidak ada di index.html');
  }
  return src;
}

const kontak = cekModul('D:/Distribusi dan Penjualan/src/modules/kontakMitra/kontakMitra.js', 'kontakMitra.js');
cekModul('D:/Distribusi dan Penjualan/src/modules/reports/bandingkanBelanja.js', 'bandingkanBelanja.js');

// Id yang sengaja dibaca lewat helper (bukan getElementById langsung) tetap
// harus ada di HTML.
console.log('--- id yang diakses lewat helper state.* ---');
const banding = fs.readFileSync('D:/Distribusi dan Penjualan/src/modules/reports/bandingkanBelanja.js', 'utf8');
for (const id of [...new Set([...banding.matchAll(/state\.(\w+)\s*=\s*document\.getElementById\('([^']+)'\)/g)].map(m => m[2]))]) {
  cek('banding state #' + id, htmlIds.has(id));
}

// Menu dan view yang dirujuk router
console.log('--- menu/view di router ---');
const router = fs.readFileSync('D:/Distribusi dan Penjualan/src/router.js', 'utf8');
for (const id of [...new Set([...router.matchAll(/getElementById\('(menu-[^']+|kontak-mitra-view|bandingkan-belanja-view|rekap-belanja-view)'\)/g)].map(m => m[1]))]) {
  cek('router #' + id, htmlIds.has(id));
}

// Menu yang didaftarkan di sidebarEvents harus punya elemen di HTML
console.log('--- MENU_IDS di sidebarEvents ---');
const se = fs.readFileSync('D:/Distribusi dan Penjualan/src/events/sidebarEvents.js', 'utf8');
const blok = se.match(/const MENU_IDS = \[([\s\S]*?)\];/)[1];
for (const m of blok.matchAll(/'([a-z-]+)'/g)) {
  cek('MENU ' + m[1], htmlIds.has('menu-' + m[1]));
}

// Nama menu di router harus ada di MENU_IDS (atau punya listener sendiri)
console.log('--- menuName di router ada di MENU_IDS? ---');
const namaMenu = [...new Set([...router.matchAll(/menuName === '([a-z-]+)'/g)].map(m => m[1]))];
const diMenuIds = new Set([...blok.matchAll(/'([a-z-]+)'/g)].map(m => m[1]));
for (const n of namaMenu) {
  cek('router menu "' + n + '"', diMenuIds.has(n));
}

console.log('\n' + (gagal === 0 ? 'SEMUA ID COCOK' : gagal + ' MASALAH'));
process.exit(gagal === 0 ? 0 : 1);
