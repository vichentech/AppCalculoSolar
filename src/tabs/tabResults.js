/**
 * AppSolar — Tab: Resultados, Gráficas y Comparador de Escenarios
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';
import { getVoltageDropStatus } from '../engine/cableLoss.js';
import { createChart, CHART_COLORS } from '../charts/chartManager.js';

const SLIDERS = [
  { key: 'irradiance', label: 'Irradiancia Máxima (Mediodía)', unit: 'W/m²', min: 0, max: 1400, step: 10 },
  { key: 'ambientTemp', label: 'Tª Ambiente Máxima', unit: '°C', min: -20, max: 55, step: 1 },
  { key: 'windSpeed', label: 'Viento', unit: 'm/s', min: 0, max: 30, step: 0.5 },
  { key: 'humidity', label: 'Humedad', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'albedo', label: 'Albedo', unit: '', min: 0, max: 1, step: 0.05 },
];

let currentView24h = 'chart'; // 'chart' | 'table'

export function render() {
  const r = calculateAll();
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const savedScenarios = state.get('savedScenarios') || [];

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📊</span> Resultados y Simulación Dinámica</h2>
        <p class="page-subtitle">Analiza el rendimiento del parque hora a hora y sus condiciones ambientales.</p>
      </div>
    </div>

    <!-- SECCIÓN 1: Condiciones Ambientales y Escenarios -->
    <div class="card mb-lg" style="border-top: 3px solid var(--solar-amber);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
        <h3 style="font-size: var(--text-base); margin:0;"><span class="icon">🌡️</span> Condiciones Ambientales (Valores Pico)</h3>
        <div style="display:flex; align-items:center; gap:8px;">
          <select class="form-select" id="res-scenario-select" style="width:250px; font-size:0.85rem; padding:4px 8px; height:32px;">
            <option value="">-- Cargar Escenario --</option>
            <option value="stc">☀️ STC (1000 W/m², 25°C)</option>
            <option value="summer">☀️ Verano Caluroso (1100 W/m², 40°C)</option>
            <option value="winter">❄️ Invierno Frío (400 W/m², 5°C)</option>
            <option value="cloudy">☁️ Día Nublado (200 W/m², 20°C)</option>
            <optgroup label="Mis Escenarios Guardados" id="optgroup-saved-scenarios">
              ${savedScenarios.map(sc => `<option value="${sc.id}">${sc.name}</option>`).join('')}
            </optgroup>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-quick-save-scenario" title="Guardar Actual">💾 Guardar</button>
          <button class="btn btn-secondary btn-sm" id="btn-quick-delete-scenario" style="color:var(--solar-red); border-color:var(--solar-red);" title="Borrar Escenario" disabled>🗑️</button>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
        ${SLIDERS.map(s => `
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:0.75rem;">${s.label} <span class="unit">[${s.unit}]</span></label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="res-slider-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${cond[s.key]}" style="flex:1;">
              <input type="number" class="form-input mono" id="res-input-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${cond[s.key]}" style="width:60px; padding:2px;">
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- SECCIÓN 2: Control Dinámico (Fecha/Hora) y Condiciones Aplicadas -->
    <div class="card mb-lg" style="border-top: 3px solid var(--solar-blue); background: linear-gradient(145deg, var(--bg-card), var(--bg-tertiary));">
      <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);"><span class="icon">⏱️</span> Momento de Simulación</h3>
      <div class="grid-2" style="gap:var(--space-lg); align-items:center;">
        <div style="display:flex; flex-direction:column; gap:var(--space-md);">
          <div class="slider-group" style="margin-bottom:0;">
            <div class="slider-header" style="font-size:0.8rem;">
              <span class="slider-label">Día del Año</span>
              <div class="slider-value-display"><span class="slider-value" id="res-val-day">${getDayMonthString(cond.simDayOfYear || 172)}</span></div>
            </div>
            <input type="range" id="res-slider-day" min="1" max="365" value="${cond.simDayOfYear || 172}" step="1" style="height:4px; accent-color:var(--solar-blue);">
          </div>
          <div class="slider-group" style="margin-bottom:0;">
            <div class="slider-header" style="font-size:0.8rem;">
              <span class="slider-label">Hora del Día</span>
              <div class="slider-value-display"><span class="slider-value mono" id="res-val-hour">${Math.floor(cond.hourOfDay || 12)}:${((cond.hourOfDay || 12) % 1 === 0.5) ? '30' : '00'}</span></div>
            </div>
            <input type="range" id="res-slider-hour" min="0" max="23.5" value="${cond.hourOfDay || 12}" step="0.5" style="height:4px; accent-color:var(--solar-amber);">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md); background:rgba(0,0,0,0.2); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-primary);">
          <div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Irradiancia Aplicada (G)</div>
            <div style="font-size:1.5rem; font-weight:700; color:var(--solar-amber);">${r.G_actual.toFixed(0)} <span style="font-size:0.8rem;">W/m²</span></div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Tª Ambiente Simulada</div>
            <div style="font-size:1.5rem; font-weight:700; color:var(--solar-red);">${r.tAmb_actual.toFixed(1)} <span style="font-size:0.8rem;">°C</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 3: Resultados por Grupos/Inversores -->
    <div class="grid-2 mb-lg" style="gap:var(--space-md); align-items:stretch;">
      <div class="card" style="flex: 2; border-top: 3px solid var(--solar-green);">
        <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);"><span class="icon">📦</span> Resultados por Grupos</h3>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Grupo / Inversor</th>
                <th>Potencia (kW)</th>
                <th>Tensión (V)</th>
                <th>Corriente (A)</th>
              </tr>
            </thead>
            <tbody>
              ${(r.groupsData || []).map(g => `
                <tr>
                  <td><strong>${g.name}</strong></td>
                  <td class="mono" style="color:var(--solar-green); font-weight:600;">${(g.pmax_array/1000).toFixed(2)} kW</td>
                  <td class="mono">${g.vmp_array.toFixed(1)} V</td>
                  <td class="mono">${g.imp_array.toFixed(1)} A</td>
                </tr>
              `).join('')}
              <tr style="border-top:2px solid var(--border-primary); background:rgba(16,185,129,0.05);">
                <td><strong>TOTAL PARQUE</strong></td>
                <td class="mono" style="color:var(--solar-green); font-weight:700;">${(r.pmax_total_system/1000).toFixed(2)} kW</td>
                <td class="mono" style="font-weight:700;">${r.vmp_avg_system.toFixed(1)} V (Prom.)</td>
                <td class="mono" style="font-weight:700;">${r.imp_total_system.toFixed(1)} A</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="card" style="flex: 1; border-top: 3px solid var(--solar-red); display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
        <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md); width:100%; text-align:left;"><span class="icon">🔥</span> Térmica</h3>
        <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">Temperatura de Celda Calculada</div>
        <div style="font-size:3rem; font-weight:800; color:var(--solar-red); line-height:1;">${r.tCell.toFixed(1)}<span style="font-size:1.2rem;">°C</span></div>
        <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:var(--space-md);">Pérdidas térmicas: ${r.thermalLoss.toFixed(1)}%</div>
      </div>
    </div>

    <!-- SECCIÓN 4: Análisis 24H -->
    <div class="card" style="border-top: 3px solid var(--solar-amber);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
        <h3 style="font-size: var(--text-base); margin:0;"><span class="icon">📈</span> Análisis 24 Horas</h3>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm ${currentView24h === 'chart' ? 'btn-primary' : 'btn-secondary'}" id="btn-view-chart">Gráfica</button>
          <button class="btn btn-sm ${currentView24h === 'table' ? 'btn-primary' : 'btn-secondary'}" id="btn-view-table">Tabla</button>
        </div>
      </div>
      <div id="content-24h" style="min-height:350px;">
        <!-- Se rellena vía JS -->
      </div>
    </div>
  `;
}

export function init() {
  const r = calculateAll();
  const cond = state.get('conditions');

  // Sliders de tiempo
  const controls = [
    { slider: 'res-slider-day', display: 'res-val-day', key: 'conditions.simDayOfYear', parse: parseInt, format: getDayMonthString },
    { slider: 'res-slider-hour', display: 'res-val-hour', key: 'conditions.hourOfDay', parse: parseFloat, format: (v) => `${Math.floor(v)}:${(v % 1 === 0.5) ? '30' : '00'}` },
  ];

  controls.forEach(({ slider, display, key, parse, format }) => {
    const sl = document.getElementById(slider);
    const disp = document.getElementById(display);
    if (sl) {
      sl.addEventListener('input', (e) => {
        const val = parse(e.target.value);
        state.set(key, val);
        if (disp) disp.textContent = format ? format(val) : val;
        refreshUI();
      });
    }
  });

  // Sliders Ambientales
  SLIDERS.forEach(s => {
    const slider = document.getElementById(`res-slider-${s.key}`);
    const input = document.getElementById(`res-input-${s.key}`);
    const update = (val) => {
      val = parseFloat(val);
      if (isNaN(val)) return;
      state.set(`conditions.${s.key}`, val);
      refreshUI();
    };
    if (slider) slider.addEventListener('change', e => update(e.target.value));
    if (input) input.addEventListener('change', e => update(e.target.value));
  });

  // Scenarios
  const selectScenario = document.getElementById('res-scenario-select');
  const btnDel = document.getElementById('btn-quick-delete-scenario');

  selectScenario?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) {
      if (btnDel) btnDel.disabled = true;
      return;
    }
    if (btnDel) btnDel.disabled = !val.startsWith('custom_');

    if (val === 'stc') setScenario({ irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 0, albedo: 0.2 });
    else if (val === 'summer') setScenario({ irradiance: 1100, ambientTemp: 40, windSpeed: 2, humidity: 20, albedo: 0.2 });
    else if (val === 'winter') setScenario({ irradiance: 400, ambientTemp: 5, windSpeed: 4, humidity: 60, albedo: 0.8 });
    else if (val === 'cloudy') setScenario({ irradiance: 200, ambientTemp: 20, windSpeed: 3, humidity: 80, albedo: 0.1 });
    else if (val.startsWith('custom_')) {
      const scenarios = state.get('savedScenarios') || [];
      const sc = scenarios.find(s => s.id === val);
      if (sc) setScenario(sc.conditions);
    }
  });

  document.getElementById('btn-quick-save-scenario')?.addEventListener('click', () => {
    const name = prompt('Introduce un nombre para el nuevo escenario:');
    if (!name) return;
    const currentCond = state.get('conditions');
    const scenarios = state.get('savedScenarios') || [];
    scenarios.push({
      id: 'custom_' + Date.now(), name,
      conditions: {
        irradiance: currentCond.irradiance, ambientTemp: currentCond.ambientTemp,
        windSpeed: currentCond.windSpeed, humidity: currentCond.humidity, albedo: currentCond.albedo
      }
    });
    state.set('savedScenarios', scenarios);
    refreshUI();
  });

  btnDel?.addEventListener('click', () => {
    const val = selectScenario.value;
    if (!val || !val.startsWith('custom_')) return;
    if (confirm('¿Seguro que deseas eliminar este escenario?')) {
      let scenarios = state.get('savedScenarios') || [];
      state.set('savedScenarios', scenarios.filter(s => s.id !== val));
      refreshUI();
    }
  });

  // Toggles 24h
  document.getElementById('btn-view-chart')?.addEventListener('click', () => {
    currentView24h = 'chart';
    refreshUI();
  });
  document.getElementById('btn-view-table')?.addEventListener('click', () => {
    currentView24h = 'table';
    refreshUI();
  });

  render24HSection(cond);
}

function refreshUI() {
  const mainUi = document.querySelector('.page-title-bar').parentElement;
  mainUi.innerHTML = render();
  init();
}

function setScenario(values) {
  Object.entries(values).forEach(([key, val]) => {
    state.set(`conditions.${key}`, val);
  });
  refreshUI();
}

function getDayMonthString(dayOfYear) {
  const date = new Date(new Date().getFullYear(), 0);
  date.setDate(dayOfYear);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

function render24HSection(cond) {
  const container = document.getElementById('content-24h');
  if (!container) return;

  const originalHour = cond.hourOfDay;
  const arr = state.get('arrayConfig');
  const groups = arr.groups || [];
  
  const data24h = [];

  for (let h = 0; h <= 23; h++) {
    state.set('conditions.hourOfDay', h);
    const rTemp = calculateAll();
    
    data24h.push({
      hour: `${h}:00`,
      tCell: rTemp.tCell,
      irradiance: rTemp.G_actual,
      pmaxTotal: rTemp.pmax_total_system,
      groups: rTemp.groupsData || []
    });
  }
  
  // Restore
  state.set('conditions.hourOfDay', originalHour);

  if (currentView24h === 'chart') {
    container.innerHTML = '<div style="height:350px; position:relative;"><canvas id="canvas-24h"></canvas></div>';
    setTimeout(() => {
      const labels = data24h.map(d => d.hour);
      const datasets = [];

      // Dataset Irradiancia
      datasets.push({
        label: 'Irradiancia (W/m²)',
        data: data24h.map(d => d.irradiance.toFixed(0)),
        borderColor: CHART_COLORS.amber,
        borderDash: [5, 5],
        fill: false, tension: 0.4, yAxisID: 'y1'
      });

      // Dataset Temp Celda
      datasets.push({
        label: 'T. Celda (°C)',
        data: data24h.map(d => d.tCell.toFixed(1)),
        borderColor: CHART_COLORS.red,
        fill: false, tension: 0.4, yAxisID: 'y2'
      });

      // Dataset Potencia Total
      datasets.push({
        label: 'Potencia Total (kW)',
        data: data24h.map(d => (d.pmaxTotal/1000).toFixed(2)),
        borderColor: CHART_COLORS.green,
        backgroundColor: 'rgba(16,185,129,0.2)',
        fill: true, tension: 0.4, yAxisID: 'y'
      });

      // Dataset por Grupo
      groups.forEach((g, i) => {
        const colors = [CHART_COLORS.blue, CHART_COLORS.purple, '#ec4899', '#06b6d4'];
        datasets.push({
          label: `${g.name} (kW)`,
          data: data24h.map(d => {
            const grp = d.groups.find(gx => gx.id === g.id);
            return grp ? (grp.pmax_array/1000).toFixed(2) : 0;
          }),
          borderColor: colors[i % colors.length],
          fill: false, tension: 0.4, yAxisID: 'y'
        });
      });

      createChart('canvas-24h', {
        type: 'line',
        data: { labels, datasets },
        options: {
          scales: {
            y: { type: 'linear', display: true, position: 'left', title: {text: 'Potencia (kW)'} },
            y1: { type: 'linear', display: true, position: 'right', grid: {drawOnChartArea: false}, title: {text: 'Irradiancia (W/m²)'} },
            y2: { type: 'linear', display: true, position: 'right', grid: {drawOnChartArea: false}, title: {text: 'T. Celda (°C)'} }
          }
        }
      });
    }, 50);

  } else {
    // TABLE VIEW
    let html = `
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>Hora</th>
              <th>G (W/m²)</th>
              <th>T. Celda (°C)</th>
              <th style="color:var(--solar-green);">P. Total (kW)</th>
              ${groups.map(g => `<th>${g.name} (kW)</th><th>${g.name} (V)</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    data24h.forEach(d => {
      html += `<tr>`;
      html += `<td class="mono"><strong>${d.hour}</strong></td>`;
      html += `<td class="mono">${d.irradiance.toFixed(0)}</td>`;
      html += `<td class="mono" style="color:var(--solar-red);">${d.tCell.toFixed(1)}</td>`;
      html += `<td class="mono" style="color:var(--solar-green); font-weight:700;">${(d.pmaxTotal/1000).toFixed(2)}</td>`;
      
      groups.forEach(g => {
        const grp = d.groups.find(gx => gx.id === g.id);
        const p = grp ? (grp.pmax_array/1000).toFixed(2) : '0.00';
        const v = grp ? grp.vmp_array.toFixed(1) : '0.0';
        html += `<td class="mono">${p}</td><td class="mono">${v}</td>`;
      });
      
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }
}
