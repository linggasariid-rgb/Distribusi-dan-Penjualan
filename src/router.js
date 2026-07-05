import { state } from './state/appState.js';
import { getUserRole } from './state/authState.js';
import { expandParentGroup } from './ui/sidebar.js';

import { loadBeranda } from './modules/dashboard/dashboard.js';
import { loadData, renderCards } from './modules/dashboard/distribution.js';
import { renderStockSummaryTable } from './modules/dashboard/summary.js';
import { loadSalesData } from './modules/dashboard/sales.js';
import { loadControlPoint } from './modules/control-point/controlPoint.js';
import { initSalesHubDates, loadSalesHubData } from './modules/saleshub/salesHub.js';
import { loadBestProductsData, initBestProductsMonths } from './modules/best-products/bestProducts.js';
import { initDailyReport } from './modules/reports/dailyReport.js';
import { initSalesPerDate } from './modules/reports/salesReport.js';
import { initPenerimaanPabrik } from './modules/input/inputPabrik.js';
import { initInputDistribusi } from './modules/input/inputDistribusi.js';

// Central view router (switchMenu) plus the filter/refresh handlers that
// depend on "which view is currently visible". Kept in its own module (not
// app.js) so events/*.js can import it without creating a circular
// dependency with app.js, which itself wires up the events modules.

export function switchMenu(menuName) {
  var role = getUserRole() || 'admin';
  var restricted = { super_admin: 0, admin_whp: 1, admin: 1 };
  var menuAccess = {
    'beranda': 'admin',
    'distribusi': 'admin',
    'stok': 'admin',
    'sales-dashboard': 'super_admin',
    'penjualan-who': 'super_admin',
    'penerimaan-pabrik': 'super_admin',
    'input-distribusi': 'super_admin',
    'best-products': 'super_admin',
    'daily-report': 'super_admin',
    'sales-per-date': 'super_admin',
    'input-stok-excel': 'super_admin',
    'sales-hub': 'admin'
  };
  if (restricted[role] > restricted[menuAccess[menuName] || 'admin']) {
    var roleLabels = { admin: 'Admin', admin_whp: 'Admin WHP', super_admin: 'Super Admin' };
    alert('Menu "' + menuName + '" hanya bisa diakses oleh ' + roleLabels[menuAccess[menuName]]);
    return;
  }
  if (menuName === 'sales-hub' && role === 'admin_whp') {
    alert('Menu "SalesHub" hanya bisa diakses oleh Admin dan Super Admin');
    return;
  }

  const distView = document.getElementById('distribution-view');
  const stockView = document.getElementById('stock-summary-view');
  const penjualanWhoView = document.getElementById('penjualan-who-view');
  const penerimaanPabrikView = document.getElementById('penerimaan-pabrik-view');
  const salesDashboardView = document.getElementById('sales-dashboard-view');
  const bestProductsView = document.getElementById('best-products-view');
  const dailyReportView = document.getElementById('daily-report-view');
  const salesPerDateView = document.getElementById('sales-per-date-view');
  const controlPointView = document.getElementById('control-point-view');
  const chatAiView = document.getElementById('chat-ai-view');
  const inputStokBizView = document.getElementById('input-stok-biz-view');
  const inputStokExcelView = document.getElementById('input-stok-excel-view');
  const inputDistribusiView = document.getElementById('input-distribusi-view');
  const berandaView = document.getElementById('beranda-view');

  const menuDist = document.getElementById('menu-distribusi');
  const menuStok = document.getElementById('menu-stok');
  const menuPenjualanWHO = document.getElementById('menu-penjualan-who');
  const menuPenerimaanPabrik = document.getElementById('menu-penerimaan-pabrik');
  const menuSalesDash = document.getElementById('menu-sales-dashboard');
  const menuBestProducts = document.getElementById('menu-best-products');
  const menuDailyReport = document.getElementById('menu-daily-report');
  const menuSalesPerDate = document.getElementById('menu-sales-per-date');
  const menuControlPoint = document.getElementById('menu-control-point');
  const menuChatAi = document.getElementById('menu-chat-ai');
  const menuInputStokBiz = document.getElementById('menu-input-stok-biz');
  const menuInputStokExcel = document.getElementById('menu-input-stok-excel');
  const menuSalesHub = document.getElementById('menu-sales-hub');
  const menuInputDistribusi = document.getElementById('menu-input-distribusi');
  const menuBeranda = document.getElementById('menu-beranda');

  const pageTitle = document.getElementById('page-title');
  const pageIcon = document.getElementById('page-icon');
  const branchFilter = document.getElementById('branchFilter');
  const whpFilter = document.getElementById('whpFilter');
  const summarySection = document.getElementById('summarySection');

  // Sembunyikan semua View terlebih dahulu
  distView.style.display = 'none';
  stockView.classList.add('hidden');
  penjualanWhoView.classList.add('hidden');
  penerimaanPabrikView.classList.add('hidden');
  salesDashboardView.classList.add('hidden');
  bestProductsView.classList.add('hidden');
  dailyReportView.classList.add('hidden');
  salesPerDateView.classList.add('hidden');
  controlPointView.classList.add('hidden');
  chatAiView.classList.add('hidden');
  inputStokBizView.classList.add('hidden');
  inputStokExcelView.classList.add('hidden');
  inputDistribusiView.classList.add('hidden');
  berandaView.classList.add('hidden');
  document.getElementById('sales-hub-view').classList.add('hidden');
  branchFilter.classList.add('hidden');
  if (summarySection) {
    summarySection.classList.add('hidden');
    summarySection.classList.remove('grid');
  }

  // Reset semua Menu Class (Non-aktif)
  const defaultMenuClass = "flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800 hover:text-white rounded-xl font-medium transition-colors text-slate-300";
  const activeMenuClass = "flex items-center gap-4 px-4 py-3.5 bg-blue-600/10 text-blue-500 rounded-xl font-bold border border-blue-500/20 transition-all";
  if(menuDist) menuDist.className = defaultMenuClass;
  if(menuStok) menuStok.className = defaultMenuClass;
  if(menuPenjualanWHO) menuPenjualanWHO.className = defaultMenuClass;
  if(menuPenerimaanPabrik) menuPenerimaanPabrik.className = defaultMenuClass;
  if(menuSalesDash) menuSalesDash.className = defaultMenuClass;
  if(menuBestProducts) menuBestProducts.className = defaultMenuClass;
  if(menuDailyReport) menuDailyReport.className = defaultMenuClass;
  if(menuSalesPerDate) menuSalesPerDate.className = defaultMenuClass;
  if(menuControlPoint) menuControlPoint.className = defaultMenuClass;
  if(menuChatAi) menuChatAi.className = defaultMenuClass;
  if(menuInputStokBiz) menuInputStokBiz.className = defaultMenuClass;
  if(menuInputStokExcel) menuInputStokExcel.className = defaultMenuClass;
  if(menuSalesHub) menuSalesHub.className = defaultMenuClass;
  if(menuInputDistribusi) menuInputDistribusi.className = defaultMenuClass;
  if(menuBeranda) menuBeranda.className = defaultMenuClass;

  // Tampilkan View & Aktifkan Menu sesuai Pilihan
  if (menuName === 'stok') {
    stockView.classList.remove('hidden');
    pageTitle.innerText = "Ringkasan Stok";
    pageIcon.className = "fas fa-boxes";
    branchFilter.classList.remove('hidden');
    if (menuStok) menuStok.className = activeMenuClass;
    if (!state.gData) loadData();
    else renderStockSummaryTable();
  }
  else if (menuName === 'penjualan-who') {
    penjualanWhoView.classList.remove('hidden');
    pageTitle.innerText = "Input Penjualan";
    pageIcon.className = "fas fa-file-invoice";
    if (menuPenjualanWHO) menuPenjualanWHO.className = activeMenuClass;
  }
  else if (menuName === 'penerimaan-pabrik') {
    penerimaanPabrikView.classList.remove('hidden');
    pageTitle.innerText = "Input Penerimaan";
    pageIcon.className = "fas fa-factory";
    if (menuPenerimaanPabrik) menuPenerimaanPabrik.className = activeMenuClass;
    initPenerimaanPabrik();
  }
  else if (menuName === 'best-products') {
    bestProductsView.classList.remove('hidden');
    pageTitle.innerText = "Best Produk";
    pageIcon.className = "fas fa-trophy";
    if (menuBestProducts) menuBestProducts.className = activeMenuClass;
    const bpContent = document.getElementById('best-products-content');
    const bpMonth = document.getElementById('best-products-month');
    if (bpMonth && bpMonth.options.length === 0) initBestProductsMonths();
    else if (bpContent && bpContent.innerHTML.trim() === '') loadBestProductsData();
  }
  else if (menuName === 'control-point') {
    controlPointView.classList.remove('hidden');
    pageTitle.innerText = "Perbandingan Stok BIZ vs Stok Excel";
    pageIcon.className = "fas fa-balance-scale";
    if (menuControlPoint) menuControlPoint.className = activeMenuClass;
    const cpContent = document.getElementById('cp-dashboard-content');
    if (!cpContent || cpContent.innerHTML.trim() === '' || cpContent.querySelector('.text-red-500')) loadControlPoint();
  }
  else if (menuName === 'input-stok-biz') {
    inputStokBizView.classList.remove('hidden');
    pageTitle.innerText = "Input Stok BIZ";
    pageIcon.className = "fas fa-database";
    if (menuInputStokBiz) menuInputStokBiz.className = activeMenuClass;
  }
  else if (menuName === 'input-stok-excel') {
    inputStokExcelView.classList.remove('hidden');
    pageTitle.innerText = "Input Stok Excel";
    pageIcon.className = "fas fa-file-excel";
    if (menuInputStokExcel) menuInputStokExcel.className = activeMenuClass;
  }
  else if (menuName === 'daily-report') {
    dailyReportView.classList.remove('hidden');
    pageTitle.innerText = "Penjualan Harian";
    pageIcon.className = "fas fa-calendar-week";
    if (menuDailyReport) menuDailyReport.className = activeMenuClass;
    const drContent = document.getElementById('daily-report-content');
    if (!drContent || drContent.innerHTML.trim() === '') initDailyReport();
  }
  else if (menuName === 'sales-per-date') {
    salesPerDateView.classList.remove('hidden');
    pageTitle.innerText = "Penjualan Pertanggal";
    pageIcon.className = "fas fa-calendar-day";
    if (menuSalesPerDate) menuSalesPerDate.className = activeMenuClass;
    const spContent = document.getElementById('sales-per-date-content');
    if (!spContent || spContent.innerHTML.trim() === '') initSalesPerDate();
  }
  else if (menuName === 'sales-dashboard') {
    salesDashboardView.classList.remove('hidden');
    pageTitle.innerText = "Report Penjualan";
    pageIcon.className = "fas fa-chart-line";
    branchFilter.classList.remove('hidden');
    if (menuSalesDash) menuSalesDash.className = activeMenuClass;
    loadSalesData();
  }
  else if (menuName === 'sales-hub') {
    document.getElementById('sales-hub-view').classList.remove('hidden');
    pageTitle.innerText = "Perbandingan Penjualan";
    pageIcon.className = "fas fa-chart-bar";
    if (menuSalesHub) menuSalesHub.className = activeMenuClass;
    initSalesHubDates();
  }
  else if (menuName === 'beranda') {
    berandaView.classList.remove('hidden');
    pageTitle.innerText = "Beranda";
    pageIcon.className = "fas fa-home";
    if (menuBeranda) menuBeranda.className = activeMenuClass;
    loadBeranda();
  }
  else if (menuName === 'input-distribusi') {
    inputDistribusiView.classList.remove('hidden');
    pageTitle.innerText = "Input Distribusi";
    pageIcon.className = "fas fa-arrow-right-arrow-left";
    if (menuInputDistribusi) menuInputDistribusi.className = activeMenuClass;
    initInputDistribusi();
  }
  else if (menuName === 'chat-ai') {
    chatAiView.classList.remove('hidden');
    pageTitle.innerText = "Chat AI";
    pageIcon.className = "fas fa-comment-dots";
    if (menuChatAi) menuChatAi.className = activeMenuClass;
  }
  else { // 'distribusi'
    distView.style.display = 'block';
    pageTitle.innerText = "Distribusi";
    pageIcon.className = "fas fa-truck-loading";
    branchFilter.classList.remove('hidden');
    if (!state.gData) loadData();
    else if (summarySection) {
      summarySection.classList.remove('hidden');
      summarySection.classList.add('grid');
    }
    if (menuDist) menuDist.className = activeMenuClass;
  }
  expandParentGroup(menuName);
}

export function refreshData() {
  const salesDashboardView = document.getElementById('sales-dashboard-view');
  const controlPointView = document.getElementById('control-point-view');
  const salesHubView = document.getElementById('sales-hub-view');
  if (salesDashboardView && !salesDashboardView.classList.contains('hidden')) {
    loadSalesData();
  } else if (controlPointView && !controlPointView.classList.contains('hidden')) {
    loadControlPoint();
  } else if (salesHubView && !salesHubView.classList.contains('hidden')) {
    loadSalesHubData();
  } else {
    loadData();
  }
}

export function handleBranchFilterChange() {
  const salesDashboardView = document.getElementById('sales-dashboard-view');
  const stockView = document.getElementById('stock-summary-view');
  if (!salesDashboardView.classList.contains('hidden')) {
    loadSalesData();
  } else if (!stockView.classList.contains('hidden')) {
    renderStockSummaryTable();
  } else {
    renderCards();
  }
}

export function handleAreaFilterChange() {
  const salesDashboardView = document.getElementById('sales-dashboard-view');
  const stockView = document.getElementById('stock-summary-view');

  if (!salesDashboardView.classList.contains('hidden')) {
    loadSalesData();
  } else if (!stockView.classList.contains('hidden')) {
    renderStockSummaryTable();
  }
}
