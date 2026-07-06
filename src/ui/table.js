export function renderPivotTable(container, branches, rows, title) {
  let html = '<div id="pivot-report-area" class="p-4 sm:p-6">';
  html += '<h3 class="text-lg font-bold mb-4" style="color:var(--color-text)">' + title + '</h3>';
  html += '<div class="overflow-x-auto rounded-xl border" style="border-color:var(--color-border)"><table class="w-full text-xs text-left border-collapse">';
  html += '<thead><tr style="background:var(--color-bg-alt);color:var(--color-text-muted);text-transform:uppercase;font-size:10px;font-weight:700;letter-spacing:0.05em">';
  html += '<th class="px-3 py-3 border-b sticky left-0 z-10" style="background:var(--color-bg-alt);border-color:var(--color-border)">Tanggal</th>';
  branches.forEach(function(b) {
    html += '<th class="px-3 py-3 border-b text-right whitespace-nowrap" style="border-color:var(--color-border)">' + b + '</th>';
  });
  html += '<th class="px-3 py-3 border-b text-right" style="background:var(--color-accent-light);color:var(--color-accent);border-color:var(--color-border)">Grand Total</th></tr></thead>';
  html += '<tbody class="divide-y" style="border-color:var(--color-border)">';
  rows.forEach(function(row) {
    var isEven = rows.indexOf(row) % 2 === 0;
    var rowBg = isEven ? 'var(--color-surface)' : 'var(--color-bg)';
    html += '<tr style="transition:background-color 150ms;background:' + rowBg + '"><td class="px-3 py-2.5 font-bold sticky left-0 z-10" style="color:var(--color-text);background:' + rowBg + '">' + row.date + '</td>';
    branches.forEach(function(b) {
      var val = row[b] || 0;
      var display = val > 0 ? val.toLocaleString('id-ID') : '<span style="color:var(--color-text-muted)">&ndash;</span>';
      html += '<td class="px-3 py-2.5 text-right font-medium" style="' + (val > 0 ? 'color:var(--color-text)' : '') + '">' + display + '</td>';
    });
    html += '<td class="px-3 py-2.5 text-right font-black" style="color:var(--color-accent);background:var(--color-accent-light)">' + row.grandTotal.toLocaleString('id-ID') + '</td></tr>';
  });
  html += '</tbody></table></div></div>';
  container.innerHTML = html;
}
