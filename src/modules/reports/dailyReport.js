import { callApi } from '../../services/api.js';
import { getUserWHP } from '../../state/authState.js';
import { renderPivotTable } from '../../ui/table.js';
import { capturePivot } from '../../utils/exportImage.js';
import { exportPivotAsPdf } from '../../utils/exportPdf.js';

export function initDailyReport() {
  loadDailyReport();
}

let dailyReportRows = [];

export function loadDailyReport() {
  const loader = document.getElementById('daily-report-loader');
  const content = document.getElementById('daily-report-content');
  const daySelect = document.getElementById('daily-report-day');

  if (loader && content) {
    loader.classList.remove('hidden'); loader.classList.add('flex');
    content.innerHTML = '';
  }

  const dayFilter = daySelect ? parseInt(daySelect.value) : -1;

  callApi('getSalesDailyReport', dayFilter, '', '2026-01', getUserWHP()).then(function(resp) {
    if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
    if (resp.status === "success") {
      dailyReportRows = resp.rows || [];
      const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jum\'at','Sabtu'];
      const dayLabel = dayFilter === -1 ? 'Semua Hari' : dayNames[dayFilter];
      const now = new Date();
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const rangeLabel = `Januari 2026 - ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      renderPivotTable(content, resp.branches, resp.rows, `Laporan Penjualan - ${dayLabel} - ${rangeLabel}`);
    } else {
      content.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">${resp.message}</div>`;
    }
  }).catch(function(err) {
    if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
    console.error("Gagal memuat laporan harian:", err);
    alert("Gagal mengambil data: " + err.message);
  });
}

export function captureDailyReport() {
  capturePivot('daily-report-content', 'Laporan-Harian.png', '#btn-screenshot-daily-report');
}

export function exportDailyReportPDF() {
  const daySelect = document.getElementById('daily-report-day');
  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jum\'at','Sabtu'];
  const dayFilter = daySelect ? parseInt(daySelect.value) : -1;
  const dayLabel = dayFilter === -1 ? 'Semua Hari' : dayNames[dayFilter];
  const title = `Penjualan setiap hari ${dayLabel.toLowerCase()}`;
  exportPivotAsPdf('daily-report-content', title);
}
