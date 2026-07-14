import { state } from '../../state/appState.js';
import { submitPastedData } from './submitHelper.js';

export function initPenerimaanPabrik() {
  const tglInput = document.getElementById('penerimaan-pabrik-tanggal');
  if (tglInput && !tglInput.value) {
    const today = new Date();
    tglInput.value = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  }
}

export function processPastePabrik() {
  const gudang = document.getElementById('penerimaan-pabrik-gudang-select').value;
  if (!gudang) {
    alert('Silakan pilih Gudang terlebih dahulu.');
    return;
  }

  const text = document.getElementById('penerimaan-pabrik-paste-area').value.trim();
  const container = document.getElementById('penerimaan-pabrik-preview');
  const submitContainer = document.getElementById('penerimaan-pabrik-submit-container');

  state.pastedDataCache['penerimaan_pabrik'] = null;

  if (!text) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Silakan paste data terlebih dahulu.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  const rows = text.split('\n').filter(row => row.trim() !== '');
  let data = rows.map(row => row.split('\t'));

  if (data.length < 2 && data[0].length > 1) {
    // Header-only detection
  }
  if (data.length < 1) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Data kosong.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  const firstRow = data[0].map(h => String(h).trim().toUpperCase());
  const hasTglHeader = firstRow.some(h => h.includes('TANGGAL'));
  const hasJumlahHeader = firstRow.some(h => h.includes('JUMLAH'));

  let startRow = 0;
  let colCount = data[0].length;

  // Deteksi header
  if (hasTglHeader || hasJumlahHeader) {
    startRow = 1;
  }

  const dataRows = data.slice(startRow);
  if (dataRows.length === 0) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Tidak ada baris data setelah header.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  // Tentukan format: apakah TANGGAL+Jumlah (2 kolom) atau Jumlah saja (1 kolom)
  const isTwoCols = colCount >= 2 && !hasTglHeader;
  const hasTglCol = hasTglHeader && hasJumlahHeader;

  // Jika header 2 kolom (TANGGAL, JUMLAH), pakai tanggal dari data
  // Jika 1 kolom saja (JUMLAH), pakai tanggal dari date picker
  const defaultTgl = document.getElementById('penerimaan-pabrik-tanggal').value;

  if (!defaultTgl && !hasTglCol) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Isi Tanggal terlebih dahulu, atau paste dengan format TANGGAL + Jumlah.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  // Simpan data yang sudah diproses
  const processedData = [];
  // Header buatan untuk preview + backend
  processedData.push(['TANGGAL', 'GUDANG', 'JUMLAH']);

  dataRows.forEach(row => {
    let tgl, jumlah;
    if (hasTglCol) {
      tgl = String(row[0] || '').trim();
      jumlah = row[1] !== undefined ? String(row[1]).trim() : '';
    } else if (colCount >= 2 && !hasTglHeader) {
      // Data mentah: kolom pertama bisa TANGGAL atau Jumlah
      tgl = String(row[0] || '').trim();
      jumlah = row[1] !== undefined ? String(row[1]).trim() : '';
    } else {
      tgl = defaultTgl;
      jumlah = String(row[0] || '').trim();
    }

    if (!tgl && !jumlah) return;
    if (!jumlah) return;

    // Format tanggal DD/MM/YYYY jika dalam format YYYY-MM-DD (dari date picker)
    let tglDisplay = tgl;
    if (tgl.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const p = tgl.split('-');
      tglDisplay = p[2] + '/' + p[1] + '/' + p[0];
    } else if (tgl.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      tglDisplay = tgl;
    }

    processedData.push([tglDisplay, gudang, jumlah]);
  });

  if (processedData.length < 2) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Tidak ada baris data valid.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  state.pastedDataCache['penerimaan_pabrik'] = processedData;

  let tableHTML = '<table class="w-full text-xs text-left border-collapse border border-slate-200"><thead class="bg-slate-100 sticky top-0"><tr class="text-slate-600 uppercase text-[10px] tracking-wider">';
  let htmlBody = '<tbody class="divide-y divide-slate-100">';

  processedData.forEach((row, i) => {
    if (i === 0) {
      row.forEach((c) => tableHTML += `<th class="px-4 py-3 font-bold border border-slate-200 whitespace-nowrap">${c}</th>`);
      tableHTML += '</tr></thead>';
    } else {
      htmlBody += '<tr class="hover:bg-slate-50">';
      row.forEach(c => htmlBody += `<td class="px-4 py-2 border border-slate-200 whitespace-nowrap">${c}</td>`);
      htmlBody += '</tr>';
    }
  });

  htmlBody += '</tbody></table>';
  container.innerHTML = tableHTML + htmlBody;
  submitContainer.classList.remove('hidden');
}

export function submitDataPabrik() {
  const button = document.querySelector('#penerimaan-pabrik-submit-container button');
  submitPastedData({
    rpcName: 'savePenerimaanPabrik',
    cacheKey: 'penerimaan_pabrik',
    idPrefix: 'penerimaan-pabrik',
    button: button,
    offerReload: true,
    historyTable: 'penerimaan',
    historyContainerId: 'penerimaan-pabrik-history',
  });
}

export function clearPabrikForm() {
  document.getElementById('penerimaan-pabrik-paste-area').value = '';
  document.getElementById('penerimaan-pabrik-preview').innerHTML = '';
  document.getElementById('penerimaan-pabrik-submit-container').classList.add('hidden');
  state.pastedDataCache['penerimaan_pabrik'] = null;
}
