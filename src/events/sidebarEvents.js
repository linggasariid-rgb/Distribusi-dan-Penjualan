import { switchMenu } from '../router.js';
import { toggleTheme } from '../ui/theme.js';
import { toggleMenuGroup } from '../ui/sidebar.js';

const MENU_IDS = [
  'beranda', 'distribusi', 'penerimaan-pabrik', 'input-distribusi',
  'penerimaan-cabang', 'mutasi', 'retur', 'riwayat-transaksi',
  'input-stok-excel', 'input-stok-biz', 'penjualan-who', 'sales-dashboard',
  'sales-hub', 'daily-report', 'sales-per-date', 'stok', 'form-order', 'control-point',
  'best-products', 'rekap-belanja', 'pengaturan', 'chat-ai'
];

export function initSidebarEvents() {
  MENU_IDS.forEach(menuName => {
    const el = document.getElementById('menu-' + menuName);
    if (el) el.addEventListener('click', () => switchMenu(menuName));
  });

  document.querySelectorAll('a[data-action="toggle-menu-group"]').forEach(el => {
    el.addEventListener('click', () => toggleMenuGroup(el));
  });

  const headerThemeToggle = document.getElementById('header-theme-toggle');
  if (headerThemeToggle) headerThemeToggle.addEventListener('click', toggleTheme);

  const sidebarThemeToggle = document.getElementById('sidebar-theme-toggle');
  if (sidebarThemeToggle) sidebarThemeToggle.addEventListener('click', toggleTheme);
}
