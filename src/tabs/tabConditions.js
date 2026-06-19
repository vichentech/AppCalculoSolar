/**
 * AppSolar — Tab: Condiciones Externas
 */

import { state } from '../state.js';

const SLIDERS = [
  { key: 'irradiance', label: 'Irradiancia (G)', unit: 'W/m²', min: 0, max: 1400, step: 10, tooltip: 'Irradiancia solar sobre el plano del módulo. STC = 1000 W/m². Valor máximo práctico ≈ 1200 W/m².' },
  { key: 'ambientTemp', label: 'Temperatura Ambiente', unit: '°C', min: -20, max: 55, step: 1, tooltip: 'Temperatura del aire alrededor de los paneles. Influye directamente en la temperatura de la celda y por tanto en el rendimiento.' },
  { key: 'windSpeed', label: 'Velocidad del Viento', unit: 'm/s', min: 0, max: 30, step: 0.5, tooltip: 'El viento refrigera los paneles y reduce la temperatura de la celda. NOCT se mide a 1 m/s.' },
  { key: 'humidity', label: 'Humedad Relativa', unit: '%', min: 0, max: 100, step: 1, tooltip: 'Humedad relativa del aire. Tiene un efecto menor en el rendimiento del panel.' },
  { key: 'albedo', label: 'Albedo (Reflectancia Suelo)', unit: '', min: 0, max: 1, step: 0.05, tooltip: 'Fracción de radiación reflejada por el suelo. Hierba ≈ 0.2, arena ≈ 0.3, nieve ≈ 0.8, asfalto ≈ 0.1.' },
];

const CABLE_FIELDS = [
  { key: 'cableLength', label: 'Longitud del Cable DC', unit: 'm', min: 1, max: 500, step: 1, tooltip: 'Distancia del cableado DC desde los strings hasta el cuadro/inversor (un solo tramo, no ida+vuelta).' },
  { key: 'cableSection', label: 'Sección del Cable DC', unit: 'mm²', min: 1.5, max: 240, step: 0.5, tooltip: 'Sección transversal del conductor. Secciones estándar: 4, 6, 10, 16, 25, 35, 50 mm².' },
];

export function render() {
  const cond = state.get('conditions');

  let slidersHtml = SLIDERS.map(s => {
    const val = cond[s.key];
    return `
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">${s.label}
            <span class="tooltip-trigger" data-tooltip="${s.tooltip}">i</span>
          </span>
          <div class="slider-value-display">
            <span class="slider-value" id="val-${s.key}">${val}</span>
            ${s.unit ? `<span class="slider-unit">${s.unit}</span>` : ''}
          </div>
        </div>
        <div class="slider-input-row">
          <input type="range" id="slider-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}">
          <input type="number" class="form-input" id="input-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}">
        </div>
        <div class="slider-range-labels"><span>${s.min}${s.unit ? ' '+s.unit : ''}</span><span>${s.max}${s.unit ? ' '+s.unit : ''}</span></div>
      </div>
    `;
  }).join('');

  let cableHtml = CABLE_FIELDS.map(f => `
    <div class="form-group">
      <label class="form-label">${f.label} <span class="unit">[${f.unit}]</span>
        <span class="tooltip-trigger" data-tooltip="${f.tooltip}">i</span>
      </label>
      <div class="form-input-with-unit">
        <input class="form-input" type="number" id="input-${f.key}" value="${cond[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}">
        <span class="input-unit">${f.unit}</span>
      </div>
    </div>
  `).join('');

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🌡️</span> Condiciones Externas</h2>
        <p class="page-subtitle">Ajusta los parámetros ambientales y de cableado. Los cambios se reflejan en tiempo real en los resultados.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-stc">☀️ Condiciones STC</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>🌤️ Condiciones Ambientales</h3>
          <span class="badge badge-green">Tiempo Real</span>
        </div>
        ${slidersHtml}
      </div>

      <div>
        <div class="card">
          <div class="card-header">
            <h3>🔌 Cableado DC</h3>
          </div>
          ${cableHtml}

          <div class="form-group">
            <label class="form-label">Material del Conductor
              <span class="tooltip-trigger" data-tooltip="Cobre (Cu): menor resistividad, más común. Aluminio (Al): más ligero y económico, mayor resistividad.">i</span>
            </label>
            <select class="form-select" id="select-cable-material">
              <option value="cu" ${cond.cableMaterial === 'cu' ? 'selected' : ''}>Cobre (Cu) — ρ = 0.0172 Ω·mm²/m</option>
              <option value="al" ${cond.cableMaterial === 'al' ? 'selected' : ''}>Aluminio (Al) — ρ = 0.0283 Ω·mm²/m</option>
            </select>
          </div>
        </div>

        <div class="card mt-lg">
          <div class="card-header">
            <h3>⚡ Escenarios Predefinidos</h3>
          </div>
          <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
            <button class="btn btn-ghost" id="btn-scenario-summer">☀️ Verano Caluroso (1100 W/m², 40°C)</button>
            <button class="btn btn-ghost" id="btn-scenario-winter">❄️ Invierno Frío (400 W/m², 5°C)</button>
            <button class="btn btn-ghost" id="btn-scenario-cloudy">☁️ Día Nublado (200 W/m², 20°C)</button>
            <button class="btn btn-ghost" id="btn-scenario-optimal">🌟 Condiciones Óptimas (1000 W/m², 15°C)</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  // Slider bindings
  SLIDERS.forEach(s => {
    const slider = document.getElementById(`slider-${s.key}`);
    const input = document.getElementById(`input-${s.key}`);
    const display = document.getElementById(`val-${s.key}`);

    const update = (val) => {
      val = parseFloat(val);
      if (isNaN(val)) return;
      state.set(`conditions.${s.key}`, val);
      if (slider) slider.value = val;
      if (input) input.value = val;
      if (display) display.textContent = s.step < 1 ? val.toFixed(s.step.toString().split('.')[1]?.length || 1) : val;
    };

    if (slider) slider.addEventListener('input', e => update(e.target.value));
    if (input) input.addEventListener('input', e => update(e.target.value));
  });

  // Cable fields
  CABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`input-${f.key}`);
    if (input) {
      input.addEventListener('input', e => {
        state.set(`conditions.${f.key}`, parseFloat(e.target.value) || 0);
      });
    }
  });

  // Cable material
  const matSelect = document.getElementById('select-cable-material');
  if (matSelect) {
    matSelect.addEventListener('change', e => state.set('conditions.cableMaterial', e.target.value));
  }

  // STC button
  document.getElementById('btn-stc')?.addEventListener('click', () => {
    setScenario({ irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 50, albedo: 0.2 });
  });

  // Scenarios
  document.getElementById('btn-scenario-summer')?.addEventListener('click', () => {
    setScenario({ irradiance: 1100, ambientTemp: 40, windSpeed: 2, humidity: 30, albedo: 0.25 });
  });
  document.getElementById('btn-scenario-winter')?.addEventListener('click', () => {
    setScenario({ irradiance: 400, ambientTemp: 5, windSpeed: 4, humidity: 70, albedo: 0.2 });
  });
  document.getElementById('btn-scenario-cloudy')?.addEventListener('click', () => {
    setScenario({ irradiance: 200, ambientTemp: 20, windSpeed: 3, humidity: 80, albedo: 0.2 });
  });
  document.getElementById('btn-scenario-optimal')?.addEventListener('click', () => {
    setScenario({ irradiance: 1000, ambientTemp: 15, windSpeed: 2, humidity: 40, albedo: 0.2 });
  });
}

function setScenario(values) {
  Object.entries(values).forEach(([key, val]) => {
    state.set(`conditions.${key}`, val);
    const slider = document.getElementById(`slider-${key}`);
    const input = document.getElementById(`input-${key}`);
    const display = document.getElementById(`val-${key}`);
    if (slider) slider.value = val;
    if (input) input.value = val;
    if (display) display.textContent = val;
  });
}
