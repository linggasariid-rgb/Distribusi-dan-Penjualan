import { state } from '../../state/appState.js';
import { submitPastedData } from './submitHelper.js';

export function processPasteStokExcel() {
  const text = document.getElementById('input-stok-excel-paste-area').value.trim();
  const container = document.getElementById('input-stok-excel-preview');
  const submitContainer = document.getElementById('input-stok-excel-submit-container');

  state.pastedDataCache['input_stok_excel'] = null;

  if (!text) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Silakan paste data terlebih dahulu.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  const rows = text.split('\n').filter(row => row.trim() !== '');
  let data = rows.map(row => row.split('\t'));

  if (data.length < 1) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Data kosong.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  state.pastedDataCache['input_stok_excel'] = data;

  let tableHTML = '<table class="w-full text-xs text-left border-collapse border border-slate-200"><thead class="bg-slate-100 sticky top-0"><tr class="text-slate-600 uppercase text-[10px] tracking-wider">';
  let htmlBody = '<tbody class="divide-y divide-slate-100">';

  data.forEach((row, i) => {
    htmlBody += '<tr class="hover:bg-slate-50">';
    htmlBody += `<td class="px-3 py-2 text-slate-400 font-mono text-[10px] border border-slate-200">${i+1}</td>`;
    row.forEach(c => htmlBody += `<td class="px-4 py-2 border border-slate-200 whitespace-nowrap font-mono">${c}</td>`);
    htmlBody += '</tr>';
  });

  htmlBody += '</tbody></table>';
  container.innerHTML = `<div class="text-xs text-slate-500 mb-2 font-semibold">${data.length} baris data</div>` + tableHTML;
  submitContainer.classList.remove('hidden');
}

export function submitDataStokExcel() {
  const button = document.querySelector('#input-stok-excel-submit-container button');
  submitPastedData({
    rpcName: 'savePastedDataUpdateStock',
    cacheKey: 'input_stok_excel',
    idPrefix: 'input-stok-excel',
    minLength: 1,
    button: button,
    offerReload: false,
  });
}

export function clearStockForm() {
  document.getElementById('input-stok-excel-paste-area').value = '';
  document.getElementById('input-stok-excel-preview').innerHTML = '';
  document.getElementById('input-stok-excel-submit-container').classList.add('hidden');
  state.pastedDataCache['input_stok_excel'] = null;
}
