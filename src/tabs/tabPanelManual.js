/**
 * AppSolar — Tab: Datasheet Manual (Físicos, Eléctricos, Térmicos y Temp. Celda)
 */

import { state } from '../state.js';
import { calculateCellTemperature } from '../engine/thermalModel.js';

const FIELDS = [
  { key: 'modelName', label: 'Modelo / Nombre', unit: '', type: 'text' },
  { key: 'manufacturer', label: 'Fabricante', unit: '', type: 'text' },
  { key: 'length', label: 'Largo del Panel', unit: 'mm' },
  { key: 'width', label: 'Ancho del Panel', unit: 'mm' },
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'pmax', label: 'Potencia Máxima (Pmax)', unit: 'Wp' },
  { key: 'voc', label: 'Tensión de Circuito Abierto (Voc)', unit: 'V' },
  { key: 'isc', label: 'Corriente de Cortocircuito (Isc)', unit: 'A' },
  { key: 'vmp', label: 'Tensión en MPP (Vmp)', unit: 'V' },
  { key: 'imp', label: 'Corriente en MPP (Imp)', unit: 'A' },
  { key: 'efficiency', label: 'Eficiencia del Panel', unit: '%' },
  { key: 'tolerance', label: 'Tolerancia de Potencia', unit: '%' },
  { key: 'noct', label: 'NOCT', unit: '°C' },
  { key: 'tempCoeffIsc', label: 'Coef. Temp. α (Isc)', unit: '%/°C', step: '0.001' },
  { key: 'tempCoeffVoc', label: 'Coef. Temp. β (Voc)', unit: '%/°C', step: '0.001' },
  { key: 'tempCoeffPmax', label: 'Coef. Temp. γ (Pmax)', unit: '%/°C', step: '0.001' },
  { key: 'numCells', label: 'Número de Celdas', unit: 'uds' }
];

const CELL_TYPES = [
  { value: 'monocrystalline', label: 'Monocristalino (PERC/TOPCon)' },
  { value: 'hjt', label: 'Heterounión (HJT)' },
  { value: 'polycrystalline', label: 'Policristalino' },
  { value: 'thinfilm', label: 'Capa Fina (CdTe/CIGS)' },
];

const GENERAL_FIELDS = ['manufacturer', 'modelName'];
const DIMENSION_FIELDS = ['length', 'width', 'weight', 'numCells'];
const STC_MAX_FIELDS = ['pmax', 'voc', 'isc'];
const STC_MPP_FIELDS = ['vmp', 'imp'];
const STC_OTHER_FIELDS = ['efficiency', 'tolerance'];
const THERMAL_FIELDS = ['tempCoeffVoc', 'tempCoeffIsc', 'tempCoeffPmax'];

export function render() {
  const panel = state.get('panelSpecs');
  const ct = state.get('cellTemp');

  const renderField = (key) => {
    const f = FIELDS.find(item => item.key === key);
    if (!f) return '';
    const val = panel[key] ?? '';
    if (f.type === 'text') {
      return `
        <div class="form-group" style="margin-bottom:0.8rem;">
          <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">${f.label}</label>
          <input class="form-input ds-manual-input" type="text" data-key="${f.key}" value="${val}" placeholder="${f.label}" style="padding:6px 10px; font-size:0.85rem;">
        </div>
      `;
    } else {
      return `
        <div class="form-group" style="margin-bottom:0.8rem;">
          <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">
            ${f.label} ${f.unit ? `<span class="unit">[${f.unit}]</span>` : ''}
          </label>
          <div class="form-input-with-unit" style="height:32px;">
            <input class="form-input ds-manual-input" type="number" step="${f.step || 'any'}" data-key="${f.key}" value="${val}" style="padding:6px 10px; font-size:0.85rem; height:100%;">
            <span class="input-unit" style="padding:0 8px; font-size:0.8rem;">${f.unit}</span>
          </div>
        </div>
      `;
    }
  };

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📝</span> Datos Manuales del Panel</h2>
        <p class="page-subtitle">Introduce o edita los parámetros físicos, eléctricos y térmicos del módulo, así como el método de cálculo de temperatura de celda.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-reset-panel">🔄 Restaurar Valores</button>
      </div>
    </div>

    <!-- Vista Previa Calculada Superior -->
    <div class="card" style="margin-bottom: var(--space-lg); border-color: var(--solar-blue);">
      <div class="card-header" style="padding-bottom: 8px;">
        <h3 style="color: var(--solar-blue);">📐 Vista Previa Calculada</h3>
      </div>
      <div class="result-grid" id="panel-preview-results" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
        ${renderPreview(panel, ct)}
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <!-- Pestañas (Tab Nav) -->
      <div style="display:flex; border-bottom:1px solid var(--border-primary); background:var(--bg-tertiary); overflow-x:auto;">
        <button class="ds-tab-btn active" data-target="tab-physical" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-primary); background:none; border:none; border-bottom:3px solid var(--solar-amber); cursor:pointer; white-space:nowrap;">📋 Físicos</button>
        <button class="ds-tab-btn" data-target="tab-stc" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-secondary); background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap;">⚡ STC</button>
        <button class="ds-tab-btn" data-target="tab-thermal" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-secondary); background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap;">🌡️ Térmicos</button>
        <button class="ds-tab-btn" data-target="tab-temp" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-secondary); background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap;">🔬 Temp. Celda</button>
      </div>

      <!-- Contenedor de Pestañas -->
      <div style="padding:var(--space-md);">
        
        <!-- Tab 1: Físicos -->
        <div class="ds-tab-pane active" id="tab-physical">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">📋 Físicos e Identificación</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-md);">
            <div>
              ${GENERAL_FIELDS.map(renderField).join('')}
              <div class="form-group" style="margin-bottom:0.8rem;">
                <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">Tipo de Celda</label>
                <select class="form-select" id="cell-type-select" style="padding:6px 10px; font-size:0.85rem; height:32px;">
                  ${CELL_TYPES.map(c => `<option value="${c.value}" ${panel.cellType === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div>
              <h4 style="font-size:0.85rem; margin-bottom:8px; color:var(--text-secondary); border-bottom:1px solid var(--border-primary); padding-bottom:4px;">Dimensiones Físicas</h4>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                ${DIMENSION_FIELDS.map(renderField).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: STC -->
        <div class="ds-tab-pane" id="tab-stc" style="display:none;">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">⚡ Parámetros STC <span class="badge badge-amber" style="font-size:0.65rem; margin-left:8px;">1000 W/m²</span></h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div>
              <h4 style="font-size:0.85rem; margin-bottom:8px; color:var(--text-secondary); border-bottom:1px solid var(--border-primary); padding-bottom:4px;">Valores Máximos</h4>
              ${STC_MAX_FIELDS.map(renderField).join('')}
            </div>
            <div>
              <h4 style="font-size:0.85rem; margin-bottom:8px; color:var(--text-secondary); border-bottom:1px solid var(--border-primary); padding-bottom:4px;">Punto de Máxima Potencia (MPP)</h4>
              ${STC_MPP_FIELDS.map(renderField).join('')}
            </div>
            <div>
              <h4 style="font-size:0.85rem; margin-bottom:8px; color:var(--text-secondary); border-bottom:1px solid var(--border-primary); padding-bottom:4px;">Rendimiento</h4>
              ${STC_OTHER_FIELDS.map(renderField).join('')}
            </div>
          </div>
        </div>

        <!-- Tab 3: Térmicos -->
        <div class="ds-tab-pane" id="tab-thermal" style="display:none;">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">🌡️ Coeficientes Térmicos</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            ${THERMAL_FIELDS.map(renderField).join('')}
          </div>
        </div>

        <!-- Tab 4: Temp Celda -->
        <div class="ds-tab-pane" id="tab-temp" style="display:none;">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">🔬 Método Cálculo Temp. Celda</h3>
          <div class="form-group" style="max-width: 300px; margin-bottom: var(--space-md);">
            <label class="form-label">Modelo de Temperatura</label>
            <select class="form-select" id="select-temp-method">
              <option value="noct" ${ct.method === 'noct' ? 'selected' : ''}>NOCT Estándar</option>
              <option value="faiman" ${ct.method === 'faiman' ? 'selected' : ''}>Modelo Faiman (corrección viento)</option>
              <option value="sandia" ${ct.method === 'sandia' ? 'selected' : ''}>Modelo Sandia</option>
              <option value="manual" ${ct.method === 'manual' ? 'selected' : ''}>Introducción Manual</option>
            </select>
          </div>
          
          <div style="margin-bottom: var(--space-md); max-width: 300px;">
            ${renderField('noct')}
          </div>

          <div id="method-params" style="background:var(--bg-tertiary); padding:var(--space-md); border-radius:var(--radius-md);">
            ${renderMethodParams(ct, panel)}
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderPreview(p, ct) {
  const area = ((p.length || 0) / 1000) * ((p.width || 0) / 1000);
  const ff = (p.voc && p.isc) ? ((p.vmp * p.imp) / (p.voc * p.isc) * 100).toFixed(1) : '—';
  
  // Calculate current cell temp with current conditions
  const cond = state.get('conditions');
  const tCell = calculateCellTemperature(ct.method, cond.ambientTemp, cond.irradiance, cond.windSpeed, p.noct, ct);
  const thermalLoss = (Math.abs(p.tempCoeffPmax || 0) * Math.max(0, tCell - 25)).toFixed(1);

  return `
    <div class="result-item">
      <div class="result-label">Área Panel</div>
      <div class="result-value">${area.toFixed(2)}<span class="result-unit">m²</span></div>
    </div>
    <div class="result-item">
      <div class="result-label">Fill Factor</div>
      <div class="result-value">${ff}<span class="result-unit">%</span></div>
    </div>
    <div class="result-item">
      <div class="result-label">Wp / m²</div>
      <div class="result-value">${area > 0 ? (p.pmax / area).toFixed(1) : '—'}<span class="result-unit">W/m²</span></div>
    </div>
    <div class="result-item" style="border-color: var(--solar-amber);">
      <div class="result-label">Temp Celda Actual</div>
      <div class="result-value" style="color:var(--solar-amber);">${tCell.toFixed(1)}<span class="result-unit">°C</span></div>
    </div>
    <div class="result-item" style="border-color: var(--solar-red);">
      <div class="result-label">Pérdida Térmica Actual</div>
      <div class="result-value" style="color:var(--solar-red);">${thermalLoss}<span class="result-unit">%</span></div>
    </div>
  `;
}

function renderMethodParams(ct, panel) {
  switch (ct.method) {
    case 'manual':
      return `
        <div class="slider-group">
          <div class="slider-header">
            <span class="slider-label">Temperatura de Celda</span>
            <div class="slider-value-display">
              <span class="slider-value" id="val-manual-temp">${ct.manualTemp}</span>
              <span class="slider-unit">°C</span>
            </div>
          </div>
          <div class="slider-input-row">
            <input type="range" id="slider-manual-temp" min="0" max="90" value="${ct.manualTemp}" step="1">
            <input type="number" class="form-input" id="input-manual-temp" value="${ct.manualTemp}" min="0" max="90">
          </div>
        </div>
        <div style="margin-top:var(--space-md); padding:var(--space-sm); background:rgba(0,0,0,0.2); border-left:3px solid var(--solar-amber); border-radius:4px; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">
          Fórmula: <br/>
          <span style="color:var(--text-primary);">T_celda = T_manual</span>
        </div>
      `;
    case 'faiman':
      return `
        <div class="grid-2" style="gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">U₀ <span class="unit">[W/(m²·K)]</span></label>
            <input class="form-input ct-input" type="number" id="input-faiman-u0" value="${ct.faimanU0}" step="0.1">
          </div>
          <div class="form-group">
            <label class="form-label">U₁ <span class="unit">[W·s/(m³·K)]</span></label>
            <input class="form-input ct-input" type="number" id="input-faiman-u1" value="${ct.faimanU1}" step="0.01">
          </div>
        </div>
        <div style="margin-top:var(--space-md); padding:var(--space-sm); background:rgba(0,0,0,0.2); border-left:3px solid var(--solar-amber); border-radius:4px; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">
          Fórmula (Faiman): <br/>
          <span style="color:var(--text-primary);">T_celda = T_amb + G / (U₀ + U₁ × V_viento)</span>
        </div>
      `;
    case 'sandia':
      return `
        <div class="grid-3" style="gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">a</label>
            <input class="form-input ct-input" type="number" id="input-sandia-a" value="${ct.sandiaA}" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">b</label>
            <input class="form-input ct-input" type="number" id="input-sandia-b" value="${ct.sandiaB}" step="0.001">
          </div>
          <div class="form-group">
            <label class="form-label">ΔT <span class="unit">[°C]</span></label>
            <input class="form-input ct-input" type="number" id="input-sandia-dt" value="${ct.sandiaDeltaT}" step="0.5">
          </div>
        </div>
        <div style="margin-top:var(--space-md); padding:var(--space-sm); background:rgba(0,0,0,0.2); border-left:3px solid var(--solar-amber); border-radius:4px; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">
          Fórmula (Sandia): <br/>
          <span style="color:var(--text-primary);">T_modulo = T_amb + G × e^(a + b × V_viento)</span><br/>
          <span style="color:var(--text-primary);">T_celda = T_modulo + (G / 1000) × ΔT</span>
        </div>
      `;
    default:
      return `
        <p style="color:var(--text-secondary); font-size:var(--text-sm); margin-bottom:var(--space-sm);">El modelo NOCT usa directamente el valor NOCT de la ficha técnica (${panel.noct || '—'}°C).</p>
        <div style="padding:var(--space-sm); background:rgba(0,0,0,0.2); border-left:3px solid var(--solar-amber); border-radius:4px; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">
          Fórmula (NOCT Estándar): <br/>
          <span style="color:var(--text-primary);">T_celda = T_amb + (NOCT - 20) × (G / 800)</span>
        </div>
      `;
  }
}

function updatePreviewUI() {
  const preview = document.getElementById('panel-preview-results');
  if (preview) {
    preview.innerHTML = renderPreview(state.get('panelSpecs'), state.get('cellTemp'));
  }
}

export function init() {
  // Input listeners for Panel Specs
  document.querySelectorAll('.ds-manual-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
      state.set(`panelSpecs.${key}`, val);
      updatePreviewUI();
    });
  });

  const cellSelect = document.getElementById('cell-type-select');
  if (cellSelect) {
    cellSelect.addEventListener('change', (e) => {
      state.set('panelSpecs.cellType', e.target.value);
    });
  }

  // Input listeners for Cell Temp method
  document.getElementById('select-temp-method')?.addEventListener('change', (e) => {
    state.set('cellTemp.method', e.target.value);
    const paramsDiv = document.getElementById('method-params');
    if (paramsDiv) paramsDiv.innerHTML = renderMethodParams(state.get('cellTemp'), state.get('panelSpecs'));
    initMethodInputs();
    updatePreviewUI();
  });

  initMethodInputs();

  // Tab logic
  document.querySelectorAll('.ds-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Deactivate all
      document.querySelectorAll('.ds-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = 'var(--text-secondary)';
        b.style.borderBottomColor = 'transparent';
      });
      document.querySelectorAll('.ds-tab-pane').forEach(p => p.style.display = 'none');
      
      // Activate clicked
      const targetId = e.currentTarget.dataset.target;
      e.currentTarget.classList.add('active');
      e.currentTarget.style.color = 'var(--text-primary)';
      e.currentTarget.style.borderBottomColor = 'var(--solar-amber)';
      
      const pane = document.getElementById(targetId);
      if (pane) pane.style.display = 'block';
    });
  });

  // Reset button
  document.getElementById('btn-reset-panel')?.addEventListener('click', () => {
    state.reset('panelSpecs');
    state.reset('cellTemp');
    // Forzar re-render desde router no es trivial sin exportarlo de forma cíclica,
    // pero podemos hacer un reload suave de la vista
    window.location.reload();
  });
}

function initMethodInputs() {
  const updateCT = (key, val) => {
    state.set(`cellTemp.${key}`, parseFloat(val));
    updatePreviewUI();
  };

  const sliderManual = document.getElementById('slider-manual-temp');
  const inputManual = document.getElementById('input-manual-temp');
  if (sliderManual && inputManual) {
    const updateManual = val => {
      val = parseFloat(val);
      state.set('cellTemp.manualTemp', val);
      sliderManual.value = val;
      inputManual.value = val;
      document.getElementById('val-manual-temp').textContent = val;
      updatePreviewUI();
    };
    sliderManual.addEventListener('input', e => updateManual(e.target.value));
    inputManual.addEventListener('input', e => updateManual(e.target.value));
  }

  document.getElementById('input-faiman-u0')?.addEventListener('input', e => updateCT('faimanU0', e.target.value));
  document.getElementById('input-faiman-u1')?.addEventListener('input', e => updateCT('faimanU1', e.target.value));
  document.getElementById('input-sandia-a')?.addEventListener('input', e => updateCT('sandiaA', e.target.value));
  document.getElementById('input-sandia-b')?.addEventListener('input', e => updateCT('sandiaB', e.target.value));
  document.getElementById('input-sandia-dt')?.addEventListener('input', e => updateCT('sandiaDeltaT', e.target.value));
}
