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
        '<div class="col-span-full p-6 rounded-2xl border font-bold" style="background:var(--color-danger-light);color:var(--color-danger);border-color:rgba(220,38,38,0.15)">' + resp.message + '</div>';
    }
  }).catch(function(err) {
    if (loader && content) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    }
    document.getElementById('sales-hub-kpis').innerHTML =
      '<div class="col-span-full p-6 rounded-2xl border font-bold" style="background:var(--color-danger-light);color:var(--color-danger);border-color:rgba(220,38,38,0.15)">Gagal: ' + err.message + '</div>';
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

  container.innerHTML = `
    <div class="p-7 rounded-2xl shadow-sm border border-l-4" style="background:var(--color-surface);border-color:var(--color-border);border-left-color:var(--color-accent)">
      <h4 class="text-sm font-bold uppercase mb-1" style="color:var(--color-text-secondary)">Bulan Berjalan</h4>
      <div class="text-2xl font-black" style="color:var(--color-text)">${kpis.currentTotal.toLocaleString('id-ID')} <span style="color:var(--color-text-secondary)" class="text-sm font-medium">Bks</span></div>
    </div>
    <div class="p-7 rounded-2xl shadow-sm border border-l-4" style="background:var(--color-surface);border-color:var(--color-border);border-left-color:var(--color-accent)">
      <h4 class="text-sm font-bold uppercase mb-1" style="color:var(--color-text-secondary)">Bulan Lalu</h4>
      <div class="text-2xl font-black" style="color:var(--color-text)">${kpis.previousTotal.toLocaleString('id-ID')} <span style="color:var(--color-text-secondary)" class="text-sm font-medium">Bks</span></div>
    </div>
    <div class="p-7 rounded-2xl shadow-sm border border-l-4" style="background:var(--color-surface);border-color:var(--color-border);border-left-color:var(--color-accent)">
      <h4 class="text-sm font-bold uppercase mb-1" style="color:var(--color-text-secondary)">Selisih M-1</h4>
      <div class="text-2xl font-black" style="color:${kpis.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${kpis.delta >= 0 ? '+' : ''}${kpis.delta.toLocaleString('id-ID')}</div>
    </div>
    <div class="p-7 rounded-2xl shadow-sm border border-l-4" style="background:var(--color-surface);border-color:var(--color-border);border-left-color:var(--color-accent)">
      <h4 class="text-sm font-bold uppercase mb-1" style="color:var(--color-text-secondary)">Penjualan Hari Ini</h4>
      <div class="text-2xl font-black" style="color:var(--color-text)">${kpis.todayTotal.toLocaleString('id-ID')} <span style="color:var(--color-text-secondary)" class="text-sm font-medium">Bks</span></div>
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
    <div class="card overflow-hidden">
      <div class="px-4 py-3" style="border-bottom:1px solid var(--color-border);background:var(--color-bg-alt)">
        <h3 class="text-sm font-extrabold uppercase tracking-tight" style="color:var(--color-text)">${title}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="uppercase text-xs font-black" style="color:var(--color-text);border-bottom:2px solid var(--color-border)">
              <th class="px-4 py-2.5 whitespace-nowrap" style="background:var(--color-primary-light)">Warehouse</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap" style="background:var(--color-success-light)">MST</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap" style="background:var(--color-success-light)">MSI</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap" style="background:var(--color-success-light)">STK</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap" style="background:var(--color-success-light)">Karyawan</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap" style="background:var(--color-success-light)">APPS</th>
              <th class="px-4 py-2.5 text-right whitespace-nowrap" style="background:var(--color-accent);color:white">Total</th>
            </tr>
          </thead>
          <tbody style="border-color:var(--color-border)">`;

  if (!hasData) {
    html += '<tr><td colspan="7" class="px-4 py-8 text-center font-medium" style="color:var(--color-text-muted)">Tidak ada data</td></tr>';
  } else {
    data.forEach(function(row, i) {
      var bgClass = i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)';
      html += `
        <tr style="background:${bgClass}">
          <td class="px-4 py-2 font-bold whitespace-nowrap" style="color:var(--color-text)">${row.warehouse}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.masterStokis)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.msi)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.stokis)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.karyawan)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.tsiApps)}</td>
          <td class="px-4 py-2 text-right font-black" style="color:var(--color-text)">${formatNum(row.total)}</td>
        </tr>`;
    });
    html += `
            <tr style="background:var(--color-accent);color:var(--color-text-inverse);font-weight:900;border-top:2px solid var(--color-border)">
              <td class="px-4 py-2.5">TOTAL</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.masterStokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.msi)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.stokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.karyawan)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.tsiApps)}</td>
              <td class="px-4 py-2.5 text-right font-black">${formatNum(grandTotals.total)}</td>
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
    container.innerHTML = '<div class="col-span-full text-center font-medium py-8" style="color:var(--color-text-muted)">Belum ada data harian</div>';
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
      <div class="card overflow-hidden">
        <div class="px-4 py-3" style="border-bottom:1px solid var(--color-border);background:var(--color-bg-alt)">
          <h4 class="text-sm font-extrabold uppercase tracking-tight" style="color:var(--color-text)">${snap.date}</h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="uppercase text-xs font-black" style="color:var(--color-text);border-bottom:2px solid var(--color-border)">
                <th class="px-4 py-2.5" style="background:var(--color-primary-light)">Cabang</th>
                <th class="px-4 py-2.5 text-right" style="background:var(--color-success-light)">MST</th>
                <th class="px-4 py-2.5 text-right" style="background:var(--color-success-light)">MSI</th>
                <th class="px-4 py-2.5 text-right" style="background:var(--color-success-light)">STK</th>
                <th class="px-4 py-2.5 text-right" style="background:var(--color-success-light)">Karyawan</th>
                <th class="px-4 py-2.5 text-right" style="background:var(--color-success-light)">APPS</th>
                <th class="px-4 py-2.5 text-right" style="background:var(--color-accent);color:white">Total</th>
              </tr>
            </thead>
            <tbody style="border-color:var(--color-border)">`;
    snap.data.forEach(function(row, i) {
      var bgClass = i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)';
      html += `
        <tr style="background:${bgClass}">
          <td class="px-4 py-2 font-bold whitespace-nowrap" style="color:var(--color-text)">${row.warehouse}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.masterStokis)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.msi)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.stokis)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.karyawan)}</td>
          <td class="px-4 py-2 text-right font-bold" style="color:var(--color-text)">${formatNum(row.tsiApps)}</td>
          <td class="px-4 py-2 text-right font-black" style="color:var(--color-text)">${formatNum(row.total)}</td>
        </tr>`;
    });
    html += `
            <tr style="background:var(--color-accent);color:var(--color-text-inverse);font-weight:900;border-top:2px solid var(--color-border)">
              <td class="px-4 py-2.5">TOTAL</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.masterStokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.msi)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.stokis)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.karyawan)}</td>
              <td class="px-4 py-2.5 text-right">${formatNum(grandTotals.tsiApps)}</td>
              <td class="px-4 py-2.5 text-right font-black">${formatNum(grandTotals.total)}</td>
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
    <div class="card overflow-hidden">
      <div class="px-5 py-4 flex items-center justify-between" style="border-bottom:1px solid var(--color-border);background:var(--color-bg-alt)">
        <h3 class="text-base font-extrabold uppercase tracking-tight" style="color:var(--color-text)">Perbandingan Harian</h3>
        <span class="text-xs font-bold" style="color:var(--color-text-secondary)">Bulan Berjalan vs Bulan Lalu</span>
      </div>
      <div class="overflow-x-auto table-container" style="max-height:420px;overflow-y:auto;">
        <table class="w-full text-sm text-left border-collapse">
          <thead class="sticky top-0">
            <tr class="text-sm font-black uppercase tracking-wider" style="background:var(--color-bg-alt);color:var(--color-text);border-bottom:2px solid var(--color-border)">
              <th class="px-5 py-3 whitespace-nowrap">Tanggal</th>
              <th class="px-5 py-3 text-right whitespace-nowrap">Bulan Berjalan</th>
              <th class="px-5 py-3 text-right whitespace-nowrap">Bulan Lalu</th>
              <th class="px-5 py-3 text-right whitespace-nowrap" style="background:var(--color-accent-light);color:var(--color-accent)">Selisih M-1</th>
            </tr>
          </thead>
          <tbody style="border-color:var(--color-border)">`;
  dailyData.forEach(function(d) {
    var deltaClass = d.delta >= 0 ? 'color:var(--color-success)' : 'color:var(--color-danger)';
    var arrow = d.delta >= 0 ? '▲' : '▼';
    html += `
            <tr style="transition:background-color 150ms">
              <td class="px-5 py-2.5 font-bold whitespace-nowrap" style="color:var(--color-text)">${d.date}</td>
              <td class="px-5 py-2.5 text-right font-bold" style="color:var(--color-text)">${d.current.toLocaleString('id-ID')}</td>
              <td class="px-5 py-2.5 text-right font-bold" style="color:var(--color-text-secondary)">${d.previous.toLocaleString('id-ID')}</td>
              <td class="px-5 py-2.5 text-right font-black" style="${deltaClass}">${arrow} ${Math.abs(d.delta).toLocaleString('id-ID')}</td>
            </tr>`;
  });
  html += `
            <tr style="background:var(--color-bg-alt);border-top:2px solid var(--color-border);font-weight:900;color:var(--color-text)">
              <td class="px-5 py-3 whitespace-nowrap">TOTAL</td>
              <td class="px-5 py-3 text-right" style="color:var(--color-text)">${grandCurrent.toLocaleString('id-ID')}</td>
              <td class="px-5 py-3 text-right" style="color:var(--color-text-secondary)">${grandPrevious.toLocaleString('id-ID')}</td>
              <td class="px-5 py-3 text-right font-black" style="background:var(--color-accent-light);${grandDelta >= 0 ? 'color:var(--color-success)' : 'color:var(--color-danger)'}">${grandDelta >= 0 ? '▲' : '▼'} ${Math.abs(grandDelta).toLocaleString('id-ID')}</td>
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
  var shAccent = isDark ? '#4ADE80' : '#22C55E';
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

    const pdf = new window.jspdf.jsPDF('landscape', 'mm', 'a4');
    const pdfW = 297;
    const pdfH = 210;
    const ratio = canvas.width / canvas.height;
    const imgW = pdfW;
    const imgH = pdfW / ratio;

    if (imgH <= pdfH) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
    } else {
      var pages = Math.ceil(imgH / pdfH);
      for (var i = 0; i < pages; i++) {
        if (i > 0) pdf.addPage();
        var srcY = i * pdfH * (canvas.height / imgH);
        var srcH = Math.min(pdfH * (canvas.height / imgH), canvas.height - srcY);
        var tmpC = document.createElement('canvas');
        tmpC.width = canvas.width;
        tmpC.height = srcH;
        tmpC.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(tmpC.toDataURL('image/png'), 'PNG', 0, 0, pdfW, Math.min(pdfH, imgH - i * pdfH));
      }
    }

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
