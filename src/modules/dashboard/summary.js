import { state } from '../../state/appState.js';
import { getWHP } from './whpMapping.js';

export function renderStockSummaryTable() {
  const container = document.getElementById('stock-summary-content');
  if (!state.gData || !state.gData.result) {
      container.innerHTML = `<p class="p-8 text-center text-slate-500">Data stok tidak tersedia.</p>`;
      return;
  }

  const productList = state.gData.productList;
  let columnTotals = {};
  productList.forEach(p => columnTotals[p] = 0);
  let grandTotal = 0;

  let tableHTML = `<div class="overflow-auto table-container max-h-[70vh] rounded-xl border border-slate-200 shadow-sm"><table class="w-full text-xs text-left border-collapse">`;

  tableHTML += `<thead class="sticky top-0 z-30 bg-slate-100 shadow-sm">
                  <tr class="text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                      <th class="px-5 py-4 font-bold text-left whitespace-nowrap sticky left-0 z-40 bg-slate-100">Cabang</th>`;
  productList.forEach(p => {
      tableHTML += `<th class="px-4 py-4 font-bold text-right whitespace-nowrap">${p}</th>`;
  });
  tableHTML += `<th class="px-5 py-4 font-bold text-right whitespace-nowrap bg-slate-200 text-slate-700">Jumlah</th>
                  </tr>
                </thead>`;

  tableHTML += `<tbody class="divide-y divide-slate-100 bg-white">`;

  const selectedBranch = document.getElementById('branchFilter').value;

  let allBranches = [];
  if (state.gData.whpStockData) {
      for (const whpName in state.gData.whpStockData) {
          if (selectedBranch !== 'ALL') {
              const targetWHP = getWHP(selectedBranch);
              if (whpName !== targetWHP) continue;
          }
          allBranches.push({ name: whpName, type: 'whp', data: state.gData.whpStockData[whpName] });
      }
  }
  for (const branchKey in state.gData.result) {
      if (selectedBranch !== 'ALL' && selectedBranch !== branchKey) continue;
      allBranches.push({ name: state.gData.result[branchKey].nama, type: 'branch', data: state.gData.result[branchKey] });
  }

  allBranches.sort((a, b) => {
      if (a.type === 'whp' && b.type !== 'whp') return -1;
      if (a.type !== 'whp' && b.type === 'whp') return 1;
      return a.name.localeCompare(b.name);
  });

  allBranches.forEach(branch => {
      let rowTotal = 0;
      let rowClass = branch.type === 'whp' ? 'bg-blue-50/50 font-bold text-slate-800' : 'hover:bg-slate-50 text-slate-600 transition-colors';
      let colClass = branch.type === 'whp' ? 'bg-blue-50/50' : 'bg-white';
      let displayName = branch.type === 'whp' ? branch.name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : branch.name;

      tableHTML += `<tr class="${rowClass} group">
                      <td class="px-5 py-3 whitespace-nowrap sticky left-0 z-20 font-semibold ${colClass} group-hover:bg-slate-50 transition-colors shadow-[1px_0_0_0_rgba(241,245,249,1)]">${displayName}</td>`;

      productList.forEach(p => {
          let stock = 0;
          if (branch.type === 'whp') {
              stock = branch.data[p] || 0;
          } else {
              stock = branch.data.produk[p] ? branch.data.produk[p].currentStock : 0;
          }
          rowTotal += stock;
          columnTotals[p] += stock;
          tableHTML += `<td class="px-4 py-3 whitespace-nowrap text-right">${stock > 0 ? stock.toLocaleString('id-ID') : '<span class="text-slate-300">-</span>'}</td>`;
      });

      grandTotal += rowTotal;
      tableHTML += `<td class="px-5 py-3 whitespace-nowrap text-right text-slate-800 font-bold bg-slate-50/50">${rowTotal.toLocaleString('id-ID')}</td>
                    </tr>`;
  });

  tableHTML += `</tbody>`;

  tableHTML += `<tfoot class="sticky bottom-0 z-30 shadow-[0_-1px_0_0_rgba(226,232,240,1)]">
                  <tr class="font-bold text-slate-700 bg-slate-100">
                      <td class="px-5 py-4 whitespace-nowrap sticky left-0 z-40 bg-slate-100">Total</td>`;
  productList.forEach(p => {
      tableHTML += `<td class="px-4 py-4 whitespace-nowrap text-right">${columnTotals[p].toLocaleString('id-ID')}</td>`;
  });
  tableHTML += `<td class="px-5 py-4 whitespace-nowrap text-right bg-slate-200">${grandTotal.toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>`;

  tableHTML += `</table></div>`;
  container.innerHTML = tableHTML;
}
