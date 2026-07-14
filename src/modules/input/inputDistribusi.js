import { state } from '../../state/appState.js';
import { submitPastedData } from './submitHelper.js';

export function initInputDistribusi() {
  const tglInput = document.getElementById('distribusi-tanggal');
  if (tglInput && !tglInput.value) {
    const today = new Date();
    tglInput.value = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  }
}

export function processPasteDistribusi() {
  const gudang = document.getElementById('distribusi-gudang-select').value;
  if (!gudang) {
    alert('Silakan pilih Gudang terlebih dahulu.');
    return;
  }

  const text = document.getElementById('distribusi-paste-area').value.trim();
  const container = document.getElementById('distribusi-preview');
  const submitContainer = document.getElementById('distribusi-submit-container');

  state.pastedDataCache['distribusi'] = null;

  if (!text) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Silakan isi data terlebih dahulu.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  const rows = text.split('\n').filter(row => row.trim() !== '');
  const defaultTgl = document.getElementById('distribusi-tanggal').value;

  if (!defaultTgl) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Isi Tanggal terlebih dahulu.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  let tglDisplay = defaultTgl;
  if (defaultTgl.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const p = defaultTgl.split('-');
    tglDisplay = p[2] + '/' + p[1] + '/' + p[0];
  }

  const processedData = [];
  processedData.push(['TANGGAL', 'GUDANG', 'CABANG', 'JUMLAH']);

  rows.forEach(row => {
    const parts = row.split('\t');
    if (parts.length < 2) return;

    const cabang = String(parts[0] || '').trim();
    const jumlah = String(parts[1] || '').trim();

    if (!cabang || !jumlah) return;

    processedData.push([tglDisplay, gudang, cabang.toUpperCase(), jumlah]);
  });

  if (processedData.length < 2) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Tidak ada baris data valid. Pastikan format: NamaCabang (TAB) Jumlah.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  state.pastedDataCache['distribusi'] = processedData;

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

export function submitDataDistribusi() {
  const button = document.querySelector('#distribusi-submit-container button');
  submitPastedData({
    rpcName: 'saveDistribusi',
    cacheKey: 'distribusi',
    idPrefix: 'distribusi',
    button: button,
    offerReload: true,
    historyTable: 'distribusi',
    historyContainerId: 'distribusi-history',
  });
}

export function clearDistribusiForm() {
  document.getElementById('distribusi-paste-area').value = '';
  document.getElementById('distribusi-preview').innerHTML = '';
  document.getElementById('distribusi-submit-container').classList.add('hidden');
  state.pastedDataCache['distribusi'] = null;
}
