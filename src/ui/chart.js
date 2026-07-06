import { state } from '../state/appState.js';

export function registerChartPlugins() {
  if (typeof ChartDataLabels !== 'undefined' && Chart.register) Chart.register(ChartDataLabels);
}

export function getChartTheme() {
  var isDark = document.documentElement.classList.contains('dark');
  return {
    gridColor: isDark ? '#1e293b' : '#e2e8f0',
    tickColor: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipText: isDark ? '#f1f5f9' : '#0f172a',
    fontFamily: "'Fira Sans', 'Inter', sans-serif",
  };
}

export function applyChartTheme(chart) {
  if (!chart) return;
  var theme = getChartTheme();
  var opts = chart.options;

  if (opts.scales) {
    Object.values(opts.scales).forEach(function(scale) {
      if (scale.ticks) {
        scale.ticks.color = theme.tickColor;
        scale.ticks.font = scale.ticks.font || {};
        scale.ticks.font.family = theme.fontFamily;
      }
      if (scale.grid) {
        scale.grid.color = theme.gridColor;
      }
    });
  }

  if (opts.plugins) {
    if (opts.plugins.tooltip) {
      opts.plugins.tooltip.backgroundColor = theme.tooltipBg;
      opts.plugins.tooltip.titleColor = theme.tooltipText;
      opts.plugins.tooltip.bodyColor = theme.tooltipText;
      opts.plugins.tooltip.borderColor = theme.tooltipBorder;
      opts.plugins.tooltip.borderWidth = 1;
      opts.plugins.tooltip.titleFont = opts.plugins.tooltip.titleFont || {};
      opts.plugins.tooltip.titleFont.family = theme.fontFamily;
      opts.plugins.tooltip.bodyFont = opts.plugins.tooltip.bodyFont || {};
      opts.plugins.tooltip.bodyFont.family = theme.fontFamily;
    }
    if (opts.plugins.legend) {
      opts.plugins.legend.labels = opts.plugins.legend.labels || {};
      opts.plugins.legend.labels.color = theme.tickColor;
      opts.plugins.legend.labels.font = opts.plugins.legend.labels.font || {};
      opts.plugins.legend.labels.font.family = theme.fontFamily;
    }
  }

  chart.update('none');
}

export function updateChartTheme() {
  if (state.branchRankingChart) {
    applyChartTheme(state.branchRankingChart);
  }
}
