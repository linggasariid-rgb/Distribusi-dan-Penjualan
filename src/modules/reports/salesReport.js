import { callApi } from '../../services/api.js';
import { getUserWHP } from '../../state/authState.js';
import { initMonthDropdown } from '../../ui/dropdown.js';
import { renderPivotTable } from '../../ui/table.js';
import { capturePivot } from '../../utils/exportImage.js';
import { exportPivotAsPdf } from '../../utils/exportPdf.js';

export function initSalesPerDate() {
  initMonthDropdown('sales-per-date-month', loadSalesPerDate);
}

let salesPerDateRows = [];

export function loadSalesPerDate() {
  const loader = document.getElementById('sales-per-date-loader');
  const content = document.getElementById('sales-per-date-content');
  const monthSelect = document.getElementById('sales-per-date-month');

  if (loader && content) {
    loader.classList.remove('hidden'); loader.classList.add('flex');
    content.innerHTML = '';
  }

  const filterMonth = monthSelect ? monthSelect.value : '';

  callApi('getSalesDailyReport', -1, filterMonth, '', getUserWHP()).then(function(resp) {
    if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
    if (resp.status === "success") {
      salesPerDateRows = resp.rows || [];
      renderPivotTable(content, resp.branches, resp.rows, 'Penjualan Pertanggal');
    } else {
      content.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">${resp.message}</div>`;
    }
  }).catch(function(err) {
    if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
    console.error("Gagal memuat penjualan pertanggal:", err);
    alert("Gagal mengambil data: " + err.message);
  });
}

export function captureSalesPerDate() {
  capturePivot('sales-per-date-content', 'Penjualan-Pertanggal.png', '#btn-screenshot-sales-per-date');
}

export function exportSalesPerDatePDF() {
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let title = 'Penjualan Pertanggal';
  if (salesPerDateRows.length > 0) {
    const first = salesPerDateRows[0].date;
    const last = salesPerDateRows[salesPerDateRows.length - 1].date;
    const fp = first.split('-');
    const lp = last.split('-');
    title = `Penjualan ${parseInt(fp[2])} ${monthNames[parseInt(fp[1])-1]} ${fp[0]} - ${parseInt(lp[2])} ${monthNames[parseInt(lp[1])-1]} ${lp[0]}`;
  }
  exportPivotAsPdf('sales-per-date-content', title);
}
