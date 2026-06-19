/**
 * AppSolar — Main Entry Point
 * Solar Field Calculator Application
 */

import './styles/index.css';
import './styles/components.css';
import './styles/tabs.css';
import './styles/charts.css';

import { state } from './state.js';
import { registerTab, initRouter } from './router.js';

// Import all tab modules
import * as tabDashboard from './tabs/tabDashboard.js';
import * as tabDatasheet from './tabs/tabDatasheet.js';
import * as tabPanelSpecs from './tabs/tabPanelSpecs.js';
import * as tabArrayConfig from './tabs/tabArrayConfig.js';
import * as tabConditions from './tabs/tabConditions.js';
import * as tabLocation from './tabs/tabLocation.js';
import * as tabCellTemp from './tabs/tabCellTemp.js';
import * as tabResults from './tabs/tabResults.js';
import * as tabSummary from './tabs/tabSummary.js';

// Initialize application
function initApp() {
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', state.get('theme'));

  // Register all tabs
  registerTab('dashboard', tabDashboard);
  registerTab('datasheet', tabDatasheet);
  registerTab('panel-specs', tabPanelSpecs);
  registerTab('array-config', tabArrayConfig);
  registerTab('conditions', tabConditions);
  registerTab('location', tabLocation);
  registerTab('cell-temp', tabCellTemp);
  registerTab('results', tabResults);
  registerTab('summary', tabSummary);

  // Initialize router (renders sidebar + first tab)
  initRouter();

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Mobile menu
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('visible');
  });

  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('visible');
  });

  console.log('☀️ AppSolar initialized successfully');
}

function toggleTheme() {
  const current = state.get('theme');
  const next = current === 'dark' ? 'light' : 'dark';
  state.set('theme', next);
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('appsolar-theme', next);
  
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = next === 'dark' ? '🌙' : '☀️';
  const label = document.getElementById('theme-label');
  if (label) label.textContent = next === 'dark' ? 'Modo Oscuro' : 'Modo Claro';
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
