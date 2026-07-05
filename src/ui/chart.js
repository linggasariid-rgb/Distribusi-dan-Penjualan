import { state } from '../state/appState.js';

export function registerChartPlugins() {
  if (typeof ChartDataLabels !== 'undefined' && Chart.register) Chart.register(ChartDataLabels);
}

export function updateChartTheme() {
  if (!state.branchRankingChart) return;
  var isDark = document.documentElement.classList.contains('dark');
  var tickColor = isDark ? '#94a3b8' : '#334155';
  state.branchRankingChart.options.scales.y.ticks.color = tickColor;
  state.branchRankingChart.update();
}
