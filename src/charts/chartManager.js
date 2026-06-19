/**
 * AppSolar — Chart Manager
 * Factory and theme management for Chart.js charts
 */

import Chart from 'chart.js/auto';

// Chart theme colors
const CHART_COLORS = {
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  orange: '#f97316',
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  gray: '#94a3b8',
};

const CURVE_PALETTE = [
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
];

// Store all chart instances for cleanup
const chartInstances = {};

/**
 * Get current theme-aware defaults
 */
function getThemeDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    textColor: isDark ? '#94a3b8' : '#475569',
    gridColor: isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    bgColor: isDark ? '#162032' : '#ffffff',
    tickColor: isDark ? '#64748b' : '#94a3b8',
    fontFamily: "'Inter', sans-serif",
    monoFamily: "'JetBrains Mono', monospace",
  };
}

/**
 * Create or update a chart
 * @param {string} canvasId - Canvas element ID
 * @param {Object} config - Chart.js configuration
 * @returns {Chart} Chart instance
 */
export function createChart(canvasId, config) {
  // Destroy existing chart on same canvas
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const theme = getThemeDefaults();

  // Apply theme defaults
  Chart.defaults.color = theme.textColor;
  Chart.defaults.font.family = theme.fontFamily;
  Chart.defaults.font.size = 12;

  // Merge with theme-aware defaults
  const mergedConfig = {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { size: 11, family: theme.fontFamily },
            color: theme.textColor,
          },
          ...(config.options?.plugins?.legend || {}),
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { weight: '600', family: theme.fontFamily },
          bodyFont: { family: theme.monoFamily, size: 12 },
          displayColors: true,
          boxPadding: 4,
          ...(config.options?.plugins?.tooltip || {}),
        },
        ...(config.options?.plugins || {}),
      },
      scales: applyScaleDefaults(config.options?.scales, theme),
      ...(config.options || {}),
    },
  };

  // Override plugins back (the spread above may not deep-merge correctly)
  mergedConfig.options.plugins = {
    ...mergedConfig.options.plugins,
    ...(config.options?.plugins || {}),
    legend: { ...mergedConfig.options.plugins.legend, ...(config.options?.plugins?.legend || {}) },
    tooltip: { ...mergedConfig.options.plugins.tooltip, ...(config.options?.plugins?.tooltip || {}) },
  };

  const chart = new Chart(ctx, mergedConfig);
  chartInstances[canvasId] = chart;
  return chart;
}

function applyScaleDefaults(scales, theme) {
  if (!scales) return {};
  const result = {};
  for (const [key, scale] of Object.entries(scales)) {
    result[key] = {
      ...scale,
      grid: {
        color: theme.gridColor,
        drawBorder: false,
        ...(scale.grid || {}),
      },
      ticks: {
        color: theme.tickColor,
        font: { size: 11, family: theme.monoFamily },
        ...(scale.ticks || {}),
      },
      title: {
        display: !!scale.title?.text,
        color: theme.textColor,
        font: { size: 12, weight: '600', family: theme.fontFamily },
        ...(scale.title || {}),
      },
    };
  }
  return result;
}

/**
 * Update existing chart data
 */
export function updateChart(canvasId, data) {
  const chart = chartInstances[canvasId];
  if (!chart) return;
  
  if (data.labels) chart.data.labels = data.labels;
  if (data.datasets) chart.data.datasets = data.datasets;
  chart.update('none');
}

/**
 * Destroy a specific chart
 */
export function destroyChart(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

/**
 * Destroy all charts
 */
export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(id => {
    chartInstances[id].destroy();
    delete chartInstances[id];
  });
}

export { CHART_COLORS, CURVE_PALETTE };
