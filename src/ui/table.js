export function renderPivotTable(container, branches, rows, title) {
  let html = '<div id="pivot-report-area" class="p-4 sm:p-6">';
  html += `<h3 class="text-xl font-bold border-l-4 pl-3 mb-4" style="color:var(--color-header-title);border-left-color:var(--color-header-border);">${title}</h3>`;
  html += '<div class="overflow-x-auto"><table class="w-full text-xs text-left border-collapse">';
  html += '<thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold"><tr><th class="px-3 py-3 border-b sticky left-0 bg-slate-50 z-10">Tanggal</th>';
  branches.forEach(b => {
    html += `<th class="px-3 py-3 border-b text-right whitespace-nowrap">${b}</th>`;
  });
  html += '<th class="px-3 py-3 border-b text-right bg-amber-50 text-amber-700">Grand Total</th></tr></thead>';
  html += '<tbody class="divide-y divide-slate-100">';
  rows.forEach(row => {
    html += `<tr class="hover:bg-slate-50/50 transition-colors"><td class="px-3 py-2.5 font-bold text-slate-700 sticky left-0 bg-white z-10">${row.date}</td>`;
    branches.forEach(b => {
      const val = row[b] || 0;
      const display = val > 0 ? val.toLocaleString('id-ID') : '<span class="text-slate-300">&ndash;</span>';
      html += `<td class="px-3 py-2.5 text-right font-medium ${val > 0 ? 'text-slate-700' : ''}">${display}</td>`;
    });
    html += `<td class="px-3 py-2.5 text-right font-black text-amber-700 bg-amber-50/50">${row.grandTotal.toLocaleString('id-ID')}</td></tr>`;
  });
  html += '</tbody></table></div></div>';
  container.innerHTML = html;
}
