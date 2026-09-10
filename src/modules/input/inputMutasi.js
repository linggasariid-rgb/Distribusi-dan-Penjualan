import { state } from '../../state/appState.js';
import { submitPastedData } from './submitHelper.js';

export function processPasteMutasi() {
  const text = document.getElementById('mutasi-paste-area').value.trim();
  const container = document.getElementById('mutasi-preview');
  const submitContainer = document.getElementById('mutasi-submit-container');

  state.pastedDataCache['mutasi_cabang'] = null;

  if (!text) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Silakan paste data terlebih dahulu.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  const rows = text.split('\n').filter(row => row.trim() !== '');
  let data = rows.map(row => row.split('\t'));

  if (data.length < 2) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Minimal 2 baris (header + 1 data).</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  state.pastedDataCache['mutasi_cabang'] = data;

  let tableHTML = '<table class="w-full text-xs text-left border-collapse border border-slate-200"><thead class="bg-slate-100 sticky top-0"><tr class="text-slate-600 uppercase text-[10px] tracking-wider">';
  let htmlBody = '<tbody class="divide-y divide-slate-100">';

  data.forEach((row, i) => {
    if (i === 0) {
      row.forEach((c, j) => tableHTML += `<th class="px-4 py-3 font-bold border border-slate-200 whitespace-nowrap">${c || 'Kolom '+(j+1)}</th>`);
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

export function submitDataMutasi() {
  const button = document.querySelector('#mutasi-submit-container button');
  submitPastedData({
    rpcName: 'saveMutasi',
    cacheKey: 'mutasi_cabang',
    idPrefix: 'mutasi',
    button: button,
    offerReload: true,
    historyTable: 'mutasi_cabang',
    historyContainerId: 'mutasi-history',
  });
}

export function clearMutasiForm() {
  document.getElementById('mutasi-paste-area').value = '';
  document.getElementById('mutasi-preview').innerHTML = '';
  document.getElementById('mutasi-submit-container').classList.add('hidden');
  state.pastedDataCache['mutasi_cabang'] = null;
}
