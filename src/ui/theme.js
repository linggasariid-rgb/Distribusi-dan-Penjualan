import { getTheme, setTheme } from '../services/storageService.js';
import { state } from '../state/appState.js';
import { updateChartTheme } from './chart.js';

export function applyTheme() {
  var theme = getTheme();
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcons();
}

export function updateThemeIcons() {
  var isDark = document.documentElement.classList.contains('dark');
  var iconClass = isDark ? 'fas fa-sun' : 'fas fa-moon';
  var headerIcon = document.getElementById('header-theme-icon');
  var sidebarIcon = document.getElementById('sidebar-theme-icon');
  if (headerIcon) headerIcon.className = iconClass + ' text-lg';
  if (sidebarIcon) sidebarIcon.className = iconClass;
}

export function toggleTheme() {
  var isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark');
    setTheme('light');
  } else {
    document.documentElement.classList.add('dark');
    setTheme('dark');
  }
  updateThemeIcons();
  // Update Chart.js colors if charts exist
  if (state.branchRankingChart) {
    updateChartTheme();
  }
}

export function getExportBgColor() {
  return document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff';
}

export function getExportBodyBgColor() {
  return document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc';
}
