import { callApi } from '../../services/api.js';
import { getUserWHP } from '../../state/authState.js';
import { getSelectedBranch, getSelectedWHP } from '../../state/filterState.js';
import { state } from '../../state/appState.js';
import { getExportBodyBgColor } from '../../ui/theme.js';
import { showToast } from '../../ui/toast.js';

export function loadSalesData() {
  const selectedWHO = getSelectedWHP();
  const selectedBranch = getSelectedBranch();
  const loader = document.getElementById('sales-loader');
  const content = document.getElementById('sales-dashboard-content');

  if (loader && content) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
    content.classList.add('hidden');
  }

  callApi('getSalesDashboardData', selectedWHO, selectedBranch, getUserWHP()).then(function(resp) {
    if (loader && content) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    }
    if (resp.status === "success") {
      const d = resp.data;
      if (d._debug) console.log("SalesDashboard _debug:", JSON.stringify(d._debug));

      // Update KPI Cards
      document.getElementById('sales-last-month').innerText = d.kpis.lastMonth.toLocaleString('id-ID') + " Bks";
      document.getElementById('sales-monthly').innerText = d.kpis.monthly.toLocaleString('id-ID') + " Bks";

      const growthVal = d.kpis.growth;
      const growthPct = d.kpis.lastMonth === 0 ? (growthVal > 0 ? 100 : 0) : Math.round((growthVal / d.kpis.lastMonth) * 100);
      const growthEl = document.getElementById('sales-growth');
      growthEl.innerHTML = `
        <div class="${growthVal >= 0 ? 'text-emerald-600' : 'text-red-600'}">
          ${growthVal > 0 ? '+' : ''}${growthPct}%
        </div>
        <div class="text-[10px] text-slate-400 font-medium mt-2">Selisih: ${growthVal.toLocaleString('id-ID')}</div>
      `;

      document.getElementById('sales-today').innerText = d.kpis.today.toLocaleString('id-ID') + " Bks";
      document.getElementById('dist-bdg').innerText = d.kpis.distBDG.toLocaleString('id-ID') + " Bks";
      document.getElementById('dist-tsm').innerText = d.kpis.distTSM.toLocaleString('id-ID') + " Bks";
      document.getElementById('rec-bdg').innerText = d.kpis.recBDG.toLocaleString('id-ID') + " Bks";
      document.getElementById('rec-tsm').innerText = d.kpis.recTSM.toLocaleString('id-ID') + " Bks";

      renderSalesCharts(d);
      renderRankingTable(d.ranking);
    }
  }).catch(function(err) {
    if (loader && content) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    }
    console.error("Gagal memuat data sales:", err);
    alert("Gagal mengambil data dari spreadsheet: " + err.message);
  });
}

export function renderSalesCharts(data) {
  // Ranking Penjualan Cabang
  const ctxRank = document.getElementById('branchRankingChart').getContext('2d');
  if (state.branchRankingChart) state.branchRankingChart.destroy();

  const rankLabels = data.ranking.slice(0, 10).map(item => item.branch);
  const rankValues = data.ranking.slice(0, 10).map(item => item.total);

  if (rankLabels.length === 0) return;

  state.branchRankingChart = new Chart(ctxRank, {
    type: 'bar',
    data: {
      labels: rankLabels,
      datasets: [{
        label: 'Total Penjualan',
        data: rankValues,
        backgroundColor: '#d4af37',
        borderRadius: 8
      }]
    },
    plugins: [ChartDataLabels],
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'center',
          align: 'right',
          offset: 10,
          color: '#78350f',
        font: { weight: '800', size: 16 },
          formatter: (value) => value.toLocaleString('id-ID')
        }
      },
      scales: {
        x: { display: false },
        y: {
          ticks: { font: { weight: 'bold', size: 14 }, color: '#334155' }
        }
      }
    }
  });
}

export function renderRankingTable(ranking) {
  let html = `
    <table class="w-full text-xs text-left">
      <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
        <tr>
          <th class="px-6 py-4">Rank</th>
          <th class="px-6 py-4">Cabang</th>
          <th class="px-6 py-4 text-right">Total Penjualan</th>
          <th class="px-6 py-4 text-right">Kontribusi (%)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">`;

  const grandTotal = ranking.reduce((sum, item) => sum + item.total, 0);

  ranking.forEach((item, index) => {
    const percentage = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : 0;
    html += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-4 font-bold text-slate-400">#${index + 1}</td>
        <td class="px-6 py-4 font-bold text-slate-700">${item.branch}</td>
        <td class="px-6 py-4 text-right font-black text-blue-600">${item.total.toLocaleString('id-ID')}</td>
        <td class="px-6 py-4 text-right text-slate-500">${percentage}%</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  var el = document.getElementById('sales-ranking-content');
  if (el) el.innerHTML = html;
}

export function captureReport() {
  const btn = document.getElementById('btn-screenshot-sales-report');
  const reportArea = document.getElementById('report-area');
  const filterArea = document.querySelector('.flex.flex-col.md\\:flex-row.justify-between.items-center.mb-8');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');

  // Simpan status sidebar saat ini untuk dikembalikan nanti
  const isSidebarOpen = sidebar.classList.contains('translate-x-0');

  const originalBtnText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Memproses...';
  btn.disabled = true;

  // Sembunyikan sidebar secara otomatis agar area tangkapan layar menjadi landscape penuh
  if (isSidebarOpen) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    mainContent.classList.remove('ml-64');
    mainContent.classList.add('ml-0');
  }

  // Simpan styling asli untuk dikembalikan nanti
  const originalStyle = reportArea.getAttribute('style') || '';

  // Paksa lebar ke mode landscape lebar
  reportArea.style.width = '1920px';
  reportArea.style.maxWidth = 'none';

  // Inject style perbesar font agar terbaca tanpa zoom
  var fontStyleId = 'capture-report-font-scale';
  var fontStyleEl = document.createElement('style');
  fontStyleEl.id = fontStyleId;
  fontStyleEl.textContent = `
    #report-area .text-\\[9px\\] { font-size:18px !important; }
    #report-area .text-\\[10px\\] { font-size:20px !important; }
    #report-area .text-xs { font-size:18px !important; }
    #report-area .text-sm { font-size:20px !important; }
    #report-area .text-base { font-size:24px !important; }
    #report-area .text-lg { font-size:30px !important; }
    #report-area .text-xl { font-size:34px !important; }
    #report-area .text-2xl { font-size:40px !important; }
    #report-area .text-3xl { font-size:48px !important; }
    #report-area h1 { margin-bottom:20px !important; }
    #report-area h4 { font-size:16px !important; margin-bottom:8px !important; }
    #report-area .grid { gap:1.5rem !important; }
    #report-area .p-5 { padding:30px !important; }
  `;
  document.head.appendChild(fontStyleEl);

  // Sembunyikan elemen yang tidak ingin masuk ke gambar
  btn.style.visibility = 'hidden';
  filterArea.style.display = 'none';

  // Beri jeda agar browser merender ulang layout dengan lebar baru (Reflow)
  setTimeout(function() {
    html2canvas(reportArea, {
      scale: 2,
      useCORS: true,
      backgroundColor: getExportBodyBgColor()
    }).then(function(canvas) {
      canvas.toBlob(function(blob) {
        try {
          var item = new ClipboardItem({ "image/png": blob });
          navigator.clipboard.write([item]).then(function() {
            showToast("Screenshot Landscape disalin! Silakan Paste (Ctrl+V).");
          }).catch(function() {
            var link = document.createElement('a');
            link.download = 'Report-Sales-Landscape.png';
            link.href = canvas.toDataURL();
            link.click();
            showToast("Gagal menyalin, file diunduh otomatis.");
          });
        } catch (e) { showToast("Browser tidak mendukung copy gambar."); }

        reportArea.setAttribute('style', originalStyle);
        var injectedStyle = document.getElementById(fontStyleId);
        if (injectedStyle) injectedStyle.remove();
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
        btn.style.visibility = 'visible';
        filterArea.style.display = 'flex';

        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        mainContent.classList.add('ml-0');
        mainContent.classList.remove('ml-64');
      }, 'image/png');
    });
  }, 500);
}
