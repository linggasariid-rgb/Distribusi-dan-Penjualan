import { callApi } from '../../services/api.js';
import { showToast } from '../../ui/toast.js';

let state = {
  bulanIni: '',
  bulanBanding: '',
  namaBulanIni: '',
  namaBulanBanding: '',
  bulanTanpaNama: [],
  punyaNama: true,
  rows: [],
  sortKey: 'selisih',
  sortDir: -1,
};

// Nilai di bawah berasal dari database dan dari paste Excel, jadi tidak
// dipercaya. Tanpa escaping, satu nama berisi <img onerror=...> akan
// dieksekusi setiap kali tabel dirender.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Jumlah kolom: Nama, Tipe, Cabang, Pemilik, Kontak, Total Ini,
// Total Banding, Selisih, Tren. Kolom Pemilik+Kontak disembunyikan
// saat punyaNama === false, jadi 7 kolom.
function kolomAktif() {
  return state.punyaNama ? 9 : 7;
}

export function hitungSelisih(baris) {
  const ini = Number(baris.ini_bungkus) || 0;
  const banding = Number(baris.banding_bungkus) || 0;
  const selisih = ini - banding;

  if (banding === 0 && ini > 0) return { selisih, tren: 'baru' };
  if (ini === 0 && banding > 0) return { selisih, tren: 'berhenti' };
  if (banding === 0 && ini === 0) return { selisih: 0, tren: 'tetap' };

  return {
    selisih,
    tren: selisih > 0 ? 'naik' : selisih < 0 ? 'turun' : 'tetap',
  };
}

const TREN = {
  baru:     { simbol: '▲', warna: 'text-emerald-600', label: 'Baru' },
  naik:     { simbol: '▲', warna: 'text-emerald-600', label: 'Naik' },
  turun:    { simbol: '▼', warna: 'text-red-600', label: 'Turun' },
  berhenti: { simbol: '▼', warna: 'text-red-600', label: 'Berhenti' },
  tetap:    { simbol: '=', warna: 'text-slate-400', label: 'Sama' },
};

function nilaiSort(item, key) {
  if (key === 'ini_bungkus' || key === 'banding_bungkus') return Number(item[key]) || 0;
  return hitungSelisih(item).selisih;
}

export function groupPerCabang(items, sortKey) {
  const map = {};
  for (const r of items) {
    const cab = r.cabang || '(TANPA CABANG)';
    if (!map[cab]) map[cab] = [];
    map[cab].push(r);
  }
  const dir = state.sortDir;
  return Object.keys(map).sort().map(cab => ({
    cabang: cab,
    items: map[cab].sort((a, b) => {
      const d = nilaiSort(a, sortKey) - nilaiSort(b, sortKey);
      if (d !== 0) return d * dir;
      return String(a.nama_customer).localeCompare(String(b.nama_customer));
    }),
  }));
}

function populateCabangFilter() {
  const sel = document.getElementById('banding-cabang');
  const cabang = [...new Set(state.rows.map(r => r.cabang).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">Semua Cabang</option>';
  cabang.forEach(c => sel.add(new Option(c, c)));
}

function getFiltered() {
  const v = document.getElementById('banding-cabang').value;
  return v === 'ALL' ? state.rows : state.rows.filter(r => r.cabang === v);
}

function sortIndicator(key) {
  if (state.sortKey !== key) return '';
  return state.sortDir === -1 ? ' &#9660;' : ' &#9650;';
}

function renderWarning() {
  const box = document.getElementById('banding-warning');
  const txt = document.getElementById('banding-warning-text');
  if (state.punyaNama) {
    box.classList.add('hidden');
    box.classList.remove('flex');
    return;
  }
  // Sebut bulan yang benar-benar tanpa nama, bukan selalu bulan pembanding:
  // "Bulan Ini = Agustus" vs "Bulan Banding = September" pasti salah kalau
  // pesannya menyebut September.
  const bulan = state.bulanTanpaNama.length ? state.bulanTanpaNama.join(' dan ')
    : state.namaBulanBanding;
  txt.textContent = bulan + ' masih tersimpan sebagai kode MST / MSI / STK, bukan nama mitra, '
    + 'sedangkan bulan yang lain memakai nama asli. Karena kedua sisi tidak bisa dipasangkan, '
    + 'kolom Selisih dan Tren di tabel ini tidak boleh dibaca sebagai perubahan penjualan. '
    + 'Kolom Total per bulan tetap akurat.';
  box.classList.remove('hidden');
  box.classList.add('flex');
}

function renderBanding() {
  renderWarning();

  const thead = document.getElementById('banding-thead');
  const tbody = document.getElementById('banding-tbody');
  const tfoot = document.getElementById('banding-tfoot');
  const cols = kolomAktif();

  const thSort = (key, label, extra) =>
    `<th data-sort="${key}" class="px-4 py-3 ${extra} cursor-pointer select-none hover:bg-slate-100">${esc(label)}${sortIndicator(key)}</th>`;

  let headHtml = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Nama</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Tipe</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Cabang</th>`;
  if (state.punyaNama) {
    headHtml += `<th class="px-4 py-3 text-left whitespace-nowrap">Pemilik</th>
      <th class="px-4 py-3 text-left whitespace-nowrap">Kontak</th>`;
  }
  headHtml += thSort('ini_bungkus', 'Total ' + state.namaBulanIni, 'text-right')
    + thSort('banding_bungkus', 'Total ' + state.namaBulanBanding, 'text-right')
    + thSort('selisih', 'Selisih', 'text-right')
    + `<th class="px-4 py-3 text-center whitespace-nowrap">Tren</th></tr>`;
  thead.innerHTML = headHtml;

  thead.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (state.sortKey === key) state.sortDir = -state.sortDir;
      else { state.sortKey = key; state.sortDir = -1; }
      renderBanding();
    });
  });

  const filtered = getFiltered();
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + cols +
      '" class="px-4 py-8 text-center text-slate-500">Tidak ada data belanja pada bulan yang dipilih.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  const redup = state.punyaNama ? '' : 'opacity-50';
  const title = 'Selisih tidak akurat: bulan pembanding memakai data tanpa nama mitra.';
  const num = n => Number(n || 0).toLocaleString('id-ID');
  const badge = t => {
    const up = String(t || '').toUpperCase();
    const cls = up === 'MST' ? 'bg-amber-100 text-amber-700'
      : up === 'MSI' ? 'bg-purple-100 text-purple-700'
      : 'bg-blue-100 text-blue-700';
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${cls}">${esc(up)}</span>`;
  };

  const sections = groupPerCabang(filtered, state.sortKey);
  let bodyHtml = '';
  let grandIni = 0, grandBanding = 0, grandSelisih = 0;

  sections.forEach(sec => {
    let cabIni = 0, cabBanding = 0;
    bodyHtml += `<tr class="bg-slate-800 text-white">
      <td colspan="${cols}" class="px-4 py-2 font-bold uppercase tracking-wider">=== CABANG: ${esc(sec.cabang)} ===</td>
    </tr>`;

    sec.items.forEach(item => {
      const s = hitungSelisih(item);
      const tr = TREN[s.tren];
      cabIni += item.ini_bungkus;
      cabBanding += item.banding_bungkus;
      grandIni += item.ini_bungkus;
      grandBanding += item.banding_bungkus;
      grandSelisih += s.selisih;

      bodyHtml += `<tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-2 font-bold text-slate-700 whitespace-nowrap">${esc(item.nama_customer)}</td>
        <td class="px-4 py-2 whitespace-nowrap">${badge(item.tipe)}</td>
        <td class="px-4 py-2 text-slate-600 whitespace-nowrap">${esc(item.cabang || '(TANPA CABANG)')}</td>`;

      if (state.punyaNama) {
        const pemilik = item.pemilik
          ? `<span class="text-slate-600">${esc(item.pemilik)}</span>`
          : '<span class="text-slate-300">—</span>';
        // Hanya digit yang lolos ke URL wa.me; sisanya di-escape sebagai teks.
        const wa = String(item.kontak || '').replace(/\D/g, '');
        const kontak = item.kontak
          ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener" class="text-emerald-600 hover:underline font-mono">${esc(item.kontak)}</a>`
          : '<span class="text-slate-300">—</span>';
        bodyHtml += `<td class="px-4 py-2 whitespace-nowrap">${pemilik}</td>
          <td class="px-4 py-2 whitespace-nowrap">${kontak}</td>`;
      }

      bodyHtml += `<td class="px-4 py-2 text-right font-mono text-slate-700">${num(item.ini_bungkus)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-500">${num(item.banding_bungkus)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold ${tr.warna} ${redup}" title="${esc(title)}">${tr.simbol} ${s.selisih > 0 ? '+' : ''}${num(s.selisih)}</td>
        <td class="px-4 py-2 text-center font-bold ${tr.warna} ${redup}" title="${esc(title)}">${tr.simbol}<span class="sr-only">${tr.label}</span></td>
      </tr>`;
    });

    bodyHtml += `<tr class="bg-slate-100 font-bold text-sm">
      <td colspan="3" class="px-4 py-2 uppercase tracking-wider">SUBTOTAL CABANG ${esc(sec.cabang)}</td>`;
    if (state.punyaNama) bodyHtml += `<td colspan="2"></td>`;
    bodyHtml += `<td class="px-4 py-2 text-right font-mono">${num(cabIni)}</td>
      <td class="px-4 py-2 text-right font-mono">${num(cabBanding)}</td>
      <td class="px-4 py-2 text-right font-mono">${cabIni - cabBanding > 0 ? '+' : ''}${num(cabIni - cabBanding)}</td>
      <td></td></tr>`;
  });

  tbody.innerHTML = bodyHtml;

  tfoot.innerHTML = `<tr>
    <td colspan="3" class="px-4 py-3 text-right uppercase tracking-wider">GRAND TOTAL KESELURUHAN</td>
    ${state.punyaNama ? '<td colspan="2"></td>' : ''}
    <td class="px-4 py-3 text-right font-mono">${num(grandIni)}</td>
    <td class="px-4 py-3 text-right font-mono">${num(grandBanding)}</td>
    <td class="px-4 py-3 text-right font-mono">${grandSelisih > 0 ? '+' : ''}${num(grandSelisih)}</td>
    <td></td></tr>`;
}

export function loadBandingkanBelanja() {
  const bulanIni = document.getElementById('banding-bulan-ini').value;
  const bulanBanding = document.getElementById('banding-bulan-banding').value;

  if (!bulanIni || !bulanBanding) {
    alert('Pilih Bulan Ini dan Bulan Banding terlebih dahulu.');
    return Promise.resolve();
  }

  const loader = document.getElementById('banding-loader');
  const content = document.getElementById('banding-content');
  loader.classList.remove('hidden');
  loader.classList.add('flex');
  content.classList.add('hidden');

  return callApi('getBandingkanBelanja', bulanIni, bulanBanding)
    .then(res => {
      const d = res.data || {};
      state.bulanIni = d.bulan_ini || bulanIni;
      state.bulanBanding = d.bulan_banding || bulanBanding;
      state.namaBulanIni = d.nama_bulan_ini || bulanIni;
      state.namaBulanBanding = d.nama_bulan_banding || bulanBanding;
      state.bulanTanpaNama = Array.isArray(d.bulan_tanpa_nama) ? d.bulan_tanpa_nama : [];
      state.punyaNama = d.punya_nama !== false;
      state.rows = d.rows || [];
      populateCabangFilter();
      renderBanding();
    })
    .catch(err => alert('Gagal memuat perbandingan: ' + err.message))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    });
}

let sudahInit = false;

export function initBandingkanBelanja() {
  // Router memanggil ini tiap menu dibuka selama tbody masih kosong; tanpa
  // penjaga, listener klik HEADER sort akan terpasang berkali-kali.
  if (sudahInit) return;
  sudahInit = true;

  const ini = document.getElementById('banding-bulan-ini');
  const banding = document.getElementById('banding-bulan-banding');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const bulanIni = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const bulanBanding = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  ini.value = bulanIni;
  banding.value = bulanBanding;

  document.getElementById('btn-banding-terapkan').addEventListener('click', loadBandingkanBelanja);
  // Filter cabang hanya render ulang; tidak menembak API lagi.
  document.getElementById('banding-cabang').addEventListener('change', renderBanding);
  document.getElementById('btn-banding-export').addEventListener('click', exportBandingkanBelanja);

  loadBandingkanBelanja();
}

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function kapitalisasi(teks) {
  return teks.replace(/\b[a-z]/g, c => c.toUpperCase());
}

function bulanTeks(ym) {
  const parts = String(ym || '').split('-');
  if (parts.length !== 2) return String(ym || '');
  return (BULAN_NAMES[Number(parts[1]) - 1] || parts[1]) + ' ' + parts[0];
}

export function exportBandingkanBelanja() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }

  const filtered = getFiltered();
  if (filtered.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const cabangFilter = document.getElementById('banding-cabang').value;
  const cabangHeader = cabangFilter === 'ALL' ? 'SEMUA CABANG' : cabangFilter;
  const kolom = kolomAktif();

  const rows = [];
  rows.push(['PT TRIDAYA SINERGI INDONESIA']);
  rows.push([`PERBANDINGAN BELANJA ${cabangHeader}`]);
  rows.push([`BULAN INI: ${bulanTeks(state.bulanIni)}`]);
  rows.push([`BULAN BANDING: ${bulanTeks(state.bulanBanding)}`]);
  rows.push([]);

  const header = ['NAMA', 'TIPE', 'CABANG'];
  if (state.punyaNama) header.push('PEMILIK', 'HP / TELEPON');
  header.push(
    `TOTAL ${bulanTeks(state.bulanIni)}`,
    `TOTAL ${bulanTeks(state.bulanBanding)}`,
    'SELISIH', 'TREN'
  );
  rows.push(header);

  const sections = groupPerCabang(filtered, state.sortKey);
  let grandIni = 0, grandBanding = 0, grandSelisih = 0;

  sections.forEach(sec => {
    rows.push([`=== CABANG: ${sec.cabang} ===`]);
    let cabIni = 0, cabBanding = 0;

    sec.items.forEach(item => {
      const s = hitungSelisih(item);
      cabIni += item.ini_bungkus;
      cabBanding += item.banding_bungkus;
      grandIni += item.ini_bungkus;
      grandBanding += item.banding_bungkus;
      grandSelisih += s.selisih;

      const row = [item.nama_customer, item.tipe, item.cabang || '(TANPA CABANG)'];
      if (state.punyaNama) row.push(item.pemilik || '', item.kontak || '');
      row.push(
        item.ini_bungkus,
        item.banding_bungkus,
        s.selisih,
        TREN[s.tren].simbol
      );
      rows.push(row);
    });

    const sub = ['', '', `SUBTOTAL CABANG ${sec.cabang}`];
    if (state.punyaNama) sub.push('', '');
    sub.push(cabIni, cabBanding, cabIni - cabBanding, '');
    rows.push(sub);
    rows.push([]);
  });

  const grand = ['', '', 'GRAND TOTAL KESELURUHAN'];
  if (state.punyaNama) grand.push('', '');
  grand.push(grandIni, grandBanding, grandSelisih, '');
  rows.push(grand);

  if (!state.punyaNama) {
    const bulan = state.bulanTanpaNama.length ? state.bulanTanpaNama.join(' dan ')
      : state.namaBulanBanding;
    rows.push([]);
    rows.push([]);
    rows.push([`CATATAN: ${bulan} masih menggunakan data tanpa nama mitra. Selisih per mitra tidak akurat.`]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Styling mengikuti exportRekapBelanja() di rekapBelanja.js
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = ws[key];
    const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10) - 1;
    if (typeof cell.v === 'number') cell.z = '#,##0';

    if (rowNum === 5) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  rows.forEach((rData, rIdx) => {
    if (rIdx <= 5) return;
    // Label cabang ada di kolom 0; label subtotal & grand total ada di kolom 2.
    const isCabang = rData[0] && String(rData[0]).includes('=== CABANG');
    const isTotal = rData[2] && (String(rData[2]).includes('GRAND TOTAL') || String(rData[2]).includes('SUBTOTAL CABANG'));
    if (!isCabang && !isTotal) return;

    for (let c = 0; c < kolom; c++) {
      const ref = XLSX.utils.encode_cell({ c, r: rIdx });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };
      ws[ref].s = isCabang
        ? { font: { bold: true, color: { rgb: '0F172A' } }, fill: { fgColor: { rgb: 'E2E8F0' } } }
        : { font: { bold: true }, fill: { fgColor: { rgb: 'CBD5E1' } } };
    }
  });

  const colWidths = [];
  for (let c = 0; c < kolom; c++) {
    let min = 10;
    if (c === 0) min = 32;            // NAMA
    else if (c === 1) min = 10;       // TIPE
    else if (c === 2) min = 16;       // CABANG
    else if (c >= kolom - 4) min = 18; // kolom angka + header (Total x2, Selisih, Tren)
    const max = Math.max(min, ...rows.map(r => String(r[c] == null ? '' : r[c]).length));
    colWidths.push({ wch: max });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bandingkan Belanja');

  // Nama file dinamis mengikuti bulan yang dipilih user, bukan bulan default.
  const namaIni = bulanTeks(state.bulanIni).toLowerCase();
  const namaBanding = bulanTeks(state.bulanBanding).toLowerCase();
  const fileName = `Data Belanja ${kapitalisasi(namaBanding)} VS ${kapitalisasi(namaIni)}.xlsx`;

  XLSX.writeFile(wb, fileName);
  showToast('File Excel berhasil diunduh: ' + fileName, 'success');
}
