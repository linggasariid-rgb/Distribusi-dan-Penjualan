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
  var moonSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var sunSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var headerMoon = moonSvg.replace('width="16"', 'width="20"').replace('height="16"', 'height="20"');
  var headerSun = sunSvg.replace('width="16"', 'width="20"').replace('height="16"', 'height="20"');
  var sidebarIcon = document.getElementById('sidebar-theme-icon');
  var headerIcon = document.getElementById('header-theme-icon');
  if (sidebarIcon) sidebarIcon.innerHTML = isDark ? sunSvg : moonSvg;
  if (headerIcon) headerIcon.innerHTML = isDark ? headerSun : headerMoon;
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
  document.documentElement.style.transition = 'background-color 300ms ease, color 300ms ease';
  updateThemeIcons();
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
