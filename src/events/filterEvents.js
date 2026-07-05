import { refreshData, handleBranchFilterChange, handleAreaFilterChange } from '../router.js';
import { loadBestProductsData } from '../modules/best-products/bestProducts.js';
import { loadDailyReport } from '../modules/reports/dailyReport.js';
import { loadSalesPerDate } from '../modules/reports/salesReport.js';
import { syncPrevDate, loadSalesHubData } from '../modules/saleshub/salesHub.js';
import { updateTarget, updateBuffer } from '../modules/dashboard/distribution.js';

export function initFilterEvents() {
  const branchFilter = document.getElementById('branchFilter');
  if (branchFilter) branchFilter.addEventListener('change', handleBranchFilterChange);

  const whpFilter = document.getElementById('whpFilter');
  if (whpFilter) whpFilter.addEventListener('change', handleAreaFilterChange);

  const refreshBtn = document.getElementById('btn-refresh-data');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshData);

  const bestProductsMonth = document.getElementById('best-products-month');
  if (bestProductsMonth) bestProductsMonth.addEventListener('change', loadBestProductsData);

  const dailyReportDay = document.getElementById('daily-report-day');
  if (dailyReportDay) dailyReportDay.addEventListener('change', loadDailyReport);

  const salesPerDateMonth = document.getElementById('sales-per-date-month');
  if (salesPerDateMonth) salesPerDateMonth.addEventListener('change', loadSalesPerDate);

  const shEndDate = document.getElementById('sh-end-date');
  if (shEndDate) shEndDate.addEventListener('change', syncPrevDate);

  const shBackdate = document.getElementById('sh-backdate');
  if (shBackdate) shBackdate.addEventListener('change', loadSalesHubData);

  const content = document.getElementById('content');
  if (content) content.addEventListener('change', function(e) {
    const el = e.target.closest('[data-action="update-target"], [data-action="update-buffer"]');
    if (!el) return;
    const key = el.dataset.key;
    if (el.dataset.action === 'update-target') updateTarget(key, el.value);
    else updateBuffer(key, el.value);
  });
}
