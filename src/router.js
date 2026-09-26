import { state } from './state/appState.js';
import { getUserRole } from './state/authState.js';
import { expandParentGroup } from './ui/sidebar.js';

function setActiveMenu(el) {
  if (!el) return;
  var cls = el.className;
  if (cls.indexOf('sidebar-item-main') >= 0 || cls.indexOf('sidebar-item-sub') >= 0 || cls.indexOf('sidebar-item') >= 0) {
    el.classList.add('active');
  } else {
    el.className = "flex items-center gap-3 px-4 py-3 rounded-xl font-bold";
    el.style.background = 'rgba(34,197,94,0.12)';
    el.style.color = '#22C55E';
    el.style.border = '1px solid rgba(34,197,94,0.25)';
    el.onmouseenter = null;
    el.onmouseleave = null;
  }
}

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
import { loadInputHistory } from './modules/input/inputHistory.js';
import { initPengaturanView } from './modules/pengaturan/pengaturan.js';
import { renderFormOrder } from './modules/order/formOrder.js';

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
    'form-order': 'admin',
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
  const penerimaanCabangView = document.getElementById('penerimaan-cabang-view');
  const mutasiView = document.getElementById('mutasi-view');
  const returView = document.getElementById('retur-view');
  const berandaView = document.getElementById('beranda-view');
  const pengaturanView = document.getElementById('pengaturan-view');
  const rekapBelanjaView = document.getElementById('rekap-belanja-view');
  const formOrderView = document.getElementById('form-order-view');
  const riwayatTransaksiView = document.getElementById('riwayat-transaksi-view');

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
  const menuPengaturan = document.getElementById('menu-pengaturan');
  const menuRekapBelanja = document.getElementById('menu-rekap-belanja');
  const menuFormOrder = document.getElementById('menu-form-order');

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
  penerimaanCabangView.classList.add('hidden');
  mutasiView.classList.add('hidden');
  returView.classList.add('hidden');
  berandaView.classList.add('hidden');
  pengaturanView.classList.add('hidden');
  riwayatTransaksiView.classList.add('hidden');
  
  const salesHubView = document.getElementById('sales-hub-view');
  if (salesHubView) salesHubView.classList.add('hidden');
  if (rekapBelanjaView) rekapBelanjaView.classList.add('hidden');
  if (formOrderView) formOrderView.classList.add('hidden');

  branchFilter.classList.add('hidden');
  if (summarySection) {
    summarySection.classList.add('hidden');
    summarySection.classList.remove('grid');
  }

  const menuPenerimaanCabang = document.getElementById('menu-penerimaan-cabang');
  const menuMutasi = document.getElementById('menu-mutasi');
  const menuRetur = document.getElementById('menu-retur');
  const menuRiwayatTransaksi = document.getElementById('menu-riwayat-transaksi');

  // Reset semua Menu Class (Non-aktif)
  const allMenus = [menuDist, menuStok, menuPenjualanWHO, menuPenerimaanPabrik,
    menuSalesDash, menuBestProducts, menuDailyReport, menuSalesPerDate,
    menuControlPoint, menuChatAi, menuInputStokBiz, menuInputStokExcel,
    menuSalesHub, menuInputDistribusi, menuBeranda, menuPengaturan, 
    menuRekapBelanja, menuFormOrder, menuPenerimaanCabang, menuMutasi, menuRetur, menuRiwayatTransaksi];

  allMenus.forEach(function(m) {
    if (!m) return;
    m.classList.remove('active');
    var cls = m.className;
    if (cls.indexOf('sidebar-item') >= 0 || cls.indexOf('sidebar-item-main') >= 0 || cls.indexOf('sidebar-item-sub') >= 0) return;
    m.className = "flex items-center gap-3 px-4 py-3 rounded-xl font-medium";
    m.style.background = 'transparent';
    m.style.color = '#94a3b8';
    m.style.border = 'none';
    m.onmouseenter = function() { this.style.background = 'rgba(51,65,85,0.5)'; this.style.color = '#f1f5f9'; };
    m.onmouseleave = function() { this.style.background = 'transparent'; this.style.color = '#94a3b8'; };
  });

  // Tampilkan View & Aktifkan Menu sesuai Pilihan
  if (menuName === 'stok') {
    stockView.classList.remove('hidden');
    pageTitle.innerText = "Ringkasan Stok";
    pageIcon.className = "fas fa-boxes";
    branchFilter.classList.remove('hidden');
    setActiveMenu(menuStok);
    // Selalu ambil ulang dari server: stok bisa berubah dari tab/perangkat lain
    // (Input Stok Excel, BIZ, penjualan) sehingga cache gData tidak bisa dipercaya.
    loadData();
  }
  else if (menuName === 'form-order') {
    if (formOrderView) formOrderView.classList.remove('hidden');
    pageTitle.innerText = "Form Order Kopi";
    pageIcon.className = "fas fa-shopping-cart";
    setActiveMenu(menuFormOrder);
    if (!state.gData) loadData().then(() => renderFormOrder());
    else renderFormOrder();
  }
  else if (menuName === 'penjualan-who') {
    penjualanWhoView.classList.remove('hidden');
    pageTitle.innerText = "Input Penjualan";
    pageIcon.className = "fas fa-file-invoice";
    setActiveMenu(menuPenjualanWHO);
  }
  else if (menuName === 'penerimaan-pabrik') {
    penerimaanPabrikView.classList.remove('hidden');
    pageTitle.innerText = "Input Penerimaan";
    pageIcon.className = "fas fa-factory";
    setActiveMenu(menuPenerimaanPabrik);
    initPenerimaanPabrik();
  }
  else if (menuName === 'best-products') {
    bestProductsView.classList.remove('hidden');
    pageTitle.innerText = "Best Produk";
    pageIcon.className = "fas fa-trophy";
    setActiveMenu(menuBestProducts);
    const bpContent = document.getElementById('best-products-content');
    const bpMonth = document.getElementById('best-products-month');
    if (bpMonth && bpMonth.options.length === 0) initBestProductsMonths();
    else if (bpContent && bpContent.innerHTML.trim() === '') loadBestProductsData();
  }
  else if (menuName === 'control-point') {
    controlPointView.classList.remove('hidden');
    pageTitle.innerText = "Perbandingan Stok BIZ vs Stok Excel";
    pageIcon.className = "fas fa-balance-scale";
    setActiveMenu(menuControlPoint);
    const cpContent = document.getElementById('cp-dashboard-content');
    if (!cpContent || cpContent.innerHTML.trim() === '' || cpContent.querySelector('.text-red-500')) loadControlPoint();
  }
  else if (menuName === 'input-stok-biz') {
    inputStokBizView.classList.remove('hidden');
    pageTitle.innerText = "Input Stok BIZ";
    pageIcon.className = "fas fa-database";
    setActiveMenu(menuInputStokBiz);
  }
  else if (menuName === 'input-stok-excel') {
    inputStokExcelView.classList.remove('hidden');
    pageTitle.innerText = "Input Stok Excel";
    pageIcon.className = "fas fa-file-excel";
    setActiveMenu(menuInputStokExcel);
  }
  else if (menuName === 'daily-report') {
    dailyReportView.classList.remove('hidden');
    pageTitle.innerText = "Penjualan Harian";
    pageIcon.className = "fas fa-calendar-week";
    setActiveMenu(menuDailyReport);
    const drContent = document.getElementById('daily-report-content');
    if (!drContent || drContent.innerHTML.trim() === '') initDailyReport();
  }
  else if (menuName === 'sales-per-date') {
    salesPerDateView.classList.remove('hidden');
    pageTitle.innerText = "Penjualan Pertanggal";
    pageIcon.className = "fas fa-calendar-day";
    setActiveMenu(menuSalesPerDate);
    const spContent = document.getElementById('sales-per-date-content');
    if (!spContent || spContent.innerHTML.trim() === '') initSalesPerDate();
  }
  else if (menuName === 'sales-dashboard') {
    salesDashboardView.classList.remove('hidden');
    pageTitle.innerText = "Report Penjualan";
    pageIcon.className = "fas fa-chart-line";
    branchFilter.classList.remove('hidden');
    setActiveMenu(menuSalesDash);
    loadSalesData();
  }
  else if (menuName === 'sales-hub') {
    document.getElementById('sales-hub-view').classList.remove('hidden');
    pageTitle.innerText = "Perbandingan Penjualan";
    pageIcon.className = "fas fa-chart-bar";
    setActiveMenu(menuSalesHub);
    initSalesHubDates();
  }
  else if (menuName === 'beranda') {
    berandaView.classList.remove('hidden');
    pageTitle.innerText = "Beranda";
    pageIcon.className = "fas fa-home";
    setActiveMenu(menuBeranda);
    loadBeranda();
  }
  else if (menuName === 'input-distribusi') {
    inputDistribusiView.classList.remove('hidden');
    pageTitle.innerText = "Input Distribusi";
    pageIcon.className = "fas fa-arrow-right-arrow-left";
    setActiveMenu(menuInputDistribusi);
    initInputDistribusi();
  }
  else if (menuName === 'chat-ai') {
    chatAiView.classList.remove('hidden');
    pageTitle.innerText = "Chat AI";
    pageIcon.className = "fas fa-comment-dots";
    setActiveMenu(menuChatAi);
  }
  else if (menuName === 'penerimaan-cabang') {
    penerimaanCabangView.classList.remove('hidden');
    pageTitle.innerText = "Input Penerimaan Cabang";
    pageIcon.className = "fas fa-box-open";
    setActiveMenu(menuPenerimaanCabang);
  }
  else if (menuName === 'mutasi') {
    mutasiView.classList.remove('hidden');
    pageTitle.innerText = "Input Mutasi Antar Cabang";
    pageIcon.className = "fas fa-exchange-alt";
    setActiveMenu(menuMutasi);
  }
  else if (menuName === 'retur') {
    if (returView) returView.classList.remove('hidden');
    pageTitle.innerText = "Input Retur / Kerugian";
    pageIcon.className = "fas fa-undo-alt";
    setActiveMenu(menuRetur);
  }
  else if (menuName === 'riwayat-transaksi') {
    if (riwayatTransaksiView) riwayatTransaksiView.classList.remove('hidden');
    pageTitle.innerText = "Riwayat Transaksi";
    pageIcon.className = "fas fa-history";
    setActiveMenu(menuRiwayatTransaksi);
    
    // Automatically load the currently selected type in dropdown
    const selectEl = document.getElementById('riwayat-transaksi-select');
    if (selectEl) {
      loadInputHistory(selectEl.value, 'riwayat-transaksi-content');
      // Set up onchange once
      if (!selectEl.hasAttribute('data-initialized')) {
        selectEl.addEventListener('change', (e) => {
          loadInputHistory(e.target.value, 'riwayat-transaksi-content');
        });
        const btnRefresh = document.getElementById('btn-refresh-riwayat');
        if (btnRefresh) {
          btnRefresh.addEventListener('click', () => {
            loadInputHistory(selectEl.value, 'riwayat-transaksi-content');
          });
        }
        selectEl.setAttribute('data-initialized', 'true');
      }
    }
  }
  else if (menuName === 'pengaturan') {
    pengaturanView.classList.remove('hidden');
    pageTitle.innerText = "Pengaturan";
    pageIcon.className = "fas fa-cog";
    setActiveMenu(menuPengaturan);
    initPengaturanView();
  }
  else if (menuName === 'rekap-belanja') {
    if (rekapBelanjaView) rekapBelanjaView.classList.remove('hidden');
    pageTitle.innerText = "Rekap Belanja";
    pageIcon.className = "fas fa-file-invoice-dollar";
    setActiveMenu(menuRekapBelanja);
    const rbContent = document.getElementById('rekap-belanja-tbody');
    if (!rbContent || rbContent.innerHTML.trim() === '') {
      import('./modules/reports/rekapBelanja.js').then(m => m.initRekapBelanja());
    }
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
    setActiveMenu(menuDist);
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
