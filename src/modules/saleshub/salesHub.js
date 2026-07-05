import { callApi } from '../../services/api.js';
import { getUserWHP } from '../../state/authState.js';
import { formatNum } from '../../utils/number.js';
import { showToast } from '../../ui/toast.js';

export function initSalesHubDates() {
  var endInput = document.getElementById('sh-end-date');
  var prevInput = document.getElementById('sh-prev-date');
  var backdateInput = document.getElementById('sh-backdate');
  if (!endInput || endInput.value) return;

  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  endInput.value = y + '-' + m + '-' + d;
  if (backdateInput) backdateInput.value = y + '-' + m + '-' + d;
  syncPrevDate();
}

export function syncPrevDate() {
  var endInput = document.getElementById('sh-end-date');
  var prevInput = document.getElementById('sh-prev-date');
  if (!endInput || !prevInput) return;
  var val = endInput.value;
  if (!val) return;
  var parts = val.split('-');
  var y = parseInt(parts[0]);
  var m = parseInt(parts[1]) - 1;
  var d = parseInt(parts[2]);
  // mundur 1 bulan
  m--;
  if (m < 0) { m = 11; y--; }
  var maxD = new Date(y, m + 1, 0).getDate();
  var prevD = Math.min(d, maxD);
  prevInput.value = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(prevD).padStart(2, '0');
  loadSalesHubData();
}

export function loadSalesHubData() {
  const loader = document.getElementById('sales-hub-loader');
  const content = document.getElementById('sales-hub-content');

  if (loader && content) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
    content.classList.add('hidden');
  }

  var currDate = document.getElementById('sh-end-date').value;
  var prevDate = document.getElementById('sh-prev-date').value;
  var backDate = document.getElementById('sh-backdate') ? document.getElementById('sh-backdate').value : '';

  callApi('getSalesHubData', getUserWHP(), currDate, prevDate, backDate).then(function(resp) {
    if (loader && content) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    }
    if (resp.status === "success") {
      renderSalesHub(resp.data);
    } else {
      document.getElementById('sales-hub-kpis').innerHTML =
        '<div class="col-span-full bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 font-bold">' + resp.message + '</div>';
    }
  }).catch(function(err) {
    if (loader && content) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    }
    document.getElementById('sales-hub-kpis').innerHTML =
      '<div class="col-span-full bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 font-bold">Gagal: ' + err.message + '</div>';
  });
}

export function renderSalesHub(data) {
  renderSalesHubKPIs(data.kpis);
  renderSalesHubPeriods(data.currentMonth, data.previousMonth);
  renderSalesHubSnapshots(data.dateSnapshots);
  renderDailyComparison(data.dailyComparison);
}

export function renderSalesHubKPIs(kpis) {
  const container = document.getElementById('sales-hub-kpis');
  const deltaClass = kpis.delta >= 0 ? 'text-blue-600' : 'text-red-600';

  container.innerHTML = `
    <div class="bg-blue-50/50 p-7 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
      <h4 class="text-sm font-bold text-slate-500 uppercase mb-1">Bulan Berjalan</h4>
      <div class="text-2xl font-black text-blue-700">${kpis.currentTotal.toLocaleString('id-ID')} <span class="text-slate-400 text-sm font-medium">Bks</span></div>
    </div>
    <div class="bg-slate-50 p-7 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-slate-400">
      <h4 class="text-sm font-bold text-slate-500 uppercase mb-1">Bulan Lalu</h4>
      <div class="text-2xl font-black text-slate-700">${kpis.previousTotal.toLocaleString('id-ID')} <span class="text-slate-400 text-sm font-medium">Bks</span></div>
    </div>
    <div class="${kpis.delta >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'} p-7 rounded-2xl shadow-sm border border-slate-100 border-l-4 ${kpis.delta >= 0 ? 'border-l-blue-500' : 'border-l-red-400'}">
      <h4 class="text-sm font-bold text-slate-500 uppercase mb-1">Selisih M-1</h4>
      <div class="text-2xl font-black ${deltaClass}">${kpis.delta >= 0 ? '+' : ''}${kpis.delta.toLocaleString('id-ID')}</div>
    </div>
    <div class="bg-violet-50/50 p-7 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-violet-500">
      <h4 class="text-sm font-bold text-slate-500 uppercase mb-1">Penjualan Hari Ini</h4>
      <div class="text-2xl font-black text-violet-700">${kpis.todayTotal.toLocaleString('id-ID')} <span class="text-slate-400 text-sm font-medium">Bks</span></div>
    </div>
  `;
}

export function renderSalesHubTable(title, data) {
  let hasData = data && data.length > 0;
  let grandTotals = { stokis: 0, masterStokis: 0, karyawan: 0, tsiApps: 0, msi: 0, total: 0 };
  if (hasData) {
    data.forEach(function(r) {
      grandTotals.stokis += r.stokis;
      grandTotals.masterStokis += r.masterStokis;
      grandTotals.karyawan += r.karyawan;
      grandTotals.tsiApps += r.tsiApps;
      grandTotals.msi += r.msi;
      grandTotals.total += r.total;
    });
  }

  let html = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
        <h3 class="text-sm font-extrabold text-slate-700 uppercase tracking-tight">${title}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="text-slate-800 uppercase text-xs font-black border-b-2 border-slate-300">
              <th class="px-4 py-2.5 whitespace-nowrap bg-blue-100">Warehouse</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap bg-green-100">MST</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap bg-green-100">MSI</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap bg-green-100">STK</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap bg-green-100">Karyawan</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap bg-green-100">APPS</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap bg-orange-400 text-white">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">`;

  if (!hasData) {
    html += '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400 font-medium">Tidak ada data</td></tr>';
  } else {
    data.forEach(function(row, i) {
      var bgClass = i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100';
      html += `
        <tr class="${bgClass} transition-colors">
          <td class="px-4 py-2 font-bold text-slate-800 whitespace-nowrap">${row.warehouse}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.masterStokis)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.msi)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.stokis)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.karyawan)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.tsiApps)}</td>
          <td class="px-4 py-2 text-right font-black text-slate-900">${formatNum(row.total)}</td>
        </tr>`;
    });
    html += `
            <tr class="bg-[#ccff00] font-black text-black border-t-2 border-slate-300">
              <td class="px-4 py-2.5">TOTAL</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.masterStokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.msi)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.stokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.karyawan)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.tsiApps)}</td>
              <td class="px-4 py-2.5 text-right font-black text-black">${formatNum(grandTotals.total)}</td>
            </tr>`;
  }

  html += `</tbody></table></div></div>`;
  return html;
}

export function renderSalesHubPeriods(current, previous) {
  const container = document.getElementById('sales-hub-periods');
  container.innerHTML =
    renderSalesHubTable(current.label, current.data) +
    renderSalesHubTable(previous.label, previous.data);
}

export function renderSalesHubSnapshots(snapshots) {
  const container = document.getElementById('sales-hub-snapshot-cards');
  if (!snapshots || snapshots.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center text-slate-400 font-medium py-8">Belum ada data harian</div>';
    return;
  }
  let html = '';
  snapshots.forEach(function(snap) {
    let grandTotals = { stokis: 0, masterStokis: 0, karyawan: 0, tsiApps: 0, msi: 0, total: 0 };
    snap.data.forEach(function(r) {
      grandTotals.stokis += r.stokis;
      grandTotals.masterStokis += r.masterStokis;
      grandTotals.karyawan += r.karyawan;
      grandTotals.tsiApps += r.tsiApps;
      grandTotals.msi += r.msi;
      grandTotals.total += r.total;
    });

    html += `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
          <h4 class="text-sm font-extrabold text-blue-700 uppercase tracking-tight">${snap.date}</h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="text-slate-800 uppercase text-xs font-black border-b-2 border-slate-300">
                <th class="px-4 py-2.5 bg-blue-100">Cabang</th>
                <th class="px-4 py-2.5 text-right bg-green-100">MST</th>
                <th class="px-4 py-2.5 text-right bg-green-100">MSI</th>
                <th class="px-4 py-2.5 text-right bg-green-100">STK</th>
                <th class="px-4 py-2.5 text-right bg-green-100">Karyawan</th>
                <th class="px-4 py-2.5 text-right bg-green-100">APPS</th>
                <th class="px-4 py-2.5 text-right bg-orange-400 text-white">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">`;
    snap.data.forEach(function(row, i) {
      var bgClass = i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100';
      html += `
        <tr class="${bgClass} transition-colors">
          <td class="px-4 py-2 font-bold text-slate-700 whitespace-nowrap">${row.warehouse}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.masterStokis)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.msi)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.stokis)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.karyawan)}</td>
          <td class="px-4 py-2 text-right font-bold text-slate-900">${formatNum(row.tsiApps)}</td>
          <td class="px-4 py-2 text-right font-black text-slate-900">${formatNum(row.total)}</td>
        </tr>`;
    });
    html += `
            <tr class="bg-[#ccff00] font-black text-black border-t-2 border-slate-300">
              <td class="px-4 py-2.5">TOTAL</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.masterStokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.msi)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.stokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.karyawan)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.tsiApps)}</td>
              <td class="px-4 py-2.5 text-right font-black text-black">${formatNum(grandTotals.total)}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

export function renderDailyComparison(dailyData) {
  const container = document.getElementById('sales-hub-daily-comparison');
  if (!dailyData || dailyData.length === 0) {
    container.innerHTML = '';
    return;
  }
  var grandCurrent = 0, grandPrevious = 0, grandDelta = 0;
  dailyData.forEach(function(d) {
    grandCurrent += d.current;
    grandPrevious += d.previous;
    grandDelta += d.delta;
  });

  let html = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h3 class="text-base font-extrabold text-slate-700 uppercase tracking-tight">Perbandingan Harian</h3>
        <span class="text-xs font-bold text-slate-500">Bulan Berjalan vs Bulan Lalu</span>
      </div>
      <div class="overflow-x-auto table-container" style="max-height:420px;overflow-y:auto;">
        <table class="w-full text-sm text-left border-collapse">
          <thead class="sticky top-0">
            <tr class="bg-slate-100 text-slate-900 text-sm font-black uppercase tracking-wider border-b-2 border-slate-300">
              <th class="px-5 py-3 whitespace-nowrap">Tanggal</th>
              <th class="px-5 py-3 text-right whitespace-nowrap">Bulan Berjalan</th>
              <th class="px-5 py-3 text-right whitespace-nowrap">Bulan Lalu</th>
              <th class="px-5 py-3 text-right whitespace-nowrap bg-blue-50 text-blue-800">Selisih M-1</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">`;
  dailyData.forEach(function(d) {
    var deltaClass = d.delta >= 0 ? 'text-blue-600' : 'text-red-600';
    var arrow = d.delta >= 0 ? '▲' : '▼';
    html += `
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="px-5 py-2.5 font-bold text-slate-800 whitespace-nowrap">${d.date}</td>
              <td class="px-5 py-2.5 text-right font-bold text-blue-700">${d.current.toLocaleString('id-ID')}</td>
              <td class="px-5 py-2.5 text-right font-bold text-slate-600">${d.previous.toLocaleString('id-ID')}</td>
              <td class="px-5 py-2.5 text-right font-black ${deltaClass} bg-blue-50/30">${arrow} ${Math.abs(d.delta).toLocaleString('id-ID')}</td>
            </tr>`;
  });
  html += `
            <tr class="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300">
              <td class="px-5 py-3 whitespace-nowrap">TOTAL</td>
              <td class="px-5 py-3 text-right text-blue-700">${grandCurrent.toLocaleString('id-ID')}</td>
              <td class="px-5 py-3 text-right text-slate-600">${grandPrevious.toLocaleString('id-ID')}</td>
              <td class="px-5 py-3 text-right font-black bg-blue-50 ${grandDelta >= 0 ? 'text-blue-600' : 'text-red-600'}">${grandDelta >= 0 ? '▲' : '▼'} ${Math.abs(grandDelta).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  container.innerHTML = html;
}

// Shared clone/header/footer/style builder for the branded SalesHub
// screenshot & PDF export (both consumed identical markup before this
// consolidation).
function buildSalesHubExportCard(content, tglStr) {
  var isDark = document.documentElement.classList.contains('dark');
  var shBg = isDark ? '#1e293b' : '#ffffff';
  var shText = isDark ? '#f1f5f9' : '#0f172a';
  var shAccent = isDark ? '#60a5fa' : '#2563eb';
  var shMuted = isDark ? '#94a3b8' : '#64748b';
  var shBorder = isDark ? '#334155' : '#1e293b';
  var shFooterBorder = isDark ? '#334155' : '#e2e8f0';

  var headerHtml = `
    <div style="padding:36px 50px 25px;border-bottom:2px solid ${shBorder};background:${shBg};">
      <div style="font-size:50px;font-weight:900;color:${shText};letter-spacing:-1px;text-transform:uppercase;">PT. TRIDAYA SINERGI INDONESIA</div>
      <div style="font-size:32px;font-weight:700;color:${shAccent};letter-spacing:0.2em;text-transform:uppercase;margin-top:6px;">Sales & Distribution Division</div>
      <div style="font-size:28px;color:${shMuted};font-weight:500;margin-top:8px;">${tglStr}</div>
    </div>`;

  var clone = content.cloneNode(true);
  var filterBar = clone.querySelector('.flex.flex-wrap.items-center.gap-4');
  if (filterBar) filterBar.remove();
  clone.querySelectorAll('.bg-blue-100').forEach(function(el) {
    el.classList.remove('bg-blue-100');
    el.style.backgroundColor = '#dcfce7';
  });
  clone.querySelectorAll('.bg-orange-400').forEach(function(el) {
    el.classList.remove('bg-orange-400', 'text-white');
    el.style.backgroundColor = '#dcfce7';
    el.style.color = '#1e293b';
  });
  clone.querySelectorAll('#sales-hub-kpis h4').forEach(function(el) {
    el.classList.remove('text-slate-500');
    el.style.color = isDark ? '#e2e8f0' : '#334155';
  });

  var card = document.getElementById('sh-screenshot-card');
  var wrapperHtml = `
    <div style="width:1400px;margin:0;padding:0 0 36px 0;background:${shBg};font-family:Arial,sans-serif;">
      <style>
        #sh-overlay-content, #sh-overlay-content * { overflow:visible !important; }
        #sh-overlay-content { font-size:56px !important; }
        #sh-overlay-content .max-w-7xl { max-width:none !important; }
        #sh-overlay-content .text-\\[13px\\],
        #sh-overlay-content .text-\\[11px\\],
        #sh-overlay-content .text-\\[10px\\],
        #sh-overlay-content .text-\\[9px\\] { font-size:42px !important; }
        #sh-overlay-content .shadow-sm { box-shadow:none !important; }
        #sh-overlay-content #sales-hub-kpis h4 { color:${isDark ? '#e2e8f0' : '#334155'} !important; }
        #sales-hub-periods { grid-template-columns:1fr 1fr !important; }
        #sales-hub-snapshot-cards { grid-template-columns:1fr 1fr !important; }
        #sh-overlay-content #sales-hub-kpis { grid-template-columns:1fr 1fr 1fr 1fr !important; }
      </style>
      ${headerHtml}
      <div id="sh-overlay-content" style="margin:0;padding:36px 50px;background:${shBg};"></div>
      <div style="text-align:center;padding:22px 57px 36px;font-size:22px;color:${shMuted};font-weight:600;border-top:2px solid ${shFooterBorder};background:${shBg};">
        Powered by ATR built by SND Support &middot; PT. Tridaya Sinergi Indonesia
      </div>
    </div>`;
  card.innerHTML = wrapperHtml;
  card.style.cssText = 'display:block;position:fixed;top:0;left:0;z-index:999999;overflow:visible;width:1400px;height:auto;margin:0;padding:0;border:0;';
  card.querySelector('#sh-overlay-content').appendChild(clone);

  return { card: card, shBg: shBg };
}

export async function captureSalesHub() {
  const btn = document.getElementById('btn-screenshot-sh');
  const content = document.getElementById('sales-hub-content');
  if (!content || content.classList.contains('hidden')) {
    showToast('Tidak ada data untuk di-screenshot');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Memproses...';

  // Sembunyikan sidebar
  var sidebar = document.getElementById('sidebar');
  var mainContent = document.getElementById('main-content');
  var sidebarWasOpen = sidebar && sidebar.classList.contains('translate-x-0');
  if (sidebarWasOpen) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    if (mainContent) {
      mainContent.classList.remove('ml-64');
      mainContent.classList.add('ml-0');
    }
  }

  var card;
  try {
    var now = new Date();
    var tglStr = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    var built = buildSalesHubExportCard(content, tglStr);
    card = built.card;
    var shBg = built.shBg;

    // Scroll ke atas, beri reflow
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(card.firstElementChild, {
      scale: 3, useCORS: true, logging: false, backgroundColor: shBg,
      allowTaint: false
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    try {
      var item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      showToast('Screenshot tersalin! Silakan Paste (Ctrl+V).');
    } catch (clipErr) {
      console.warn('Clipboard gagal, unduh file:', clipErr);
      var link = document.createElement('a');
      link.download = 'Perbandingan_Penjualan.png';
      link.href = canvas.toDataURL();
      link.click();
      showToast('Gagal menyalin, file diunduh otomatis.');
    }
  } catch (err) {
    console.error('Screenshot gagal:', err);
    showToast('Gagal screenshot');
  }

  sidebar.classList.add('-translate-x-full');
  sidebar.classList.remove('translate-x-0');
  if (mainContent) {
    mainContent.classList.add('ml-0');
    mainContent.classList.remove('ml-64');
  }

  card.style.display = 'none';
  card.innerHTML = '';
  btn.innerHTML = '<i class="fas fa-camera"></i> Screenshot';
  btn.disabled = false;
}

export async function exportSalesHubPDF() {
  const btn = document.getElementById('btn-pdf-sh');
  const content = document.getElementById('sales-hub-content');
  if (!content || content.classList.contains('hidden')) {
    showToast('Tidak ada data untuk di-export');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Memproses...';

  var sidebar = document.getElementById('sidebar');
  var mainContent = document.getElementById('main-content');
  var sidebarWasOpen = sidebar && sidebar.classList.contains('translate-x-0');
  if (sidebarWasOpen) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    if (mainContent) {
      mainContent.classList.remove('ml-64');
      mainContent.classList.add('ml-0');
    }
  }

  var card;
  try {
    var now = new Date();
    var tglStr = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    var fileDate = now.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).replace(/\s/g, '_');

    var built = buildSalesHubExportCard(content, tglStr);
    card = built.card;
    var shBg = built.shBg;

    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(card.firstElementChild, {
      scale: 3, useCORS: true, logging: false, backgroundColor: shBg,
      allowTaint: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF('landscape', 'mm', 'a4');
    const pdfW = 297;
    const ratio = canvas.width / canvas.height;
    const imgW = pdfW;
    const imgH = pdfW / ratio;
    pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
    pdf.save('Perbandingan_Penjualan_' + fileDate + '.pdf');
    showToast('PDF tersimpan!');
  } catch (err) {
    console.error('Export PDF gagal:', err);
    showToast('Gagal export PDF');
  }

  sidebar.classList.add('-translate-x-full');
  sidebar.classList.remove('translate-x-0');
  if (mainContent) {
    mainContent.classList.add('ml-0');
    mainContent.classList.remove('ml-64');
  }

  card.style.display = 'none';
  card.innerHTML = '';
  btn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
  btn.disabled = false;
}
