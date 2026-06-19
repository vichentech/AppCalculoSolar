/**
 * AppSolar — Tab: Configuración del Array Solar & Grid Interactivo
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';

export function render() {
  const arr = state.get('arrayConfig');
  const panel = state.get('panelSpecs');
  const r = calculateAll();
  const totalPanels = arr.numStrings * arr.panelsPerString;
  const totalPower = (totalPanels * panel.pmax / 1000).toFixed(2);
  const cellTypeOptions = ['fixed', 'axis-ns', 'dual-axis'];

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🔗</span> Configuración del Parque Solar</h2>
        <p class="page-subtitle">Configura seguidores, backtracking y la disposición física en planta del parque fotovoltaico mediante drag & drop.</p>
      </div>
    </div>

    <!-- KPIs del Parque -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">🔢</div>
        <div class="stat-label">Total Paneles</div>
        <div class="stat-value" id="stat-total-panels">${totalPanels}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-label">Potencia Pico</div>
        <div class="stat-value" id="stat-total-power">${totalPower}<span class="stat-unit">kWp</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔗</div>
        <div class="stat-label">Strings</div>
        <div class="stat-value" id="stat-strings">${arr.numStrings}</div>
      </div>
      <div class="stat-card" style="border-color: var(--solar-blue);">
        <div class="stat-icon">📐</div>
        <div class="stat-label">Inclinación Activa</div>
        <div class="stat-value" id="stat-tilt">${r.activeTilt.toFixed(1)}<span class="stat-unit">°</span></div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Configuración Eléctrica -->
      <div class="card">
        <div class="card-header">
          <h3>🔗 Configuración de Strings</h3>
        </div>

        <div class="slider-group">
          <div class="slider-header">
            <span class="slider-label">Número de Strings
              <span class="tooltip-trigger" data-tooltip="Cada string es un conjunto de paneles en serie. Se conectan en paralelo entre sí.">i</span>
            </span>
            <div class="slider-value-display">
              <span class="slider-value" id="val-strings">${arr.numStrings}</span>
            </div>
          </div>
          <div class="slider-input-row">
            <input type="range" id="slider-strings" min="1" max="24" value="${arr.numStrings}" step="1">
            <input type="number" class="form-input" id="input-strings" min="1" max="24" value="${arr.numStrings}">
          </div>
        </div>

        <div class="slider-group">
          <div class="slider-header">
            <span class="slider-label">Paneles por String (serie)
              <span class="tooltip-trigger" data-tooltip="Número de módulos conectados en serie en cada string. Define la tensión total del string.">i</span>
            </span>
            <div class="slider-value-display">
              <span class="slider-value" id="val-panels-per-string">${arr.panelsPerString}</span>
            </div>
          </div>
          <div class="slider-input-row">
            <input type="range" id="slider-panels" min="1" max="40" value="${arr.panelsPerString}" step="1">
            <input type="number" class="form-input" id="input-panels" min="1" max="60" value="${arr.panelsPerString}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Distancia entre Filas (Pitch) <span class="unit">[m]</span>
            <span class="tooltip-trigger" data-tooltip="Distancia entre los ejes de las filas de paneles. Crítico para cálculo de sombras y backtracking.">i</span>
          </label>
          <div class="form-input-with-unit">
            <input class="form-input" type="number" id="input-row-spacing" value="${arr.rowSpacing}" min="0.5" step="0.1">
            <span class="input-unit">m</span>
          </div>
        </div>
      </div>

      <!-- Estructura y Orientación (Fijo/Seguidores) -->
      <div class="card">
        <div class="card-header">
          <h3>📐 Estructura y Seguimiento Solar</h3>
        </div>

        <div class="form-group">
          <label class="form-label">Tipo de Estructura</label>
          <select class="form-select" id="select-tracker-type">
            <option value="fixed" ${arr.trackerType === 'fixed' ? 'selected' : ''}>Fijo (Inclinación Estática)</option>
            <option value="axis-ns" ${arr.trackerType === 'axis-ns' ? 'selected' : ''}>Seguidor 1 Eje H-NS (Este-Oeste)</option>
            <option value="dual-axis" ${arr.trackerType === 'dual-axis' ? 'selected' : ''}>Seguidor 2 Ejes (Completo)</option>
          </select>
        </div>

        <!-- Backtracking Panel (Seguidor 1 Eje) -->
        <div id="tracker-ns-config" style="display: ${arr.trackerType === 'axis-ns' ? 'block' : 'none'}; border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-md); background: var(--bg-tertiary);">
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--solar-amber); margin-bottom: var(--space-sm); text-transform: uppercase;">Parámetros Backtracking</div>
          
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:var(--space-md);">
            <input type="checkbox" id="checkbox-backtracking" ${arr.backtracking ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--solar-amber); cursor:pointer;">
            <label for="checkbox-backtracking" style="font-weight:600; cursor:pointer; font-size:var(--text-sm);">Habilitar Algoritmo Backtracking</label>
          </div>

          <div id="backtracking-params" style="display: ${arr.backtracking ? 'block' : 'none'};">
            <div class="slider-group">
              <div class="slider-header">
                <span class="slider-label" style="font-size:0.75rem;">Hora Límite Mañana (Fin Backtracking)</span>
                <div class="slider-value-display"><span class="slider-value" id="val-bt-start">${arr.backtrackingStartHour}</span><span class="slider-unit">h</span></div>
              </div>
              <input type="range" id="slider-bt-start" min="5" max="11" value="${arr.backtrackingStartHour}" step="0.5" style="height:4px;">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span class="slider-label" style="font-size:0.75rem;">Hora Límite Tarde (Inicio Backtracking)</span>
                <div class="slider-value-display"><span class="slider-value" id="val-bt-end">${arr.backtrackingEndHour}</span><span class="slider-unit">h</span></div>
              </div>
              <input type="range" id="slider-bt-end" min="13" max="20" value="${arr.backtrackingEndHour}" step="0.5" style="height:4px;">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span class="slider-label" style="font-size:0.75rem;">Factor de Corrección de Ángulo</span>
                <div class="slider-value-display"><span class="slider-value" id="val-bt-corr">${arr.backtrackingCorrection}</span></div>
              </div>
              <input type="range" id="slider-bt-corr" min="0.80" max="1.00" value="${arr.backtrackingCorrection}" step="0.01" style="height:4px;">
            </div>

            <div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:8px;">
              GCR (Ground Cover Ratio): <strong class="mono" style="color:var(--solar-blue);">${((panel.width / 1000) / (arr.rowSpacing || 6.0)).toFixed(3)}</strong>
            </div>
          </div>
        </div>

        <!-- Sliders Estáticos -->
        <div id="static-angles-config" style="opacity: ${arr.trackerType === 'fixed' ? '1' : '0.4'}; pointer-events: ${arr.trackerType === 'fixed' ? 'auto' : 'none'}; transition: opacity 0.2s;">
          <div class="slider-group">
            <div class="slider-header">
              <span class="slider-label">Ángulo de Inclinación (Tilt)</span>
              <div class="slider-value-display">
                <span class="slider-value" id="val-tilt">${arr.tiltAngle}</span>
                <span class="slider-unit">°</span>
              </div>
            </div>
            <div class="slider-input-row">
              <input type="range" id="slider-tilt" min="0" max="90" value="${arr.tiltAngle}" step="1">
              <input type="number" class="form-input" id="input-tilt" min="0" max="90" value="${arr.tiltAngle}">
            </div>
          </div>

          <div class="slider-group">
            <div class="slider-header">
              <span class="slider-label">Azimut (Orientación)</span>
              <div class="slider-value-display">
                <span class="slider-value" id="val-azimuth">${arr.azimuthAngle}</span>
                <span class="slider-unit">° ${getCardinal(arr.azimuthAngle)}</span>
              </div>
            </div>
            <div class="slider-input-row">
              <input type="range" id="slider-azimuth" min="0" max="360" value="${arr.azimuthAngle}" step="1">
              <input type="number" class="form-input" id="input-azimuth" min="0" max="360" value="${arr.azimuthAngle}">
            </div>
          </div>
        </div>

        <div class="mt-lg" style="text-align:center;">
          <div id="compass-visual" style="font-size:3rem;">
            ${getCompassEmoji(arr.trackerType === 'fixed' ? arr.azimuthAngle : (arr.trackerType === 'axis-ns' ? 90 : r.sunAzimuth))}
          </div>
          <div style="color:var(--text-secondary); font-size:var(--text-sm); margin-top:var(--space-xs);" id="azimuth-tracker-status">
            ${arr.trackerType === 'fixed' 
              ? `Orientación Fija: <strong>${getCardinal(arr.azimuthAngle)}</strong> (${arr.azimuthAngle}°)` 
              : (arr.trackerType === 'axis-ns' ? `Seguidor Monoeje: E-W (Eje N-S) | Rotación: <strong>${r.trackerRotation.toFixed(1)}°</strong>` : `Seguidor Dual: Azimut <strong>${r.sunAzimuth.toFixed(1)}°</strong> | Elev. <strong>${r.sunElevation.toFixed(1)}°</strong>`)}
          </div>
        </div>
      </div>
    </div>

    <!-- Grid / Canvas Interactivo -->
    <div class="card mt-lg">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3>🏢 Distribución Física en Planta del Parque Solar (Grid Drag & Drop)</h3>
          <p style="font-size: var(--text-xs); color: var(--text-tertiary); margin-top:2px;">Arrastra los strings y sensores para configurar la disposición real del campo fotovoltaico.</p>
        </div>
        <div style="display:flex; gap:var(--space-sm);">
          <div id="sensor-palette" style="display:flex; align-items:center; gap:8px; background:var(--bg-tertiary); padding:6px 12px; border-radius:var(--radius-md); border:1px dashed var(--solar-blue);">
            <span style="font-size:var(--text-xs); font-weight:600; color:var(--text-secondary);">Sensores Temp. Disponibles:</span>
            <div class="draggable-sensor" draggable="true" id="palette-sensor-1" style="cursor:grab; background:var(--solar-blue); color:white; font-size:var(--text-xs); padding:4px 8px; border-radius:var(--radius-sm); font-weight:600; display:flex; align-items:center; gap:4px;">
              🌡️ Sensor 1
            </div>
            <div class="draggable-sensor" draggable="true" id="palette-sensor-2" style="cursor:grab; background:var(--solar-blue); color:white; font-size:var(--text-xs); padding:4px 8px; border-radius:var(--radius-sm); font-weight:600; display:flex; align-items:center; gap:4px;">
              🌡️ Sensor 2
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-reset-layout">🔄 Reiniciar Planta</button>
        </div>
      </div>

      <div style="overflow-x:auto; padding:var(--space-md);">
        <div id="solar-park-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; min-width: 900px;">
          ${renderSolarParkGrid(arr, r, panel)}
        </div>
      </div>
    </div>
  `;
}

function renderSolarParkGrid(arr, r, panel) {
  // We model a 4x6 grid (24 slots)
  const rows = 4;
  const cols = 6;
  
  // Load layout from state. If missing or length !== 24, initialize default layout
  let layout = arr.layout || [];
  if (layout.length !== rows * cols) {
    layout = [];
    for (let i = 0; i < rows * cols; i++) {
      layout.push({ type: 'empty', id: `empty_${i}` });
    }
    // Auto-allocate strings to first slots
    for (let s = 0; s < arr.numStrings; s++) {
      layout[s] = { type: 'string', id: `string_${s + 1}`, label: `String ${s + 1}` };
    }
    // Auto-save this initial layout
    setTimeout(() => {
      state.set('arrayConfig.layout', layout);
    }, 0);
  }

  // Double check that we have exactly the right amount of strings.
  // If strings count changed, synchronize elements
  const currentStringIds = Array.from({ length: arr.numStrings }, (_, i) => `string_${i + 1}`);
  let layoutChanged = false;
  
  // Remove string elements in layout that no longer exist
  layout = layout.map(slot => {
    if (slot.type === 'string' && !currentStringIds.includes(slot.id)) {
      layoutChanged = true;
      return { type: 'empty', id: `empty_${Math.random().toString(36).substr(2, 9)}` };
    }
    return slot;
  });

  // Add new string elements that are not in the layout
  currentStringIds.forEach(sid => {
    const exists = layout.some(s => s.type === 'string' && s.id === sid);
    if (!exists) {
      // Find first empty slot
      const emptyIdx = layout.findIndex(s => s.type === 'empty');
      if (emptyIdx !== -1) {
        layout[emptyIdx] = { type: 'string', id: sid, label: `String ${sid.split('_')[1]}` };
        layoutChanged = true;
      }
    }
  });

  if (layoutChanged) {
    setTimeout(() => {
      state.set('arrayConfig.layout', layout);
    }, 0);
  }

  let html = '';
  
  // Calculate simulated temperature sensor values
  const sensor1Val = (r.tCell - 4.5).toFixed(1);
  const sensor2Val = (r.tCell - 2.1).toFixed(1);

  layout.forEach((slot, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;

    if (slot.type === 'string') {
      html += `
        <div class="grid-slot string-slot" draggable="true" data-index="${idx}" data-row="${row}" data-col="${col}" id="grid-item-${slot.id}" style="border: 1px solid var(--solar-amber-light); border-radius: var(--radius-md); padding: var(--space-md); background: linear-gradient(145deg, var(--bg-card), var(--bg-tertiary)); cursor: grab; text-align: center; box-shadow: var(--shadow-sm); position:relative;">
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--solar-amber); margin-bottom: 6px;">🔗 ${slot.label}</div>
          <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: left; display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; justify-content:space-between;"><span>Potencia:</span><strong class="mono" style="color:var(--solar-green);">${r.pmax_string.toFixed(0)} W</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Tensión:</span><strong class="mono">${r.vmp_string.toFixed(1)} V</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Corriente:</span><strong class="mono">${r.imp_string.toFixed(2)} A</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Temp Celda:</span><strong class="mono" style="color:var(--solar-orange);">${r.tCell.toFixed(1)}°C</strong></div>
          </div>
          <div style="display:flex; gap:2px; margin-top:8px; justify-content:center;">
            ${Array.from({ length: Math.min(arr.panelsPerString, 6) }).map(() => `<span style="width:6px; height:8px; background:var(--solar-blue); border-radius:1px; display:inline-block;"></span>`).join('')}
            ${arr.panelsPerString > 6 ? `<span style="font-size:0.6rem; color:var(--text-tertiary); line-height:8px;">+</span>` : ''}
          </div>
        </div>
      `;
    } else if (slot.type === 'sensor') {
      const sensorTemp = slot.id === 'palette-sensor-1' ? sensor1Val : sensor2Val;
      html += `
        <div class="grid-slot sensor-slot" draggable="true" data-index="${idx}" data-row="${row}" data-col="${col}" id="grid-item-${slot.id}" style="border: 1px solid var(--solar-blue); border-radius: var(--radius-md); padding: var(--space-md); background: rgba(59, 130, 246, 0.08); cursor: grab; text-align: center; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <div style="font-size: 1.5rem; margin-bottom: 2px;">🌡️</div>
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--solar-blue);">${slot.id === 'palette-sensor-1' ? 'Sensor 1' : 'Sensor 2'}</div>
          <div style="font-size: var(--text-md); font-weight: 700; color: var(--text-primary); margin-top: 4px;" class="mono">${sensorTemp}°C</div>
          <div style="font-size: 0.6rem; color: var(--text-tertiary); margin-top:2px;">Temp. Panel</div>
        </div>
      `;
    } else {
      // Empty slot (dropzone)
      html += `
        <div class="grid-slot empty-slot" data-index="${idx}" data-row="${row}" data-col="${col}" style="border: 1px dashed var(--border-primary); border-radius: var(--radius-md); min-height: 98px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 0.7rem; background: transparent; transition: background 0.2s;">
          <div>Soltar Aquí</div>
        </div>
      `;
    }
  });

  return html;
}

function getCardinal(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function getCompassEmoji(deg) {
  if (deg >= 337.5 || deg < 22.5) return '⬆️';
  if (deg < 67.5) return '↗️';
  if (deg < 112.5) return '➡️';
  if (deg < 157.5) return '↘️';
  if (deg < 202.5) return '⬇️';
  if (deg < 247.5) return '↙️';
  if (deg < 292.5) return '⬅️';
  return '↖️';
}

export function init() {
  const bindings = [
    { slider: 'slider-strings', input: 'input-strings', display: 'val-strings', key: 'numStrings' },
    { slider: 'slider-panels', input: 'input-panels', display: 'val-panels-per-string', key: 'panelsPerString' },
    { slider: 'slider-tilt', input: 'input-tilt', display: 'val-tilt', key: 'tiltAngle' },
    { slider: 'slider-azimuth', input: 'input-azimuth', display: 'val-azimuth', key: 'azimuthAngle' },
  ];

  bindings.forEach(({ slider, input, display, key }) => {
    const sl = document.getElementById(slider);
    const inp = document.getElementById(input);
    const disp = document.getElementById(display);

    const update = (val) => {
      val = parseInt(val);
      if (isNaN(val)) return;
      state.set(`arrayConfig.${key}`, val);
      if (sl) sl.value = val;
      if (inp) inp.value = val;
      if (disp) disp.textContent = val;
      
      // Update page KPIs and dynamic grid
      const freshR = calculateAll();
      const freshArr = state.get('arrayConfig');
      const freshPanel = state.get('panelSpecs');
      
      document.getElementById('stat-total-panels').textContent = freshArr.numStrings * freshArr.panelsPerString;
      document.getElementById('stat-total-power').innerHTML = `${(freshArr.numStrings * freshArr.panelsPerString * freshPanel.pmax / 1000).toFixed(2)}<span class="stat-unit">kWp</span>`;
      document.getElementById('stat-strings').textContent = freshArr.numStrings;
      document.getElementById('stat-tilt').innerHTML = `${freshR.activeTilt.toFixed(1)}<span class="stat-unit">°</span>`;
      
      const grid = document.getElementById('solar-park-grid');
      if (grid) grid.innerHTML = renderSolarParkGrid(freshArr, freshR, freshPanel);
      
      if (key === 'azimuthAngle') updateCompass(val);
      initDragAndDrop(); // Re-bind grid drag drop
    };

    if (sl) sl.addEventListener('input', (e) => update(e.target.value));
    if (inp) inp.addEventListener('input', (e) => update(e.target.value));
  });

  // Row spacing Pitch input
  const rowInput = document.getElementById('input-row-spacing');
  if (rowInput) {
    rowInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 6.0;
      state.set('arrayConfig.rowSpacing', val);
      // Rerender layout to show updated GCR
      const freshR = calculateAll();
      const freshArr = state.get('arrayConfig');
      const freshPanel = state.get('panelSpecs');
      const grid = document.getElementById('solar-park-grid');
      if (grid) grid.innerHTML = renderSolarParkGrid(freshArr, freshR, freshPanel);
      initDragAndDrop();
    });
  }

  // Tracker Type Selector
  const trackerSelect = document.getElementById('select-tracker-type');
  if (trackerSelect) {
    trackerSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      state.set('arrayConfig.trackerType', type);
      
      // Toggle controls
      const nsConfig = document.getElementById('tracker-ns-config');
      const staticAngles = document.getElementById('static-angles-config');
      
      if (nsConfig) nsConfig.style.display = type === 'axis-ns' ? 'block' : 'none';
      if (staticAngles) {
        staticAngles.style.opacity = type === 'fixed' ? '1' : '0.4';
        staticAngles.style.pointerEvents = type === 'fixed' ? 'auto' : 'none';
      }
      
      // Update compass / tracker status label
      const freshR = calculateAll();
      document.getElementById('stat-tilt').innerHTML = `${freshR.activeTilt.toFixed(1)}<span class="stat-unit">°</span>`;
      
      const compass = document.getElementById('compass-visual');
      if (compass) compass.innerHTML = getCompassEmoji(type === 'fixed' ? state.get('arrayConfig.azimuthAngle') : (type === 'axis-ns' ? 90 : freshR.sunAzimuth));
      
      const statusLabel = document.getElementById('azimuth-tracker-status');
      if (statusLabel) {
        statusLabel.innerHTML = type === 'fixed' 
          ? `Orientación Fija: <strong>${getCardinal(state.get('arrayConfig.azimuthAngle'))}</strong> (${state.get('arrayConfig.azimuthAngle')}°)` 
          : (type === 'axis-ns' ? `Seguidor Monoeje: E-W (Eje N-S) | Rotación: <strong>${freshR.trackerRotation.toFixed(1)}°</strong>` : `Seguidor Dual: Azimut <strong>${freshR.sunAzimuth.toFixed(1)}°</strong> | Elev. <strong>${freshR.sunElevation.toFixed(1)}°</strong>`);
      }

      // Re-render GCR display in backtracking
      const freshArr = state.get('arrayConfig');
      const freshPanel = state.get('panelSpecs');
      const grid = document.getElementById('solar-park-grid');
      if (grid) grid.innerHTML = renderSolarParkGrid(freshArr, freshR, freshPanel);
      initDragAndDrop();
    });
  }

  // Backtracking elements
  const btCheckbox = document.getElementById('checkbox-backtracking');
  if (btCheckbox) {
    btCheckbox.addEventListener('change', (e) => {
      const active = e.target.checked;
      state.set('arrayConfig.backtracking', active);
      const paramsDiv = document.getElementById('backtracking-params');
      if (paramsDiv) paramsDiv.style.display = active ? 'block' : 'none';
      
      // Update grid
      const freshR = calculateAll();
      document.getElementById('stat-tilt').innerHTML = `${freshR.activeTilt.toFixed(1)}<span class="stat-unit">°</span>`;
      const grid = document.getElementById('solar-park-grid');
      if (grid) grid.innerHTML = renderSolarParkGrid(state.get('arrayConfig'), freshR, state.get('panelSpecs'));
      initDragAndDrop();
    });
  }

  // Backtracking range sliders
  const btBindings = [
    { slider: 'slider-bt-start', display: 'val-bt-start', key: 'backtrackingStartHour' },
    { slider: 'slider-bt-end', display: 'val-bt-end', key: 'backtrackingEndHour' },
    { slider: 'slider-bt-corr', display: 'val-bt-corr', key: 'backtrackingCorrection' },
  ];

  btBindings.forEach(({ slider, display, key }) => {
    const sl = document.getElementById(slider);
    const disp = document.getElementById(display);
    if (sl) {
      sl.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.set(`arrayConfig.${key}`, val);
        if (disp) disp.textContent = val;
        
        // Update calculations
        const freshR = calculateAll();
        document.getElementById('stat-tilt').innerHTML = `${freshR.activeTilt.toFixed(1)}<span class="stat-unit">°</span>`;
        const grid = document.getElementById('solar-park-grid');
        if (grid) grid.innerHTML = renderSolarParkGrid(state.get('arrayConfig'), freshR, state.get('panelSpecs'));
        initDragAndDrop();
      });
    }
  });

  // Reset physical layout button
  document.getElementById('btn-reset-layout')?.addEventListener('click', () => {
    const arr = state.get('arrayConfig');
    const rows = 4;
    const cols = 6;
    const layout = [];
    for (let i = 0; i < rows * cols; i++) {
      layout.push({ type: 'empty', id: `empty_${i}` });
    }
    for (let s = 0; s < arr.numStrings; s++) {
      layout[s] = { type: 'string', id: `string_${s + 1}`, label: `String ${s + 1}` };
    }
    state.set('arrayConfig.layout', layout);
    
    // Rerender layout
    const grid = document.getElementById('solar-park-grid');
    if (grid) grid.innerHTML = renderSolarParkGrid(arr, calculateAll(), state.get('panelSpecs'));
    initDragAndDrop();
  });

  // Bind Drag & Drop Events initially
  initDragAndDrop();
}

function initDragAndDrop() {
  const slots = document.querySelectorAll('.grid-slot');
  const paletteSensors = document.querySelectorAll('.draggable-sensor');

  // Dragstart for elements on grid
  slots.forEach(slot => {
    if (!slot.classList.contains('empty-slot')) {
      slot.addEventListener('dragstart', (e) => {
        // Find actual id
        let id = '';
        if (slot.classList.contains('string-slot')) {
          id = slot.id.replace('grid-item-', '');
        } else if (slot.classList.contains('sensor-slot')) {
          id = slot.id.replace('grid-item-', '');
        }
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.setData('source-index', slot.dataset.index);
      });
    }
  });

  // Dragstart for elements in palette (sensors)
  paletteSensors.forEach(sensor => {
    sensor.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', sensor.id.replace('palette-', ''));
      e.dataTransfer.setData('source-index', 'palette');
    });
  });

  // Grid slots dragover / leave / drop handlers
  slots.forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.style.background = 'rgba(245, 158, 11, 0.05)';
    });

    slot.addEventListener('dragleave', () => {
      slot.style.background = '';
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.style.background = '';

      const elementId = e.dataTransfer.getData('text/plain');
      const sourceIndex = e.dataTransfer.getData('source-index');
      const targetIndex = parseInt(slot.dataset.index);

      if (sourceIndex === '') return;

      const arr = state.get('arrayConfig');
      const layout = [...arr.layout];

      // If dragging a sensor from the palette
      if (sourceIndex === 'palette') {
        // Place sensor in the target slot (if target is empty)
        if (layout[targetIndex].type === 'empty') {
          layout[targetIndex] = { type: 'sensor', id: elementId };
          state.set('arrayConfig.layout', layout);
        } else {
          alert('El slot de destino debe estar vacío para colocar un sensor.');
        }
      } else {
        // Dragging an existing grid element
        const srcIdx = parseInt(sourceIndex);
        if (srcIdx === targetIndex) return;

        // Swap elements in layout
        const temp = layout[srcIdx];
        layout[srcIdx] = layout[targetIndex];
        layout[targetIndex] = temp;

        state.set('arrayConfig.layout', layout);
      }

      // Rerender grid
      const grid = document.getElementById('solar-park-grid');
      if (grid) grid.innerHTML = renderSolarParkGrid(arr, calculateAll(), state.get('panelSpecs'));
      
      // Re-initialize drag handlers on new DOM
      initDragAndDrop();
    });
  });
}

function updateCompass(deg) {
  const compass = document.getElementById('compass-visual');
  if (compass) compass.innerHTML = getCompassEmoji(deg);
  const azDisp = document.getElementById('val-azimuth');
  if (azDisp) {
    const parent = azDisp.closest('.slider-value-display');
    if (parent) {
      const unitEl = parent.querySelector('.slider-unit');
      if (unitEl) unitEl.textContent = `° ${getCardinal(deg)}`;
    }
  }
}
