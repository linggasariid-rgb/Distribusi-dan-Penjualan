import { captureReport } from '../modules/dashboard/sales.js';
import { captureBestProducts } from '../modules/best-products/bestProducts.js';
import { captureDailyReport, exportDailyReportPDF } from '../modules/reports/dailyReport.js';
import { captureSalesPerDate, exportSalesPerDatePDF } from '../modules/reports/salesReport.js';
import { loadSalesHubData, captureSalesHub, exportSalesHubPDF } from '../modules/saleshub/salesHub.js';
import { takeScreenshotCP, copyTeksWA } from '../modules/control-point/controlPoint.js';

function bind(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

export function initSalesEvents() {
  bind('btn-screenshot-sales-report', captureReport);
  bind('btn-screenshot-best-products', captureBestProducts);
  bind('btn-screenshot-daily-report', captureDailyReport);
  bind('btn-pdf-daily-report', exportDailyReportPDF);
  bind('btn-screenshot-sales-per-date', captureSalesPerDate);
  bind('btn-pdf-sales-per-date', exportSalesPerDatePDF);
  bind('btn-sh-apply', loadSalesHubData);
  bind('btn-screenshot-sh', captureSalesHub);
  bind('btn-pdf-sh', exportSalesHubPDF);
  bind('btn-screenshot-cp', takeScreenshotCP);
  bind('btn-teks-cp', copyTeksWA);
}
