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

let currentViewParam = 'chart'; // 'chart' | 'table'
let currentParamVar = 'hour'; // 'hour' | 'day' | 'month'
let activeResTab = 'res-groups';

export function render() {
  const r = calculateAll();
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const savedScenarios = state.get('savedScenarios') || [];
  const vdStatus = getVoltageDropStatus(r.vdPercent);

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
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:var(--space-lg); align-items:center;">
        <div style="display:flex; flex-direction:column; gap:var(--space-md);">
          <div style="display:flex; gap:var(--space-md);">
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
                <select id="res-select-daym" class="form-select form-select-sm" style="width:60px; height:24px; font-size:0.75rem; padding:0 4px;"></select>
              </div>
              <input type="range" id="res-slider-daym" min="1" max="31" step="1" style="height:4px; accent-color:var(--solar-blue);">
            </div>
          </div>
          <div class="slider-group" style="margin-bottom:0;">
            <div class="slider-header" style="font-size:0.8rem;">
              <span class="slider-label">Hora del Día</span>
              <div class="slider-value-display"><span class="slider-value mono" id="res-val-hour">...</span></div>
            </div>
            <input type="range" id="res-slider-hour" min="0" max="23.5" step="0.5" style="height:4px; accent-color:var(--solar-amber);">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-md); background:rgba(0,0,0,0.2); padding:var(--space-md); border-radius:var(--radius-md); border:1px solid var(--border-primary);">
          <div>
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
              Irradiancia (G)
              <span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="Irradiancia en el plano del módulo. Fórmula: Irradiancia_Pico × Factor_Hora × Cos(Ángulo_Incidencia). Si hay seguidor, incluye su coeficiente.">ℹ️</span>
            </div>
            <div style="font-size:1.5rem; font-weight:700; color:var(--solar-amber);">${r.G_actual.toFixed(0)} <span style="font-size:0.8rem;">W/m²</span></div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
              Tª Simulada
              <span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="Temperatura estimada para la hora actual, interpolada mediante una curva cosenoidal desde la Tª Máxima (Pico a las ~14:30) y la Tª Mínima.">ℹ️</span>
            </div>
            <div style="font-size:1.5rem; font-weight:700; color:var(--solar-red);">${r.tAmb_actual.toFixed(1)} <span style="font-size:0.8rem;">°C</span></div>
          </div>
          <div style="grid-column: span 2; border-top: 1px solid var(--border-primary); margin-top: 8px; padding-top: 8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
                <span class="icon">🔥</span> Tª Celda Calculada
                <span class="tooltip-trigger" style="cursor:help; font-size:11px;" data-tooltip="Estimación basada en método NOCT.&#10;Fórmula aprox: T_amb_simulada + (NOCT - 20) × (G_actual / 800) × Factor_Viento">ℹ️</span>
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
      <div class="tabs-header mb-md" style="display:flex; gap:16px; border-bottom:1px solid var(--border-primary); padding-bottom:8px;">
        <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-groups' ? 'active' : ''}" data-target="res-groups" style="border-radius:0; ${activeResTab === 'res-groups' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📦 Resultados por Grupos</button>
        <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-summary' ? 'active' : ''}" data-target="res-summary" style="border-radius:0; ${activeResTab === 'res-summary' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📋 Resumen Global</button>
        <button class="btn btn-ghost results-res-tab-btn ${activeResTab === 'res-chart' ? 'active' : ''}" data-target="res-chart" style="border-radius:0; ${activeResTab === 'res-chart' ? 'border-bottom:2px solid var(--solar-amber);' : ''}">📈 Resumen Gráfico</button>
      </div>

      <div class="tabs-content" style="min-height: 250px;">
        <div id="res-groups" class="results-res-tab-content" style="display:${activeResTab === 'res-groups' ? 'block' : 'none'};">
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

        <div id="res-summary" class="results-res-tab-content" style="display:${activeResTab === 'res-summary' ? 'block' : 'none'};">
          <div class="alert alert-info mb-sm"><span>ℹ️ Estos resultados muestran los valores <strong>dinámicos calculados para el momento actual de simulación</strong> (Irradiancia: ${r.G_actual.toFixed(0)} W/m², Temp: ${r.tAmb_actual.toFixed(1)}°C).</span></div>
          <table class="data-table">
            <tbody>
              <tr><td>Potencia Máxima Teórica <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Potencia nominal DC (STC) multiplicada por el ratio de pérdida por temperatura e irradiancia.">ℹ️</span></td><td class="mono" style="color:var(--solar-amber);font-weight:700;">${(r.pmax_total_system/1000).toFixed(2)} kW</td></tr>
              <tr><td>Potencia Máxima Neta <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Potencia en terminales del inversor tras descontar las pérdidas óhmicas de cableado.">ℹ️</span></td><td class="mono" style="font-weight:700;">${(r.pmax_net/1000).toFixed(2)} kW</td></tr>
              <tr><td>Vmp (Promedio Sistema) <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Tensión en el punto de máxima potencia media de todos los strings.">ℹ️</span></td><td class="mono">${r.vmp_avg_system.toFixed(1)} V</td></tr>
              <tr><td>Corriente Total Sistema <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Suma de las corrientes (Imp) de todos los strings conectados.">ℹ️</span></td><td class="mono">${r.imp_total_system.toFixed(2)} A</td></tr>
              <tr><td>Caída Tensión DC <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Pérdida porcentual de tensión en el cableado DC.">ℹ️</span></td><td class="mono" style="color:var(--solar-${vdStatus.color})">${r.vdPercent.toFixed(2)}% (${vdStatus.message})</td></tr>
              <tr><td>Fill Factor Real <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="FF = (Pmax_real) / (Voc * Isc). Indica la 'cuadratura' de la curva I-V.">ℹ️</span></td><td class="mono">${(r.fillFactor*100).toFixed(1)}%</td></tr>
              <tr><td>Eficiencia Real del Panel <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Eficiencia = Pmax_real / (Área_Panel * Irradiancia).">ℹ️</span></td><td class="mono">${r.panelEffReal.toFixed(1)}%</td></tr>
              <tr><td>Performance Ratio (PR) <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Rendimiento global de la planta descontando pérdidas térmicas y de cableado respecto a la teórica ideal STC.">ℹ️</span></td><td class="mono" style="font-weight:700;">${(r.pr_estimated*100).toFixed(1)}%</td></tr>
              <tr><td>Rendimiento Anual (Yield) <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Energía anual producida estimada por la API de PVGIS.">ℹ️</span></td><td class="mono" style="color:var(--solar-green);font-weight:700;">${(r.annualYield/1000).toFixed(1)} MWh/año</td></tr>
            </tbody>
          </table>
        </div>

        <div id="res-chart" class="results-res-tab-content" style="display:${activeResTab === 'res-chart' ? 'block' : 'none'};">
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
            </div>
          </div>
          <div id="content-param" style="min-height:350px;">
            <!-- Se rellena vía JS -->
          </div>
        </div>
      </div>
    </div>
  `;
}

let isFirstLoad = true;

export function init() {
  if (isFirstLoad) {
    isFirstLoad = false;
    // Forzamos la hora a mediodía la primera vez para asegurar que hay irradiancia y los resultados no son cero
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

  // Sliders de hora
  const controls = [
    { slider: 'res-slider-hour', display: 'res-val-hour', key: 'conditions.hourOfDay', parse: parseFloat, format: (v) => `${Math.floor(v)}:${(v % 1 === 0.5) ? '30' : '00'}` },
  ];

  controls.forEach(({ slider, display, key, parse, format }) => {
    const sl = document.getElementById(slider);
    const disp = document.getElementById(display);
    if (sl) {
      sl.value = cond.hourOfDay || 12;
      if (disp) disp.textContent = format ? format(sl.value) : sl.value;
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

  // Toggles Param
  document.getElementById('btn-view-chart')?.addEventListener('click', () => {
    currentViewParam = 'chart';
    refreshUI();
  });
  document.getElementById('btn-view-table')?.addEventListener('click', () => {
    currentViewParam = 'table';
    refreshUI();
  });
  document.getElementById('res-param-var')?.addEventListener('change', (e) => {
    currentParamVar = e.target.value;
    refreshUI();
  });

  // Tabs de Sección 3
  document.querySelectorAll('.results-res-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeResTab = e.target.dataset.target;
      refreshUI();
    });
  });

  renderParametricSection(cond);
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

function renderParametricSection(cond) {
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

      createChart('canvas-param', {
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
    }
  } else {
    // TABLE VIEW
    let html = `
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>Punto</th>
              <th>G (W/m²)</th>
              <th>T. Celda (°C)</th>
              <th style="color:var(--solar-green);">P. Total (kW)</th>
              ${groups.map(g => `<th>${g.name} (kW)</th><th>${g.name} (V)</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    dataPoints.forEach(d => {
      html += `<tr>`;
      html += `<td class="mono"><strong>${d.label}</strong></td>`;
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
