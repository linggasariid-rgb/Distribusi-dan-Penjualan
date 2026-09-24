import { callApi } from '../../services/api.js';

let allTransactions = [];
const PRODUCT_COLS = ["SPS TSI", "SKM TSI", "SM", "SP19 TSI", "SPF", "SMM", "ST", "SSJ", "STM", "SKMF", "SK", "SNN ORG", "SNN Mind", "SNN Menthol", "SPW", "SP", "KMK", "KOOR", "SSE", "HU"];
const TOTAL_COLS = PRODUCT_COLS.length + 2; // produk + total bungkus + total nominal

export function initRekapBelanja() {
  const monthInput = document.getElementById('rekap-belanja-month');
  if (monthInput && !monthInput.value) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  document.getElementById('btn-rekap-belanja-refresh').addEventListener('click', loadRekapBelanja);
  document.getElementById('btn-rekap-belanja-export').addEventListener('click', exportRekapBelanja);
  document.getElementById('rekap-belanja-branch').addEventListener('change', renderRekapBelanja);
  const katEl = document.getElementById('rekap-belanja-kategori');
  if (katEl) katEl.addEventListener('change', renderRekapBelanja);

  loadRekapBelanja();
}

function populateBranchFilter() {
  const branchSelect = document.getElementById('rekap-belanja-branch');
  const branches = [...new Set(allTransactions.map(t => t.cabang))].sort();
  branchSelect.innerHTML = '<option value="ALL">Semua Cabang</option>';
  branches.forEach(c => branchSelect.add(new Option(c, c)));
}

export function loadRekapBelanja() {
  const month = document.getElementById('rekap-belanja-month').value;
  const loader = document.getElementById('rekap-belanja-loader');
  const content = document.getElementById('rekap-belanja-content');
  
  loader.classList.remove('hidden');
  loader.classList.add('flex');
  content.classList.add('hidden');

  callApi('getRekapBelanja', month)
    .then(res => {
      allTransactions = res.data || [];
      populateBranchFilter();
      renderRekapBelanja();
    })
    .catch(err => {
      alert('Gagal memuat rekap belanja: ' + err.message);
    })
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    });
}

function getFiltered() {
  const branchFilter = document.getElementById('rekap-belanja-branch').value;
  const kategoriEl = document.getElementById('rekap-belanja-kategori');
  const kategoriFilter = kategoriEl ? kategoriEl.value : 'ALL';
  
  let filtered = branchFilter === 'ALL' ? allTransactions : allTransactions.filter(t => t.cabang === branchFilter);
  if (kategoriFilter !== 'ALL') {
    filtered = filtered.filter(t => t.kategori === kategoriFilter);
  }
  return filtered;
}

// Kelompokkan ringkasan per cabang (abjad), lalu customer di dalamnya (abjad nama)
export function groupPerCabang(items) {
  const map = {};
  for (const t of items) {
    const cab = t.cabang || '(TANPA CABANG)';
    if (!map[cab]) map[cab] = [];
    map[cab].push(t);
  }
  return Object.keys(map).sort().map(cab => ({
    cabang: cab,
    items: map[cab].sort((a, b) => String(a.nama_customer || '').localeCompare(String(b.nama_customer || ''))),
  }));
}

function renderRekapBelanja() {
  const thead = document.getElementById('rekap-belanja-thead');
  const tbody = document.getElementById('rekap-belanja-tbody');
  const tfoot = document.getElementById('rekap-belanja-tfoot');

  // 1. Header — Nama | Tipe | Cabang | Produk... | Total Bungkus | Total Nominal
  let headHtml = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Nama</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Tipe</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Cabang</th>`;
  PRODUCT_COLS.forEach(p => {
    headHtml += `<th class="px-2 py-3 text-right whitespace-nowrap">${p}</th>`;
  });
  headHtml += `<th class="px-4 py-3 text-right whitespace-nowrap">Total Bungkus</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Total Nominal (Rp)</th></tr>`;
  thead.innerHTML = headHtml;

  // 2. Body
  const filtered = getFiltered();
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${3 + TOTAL_COLS}" class="px-4 py-8 text-center text-slate-500">Tidak ada data belanja di bulan ini.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  const sections = groupPerCabang(filtered);
  let bodyHtml = '';
  let grandSumBungkus = 0;
  let grandSumNominal = 0;
  const grandSumProds = {};
  PRODUCT_COLS.forEach(p => grandSumProds[p] = 0);

  sections.forEach(sec => {
    const cabProds = {};
    PRODUCT_COLS.forEach(p => cabProds[p] = 0);
    let cabBungkus = 0;
    let cabNominal = 0;

    bodyHtml += `<tr class="bg-slate-800 text-white">
      <td colspan="${3 + TOTAL_COLS}" class="px-4 py-2 font-bold uppercase tracking-wider">=== CABANG: ${sec.cabang} ===</td>
    </tr>`;

    sec.items.forEach(item => {
      let namaCls = 'text-slate-700 font-bold';
      if (item.kategori === 'Master Stokis') namaCls = 'text-amber-700 font-bold';
      else if (item.kategori === 'Stokis') namaCls = 'text-blue-700 font-bold';
      else if (item.kategori === 'Karyawan') namaCls = 'text-purple-700 font-bold';
      else if (item.kategori === 'Apps') namaCls = 'text-emerald-700 font-bold';

      cabBungkus += item.total_bungkus;
      cabNominal += item.total_nominal;
      grandSumBungkus += item.total_bungkus;
      grandSumNominal += item.total_nominal;

      bodyHtml += `<tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-2 ${namaCls} whitespace-nowrap">${item.nama_customer}</td>
        <td class="px-4 py-2 whitespace-nowrap">${item.kategori}</td>
        <td class="px-4 py-2 whitespace-nowrap">${item.cabang}</td>`;

      PRODUCT_COLS.forEach(p => {
        const qty = item.products[p] || 0;
        cabProds[p] += qty;
        grandSumProds[p] += qty;
        bodyHtml += `<td class="px-2 py-2 text-right font-mono ${qty > 0 ? 'text-slate-800' : 'text-slate-300'}">${qty > 0 ? qty.toLocaleString('id-ID') : '-'}</td>`;
      });

      bodyHtml += `<td class="px-4 py-2 text-right font-bold text-slate-700 font-mono">${item.total_bungkus.toLocaleString('id-ID')}</td>
        <td class="px-4 py-2 text-right font-bold text-emerald-600 font-mono">${item.total_nominal.toLocaleString('id-ID')}</td></tr>`;
    });

    // Subtotal per cabang
    bodyHtml += `<tr class="bg-slate-100 font-bold text-sm">
      <td class="px-4 py-2 uppercase tracking-wider" colspan="3">SUBTOTAL CABANG ${sec.cabang}</td>`;
    PRODUCT_COLS.forEach(p => {
      bodyHtml += `<td class="px-2 py-2 text-right font-mono">${cabProds[p] > 0 ? cabProds[p].toLocaleString('id-ID') : '-'}</td>`;
    });
    bodyHtml += `<td class="px-4 py-2 text-right font-mono">${cabBungkus.toLocaleString('id-ID')}</td>
      <td class="px-4 py-2 text-right text-emerald-700 font-mono">${cabNominal.toLocaleString('id-ID')}</td></tr>`;
  });

  tbody.innerHTML = bodyHtml;

  // 3. Grand Total footer
  let footHtml = `<tr><td colspan="3" class="px-4 py-3 text-right uppercase tracking-wider">GRAND TOTAL KESELURUHAN</td>`;
  PRODUCT_COLS.forEach(p => {
    footHtml += `<td class="px-2 py-3 text-right font-mono">${grandSumProds[p] > 0 ? grandSumProds[p].toLocaleString('id-ID') : '-'}</td>`;
  });
  footHtml += `<td class="px-4 py-3 text-right font-bold font-mono">${grandSumBungkus.toLocaleString('id-ID')}</td>
    <td class="px-4 py-3 text-right font-bold text-emerald-700 font-mono">${grandSumNominal.toLocaleString('id-ID')}</td></tr>`;
  tfoot.innerHTML = footHtml;
}

export function exportRekapBelanja() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }

  const filtered = getFiltered();
  if (filtered.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const branchFilter = document.getElementById('rekap-belanja-branch').value;
  const katExEl = document.getElementById('rekap-belanja-kategori');
  const kategoriFilter = katExEl ? katExEl.value : 'ALL';
  const month = document.getElementById('rekap-belanja-month').value;

  const katLabel = kategoriFilter === 'ALL' ? 'Semua' : kategoriFilter.replace(' ', '-');
  const katHeader = kategoriFilter === 'ALL' ? 'MASTER STOKIS & STOKIS' : kategoriFilter.toUpperCase();
  const cabangHeader = branchFilter === 'ALL' ? 'SEMUA CABANG' : branchFilter;
  const [yr, mo] = month.split('-');
  const BULAN_NAMES = ['','JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  const bulanLabel = `${BULAN_NAMES[parseInt(mo)]} ${yr}`;

  const sections = groupPerCabang(filtered);
  const rows = [];

  // === HEADER ATAS ===
  rows.push(['PT TRIDAYA SINERGI INDONESIA']);
  rows.push([`REKAP BELANJA ${katHeader}`]);
  rows.push([cabangHeader]);
  rows.push([`PERIODE ${bulanLabel}`]);
  rows.push([]);

  // === HEADER KOLOM ===
  rows.push(['NAMA', 'TIPE', 'CABANG', ...PRODUCT_COLS, 'TOTAL BUNGKUS', 'TOTAL NOMINAL (Rp)']);

  const grandProds = {};
  PRODUCT_COLS.forEach(p => grandProds[p] = 0);
  let grandBungkus = 0;
  let grandNominal = 0;

  sections.forEach(sec => {
    rows.push([`=== CABANG: ${sec.cabang} ===`]);

    const cabProds = {};
    PRODUCT_COLS.forEach(p => cabProds[p] = 0);
    let cabBungkus = 0;
    let cabNominal = 0;

    sec.items.forEach(item => {
      const row = [item.nama_customer, item.kategori, item.cabang];
      PRODUCT_COLS.forEach(p => {
        const qty = item.products[p] || 0;
        cabProds[p] += qty;
        grandProds[p] += qty;
        row.push(qty || '');
      });
      row.push(item.total_bungkus);
      row.push(item.total_nominal);
      cabBungkus += item.total_bungkus;
      cabNominal += item.total_nominal;
      grandBungkus += item.total_bungkus;
      grandNominal += item.total_nominal;
      rows.push(row);
    });

    const cabSub = ['', '', `SUBTOTAL CABANG ${sec.cabang}`];
    PRODUCT_COLS.forEach(p => cabSub.push(cabProds[p] || ''));
    cabSub.push(cabBungkus);
    cabSub.push(cabNominal);
    rows.push(cabSub);
    rows.push([]);
    rows.push([]);
  });

  const grandRow = ['', '', 'GRAND TOTAL KESELURUHAN'];
  PRODUCT_COLS.forEach(p => grandRow.push(grandProds[p] || ''));
  grandRow.push(grandBungkus);
  grandRow.push(grandNominal);
  rows.push(grandRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Styling & formatting (pola lama dipertahankan)
  const numCols = 3 + PRODUCT_COLS.length + 2;
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = ws[key];
    const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10) - 1;

    if (typeof cell.v === 'number') cell.z = '#,##0';

    if (rowNum === 5) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    if (rowNum > 5 && typeof cell.v === 'string' && (cell.v.includes('GRAND TOTAL') || cell.v.includes('SUBTOTAL CABANG') || cell.v.includes('=== CABANG'))) {
      cell.s = { font: { bold: true } };
      if (cell.v.includes('=== CABANG')) {
        cell.s.fill = { fgColor: { rgb: "E2E8F0" } };
        cell.s.color = { rgb: "0F172A" };
      }
    }
  }

  rows.forEach((rData, rIdx) => {
    if (rIdx > 5 && rData[0] && String(rData[0]).includes('=== CABANG')) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ c: c, r: rIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "0F172A" } },
          fill: { fgColor: { rgb: "E2E8F0" } }
        };
      }
    } else if (rIdx > 5 && rData[2] && (String(rData[2]).includes('GRAND TOTAL') || String(rData[2]).includes('SUBTOTAL CABANG'))) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ c: c, r: rIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };

        let bgColor = "F1F5F9";
        if (String(rData[2]).includes('KESELURUHAN') || String(rData[2]).includes('SUBTOTAL CABANG')) bgColor = "CBD5E1";
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: bgColor } }
        };
      }
    }
  });

  const colWidths = [];
  for (let ci = 0; ci < numCols; ci++) {
    let minWidth;
    if (ci === 0) minWidth = 32;               // NAMA
    else if (ci === 1) minWidth = 14;          // TIPE
    else if (ci === 2) minWidth = 16;          // CABANG
    else if (ci >= numCols - 2) minWidth = 16; // TOTAL
    else minWidth = 10;                        // PRODUK

    const maxContent = Math.max(
      minWidth,
      ...rows.map(r => {
        let val = r[ci] || '';
        if (typeof val === 'number') val = val.toLocaleString('id-ID');
        return String(val).length;
      })
    );
    colWidths.push({ wch: maxContent });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Belanja");

  XLSX.writeFile(wb, `Rekap_Belanja_${branchFilter}_${katLabel}_${month}.xlsx`);
}
