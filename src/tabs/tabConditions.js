/**
 * AppSolar — Tab: Condiciones Externas y Escenarios
 */

import { state } from '../state.js';

const SLIDERS = [
  { key: 'irradiance', label: 'Irradiancia (G)', unit: 'W/m²', min: 0, max: 1400, step: 10 },
  { key: 'ambientTemp', label: 'Temperatura Ambiente', unit: '°C', min: -20, max: 55, step: 1 },
  { key: 'windSpeed', label: 'Velocidad del Viento', unit: 'm/s', min: 0, max: 30, step: 0.5 },
  { key: 'humidity', label: 'Humedad Relativa', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'albedo', label: 'Albedo (Reflectancia)', unit: '', min: 0, max: 1, step: 0.05 },
];

const CABLE_FIELDS = [
  { key: 'cableLength', label: 'Longitud Cable DC', unit: 'm', min: 1, max: 500, step: 1 },
  { key: 'cableSection', label: 'Sección Cable DC', unit: 'mm²', min: 1.5, max: 240, step: 0.5 },
];

export function render() {
  const cond = state.get('conditions');

  const renderSlider = (s) => {
    const val = cond[s.key];
    return `
      <div class="form-group">
        <label class="form-label">${s.label} <span class="unit">[${s.unit}]</span></label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="range" id="slider-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}" style="flex:1;">
          <input type="number" class="form-input" id="input-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}" style="width:70px; text-align:center;">
        </div>
      </div>
    `;
  };

  const renderCable = (f) => `
    <div class="form-group">
      <label class="form-label">${f.label} <span class="unit">[${f.unit}]</span></label>
      <div class="form-input-with-unit">
        <input class="form-input" type="number" id="input-${f.key}" value="${cond[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}">
        <span class="input-unit">${f.unit}</span>
      </div>
    </div>
  `;

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🌡️</span> Condiciones Externas</h2>
        <p class="page-subtitle">Ajusta los parámetros ambientales y de cableado. Guarda tus propios escenarios.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-stc">☀️ Condiciones STC</button>
      </div>
    </div>

    <div class="accordion-container" style="display:flex; flex-direction:column; gap:var(--space-md);">
      
      <!-- Panel 1: Ambientales -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">🌤️ Condiciones Ambientales</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-md);">
          ${SLIDERS.map(renderSlider).join('')}
        </div>
      </details>

      <!-- Panel 2: Cableado -->
      <details class="card details-panel">
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">🔌 Cableado DC</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
          ${CABLE_FIELDS.map(renderCable).join('')}
          <div class="form-group">
            <label class="form-label">Material del Conductor</label>
            <select class="form-select" id="select-cable-material">
              <option value="cu" ${cond.cableMaterial === 'cu' ? 'selected' : ''}>Cobre (Cu) — ρ = 0.0172</option>
              <option value="al" ${cond.cableMaterial === 'al' ? 'selected' : ''}>Aluminio (Al) — ρ = 0.0283</option>
            </select>
          </div>
        </div>
      </details>

      <!-- Panel 3: Escenarios -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">⚡ Mis Escenarios</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md">
          
          <div style="display:flex; gap:var(--space-sm); margin-bottom:var(--space-md); align-items:flex-end;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Nombre del nuevo escenario</label>
              <input type="text" class="form-input" id="input-scenario-name" placeholder="Ej: Invierno Severo">
            </div>
            <button class="btn btn-primary" id="btn-save-scenario">💾 Guardar Actual</button>
          </div>

          <div id="saved-scenarios-list" style="display:flex; flex-direction:column; gap:var(--space-sm);">
            <!-- Predefined -->
            <button class="btn btn-ghost preset-scenario" data-g="1100" data-t="40" data-v="2">☀️ Verano Caluroso (1100 W/m², 40°C)</button>
            <button class="btn btn-ghost preset-scenario" data-g="400" data-t="5" data-v="4">❄️ Invierno Frío (400 W/m², 5°C)</button>
            <button class="btn btn-ghost preset-scenario" data-g="200" data-t="20" data-v="3">☁️ Día Nublado (200 W/m², 20°C)</button>
            <hr style="border:0; border-top:1px solid var(--border-primary); margin: 8px 0;">
            <!-- Custom Scenarios injected here -->
          </div>

        </div>
      </details>

    </div>
  `;
}

export function init() {
  // Sync sliders and inputs
  SLIDERS.forEach(s => {
    const slider = document.getElementById(`slider-${s.key}`);
    const input = document.getElementById(`input-${s.key}`);

    const update = (val) => {
      val = parseFloat(val);
      if (isNaN(val)) return;
      state.set(`conditions.${s.key}`, val);
      if (slider) slider.value = val;
      if (input) input.value = val;
    };

    if (slider) slider.addEventListener('input', e => update(e.target.value));
    if (input) input.addEventListener('input', e => update(e.target.value));
  });

  // Cable inputs
  CABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`input-${f.key}`);
    if (input) input.addEventListener('input', e => state.set(`conditions.${f.key}`, parseFloat(e.target.value) || 0));
  });

  const matSelect = document.getElementById('select-cable-material');
  if (matSelect) matSelect.addEventListener('change', e => state.set('conditions.cableMaterial', e.target.value));

  // Accordion toggle
  document.querySelectorAll('details.details-panel').forEach(detail => {
    detail.addEventListener('toggle', () => {
      const icon = detail.querySelector('.details-icon');
      if (icon) icon.style.transform = detail.open ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  });

  // Scenarios Logic
  document.getElementById('btn-stc')?.addEventListener('click', () => {
    setScenario({ irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 50, albedo: 0.2 });
  });

  document.querySelectorAll('.preset-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const g = parseFloat(e.target.dataset.g);
      const t = parseFloat(e.target.dataset.t);
      const v = parseFloat(e.target.dataset.v);
      setScenario({ irradiance: g, ambientTemp: t, windSpeed: v });
    });
  });

  // Custom Scenarios
  renderCustomScenarios();

  document.getElementById('btn-save-scenario')?.addEventListener('click', () => {
    const nameInput = document.getElementById('input-scenario-name');
    const name = nameInput.value.trim();
    if (!name) return alert('Introduce un nombre para el escenario.');

    const cond = state.get('conditions');
    const scenarios = state.get('savedScenarios') || [];
    scenarios.push({
      name,
      conditions: {
        irradiance: cond.irradiance,
        ambientTemp: cond.ambientTemp,
        windSpeed: cond.windSpeed,
        humidity: cond.humidity,
        albedo: cond.albedo
      }
    });
    state.set('savedScenarios', scenarios);
    nameInput.value = '';
    renderCustomScenarios();
  });
}

function setScenario(values) {
  Object.entries(values).forEach(([key, val]) => {
    state.set(`conditions.${key}`, val);
    const slider = document.getElementById(`slider-${key}`);
    const input = document.getElementById(`input-${key}`);
    if (slider) slider.value = val;
    if (input) input.value = val;
  });
}

function renderCustomScenarios() {
  const container = document.getElementById('saved-scenarios-list');
  if (!container) return;
  
  // Remove existing custom scenarios
  container.querySelectorAll('.custom-scenario-item').forEach(e => e.remove());

  const scenarios = state.get('savedScenarios') || [];
  scenarios.forEach((sc, idx) => {
    const div = document.createElement('div');
    div.className = 'custom-scenario-item';
    div.style.display = 'flex';
    div.style.gap = '8px';
    
    const btnApply = document.createElement('button');
    btnApply.className = 'btn btn-ghost';
    btnApply.style.flex = '1';
    btnApply.style.justifyContent = 'flex-start';
    btnApply.innerHTML = `💾 ${sc.name} (${sc.conditions.irradiance} W/m², ${sc.conditions.ambientTemp}°C)`;
    btnApply.addEventListener('click', () => setScenario(sc.conditions));

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-secondary btn-sm';
    btnDel.textContent = '🗑️';
    btnDel.addEventListener('click', () => {
      const current = state.get('savedScenarios');
      current.splice(idx, 1);
      state.set('savedScenarios', current);
      renderCustomScenarios();
    });

    div.appendChild(btnApply);
    div.appendChild(btnDel);
    container.appendChild(div);
  });
}
