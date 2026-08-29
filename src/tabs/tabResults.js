/**
 * AppSolar — Tab: Resumen y Simulación Dinámica (Unificado)
 * Análisis integral del parque solar: balances eléctricos, curvas I-V/P-V,
 * simulación paramétrica temporal, pérdidas de cableado y condiciones ambientales.
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';
import { getVoltageDropStatus, calculateCableResistance } from '../engine/cableLoss.js';
import { createChart, CHART_COLORS, CURVE_PALETTE } from '../charts/chartManager.js';
import {
  generateIVCurve,
  generateIVCurveFamily_Irradiance,
  generateIVCurveFamily_Temperature
} from '../engine/ivCurve.js';

const SLIDERS = [
  { key: 'irradiance', label: 'Irradiancia Pico (Mediodía)', unit: 'W/m²', min: 0, max: 1400, step: 10 },
  { key: 'ambientTemp', label: 'Tª Ambiente Pico', unit: '°C', min: -20, max: 55, step: 1 },
  { key: 'windSpeed', label: 'Viento', unit: 'm/s', min: 0, max: 30, step: 0.5 },
  { key: 'humidity', label: 'Humedad', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'albedo', label: 'Albedo', unit: '', min: 0, max: 1, step: 0.05 },
];

let currentViewParam = 'chart'; // 'chart' | 'table'
let currentParamVar = 'hour'; // 'hour' | 'day' | 'month'
let activeTopTab = 'top-sim-moment'; // 'top-sim-moment' | 'top-peak-cond' | 'top-scenarios'
let activeResTab = 'res-summary-levels'; // 'res-summary-levels' | 'res-iv' | 'res-parametric' | 'res-cable-loss' | 'res-datasheet-plant'
let showMaxLines = false;
let groupTooltips = true;
let ivViewMode = 'panel'; // 'panel' | 'string' | 'groups' | 'total'
let ivSelectedGroup = 'all'; // 'all' | groupId
let ivFamilyMode = 'irradiance'; // 'irradiance' | 'temperature' | 'current'
let ivLayoutMode = 'split'; // 'split' | 'combined'
let wpMode = 'power'; // 'power' | 'current'
let wpValuePanel = 0;
let wpValueString = 0;
let wpValueTotal = 0;
let wpValues = {}; // group.id -> value
let currentWPs = {}; // group.id -> {v, i, p} OR 'panel' | 'string' | 'total'

export function render() {
  const r = calculateAll();
  const arr = state.get('arrayConfig') || {};
  const cond = state.get('conditions') || {};
  const panel = state.get('panelSpecs') || {};
  const loc = state.get('location') || {};
  const savedScenarios = state.get('savedScenarios') || [];
  const vdStatus = getVoltageDropStatus(r.vdPercent);

  const rawGroups = arr.groups || [];
  const groups = rawGroups.length > 0 ? rawGroups : [{ id: 'g1', name: 'Grupo 1', numStrings: 1, panelsPerString: 12 }];
  const totalPanels = r.totalPanels || groups.reduce((sum, g) => sum + ((g.numStrings || 1) * (g.panelsPerString || 1)), 0);
  const totalStrings = groups.reduce((sum, g) => sum + (g.numStrings || 1), 0);

  // System alerts
  const alerts = [];
  if (r.vdPercent > 3) alerts.push({ type: 'danger', msg: `⚠️ Caída de tensión excesiva: ${r.vdPercent.toFixed(1)}% (máx. recomendado: 2%)` });
  if (r.tCell > 70) alerts.push({ type: 'warning', msg: `🌡️ Temperatura de celda muy alta: ${r.tCell.toFixed(1)}°C` });
  if (r.thermalLoss > 15) alerts.push({ type: 'warning', msg: `📉 Pérdidas térmicas elevadas: ${r.thermalLoss.toFixed(1)}%` });
  if (r.fillFactor < 0.65) alerts.push({ type: 'warning', msg: `📊 Fill Factor bajo: ${(r.fillFactor * 100).toFixed(1)}%` });
  if (r.pr_estimated < 0.7) alerts.push({ type: 'warning', msg: `📈 Performance Ratio bajo: ${(r.pr_estimated * 100).toFixed(1)}%` });

  const repGroup = groups[0] || { numStrings: 1, panelsPerString: 12, name: 'Grupo 1' };
  const ppsRep = repGroup.panelsPerString || 1;

  // Compute detailed cable losses per string and group
  const cableBreakdown = groups.map(g => {
    const cLen = g.cableLength !== undefined ? g.cableLength : (cond.cableLength || 50);
    const cSec = g.cableSection !== undefined ? g.cableSection : (cond.cableSection || 6);
    const cMat = g.cableMaterial !== undefined ? g.cableMaterial : (cond.cableMaterial || 'cu');
    const nStr = g.numStrings || 1;
    const nPps = g.panelsPerString || 1;

    const rString = calculateCableResistance(cLen, cSec, cMat);
    const strVd = r.imp_adj * rString;
    const strVmp = r.vmp_adj * nPps;
    const strVdPct = strVmp > 0 ? (strVd / strVmp) * 100 : 0;
    const strPowerLoss = r.imp_adj * r.imp_adj * rString;
    const strTotalPowerLoss = strPowerLoss * nStr;

    const grpVmp = strVmp;
    const grpImp = r.imp_adj * nStr;
    const grpData = (r.groupsData || []).find(gx => gx.id === g.id);
    const pmaxArray = grpData ? grpData.pmax_array : (r.pmax_adj * nStr * nPps);
    const grpVd = g.groupVoltageDrop !== undefined ? g.groupVoltageDrop : (grpImp * rString);
    const grpVdPct = g.groupVdPercent !== undefined ? g.groupVdPercent : (grpVmp > 0 ? (grpVd / grpVmp) * 100 : 0);
    const grpPowerLoss = g.groupCablePowerLoss !== undefined ? g.groupCablePowerLoss : (grpImp * grpImp * rString);
    const status = getVoltageDropStatus(grpVdPct);

    return {
      group: g,
      cLen,
      cSec,
      cMat,
      nStr,
      nPps,
      rString,
      strVd,
      strVdPct,
      strPowerLoss,
      strTotalPowerLoss,
      grpVmp,
      grpImp,
      grpVd,
      grpVdPct,
      grpPowerLoss,
      pmaxArray,
      status
    };
  });

  const totalCablePowerLoss = cableBreakdown.reduce((sum, cb) => sum + cb.grpPowerLoss, 0);
  const totalCableLossPct = r.pmax_total_system > 0 ? (totalCablePowerLoss / r.pmax_total_system) * 100 : 0;

  // Cell Temperature Tooltip details
  const cellTempCfg = state.get('cellTemp') || { method: 'noct' };
  const method = cellTempCfg.method || 'noct';
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
        <h2><span class="icon">📊</span> Resumen y Simulación Dinámica</h2>
        <p class="page-subtitle">Análisis integral del parque solar: balances eléctricos, curvas I-V/P-V, simulación paramétrica y pérdidas de cableado.</p>
      </div>
    </div>

    <!-- SECCIÓN INTEGRADA SUPERIOR: CONDICIONES, MOMENTO, ESCENARIOS Y PUNTO DE TRABAJO -->
    <div class="card mb-md" style="border-top: 3px solid var(--solar-amber); background: linear-gradient(145deg, var(--bg-card), var(--bg-tertiary)); padding: 12px 16px;">
      
      <!-- Mini Tabs Header Superior (2 pestañas limpias) -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom: 1px solid var(--border-primary); padding-bottom: 8px; margin-bottom: 12px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn btn-sm top-section-tab-btn ${activeTopTab === 'top-sim-moment' ? 'btn-primary' : 'btn-ghost'}" data-top-target="top-sim-moment" style="font-size:0.8rem; padding:4px 14px;">
            ⏱️ Momento de Simulación
          </button>
          <button type="button" class="btn btn-sm top-section-tab-btn ${activeTopTab === 'top-peak-scenarios' ? 'btn-primary' : 'btn-ghost'}" data-top-target="top-peak-scenarios" style="font-size:0.8rem; padding:4px 14px;">
            ☀️ Condiciones Ambientales Pico y Escenarios
          </button>
        </div>

        <div style="font-size:0.75rem; color:var(--text-tertiary); display:flex; align-items:center; gap:8px;">
          <span>Escenario Activo: <strong style="color:var(--text-primary);">${state.get('loadedScenario') || 'Personalizado'}</strong></span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-export-html" title="Exportar reporte completo a HTML" style="height:26px; font-size:0.75rem; padding:0 8px; border:1px solid var(--border-primary);">📄 HTML</button>
        </div>
      </div>

      <!-- Contenido de las Pestañas Superiores -->
      <div style="margin-bottom: 12px;">
        
        <!-- PESTAÑA SUPERIOR 1: MOMENTO DE SIMULACIÓN -->
        <div id="top-sim-moment" class="top-section-tab-content" style="display:${activeTopTab === 'top-sim-moment' ? 'block' : 'none'};">
          <div style="display:grid; grid-template-columns: auto 1fr; gap:16px; align-items:center; flex-wrap:wrap;">
            
            <!-- Modo de Simulación Toggle -->
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; font-weight:600;">Modo Temporal:</div>
              <div class="sim-mode-toggle" style="display:flex; border:1px solid var(--border-primary); border-radius:var(--radius-md); overflow:hidden;">
                <input type="radio" id="sm-dyn" name="simMode" value="dynamic" ${cond.simMode === 'dynamic' || !cond.simMode ? 'checked' : ''} style="display:none;">
                <label for="sm-dyn" class="btn btn-sm" style="border-radius:0; border:none; padding:4px 10px; font-size:0.75rem; cursor:pointer; ${cond.simMode === 'dynamic' || !cond.simMode ? 'background:var(--solar-blue); color:white;' : 'background:transparent; color:var(--text-secondary);'}">📅 Dinámico</label>
                
                <input type="radio" id="sm-time" name="simMode" value="timeOnly" ${cond.simMode === 'timeOnly' ? 'checked' : ''} style="display:none;">
                <label for="sm-time" class="btn btn-sm" style="border-radius:0; border:none; padding:4px 10px; font-size:0.75rem; cursor:pointer; border-left:1px solid var(--border-primary); border-right:1px solid var(--border-primary); ${cond.simMode === 'timeOnly' ? 'background:var(--solar-blue); color:white;' : 'background:transparent; color:var(--text-secondary);'}">🕒 Solo Día</label>
                
                <input type="radio" id="sm-max" name="simMode" value="fixedMax" ${cond.simMode === 'fixedMax' ? 'checked' : ''} style="display:none;">
                <label for="sm-max" class="btn btn-sm" style="border-radius:0; border:none; padding:4px 10px; font-size:0.75rem; cursor:pointer; ${cond.simMode === 'fixedMax' ? 'background:var(--solar-blue); color:white;' : 'background:transparent; color:var(--text-secondary);'}">📌 Fijos</label>
              </div>
            </div>

            <!-- Sliders y Selectores de Fecha y Hora -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
              
              <div class="slider-group" style="margin-bottom:0; ${cond.simMode === 'timeOnly' || cond.simMode === 'fixedMax' ? 'opacity:0.4; pointer-events:none;' : ''}">
                <div class="slider-header" style="font-size:0.75rem;">
                  <span class="slider-label">Mes</span>
                  <select id="res-select-month" class="form-select form-select-sm" style="width:110px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
                </div>
                <input type="range" id="res-slider-month" min="1" max="12" step="1" style="height:4px; accent-color:var(--solar-blue);">
              </div>

              <div class="slider-group" style="margin-bottom:0; ${cond.simMode === 'timeOnly' || cond.simMode === 'fixedMax' ? 'opacity:0.4; pointer-events:none;' : ''}">
                <div class="slider-header" style="font-size:0.75rem;">
                  <span class="slider-label">Día</span>
                  <div style="display:flex; align-items:center; gap:2px;">
                    <select id="res-select-daym" class="form-select form-select-sm" style="width:55px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
                    <button type="button" class="btn btn-ghost btn-sm" id="btn-set-today" title="Ir a la fecha actual" style="padding:0 4px; height:24px; font-size:11px; line-height:1;">📅</button>
                  </div>
                </div>
                <input type="range" id="res-slider-daym" min="1" max="31" step="1" style="height:4px; accent-color:var(--solar-blue);">
              </div>

              <div class="slider-group" style="margin-bottom:0; ${cond.simMode === 'fixedMax' ? 'opacity:0.4; pointer-events:none;' : ''}">
                <div class="slider-header" style="font-size:0.75rem;">
                  <span class="slider-label">Hora del Día</span>
                  <div style="display:flex; align-items:center; gap:3px;">
                    <select id="res-select-hour" class="form-select form-select-sm" style="width:75px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
                    <button type="button" class="btn btn-ghost btn-sm" id="btn-set-now" title="Ir a la hora actual" style="padding:0 4px; height:24px; font-size:11px; line-height:1;">⏱️</button>
                  </div>
                </div>
                <input type="range" id="res-slider-hour" min="0" max="23.5" step="0.5" style="height:4px; accent-color:var(--solar-amber);">
              </div>

            </div>

          </div>
        </div>

        <!-- PESTAÑA SUPERIOR 2: CONDICIONES AMBIENTALES PICO Y GESTIÓN DE ESCENARIOS (REFUNDIDAS) -->
        <div id="top-peak-scenarios" class="top-section-tab-content" style="display:${activeTopTab === 'top-peak-scenarios' ? 'block' : 'none'};">
          <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap: 14px; align-items: stretch;">
            
            <!-- Columna Izquierda: Sliders de Condiciones Pico -->
            <div style="background:rgba(0,0,0,0.12); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-primary); display:flex; flex-direction:column; justify-content:space-between;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--solar-amber); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <span>☀️ Parámetros Ambientales Pico (Mediodía)</span>
                <span style="font-size:0.65rem; color:var(--text-tertiary);">Ajustan máximos de la curva</span>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
                ${SLIDERS.map(s => `
                  <div class="form-group" style="margin-bottom:0;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-secondary); margin-bottom:2px;">
                      <span>${s.label.replace(' (Mediodía)', '')}</span>
                      <span class="unit" style="font-size:0.65rem; color:var(--text-tertiary);">[${s.unit}]</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <input type="range" id="res-slider-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${cond[s.key] ?? s.min}" style="flex:1; height:4px;">
                      <input type="number" class="form-input mono" id="res-input-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${cond[s.key] ?? s.min}" style="width:56px; padding:1px 3px; height:22px; font-size:0.75rem;">
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Columna Derecha: Selector y Gestión de Escenarios -->
            <div style="background:rgba(0,0,0,0.12); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-primary); display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--solar-green); margin-bottom:2px;">
                💾 Gestión y Carga de Escenarios
              </div>
              <div>
                <label style="font-size:0.7rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Cargar plantilla o escenario guardado:</label>
                <select class="form-select form-select-sm" id="res-scenario-select" style="width:100%; height:30px; padding:2px 24px 2px 8px; font-size:0.8rem;">
                  <option value="">-- Seleccionar Escenario --</option>
                  <option value="stc">☀️ STC Estándar (1000 W/m², 25°C, 1 m/s)</option>
                  <option value="summer">☀️ Verano Caluroso (1100 W/m², 40°C, 2 m/s)</option>
                  <option value="winter">❄️ Invierno Frío (400 W/m², 5°C, 4 m/s)</option>
                  <option value="cloudy">☁️ Día Nublado (200 W/m², 20°C, 3 m/s)</option>
                  <optgroup label="Mis Escenarios Guardados" id="optgroup-saved-scenarios">
                    ${savedScenarios.map(sc => `<option value="${sc.id}">${sc.name}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
              <div style="display:flex; gap:6px; margin-top:2px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-save-scenario" title="Guardar condiciones actuales como nuevo escenario" style="flex:1; height:28px; font-size:0.75rem; padding:2px 6px;">💾 Guardar Actual</button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-delete-scenario" style="color:var(--solar-red); border-color:var(--solar-red); height:28px; font-size:0.75rem; padding:2px 8px;" title="Borrar Escenario Seleccionado" disabled>🗑️</button>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- PARTE INFERIOR DE LA SECCIÓN SUPERIOR: ETIQUETAS DE DATOS / PUNTO DE TRABAJO ACTUAL -->
      <div style="border-top: 1px solid var(--border-primary); padding-top: 10px;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <span>📍 Punto de Trabajo Actual en Condiciones de Simulación</span>
          <span style="font-size:0.7rem; font-weight:normal; color:var(--text-tertiary);">Sol: Elev ${r.sunElevation !== undefined ? r.sunElevation.toFixed(1) + '°' : '—'}, Az ${r.sunAzimuth !== undefined ? r.sunAzimuth.toFixed(1) + '°' : '—'}</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px;">
          
          <div style="background:rgba(0,0,0,0.18); padding:6px 10px; border-radius:var(--radius-md); border:1px solid var(--border-primary); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.65rem; color:var(--text-secondary); display:flex; align-items:center; gap:3px;">
                ☀️ Irradiancia (G)
                <span class="tooltip-trigger" style="cursor:help; font-size:10px;" data-tooltip="Fórmula: G_Pico × Factor_Horario × Cos(Ángulo_Incidencia).&#10;G_Pico = ${cond.irradiance} W/m² -> G_Simulada = ${r.G_actual.toFixed(1)} W/m²">ℹ️</span>
              </div>
              <div class="mono font-bold" style="font-size:1.1rem; color:var(--solar-amber); line-height:1.1;">${r.G_actual.toFixed(0)} <span style="font-size:0.7rem;">W/m²</span></div>
            </div>
            <span style="font-size:1.2rem; opacity:0.8;">☀️</span>
          </div>

          <div style="background:rgba(0,0,0,0.18); padding:6px 10px; border-radius:var(--radius-md); border:1px solid var(--border-primary); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.65rem; color:var(--text-secondary); display:flex; align-items:center; gap:3px;">
                🌡️ T. Celda (Pérd: ${r.thermalLoss.toFixed(1)}%)
                <span class="tooltip-trigger" style="cursor:help; font-size:10px;" data-tooltip="${tCellTooltip}">ℹ️</span>
              </div>
              <div class="mono font-bold" style="font-size:1.1rem; color:var(--solar-red); line-height:1.1;">${r.tCell.toFixed(1)} <span style="font-size:0.7rem;">°C</span> <span style="font-size:0.65rem; color:var(--text-tertiary);">(Amb: ${r.tAmb_actual.toFixed(1)}°C)</span></div>
            </div>
            <span style="font-size:1.2rem; opacity:0.8;">🔥</span>
          </div>

          <div style="background:rgba(0,0,0,0.18); padding:6px 10px; border-radius:var(--radius-md); border:1px solid var(--border-primary); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">⚡ Potencia Parque</div>
              <div class="mono font-bold" style="font-size:1.1rem; color:var(--solar-green); line-height:1.1;">${(r.pmax_total_system/1000).toFixed(2)} <span style="font-size:0.7rem;">kW</span> <span style="font-size:0.65rem; color:var(--text-tertiary);">(${((totalPanels * (panel.pmax || 0))/1000).toFixed(1)} kWp)</span></div>
            </div>
            <span style="font-size:1.2rem; opacity:0.8;">⚡</span>
          </div>

          <div style="background:rgba(0,0,0,0.18); padding:6px 10px; border-radius:var(--radius-md); border:1px solid var(--border-primary); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">🔌 Caída Tensión DC</div>
              <div class="mono font-bold" style="font-size:1.1rem; color:var(--solar-${vdStatus.color}); line-height:1.1;">${r.vdPercent.toFixed(2)}% <span style="font-size:0.65rem; color:var(--text-tertiary);">(${vdStatus.message})</span></div>
            </div>
            <span style="font-size:1.2rem; opacity:0.8;">🔌</span>
          </div>

          <div style="background:rgba(0,0,0,0.18); padding:6px 10px; border-radius:var(--radius-md); border:1px solid var(--border-primary); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">📈 Performance Ratio</div>
              <div class="mono font-bold" style="font-size:1.1rem; color:var(--solar-blue); line-height:1.1;">${(r.pr_estimated*100).toFixed(1)}% <span style="font-size:0.65rem; color:var(--text-tertiary);">(Est.)</span></div>
            </div>
            <span style="font-size:1.2rem; opacity:0.8;">📊</span>
          </div>

        </div>
      </div>

    </div>

    <!-- PESTAÑAS PRINCIPALES -->
    <div class="tabs-header mb-md" style="display:flex; gap:8px; border-bottom:1px solid var(--border-primary); padding-bottom:4px; flex-wrap:wrap;">
      <button type="button" class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-summary-levels' ? 'active' : ''}" data-target="res-summary-levels" style="border-radius:0; ${activeResTab === 'res-summary-levels' ? 'border-bottom:2px solid var(--solar-amber); font-weight:700;' : ''}">
        📋 Resumen Eléctrico
      </button>
      <button type="button" class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-iv' ? 'active' : ''}" data-target="res-iv" style="border-radius:0; ${activeResTab === 'res-iv' ? 'border-bottom:2px solid var(--solar-amber); font-weight:700;' : ''}">
        📐 Curvas I-V y P-V
      </button>
      <button type="button" class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-parametric' ? 'active' : ''}" data-target="res-parametric" style="border-radius:0; ${activeResTab === 'res-parametric' ? 'border-bottom:2px solid var(--solar-amber); font-weight:700;' : ''}">
        📈 Simulación Paramétrica Temporal
      </button>
      <button type="button" class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-cable-loss' ? 'active' : ''}" data-target="res-cable-loss" style="border-radius:0; ${activeResTab === 'res-cable-loss' ? 'border-bottom:2px solid var(--solar-amber); font-weight:700;' : ''}">
        🔌 Pérdidas de Cableado
      </button>
      <button type="button" class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-datasheet-plant' ? 'active' : ''}" data-target="res-datasheet-plant" style="border-radius:0; ${activeResTab === 'res-datasheet-plant' ? 'border-bottom:2px solid var(--solar-amber); font-weight:700;' : ''}">
        🏢 Ficha Técnica y Planta
      </button>
    </div>

    <!-- CONTENIDO DE LAS PESTAÑAS -->
    <div class="tabs-content" style="min-height: 420px;">

      <!-- PESTAÑA 1: RESUMEN Y DESGLOSE ELÉCTRICO -->
      <div id="res-summary-levels" class="results-res-tab-content" style="display:${activeResTab === 'res-summary-levels' ? 'block' : 'none'};">
        
        <!-- Tabla Comparativa de Niveles Eléctricos -->
        <div class="card mb-lg" style="border-left:4px solid var(--solar-amber);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
            <h3 style="font-size:var(--text-base); margin:0; display:flex; align-items:center; gap:8px;">
              <span>⚡ Desglose de Valores Eléctricos por Nivel</span>
              <span class="tooltip-trigger" style="cursor:help; font-size:12px;" data-tooltip="Comparativa detallada de parámetros STC y en condiciones actuales de operación (G = ${r.G_actual.toFixed(0)} W/m², T.Celda = ${r.tCell.toFixed(1)}°C) desde 1 Panel individual hasta el Total Parque.">ℹ️</span>
            </h3>
            <span class="badge" style="background:rgba(245,158,11,0.15); color:var(--solar-amber); border:1px solid var(--solar-amber); font-size:0.75rem;">
              Operación Actual: ${r.G_actual.toFixed(0)} W/m² | ${r.tCell.toFixed(1)}°C
            </span>
          </div>

          <div style="overflow-x:auto;">
            <table class="data-table" style="font-size:0.85rem;">
              <thead>
                <tr>
                  <th style="min-width:180px;">Parámetro Eléctrico</th>
                  <th class="text-center" style="color:var(--solar-blue);">☀️ 1 Panel Solar</th>
                  <th class="text-center" style="color:var(--solar-purple);">🧵 1 String (${ppsRep} Paneles)</th>
                  ${groups.map(g => `<th class="text-center" style="color:var(--solar-amber);">📦 ${g.name} (${g.numStrings} Str × ${g.panelsPerString} P)</th>`).join('')}
                  <th class="text-center" style="color:var(--solar-green); font-weight:700;">🏭 TOTAL PARQUE (${totalPanels} P)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Potencia Pico (STC)</strong></td>
                  <td class="mono text-center font-bold" style="color:var(--solar-blue);">${panel.pmax || 0} Wp</td>
                  <td class="mono text-center font-bold" style="color:var(--solar-purple);">${((panel.pmax * ppsRep)/1000).toFixed(2)} kWp</td>
                  ${groups.map(g => `<td class="mono text-center font-bold" style="color:var(--solar-amber);">${((g.numStrings * g.panelsPerString * panel.pmax)/1000).toFixed(2)} kWp</td>`).join('')}
                  <td class="mono text-center font-bold" style="color:var(--solar-green); font-size:0.95rem;">${((totalPanels * panel.pmax)/1000).toFixed(2)} kWp</td>
                </tr>
                <tr>
                  <td><strong>Potencia Operación (Est.)</strong></td>
                  <td class="mono text-center">${r.pmax_adj.toFixed(1)} W</td>
                  <td class="mono text-center">${(r.pmax_adj * ppsRep / 1000).toFixed(2)} kW</td>
                  ${cableBreakdown.map(cb => `<td class="mono text-center">${(cb.pmaxArray/1000).toFixed(2)} kW</td>`).join('')}
                  <td class="mono text-center" style="font-weight:700; color:var(--solar-green);">${(r.pmax_total_system/1000).toFixed(2)} kW</td>
                </tr>
                <tr>
                  <td><strong>Potencia Neta (DC Cableada)</strong></td>
                  <td class="mono text-center text-muted">—</td>
                  <td class="mono text-center text-muted">—</td>
                  ${cableBreakdown.map(cb => `<td class="mono text-center">${((cb.pmaxArray - cb.grpPowerLoss)/1000).toFixed(2)} kW</td>`).join('')}
                  <td class="mono text-center font-bold" style="color:var(--solar-green);">${(r.pmax_net/1000).toFixed(2)} kW</td>
                </tr>
                <tr style="background:rgba(0,0,0,0.02);">
                  <td><strong>Tensión Voc (STC / Op.)</strong></td>
                  <td class="mono text-center">${panel.voc || 0} V / <span style="color:var(--solar-purple);">${r.voc_adj.toFixed(1)} V</span></td>
                  <td class="mono text-center">${((panel.voc || 0) * ppsRep).toFixed(1)} V / <span style="color:var(--solar-purple);">${(r.voc_adj * ppsRep).toFixed(1)} V</span></td>
                  ${groups.map(g => `<td class="mono text-center">${((panel.voc || 0) * g.panelsPerString).toFixed(1)} V / <span style="color:var(--solar-purple);">${(r.voc_adj * g.panelsPerString).toFixed(1)} V</span></td>`).join('')}
                  <td class="mono text-center font-bold">${r.voc_stc_total.toFixed(1)} V (Prom) / <span style="color:var(--solar-purple);">${r.vmp_avg_system.toFixed(1)} V</span></td>
                </tr>
                <tr>
                  <td><strong>Tensión Vmp (STC / Op.)</strong></td>
                  <td class="mono text-center">${panel.vmp || 0} V / <span style="color:var(--solar-purple);">${r.vmp_adj.toFixed(1)} V</span></td>
                  <td class="mono text-center">${((panel.vmp || 0) * ppsRep).toFixed(1)} V / <span style="color:var(--solar-purple);">${(r.vmp_adj * ppsRep).toFixed(1)} V</span></td>
                  ${groups.map(g => `<td class="mono text-center">${((panel.vmp || 0) * g.panelsPerString).toFixed(1)} V / <span style="color:var(--solar-purple);">${(r.vmp_adj * g.panelsPerString).toFixed(1)} V</span></td>`).join('')}
                  <td class="mono text-center font-bold">${r.vmp_avg_system.toFixed(1)} V (Prom)</td>
                </tr>
                <tr style="background:rgba(0,0,0,0.02);">
                  <td><strong>Corriente Isc (STC / Op.)</strong></td>
                  <td class="mono text-center">${panel.isc || 0} A / <span style="color:var(--solar-pink);">${r.isc_adj.toFixed(2)} A</span></td>
                  <td class="mono text-center">${panel.isc || 0} A / <span style="color:var(--solar-pink);">${r.isc_adj.toFixed(2)} A</span></td>
                  ${groups.map(g => `<td class="mono text-center">${((panel.isc || 0) * g.numStrings).toFixed(1)} A / <span style="color:var(--solar-pink);">${(r.isc_adj * g.numStrings).toFixed(1)} A</span></td>`).join('')}
                  <td class="mono text-center font-bold" style="color:var(--solar-pink);">${r.isc_stc_total.toFixed(1)} A / ${r.imp_total_system.toFixed(1)} A</td>
                </tr>
                <tr>
                  <td><strong>Corriente Imp (STC / Op.)</strong></td>
                  <td class="mono text-center">${panel.imp || 0} A / <span style="color:var(--solar-pink);">${r.imp_adj.toFixed(2)} A</span></td>
                  <td class="mono text-center">${panel.imp || 0} A / <span style="color:var(--solar-pink);">${r.imp_adj.toFixed(2)} A</span></td>
                  ${groups.map(g => `<td class="mono text-center">${((panel.imp || 0) * g.numStrings).toFixed(1)} A / <span style="color:var(--solar-pink);">${(r.imp_adj * g.numStrings).toFixed(1)} A</span></td>`).join('')}
                  <td class="mono text-center font-bold" style="color:var(--solar-pink);">${r.imp_total_system.toFixed(1)} A</td>
                </tr>
                <tr style="background:rgba(0,0,0,0.02);">
                  <td><strong>Nº Paneles / Configuración</strong></td>
                  <td class="mono text-center">1 panel</td>
                  <td class="mono text-center">${ppsRep} serie</td>
                  ${groups.map(g => `<td class="mono text-center">${g.numStrings * g.panelsPerString} pan. (${g.numStrings}P × ${g.panelsPerString}S)</td>`).join('')}
                  <td class="mono text-center font-bold">${totalPanels} paneles (${totalStrings} strings)</td>
                </tr>
                <tr>
                  <td><strong>Eficiencia / Fill Factor</strong></td>
                  <td class="mono text-center">${panel.efficiency || 0}% / ${(r.fillFactor*100).toFixed(1)}%</td>
                  <td class="mono text-center">${r.panelEffReal.toFixed(1)}% / ${(r.fillFactor*100).toFixed(1)}%</td>
                  ${groups.map(() => `<td class="mono text-center">${r.panelEffReal.toFixed(1)}% / ${(r.fillFactor*100).toFixed(1)}%</td>`).join('')}
                  <td class="mono text-center font-bold" style="color:var(--solar-green);">PR: ${(r.pr_estimated*100).toFixed(1)}% | FF: ${(r.fillFactor*100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tabla Rápida por Grupos -->
        <div class="card mb-lg">
          <h3 style="font-size:var(--text-base); margin-bottom:var(--space-md);"><span class="icon">📦</span> Resumen de Grupos / Inversores</h3>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Grupo / Inversor</th>
                  <th>Potencia Est. (kW)</th>
                  <th>Potencia Máx STC (kW)</th>
                  <th>Tensión Vmp (V)</th>
                  <th>Voc Máx (V)</th>
                  <th>Corriente Imp (A)</th>
                  <th>Isc Máx (A)</th>
                </tr>
              </thead>
              <tbody>
                ${(r.groupsData || []).map(g => `
                  <tr>
                    <td><strong>${g.name}</strong></td>
                    <td class="mono font-bold" style="color:var(--solar-green);">${(g.pmax_array/1000).toFixed(2)}</td>
                    <td class="mono text-muted">${(g.pmax_stc_array/1000).toFixed(2)}</td>
                    <td class="mono">${g.vmp_array.toFixed(1)}</td>
                    <td class="mono text-muted">${g.voc_stc_array.toFixed(1)}</td>
                    <td class="mono">${g.imp_array.toFixed(1)}</td>
                    <td class="mono text-muted">${g.isc_stc_array.toFixed(1)}</td>
                  </tr>
                `).join('')}
                <tr style="border-top:2px solid var(--border-primary); background:rgba(16,185,129,0.05);">
                  <td><strong>TOTAL PARQUE</strong></td>
                  <td class="mono font-bold" style="color:var(--solar-green); font-size:1rem;">${(r.pmax_total_system/1000).toFixed(2)}</td>
                  <td class="mono text-muted">${(r.pmax_stc_total/1000).toFixed(2)}</td>
                  <td class="mono font-bold">${r.vmp_avg_system.toFixed(1)} (Prom.)</td>
                  <td class="mono text-muted">${r.voc_stc_total.toFixed(1)} (Prom.)</td>
                  <td class="mono font-bold">${r.imp_total_system.toFixed(1)}</td>
                  <td class="mono text-muted">${r.isc_stc_total.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Alertas Operativas -->
        <div class="mt-md">
          ${alerts.length > 0 ? alerts.map(a => `<div class="alert alert-${a.type} mb-sm"><span>${a.msg}</span></div>`).join('') : `<div class="alert alert-success"><span>✅ Todos los parámetros operativos están dentro de los rangos recomendados por normativa.</span></div>`}
        </div>

      </div>

      <!-- PESTAÑA 2: CURVAS I-V Y P-V -->
      <div id="res-iv" class="results-res-tab-content" style="display:${activeResTab === 'res-iv' ? 'block' : 'none'};">
        <div class="card mb-lg" style="border-left:4px solid var(--solar-purple);">
          
          <!-- Controles de Curvas I-V / P-V -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:12px; background:var(--bg-tertiary); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-primary);">
            <div style="display:flex; align-items:center; gap:var(--space-md); flex-wrap:wrap;">
              
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); white-space:nowrap;">Ámbito:</label>
                <select id="iv-view-mode" class="form-select form-select-sm" style="min-width:160px; height:34px; padding:4px 28px 4px 10px; font-size:0.82rem; line-height:1.4;">
                  <option value="panel" ${ivViewMode === 'panel' ? 'selected' : ''}>☀️ 1 Panel Solar</option>
                  <option value="string" ${ivViewMode === 'string' ? 'selected' : ''}>🧵 1 String</option>
                  <option value="groups" ${ivViewMode === 'groups' ? 'selected' : ''}>📦 Por Grupo / Inversor</option>
                  <option value="total" ${ivViewMode === 'total' ? 'selected' : ''}>🏭 Total Parque</option>
                </select>
              </div>

              ${(ivViewMode === 'groups' || ivViewMode === 'string') && groups.length > 0 ? `
                <div style="display:flex; align-items:center; gap:6px;">
                  <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); white-space:nowrap;">Grupo:</label>
                  <select id="iv-selected-group" class="form-select form-select-sm" style="min-width:150px; height:34px; padding:4px 28px 4px 10px; font-size:0.82rem; line-height:1.4;">
                    ${ivViewMode === 'groups' ? '<option value="all" ' + (ivSelectedGroup === 'all' ? 'selected' : '') + '>Todos los Grupos</option>' : ''}
                    ${groups.map(g => `<option value="${g.id}" ${ivSelectedGroup === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                  </select>
                </div>
              ` : ''}

              <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); white-space:nowrap;">Variación:</label>
                <select id="iv-family-mode" class="form-select form-select-sm" style="min-width:190px; height:34px; padding:4px 28px 4px 10px; font-size:0.82rem; line-height:1.4;">
                  <option value="irradiance" ${ivFamilyMode === 'irradiance' ? 'selected' : ''}>☀️ Fam. Irradiancia (200..1000 W/m²)</option>
                  <option value="temperature" ${ivFamilyMode === 'temperature' ? 'selected' : ''}>🌡️ Fam. Temperatura (10..55 °C)</option>
                  <option value="current" ${ivFamilyMode === 'current' ? 'selected' : ''}>⚡ Solo Condición Actual</option>
                </select>
              </div>

            </div>

            <!-- Botones de Modo Separado vs Superpuesto -->
            <div style="display:flex; align-items:center; gap:4px;">
              <button class="btn btn-sm ${ivLayoutMode === 'split' ? 'btn-primary' : 'btn-ghost'}" id="btn-layout-split" style="font-size:0.8rem; height:34px; padding:4px 12px;" title="Ver gráficas I-V y P-V separadas">⊞ Separadas</button>
              <button class="btn btn-sm ${ivLayoutMode === 'combined' ? 'btn-primary' : 'btn-ghost'}" id="btn-layout-combined" style="font-size:0.8rem; height:34px; padding:4px 12px;" title="Superponer I-V con P-V en una sola gráfica con doble eje Y">⧉ Superpuesta</button>
            </div>
          </div>

          <!-- Contenedor de Gráficas I-V y P-V -->
          ${ivLayoutMode === 'combined' ? `
            <div style="position:relative; width:100%; height:380px; margin-bottom:var(--space-md);">
              <canvas id="canvas-iv-pv-combined"></canvas>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:var(--space-lg); margin-bottom:var(--space-md);">
              <div style="position:relative; width:100%; height:340px;">
                <canvas id="canvas-iv"></canvas>
              </div>
              <div style="position:relative; width:100%; height:340px;">
                <canvas id="canvas-pv"></canvas>
              </div>
            </div>
          `}

          <!-- Calculador de Punto de Trabajo Interactivo -->
          <div class="card" style="margin-top:var(--space-md); background:var(--bg-tertiary); border:1px solid var(--border-primary);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm); flex-wrap:wrap; gap:8px;">
              <h4 style="font-size:var(--text-sm); margin:0; display:flex; align-items:center; gap:6px;">
                <span>🎯 Calculador de Punto de Trabajo</span>
                <span class="badge" style="background:var(--solar-purple); color:white; font-size:0.7rem;">${ivViewMode === 'panel' ? '1 Panel' : (ivViewMode === 'string' ? '1 String' : (ivViewMode === 'total' ? 'Total Parque' : 'Grupos'))}</span>
              </h4>
              <div style="display:flex; gap:8px; align-items:center;">
                <label style="font-size:0.75rem; color:var(--text-secondary);">Modo:</label>
                <div style="display:flex; gap:4px;">
                  <label class="btn btn-ghost btn-sm" style="font-size:0.75rem; padding:2px 8px; cursor:pointer; ${wpMode === 'power' ? 'background:var(--solar-purple); color:white;' : ''}">
                    <input type="radio" name="wpMode" value="power" ${wpMode === 'power' ? 'checked' : ''} style="display:none;"> 💡 Potencia
                  </label>
                  <label class="btn btn-ghost btn-sm" style="font-size:0.75rem; padding:2px 8px; cursor:pointer; ${wpMode === 'current' ? 'background:var(--solar-purple); color:white;' : ''}">
                    <input type="radio" name="wpMode" value="current" ${wpMode === 'current' ? 'checked' : ''} style="display:none;"> 🔋 Corriente
                  </label>
                </div>
              </div>
            </div>

            ${ivViewMode === 'panel' ? `
              <div style="display:flex; gap:var(--space-lg); align-items:flex-start; flex-wrap:wrap;">
                <div style="flex:1; min-width:220px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" style="font-size:0.75rem;">${wpMode === 'power' ? 'Potencia Medida Panel (W)' : 'Corriente Medida Panel (A)'}</label>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <input type="range" class="form-input wp-slider-panel" value="${wpValuePanel}" min="0" max="${wpMode === 'power' ? (panel.pmax || 600) : Math.ceil(panel.isc || 15)}" step="1" style="flex:1; accent-color:var(--solar-purple);">
                      <input type="number" class="form-input wp-input-panel" value="${wpValuePanel}" min="0" step="1" style="width:80px;">
                    </div>
                  </div>
                </div>
                <div id="wp-result-panel" style="flex:2; min-width:300px; min-height:70px;"></div>
              </div>
            ` : (ivViewMode === 'string' ? `
              <div style="display:flex; gap:var(--space-lg); align-items:flex-start; flex-wrap:wrap;">
                <div style="flex:1; min-width:220px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" style="font-size:0.75rem;">${wpMode === 'power' ? 'Potencia Medida String (kW)' : 'Corriente Medida String (A)'}</label>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <input type="range" class="form-input wp-slider-string" value="${wpValueString}" min="0" max="${wpMode === 'power' ? Math.ceil((panel.vmp || 40) * ppsRep * (panel.imp || 13) / 1000) : Math.ceil(panel.isc || 15)}" step="0.1" style="flex:1; accent-color:var(--solar-purple);">
                      <input type="number" class="form-input wp-input-string" value="${wpValueString}" min="0" step="0.1" style="width:90px;">
                    </div>
                  </div>
                </div>
                <div id="wp-result-string" style="flex:2; min-width:300px; min-height:70px;"></div>
              </div>
            ` : (ivViewMode === 'total' ? `
              <div style="display:flex; gap:var(--space-lg); align-items:flex-start; flex-wrap:wrap;">
                <div style="flex:1; min-width:220px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" style="font-size:0.75rem;">${wpMode === 'power' ? 'Potencia Medida Parque (kW)' : 'Corriente Medida Parque (A)'}</label>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <input type="range" class="form-input wp-slider-total" value="${wpValueTotal}" min="0" max="${wpMode === 'power' ? Math.ceil(r.pmax_stc_total / 1000) : Math.ceil(r.isc_stc_total)}" step="0.5" style="flex:1; accent-color:var(--solar-purple);">
                      <input type="number" class="form-input wp-input-total" value="${wpValueTotal}" min="0" step="0.5" style="width:90px;">
                    </div>
                  </div>
                </div>
                <div id="wp-result-total" style="flex:2; min-width:300px; min-height:70px;"></div>
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
                            <input type="range" class="wp-group-slider" data-id="${g.id}" value="${wpValues[g.id] || 0}" min="0" max="${wpMode === 'power' ? (g.pmax_stc_array/1000).toFixed(1) : (g.isc_stc_array).toFixed(1)}" step="0.1" style="width:80px; accent-color:var(--solar-purple);">
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
            `))}
          </div>

        </div>
      </div>

      <!-- PESTAÑA 3: SIMULACIÓN PARAMÉTRICA TEMPORAL -->
      <div id="res-parametric" class="results-res-tab-content" style="display:${activeResTab === 'res-parametric' ? 'block' : 'none'};">
        <div class="card mb-lg" style="border-left:4px solid var(--solar-blue);">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Variable:</label>
              <select id="res-param-var" class="form-select form-select-sm" style="width:160px; height:32px; font-size:0.8rem;">
                <option value="hour" ${currentParamVar === 'hour' ? 'selected' : ''}>Variar Hora (0 - 23h)</option>
                <option value="day" ${currentParamVar === 'day' ? 'selected' : ''}>Variar Día (1 - 365)</option>
                <option value="month" ${currentParamVar === 'month' ? 'selected' : ''}>Variar Mes (Ene - Dic)</option>
              </select>
              <button class="btn btn-sm ${currentViewParam === 'chart' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-chart" style="height:32px;">📊 Gráfico</button>
              <button class="btn btn-sm ${currentViewParam === 'table' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-table" style="height:32px;">📋 Tabla</button>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="btn btn-sm ${showMaxLines ? 'btn-primary' : 'btn-secondary'}" id="btn-toggle-max-lines" style="font-size:0.75rem; height:32px;">
                ${showMaxLines ? 'Ocultar Límites Máx' : 'Mostrar Límites Máx'}
              </button>
              <label style="font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="checkbox" id="cb-group-tooltips" ${groupTooltips ? 'checked' : ''}> Agrupar tooltip
              </label>
            </div>
          </div>

          <div id="content-param" style="min-height:350px;"></div>
        </div>
      </div>

      <!-- PESTAÑA 4: PÉRDIDAS DE CABLEADO -->
      <div id="res-cable-loss" class="results-res-tab-content" style="display:${activeResTab === 'res-cable-loss' ? 'block' : 'none'};">
        <div class="card mb-lg" style="border-left:4px solid var(--solar-amber);">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="font-size:var(--text-base); margin:0;"><span class="icon">🔌</span> Pérdidas de Cableado DC (Ohmicas)</h3>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin:2px 0 0 0;">Análisis desagregado por String, por Inversor / Grupo y Balance Global del Parque.</p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="badge" style="background:var(--bg-tertiary); border:1px solid var(--border-primary); font-size:0.75rem;">
                Estado: <strong>${cond.cableLossEnabled !== false ? '✅ Activado' : '❌ Desactivado'}</strong>
              </span>
              <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--solar-${vdStatus.color}); border:1px solid var(--solar-${vdStatus.color}); font-size:0.75rem;">
                Caída Global: ${r.vdPercent.toFixed(2)}% (${vdStatus.message})
              </span>
            </div>
          </div>

          <!-- Resumen Rápido -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md); margin-bottom:var(--space-lg); background:var(--bg-tertiary); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-primary);">
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">Potencia Perdida en Cableado</div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--solar-red);">${(totalCablePowerLoss/1000).toFixed(3)} <span style="font-size:0.8rem;">kW</span></div>
              <div style="font-size:0.7rem; color:var(--text-tertiary);">${totalCableLossPct.toFixed(2)}% de la potencia generada</div>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">Caída de Tensión DC Media</div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--solar-${vdStatus.color});">${r.vdPercent.toFixed(2)} <span style="font-size:0.8rem;">%</span></div>
              <div style="font-size:0.7rem; color:var(--text-tertiary);">Promedio: ${r.voltageDrop.toFixed(2)} V</div>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">Potencia Neta en Inversores</div>
              <div style="font-size:1.4rem; font-weight:800; color:var(--solar-green);">${(r.pmax_net/1000).toFixed(2)} <span style="font-size:0.8rem;">kW</span></div>
              <div style="font-size:0.7rem; color:var(--text-tertiary);">Bruta: ${(r.pmax_total_system/1000).toFixed(2)} kW</div>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">Normativa Recomendada</div>
              <div style="font-size:1.1rem; font-weight:700; color:${r.vdPercent <= 2 ? 'var(--solar-green)' : 'var(--solar-red)'};">
                ${r.vdPercent <= 2 ? '✅ Conforme (≤2%)' : '⚠️ No Conforme (>2%)'}
              </div>
              <div style="font-size:0.7rem; color:var(--text-tertiary);">UNE-HD 60364-7-712 / REBT</div>
            </div>
          </div>

          <!-- TABLA 1: PÉRDIDAS POR STRING -->
          <h4 style="font-size:0.85rem; margin:0 0 var(--space-xs) 0; color:var(--solar-purple);">🧵 1. Pérdidas de Cableado por String</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">Pérdidas individuales en el circuito serie de cada string considerando su corriente de máxima potencia (${r.imp_adj.toFixed(2)} A).</p>
          <div style="overflow-x:auto; margin-bottom:var(--space-lg);">
            <table class="data-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Grupo / Circuito String</th>
                  <th>Imp String (A)</th>
                  <th>Longitud (m)</th>
                  <th>Sección (mm²)</th>
                  <th>Material</th>
                  <th>Resistencia (Ω)</th>
                  <th>Caída ΔV (V)</th>
                  <th>Caída (%)</th>
                  <th>Pérdida/String (W)</th>
                  <th>Total Strings Grupo (W)</th>
                </tr>
              </thead>
              <tbody>
                ${cableBreakdown.map(cb => `
                  <tr>
                    <td><strong>${cb.group.name}</strong> <span style="font-size:0.75rem; color:var(--text-secondary);">(${cb.nStr} strings)</span></td>
                    <td class="mono">${r.imp_adj.toFixed(2)}</td>
                    <td class="mono">${cb.cLen}</td>
                    <td class="mono">${cb.cSec}</td>
                    <td class="mono">${cb.cMat.toUpperCase()}</td>
                    <td class="mono">${cb.rString.toFixed(3)}</td>
                    <td class="mono" style="color:var(--solar-purple);">${cb.strVd.toFixed(2)} V</td>
                    <td class="mono" style="color:var(--solar-${cb.status.color}); font-weight:600;">${cb.strVdPct.toFixed(2)}%</td>
                    <td class="mono font-bold" style="color:var(--solar-red);">${cb.strPowerLoss.toFixed(1)} W</td>
                    <td class="mono font-bold" style="color:var(--solar-red);">${cb.strTotalPowerLoss.toFixed(1)} W</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- TABLA 2: PÉRDIDAS POR INVERSOR / GRUPO -->
          <h4 style="font-size:0.85rem; margin:0 0 var(--space-xs) 0; color:var(--solar-amber);">📦 2. Pérdidas de Cableado por Inversor / Grupo</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:var(--space-sm);">Pérdidas acumuladas en las líneas principales de alimentación DC hasta la entrada de cada inversor.</p>
          <div style="overflow-x:auto; margin-bottom:var(--space-lg);">
            <table class="data-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Grupo / Inversor</th>
                  <th>Imp Grupo (A)</th>
                  <th>Vmp Grupo (V)</th>
                  <th>Cable (L × S)</th>
                  <th>Caída Tensión (V)</th>
                  <th>Caída Tensión (%)</th>
                  <th>Pérdida Potencia (W)</th>
                  <th>Pérdida (%)</th>
                  <th>Estado Normativo</th>
                </tr>
              </thead>
              <tbody>
                ${cableBreakdown.map(cb => `
                  <tr>
                    <td><strong>${cb.group.name}</strong></td>
                    <td class="mono font-bold" style="color:var(--solar-pink);">${cb.grpImp.toFixed(1)} A</td>
                    <td class="mono font-bold" style="color:var(--solar-purple);">${cb.grpVmp.toFixed(1)} V</td>
                    <td class="mono">${cb.cLen}m × ${cb.cSec}mm² (${cb.cMat.toUpperCase()})</td>
                    <td class="mono font-bold">${cb.grpVd.toFixed(2)} V</td>
                    <td class="mono font-bold" style="color:var(--solar-${cb.status.color});">${cb.grpVdPct.toFixed(2)}%</td>
                    <td class="mono font-bold" style="color:var(--solar-red);">${cb.grpPowerLoss >= 1000 ? (cb.grpPowerLoss/1000).toFixed(3) + ' kW' : cb.grpPowerLoss.toFixed(1) + ' W'}</td>
                    <td class="mono" style="color:var(--solar-red);">${cb.pmaxArray > 0 ? ((cb.grpPowerLoss / cb.pmaxArray)*100).toFixed(2) : 0}%</td>
                    <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--solar-${cb.status.color}); border:1px solid var(--solar-${cb.status.color}); font-size:0.75rem;">${cb.status.message}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- TABLA 3: TOTAL PARQUE -->
          <h4 style="font-size:0.85rem; margin:0 0 var(--space-xs) 0; color:var(--solar-green);">🏭 3. Balance Global del Parque Solar</h4>
          <div style="overflow-x:auto;">
            <table class="data-table" style="font-size:0.8rem;">
              <tbody>
                <tr>
                  <td style="font-weight:700; width:45%;">Potencia Teórica Generada (DC Bruta)</td>
                  <td class="mono font-bold" style="color:var(--solar-amber);">${(r.pmax_total_system/1000).toFixed(2)} kW</td>
                </tr>
                <tr>
                  <td style="font-weight:700;">Pérdida Total en Cableado DC (Σ Grupos)</td>
                  <td class="mono font-bold" style="color:var(--solar-red);">${(totalCablePowerLoss/1000).toFixed(3)} kW (${totalCableLossPct.toFixed(2)}%)</td>
                </tr>
                <tr>
                  <td style="font-weight:700;">Potencia Neta en Terminales de Inversor</td>
                  <td class="mono font-bold" style="color:var(--solar-green);">${(r.pmax_net/1000).toFixed(2)} kW</td>
                </tr>
                <tr>
                  <td>Caída de Tensión Ponderada Media</td>
                  <td class="mono" style="color:var(--solar-${vdStatus.color}); font-weight:700;">${r.vdPercent.toFixed(2)}% (${r.voltageDrop.toFixed(2)} V)</td>
                </tr>
                <tr>
                  <td>Energía Anual Perdida por Cableado (Est.)</td>
                  <td class="mono" style="color:var(--solar-red);">${((totalCablePowerLoss / 1000) * (r.annualPSH || 1800) / 1000).toFixed(2)} MWh/año</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>



      <!-- PESTAÑA 6: FICHA TÉCNICA Y PLANTA -->
      <div id="res-datasheet-plant" class="results-res-tab-content" style="display:${activeResTab === 'res-datasheet-plant' ? 'block' : 'none'};">
        
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(350px, 1fr)); gap:var(--space-lg);">
          
          <!-- Ficha Técnica del Panel -->
          <div class="card">
            <h3 style="font-size:var(--text-base); margin-bottom:var(--space-md);"><span class="icon">☀️</span> Ficha Técnica del Panel Solar (STC)</h3>
            <table class="data-table">
              <tbody>
                <tr><td>Modelo</td><td class="mono font-bold">${panel.modelName || '—'}</td></tr>
                <tr><td>Fabricante</td><td class="mono">${panel.manufacturer || '—'}</td></tr>
                <tr><td>Tipo de Celda</td><td class="mono">${panel.cellType || '—'}</td></tr>
                <tr><td>Potencia Máxima Pmax (STC)</td><td class="mono" style="color:var(--solar-green); font-weight:700;">${panel.pmax || '—'} Wp</td></tr>
                <tr><td>Tensión Voc / Corriente Isc</td><td class="mono">${panel.voc || '—'} V / ${panel.isc || '—'} A</td></tr>
                <tr><td>Tensión Vmp / Corriente Imp</td><td class="mono">${panel.vmp || '—'} V / ${panel.imp || '—'} A</td></tr>
                <tr><td>Temperatura NOCT</td><td class="mono">${panel.noct || '—'}°C</td></tr>
                <tr><td>Eficiencia Nominal</td><td class="mono">${panel.efficiency || '—'}%</td></tr>
                <tr><td>Coeficiente Térmico β (Voc)</td><td class="mono">${panel.tempCoeffVoc || '—'} %/°C</td></tr>
                <tr><td>Coeficiente Térmico γ (Pmax)</td><td class="mono">${panel.tempCoeffPmax || '—'} %/°C</td></tr>
                <tr><td>Dimensiones y Superficie</td><td class="mono">${panel.length || '—'}×${panel.width || '—'}×${panel.thickness || 35} mm${(panel.length && panel.width) ? ` (${((panel.length * panel.width) / 1000000).toFixed(2)} m²)` : ''}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Configuración Física de Planta -->
          <div class="card">
            <h3 style="font-size:var(--text-base); margin-bottom:var(--space-md);"><span class="icon">🔗</span> Configuración Física de Planta</h3>
            <table class="data-table">
              <tbody>
                <tr><td style="font-weight:700;">Potencia Pico Total Parque</td><td class="mono" style="color:var(--solar-green); font-weight:700;">${((totalPanels * (panel.pmax || 0))/1000).toFixed(2)} kWp</td></tr>
                <tr><td>Total Paneles Instalados</td><td class="mono font-bold">${totalPanels} módulos</td></tr>
                <tr><td>Total Strings en Paralelo</td><td class="mono font-bold">${totalStrings} strings</td></tr>
                <tr><td>Inclinación (Tilt)</td><td class="mono">${arr.useOptimalTilt ? 'Óptima Automática' : arr.tiltAngle + '°'}</td></tr>
                <tr><td>Azimut</td><td class="mono">${arr.useOptimalTilt ? 'Óptimo Automático' : arr.azimuthAngle + '°'}</td></tr>
                <tr><td>Pitch (Separación filas)</td><td class="mono">${arr.rowSpacing || 5} m</td></tr>
                <tr><td>Tipo Seguimiento</td><td class="mono">${arr.trackerType || 'Fijo'}</td></tr>
                <tr><td>Ubicación GPS</td><td class="mono">${loc.locationName || (loc.latitude ? `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°` : '—')}</td></tr>
                <tr><td>Horas de Sol Pico (PSH)</td><td class="mono">${(r.annualPSH || 1800).toFixed(0)} h/año</td></tr>
              </tbody>
            </table>
          </div>

        </div>

      </div>

    </div>
  `;
}

export function init() {
  const r = calculateAll();
  const cond = state.get('conditions') || {};

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
    selectMonth.innerHTML = monthNames.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  }

  const updateDate = () => {
    const daysInMonth = new Date(new Date().getFullYear(), currentMonth, 0).getDate();
    if (currentDay > daysInMonth) currentDay = daysInMonth;

    if (sliderDay) {
      sliderDay.max = daysInMonth;
      sliderDay.value = currentDay;
    }
    if (selectDay) {
      selectDay.innerHTML = Array.from({ length: daysInMonth }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
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
    selectDay.innerHTML = Array.from({ length: daysInMonth }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    selectDay.value = currentDay;
    selectDay.addEventListener('change', (e) => {
      currentDay = parseInt(e.target.value);
      updateDate();
    });
  }

  document.getElementById('btn-set-today')?.addEventListener('click', () => {
    const now = new Date();
    currentMonth = now.getMonth() + 1;
    currentDay = now.getDate();
    updateDate();
  });

  const sliderHour = document.getElementById('res-slider-hour');
  const selectHour = document.getElementById('res-select-hour');

  if (selectHour) {
    let opts = '';
    for (let h = 0; h < 24; h += 0.5) {
      const hh = Math.floor(h).toString().padStart(2, '0');
      const mm = h % 1 === 0 ? '00' : '30';
      opts += `<option value="${h}">${hh}:${mm}</option>`;
    }
    selectHour.innerHTML = opts;
  }

  const updateHour = (h) => {
    state.set('conditions.hourOfDay', parseFloat(h));
    if (sliderHour) sliderHour.value = h;
    if (selectHour) selectHour.value = h;
    refreshUI();
  };

  if (sliderHour) {
    sliderHour.value = cond.hourOfDay !== undefined ? cond.hourOfDay : 12;
    sliderHour.addEventListener('input', (e) => updateHour(e.target.value));
  }
  if (selectHour) {
    selectHour.value = cond.hourOfDay !== undefined ? cond.hourOfDay : 12;
    selectHour.addEventListener('change', (e) => updateHour(e.target.value));
  }

  document.getElementById('btn-set-now')?.addEventListener('click', () => {
    const now = new Date();
    const h = now.getHours() + (now.getMinutes() >= 30 ? 0.5 : 0);
    updateHour(h);
  });

  document.querySelectorAll('input[name="simMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.set('conditions.simMode', e.target.value);
      refreshUI();
    });
  });

  // Environmental sliders
  SLIDERS.forEach(s => {
    const slider = document.getElementById(`res-slider-${s.key}`);
    const input = document.getElementById(`res-input-${s.key}`);
    if (slider && input) {
      slider.addEventListener('input', (e) => {
        input.value = e.target.value;
        state.set(`conditions.${s.key}`, parseFloat(e.target.value));
        refreshUI();
      });
      input.addEventListener('change', (e) => {
        slider.value = e.target.value;
        state.set(`conditions.${s.key}`, parseFloat(e.target.value));
        refreshUI();
      });
    }
  });

  // Scenario Dropdown
  const selectScenario = document.getElementById('res-scenario-select');
  const btnDel = document.getElementById('btn-quick-delete-scenario');

  selectScenario?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) {
      if (btnDel) btnDel.disabled = true;
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
      id: 'custom_' + Date.now(),
      name,
      conditions: {
        irradiance: currentCond.irradiance,
        ambientTemp: currentCond.ambientTemp,
        windSpeed: currentCond.windSpeed,
        humidity: currentCond.humidity,
        albedo: currentCond.albedo
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

  // Top section sub-tabs navigation
  document.querySelectorAll('.top-section-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.dataset.topTarget;
      if (!targetId) return;
      activeTopTab = targetId;

      document.querySelectorAll('.top-section-tab-btn').forEach(b => {
        const isActive = b.dataset.topTarget === targetId;
        b.className = `btn btn-sm top-section-tab-btn ${isActive ? 'btn-primary' : 'btn-ghost'}`;
      });

      document.querySelectorAll('.top-section-tab-content').forEach(pane => {
        pane.style.display = pane.id === targetId ? 'block' : 'none';
      });
    });
  });

  // Sub-tabs navigation
  document.querySelectorAll('.results-res-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.dataset.target;
      if (!targetId) return;
      activeResTab = targetId;

      // Update button styling
      document.querySelectorAll('.results-res-tab-btn').forEach(b => {
        const isActive = b.dataset.target === targetId;
        b.classList.toggle('active', isActive);
        b.style.borderBottom = isActive ? '2px solid var(--solar-amber)' : 'none';
        b.style.fontWeight = isActive ? '700' : 'normal';
      });

      // Update pane displays
      document.querySelectorAll('.results-res-tab-content').forEach(pane => {
        pane.style.display = pane.id === targetId ? 'block' : 'none';
      });

      // Trigger chart rendering for chart-heavy tabs
      const freshR = calculateAll();
      const freshCond = state.get('conditions') || {};
      if (targetId === 'res-iv') {
        renderWorkPoint(freshR);
        renderIVCurves(freshR);
      } else if (targetId === 'res-parametric') {
        renderParametricSection(freshCond, freshR);
      }
    });
  });

  // Export HTML
  document.getElementById('btn-export-html')?.addEventListener('click', () => {
    const tabsContent = document.querySelector('.tabs-content');
    if (!tabsContent) return;
    const clone = tabsContent.cloneNode(true);

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

    clone.querySelectorAll('.results-res-tab-content').forEach(pane => {
      pane.style.display = 'block';
      pane.style.marginBottom = '40px';
      pane.style.borderBottom = '2px solid #ccc';
      pane.style.paddingBottom = '20px';
    });

    clone.querySelectorAll('button, select, input, .tooltip-trigger').forEach(el => el.remove());
    const content = clone.innerHTML;
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Simulación AppSolar</title>
      <style>body{font-family:sans-serif;padding:20px;max-width:1200px;margin:auto;} table{border-collapse:collapse;width:100%;margin-bottom:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;} img{max-width:100%;height:auto;} .alert{padding:10px;margin-bottom:15px;background:#f8f9fa;border-left:4px solid #0d6efd;}</style>
      </head><body>
      <h1>Reporte de Simulación y Resumen - AppSolar</h1>
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
  document.getElementById('iv-selected-group')?.addEventListener('change', (e) => {
    ivSelectedGroup = e.target.value;
    refreshUI();
  });
  document.getElementById('iv-family-mode')?.addEventListener('change', (e) => {
    ivFamilyMode = e.target.value;
    refreshUI();
  });
  document.getElementById('btn-layout-split')?.addEventListener('click', () => {
    ivLayoutMode = 'split';
    refreshUI();
  });
  document.getElementById('btn-layout-combined')?.addEventListener('click', () => {
    ivLayoutMode = 'combined';
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

  const syncInputs = (numInput, sliderInput, isGroup, id, customSetter) => {
    const update = (val) => {
      let v = parseFloat(val) || 0;
      numInput.value = v;
      sliderInput.value = v;
      if (customSetter) {
        customSetter(v);
      } else if (isGroup) {
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
    syncInputs(wpInputPanel, wpSliderPanel, false, null, (v) => { wpValuePanel = v; });
  }

  const wpInputString = document.querySelector('.wp-input-string');
  const wpSliderString = document.querySelector('.wp-slider-string');
  if (wpInputString && wpSliderString) {
    syncInputs(wpInputString, wpSliderString, false, null, (v) => { wpValueString = v; });
  }

  const wpInputTotal = document.querySelector('.wp-input-total');
  const wpSliderTotal = document.querySelector('.wp-slider-total');
  if (wpInputTotal && wpSliderTotal) {
    syncInputs(wpInputTotal, wpSliderTotal, false, null, (v) => { wpValueTotal = v; });
  }

  document.querySelectorAll('.wp-group-input').forEach(numInput => {
    const id = numInput.dataset.id;
    const sliderInput = document.querySelector(`.wp-group-slider[data-id="${id}"]`);
    if (sliderInput) {
      syncInputs(numInput, sliderInput, true, id);
    }
  });

  if (activeResTab === 'res-parametric') {
    renderParametricSection(cond, r);
  } else if (activeResTab === 'res-iv') {
    renderWorkPoint(r);
    renderIVCurves(r);
  }
}

function refreshUI() {
  const contentArea = document.getElementById('tab-content');
  if (!contentArea) return;
  try {
    contentArea.innerHTML = render();
    init();
  } catch (err) {
    contentArea.innerHTML = `<div class="alert alert-danger"><h4>Error en el Renderizado</h4><pre>${err.stack}</pre></div>`;
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

  const originalHour = cond.hourOfDay !== undefined ? cond.hourOfDay : 12;
  const originalDoy = cond.simDayOfYear !== undefined ? cond.simDayOfYear : 172;
  const arr = state.get('arrayConfig') || {};
  const rawGroups = arr.groups || [];
  const groups = rawGroups.length > 0 ? rawGroups : [{ id: 'g1', name: 'Grupo 1', numStrings: 1, panelsPerString: 12 }];
  
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
    for (let d = 1; d <= 365; d += 2) {
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
        label: monthNames[m - 1],
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

  if (currentViewParam === 'chart') {
    container.innerHTML = '<div style="height:350px; position:relative;"><canvas id="canvas-param"></canvas></div>';
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
        data: dataPoints.map(d => (d.pmaxTotal / 1000).toFixed(2)),
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
            return grp ? (grp.pmax_array / 1000).toFixed(2) : 0;
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
          data: Array(labels.length).fill(parseFloat((r.pmax_stc_total / 1000).toFixed(2))),
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
      }

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
              y: { type: 'linear', display: true, position: 'left', title: { text: 'Potencia (kW)' } },
              y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { text: 'Irradiancia (W/m²)' } },
              y2: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { text: 'T. Celda (°C)' } },
              y3: { type: 'linear', display: showMaxLines, position: 'left', grid: { drawOnChartArea: false }, min: 0, title: { text: 'Tensión (V)' } },
              y4: { type: 'linear', display: showMaxLines, position: 'right', grid: { drawOnChartArea: false }, min: 0, title: { text: 'Corriente (A)' } }
            }
          }
        });
      } catch (err) {
        container.innerHTML = `<div style="color:red; padding:10px;">Error dibujando Gráfico: ${err.message}</div>`;
        console.error(err);
      }
    }, 50);
  } else {
    // Table View
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
              ${groups.map(g => `<th>${g.name} (kW)</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    dataPoints.forEach(d => {
      html += `<tr>`;
      html += `<td class="mono"><strong>${d.label}</strong></td>`;
      if (showMaxLines) {
        html += `<td class="mono" style="opacity:0.8;">${cond.irradiance.toFixed(0)}</td>`;
        html += `<td class="mono" style="opacity:0.8;">${(r.pmax_stc_total / 1000).toFixed(2)}</td>`;
        html += `<td class="mono" style="opacity:0.8;">${(r.voc_stc_total || 0).toFixed(1)}</td>`;
        html += `<td class="mono" style="opacity:0.8;">${(r.isc_stc_total || 0).toFixed(1)}</td>`;
      }
      html += `<td class="mono">${d.irradiance.toFixed(0)}</td>`;
      html += `<td class="mono" style="color:var(--solar-red);">${d.tCell.toFixed(1)}</td>`;
      html += `<td class="mono" style="color:var(--solar-green); font-weight:700;">${(d.pmaxTotal / 1000).toFixed(2)}</td>`;
      groups.forEach(g => {
        const grp = d.groups.find(gx => gx.id === g.id);
        const p = grp ? (grp.pmax_array / 1000).toFixed(2) : '0.00';
        html += `<td class="mono">${p}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }
}

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

function renderWorkPoint(r) {
  const panel = state.get('panelSpecs') || {};
  const arr = state.get('arrayConfig') || {};
  const rawGroups = arr.groups || [];
  const groups = rawGroups.length > 0 ? rawGroups : [{ id: 'g1', name: 'Grupo 1', numStrings: 1, panelsPerString: 12 }];

  if (ivViewMode === 'panel') {
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
  } else if (ivViewMode === 'string') {
    const sContainer = document.getElementById('wp-result-string');
    if (!sContainer) return;
    if (!wpValueString || wpValueString <= 0) {
      currentWPs['string'] = null;
      sContainer.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-tertiary); font-size:0.85rem;">Introduce un valor para calcular el punto de trabajo del String.</div>';
      return;
    }
    const repG = groups[0] || { panelsPerString: 12 };
    const nPps = repG.panelsPerString || 12;
    const strParams = {
      voc: panel.voc * nPps, vmp: panel.vmp * nPps, isc: panel.isc, imp: panel.imp,
      numCells: (panel.numCells || 144) * nPps, tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
      G: r.G_actual > 0 ? r.G_actual : 1000, tCell: r.tCell,
    };
    const res = calculateWPForParams(strParams, wpValueString, wpMode, false);
    if (res && res.v !== null) {
      currentWPs['string'] = { v: res.v, i: res.i, p: res.p };
      sContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:var(--space-sm); margin-bottom:var(--space-sm);">
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tensión String</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-purple);">${res.v.toFixed(1)} <span style="font-size:0.7rem;">V</span></div>
          </div>
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Corriente</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-pink);">${res.i.toFixed(2)} <span style="font-size:0.7rem;">A</span></div>
          </div>
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Potencia String</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-green);">${(res.p / 1000).toFixed(2)} <span style="font-size:0.7rem;">kW</span></div>
          </div>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${res.status}</div>
      `;
    } else {
      currentWPs['string'] = null;
      sContainer.innerHTML = `<div style="padding:var(--space-sm); color:var(--solar-red); font-size:0.85rem;">${res ? res.status : 'Introduce valor válido'}</div>`;
    }
  } else if (ivViewMode === 'total') {
    const tContainer = document.getElementById('wp-result-total');
    if (!tContainer) return;
    if (!wpValueTotal || wpValueTotal <= 0) {
      currentWPs['total'] = null;
      tContainer.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-tertiary); font-size:0.85rem;">Introduce un valor para calcular el punto de trabajo del Parque.</div>';
      return;
    }
    const totStr = groups.reduce((acc, g) => acc + (g.numStrings || 1), 0);
    const avgPps = groups.length > 0 ? (groups.reduce((acc, g) => acc + (g.panelsPerString || 1), 0) / groups.length) : 12;
    const totParams = {
      voc: panel.voc * avgPps, vmp: panel.vmp * avgPps, isc: panel.isc * totStr, imp: panel.imp * totStr,
      numCells: (panel.numCells || 144) * avgPps, tempCoeffIsc: panel.tempCoeffIsc, tempCoeffVoc: panel.tempCoeffVoc,
      G: r.G_actual > 0 ? r.G_actual : 1000, tCell: r.tCell,
    };
    const res = calculateWPForParams(totParams, wpValueTotal, wpMode, false);
    if (res && res.v !== null) {
      currentWPs['total'] = { v: res.v, i: res.i, p: res.p };
      tContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:var(--space-sm); margin-bottom:var(--space-sm);">
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tensión Media</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-purple);">${res.v.toFixed(1)} <span style="font-size:0.7rem;">V</span></div>
          </div>
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Corriente Total</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-pink);">${res.i.toFixed(1)} <span style="font-size:0.7rem;">A</span></div>
          </div>
          <div style="text-align:center; padding:var(--space-sm); background:var(--bg-tertiary); border-radius:var(--radius-md);">
            <div style="font-size:0.7rem; color:var(--text-secondary);">Potencia Total</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--solar-green);">${(res.p / 1000).toFixed(2)} <span style="font-size:0.7rem;">kW</span></div>
          </div>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${res.status}</div>
      `;
    } else {
      currentWPs['total'] = null;
      tContainer.innerHTML = `<div style="padding:var(--space-sm); color:var(--solar-red); font-size:0.85rem;">${res ? res.status : 'Introduce valor válido'}</div>`;
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
        cellP.innerHTML = `${(res.p / 1000).toFixed(2)} kW`;
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

function renderIVCurves(r) {
  if (activeResTab !== 'res-iv') return;
  const panel = state.get('panelSpecs') || {};
  const arr = state.get('arrayConfig') || {};
  const rawGroups = arr.groups || [];
  const groups = rawGroups.length > 0 ? rawGroups : [{ id: 'g1', name: 'Grupo 1', numStrings: 1, panelsPerString: 12 }];
  const cond = state.get('conditions') || {};

  const basePanelParams = {
    voc: panel.voc || 49.5,
    isc: panel.isc || 13.9,
    vmp: panel.vmp || 41.5,
    imp: panel.imp || 13.2,
    numCells: panel.numCells || 144,
    tempCoeffIsc: panel.tempCoeffIsc || 0.048,
    tempCoeffVoc: panel.tempCoeffVoc || -0.27,
  };

  const ivDatasets = [];
  const pvDatasets = [];
  const combinedDatasets = [];
  const colors = CURVE_PALETTE;

  // Determine scaling based on ivViewMode
  let activeScopes = [];
  if (ivViewMode === 'panel') {
    activeScopes = [{ name: '1 Panel Solar', nStr: 1, nPps: 1, id: 'panel' }];
  } else if (ivViewMode === 'string') {
    const targetG = ivSelectedGroup !== 'all' ? (groups.find(g => g.id === ivSelectedGroup) || groups[0]) : groups[0];
    activeScopes = [{ name: `1 String (${targetG.name})`, nStr: 1, nPps: targetG.panelsPerString || 12, id: 'string' }];
  } else if (ivViewMode === 'total') {
    const totStr = groups.reduce((acc, g) => acc + (g.numStrings || 1), 0);
    const avgPps = groups.length > 0 ? (groups.reduce((acc, g) => acc + (g.panelsPerString || 1), 0) / groups.length) : 12;
    activeScopes = [{ name: 'Total Parque Solar', nStr: totStr, nPps: avgPps, id: 'total' }];
  } else {
    // groups
    if (ivSelectedGroup === 'all') {
      activeScopes = groups.map(g => ({ name: g.name, nStr: g.numStrings || 1, nPps: g.panelsPerString || 12, id: g.id }));
    } else {
      const g = groups.find(gx => gx.id === ivSelectedGroup) || groups[0];
      activeScopes = [{ name: g.name, nStr: g.numStrings || 1, nPps: g.panelsPerString || 12, id: g.id }];
    }
  }

  activeScopes.forEach((sc, scopeIdx) => {
    const scParams = {
      ...basePanelParams,
      voc: basePanelParams.voc * sc.nPps,
      vmp: basePanelParams.vmp * sc.nPps,
      isc: basePanelParams.isc * sc.nStr,
      imp: basePanelParams.imp * sc.nStr,
      numCells: basePanelParams.numCells * sc.nPps,
    };

    if (ivFamilyMode === 'irradiance') {
      const irradiances = [200, 400, 600, 800, 1000];
      const curves = generateIVCurveFamily_Irradiance(scParams, irradiances, r.tCell);
      curves.forEach((c, i) => {
        const color = colors[(scopeIdx * 5 + i) % colors.length];
        ivDatasets.push({
          label: `${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.currents[j] })),
          borderColor: color, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true,
        });
        pvDatasets.push({
          label: `${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.powers[j] })),
          borderColor: color, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true,
        });
        combinedDatasets.push({
          label: `I(V) ${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.currents[j] })),
          borderColor: color, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true, yAxisID: 'y'
        });
        combinedDatasets.push({
          label: `P(V) ${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.powers[j] })),
          borderColor: color, borderDash: [4, 4], borderWidth: 1.5, fill: false, tension: 0.3, pointRadius: 0, showLine: true, yAxisID: 'y1'
        });
      });
    } else if (ivFamilyMode === 'temperature') {
      const temps = [10, 25, 40, 55];
      const curves = generateIVCurveFamily_Temperature(scParams, temps, r.G_actual > 0 ? r.G_actual : 1000);
      curves.forEach((c, i) => {
        const color = colors[(scopeIdx * 4 + i) % colors.length];
        ivDatasets.push({
          label: `${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.currents[j] })),
          borderColor: color, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true,
        });
        pvDatasets.push({
          label: `${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.powers[j] })),
          borderColor: color, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true,
        });
        combinedDatasets.push({
          label: `I(V) ${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.currents[j] })),
          borderColor: color, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true, yAxisID: 'y'
        });
        combinedDatasets.push({
          label: `P(V) ${sc.name} - ${c.label}`,
          data: c.voltages.map((v, j) => ({ x: v, y: c.powers[j] })),
          borderColor: color, borderDash: [4, 4], borderWidth: 1.5, fill: false, tension: 0.3, pointRadius: 0, showLine: true, yAxisID: 'y1'
        });
      });
    }

    // Current operating point curve
    if (r.G_actual > 0) {
      const currentCurve = generateIVCurve({ ...scParams, G: r.G_actual, tCell: r.tCell });
      const opColor = '#10b981';

      ivDatasets.push({
        label: `Actual ${sc.name} (${r.G_actual.toFixed(0)} W/m², ${r.tCell.toFixed(1)}°C)`,
        data: currentCurve.voltages.map((v, j) => ({ x: v, y: currentCurve.currents[j] })),
        borderColor: opColor, borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 0, showLine: true, borderDash: [5, 5]
      });
      pvDatasets.push({
        label: `Actual ${sc.name} (${r.G_actual.toFixed(0)} W/m², ${r.tCell.toFixed(1)}°C)`,
        data: currentCurve.voltages.map((v, j) => ({ x: v, y: currentCurve.powers[j] })),
        borderColor: opColor, borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 0, showLine: true, borderDash: [5, 5]
      });
      combinedDatasets.push({
        label: `I(V) Actual ${sc.name}`,
        data: currentCurve.voltages.map((v, j) => ({ x: v, y: currentCurve.currents[j] })),
        borderColor: opColor, borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 0, showLine: true, borderDash: [5, 5], yAxisID: 'y'
      });
      combinedDatasets.push({
        label: `P(V) Actual ${sc.name}`,
        data: currentCurve.voltages.map((v, j) => ({ x: v, y: currentCurve.powers[j] })),
        borderColor: '#059669', borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0, showLine: true, borderDash: [2, 2], yAxisID: 'y1'
      });

      // MPP
      ivDatasets.push({
        label: `MPP ${sc.name} (${currentCurve.mpp.v.toFixed(1)}V, ${currentCurve.mpp.i.toFixed(1)}A)`,
        data: [{ x: currentCurve.mpp.v, y: currentCurve.mpp.i }],
        borderColor: opColor, backgroundColor: opColor, pointRadius: 8, pointStyle: 'crossRot', showLine: false,
      });
      pvDatasets.push({
        label: `MPP ${sc.name} (${currentCurve.mpp.v.toFixed(1)}V, ${(currentCurve.mpp.p >= 1000 ? (currentCurve.mpp.p / 1000).toFixed(2) + 'kW' : currentCurve.mpp.p.toFixed(0) + 'W')})`,
        data: [{ x: currentCurve.mpp.v, y: currentCurve.mpp.p }],
        borderColor: opColor, backgroundColor: opColor, pointRadius: 8, pointStyle: 'crossRot', showLine: false,
      });
      combinedDatasets.push({
        label: `MPP I(V) ${sc.name} (${currentCurve.mpp.v.toFixed(1)}V, ${currentCurve.mpp.i.toFixed(1)}A)`,
        data: [{ x: currentCurve.mpp.v, y: currentCurve.mpp.i }],
        borderColor: opColor, backgroundColor: opColor, pointRadius: 8, pointStyle: 'crossRot', showLine: false, yAxisID: 'y'
      });
      combinedDatasets.push({
        label: `MPP P(V) ${sc.name} (${currentCurve.mpp.v.toFixed(1)}V, ${(currentCurve.mpp.p >= 1000 ? (currentCurve.mpp.p / 1000).toFixed(2) + 'kW' : currentCurve.mpp.p.toFixed(0) + 'W')})`,
        data: [{ x: currentCurve.mpp.v, y: currentCurve.mpp.p }],
        borderColor: '#059669', backgroundColor: '#059669', pointRadius: 8, pointStyle: 'crossRot', showLine: false, yAxisID: 'y1'
      });

      // Custom Working Point
      const wp = currentWPs[sc.id];
      if (wp && wp.v !== null) {
        ivDatasets.push({
          label: `Punto Trabajo ${sc.name} (${wp.i.toFixed(1)}A, ${wp.v.toFixed(1)}V)`,
          data: [{ x: wp.v, y: wp.i }],
          borderColor: '#ef4444', backgroundColor: '#ef4444', pointRadius: 8, pointStyle: 'rectRot', showLine: false,
        });
        pvDatasets.push({
          label: `Punto Trabajo ${sc.name} (${(wp.p >= 1000 ? (wp.p / 1000).toFixed(2) + 'kW' : wp.p.toFixed(0) + 'W')})`,
          data: [{ x: wp.v, y: wp.p }],
          borderColor: '#ef4444', backgroundColor: '#ef4444', pointRadius: 8, pointStyle: 'rectRot', showLine: false,
        });
        combinedDatasets.push({
          label: `Punto Trabajo I(V) ${sc.name} (${wp.i.toFixed(1)}A, ${wp.v.toFixed(1)}V)`,
          data: [{ x: wp.v, y: wp.i }],
          borderColor: '#ef4444', backgroundColor: '#ef4444', pointRadius: 8, pointStyle: 'rectRot', showLine: false, yAxisID: 'y'
        });
        combinedDatasets.push({
          label: `Punto Trabajo P(V) ${sc.name} (${(wp.p >= 1000 ? (wp.p / 1000).toFixed(2) + 'kW' : wp.p.toFixed(0) + 'W')})`,
          data: [{ x: wp.v, y: wp.p }],
          borderColor: '#dc2626', backgroundColor: '#dc2626', pointRadius: 8, pointStyle: 'rectRot', showLine: false, yAxisID: 'y1'
        });
      }
    }
  });

  const tooltipCallbacks = {
    label: function (ctx) {
      const x = ctx.parsed.x !== undefined ? ctx.parsed.x.toFixed(1) : '-';
      const yVal = ctx.parsed.y !== undefined ? ctx.parsed.y : 0;
      const isPower = ctx.dataset.yAxisID === 'y1' || (ctx.chart.canvas.id === 'canvas-pv');
      const valStr = isPower ? (yVal >= 1000 ? `${(yVal / 1000).toFixed(2)} kW (${yVal.toFixed(0)} W)` : `${yVal.toFixed(1)} W`) : `${yVal.toFixed(2)} A`;
      const concept = isPower ? 'Potencia (P)' : 'Corriente (I)';
      return `${ctx.dataset.label}: ⚡ Tensión: ${x} V | ${concept}: ${valStr}`;
    }
  };

  setTimeout(() => {
    try {
      if (ivLayoutMode === 'combined') {
        createChart('canvas-iv-pv-combined', {
          type: 'scatter',
          data: { datasets: combinedDatasets },
          options: {
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
              title: { display: true, text: 'Curvas Superpuestas I-V y P-V (Doble Eje Y)' },
              tooltip: { callbacks: tooltipCallbacks }
            },
            scales: {
              x: { type: 'linear', title: { display: true, text: 'Tensión V (Voltios)' }, min: 0 },
              y: { type: 'linear', position: 'left', title: { display: true, text: 'Corriente I (Amperios)' }, min: 0 },
              y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Potencia P (Vatios)' }, min: 0 }
            }
          }
        });
      } else {
        createChart('canvas-iv', {
          type: 'scatter',
          data: { datasets: ivDatasets },
          options: {
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
              title: { display: true, text: 'Curva Corriente - Tensión (I-V)' },
              tooltip: { callbacks: tooltipCallbacks }
            },
            scales: {
              x: { type: 'linear', title: { display: true, text: 'Tensión V (Voltios)' }, min: 0 },
              y: { type: 'linear', title: { display: true, text: 'Corriente I (Amperios)' }, min: 0 }
            }
          }
        });

        createChart('canvas-pv', {
          type: 'scatter',
          data: { datasets: pvDatasets },
          options: {
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
              title: { display: true, text: 'Curva Potencia - Tensión (P-V)' },
              tooltip: { callbacks: tooltipCallbacks }
            },
            scales: {
              x: { type: 'linear', title: { display: true, text: 'Tensión V (Voltios)' }, min: 0 },
              y: { type: 'linear', title: { display: true, text: 'Potencia P (Vatios)' }, min: 0 }
            }
          }
        });
      }
    } catch (err) {
      console.error('Error rendering IV/PV charts:', err);
    }
  }, 50);
}

