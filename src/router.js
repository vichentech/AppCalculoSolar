/**
 * AppSolar — Router
 * Hash-based SPA tab navigation
 */

import { state } from './state.js';

const tabs = [
  { id: 'dashboard',    icon: '🏠', label: 'Mis Proyectos',       section: 'Gestión' },
  
  { id: 'panel-manual', icon: '📝', label: 'Datasheet Manual',    section: 'Entrada de Datos' },
  { id: 'datasheet',    icon: '🤖', label: 'IA Datasheet',        section: 'Entrada de Datos' },
  
  { id: 'location',     icon: '📍', label: 'Localización GPS',    section: 'Parque Solar' },
  { id: 'array-config', icon: '🔗', label: 'Configuración del Parque', section: 'Parque Solar' },
  { id: 'park-builder', icon: '🏗️', label: 'Diseño en Planta',    section: 'Parque Solar' },
  
  { id: 'results',      icon: '📊', label: 'Resumen y Simulación', section: 'Análisis' },
  { id: 'protections',  icon: '🛡️', label: 'Protecciones',        section: 'Análisis' },
];

let tabInitializers = {};
let currentTab = null;

/**
 * Register a tab's render and init functions
 */
export function registerTab(id, { render, init, onActivate }) {
  tabInitializers[id] = { render, init, onActivate };
}

/**
 * Initialize the router
 */
export function initRouter() {
  renderSidebar();
  
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const tabId = window.location.hash.slice(1) || 'dashboard';
    navigateTo(tabId);
  });

  // Initial navigation
  const initialTab = window.location.hash.slice(1) || 'dashboard';
  navigateTo(initialTab);
}

/**
 * Navigate to a specific tab
 */
export function navigateTo(tabId) {
  if (tabId === 'summary') tabId = 'results';
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Update hash without triggering hashchange
  if (window.location.hash !== `#${tabId}`) {
    history.replaceState(null, '', `#${tabId}`);
  }

  // Update state
  state.set('activeTab', tabId);
  currentTab = tabId;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });

  // Render tab content
  const contentArea = document.getElementById('tab-content');
  if (!contentArea) return;

  const tabDef = tabInitializers[tabId];
  if (tabDef) {
    contentArea.innerHTML = tabDef.render();
    contentArea.className = 'tab-content';
    // Force re-trigger animation
    void contentArea.offsetWidth;
    
    if (tabDef.init) {
      tabDef.init();
    }
    if (tabDef.onActivate) {
      tabDef.onActivate();
    }
  }

  // Close mobile sidebar
  document.querySelector('.sidebar')?.classList.remove('open');
  document.querySelector('.sidebar-overlay')?.classList.remove('visible');
}

/**
 * Render sidebar navigation
 */
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  let html = '';
  let currentSection = '';

  tabs.forEach(tab => {
    if (tab.section !== currentSection) {
      currentSection = tab.section;
      html += `<div class="nav-section-label">${currentSection}</div>`;
    }
    html += `
      <button class="nav-item" data-tab="${tab.id}" id="nav-${tab.id}">
        <span class="nav-icon">${tab.icon}</span>
        <span class="nav-text">${tab.label}</span>
      </button>
    `;
  });

  nav.innerHTML = html;

  // Attach click handlers
  nav.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.tab);
    });
  });
}

export { tabs };
