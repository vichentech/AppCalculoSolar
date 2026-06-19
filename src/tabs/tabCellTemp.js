/**
 * AppSolar — Tab: Temperatura de la Celda
 */

import { state } from '../state.js';
import { calculateCellTemperature, compareAllModels, calculateTempVsIrradiance } from '../engine/thermalModel.js';
import { createChart, CHART_COLORS, CURVE_PALETTE } from '../charts/chartManager.js';

export function render() {
  const ct = state.get('cellTemp');
  const cond = state.get('conditions');
  const panel = state.get('panelSpecs');
  const comparison = compareAllModels(cond.ambientTemp, cond.irradiance, cond.windSpeed, panel.noct, ct);

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🌡️</span> Temperatura de la Celda Solar</h2>
        <p class="page-subtitle">La temperatura de la celda afecta directamente a la tensión y potencia del panel. Selecciona el modelo de cálculo.</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>🔬 Método de Cálculo</h3>
        </div>

        <div class="form-group">
          <label class="form-label">Modelo de Temperatura</label>
          <select class="form-select" id="select-temp-method">
            <option value="noct" ${ct.method === 'noct' ? 'selected' : ''}>NOCT Estándar</option>
            <option value="faiman" ${ct.method === 'faiman' ? 'selected' : ''}>Modelo Faiman (corrección viento)</option>
            <option value="sandia" ${ct.method === 'sandia' ? 'selected' : ''}>Modelo Sandia</option>
            <option value="manual" ${ct.method === 'manual' ? 'selected' : ''}>Introducción Manual</option>
          </select>
        </div>

        <div id="method-params">
          ${renderMethodParams(ct)}
        </div>

        <div class="divider"></div>

        <div class="alert alert-info">
          <span>ℹ️</span>
          <div id="formula-display">${getFormulaHTML(ct.method)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>📊 Comparación de Modelos</h3>
        </div>
        
        <p style="color:var(--text-secondary); font-size:var(--text-sm); margin-bottom:var(--space-md);">
          Resultados con las condiciones actuales: G=${cond.irradiance} W/m², T<sub>amb</sub>=${cond.ambientTemp}°C, v=${cond.windSpeed} m/s
        </p>

        <table class="data-table">
          <thead><tr><th>Modelo</th><th>T<sub>cell</sub> (°C)</th><th>ΔT (°C)</th></tr></thead>
          <tbody>
            <tr class="${ct.method === 'noct' ? 'style="background:rgba(245,158,11,0.06)"' : ''}">
              <td>NOCT Estándar</td>
              <td class="mono"><strong>${comparison.noct.toFixed(1)}</strong></td>
              <td class="mono">${(comparison.noct - cond.ambientTemp).toFixed(1)}</td>
            </tr>
            <tr ${ct.method === 'faiman' ? 'style="background:rgba(245,158,11,0.06)"' : ''}>
              <td>Faiman</td>
              <td class="mono"><strong>${comparison.faiman.toFixed(1)}</strong></td>
              <td class="mono">${(comparison.faiman - cond.ambientTemp).toFixed(1)}</td>
            </tr>
            <tr ${ct.method === 'sandia' ? 'style="background:rgba(245,158,11,0.06)"' : ''}>
              <td>Sandia</td>
              <td class="mono"><strong>${comparison.sandia.toFixed(1)}</strong></td>
              <td class="mono">${(comparison.sandia - cond.ambientTemp).toFixed(1)}</td>
            </tr>
            ${ct.method === 'manual' ? `
            <tr style="background:rgba(245,158,11,0.06)">
              <td>Manual</td>
              <td class="mono"><strong>${ct.manualTemp.toFixed(1)}</strong></td>
              <td class="mono">${(ct.manualTemp - cond.ambientTemp).toFixed(1)}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <div class="mt-lg">
          <div class="result-grid">
            <div class="result-item" style="border-color:var(--solar-amber);">
              <div class="result-label">T<sub>cell</sub> Seleccionada</div>
              <div class="result-value" style="color:var(--solar-amber);" id="selected-tcell">
                ${calculateCellTemperature(ct.method, cond.ambientTemp, cond.irradiance, cond.windSpeed, panel.noct, ct).toFixed(1)}<span class="result-unit">°C</span>
              </div>
            </div>
            <div class="result-item">
              <div class="result-label">Pérdida Térmica</div>
              <div class="result-value" id="thermal-loss-display">
                ${(Math.abs(panel.tempCoeffPmax) * (calculateCellTemperature(ct.method, cond.ambientTemp, cond.irradiance, cond.windSpeed, panel.noct, ct) - 25)).toFixed(1)}<span class="result-unit">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-lg">
      <div class="card-header">
        <h3>📈 T<sub>cell</sub> vs Irradiancia (por velocidad de viento)</h3>
      </div>
      <div style="height:380px;">
        <canvas id="chart-tcell-irradiance"></canvas>
      </div>
    </div>
  `;
}

function renderMethodParams(ct) {
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
      `;
    case 'faiman':
      return `
        <div class="grid-2" style="gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">U₀ <span class="unit">[W/(m²·K)]</span>
              <span class="tooltip-trigger" data-tooltip="Coeficiente de transferencia de calor constante. Valor típico: 25.">i</span>
            </label>
            <input class="form-input" type="number" id="input-faiman-u0" value="${ct.faimanU0}" step="0.1">
          </div>
          <div class="form-group">
            <label class="form-label">U₁ <span class="unit">[W·s/(m³·K)]</span>
              <span class="tooltip-trigger" data-tooltip="Coeficiente de viento. Valor típico: 6.84.">i</span>
            </label>
            <input class="form-input" type="number" id="input-faiman-u1" value="${ct.faimanU1}" step="0.01">
          </div>
        </div>
      `;
    case 'sandia':
      return `
        <div class="grid-3" style="gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">a <span class="tooltip-trigger" data-tooltip="Coeficiente empírico. Glass/cell/glass: -3.56">i</span></label>
            <input class="form-input" type="number" id="input-sandia-a" value="${ct.sandiaA}" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">b <span class="tooltip-trigger" data-tooltip="Coeficiente de viento. Glass/cell/glass: -0.075">i</span></label>
            <input class="form-input" type="number" id="input-sandia-b" value="${ct.sandiaB}" step="0.001">
          </div>
          <div class="form-group">
            <label class="form-label">ΔT <span class="unit">[°C]</span> <span class="tooltip-trigger" data-tooltip="Diferencia entre T_module y T_cell. Típico: 3°C">i</span></label>
            <input class="form-input" type="number" id="input-sandia-dt" value="${ct.sandiaDeltaT}" step="0.5">
          </div>
        </div>
      `;
    default:
      return `<p style="color:var(--text-secondary); font-size:var(--text-sm);">El modelo NOCT usa directamente el valor NOCT de la hoja de datos del panel (${state.get('panelSpecs.noct')}°C).</p>`;
  }
}

function getFormulaHTML(method) {
  const formulas = {
    noct: '<strong>NOCT:</strong> T<sub>cell</sub> = T<sub>amb</sub> + ((NOCT − 20) / 800) × G',
    faiman: '<strong>Faiman:</strong> T<sub>cell</sub> = T<sub>amb</sub> + G / (U₀ + U₁ × v<sub>wind</sub>)',
    sandia: '<strong>Sandia:</strong> T<sub>mod</sub> = G × e<sup>(a + b × v<sub>wind</sub>)</sup> + T<sub>amb</sub>, T<sub>cell</sub> = T<sub>mod</sub> + (G/1000) × ΔT',
    manual: '<strong>Manual:</strong> Valor fijo introducido por el usuario.',
  };
  return formulas[method] || '';
}

export function init() {
  // Method selector
  document.getElementById('select-temp-method')?.addEventListener('change', (e) => {
    state.set('cellTemp.method', e.target.value);
    const paramsDiv = document.getElementById('method-params');
    if (paramsDiv) paramsDiv.innerHTML = renderMethodParams(state.get('cellTemp'));
    const formulaDiv = document.getElementById('formula-display');
    if (formulaDiv) formulaDiv.innerHTML = getFormulaHTML(e.target.value);
    initMethodInputs();
  });

  initMethodInputs();
  renderTcellChart();
}

function initMethodInputs() {
  // Manual temp slider
  const sliderManual = document.getElementById('slider-manual-temp');
  const inputManual = document.getElementById('input-manual-temp');
  if (sliderManual && inputManual) {
    const update = val => {
      val = parseFloat(val);
      state.set('cellTemp.manualTemp', val);
      sliderManual.value = val;
      inputManual.value = val;
      document.getElementById('val-manual-temp').textContent = val;
    };
    sliderManual.addEventListener('input', e => update(e.target.value));
    inputManual.addEventListener('input', e => update(e.target.value));
  }

  // Faiman params
  document.getElementById('input-faiman-u0')?.addEventListener('input', e => state.set('cellTemp.faimanU0', parseFloat(e.target.value)));
  document.getElementById('input-faiman-u1')?.addEventListener('input', e => state.set('cellTemp.faimanU1', parseFloat(e.target.value)));

  // Sandia params
  document.getElementById('input-sandia-a')?.addEventListener('input', e => state.set('cellTemp.sandiaA', parseFloat(e.target.value)));
  document.getElementById('input-sandia-b')?.addEventListener('input', e => state.set('cellTemp.sandiaB', parseFloat(e.target.value)));
  document.getElementById('input-sandia-dt')?.addEventListener('input', e => state.set('cellTemp.sandiaDeltaT', parseFloat(e.target.value)));
}

function renderTcellChart() {
  const cond = state.get('conditions');
  const panel = state.get('panelSpecs');
  const irradiances = Array.from({ length: 15 }, (_, i) => i * 100);
  const windSpeeds = [0, 1, 3, 5, 10];

  const datasets = windSpeeds.map((ws, idx) => ({
    label: `Viento ${ws} m/s`,
    data: irradiances.map(G => calculateCellTemperature('noct', cond.ambientTemp, G, ws, panel.noct, {})),
    borderColor: CURVE_PALETTE[idx],
    backgroundColor: 'transparent',
    tension: 0.3,
    pointRadius: 2,
    borderWidth: 2,
  }));

  createChart('chart-tcell-irradiance', {
    type: 'line',
    data: { labels: irradiances.map(g => g.toString()), datasets },
    options: {
      scales: {
        x: { title: { text: 'Irradiancia (W/m²)' } },
        y: { title: { text: 'Temperatura Celda (°C)' } },
      },
      plugins: {
        legend: { display: true },
      },
    },
  });
}
