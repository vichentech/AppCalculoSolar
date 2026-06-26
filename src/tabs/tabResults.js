/**
 * AppSolar — Tab: Resultados, Gráficas y Comparador de Escenarios
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';
import { getVoltageDropStatus } from '../engine/cableLoss.js';
import { createChart, CHART_COLORS, CURVE_PALETTE } from '../charts/chartManager.js';
import { generateIVCurve, generateIVCurveFamily_Irradiance, generateIVCurveFamily_Temperature, solveCurrentAtVoltage, extractModelParams } from '../engine/ivCurve.js';

const SLIDERS = [
  { key: 'irradiance', label: 'Irradiancia Máxima (Mediodía)', unit: 'W/m²', min: 0, max: 1400, step: 10 },
  { key: 'ambientTemp', label: 'Tª Ambiente Máxima', unit: '°C', min: -20, max: 55, step: 1 },
  { key: 'windSpeed', label: 'Viento', unit: 'm/s', min: 0, max: 30, step: 0.5 },
  { key: 'humidity', label: 'Humedad', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'albedo', label: 'Albedo', unit: '', min: 0, max: 1, step: 0.05 },
];

let currentViewParam = 'chart'; // 'chart' | 'table'
let currentParamVar = 'hour'; // 'hour' | 'day' | 'month'
let activeResTab = 'res-groups';
let showMaxLines = false;
let groupTooltips = true;
let ivViewMode = 'panel'; // 'panel' | 'groups'
let ivFamilyMode = 'irradiance'; // 'irradiance' | 'temperature'
let wpMode = 'power'; // 'power' | 'current'
let wpValuePanel = 0;
let wpValues = {}; // group.id -> value
let currentWPs = {}; // group.id -> {v, i, p} OR 'panel' -> {v, i, p}

export function render() {
  const currentId = state.get('currentProjectId');
  const projects = typeof state.getProjects === 'function' ? state.getProjects() : [];
  const currentProject = projects.find(p => p.id === currentId);
  const projectName = currentProject ? currentProject.name : 'Proyecto Actual';

  const r = calculateAll();
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const savedScenarios = state.get('savedScenarios') || [];
  const vdStatus = getVoltageDropStatus(r.vdPercent);

  const cellTempCfg = state.get('cellTemp') || { method: 'noct' };
  const method = cellTempCfg.method || 'noct';
  const panel = state.get('panelSpecs') || {};
  const noctu = panel.noct || 45;
  let tCellTooltip = '';
  if (method === 'noct') {
    tCellTooltip = `Fórmula NOCT: T_Amb + ((NOCT - 20) / 800) × G&#10;Valores: ${r.tAmb_actual.toFixed(1)} + ((${noctu} - 20) / 800) × ${r.G_actual.toFixed(0)} = ${r.tCell.toFixed(1)}°C`;
  } else if (method === 'faiman') {
    const u0 = cellTempCfg.faimanU0 || 25;
    const u1 = cellTempCfg.faimanU1 || 6.84;
    tCellTooltip = `Fórmula Faiman: T_Amb + G / (U0 + U1 × V_viento)&#10;Valores: ${r.tAmb_actual.toFixed(1)} + ${r.G_actual.toFixed(0)} / (${u0} + ${u1} × ${cond.windSpeed}) = ${r.tCell.toFixed(1)}°C`;
  } else if (method === 'sandia') {
    const a = cellTempCfg.sandiaA || -3.56;
    const b = cellTempCfg.sandiaB || -0.075;
    const dt = cellTempCfg.sandiaDeltaT || 3;
    tCellTooltip = `Fórmula Sandia: G × exp(a + b × V_viento) + T_Amb + (G/1000)×ΔT&#10;Valores: ${r.G_actual.toFixed(0)} × exp(${a} + ${b} × ${cond.windSpeed}) + ${r.tAmb_actual.toFixed(1)} + (${r.G_actual.toFixed(0)}/1000)×${dt} = ${r.tCell.toFixed(1)}°C`;
  } else {
    tCellTooltip = `Temperatura manual fija: ${r.tCell.toFixed(1)}°C`;
  }

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
        <h3 style="font-size: var(--text-base); margin:0; display:flex; align-items:center; gap:12px;">
          <span><span class="icon">🌡️</span> Condiciones Ambientales (Valores Pico)</span>
          ${state.get('loadedScenario') ? `<span style="font-size:0.75rem; font-weight:normal; color:var(--solar-blue); background:rgba(59,130,246,0.1); padding:2px 8px; border-radius:12px; border:1px solid var(--solar-blue);">Activo: ${state.get('loadedScenario')}</span>` : ''}
        </h3>
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
        ${SLIDERS.map(s => {
          let tooltip = '';
          if(s.key === 'windSpeed') tooltip = 'Velocidad del viento. Refrigera el panel y reduce la Temperatura de Celda.';
          if(s.key === 'humidity') tooltip = 'Humedad relativa. Afecta a la dispersión de la luz y levemente a la temperatura.';
          if(s.key === 'albedo') tooltip = 'Reflectividad del suelo. Un albedo alto (ej. nieve 0.8) aumenta la radiación difusa y el rendimiento si el panel capta por detrás.';
          return `
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:0.75rem;">
              ${s.label} <span class="unit">[${s.unit}]</span>
              ${tooltip ? `<span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="${tooltip}">ℹ️</span>` : ''}
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="res-slider-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${cond[s.key]}" style="flex:1;">
              <input type="number" class="form-input mono" id="res-input-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${cond[s.key]}" style="width:60px; padding:2px;">
            </div>
          </div>
        `}).join('')}
      </div>
    </div>

    <!-- SECCIÓN 2: Control Dinámico (Fecha/Hora) y Condiciones Aplicadas -->
    <div class="card mb-lg" style="border-top: 3px solid var(--solar-blue); background: linear-gradient(145deg, var(--bg-card), var(--bg-tertiary));">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); position:relative; z-index:10;">
        <h3 style="font-size: var(--text-base); margin:0; flex:1;"><span class="icon">⏱️</span> Momento de Simulación</h3>
        <div class="sim-mode-toggle" style="display:flex; gap:0; border:1px solid var(--border-primary); border-radius:var(--radius-md); overflow:hidden; justify-content:center;">
          <input type="radio" id="sm-dyn" name="simMode" value="dynamic" ${cond.simMode === 'dynamic' || !cond.simMode ? 'checked' : ''} style="display:none;">
          <label for="sm-dyn" class="btn btn-sm" style="border-radius:0; border:none; ${cond.simMode === 'dynamic' || !cond.simMode ? 'background:var(--solar-blue); color:white;' : 'background:transparent; color:var(--text-secondary);'}">📅 Dinámico</label>
          
          <input type="radio" id="sm-time" name="simMode" value="timeOnly" ${cond.simMode === 'timeOnly' ? 'checked' : ''} style="display:none;">
          <label for="sm-time" class="btn btn-sm" style="border-radius:0; border:none; border-left:1px solid var(--border-primary); border-right:1px solid var(--border-primary); ${cond.simMode === 'timeOnly' ? 'background:var(--solar-blue); color:white;' : 'background:transparent; color:var(--text-secondary);'}">🕒 Solo Día</label>
          
          <input type="radio" id="sm-max" name="simMode" value="fixedMax" ${cond.simMode === 'fixedMax' ? 'checked' : ''} style="display:none;">
          <label for="sm-max" class="btn btn-sm" style="border-radius:0; border:none; ${cond.simMode === 'fixedMax' ? 'background:var(--solar-blue); color:white;' : 'background:transparent; color:var(--text-secondary);'}">📌 Fijos</label>
        </div>
        <div style="flex:1;"></div>
      </div>
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:var(--space-lg); align-items:center;">
        <div style="display:flex; flex-direction:column; gap:var(--space-md);">
          <div style="display:flex; gap:var(--space-md); ${cond.simMode === 'timeOnly' || cond.simMode === 'fixedMax' ? 'opacity:0.4; pointer-events:none;' : ''}">
            <div class="slider-group" style="margin-bottom:0; flex:1;">
              <div class="slider-header" style="font-size:0.8rem;">
                <span class="slider-label">Mes</span>
                <select id="res-select-month" class="form-select form-select-sm" style="width:110px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
              </div>
              <input type="range" id="res-slider-month" min="1" max="12" step="1" style="height:4px; accent-color:var(--solar-blue);">
            </div>
            <div class="slider-group" style="margin-bottom:0; flex:1;">
              <div class="slider-header" style="font-size:0.8rem;">
                <span class="slider-label">Día</span>
                <div style="display:flex; align-items:center; gap:4px;">
                  <select id="res-select-daym" class="form-select form-select-sm" style="width:60px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
                  <button class="btn btn-ghost btn-sm" id="btn-set-today" title="Ir a la fecha actual" style="padding:0 4px; height:24px; font-size:12px; line-height:1;">📅</button>
                </div>
              </div>
              <input type="range" id="res-slider-daym" min="1" max="31" step="1" style="height:4px; accent-color:var(--solar-blue);">
            </div>
          </div>
          <div class="slider-group" style="margin-bottom:0; ${cond.simMode === 'fixedMax' ? 'opacity:0.4; pointer-events:none;' : ''}">
            <div class="slider-header" style="font-size:0.8rem;">
              <span class="slider-label">Hora del Día</span>
              <div style="display:flex; align-items:center; gap:4px;">
                <select id="res-select-hour" class="form-select form-select-sm" style="width:70px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
                <button class="btn btn-ghost btn-sm" id="btn-set-now" title="Ir a la hora actual" style="padding:0 4px; height:24px; font-size:12px; line-height:1;">⏱️</button>
              </div>
            </div>
            <input type="range" id="res-slider-hour" min="0" max="23.5" step="0.5" style="height:4px; accent-color:var(--solar-amber);">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md); background:rgba(0,0,0,0.2); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-primary);">
          <div>
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
              Irradiancia (G)
              <span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="Fórmula: Irradiancia_Máx × Factor_Temporal × Cos(Ángulo_Incidencia).&#10;Condiciones: ${cond.irradiance} W/m² (Max) -> ${r.G_actual.toFixed(1)} W/m² (Actual)">ℹ️</span>
            </div>
            <div style="font-size:1.5rem; font-weight:700; color:var(--solar-amber);">${r.G_actual.toFixed(0)} <span style="font-size:0.8rem;">W/m²</span></div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
              Tª Simulada
              <span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="Fórmula: T_Min + (T_Max - T_Min) × Curva_Horaria.&#10;Condiciones: T_Max=${cond.ambientTemp}°C -> T_Actual=${r.tAmb_actual.toFixed(1)}°C">ℹ️</span>
            </div>
            <div style="font-size:1.5rem; font-weight:700; color:var(--solar-red);">${r.tAmb_actual.toFixed(1)} <span style="font-size:0.8rem;">°C</span></div>
          </div>
          <div style="grid-column: span 2; border-top: 1px solid var(--border-primary); margin-top: 8px; padding-top: 8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
                <span class="icon">🔥</span> Tª Celda Calculada
                <span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="${tCellTooltip}">ℹ️</span>
              </div>
              <div style="font-size:1.5rem; font-weight:800; color:var(--solar-red); line-height:1;">${r.tCell.toFixed(1)}<span style="font-size:1rem;">°C</span></div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.75rem; color:var(--text-tertiary);">Pérdidas térmicas:</div>
              <div style="font-size:1rem; font-weight:600; color:var(--solar-red);">${r.thermalLoss.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 3: Resultados Eléctricos -->
    <div class="card mb-lg" style="border-top: 3px solid var(--solar-green);">
      <div class="tabs-header mb-md" style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid var(--border-primary); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-groups' ? 'active' : ''}" data-target="res-groups" style="border-radius:0; ${activeResTab === 'res-groups' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📦 Resultados por Grupos</button>
          <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-chart' ? 'active' : ''}" data-target="res-chart" style="border-radius:0; ${activeResTab === 'res-chart' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📈 Resumen Gráfico</button>
          <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-iv' ? 'active' : ''}" data-target="res-iv" style="border-radius:0; ${activeResTab === 'res-iv' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📐 Curvas I-V</button>
          <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-summary' ? 'active' : ''}" data-target="res-summary" style="border-radius:0; ${activeResTab === 'res-summary' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📋 Resumen Global</button>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost btn-sm" id="btn-export-html" title="Exportar reporte a HTML" style="font-size:0.8rem; border:1px solid var(--border-primary);">📄 HTML</button>
        </div>
      </div>

      <div class="tabs-content" style="min-height: 250px;">
        <div id="res-groups" class="results-res-tab-content" style="display:${activeResTab === 'res-groups' ? 'block' : 'none'};">
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Grupo / Inversor</th>
                  <th>Potencia Est. (kW)</th>
                  <th>Potencia Máx (kW)</th>
                  <th>Tensión Est. (V)</th>
                  <th>Voc Máx (V)</th>
                  <th>Corriente Est. (A)</th>
                  <th>Isc Máx (A)</th>
                </tr>
              </thead>
              <tbody>
                ${(r.groupsData || []).map(g => `
                  <tr>
                    <td><strong>${g.name}</strong></td>
                    <td class="mono" style="color:var(--solar-green); font-weight:600;">${(g.pmax_array/1000).toFixed(2)}</td>
                    <td class="mono" style="color:var(--text-tertiary); font-size:0.85em;">${(g.pmax_stc_array/1000).toFixed(2)}</td>
                    <td class="mono">${g.vmp_array.toFixed(1)}</td>
                    <td class="mono" style="color:var(--text-tertiary); font-size:0.85em;">${g.voc_stc_array.toFixed(1)}</td>
                    <td class="mono">${g.imp_array.toFixed(1)}</td>
                    <td class="mono" style="color:var(--text-tertiary); font-size:0.85em;">${g.isc_stc_array.toFixed(1)}</td>
                  </tr>
                `).join('')}
                <tr style="border-top:2px solid var(--border-primary); background:rgba(16,185,129,0.05);">
                  <td><strong>TOTAL PARQUE</strong></td>
                  <td class="mono" style="color:var(--solar-green); font-weight:700;">${(r.pmax_total_system/1000).toFixed(2)}</td>
                  <td class="mono text-muted">${(r.pmax_stc_total/1000).toFixed(2)}</td>
                  <td class="mono" style="font-weight:700;">${r.vmp_avg_system.toFixed(1)} (Prom.)</td>
                  <td class="mono text-muted">${r.voc_stc_total.toFixed(1)} (Prom.)</td>
                  <td class="mono" style="font-weight:700;">${r.imp_total_system.toFixed(1)}</td>
                  <td class="mono text-muted">${r.isc_stc_total.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div id="res-chart" class="results-res-tab-content" style="display:${activeResTab === 'res-chart' ? 'block' : 'none'};">
          <div class="alert alert-info mb-sm" style="display:flex; justify-content:space-around; flex-wrap:wrap; gap:8px; font-size:0.8rem; background:var(--bg-tertiary);">
            <div><strong>P. Máx Teórica (STC):</strong> ${(r.pmax_stc_total/1000).toFixed(2)} kW</div>
            <div><strong style="color:var(--solar-green);">P. Estimada Actual:</strong> ${(r.pmax_total_system/1000).toFixed(2)} kW</div>
            <div><strong>Irr. Nominal:</strong> ${cond.irradiance} W/m²</div>
            <div><strong style="color:var(--solar-amber);">Irr. Estimada:</strong> ${r.G_actual.toFixed(0)} W/m²</div>
            <div><strong>Voc Sistema Máx:</strong> ${r.voc_stc_total.toFixed(1)} V</div>
            <div><strong>Isc Sistema Máx:</strong> ${r.isc_stc_total.toFixed(1)} A</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-sm);">
            <h3 style="font-size: var(--text-base); margin:0;" id="title-param-chart"><span class="icon">📈</span> Análisis Paramétrico Temporal</h3>
            <div style="display:flex; gap:8px; align-items:center;">
              <select id="res-param-var" class="form-select form-select-sm" style="width:180px;">
                <option value="hour" ${currentParamVar === 'hour' ? 'selected' : ''}>Variar Hora (0-23h)</option>
                <option value="day" ${currentParamVar === 'day' ? 'selected' : ''}>Variar Día (1-365)</option>
                <option value="month" ${currentParamVar === 'month' ? 'selected' : ''}>Variar Mes (Ene-Dic)</option>
              </select>
              <button class="btn btn-sm ${currentViewParam === 'chart' ? 'btn-primary' : 'btn-secondary'}" id="btn-view-chart">Gráfica</button>
              <button class="btn btn-sm ${currentViewParam === 'table' ? 'btn-primary' : 'btn-secondary'}" id="btn-view-table">Tabla</button>
              <button class="btn btn-sm ${showMaxLines ? 'btn-primary' : 'btn-outline'}" id="btn-toggle-max-lines" style="margin-left:8px; border-color:var(--solar-amber); color: ${showMaxLines ? '#fff' : 'var(--solar-amber)'};">Máximos Teóricos</button>
              <label style="display:flex; align-items:center; gap:4px; margin-left:8px; font-size:0.8rem; cursor:pointer;">
                <input type="checkbox" id="cb-group-tooltips" ${groupTooltips ? 'checked' : ''}> Agrupar Tooltips
              </label>
            </div>
          </div>
          <div id="content-param" style="min-height:350px;">
            <!-- Se rellena vía JS -->
          </div>
        </div>

        <!-- IV Curves Tab -->
        <div id="res-iv" class="results-res-tab-content" style="display:${activeResTab === 'res-iv' ? 'block' : 'none'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-sm);">
            <h3 style="font-size:var(--text-base); margin:0; display:flex; align-items:center; gap:8px;">
              <span class="icon">📐</span> Curvas I-V y P-V Teóricas
              <span class="tooltip-trigger" style="cursor:pointer; color:var(--solar-blue); font-size:1.2rem;" onclick="document.getElementById('iv-info-modal').showModal()">ℹ️</span>
            </h3>
            <dialog id="iv-info-modal" style="border:1px solid var(--solar-purple); border-radius:var(--radius-md); padding:var(--space-lg); max-width:500px; background:var(--bg-card); color:var(--text-primary); box-shadow:var(--shadow-lg);">
              <h4 style="margin-top:0; color:var(--solar-blue);">¿Cómo se calculan estas curvas?</h4>
              <p style="font-size:0.85rem; line-height:1.5;">Las curvas se generan mediante el <strong>Modelo Analítico de un Diodo</strong> de cinco parámetros (IL, I0, Rs, Rsh, n). A partir de los valores STC (Voc, Isc, Vmp, Imp), se extraen estos parámetros numéricamente y se proyectan a cualquier irradiancia y temperatura mediante las siguientes ecuaciones:</p>
              <ul style="font-size:0.85rem; line-height:1.5; margin-bottom:var(--space-md); padding-left:20px;">
                <li><strong>Corriente Fotogenerada (IL):</strong> Varía de forma lineal con la irradiancia y ajustada por el coeficiente de temperatura de Isc.</li>
                <li><strong>Corriente de Saturación (I0):</strong> Depende fuertemente de la temperatura.</li>
                <li><strong>Ecuación I-V:</strong> <code>I = IL - I0*[exp((V+I*Rs)/(n*Vt))-1] - (V+I*Rs)/Rsh</code></li>
              </ul>
              <p style="font-size:0.85rem; line-height:1.5;">Para cada punto de tensión (V), la corriente (I) se resuelve iterativamente usando el método de <em>Newton-Raphson</em>. La curva P-V es simplemente P = V × I.</p>
              <div style="text-align:right; margin-top:var(--space-md);"><button class="btn btn-primary btn-sm" onclick="this.closest('dialog').close()">Cerrar</button></div>
            </dialog>
          </div>
          <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-md); gap:8px; align-items:center; flex-wrap:wrap;">
              <select id="iv-view-mode" class="form-select form-select-sm" style="width:140px;">
                <option value="panel" ${ivViewMode === 'panel' ? 'selected' : ''}>1 Panel</option>
                <option value="groups" ${ivViewMode === 'groups' ? 'selected' : ''}>Por Grupo</option>
              </select>
              <select id="iv-family-mode" class="form-select form-select-sm" style="width:180px;">
                <option value="irradiance" ${ivFamilyMode === 'irradiance' ? 'selected' : ''}>Familia por Irradiancia</option>
                <option value="temperature" ${ivFamilyMode === 'temperature' ? 'selected' : ''}>Familia por Temperatura</option>
              </select>
            </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md);">
            <div style="height:320px; position:relative;"><canvas id="canvas-iv"></canvas></div>
            <div style="height:320px; position:relative;"><canvas id="canvas-pv"></canvas></div>
          </div>
          <div class="alert alert-info mt-md" style="font-size:0.8rem; background:var(--bg-tertiary);">
            <strong>Condiciones actuales:</strong> G = ${r.G_actual.toFixed(0)} W/m², T.Celda = ${r.tCell.toFixed(1)}°C |
            <strong style="color:var(--solar-green);">● MPP Sistema:</strong> ${r.vmp_avg_system.toFixed(1)} V × ${r.imp_total_system.toFixed(1)} A = ${(r.pmax_total_system/1000).toFixed(2)} kW
          </div>

          <!-- Calculador de Punto de Trabajo -->
          <div class="card mt-md" style="border: 1px solid var(--solar-purple); border-radius:var(--radius-md);">
            <h4 style="margin:0 0 var(--space-sm) 0; font-size:0.9rem;"><span class="icon">🎯</span> Calculador de Punto de Trabajo ${ivViewMode === 'panel' ? '(1 Panel)' : '(Por Grupos)'}</h4>
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
              ${ivViewMode === 'panel' ? 
                `Introduce la potencia (W) o corriente (A) para calcular la tensión de trabajo de 1 panel.` : 
                `Introduce un valor individual para cada grupo para generar la tabla de tensiones resultantes.`}
            </p>
            <div style="display:flex; gap:var(--space-md); margin-bottom:var(--space-sm);">
              <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-size:0.85rem;">
                <input type="radio" name="wpMode" value="power" ${wpMode === 'power' ? 'checked' : ''}> Potencia (${ivViewMode === 'panel' ? 'W' : 'kW'})
              </label>
              <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-size:0.85rem;">
                <input type="radio" name="wpMode" value="current" ${wpMode === 'current' ? 'checked' : ''}> Corriente (A)
              </label>
            </div>
            
            ${ivViewMode === 'panel' ? `
              <div style="display:flex; gap:var(--space-lg); align-items:flex-start; flex-wrap:wrap;">
                <div style="flex:1; min-width:220px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" style="font-size:0.75rem;">${wpMode === 'power' ? 'Potencia Medida (W)' : 'Corriente Medida (A)'}</label>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <input type="range" class="form-input wp-slider-panel" value="${wpValuePanel}" min="0" max="${wpMode === 'power' ? Math.ceil(panel.vmp*panel.imp) : Math.ceil(panel.isc)}" step="${wpMode === 'power' ? '1' : '0.1'}" style="flex:1; accent-color:var(--solar-purple);">
                      <input type="number" class="form-input wp-input-panel" value="${wpValuePanel}" min="0" step="${wpMode === 'power' ? '10' : '0.1'}" style="width:90px;">
                    </div>
                  </div>
                </div>
                <div id="wp-result-panel" style="flex:2; min-width:300px; min-height:80px;"></div>
              </div>
            ` : `
              <div style="overflow-x:auto;">
                <table class="data-table" style="width:100%; font-size:0.8rem;">
                  <thead>
                    <tr>
                      <th>Grupo / Inversor</th>
                      <th>Máx Admisible</th>
                      <th>Input (${wpMode === 'power' ? 'kW' : 'A'})</th>
                      <th>V. Teórica (V)</th>
                      <th>I. Teórica (A)</th>
                      <th>P. Teórica (kW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(r.groupsData || []).map(g => `
                      <tr>
                        <td><strong>${g.name}</strong></td>
                        <td class="mono" style="color:var(--text-tertiary);">${(g.pmax_array/1000).toFixed(2)} kW</td>
                        <td>
                          <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
                            <input type="number" class="form-input wp-group-input" data-id="${g.id}" value="${wpValues[g.id] || ''}" min="0" step="0.1" style="width:80px; padding:4px; height:26px;">
                            <input type="range" class="wp-group-slider" data-id="${g.id}" value="${wpValues[g.id] || 0}" min="0" max="${wpMode === 'power' ? (g.pmax_stc_array/1000).toFixed(1) : (g.isc_stc_array).toFixed(1)}" step="${wpMode === 'power' ? '0.1' : '0.1'}" style="width:80px; accent-color:var(--solar-purple);">
                          </div>
                        </td>
                        <td id="wp-res-v-${g.id}" class="mono font-bold" style="color:var(--solar-purple);">-</td>
                        <td id="wp-res-i-${g.id}" class="mono" style="color:var(--solar-pink);">-</td>
                        <td id="wp-res-p-${g.id}" class="mono" style="color:var(--solar-green);">-</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>

        <div id="res-summary" class="results-res-tab-content" style="display:${activeResTab === 'res-summary' ? 'block' : 'none'};">
          <div class="alert alert-info mb-sm"><span>ℹ️ Estos resultados muestran los valores <strong>dinámicos calculados para el momento actual de simulación</strong> (Irradiancia: ${r.G_actual.toFixed(0)} W/m², Temp: ${r.tAmb_actual.toFixed(1)}°C).</span></div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align:left;">Parámetro de Rendimiento</th>
                <th style="text-align:right;">Simulación Actual</th>
                <th style="text-align:right;">Máximo STC / Nominal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Potencia Máxima Teórica Estimada <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Potencia nominal DC multiplicada por el ratio de pérdida por temperatura e irradiancia.">ℹ️</span></td>
                <td class="mono" style="color:var(--solar-amber);font-weight:700;text-align:right;">${(r.pmax_total_system/1000).toFixed(2)} kW</td>
                <td class="mono text-muted" style="text-align:right;">${(r.pmax_stc_total/1000).toFixed(2)} kW</td>
              </tr>
              <tr>
                <td>Potencia Máxima Neta Estimada <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Potencia en terminales del inversor tras descontar las pérdidas óhmicas de cableado.">ℹ️</span></td>
                <td class="mono" style="font-weight:700;text-align:right;">${(r.pmax_net/1000).toFixed(2)} kW</td>
                <td class="mono text-muted" style="text-align:right;">-</td>
              </tr>
              <tr>
                <td>Tensión (Vmp Sistema Estimado) <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Tensión en el punto de máxima potencia media de todos los strings.">ℹ️</span></td>
                <td class="mono" style="text-align:right;">${r.vmp_avg_system.toFixed(1)} V</td>
                <td class="mono text-muted" style="text-align:right;">${r.voc_stc_total.toFixed(1)} V (Voc)</td>
              </tr>
              <tr>
                <td>Corriente Total Sistema Estimada <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Suma de las corrientes (Imp) de todos los strings conectados.">ℹ️</span></td>
                <td class="mono" style="text-align:right;">${r.imp_total_system.toFixed(2)} A</td>
                <td class="mono text-muted" style="text-align:right;">${r.isc_stc_total.toFixed(2)} A (Isc)</td>
              </tr>
              <tr>
                <td>Caída Tensión DC <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Pérdida porcentual de tensión en el cableado DC.">ℹ️</span></td>
                <td class="mono" style="color:var(--solar-${vdStatus.color});text-align:right;">${r.vdPercent.toFixed(2)}% (${vdStatus.message})</td>
                <td class="mono text-muted" style="text-align:right;">-</td>
              </tr>
              <tr>
                <td>Fill Factor Real <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="FF = (Pmax_real) / (Voc * Isc). Indica la 'cuadratura' de la curva I-V.">ℹ️</span></td>
                <td class="mono" style="text-align:right;">${(r.fillFactor*100).toFixed(1)}%</td>
                <td class="mono text-muted" style="text-align:right;">-</td>
              </tr>
              <tr>
                <td>Eficiencia Real del Panel <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Eficiencia = Pmax_real / (Área_Panel * Irradiancia).">ℹ️</span></td>
                <td class="mono" style="text-align:right;">${r.panelEffReal.toFixed(1)}%</td>
                <td class="mono text-muted" style="text-align:right;">-</td>
              </tr>
              <tr>
                <td>Performance Ratio (PR) <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Rendimiento global de la planta descontando pérdidas térmicas y de cableado respecto a la teórica ideal STC.">ℹ️</span></td>
                <td class="mono" style="font-weight:700;text-align:right;">${(r.pr_estimated*100).toFixed(1)}%</td>
                <td class="mono text-muted" style="text-align:right;">-</td>
              </tr>
              <tr>
                <td>Rendimiento Anual (Yield) <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Energía anual producida estimada por la API de PVGIS.">ℹ️</span></td>
                <td class="mono" style="color:var(--solar-green);font-weight:700;text-align:right;">${(r.annualYield/1000).toFixed(1)} MWh/año</td>
                <td class="mono text-muted" style="text-align:right;">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}



let isFirstLoad = true;

export function init() {
  if (isFirstLoad) {
    isFirstLoad = false;
    if (state.get('conditions.hourOfDay') === undefined || new Date().getHours() > 18) {
      state.set('conditions.hourOfDay', 12); 
    }
    setTimeout(refreshUI, 50);
    return;
  }

  const r = calculateAll();
  const cond = state.get('conditions');

  const currentDayOfYear = cond.simDayOfYear || 172;
  const initDate = getDateFromDayOfYear(currentDayOfYear);
  let currentMonth = initDate.month;
  let currentDay = initDate.day;

  const sliderMonth = document.getElementById('res-slider-month');
  const sliderDay = document.getElementById('res-slider-daym');
  const selectMonth = document.getElementById('res-select-month');
  const selectDay = document.getElementById('res-select-daym');
  
  if (selectMonth) {
     const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
     selectMonth.innerHTML = monthNames.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
  }

  const updateDate = () => {
    // clamp day
    const daysInMonth = new Date(new Date().getFullYear(), currentMonth, 0).getDate();
    if (currentDay > daysInMonth) currentDay = daysInMonth;
    
    if (sliderDay) {
      sliderDay.max = daysInMonth;
      sliderDay.value = currentDay;
    }
    if (selectDay) {
       selectDay.innerHTML = Array.from({length: daysInMonth}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('');
       selectDay.value = currentDay;
    }
    if (selectMonth) selectMonth.value = currentMonth;
    
    const doy = getDayOfYear(currentMonth, currentDay);
    state.set('conditions.simDayOfYear', doy);
    refreshUI();
  };

  if (sliderMonth) {
    sliderMonth.value = currentMonth;
    sliderMonth.addEventListener('change', (e) => {
      currentMonth = parseInt(e.target.value);
      updateDate();
    });
  }
  if (sliderDay) {
    sliderDay.value = currentDay;
    sliderDay.addEventListener('change', (e) => {
      currentDay = parseInt(e.target.value);
      updateDate();
    });
  }
  
  if (selectMonth) {
    selectMonth.value = currentMonth;
    selectMonth.addEventListener('change', (e) => {
      currentMonth = parseInt(e.target.value);
      updateDate();
    });
  }
  
  if (selectDay) {
    const daysInMonth = new Date(new Date().getFullYear(), currentMonth, 0).getDate();
    selectDay.innerHTML = Array.from({length: daysInMonth}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('');
    selectDay.value = currentDay;
    selectDay.addEventListener('change', (e) => {
      currentDay = parseInt(e.target.value);
      updateDate();
    });
  }

  const btnToday = document.getElementById('btn-set-today');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const now = new Date();
      currentMonth = now.getMonth() + 1;
      currentDay = now.getDate();
      updateDate();
    });
  }

  const selectHour = document.getElementById('res-select-hour');
  if (selectHour) {
    let opts = '';
    for(let h = 0; h <= 23.5; h+=0.5) {
      let hh = Math.floor(h).toString().padStart(2, '0');
      let mm = (h % 1 === 0.5) ? '30' : '00';
      opts += `<option value="${h}">${hh}:${mm}</option>`;
    }
    selectHour.innerHTML = opts;
    selectHour.value = cond.hourOfDay || 12;
    selectHour.addEventListener('change', e => {
      state.set('conditions.hourOfDay', parseFloat(e.target.value));
      refreshUI();
    });
  }

  const controls = [
    { slider: 'res-slider-hour', key: 'conditions.hourOfDay', parse: parseFloat },
  ];

  controls.forEach(({ slider, key, parse }) => {
    const sl = document.getElementById(slider);
    if (sl) {
      sl.value = cond.hourOfDay || 12;
      sl.addEventListener('input', (e) => {
        const val = parse(e.target.value);
        state.set(key, val);
        if (selectHour) selectHour.value = val;
        refreshUI();
      });
    }
  });

  const btnNow = document.getElementById('btn-set-now');
  if (btnNow) {
    btnNow.addEventListener('click', () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes() >= 30 ? 0.5 : 0;
      state.set('conditions.hourOfDay', h + m);
      if (selectHour) selectHour.value = h + m;
      refreshUI();
    });
  }

  const simModeRadios = document.querySelectorAll('input[name="simMode"]');
  simModeRadios.forEach(radio => {
    radio.addEventListener('change', e => {
      if (e.target.checked) {
        state.set('conditions.simMode', e.target.value);
        refreshUI();
      }
    });
  });

  // Sliders Ambientales
  SLIDERS.forEach(s => {
    const slider = document.getElementById(`res-slider-${s.key}`);
    const input = document.getElementById(`res-input-${s.key}`);
    const update = (val) => {
      val = parseFloat(val);
      if (isNaN(val)) return;
      state.set(`conditions.${s.key}`, val);
      state.set('loadedScenario', null);
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
      state.set('loadedScenario', null);
      refreshUI();
      return;
    }
    if (btnDel) btnDel.disabled = !val.startsWith('custom_');

    const text = e.target.options[e.target.selectedIndex].text.replace(/^[^\s]+\s+/, '');

    if (val === 'stc') setScenario({ irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 0, albedo: 0.2 }, text);
    else if (val === 'summer') setScenario({ irradiance: 1100, ambientTemp: 40, windSpeed: 2, humidity: 20, albedo: 0.2 }, text);
    else if (val === 'winter') setScenario({ irradiance: 400, ambientTemp: 5, windSpeed: 4, humidity: 60, albedo: 0.8 }, text);
    else if (val === 'cloudy') setScenario({ irradiance: 200, ambientTemp: 20, windSpeed: 3, humidity: 80, albedo: 0.1 }, text);
    else if (val.startsWith('custom_')) {
      const scenarios = state.get('savedScenarios') || [];
      const sc = scenarios.find(s => s.id === val);
      if (sc) setScenario(sc.conditions, text);
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

  // Toggles Param
  document.getElementById('btn-view-chart')?.addEventListener('click', () => {
    currentViewParam = 'chart';
    refreshUI();
  });
  document.getElementById('btn-view-table')?.addEventListener('click', () => {
    currentViewParam = 'table';
    refreshUI();
  });
  document.getElementById('btn-toggle-max-lines')?.addEventListener('click', () => {
    showMaxLines = !showMaxLines;
    refreshUI();
  });
  document.getElementById('cb-group-tooltips')?.addEventListener('change', (e) => {
    groupTooltips = e.target.checked;
    refreshUI();
  });
  document.getElementById('res-param-var')?.addEventListener('change', (e) => {
    currentParamVar = e.target.value;
    refreshUI();
  });

  // Tabs de Sección 3
  document.querySelectorAll('.results-res-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeResTab = e.currentTarget.dataset.target;
      refreshUI();
    });
  });

  // Exportar
  document.getElementById('btn-export-html')?.addEventListener('click', () => {
    const tabsContent = document.querySelector('.tabs-content');
    const clone = tabsContent.cloneNode(true);
    
    // Replace canvases with images
    const realCanvases = tabsContent.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    realCanvases.forEach((canvas, index) => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        clonedCanvases[index].parentNode.replaceChild(img, clonedCanvases[index]);
      } catch (e) {
        console.warn('Canvas export failed', e);
      }
    });

    // Make all tabs visible for the report
    clone.querySelectorAll('.results-res-tab-content').forEach(pane => {
      pane.style.display = 'block';
      pane.style.marginBottom = '40px';
      pane.style.borderBottom = '2px solid #ccc';
      pane.style.paddingBottom = '20px';
    });

    // Remove interactive elements to make it a static report
    clone.querySelectorAll('button, select, input, .tooltip-trigger').forEach(el => el.remove());
    
    // Remove Working Point Calculator
    clone.querySelectorAll('.card').forEach(el => {
      if (el.innerHTML.includes('Calculador de Punto de Trabajo')) el.remove();
    });

    // Expand details
    clone.querySelectorAll('details').forEach(el => el.setAttribute('open', 'true'));

    const content = clone.innerHTML;
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Simulación AppSolar</title>
      <style>body{font-family:sans-serif;padding:20px;max-width:1200px;margin:auto;} table{border-collapse:collapse;width:100%;margin-bottom:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;} img{max-width:100%;height:auto;} .alert{padding:10px;margin-bottom:15px;background:#f8f9fa;border-left:4px solid #0d6efd;}</style>
      </head><body>
      <h1>Reporte de Simulación - AppSolar</h1>
      <p><em>Generado el: ${new Date().toLocaleString()}</em></p>
      ${content}
      </body></html>
    `;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte_parque.html';
    link.click();
  });

  // IV curve tab listeners
  document.getElementById('iv-view-mode')?.addEventListener('change', (e) => {
    ivViewMode = e.target.value;
    refreshUI();
  });
  document.getElementById('iv-family-mode')?.addEventListener('change', (e) => {
    ivFamilyMode = e.target.value;
    refreshUI();
  });
  document.querySelectorAll('input[name="wpMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        wpMode = e.target.value;
        refreshUI();
      }
    });
  });

  const syncInputs = (numInput, sliderInput, isGroup, id) => {
    const update = (val) => {
      let v = parseFloat(val) || 0;
      numInput.value = v;
      sliderInput.value = v;
      if (isGroup) {
         wpValues[id] = v;
      } else {
         wpValuePanel = v;
      }
      renderWorkPoint(r);
      if (activeResTab === 'res-iv') renderIVCurves(r);
    };
    numInput.addEventListener('input', (e) => update(e.target.value));
    sliderInput.addEventListener('input', (e) => update(e.target.value));
  };

  const wpInputPanel = document.querySelector('.wp-input-panel');
  const wpSliderPanel = document.querySelector('.wp-slider-panel');
  if (wpInputPanel && wpSliderPanel) {
    syncInputs(wpInputPanel, wpSliderPanel, false);
  }

  document.querySelectorAll('.wp-group-input').forEach(numInput => {
    const id = numInput.dataset.id;
    const sliderInput = document.querySelector(`.wp-group-slider[data-id="${id}"]`);
    if (sliderInput) {
      syncInputs(numInput, sliderInput, true, id);
    }
  });

  renderParametricSection(cond, r);
  renderWorkPoint(r);
  renderIVCurves(r);
}

function refreshUI() {
  const mainUi = document.querySelector('.page-title-bar').parentElement;
  try {
    mainUi.innerHTML = render();
    init();
  } catch (err) {
    mainUi.innerHTML = `<div class="alert alert-danger"><h4>Error Crítico en el Renderizado</h4><pre>${err.stack}</pre></div>`;
    console.error(err);
  }
}

function setScenario(values, name) {
  Object.entries(values).forEach(([key, val]) => {
    state.set(`conditions.${key}`, val);
  });
  if (name) state.set('loadedScenario', name);
  refreshUI();
}

function getDateFromDayOfYear(dayOfYear) {
  const date = new Date(new Date().getFullYear(), 0);
  date.setDate(dayOfYear);
  return { month: date.getMonth() + 1, day: date.getDate() };
}

function getDayOfYear(month, day) {
  const date = new Date(new Date().getFullYear(), month - 1, day);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / 86400000);
}

function renderParametricSection(cond, r) {
  const container = document.getElementById('content-param');
  if (!container) return;

  const originalHour = cond.hourOfDay;
  const originalDoy = cond.simDayOfYear;
  const arr = state.get('arrayConfig');
  const groups = arr.groups || [];
  
  const dataPoints = [];
  
  const initDate = getDateFromDayOfYear(originalDoy);
  const fixedMonth = initDate.month;
  const fixedDay = initDate.day;
  const mName = new Date(2000, fixedMonth - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
  const dayStr = `${fixedDay} de ${mName.charAt(0).toUpperCase() + mName.slice(1)}`;

  let titleStr = '';

  if (currentParamVar === 'hour') {
    titleStr = `Análisis Horario (${dayStr})`;
    for (let h = 0; h <= 23; h++) {
      state.set('conditions.hourOfDay', h);
      const rTemp = calculateAll();
      dataPoints.push({
        label: `${h}:00`,
        tCell: rTemp.tCell,
        irradiance: rTemp.G_actual,
        pmaxTotal: rTemp.pmax_total_system,
        vmpAvg: rTemp.vmp_avg_system,
        impTotal: rTemp.imp_total_system,
        groups: rTemp.groupsData || []
      });
    }
  } else if (currentParamVar === 'day') {
    titleStr = `Análisis Diario a las ${originalHour}:00`;
    for (let d = 1; d <= 365; d++) {
      state.set('conditions.simDayOfYear', d);
      const rTemp = calculateAll();
      dataPoints.push({
        label: `Día ${d}`,
        tCell: rTemp.tCell,
        irradiance: rTemp.G_actual,
        pmaxTotal: rTemp.pmax_total_system,
        vmpAvg: rTemp.vmp_avg_system,
        impTotal: rTemp.imp_total_system,
        groups: rTemp.groupsData || []
      });
    }
  } else if (currentParamVar === 'month') {
    titleStr = `Análisis Mensual (Día ${fixedDay} a las ${originalHour}:00)`;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(new Date().getFullYear(), m, 0).getDate();
      const safeDay = Math.min(fixedDay, daysInMonth);
      const doy = getDayOfYear(m, safeDay);
      state.set('conditions.simDayOfYear', doy);
      const rTemp = calculateAll();
      dataPoints.push({
        label: monthNames[m-1],
        tCell: rTemp.tCell,
        irradiance: rTemp.G_actual,
        pmaxTotal: rTemp.pmax_total_system,
        vmpAvg: rTemp.vmp_avg_system,
        impTotal: rTemp.imp_total_system,
        groups: rTemp.groupsData || []
      });
    }
  }
  
  // Restore state
  state.set('conditions.hourOfDay', originalHour);
  state.set('conditions.simDayOfYear', originalDoy);

  const titleEl = document.getElementById('title-param-chart');
  if (titleEl) titleEl.innerHTML = `<span class="icon">📈</span> ${titleStr}`;

  if (currentViewParam === 'chart') {
    container.innerHTML = '<div style="height:350px; position:relative;"><canvas id="canvas-param"></canvas></div>';
    if (activeResTab === 'res-chart') {
      setTimeout(() => {
        const labels = dataPoints.map(d => d.label);
      const datasets = [];

      datasets.push({
        label: 'Irradiancia (W/m²)',
        data: dataPoints.map(d => d.irradiance.toFixed(0)),
        borderColor: CHART_COLORS.amber,
        borderDash: [5, 5],
        fill: false, tension: 0.4, yAxisID: 'y1'
      });

      datasets.push({
        label: 'T. Celda (°C)',
        data: dataPoints.map(d => d.tCell.toFixed(1)),
        borderColor: CHART_COLORS.red,
        fill: false, tension: 0.4, yAxisID: 'y2'
      });

      datasets.push({
        label: 'Potencia Total (kW)',
        data: dataPoints.map(d => (d.pmaxTotal/1000).toFixed(2)),
        borderColor: CHART_COLORS.green,
        backgroundColor: 'rgba(16,185,129,0.2)',
        fill: true, tension: 0.4, yAxisID: 'y'
      });

      groups.forEach((g, i) => {
        const colors = [CHART_COLORS.blue, CHART_COLORS.purple, '#ec4899', '#06b6d4'];
        datasets.push({
          label: `${g.name} (kW)`,
          data: dataPoints.map(d => {
            const grp = d.groups.find(gx => gx.id === g.id);
            return grp ? (grp.pmax_array/1000).toFixed(2) : 0;
          }),
          borderColor: colors[i % colors.length],
          fill: false, tension: 0.4, yAxisID: 'y'
        });
      });

      if (showMaxLines) {
        const vocMax = parseFloat((r.voc_stc_total || 0).toFixed(1));
        const iscMax = parseFloat((r.isc_stc_total || 0).toFixed(1));
        datasets.push({
          label: 'Irr. Nominal (W/m²)',
          data: Array(labels.length).fill(cond.irradiance),
          borderColor: 'rgba(245, 158, 11, 0.4)',
          borderDash: [5, 5], borderWidth: 1.5, fill: false, pointRadius: 0, yAxisID: 'y1'
        });
        datasets.push({
          label: 'P. Máx Teórica (kW)',
          data: Array(labels.length).fill(parseFloat((r.pmax_stc_total/1000).toFixed(2))),
          borderColor: 'rgba(16, 185, 129, 0.4)',
          borderDash: [5, 5], borderWidth: 1.5, fill: false, pointRadius: 0, yAxisID: 'y'
        });
        datasets.push({
          label: 'Voc Total Máx (V)',
          data: Array(labels.length).fill(vocMax),
          borderColor: 'rgba(139, 92, 246, 0.4)',
          borderDash: [5, 5], borderWidth: 1.5, fill: false, pointRadius: 0, yAxisID: 'y3'
        });
        datasets.push({
          label: 'Isc Total Máx (A)',
          data: Array(labels.length).fill(iscMax),
          borderColor: 'rgba(236, 72, 153, 0.4)',
          borderDash: [5, 5], borderWidth: 1.5, fill: false, pointRadius: 0, yAxisID: 'y4'
        });
        datasets.push({
          label: 'Vmp Estimada (V)',
          data: dataPoints.map(d => parseFloat((d.vmpAvg || 0).toFixed(1))),
          borderColor: 'rgba(139, 92, 246, 1)',
          fill: false, tension: 0.4, yAxisID: 'y3'
        });
        datasets.push({
          label: 'Imp Estimada (A)',
          data: dataPoints.map(d => parseFloat((d.impTotal || 0).toFixed(1))),
          borderColor: 'rgba(236, 72, 153, 1)',
          fill: false, tension: 0.4, yAxisID: 'y4'
        });
      }

      // Calculate sensible ranges for voltage/current axes
      const allVmpVals = dataPoints.map(d => d.vmpAvg || 0);
      const allImpVals = dataPoints.map(d => d.impTotal || 0);
      const maxV = Math.max(r.voc_stc_total || 0, ...allVmpVals) * 1.1 || 100;
      const maxI = Math.max(r.isc_stc_total || 0, ...allImpVals) * 1.1 || 20;
      try {
        createChart('canvas-param', {
          type: 'line',
          data: { labels, datasets },
          options: {
            interaction: {
              mode: groupTooltips ? 'index' : 'nearest',
              intersect: false
            },
            plugins: {
              title: { display: true, text: titleStr }
            },
            scales: {
              x: { display: true },
              y: { type: 'linear', display: true, position: 'left', title: {text: 'Potencia (kW)'} },
              y1: { type: 'linear', display: true, position: 'right', grid: {drawOnChartArea: false}, title: {text: 'Irradiancia (W/m²)'} },
              y2: { type: 'linear', display: true, position: 'right', grid: {drawOnChartArea: false}, title: {text: 'T. Celda (°C)'} },
              y3: { type: 'linear', display: showMaxLines, position: 'left', grid: {drawOnChartArea: false}, min: 0, suggestedMax: maxV, title: {text: 'Tensión (V)'} },
              y4: { type: 'linear', display: showMaxLines, position: 'right', grid: {drawOnChartArea: false}, min: 0, suggestedMax: maxI, title: {text: 'Corriente (A)'} }
            }
          }
        });
      } catch (err) {
        container.innerHTML = `<div style="color:red; padding:10px;">Error dibujando Gráfico: ${err.message}</div>`;
        console.error(err);
      }
    }, 50);
    }
  } else {
    // TABLE VIEW
    let html = `
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>Punto</th>
              ${showMaxLines ? '<th style="color:var(--solar-amber); opacity:0.8;">Irr. Nom.</th><th style="color:var(--solar-green); opacity:0.8;">P. Máx T. (kW)</th><th style="color:var(--solar-purple); opacity:0.8;">Voc Máx (V)</th><th style="color:var(--solar-pink); opacity:0.8;">Isc Máx (A)</th>' : ''}
              <th>G (W/m²)</th>
              <th>T. Celda (°C)</th>
              <th style="color:var(--solar-green);">P. Total (kW)</th>
              ${showMaxLines ? '<th style="color:var(--solar-purple);">Vmp Est. (V)</th><th style="color:var(--solar-pink);">Imp Est. (A)</th>' : ''}
              ${groups.map(g => `<th>${g.name} (kW)</th><th>${g.name} (V)</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    dataPoints.forEach(d => {
      html += `<tr>`;
      html += `<td class="mono"><strong>${d.label}</strong></td>`;
      if (showMaxLines) {
         html += `<td class="mono" style="opacity:0.8;">${cond.irradiance.toFixed(0)}</td>`;
         html += `<td class="mono" style="opacity:0.8;">${(r.pmax_stc_total/1000).toFixed(2)}</td>`;
         html += `<td class="mono" style="opacity:0.8;">${(r.voc_stc_total || 0).toFixed(1)}</td>`;
         html += `<td class="mono" style="opacity:0.8;">${(r.isc_stc_total || 0).toFixed(1)}</td>`;
      }
      html += `<td class="mono">${d.irradiance.toFixed(0)}</td>`;
      html += `<td class="mono" style="color:var(--solar-red);">${d.tCell.toFixed(1)}</td>`;
      html += `<td class="mono" style="color:var(--solar-green); font-weight:700;">${(d.pmaxTotal/1000).toFixed(2)}</td>`;
      if (showMaxLines) {
         html += `<td class="mono">${(d.vmpAvg || 0).toFixed(1)}</td>`;
         html += `<td class="mono">${(d.impTotal || 0).toFixed(1)}</td>`;
      }
      
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

/**
 * Render I-V and P-V curves
 */
function renderIVCurves(r) {
  if (activeResTab !== 'res-iv') return;
  const canvasIV = document.getElementById('canvas-iv');
  const canvasPV = document.getElementById('canvas-pv');
  if (!canvasIV || !canvasPV) return;

  const panel = state.get('panelSpecs');
  const arr = state.get('arrayConfig');
  const groups = arr.groups || [];
  const cond = state.get('conditions');

  const basePanelParams = {
    voc: panel.voc,
    isc: panel.isc,
    vmp: panel.vmp,
    imp: panel.imp,
    numCells: panel.numCells || 144,
    tempCoeffIsc: panel.tempCoeffIsc,
    tempCoeffVoc: panel.tempCoeffVoc,
  };

  const ivDatasets = [];
  const pvDatasets = [];
  const colors = CURVE_PALETTE;

  if (ivViewMode === 'panel') {
    // Family of curves for a single panel
    let curves = [];
    if (ivFamilyMode === 'irradiance') {
      const irradiances = [200, 400, 600, 800, 1000];
      curves = generateIVCurveFamily_Irradiance(basePanelParams, irradiances, r.tCell);
    } else {
      const temps = [10, 25, 40, 55];
      curves = generateIVCurveFamily_Temperature(basePanelParams, temps, r.G_actual > 0 ? r.G_actual : 1000);
    }

    curves.forEach((c, i) => {
      ivDatasets.push({
        label: c.label,
        data: c.voltages.map((v, j) => ({ x: v, y: c.currents[j] })),
        borderColor: colors[i % colors.length],
        borderWidth: 2,
        fill: false, tension: 0.3, pointRadius: 0, showLine: true,
      });
      pvDatasets.push({
        label: c.label,
        data: c.voltages.map((v, j) => ({ x: v, y: c.powers[j] })),
        borderColor: colors[i % colors.length],
        borderWidth: 2,
        fill: false, tension: 0.3, pointRadius: 0, showLine: true,
      });
    });

    // Mark current operating point on the matching irradiance curve
    if (r.G_actual > 0) {
      const currentCurve = generateIVCurve({ ...basePanelParams, G: r.G_actual, tCell: r.tCell });

      ivDatasets.push({
        label: `Curva Actual (${r.G_actual.toFixed(0)} W/m², ${r.tCell.toFixed(1)}°C)`,
        data: currentCurve.voltages.map((v, j) => ({ x: v, y: currentCurve.currents[j] })),
        borderColor: '#10b981', borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true, borderDash: [5, 5]
      });
      pvDatasets.push({
        label: `Curva Actual (${r.G_actual.toFixed(0)} W/m², ${r.tCell.toFixed(1)}°C)`,
        data: currentCurve.voltages.map((v, j) => ({ x: v, y: currentCurve.powers[j] })),
        borderColor: '#10b981', borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true, borderDash: [5, 5]
      });

      ivDatasets.push({
        label: `MPP Actual (${r.G_actual.toFixed(0)} W/m²)`,
        data: [{ x: currentCurve.mpp.v, y: currentCurve.mpp.i }],
        borderColor: '#10b981', backgroundColor: '#10b981',
        pointRadius: 8, pointStyle: 'crossRot', showLine: false,
      });
      pvDatasets.push({
        label: `MPP Actual (${currentCurve.mpp.p.toFixed(0)} W)`,
        data: [{ x: currentCurve.mpp.v, y: currentCurve.mpp.p }],
        borderColor: '#10b981', backgroundColor: '#10b981',
        pointRadius: 8, pointStyle: 'crossRot', showLine: false,
      });
      
      // Plot Custom Working Point for Panel if available
      if (currentWPs['panel']) {
        const p = currentWPs['panel'];
        ivDatasets.push({
          label: `Punto de Trabajo (${p.i.toFixed(2)} A)`,
          data: [{ x: p.v, y: p.i }],
          borderColor: '#ef4444', backgroundColor: '#ef4444',
          pointRadius: 8, pointStyle: 'rectRot', showLine: false,
        });
        pvDatasets.push({
          label: `Punto de Trabajo (${p.p.toFixed(0)} W)`,
          data: [{ x: p.v, y: p.p }],
          borderColor: '#ef4444', backgroundColor: '#ef4444',
          pointRadius: 8, pointStyle: 'rectRot', showLine: false,
        });
      }
    }
  } else {
    // Per-group curves at current conditions
    groups.forEach((g, i) => {
      const nStr = g.numStrings || 1;
      const nPps = g.panelsPerString || 1;
      const groupParams = {
        ...basePanelParams,
        // Scale Voc/Vmp for series, Isc/Imp for parallel
        voc: panel.voc * nPps,
        vmp: panel.vmp * nPps,
        isc: panel.isc * nStr,
        imp: panel.imp * nStr,
        numCells: (panel.numCells || 144) * nPps,
        G: r.G_actual > 0 ? r.G_actual : 1000,
        tCell: r.tCell,
      };
      const curve = generateIVCurve(groupParams);

      ivDatasets.push({
        label: g.name,
        data: curve.voltages.map((v, j) => ({ x: v, y: curve.currents[j] })),
        borderColor: colors[i % colors.length],
        borderWidth: 2,
        fill: false, tension: 0.3, pointRadius: 0, showLine: true,
      });
      pvDatasets.push({
        label: g.name,
        data: curve.voltages.map((v, j) => ({ x: v, y: curve.powers[j] })),
        borderColor: colors[i % colors.length],
        borderWidth: 2,
        fill: false, tension: 0.3, pointRadius: 0, showLine: true,
      });

      // Mark MPP for each group
      ivDatasets.push({
        label: `MPP ${g.name}`,
        data: [{ x: curve.mpp.v, y: curve.mpp.i }],
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length],
        pointRadius: 7, pointStyle: 'crossRot', showLine: false,
      });
      pvDatasets.push({
        label: `MPP ${g.name}`,
        data: [{ x: curve.mpp.v, y: curve.mpp.p }],
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length],
        pointRadius: 7, pointStyle: 'crossRot', showLine: false,
      });
      // Plot Custom Working Point for this group if available
      if (currentWPs[g.id]) {
        const p = currentWPs[g.id];
        ivDatasets.push({
          label: `WP ${g.name} (${p.i.toFixed(2)} A)`,
          data: [{ x: p.v, y: p.i }],
          borderColor: '#ef4444', backgroundColor: '#ef4444',
          pointRadius: 8, pointStyle: 'rectRot', showLine: false,
        });
        pvDatasets.push({
          label: `WP ${g.name} (${(p.p/1000).toFixed(2)} kW)`,
          data: [{ x: p.v, y: p.p }],
          borderColor: '#ef4444', backgroundColor: '#ef4444',
          pointRadius: 8, pointStyle: 'rectRot', showLine: false,
        });
      }
    });
  }

  const scatterOpts = {
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: { type: 'linear', title: { text: 'Tensión (V)' }, min: 0 },
    }
  };

  setTimeout(() => {
    try {
      createChart('canvas-iv', {
        type: 'scatter',
        data: { datasets: ivDatasets },
        options: {
          ...scatterOpts,
          scales: {
            ...scatterOpts.scales,
            y: { type: 'linear', title: { text: 'Corriente (A)' }, min: 0 },
          },
          plugins: { title: { display: true, text: 'Curva I-V' } },
        },
      });
      createChart('canvas-pv', {
        type: 'scatter',
        data: { datasets: pvDatasets },
        options: {
          ...scatterOpts,
          scales: {
            ...scatterOpts.scales,
            y: { type: 'linear', title: { text: 'Potencia (W)' }, min: 0 },
          },
          plugins: { title: { display: true, text: 'Curva P-V' } },
        },
      });
    } catch (err) {
      canvasIV.parentElement.innerHTML = `<div style="color:red; padding:10px;">Error dibujando I-V: ${err.message}</div>`;
      console.error(err);
    }
  }, 60);
}

/**
 * Helper to compute intersection with IV curve
 */
function calculateWPForParams(params, targetVal, mode, isPanelMode) {
  if (!targetVal || targetVal <= 0) return null;
  const curve = generateIVCurve(params, 200);
  let foundV = null, foundI = null, foundP = null, status = '';

  if (mode === 'current') {
    const targetI = targetVal;
    if (targetI > curve.currents[0]) {
      status = '⚠️ I > Isc';
    } else {
      for (let j = 0; j < curve.currents.length - 1; j++) {
        if (curve.currents[j] >= targetI && curve.currents[j + 1] < targetI) {
          const ratio = (targetI - curve.currents[j + 1]) / (curve.currents[j] - curve.currents[j + 1]);
          foundV = curve.voltages[j + 1] + ratio * (curve.voltages[j] - curve.voltages[j + 1]);
          foundI = targetI;
          foundP = foundV * foundI;
          status = foundV <= curve.voc ? '✅ Ok' : '⚠️ Fuera rango';
          break;
        }
      }
      if (foundV === null) status = '⚠️ No hallado';
    }
  } else {
    const targetP = isPanelMode ? targetVal : targetVal * 1000;
    const maxP = curve.mpp.p;
    if (targetP > maxP * 1.05) {
      status = `⚠️ P > Pmax`;
    } else {
      const mppIdx = curve.powers.indexOf(Math.max(...curve.powers));
      // Right side
      for (let j = mppIdx; j < curve.powers.length - 1; j++) {
        if (curve.powers[j] >= targetP && curve.powers[j + 1] < targetP) {
          const ratio = (targetP - curve.powers[j + 1]) / (curve.powers[j] - curve.powers[j + 1]);
          foundV = curve.voltages[j + 1] + ratio * (curve.voltages[j] - curve.voltages[j + 1]);
          foundI = targetP / foundV;
          foundP = targetP;
          status = '✅ Ok (Der)';
          break;
        }
      }
      // Left side
      if (foundV === null) {
        for (let j = 0; j < mppIdx; j++) {
          if (curve.powers[j] <= targetP && curve.powers[j + 1] > targetP) {
            const ratio = (targetP - curve.powers[j]) / (curve.powers[j + 1] - curve.powers[j]);
            foundV = curve.voltages[j] + ratio * (curve.voltages[j + 1] - curve.voltages[j]);
            foundI = targetP / foundV;
            foundP = targetP;
            status = '✅ Ok (Izq)';
            break;
          }
        }
      }
      if (foundV === null) status = '⚠️ No hallado';
    }
  }
  if (status && status.includes('Ok')) status = '';
  return { v: foundV, i: foundI, p: foundP, status, maxP: curve.mpp.p };
}

/**
 * Render work point calculator result
 */
function renderWorkPoint(r) {
  const isPanelMode = ivViewMode === 'panel';
  const panel = state.get('panelSpecs');
  const arr = state.get('arrayConfig');
  const groups = arr.groups || [];

  if (isPanelMode) {
    const pContainer = document.getElementById('wp-result-panel');
    if (!pContainer) return;
    if (!wpValuePanel || wpValuePanel <= 0) {
      currentWPs['panel'] = null;
      pContainer.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-tertiary); font-size:0.85rem;">Introduce un valor para calcular el punto de trabajo.</div>';
      return;
    }
    
    const baseParams = {
      voc: panel.voc, vmp: panel.vmp, isc: panel.isc, imp: panel.imp,
      numCells: panel.numCells || 144, tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
      G: r.G_actual > 0 ? r.G_actual : 1000, tCell: r.tCell,
    };
    
    const res = calculateWPForParams(baseParams, wpValuePanel, wpMode, true);
    if (res && res.v !== null) {
      currentWPs['panel'] = { v: res.v, i: res.i, p: res.p };
      pContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:var(--space-sm); margin-bottom:var(--space-sm);">
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tensión Teórica</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-purple);">${res.v.toFixed(1)} <span style="font-size:0.7rem;">V</span></div>
          </div>
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Corriente</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-pink);">${res.i.toFixed(2)} <span style="font-size:0.7rem;">A</span></div>
          </div>
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Potencia</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-green);">${res.p.toFixed(0)} <span style="font-size:0.7rem;">W</span></div>
          </div>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${res.status}</div>
      `;
    } else {
      currentWPs['panel'] = null;
      pContainer.innerHTML = `<div style="padding:var(--space-sm); color:var(--solar-red); font-size:0.85rem;">${res ? res.status : 'Introduce valor válido'}</div>`;
    }
  } else {
    // Group Mode
    groups.forEach(g => {
      const nStr = g.numStrings || 1;
      const nPps = g.panelsPerString || 1;
      const groupParams = {
        voc: panel.voc * nPps, vmp: panel.vmp * nPps,
        isc: panel.isc * nStr, imp: panel.imp * nStr,
        numCells: (panel.numCells || 144) * nPps,
        tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
        G: r.G_actual > 0 ? r.G_actual : 1000, tCell: r.tCell,
      };

      const val = wpValues[g.id] || 0;
      const res = calculateWPForParams(groupParams, val, wpMode, false);
      const cellV = document.getElementById(`wp-res-v-${g.id}`);
      const cellI = document.getElementById(`wp-res-i-${g.id}`);
      const cellP = document.getElementById(`wp-res-p-${g.id}`);
      
      if (!cellV || !cellI || !cellP) return;

      if (res && res.v !== null) {
        currentWPs[g.id] = { v: res.v, i: res.i, p: res.p };
        cellV.innerHTML = `${res.v.toFixed(1)} V`;
        cellI.innerHTML = `${res.i.toFixed(1)} A`;
        cellP.innerHTML = `${(res.p/1000).toFixed(2)} kW`;
        cellV.title = res.status;
      } else {
        currentWPs[g.id] = null;
        cellV.innerHTML = val > 0 ? `<span style="color:var(--solar-red); font-size:0.7rem;">${res ? res.status : 'Error'}</span>` : '-';
        cellI.innerHTML = '-';
        cellP.innerHTML = '-';
        cellV.title = '';
      }
    });
  }
}
