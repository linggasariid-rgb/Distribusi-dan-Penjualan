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

// Kelompokkan transaksi per nama_customer, urutkan abjad nama
function groupByCustomer(filtered) {
  const groups = {};
  filtered.forEach(t => {
    const key = t.nama_customer;
    if (!groups[key]) groups[key] = { kategori: t.kategori, cabang: t.cabang, rows: [] };
    groups[key].rows.push(t);
  });
  // Urutkan tiap grup berdasarkan tanggal
  Object.values(groups).forEach(g => g.rows.sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
  // Urutkan nama abjad
  return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
}

function renderRekapBelanja() {
  const thead = document.getElementById('rekap-belanja-thead');
  const tbody = document.getElementById('rekap-belanja-tbody');
  const tfoot = document.getElementById('rekap-belanja-tfoot');

  // 1. Header — Nama | Tanggal | Cabang | Produk... | Total Bungkus | Total Nominal
  let headHtml = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Nama</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Tanggal</th>
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

  const groups = groupByCustomer(filtered);
  let bodyHtml = '';
  let grandSumBungkus = 0;
  let grandSumNominal = 0;
  const grandSumProds = {};
  PRODUCT_COLS.forEach(p => grandSumProds[p] = 0);

  groups.forEach(([nama, group]) => {
    let namaCls = 'text-slate-700 font-bold';
    let subtotalBg = 'bg-slate-50';
    if (group.kategori === 'Master Stokis') {
      namaCls = 'text-amber-700 font-bold';
      subtotalBg = 'bg-amber-50';
    } else if (group.kategori === 'Stokis') {
      namaCls = 'text-blue-700 font-bold';
      subtotalBg = 'bg-blue-50';
    } else if (group.kategori === 'Karyawan') {
      namaCls = 'text-purple-700 font-bold';
      subtotalBg = 'bg-purple-50';
    } else if (group.kategori === 'Apps') {
      namaCls = 'text-emerald-700 font-bold';
      subtotalBg = 'bg-emerald-50';
    }
    const rows = group.rows;
    
    let subBungkus = 0;
    let subNominal = 0;
    const subProds = {};
    PRODUCT_COLS.forEach(p => subProds[p] = 0);

    rows.forEach((t, idx) => {
      subBungkus += t.total_bungkus;
      subNominal += t.total_nominal;
      grandSumBungkus += t.total_bungkus;
      grandSumNominal += t.total_nominal;

      // Nama hanya tampil di baris pertama grup (cell digabung visual lewat rowspan)
      const nameCell = idx === 0
        ? `<td class="px-4 py-2 ${namaCls} whitespace-nowrap align-top border-t-2 border-slate-200" rowspan="${rows.length}">${nama}</td>`
        : '';
      const borderTop = idx === 0 ? 'border-t-2 border-slate-200' : '';

      bodyHtml += `<tr class="hover:bg-slate-50 transition-colors">
        ${nameCell}
        <td class="px-4 py-2 font-mono whitespace-nowrap ${borderTop}">${t.tanggal}</td>
        <td class="px-4 py-2 whitespace-nowrap ${borderTop}">${t.cabang}</td>`;
      
      PRODUCT_COLS.forEach(p => {
        const qty = t.products[p] || 0;
        subProds[p] += qty;
        grandSumProds[p] += qty;
        bodyHtml += `<td class="px-2 py-2 text-right font-mono ${borderTop} ${qty > 0 ? 'text-slate-800' : 'text-slate-300'}">${qty > 0 ? qty.toLocaleString('id-ID') : '-'}</td>`;
      });

      bodyHtml += `<td class="px-4 py-2 text-right font-bold text-slate-700 font-mono ${borderTop}">${t.total_bungkus.toLocaleString('id-ID')}</td>
        <td class="px-4 py-2 text-right font-bold text-emerald-600 font-mono ${borderTop}">${t.total_nominal.toLocaleString('id-ID')}</td>
      </tr>`;
    });

    // Baris subtotal per customer
    bodyHtml += `<tr class="${subtotalBg} font-bold text-sm">
      <td class="px-4 py-2 ${namaCls}" colspan="3">GRAND TOTAL ${nama}</td>`;
    PRODUCT_COLS.forEach(p => {
      bodyHtml += `<td class="px-2 py-2 text-right font-mono">${subProds[p] > 0 ? subProds[p].toLocaleString('id-ID') : '-'}</td>`;
    });
    bodyHtml += `<td class="px-4 py-2 text-right font-mono">${subBungkus.toLocaleString('id-ID')}</td>
      <td class="px-4 py-2 text-right text-emerald-700 font-mono">${subNominal.toLocaleString('id-ID')}</td>
    </tr>`;
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

  // Label dinamis
  const katLabel = kategoriFilter === 'ALL' ? 'Semua' : kategoriFilter.replace(' ', '-');
  const katHeader = kategoriFilter === 'ALL' ? 'MASTER STOKIS & STOKIS' : kategoriFilter.toUpperCase();
  const cabangHeader = branchFilter === 'ALL' ? 'SEMUA CABANG' : branchFilter;
  const [yr, mo] = month.split('-');
  const BULAN_NAMES = ['','JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  const bulanLabel = `${BULAN_NAMES[parseInt(mo)]} ${yr}`;

  const groups = groupByCustomer(filtered);
  const rows = [];

  // === HEADER ATAS ===
  rows.push(['PT TRIDAYA SINERGI INDONESIA']);
  rows.push([`REKAP BELANJA ${katHeader}`]);
  rows.push([cabangHeader]);
  rows.push([`PERIODE ${bulanLabel}`]);
  rows.push([]); // baris kosong

  // === HEADER KOLOM TABEL ===
  // Urutan: Tanggal | Cabang | Nama | Produk... | Total Bungkus | Total Nominal
  rows.push(['TANGGAL', 'CABANG', 'NAMA', ...PRODUCT_COLS, 'TOTAL BUNGKUS', 'TOTAL NOMINAL (Rp)']);

  const grandProds = {};
  PRODUCT_COLS.forEach(p => grandProds[p] = 0);
  let grandBungkus = 0;
  let grandNominal = 0;

  let branchGroupsMap = {};
  groups.forEach(([nama, group]) => {
    const cab = group.cabang;
    if (!branchGroupsMap[cab]) branchGroupsMap[cab] = [];
    branchGroupsMap[cab].push([nama, group]);
  });
  
  const sortedBranches = Object.keys(branchGroupsMap).sort();

  sortedBranches.forEach(cabangName => {
    if (branchFilter === 'ALL') {
      rows.push([`=== CABANG: ${cabangName} ===`]);
    }

    let branchProds = {};
    PRODUCT_COLS.forEach(p => branchProds[p] = 0);
    let branchBungkus = 0;
    let branchNominal = 0;

    branchGroupsMap[cabangName].forEach(([nama, group]) => {
      const subProds = {};
      PRODUCT_COLS.forEach(p => subProds[p] = 0);
      let subBungkus = 0;
      let subNominal = 0;

      group.rows.forEach((t, idx) => {
        const row = [t.tanggal, t.cabang, idx === 0 ? nama : ''];
        PRODUCT_COLS.forEach(p => {
          const qty = t.products[p] || 0;
          subProds[p] += qty;
          branchProds[p] += qty;
          grandProds[p] += qty;
          row.push(qty || '');
        });
        row.push(t.total_bungkus);
        row.push(t.total_nominal);
        subBungkus += t.total_bungkus;
        subNominal += t.total_nominal;
        branchBungkus += t.total_bungkus;
        branchNominal += t.total_nominal;
        grandBungkus += t.total_bungkus;
        grandNominal += t.total_nominal;
        rows.push(row);
      });

      const subtotalRow = ['', '', `GRAND TOTAL ${nama}`];
      PRODUCT_COLS.forEach(p => subtotalRow.push(subProds[p] || ''));
      subtotalRow.push(subBungkus);
      subtotalRow.push(subNominal);
      rows.push(subtotalRow);
      rows.push([]);
    });

    if (branchFilter === 'ALL') {
      const branchSubtotal = ['', '', `SUBTOTAL CABANG ${cabangName}`];
      PRODUCT_COLS.forEach(p => branchSubtotal.push(branchProds[p] || ''));
      branchSubtotal.push(branchBungkus);
      branchSubtotal.push(branchNominal);
      rows.push(branchSubtotal);
      rows.push([]); 
      rows.push([]);
    }
  });

  // Grand total keseluruhan
  const grandRow = ['', '', 'GRAND TOTAL KESELURUHAN'];
  PRODUCT_COLS.forEach(p => grandRow.push(grandProds[p] || ''));
  grandRow.push(grandBungkus);
  grandRow.push(grandNominal);
  rows.push(grandRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Styling dan Formatting
  const numCols = 3 + PRODUCT_COLS.length + 2;
  const colWidths = [];
  
  // Loop semua sel untuk apply style/format
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = ws[key];
    const colStr = key.replace(/[0-9]/g, '');
    const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10) - 1; // 0-indexed

    // Format angka dengan pemisah ribuan
    if (typeof cell.v === 'number') {
      cell.z = '#,##0';
    }

    // Styling Header Tabel (Baris ke-6 / index 5)
    if (rowNum === 5) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } }, // slate-800
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    
    // Styling baris Subtotal, Subtotal Cabang & Grand Total
    if (rowNum > 5 && typeof cell.v === 'string' && (cell.v.includes('GRAND TOTAL') || cell.v.includes('SUBTOTAL CABANG') || cell.v.includes('=== CABANG'))) {
      cell.s = { font: { bold: true } };
      // Beri warna khusus untuk header cabang
      if (cell.v.includes('=== CABANG')) {
        cell.s.fill = { fgColor: { rgb: "E2E8F0" } }; // slate-200
        cell.s.color = { rgb: "0F172A" };
      }
    }
  }

  // Tambahkan background untuk baris subtotal secara penuh
  rows.forEach((rData, rIdx) => {
    if (rIdx > 5 && rData[0] && String(rData[0]).includes('=== CABANG')) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ c: c, r: rIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "0F172A" } },
          fill: { fgColor: { rgb: "E2E8F0" } } // slate-200
        };
      }
    } else if (rIdx > 5 && rData[2] && (String(rData[2]).includes('GRAND TOTAL') || String(rData[2]).includes('SUBTOTAL CABANG'))) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ c: c, r: rIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        
        let bgColor = "F1F5F9"; // slate-100 default
        if (String(rData[2]).includes('KESELURUHAN') || String(rData[2]).includes('SUBTOTAL CABANG')) {
          bgColor = "CBD5E1"; // slate-300 untuk grand total & subtotal cabang
        };
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: bgColor } }
        };
      }
    }
  });

  // Hitung lebar kolom berdasarkan isi data
  for (let ci = 0; ci < numCols; ci++) {
    let minWidth;
    if (ci === 0) minWidth = 14;       // TANGGAL
    else if (ci === 1) minWidth = 16;  // CABANG
    else if (ci === 2) minWidth = 32;  // NAMA
    else if (ci >= numCols - 2) minWidth = 16; // TOTAL
    else minWidth = 10;                // PRODUK

    const maxContent = Math.max(
      minWidth,
      ...rows.map(r => {
        let val = r[ci] || '';
        // Jika angka yang diformat, hitung panjang estimasi dengan titik
        if (typeof val === 'number') val = val.toLocaleString('id-ID');
        return String(val).length;
      })
    );
    colWidths.push({ wch: maxContent });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Belanja");
  
  const filename = `Rekap_Belanja_${branchFilter}_${katLabel}_${month}.xlsx`;
  XLSX.writeFile(wb, filename);
}
