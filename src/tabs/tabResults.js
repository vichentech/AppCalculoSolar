/**
 * AppSolar — Tab: Resultados, Gráficas y Comparador de Escenarios
 */

import { state } from '../state.js';
import { calculateAll, G_STC } from '../engine/solarCalc.js';
import { generateIVCurve, generateIVCurveFamily_Irradiance, generateIVCurveFamily_Temperature } from '../engine/ivCurve.js';
import { getVoltageDropStatus } from '../engine/cableLoss.js';
import { generateLossWaterfall, calculatePerformanceRatio } from '../engine/performanceRatio.js';
import { createChart, CHART_COLORS, CURVE_PALETTE } from '../charts/chartManager.js';
import { navigateTo } from '../router.js';

let currentSubtab = 'summary-table';

export function render() {
  const r = calculateAll();
  const panel = state.get('panelSpecs');
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const vdStatus = getVoltageDropStatus(r.vdPercent);

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📊</span> Resultados y Análisis</h2>
        <p class="page-subtitle">Resultados calculados en tiempo real. Ajusta las condiciones y simula el rendimiento dinámico.</p>
      </div>
    </div>

    <!-- Sliders de Condiciones en Tiempo Real -->
    <div class="card mb-lg" style="border:1px solid var(--border-primary); background: linear-gradient(145deg, var(--bg-card), var(--bg-tertiary)); padding: var(--space-md) var(--space-lg);">
      <div class="card-header" style="margin-bottom:var(--space-md); padding-bottom:4px;">
        <h3 style="font-size: var(--text-sm); font-weight:700;"><span class="icon">🌡️</span> Simulación de Condiciones en Tiempo Real</h3>
      </div>
      
      <div class="grid-3" style="gap:var(--space-md); margin-bottom:var(--space-sm);">
        <!-- Irradiancia -->
        <div class="slider-group" style="margin-bottom:0;">
          <div class="slider-header" style="font-size:0.75rem;">
            <span class="slider-label">Irradiancia</span>
            <div class="slider-value-display"><span class="slider-value" id="res-val-irr">${cond.irradiance}</span><span class="slider-unit">W/m²</span></div>
          </div>
          <input type="range" id="res-slider-irr" min="0" max="1200" value="${cond.irradiance}" step="10" style="height:4px;">
        </div>

        <!-- Temp. Ambiente -->
        <div class="slider-group" style="margin-bottom:0;">
          <div class="slider-header" style="font-size:0.75rem;">
            <span class="slider-label">Temp. Ambiente</span>
            <div class="slider-value-display"><span class="slider-value" id="res-val-temp">${cond.ambientTemp}</span><span class="slider-unit">°C</span></div>
          </div>
          <input type="range" id="res-slider-temp" min="-10" max="50" value="${cond.ambientTemp}" step="1" style="height:4px;">
        </div>

        <!-- Viento -->
        <div class="slider-group" style="margin-bottom:0;">
          <div class="slider-header" style="font-size:0.75rem;">
            <span class="slider-label">Velocidad Viento</span>
            <div class="slider-value-display"><span class="slider-value" id="res-val-wind">${cond.windSpeed}</span><span class="slider-unit">m/s</span></div>
          </div>
          <input type="range" id="res-slider-wind" min="0" max="25" value="${cond.windSpeed}" step="0.5" style="height:4px;">
        </div>
      </div>
      
      <div class="grid-3" style="gap:var(--space-md);">
        <!-- Hora del Día -->
        <div class="slider-group" style="margin-bottom:0;">
          <div class="slider-header" style="font-size:0.75rem;">
            <span class="slider-label">Hora del Día</span>
            <div class="slider-value-display"><span class="slider-value" id="res-val-hour">${Math.floor(cond.hourOfDay || 12)}:${((cond.hourOfDay || 12) % 1 === 0.5) ? '30' : '00'}</span></div>
          </div>
          <input type="range" id="res-slider-hour" min="0" max="23.5" value="${cond.hourOfDay || 12}" step="0.5" style="height:4px;">
        </div>

        <!-- Inclinación panel (si es fija) -->
        <div class="slider-group" style="margin-bottom:0; opacity: ${arr.trackerType === 'fixed' ? '1' : '0.4'}; pointer-events: ${arr.trackerType === 'fixed' ? 'auto' : 'none'};">
          <div class="slider-header" style="font-size:0.75rem;">
            <span class="slider-label">Inclinación (Tilt)</span>
            <div class="slider-value-display"><span class="slider-value" id="res-val-tilt">${arr.tiltAngle}</span><span class="slider-unit">°</span></div>
          </div>
          <input type="range" id="res-slider-tilt" min="0" max="90" value="${arr.tiltAngle}" step="1" style="height:4px;">
        </div>

        <!-- Info Tracker -->
        <div style="display:flex; flex-direction:column; justify-content:center; padding:0 8px; font-size:var(--text-xs); color:var(--text-secondary);">
          <div>Estructura: <strong style="color:var(--solar-amber);">${arr.trackerType === 'fixed' ? 'Fija' : (arr.trackerType === 'axis-ns' ? 'Tracker 1 Eje (N-S)' : 'Tracker 2 Ejes')}</strong></div>
          <div style="margin-top:2px;">Inclinación Activa: <strong class="mono" style="color:var(--solar-blue);">${r.activeTilt.toFixed(1)}°</strong> | Azimut Activo: <strong class="mono">${r.activeAzimuth.toFixed(1)}°</strong></div>
        </div>
      </div>
    </div>

    <!-- KPI Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-label">Potencia Array</div>
        <div class="stat-value">${(r.pmax_array / 1000).toFixed(2)}<span class="stat-unit">kW</span></div>
        <div class="stat-sub">Nominal: ${(r.pmax_stc_total / 1000).toFixed(2)} kWp</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔋</div>
        <div class="stat-label">Tensión String</div>
        <div class="stat-value">${r.vmp_string.toFixed(1)}<span class="stat-unit">V</span></div>
        <div class="stat-sub">Voc: ${r.voc_string.toFixed(1)} V</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🌡️</div>
        <div class="stat-label">T. Celda</div>
        <div class="stat-value">${r.tCell.toFixed(1)}<span class="stat-unit">°C</span></div>
        <div class="stat-sub">Pérdida: ${r.thermalLoss.toFixed(1)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-label">PR Estimado</div>
        <div class="stat-value">${(r.pr_estimated * 100).toFixed(1)}<span class="stat-unit">%</span></div>
        <div class="stat-sub">${(r.annualYield / 1000).toFixed(1)} MWh/año est.</div>
      </div>
    </div>

    <!-- Sub-tabs -->
    <div class="subtabs" style="margin-bottom:var(--space-md); flex-wrap:wrap; gap:4px; display:flex;">
      <button class="subtab-btn ${currentSubtab === 'summary-table' ? 'active' : ''}" data-subtab="summary-table">📋 Vista General</button>
      <button class="subtab-btn ${currentSubtab === 'voltages' ? 'active' : ''}" data-subtab="voltages">⚡ Tensiones</button>
      <button class="subtab-btn ${currentSubtab === 'currents' ? 'active' : ''}" data-subtab="currents">🔌 Corrientes</button>
      <button class="subtab-btn ${currentSubtab === 'powers' ? 'active' : ''}" data-subtab="powers">💪 Potencias</button>
      <button class="subtab-btn ${currentSubtab === 'efficiency' ? 'active' : ''}" data-subtab="efficiency">📊 Rendimiento</button>
      <button class="subtab-btn ${currentSubtab === 'charts-iv' ? 'active' : ''}" data-subtab="charts-iv">📈 Curvas I-V</button>
      <button class="subtab-btn ${currentSubtab === 'charts-effects' ? 'active' : ''}" data-subtab="charts-effects">🌡️ Efectos T/G</button>
      <button class="subtab-btn ${currentSubtab === 'charts-losses' ? 'active' : ''}" data-subtab="charts-losses">📉 Pérdidas</button>
      <button class="subtab-btn ${currentSubtab === 'scenarios' ? 'active' : ''}" data-subtab="scenarios">💾 Escenarios</button>
    </div>

    <div id="subtab-content">
      ${renderSubtab(currentSubtab, r)}
    </div>
  `;
}

function renderSubtab(id, r) {
  const panel = state.get('panelSpecs');
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const vdStatus = getVoltageDropStatus(r.vdPercent);

  switch (id) {
    case 'summary-table':
      return `
        <div class="card">
          <div class="results-section-title"><span class="section-icon">📋</span> Vista General de Resultados</div>
          <p style="color:var(--text-secondary); font-size:var(--text-xs); margin-bottom:var(--space-md);">
            Resumen completo de tensiones, intensidades y potencias en el parque solar para las condiciones seleccionadas.
          </p>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Fórmula</th>
                  <th>STC (Panel)</th>
                  <th>Ajustado (Panel)</th>
                  <th>String (${arr.panelsPerString} paneles)</th>
                  <th>Total Array (${r.totalPanels} paneles)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Tensión Cto. Abierto (Voc)</strong></td>
                  <td class="mono" style="font-size:0.75rem;">Voc × [1 + β × (Tc-25)]</td>
                  <td class="mono">${panel.voc} V</td>
                  <td class="mono">${r.voc_adj.toFixed(2)} V</td>
                  <td class="mono" style="font-weight:600;">${r.voc_string.toFixed(1)} V</td>
                  <td class="mono" style="font-weight:600;">${r.voc_array.toFixed(1)} V</td>
                </tr>
                <tr>
                  <td><strong>Tensión Pmax (Vmp)</strong></td>
                  <td class="mono" style="font-size:0.75rem;">Vmp × [1 + β × (Tc-25)]</td>
                  <td class="mono">${panel.vmp} V</td>
                  <td class="mono">${r.vmp_adj.toFixed(2)} V</td>
                  <td class="mono" style="font-weight:600;">${r.vmp_string.toFixed(1)} V</td>
                  <td class="mono" style="font-weight:700; color:var(--solar-blue);">${r.vmp_net.toFixed(1)} V (Neta)</td>
                </tr>
                <tr>
                  <td><strong>Corriente Cortocuito (Isc)</strong></td>
                  <td class="mono" style="font-size:0.75rem;">Isc × (G/1000) × [1 + α × (Tc-25)]</td>
                  <td class="mono">${panel.isc} A</td>
                  <td class="mono">${r.isc_adj.toFixed(2)} A</td>
                  <td class="mono" style="font-weight:600;">${r.isc_string.toFixed(2)} A</td>
                  <td class="mono" style="font-weight:600;">${r.isc_array.toFixed(2)} A</td>
                </tr>
                <tr>
                  <td><strong>Corriente Pmax (Imp)</strong></td>
                  <td class="mono" style="font-size:0.75rem;">Imp × (G/1000) × [1 + α × (Tc-25)]</td>
                  <td class="mono">${panel.imp} A</td>
                  <td class="mono">${r.imp_adj.toFixed(2)} A</td>
                  <td class="mono" style="font-weight:600;">${r.imp_string.toFixed(2)} A</td>
                  <td class="mono" style="font-weight:700; color:var(--solar-amber);">${r.imp_array.toFixed(2)} A (Total)</td>
                </tr>
                <tr style="border-top:2px solid var(--border-primary)">
                  <td><strong>Potencia Máxima (Pmax)</strong></td>
                  <td class="mono" style="font-size:0.75rem;">Pmax × (G/1000) × [1 + γ × (Tc-25)]</td>
                  <td class="mono" style="color:var(--text-tertiary);">${panel.pmax} Wp</td>
                  <td class="mono">${r.pmax_adj.toFixed(1)} W</td>
                  <td class="mono" style="font-weight:600;">${(r.pmax_string/1000).toFixed(2)} kW</td>
                  <td class="mono" style="font-weight:700; color:var(--solar-green);">${(r.pmax_net/1000).toFixed(2)} kW (Neta)</td>
                </tr>
                <tr>
                  <td><strong>Pérdida por Temperatura</strong></td>
                  <td class="mono" style="font-size:0.75rem;">γ × ΔT_celda</td>
                  <td class="mono">—</td>
                  <td class="mono" style="color:var(--solar-orange); font-weight:600;">-${r.thermalLoss.toFixed(1)}%</td>
                  <td class="mono" style="color:var(--solar-orange); font-weight:600;">-${r.thermalLoss.toFixed(1)}%</td>
                  <td class="mono" style="color:var(--solar-orange); font-weight:600;">-${r.thermalLoss.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td><strong>Pérdida Cable DC</strong></td>
                  <td class="mono" style="font-size:0.75rem;">I²R (Caída Tensión %)</td>
                  <td class="mono">—</td>
                  <td class="mono">—</td>
                  <td class="mono">—</td>
                  <td class="mono" style="color:var(--solar-red); font-weight:600;">-${r.vdPercent.toFixed(2)}% (${r.cablePowerLoss.toFixed(0)} W)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

    case 'voltages':
      return `
        <div class="card">
          <div class="results-section-title"><span class="section-icon">⚡</span> Tensiones de Trabajo</div>
          <div class="result-grid">
            ${resultCard('Voc Panel (ajust.)', r.voc_adj.toFixed(2), 'V', 'Voc×[1+β×(Tc-25)]')}
            ${resultCard('Vmp Panel (ajust.)', r.vmp_adj.toFixed(2), 'V', 'Vmp×[1+β×(Tc-25)]')}
            ${resultCard('Voc String', r.voc_string.toFixed(1), 'V', `${arr.panelsPerString} paneles en serie`)}
            ${resultCard('Vmp String', r.vmp_string.toFixed(1), 'V', `${arr.panelsPerString} paneles en serie`)}
            ${resultCard('Voc Array', r.voc_array.toFixed(1), 'V', 'Strings en paralelo')}
            ${resultCard('Caída V Cable', r.voltageDrop.toFixed(2), 'V', `${r.vdPercent.toFixed(2)}% — ${vdStatus.message}`)}
            ${resultCard('Vmp Neta', r.vmp_net.toFixed(1), 'V', 'Vmp String − V drop')}
          </div>
        </div>`;

    case 'currents':
      return `
        <div class="card">
          <div class="results-section-title"><span class="section-icon">🔌</span> Corrientes de Trabajo</div>
          <div class="result-grid">
            ${resultCard('Isc Panel (ajust.)', r.isc_adj.toFixed(2), 'A', 'Isc×(G/1000)×[1+α×(Tc-25)]')}
            ${resultCard('Imp Panel (ajust.)', r.imp_adj.toFixed(2), 'A', 'Imp×(G/1000)×[1+α×(Tc-25)]')}
            ${resultCard('Isc por String', r.isc_string.toFixed(2), 'A', 'Paneles en serie: misma I')}
            ${resultCard('Imp por String', r.imp_string.toFixed(2), 'A', 'Corriente de trabajo')}
            ${resultCard('Isc Total Array', r.isc_array.toFixed(2), 'A', `${arr.numStrings} strings en paralelo`)}
            ${resultCard('Imp Total Array', r.imp_array.toFixed(2), 'A', `${arr.numStrings} strings en paralelo`)}
          </div>
        </div>`;

    case 'powers':
      return `
        <div class="card">
          <div class="results-section-title"><span class="section-icon">💪</span> Potencias de Trabajo</div>
          <div class="result-grid">
            ${resultCard('Pmax Panel (ajust.)', r.pmax_adj.toFixed(1), 'W', `STC: ${panel.pmax} Wp`)}
            ${resultCard('Pmax String', r.pmax_string.toFixed(0), 'W', `${arr.panelsPerString} paneles`)}
            ${resultCard('Pmax Array (bruta)', (r.pmax_array / 1000).toFixed(2), 'kW', `${r.totalPanels} paneles`)}
            ${resultCard('Pérdida Cable', r.cablePowerLoss.toFixed(1), 'W', `I²R = ${r.cablePowerLoss.toFixed(1)} W`)}
            ${resultCard('Pmax Neta', (r.pmax_net / 1000).toFixed(2), 'kW', 'Pmax Array − Pérdida cable')}
            ${resultCard('Potencia STC Total', (r.pmax_stc_total / 1000).toFixed(2), 'kWp', 'Potencia nominal instalada')}
          </div>
        </div>`;

    case 'efficiency':
      return `
        <div class="card">
          <div class="results-section-title"><span class="section-icon">📊</span> Rendimientos y Performance</div>
          <div class="result-grid">
            ${resultCard('Fill Factor', (r.fillFactor * 100).toFixed(1), '%', 'FF = (Vmp×Imp)/(Voc×Isc)')}
            ${resultCard('Eficiencia Panel', r.panelEffReal.toFixed(1), '%', `STC: ${panel.efficiency}%`)}
            ${resultCard('Pérdida Térmica', r.thermalLoss.toFixed(1), '%', `γ × ΔT = ${panel.tempCoeffPmax}%/°C × ${(r.tCell - 25).toFixed(1)}°C`)}
            ${resultCard('Pérdida Cable', r.vdPercent.toFixed(2), '%', getVoltageDropStatus(r.vdPercent).message)}
            ${resultCard('PR Estimado', (r.pr_estimated * 100).toFixed(1), '%', 'Performance Ratio global')}
            ${resultCard('Yield Anual Est.', (r.annualYield).toFixed(0), 'kWh', `${(r.annualYield / 1000).toFixed(1)} MWh/año`)}
          </div>
        </div>`;

    case 'charts-iv':
      return `
        <div class="dashboard-grid cols-2">
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">📈 Curva I-V del Panel</div>
                <div class="chart-subtitle">Modelo de diodo único · G=${cond.irradiance} W/m² · Tc=${r.tCell.toFixed(1)}°C</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-iv-curve"></canvas>
            </div>
          </div>
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">📈 Curva P-V del Panel</div>
                <div class="chart-subtitle">Potencia vs Tensión · MPP marcado</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-pv-curve"></canvas>
            </div>
          </div>
        </div>
        <div class="card mt-lg">
          <div class="chart-header">
            <div>
              <div class="chart-title">📈 Familia de Curvas I-V (diferentes irradiancias)</div>
              <div class="chart-subtitle">Tc=${r.tCell.toFixed(1)}°C · Irradiancias: 200, 400, 600, 800, 1000 W/m²</div>
            </div>
          </div>
          <div style="height:400px; position:relative;">
            <canvas id="chart-iv-family"></canvas>
          </div>
        </div>`;

    case 'charts-effects':
      return `
        <div class="dashboard-grid cols-2">
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">🌡️ Efecto de la Temperatura en I-V</div>
                <div class="chart-subtitle">G=${cond.irradiance} W/m² · Temperaturas: 15°C a 65°C</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-temp-effect"></canvas>
            </div>
          </div>
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">☀️ Potencia vs Irradiancia</div>
                <div class="chart-subtitle">A temperatura fija: Tc=${r.tCell.toFixed(1)}°C</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-power-vs-g"></canvas>
            </div>
          </div>
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">🌡️ Potencia vs Temperatura</div>
                <div class="chart-subtitle">A irradiancia fija: G=${cond.irradiance} W/m²</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-power-vs-temp"></canvas>
            </div>
          </div>
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">📊 Eficiencia vs Temperatura</div>
                <div class="chart-subtitle">G=${cond.irradiance} W/m²</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-eff-vs-temp"></canvas>
            </div>
          </div>
        </div>`;

    case 'charts-losses':
      return `
        <div class="dashboard-grid cols-2">
          <div class="chart-container chart-lg span-2">
            <div class="chart-header">
              <div>
                <div class="chart-title">📉 Diagrama de Pérdidas (Waterfall)</div>
                <div class="chart-subtitle">Desglose desde potencia nominal hasta potencia real</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-waterfall"></canvas>
            </div>
          </div>
          <div class="chart-container chart-lg">
            <div class="chart-header">
              <div>
                <div class="chart-title">🥧 Distribución de Pérdidas</div>
              </div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-losses-pie"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>📋 Desglose de Pérdidas</h3></div>
            <table class="data-table" id="losses-table"></table>
          </div>
        </div>`;

    case 'scenarios':
      const saved = getSavedScenarios();
      let tableHtml = '';
      if (saved.length === 0) {
        tableHtml = '<p style="color:var(--text-secondary); text-align:center; padding:var(--space-lg);">No hay escenarios guardados. Pulsa en "Guardar Escenario" para añadir uno.</p>';
      } else {
        tableHtml = `
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Parámetro</th>
                  ${saved.map(s => `<th>${s.name} <button class="btn-delete-scenario" data-id="${s.id}" style="background:transparent; border:none; color:var(--solar-red); cursor:pointer; font-size:0.8rem; padding:0 4px;" title="Eliminar">🗑️</button></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Irradiancia [W/m²]</td>
                  ${saved.map(s => `<td class="mono">${s.irradiance}</td>`).join('')}
                </tr>
                <tr>
                  <td>T. Ambiente [°C]</td>
                  ${saved.map(s => `<td class="mono">${s.ambientTemp}</td>`).join('')}
                </tr>
                <tr>
                  <td>Viento [m/s]</td>
                  ${saved.map(s => `<td class="mono">${s.windSpeed}</td>`).join('')}
                </tr>
                <tr>
                  <td>Hora del día</td>
                  ${saved.map(s => `<td class="mono">${s.hourOfDay.toFixed(1)}h</td>`).join('')}
                </tr>
                <tr>
                  <td>Inclinación panel [°]</td>
                  ${saved.map(s => `<td class="mono">${s.activeTilt.toFixed(1)}°</td>`).join('')}
                </tr>
                <tr>
                  <td>T. Celda [°C]</td>
                  ${saved.map(s => `<td class="mono">${s.tCell.toFixed(1)}°C</td>`).join('')}
                </tr>
                <tr style="font-weight:700; color:var(--solar-green);">
                  <td>Pmax Neta [kW]</td>
                  ${saved.map(s => `<td class="mono">${(s.pmax_net/1000).toFixed(2)} kW</td>`).join('')}
                </tr>
                <tr style="font-weight:700; color:var(--solar-blue);">
                  <td>PR Estimado [%]</td>
                  ${saved.map(s => `<td class="mono">${(s.pr_estimated*100).toFixed(1)}%</td>`).join('')}
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="chart-container chart-lg mt-lg">
            <div class="chart-header">
              <div class="chart-title">📊 Comparación de Potencia Neta y PR</div>
            </div>
            <div style="height:320px; position:relative;">
              <canvas id="chart-compare-scenarios"></canvas>
            </div>
          </div>
        `;
      }

      return `
        <div class="card">
          <div class="results-section-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>💾 Comparador de Escenarios</span>
            <button class="btn btn-primary btn-sm" id="btn-save-scenario">➕ Guardar Escenario Actual</button>
          </div>
          <p style="color:var(--text-secondary); font-size:var(--text-xs); margin-bottom:var(--space-md);">
            Guarda el estado actual del parque y condiciones para compararlo con otras configuraciones guardadas anteriormente.
          </p>
          ${tableHtml}
        </div>
      `;
    default:
      return '';
  }
}

function resultCard(label, value, unit, formula) {
  return `
    <div class="result-item">
      <div class="result-label">${label}</div>
      <div class="result-value">${value}<span class="result-unit">${unit}</span></div>
      ${formula ? `<div class="result-formula">${formula}</div>` : ''}
    </div>
  `;
}

export function init() {
  // Sub-tab navigation
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSubtab = btn.dataset.subtab;
      const r = calculateAll();
      document.getElementById('subtab-content').innerHTML = renderSubtab(currentSubtab, r);
      bindSubtabEvents();
      renderCharts(currentSubtab, r);
    });
  });

  // Real-time slider listeners
  const controls = [
    { slider: 'res-slider-irr', display: 'res-val-irr', key: 'conditions.irradiance', parse: parseFloat },
    { slider: 'res-slider-temp', display: 'res-val-temp', key: 'conditions.ambientTemp', parse: parseFloat },
    { slider: 'res-slider-wind', display: 'res-val-wind', key: 'conditions.windSpeed', parse: parseFloat },
    { slider: 'res-slider-hour', display: 'res-val-hour', key: 'conditions.hourOfDay', parse: parseFloat, format: (v) => `${Math.floor(v)}:${(v % 1 === 0.5) ? '30' : '00'}` },
    { slider: 'res-slider-tilt', display: 'res-val-tilt', key: 'arrayConfig.tiltAngle', parse: parseInt },
  ];

  controls.forEach(({ slider, display, key, parse, format }) => {
    const sl = document.getElementById(slider);
    const disp = document.getElementById(display);
    if (sl) {
      sl.addEventListener('input', (e) => {
        const val = parse(e.target.value);
        state.set(key, val);
        if (disp) disp.textContent = format ? format(val) : val;

        // Recalculate and update subtab view & charts
        const r = calculateAll();
        document.getElementById('subtab-content').innerHTML = renderSubtab(currentSubtab, r);
        bindSubtabEvents();
        renderCharts(currentSubtab, r);
      });
    }
  });

  const r = calculateAll();
  bindSubtabEvents();
  renderCharts(currentSubtab, r);
}

function bindSubtabEvents() {
  // Save scenario
  document.getElementById('btn-save-scenario')?.addEventListener('click', () => {
    const name = prompt('Introduce un nombre para este escenario:');
    if (name === null) return;
    const trimmed = name.trim() || 'Escenario';
    const r = calculateAll();
    const cond = state.get('conditions');
    saveScenario(trimmed, r, cond);
    
    // Refresh subtab
    document.getElementById('subtab-content').innerHTML = renderSubtab('scenarios', r);
    bindSubtabEvents();
    renderCharts('scenarios', r);
  });

  // Delete scenario
  document.querySelectorAll('.btn-delete-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteScenario(id);
      
      const r = calculateAll();
      document.getElementById('subtab-content').innerHTML = renderSubtab('scenarios', r);
      bindSubtabEvents();
      renderCharts('scenarios', r);
    });
  });
}

function getSavedScenarios() {
  try {
    const stored = localStorage.getItem('appsolar-scenarios');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error loading scenarios:', e);
    return [];
  }
}

function saveScenario(name, r, cond) {
  const saved = getSavedScenarios();
  const newSc = {
    id: 'sc_' + Date.now(),
    name: name || 'Escenario sin nombre',
    irradiance: cond.irradiance,
    ambientTemp: cond.ambientTemp,
    windSpeed: cond.windSpeed,
    hourOfDay: cond.hourOfDay || 12,
    activeTilt: r.activeTilt,
    activeAzimuth: r.activeAzimuth,
    tCell: r.tCell,
    pmax_net: r.pmax_net,
    pr_estimated: r.pr_estimated,
  };
  saved.push(newSc);
  localStorage.setItem('appsolar-scenarios', JSON.stringify(saved));
}

function deleteScenario(id) {
  const saved = getSavedScenarios();
  const filtered = saved.filter(s => s.id !== id);
  localStorage.setItem('appsolar-scenarios', JSON.stringify(filtered));
}

function renderCharts(subtab, r) {
  const panel = state.get('panelSpecs');
  const cond = state.get('conditions');

  switch (subtab) {
    case 'charts-iv':
      renderIVCharts(panel, cond, r);
      break;
    case 'charts-effects':
      renderEffectCharts(panel, cond, r);
      break;
    case 'charts-losses':
      renderLossCharts(r);
      break;
    case 'scenarios':
      renderScenarioCompareChart();
      break;
  }
}

function renderIVCharts(panel, cond, r) {
  const ivData = generateIVCurve({
    voc: panel.voc, isc: panel.isc, vmp: panel.vmp, imp: panel.imp,
    numCells: panel.numCells, G: cond.irradiance, tCell: r.tCell,
    tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
  });

  createChart('chart-iv-curve', {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Curva I-V',
          data: ivData.voltages.map((v, i) => ({ x: v, y: ivData.currents[i] })),
          borderColor: CHART_COLORS.amber,
          backgroundColor: 'rgba(245,158,11,0.1)',
          showLine: true, fill: true, tension: 0.1, pointRadius: 0, borderWidth: 2,
        },
        {
          label: `MPP (${ivData.mpp.v.toFixed(1)}V, ${ivData.mpp.i.toFixed(2)}A)`,
          data: [{ x: ivData.mpp.v, y: ivData.mpp.i }],
          backgroundColor: CHART_COLORS.red, pointRadius: 8, pointStyle: 'star',
        },
      ],
    },
    options: {
      scales: {
        x: { title: { text: 'Tensión (V)' }, min: 0 },
        y: { title: { text: 'Corriente (A)' }, min: 0 },
      },
    },
  });

  createChart('chart-pv-curve', {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Curva P-V',
          data: ivData.voltages.map((v, i) => ({ x: v, y: ivData.powers[i] })),
          borderColor: CHART_COLORS.blue,
          backgroundColor: 'rgba(59,130,246,0.1)',
          showLine: true, fill: true, tension: 0.1, pointRadius: 0, borderWidth: 2,
        },
        {
          label: `MPP (${ivData.mpp.v.toFixed(1)}V, ${ivData.mpp.p.toFixed(1)}W)`,
          data: [{ x: ivData.mpp.v, y: ivData.mpp.p }],
          backgroundColor: CHART_COLORS.red, pointRadius: 8, pointStyle: 'star',
        },
      ],
    },
    options: {
      scales: {
        x: { title: { text: 'Tensión (V)' }, min: 0 },
        y: { title: { text: 'Potencia (W)' }, min: 0 },
      },
    },
  });

  const irradiances = [200, 400, 600, 800, 1000];
  const family = generateIVCurveFamily_Irradiance({
    voc: panel.voc, isc: panel.isc, vmp: panel.vmp, imp: panel.imp,
    numCells: panel.numCells, tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
  }, irradiances, r.tCell);

  createChart('chart-iv-family', {
    type: 'scatter',
    data: {
      datasets: family.map((curve, idx) => ({
        label: curve.label,
        data: curve.voltages.map((v, i) => ({ x: v, y: curve.currents[i] })),
        borderColor: CURVE_PALETTE[idx],
        showLine: true, tension: 0.1, pointRadius: 0, borderWidth: 2,
        backgroundColor: 'transparent',
      })),
    },
    options: {
      scales: {
        x: { title: { text: 'Tensión (V)' }, min: 0 },
        y: { title: { text: 'Corriente (A)' }, min: 0 },
      },
    },
  });
}

function renderEffectCharts(panel, cond, r) {
  const temps = [15, 25, 35, 45, 55, 65];
  const tempFamily = generateIVCurveFamily_Temperature({
    voc: panel.voc, isc: panel.isc, vmp: panel.vmp, imp: panel.imp,
    numCells: panel.numCells, tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
  }, temps, cond.irradiance);

  createChart('chart-temp-effect', {
    type: 'scatter',
    data: {
      datasets: tempFamily.map((curve, idx) => ({
        label: curve.label,
        data: curve.voltages.map((v, i) => ({ x: v, y: curve.currents[i] })),
        borderColor: CURVE_PALETTE[idx],
        showLine: true, tension: 0.1, pointRadius: 0, borderWidth: 2,
        backgroundColor: 'transparent',
      })),
    },
    options: {
      scales: {
        x: { title: { text: 'Tensión (V)' }, min: 0 },
        y: { title: { text: 'Corriente (A)' }, min: 0 },
      },
    },
  });

  const gValues = Array.from({ length: 14 }, (_, i) => (i + 1) * 100);
  const pVsG = gValues.map(G => {
    const p = panel.pmax * (G / G_STC) * (1 + (panel.tempCoeffPmax / 100) * (r.tCell - 25));
    return { x: G, y: Math.max(0, p) };
  });

  createChart('chart-power-vs-g', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Pmax del Panel',
        data: pVsG,
        borderColor: CHART_COLORS.amber,
        backgroundColor: 'rgba(245,158,11,0.1)',
        showLine: true, fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: { title: { text: 'Irradiancia (W/m²)' }, min: 0 },
        y: { title: { text: 'Potencia (W)' }, min: 0 },
      },
    },
  });

  const tValues = Array.from({ length: 16 }, (_, i) => i * 5);
  const pVsT = tValues.map(t => {
    const p = panel.pmax * (cond.irradiance / G_STC) * (1 + (panel.tempCoeffPmax / 100) * (t - 25));
    return { x: t, y: Math.max(0, p) };
  });

  createChart('chart-power-vs-temp', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Pmax del Panel',
        data: pVsT,
        borderColor: CHART_COLORS.red,
        backgroundColor: 'rgba(239,68,68,0.1)',
        showLine: true, fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: { title: { text: 'Temperatura Celda (°C)' } },
        y: { title: { text: 'Potencia (W)' }, min: 0 },
      },
    },
  });

  const area = (panel.length / 1000) * (panel.width / 1000);
  const effVsT = tValues.map(t => {
    const p = panel.pmax * (cond.irradiance / G_STC) * (1 + (panel.tempCoeffPmax / 100) * (t - 25));
    const eff = area > 0 && cond.irradiance > 0 ? (Math.max(0, p) / (cond.irradiance * area)) * 100 : 0;
    return { x: t, y: eff };
  });

  createChart('chart-eff-vs-temp', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Eficiencia (%)',
        data: effVsT,
        borderColor: CHART_COLORS.green,
        backgroundColor: 'rgba(16,185,129,0.1)',
        showLine: true, fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: { title: { text: 'Temperatura Celda (°C)' } },
        y: { title: { text: 'Eficiencia (%)' }, min: 0 },
      },
    },
  });
}

function renderLossCharts(r) {
  const panel = state.get('panelSpecs');
  
  const prData = calculatePerformanceRatio({
    tempCoeffPmax: panel.tempCoeffPmax,
    tCell: r.tCell,
    vdPercent: r.vdPercent,
  });

  const waterfall = generateLossWaterfall(prData, r.pmax_stc_total);

  const wfLabels = waterfall.map(w => w.label);
  const wfColors = waterfall.map(w => w.type === 'start' ? CHART_COLORS.blue : w.type === 'end' ? CHART_COLORS.green : CHART_COLORS.red);
  
  createChart('chart-waterfall', {
    type: 'bar',
    data: {
      labels: wfLabels,
      datasets: [{
        label: 'Potencia (W)',
        data: waterfall.map(w => w.type === 'loss' ? Math.abs(w.value) : w.value),
        backgroundColor: wfColors.map(c => c + 'cc'),
        borderColor: wfColors,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: { title: { text: 'Potencia (W)' }, beginAtZero: true },
        y: {},
      },
      plugins: { legend: { display: false } },
    },
  });

  const lossEntries = Object.entries(prData.losses).filter(([_, v]) => v > 0);
  createChart('chart-losses-pie', {
    type: 'doughnut',
    data: {
      labels: lossEntries.map(([k]) => lossKeyToLabel(k)),
      datasets: [{
        data: lossEntries.map(([_, v]) => v),
        backgroundColor: lossEntries.map((_, i) => CURVE_PALETTE[i]),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: '55%',
      plugins: { legend: { position: 'right' } },
    },
  });

  const table = document.getElementById('losses-table');
  if (table) {
    let html = '<thead><tr><th>Pérdida</th><th>%</th><th>Factor</th></tr></thead><tbody>';
    Object.entries(prData.losses).forEach(([key, val]) => {
      html += `<tr><td>${lossKeyToLabel(key)}</td><td class="mono">${val.toFixed(2)}%</td><td class="mono">${prData.factors[key]?.toFixed(4) || '—'}</td></tr>`;
    });
    html += `<tr style="font-weight:700;border-top:2px solid var(--border-primary)"><td>PR Total</td><td class="mono" style="color:var(--solar-amber)">${prData.prPercent.toFixed(1)}%</td><td class="mono">${prData.pr.toFixed(4)}</td></tr>`;
    html += '</tbody>';
    table.innerHTML = html;
  }
}

function renderScenarioCompareChart() {
  const saved = getSavedScenarios();
  if (saved.length === 0) return;
  
  createChart('chart-compare-scenarios', {
    type: 'bar',
    data: {
      labels: saved.map(s => s.name),
      datasets: [
        {
          label: 'Potencia Neta (kW)',
          data: saved.map(s => s.pmax_net / 1000),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: CHART_COLORS.green,
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'PR Estimado (%)',
          data: saved.map(s => s.pr_estimated * 100),
          type: 'line',
          borderColor: CHART_COLORS.blue,
          backgroundColor: 'transparent',
          pointRadius: 5,
          yAxisID: 'y1',
          tension: 0.2,
        }
      ]
    },
    options: {
      scales: {
        y: { title: { text: 'Potencia Neta (kW)' }, beginAtZero: true },
        y1: { position: 'right', title: { text: 'Performance Ratio (%)' }, min: 0, max: 100, grid: { drawOnChartArea: false } },
      }
    }
  });
}

function lossKeyToLabel(key) {
  const map = {
    thermal: '🌡️ Térmicas', cable: '🔌 Cable', mismatch: '🔀 Mismatch',
    soiling: '🧹 Suciedad', shading: '🌑 Sombras', inverter: '⚙️ Inversor',
    degradation: '📉 Degradación', other: '📦 Otras',
  };
  return map[key] || key;
}

export { currentSubtab };
