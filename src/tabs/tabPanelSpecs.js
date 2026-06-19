/**
 * AppSolar — Tab: Especificaciones del Panel Solar
 */

import { state } from '../state.js';
import { navigateTo } from '../router.js';

const FIELDS = [
  { key: 'modelName', label: 'Modelo / Nombre', unit: '', type: 'text', tooltip: 'Nombre comercial del módulo fotovoltaico.' },
  { key: 'manufacturer', label: 'Fabricante', unit: '', type: 'text', tooltip: 'Fabricante del módulo.' },
  { key: 'pmax', label: 'Potencia Máxima (Pmax)', unit: 'Wp', tooltip: 'Potencia máxima del panel en condiciones STC (1000 W/m², 25°C, AM1.5).' },
  { key: 'voc', label: 'Tensión de Circuito Abierto (Voc)', unit: 'V', tooltip: 'Tensión máxima del panel sin carga conectada en STC.' },
  { key: 'isc', label: 'Corriente de Cortocircuito (Isc)', unit: 'A', tooltip: 'Corriente máxima que circula cuando se cortocircuitan los terminales en STC.' },
  { key: 'vmp', label: 'Tensión en MPP (Vmp)', unit: 'V', tooltip: 'Tensión en el punto de máxima potencia en STC.' },
  { key: 'imp', label: 'Corriente en MPP (Imp)', unit: 'A', tooltip: 'Corriente en el punto de máxima potencia en STC.' },
  { key: 'noct', label: 'NOCT', unit: '°C', tooltip: 'Temperatura Nominal de Operación de la Celda. Medida a 800 W/m², 20°C ambiente, viento 1 m/s.' },
  { key: 'tempCoeffIsc', label: 'Coef. Temp. α (Isc)', unit: '%/°C', step: '0.001', tooltip: 'Variación porcentual de Isc por cada °C de cambio. Valor positivo (la corriente sube levemente con la temperatura).' },
  { key: 'tempCoeffVoc', label: 'Coef. Temp. β (Voc)', unit: '%/°C', step: '0.001', tooltip: 'Variación porcentual de Voc por cada °C. Valor negativo (la tensión baja con temperatura). Es el parámetro más crítico.' },
  { key: 'tempCoeffPmax', label: 'Coef. Temp. γ (Pmax)', unit: '%/°C', step: '0.001', tooltip: 'Variación porcentual de Pmax por cada °C. Valor negativo típico entre -0.30 y -0.45.' },
  { key: 'efficiency', label: 'Eficiencia del Panel', unit: '%', tooltip: 'Ratio entre la potencia eléctrica generada y la irradiancia incidente × área del panel en STC.' },
  { key: 'numCells', label: 'Número de Celdas', unit: 'uds', tooltip: 'Número de celdas conectadas en serie dentro del módulo. Típico: 60, 72, 120, 144.' },
  { key: 'length', label: 'Largo del Panel', unit: 'mm', tooltip: 'Dimensión mayor del módulo.' },
  { key: 'width', label: 'Ancho del Panel', unit: 'mm', tooltip: 'Dimensión menor del módulo.' },
  { key: 'weight', label: 'Peso', unit: 'kg', tooltip: 'Peso del módulo completo con marco.' },
  { key: 'tolerance', label: 'Tolerancia de Potencia', unit: '%', tooltip: 'Rango de variación de la potencia real respecto a la nominal (+/-).' },
];

const CELL_TYPES = [
  { value: 'monocrystalline', label: 'Monocristalino (PERC/TOPCon)' },
  { value: 'hjt', label: 'Heterounión (HJT)' },
  { value: 'polycrystalline', label: 'Policristalino' },
  { value: 'thinfilm', label: 'Capa Fina (CdTe/CIGS)' },
];

const GENERAL_FIELDS = ['manufacturer', 'modelName', 'length', 'width', 'weight'];
const ELECTRICAL_FIELDS = ['pmax', 'voc', 'isc', 'vmp', 'imp', 'efficiency', 'tolerance'];
const THERMAL_FIELDS = ['noct', 'tempCoeffVoc', 'tempCoeffIsc', 'tempCoeffPmax', 'numCells'];

export function render() {
  const panel = state.get('panelSpecs');

  const renderField = (key) => {
    const f = FIELDS.find(item => item.key === key);
    if (!f) return '';
    const val = panel[key] ?? '';
    if (f.type === 'text') {
      return `
        <div class="form-group" style="margin-bottom:0.8rem;">
          <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">
            ${f.label}
            ${f.tooltip ? `<span class="tooltip-trigger" data-tooltip="${f.tooltip}">i</span>` : ''}
          </label>
          <input class="form-input" type="text" data-key="${f.key}" value="${val}" placeholder="${f.label}" style="padding:6px 10px; font-size:0.85rem;">
        </div>
      `;
    } else {
      return `
        <div class="form-group" style="margin-bottom:0.8rem;">
          <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">
            ${f.label}
            ${f.unit ? `<span class="unit">[${f.unit}]</span>` : ''}
            ${f.tooltip ? `<span class="tooltip-trigger" data-tooltip="${f.tooltip}">i</span>` : ''}
          </label>
          <div class="form-input-with-unit" style="height:32px;">
            <input class="form-input" type="number" step="${f.step || 'any'}" data-key="${f.key}" value="${val}" style="padding:6px 10px; font-size:0.85rem; height:100%;">
            <span class="input-unit" style="padding:0 8px; font-size:0.8rem;">${f.unit}</span>
          </div>
        </div>
      `;
    }
  };

  const cellTypeOptions = CELL_TYPES.map(ct =>
    `<option value="${ct.value}" ${panel.cellType === ct.value ? 'selected' : ''}>${ct.label}</option>`
  ).join('');

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">⚡</span> Características del Panel Solar</h2>
        <p class="page-subtitle">Introduce los parámetros eléctricos y físicos del módulo fotovoltaico por grupos lógicos. Todos los valores eléctricos corresponden a condiciones STC.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-reset-panel">🔄 Restaurar Valores</button>
      </div>
    </div>

    <div class="grid-3" style="align-items: start; gap: var(--space-lg);">
      <!-- Grupo 1: Datos Físicos -->
      <div class="card" style="min-height: 520px;">
        <div class="card-header" style="margin-bottom: var(--space-md); padding-bottom: 8px;">
          <h3 style="font-size: var(--text-base);">📋 Físicos e Identificación</h3>
        </div>
        <div class="form-group" style="margin-bottom:0.8rem;">
          <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">
            Tipo de Celda
            <span class="tooltip-trigger" data-tooltip="Tecnología de fabricación de las celdas fotovoltaicas del módulo.">i</span>
          </label>
          <select class="form-select" id="cell-type-select" style="padding:6px 10px; font-size:0.85rem; height:32px;">
            ${cellTypeOptions}
          </select>
        </div>
        <div style="display:flex; flex-direction:column;">
          ${GENERAL_FIELDS.map(renderField).join('')}
        </div>
      </div>

      <!-- Grupo 2: Parámetros Eléctricos STC -->
      <div class="card" style="min-height: 520px;">
        <div class="card-header" style="margin-bottom: var(--space-md); padding-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base);">⚡ Parámetros STC</h3>
          <span class="badge badge-amber" style="font-size:0.65rem;">1000 W/m²</span>
        </div>
        <div style="display:flex; flex-direction:column;">
          ${ELECTRICAL_FIELDS.map(renderField).join('')}
        </div>
      </div>

      <!-- Grupo 3: Coeficientes de Temperatura -->
      <div class="card" style="min-height: 520px;">
        <div class="card-header" style="margin-bottom: var(--space-md); padding-bottom: 8px;">
          <h3 style="font-size: var(--text-base);">🌡️ Coeficientes Térmicos</h3>
        </div>
        <div style="display:flex; flex-direction:column;">
          ${THERMAL_FIELDS.map(renderField).join('')}
        </div>
      </div>
    </div>

    <div class="card mt-lg">
      <div class="card-header">
        <h3>📐 Vista Previa Calculada</h3>
      </div>
      <div class="result-grid" id="panel-preview-results">
        ${renderPreview(panel)}
      </div>
    </div>
  `;
}

function renderPreview(p) {
  const area = ((p.length || 0) / 1000) * ((p.width || 0) / 1000);
  const ff = (p.voc && p.isc) ? ((p.vmp * p.imp) / (p.voc * p.isc) * 100).toFixed(1) : '—';
  
  return `
    <div class="result-item">
      <div class="result-label">Área del Panel</div>
      <div class="result-value">${area.toFixed(2)}<span class="result-unit">m²</span></div>
    </div>
    <div class="result-item">
      <div class="result-label">Fill Factor</div>
      <div class="result-value">${ff}<span class="result-unit">%</span></div>
    </div>
    <div class="result-item">
      <div class="result-label">Potencia / m²</div>
      <div class="result-value">${area > 0 ? (p.pmax / area).toFixed(1) : '—'}<span class="result-unit">W/m²</span></div>
    </div>
    <div class="result-item">
      <div class="result-label">Peso / m²</div>
      <div class="result-value">${area > 0 ? (p.weight / area).toFixed(1) : '—'}<span class="result-unit">kg/m²</span></div>
    </div>
  `;
}

export function init() {
  // Input listeners
  document.querySelectorAll('[data-key]').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
      state.set(`panelSpecs.${key}`, val);
      
      // Update preview
      const preview = document.getElementById('panel-preview-results');
      if (preview) preview.innerHTML = renderPreview(state.get('panelSpecs'));
    });
  });

  // Cell type
  const cellSelect = document.getElementById('cell-type-select');
  if (cellSelect) {
    cellSelect.addEventListener('change', (e) => {
      state.set('panelSpecs.cellType', e.target.value);
    });
  }

  // Reset
  const btnReset = document.getElementById('btn-reset-panel');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.reset('panelSpecs');
      // Re-render by navigating to same tab
      navigateTo('panel-specs');
    });
  }
}
