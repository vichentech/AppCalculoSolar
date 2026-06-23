/**
 * AppSolar — Tab: Configuración del Array Solar
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';

export function render() {
  const arr = state.get('arrayConfig');
  const panel = state.get('panelSpecs');
  const r = calculateAll();
  const totalPanels = arr.numStrings * arr.panelsPerString;
  const totalPower = (totalPanels * panel.pmax / 1000).toFixed(2);

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🔗</span> Configuración del Array</h2>
        <p class="page-subtitle">Configura los parámetros eléctricos de agrupación (strings) y las estructuras mecánicas (seguidores).</p>
      </div>
    </div>

    <!-- KPIs del Parque -->
    <div class="stats-row" style="margin-bottom: var(--space-lg);">
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

    <div class="accordion-container" style="display:flex; flex-direction:column; gap:var(--space-md);">
      
      <!-- Panel 1: Eléctrica -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">🔗 Configuración de Strings</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
          
          <div class="form-group">
            <label class="form-label">Número de Strings <span class="tooltip-trigger" data-tooltip="Cada string es un conjunto de paneles en serie.">i</span></label>
            <input type="number" class="form-input ds-arr-input" id="input-strings" min="1" max="100" value="${arr.numStrings}" data-key="numStrings">
          </div>

          <div class="form-group">
            <label class="form-label">Paneles por String <span class="tooltip-trigger" data-tooltip="Módulos en serie. Define la tensión total.">i</span></label>
            <input type="number" class="form-input ds-arr-input" id="input-panels" min="1" max="60" value="${arr.panelsPerString}" data-key="panelsPerString">
          </div>

          <div class="form-group">
            <label class="form-label">Pitch (Distancia filas) <span class="unit">[m]</span></label>
            <div class="form-input-with-unit">
              <input class="form-input ds-arr-input" type="number" id="input-row-spacing" value="${arr.rowSpacing}" min="0.5" step="0.1" data-key="rowSpacing">
              <span class="input-unit">m</span>
            </div>
          </div>

        </div>
      </details>

      <!-- Panel 2: Estructura y Orientación -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">📐 Estructura y Seguimiento Solar</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md">
          
          <div class="form-group" style="max-width:300px; margin-bottom:var(--space-md);">
            <label class="form-label">Tipo de Estructura</label>
            <select class="form-select" id="select-tracker-type">
              <option value="fixed" ${arr.trackerType === 'fixed' ? 'selected' : ''}>Fijo (Inclinación Estática)</option>
              <option value="axis-ns" ${arr.trackerType === 'axis-ns' ? 'selected' : ''}>Seguidor 1 Eje H-NS (Este-Oeste)</option>
              <option value="dual-axis" ${arr.trackerType === 'dual-axis' ? 'selected' : ''}>Seguidor 2 Ejes (Completo)</option>
            </select>
          </div>

          <div class="grid-2" style="gap:var(--space-lg); align-items:start;">
            <!-- Ángulos Fijos -->
            <div id="static-angles-config" style="opacity: ${arr.trackerType === 'fixed' ? '1' : '0.4'}; pointer-events: ${arr.trackerType === 'fixed' ? 'auto' : 'none'}; transition: opacity 0.2s;">
              <div style="font-size: var(--text-xs); font-weight: 700; color: var(--solar-amber); text-transform: uppercase; margin-bottom:var(--space-sm);">Parámetros Estáticos</div>
              
              <div class="grid-2" style="gap:var(--space-md)">
                <div class="form-group">
                  <label class="form-label">Tilt (Inclinación) <span class="unit">[°]</span></label>
                  <div class="form-input-with-unit">
                    <input type="number" class="form-input ds-arr-input" id="input-tilt" min="0" max="90" value="${arr.tiltAngle}" data-key="tiltAngle">
                    <span class="input-unit">°</span>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Azimut <span class="unit">[°]</span></label>
                  <div class="form-input-with-unit">
                    <input type="number" class="form-input ds-arr-input" id="input-azimuth" min="0" max="360" value="${arr.azimuthAngle}" data-key="azimuthAngle">
                    <span class="input-unit">°</span>
                  </div>
                </div>
              </div>

              <div class="mt-md" style="text-align:center;">
                <div id="compass-visual" style="font-size:2.5rem; line-height:1;">
                  ${getCompassEmoji(arr.trackerType === 'fixed' ? arr.azimuthAngle : (arr.trackerType === 'axis-ns' ? 90 : r.sunAzimuth))}
                </div>
                <div style="color:var(--text-secondary); font-size:var(--text-xs); margin-top:4px;" id="azimuth-tracker-status">
                  ${arr.trackerType === 'fixed' 
                    ? `Fija: <strong>${getCardinal(arr.azimuthAngle)}</strong> (${arr.azimuthAngle}°)` 
                    : (arr.trackerType === 'axis-ns' ? `E-W | Rotación: <strong>${r.trackerRotation.toFixed(1)}°</strong>` : `Azi: <strong>${r.sunAzimuth.toFixed(1)}°</strong> | Ele: <strong>${r.sunElevation.toFixed(1)}°</strong>`)}
                </div>
              </div>
            </div>

            <!-- Backtracking -->
            <div id="tracker-ns-config" style="display: ${arr.trackerType === 'axis-ns' ? 'block' : 'none'}; border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--space-md); background: var(--bg-tertiary);">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:var(--space-md);">
                <input type="checkbox" id="checkbox-backtracking" ${arr.backtracking ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--solar-amber); cursor:pointer;">
                <label for="checkbox-backtracking" style="font-weight:600; cursor:pointer; font-size:var(--text-sm);">Habilitar Backtracking</label>
              </div>

              <div id="backtracking-params" style="display: ${arr.backtracking ? 'block' : 'none'};">
                <div class="grid-2" style="gap:var(--space-md)">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.75rem;">Hora Límite Mañana</label>
                    <div class="form-input-with-unit">
                      <input class="form-input ds-arr-input" type="number" step="0.5" value="${arr.backtrackingStartHour}" data-key="backtrackingStartHour">
                      <span class="input-unit">h</span>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.75rem;">Hora Límite Tarde</label>
                    <div class="form-input-with-unit">
                      <input class="form-input ds-arr-input" type="number" step="0.5" value="${arr.backtrackingEndHour}" data-key="backtrackingEndHour">
                      <span class="input-unit">h</span>
                    </div>
                  </div>
                </div>
                <div class="form-group mt-sm">
                  <label class="form-label" style="font-size:0.75rem;">Factor Corrección</label>
                  <input class="form-input ds-arr-input" type="number" step="0.01" value="${arr.backtrackingCorrection}" data-key="backtrackingCorrection">
                </div>
                <div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:8px;">
                  GCR: <strong class="mono" style="color:var(--solar-blue);">${((panel.width / 1000) / (arr.rowSpacing || 6.0)).toFixed(3)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;
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
  const updateKPIs = () => {
    const freshR = calculateAll();
    const arr = state.get('arrayConfig');
    const panel = state.get('panelSpecs');
    
    document.getElementById('stat-total-panels').textContent = arr.numStrings * arr.panelsPerString;
    document.getElementById('stat-total-power').innerHTML = `${(arr.numStrings * arr.panelsPerString * panel.pmax / 1000).toFixed(2)}<span class="stat-unit">kWp</span>`;
    document.getElementById('stat-strings').textContent = arr.numStrings;
    document.getElementById('stat-tilt').innerHTML = `${freshR.activeTilt.toFixed(1)}<span class="stat-unit">°</span>`;

    updateTrackerStatus(freshR, arr);
  };

  const updateTrackerStatus = (r, arr) => {
    const compass = document.getElementById('compass-visual');
    if (compass) compass.innerHTML = getCompassEmoji(arr.trackerType === 'fixed' ? arr.azimuthAngle : (arr.trackerType === 'axis-ns' ? 90 : r.sunAzimuth));
    
    const statusLabel = document.getElementById('azimuth-tracker-status');
    if (statusLabel) {
      statusLabel.innerHTML = arr.trackerType === 'fixed' 
        ? `Fija: <strong>${getCardinal(arr.azimuthAngle)}</strong> (${arr.azimuthAngle}°)` 
        : (arr.trackerType === 'axis-ns' ? `E-W | Rotación: <strong>${r.trackerRotation.toFixed(1)}°</strong>` : `Azi: <strong>${r.sunAzimuth.toFixed(1)}°</strong> | Ele: <strong>${r.sunElevation.toFixed(1)}°</strong>`);
    }
  };

  // Bind inputs
  document.querySelectorAll('.ds-arr-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const val = parseFloat(e.target.value) || 0;
      state.set(`arrayConfig.${key}`, val);
      updateKPIs();
    });
  });

  // Tracker Type Selector
  const trackerSelect = document.getElementById('select-tracker-type');
  if (trackerSelect) {
    trackerSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      state.set('arrayConfig.trackerType', type);
      
      const nsConfig = document.getElementById('tracker-ns-config');
      const staticAngles = document.getElementById('static-angles-config');
      
      if (nsConfig) nsConfig.style.display = type === 'axis-ns' ? 'block' : 'none';
      if (staticAngles) {
        staticAngles.style.opacity = type === 'fixed' ? '1' : '0.4';
        staticAngles.style.pointerEvents = type === 'fixed' ? 'auto' : 'none';
      }
      updateKPIs();
    });
  }

  // Backtracking checkbox
  const btCheckbox = document.getElementById('checkbox-backtracking');
  if (btCheckbox) {
    btCheckbox.addEventListener('change', (e) => {
      const active = e.target.checked;
      state.set('arrayConfig.backtracking', active);
      const paramsDiv = document.getElementById('backtracking-params');
      if (paramsDiv) paramsDiv.style.display = active ? 'block' : 'none';
      updateKPIs();
    });
  }

  // Detail accordion icon toggles
  document.querySelectorAll('details.details-panel').forEach(detail => {
    detail.addEventListener('toggle', () => {
      const icon = detail.querySelector('.details-icon');
      if (icon) icon.style.transform = detail.open ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  });
}
