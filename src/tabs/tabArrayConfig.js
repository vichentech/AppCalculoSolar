/**
 * AppSolar — Tab: Configuración del Parque
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';

const CABLE_FIELDS = [
  { key: 'cableLength', label: 'Longitud Cable DC (Hasta Inversor)', unit: 'm', min: 1, max: 500, step: 1 },
  { key: 'cableSection', label: 'Sección Cable DC', unit: 'mm²', min: 1.5, max: 240, step: 0.5 },
];

export function render() {
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const loc = state.get('location');
  const r = calculateAll();
  
  const groups = arr.groups || [];

  const renderCable = (g) => `
    <div style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-primary); margin-bottom: 8px;">
      <h4 style="margin: 0 0 8px 0; font-size: 0.85rem; color: var(--solar-blue);">${g.name}</h4>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md);">
        ${CABLE_FIELDS.map(f => `
          <div class="form-group">
            <label class="form-label">${f.label} <span class="unit">[${f.unit}]</span></label>
            <div class="form-input-with-unit">
              <input class="form-input group-cable-input" type="number" data-group="${g.id}" data-key="${f.key}" value="${g[f.key] !== undefined ? g[f.key] : (cond[f.key] || '')}" min="${f.min}" max="${f.max}" step="${f.step}">
              <span class="input-unit">${f.unit}</span>
            </div>
          </div>
        `).join('')}
        <div class="form-group">
          <label class="form-label">Material del Conductor</label>
          <select class="form-select group-cable-select" data-group="${g.id}" data-key="cableMaterial">
            <option value="cu" ${g.cableMaterial === 'cu' || (!g.cableMaterial && cond.cableMaterial === 'cu') ? 'selected' : ''}>Cobre (Cu) — ρ=0.0172</option>
            <option value="al" ${g.cableMaterial === 'al' || (!g.cableMaterial && cond.cableMaterial === 'al') ? 'selected' : ''}>Aluminio (Al) — ρ=0.0283</option>
          </select>
        </div>
      </div>
    </div>
  `;
  const invertersCount = groups.length;
  const totalPanels = r.totalPanels;
  const panelSpecs = state.get('panelSpecs') || {pmax:0};
  const totalPower = (totalPanels * panelSpecs.pmax / 1000).toFixed(2);
  
  // Óptimos teóricos básicos
  const optimalTilt = Math.max(0, Math.round(loc.latitude * 0.87)); // Regla heurística común
  const optimalAzimuth = loc.latitude >= 0 ? 180 : 0; // Sur en hemisferio norte, Norte en sur

  const renderGroupRow = (g, i) => `
    <div class="group-row" style="display:flex; gap:10px; align-items:flex-end; margin-bottom:10px; padding:10px; background:var(--bg-card); border:1px solid var(--border-primary); border-radius:var(--radius-md);">
      <div class="form-group" style="flex:2; margin:0;">
        <label class="form-label" style="font-size:0.75rem;">Nombre del Grupo</label>
        <input type="text" class="form-input ds-arr-group-input" data-idx="${i}" data-key="name" value="${g.name}">
      </div>
      <div class="form-group" style="flex:1; margin:0;">
        <label class="form-label" style="font-size:0.75rem;">Strings</label>
        <input type="number" class="form-input ds-arr-group-input" data-idx="${i}" data-key="numStrings" min="1" value="${g.numStrings}">
      </div>
      <div class="form-group" style="flex:1; margin:0;">
        <label class="form-label" style="font-size:0.75rem;">Paneles/String</label>
        <input type="number" class="form-input ds-arr-group-input" data-idx="${i}" data-key="panelsPerString" min="1" value="${g.panelsPerString}">
      </div>
      <div class="form-group" style="flex:0; margin:0;">
        <button class="btn btn-ghost btn-delete-group tooltip-trigger" data-idx="${i}" data-tooltip="Eliminar Grupo" style="color:var(--solar-red); padding:8px;" ${groups.length <= 1 ? 'disabled' : ''}>🗑️</button>
      </div>
    </div>
  `;

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🔗</span> Configuración del Parque</h2>
        <p class="page-subtitle">Configura los grupos de inversores, formato de strings, y la estructura de soporte de los paneles.</p>
      </div>
    </div>

    <!-- KPIs del Parque -->
    <div class="stats-row" style="margin-bottom: var(--space-lg);">
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-label" style="display:flex; align-items:center; justify-content:center; gap:4px;">
          Inversores / Grupos
          <span class="tooltip-trigger" style="color:var(--text-secondary); cursor:help; font-size:12px;" data-tooltip="Número de grupos de inversores definidos en la configuración actual.">ℹ️</span>
        </div>
        <div class="stat-value" id="stat-inverters">${invertersCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔢</div>
        <div class="stat-label" style="display:flex; align-items:center; justify-content:center; gap:4px;">
          Total Paneles
          <span class="tooltip-trigger" style="color:var(--text-secondary); cursor:help; font-size:12px;" data-tooltip="Suma total de paneles: Σ (Strings por grupo × Paneles por string).">ℹ️</span>
        </div>
        <div class="stat-value" id="stat-total-panels">${totalPanels}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-label" style="display:flex; align-items:center; justify-content:center; gap:4px;">
          Potencia Pico Total
          <span class="tooltip-trigger" style="color:var(--text-secondary); cursor:help; font-size:12px;" data-tooltip="Potencia nominal teórica (STC).&#10;Fórmula: Σ [Paneles × Pmax_STC_Panel]&#10;No tiene en cuenta pérdidas térmicas, inclinación ni irradiancia (se evalúan en Análisis).">ℹ️</span>
        </div>
        <div class="stat-value" id="stat-total-power" style="display:flex; flex-direction:column; align-items:center;">
          <div>${totalPower}<span class="stat-unit">kWp</span></div>
          <div style="font-size: 0.65rem; color: var(--text-tertiary); font-weight: normal; margin-top: 2px;" id="stat-power-breakdown">
            ${r.groupsData ? r.groupsData.map(g => `${g.name}: ${(g.numStrings * g.panelsPerString * panelSpecs.pmax / 1000).toFixed(2)}`).join(' | ') : ''}
          </div>
        </div>
      </div>
      <div class="stat-card" style="border-color: var(--solar-blue);">
        <div class="stat-icon">📐</div>
        <div class="stat-label" style="display:flex; align-items:center; justify-content:center; gap:4px;">
          Inclinación Activa
          <span class="tooltip-trigger" style="color:var(--text-secondary); cursor:help; font-size:12px;" data-tooltip="Ángulo actual de inclinación respecto al plano horizontal. Si usas seguidores solares, varía dinámicamente con la hora.">ℹ️</span>
        </div>
        <div class="stat-value" id="stat-tilt">${r.activeTilt.toFixed(1)}<span class="stat-unit">°</span></div>
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <!-- Pestañas -->
      <div style="display:flex; border-bottom:1px solid var(--border-primary); background:var(--bg-tertiary); overflow-x:auto;">
        <button class="arr-tab-btn active" data-target="tab-groups" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-primary); background:none; border:none; border-bottom:3px solid var(--solar-amber); cursor:pointer; white-space:nowrap;">🔌 Grupos o Inversores</button>
        <button class="arr-tab-btn" data-target="tab-format" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-secondary); background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap;">📏 Formato de String</button>
        <button class="arr-tab-btn" data-target="tab-structure" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-secondary); background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap;">📐 Estructura y Seguimiento</button>
        <button class="arr-tab-btn" data-target="tab-conditions" style="padding:12px 20px; font-weight:600; font-size:0.9rem; color:var(--text-secondary); background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap;">🌡️ Condiciones Instalación</button>
      </div>

      <!-- Contenedor -->
      <div style="padding:var(--space-md);">
        
        <!-- Tab 2: Grupos de Inversores -->
        <div class="arr-tab-pane active" id="tab-groups">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
            <h3 style="font-size: var(--text-base); margin:0;">🔌 Grupos o Inversores</h3>
            <button class="btn btn-secondary btn-sm" id="btn-add-group">➕ Añadir Grupo</button>
          </div>
          <div id="groups-container">
            ${groups.map(renderGroupRow).join('')}
          </div>
        </div>

        <!-- Tab 1: Formato de String -->
        <div class="arr-tab-pane" id="tab-format" style="display:none;">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">📏 Formato Físico del String</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label" style="display:flex; gap:4px; align-items:center;">Orientación Módulos <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Vertical (Portrait): El panel se coloca con su lado largo en vertical. Horizontal (Landscape): Su lado largo en horizontal. Esto afecta a cómo se dibuja en el mapa de planta.">ℹ️</span></label>
              <select class="form-select ds-arr-select" id="select-panel-orientation" data-key="panelOrientation">
                <option value="portrait" ${arr.panelOrientation !== 'landscape' ? 'selected' : ''}>Vertical (Portrait)</option>
                <option value="landscape" ${arr.panelOrientation === 'landscape' ? 'selected' : ''}>Horizontal (Landscape)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" style="display:flex; gap:4px; align-items:center;">Filas por Estructura <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Cantidad de paneles dispuestos en el eje corto de la estructura metálica. Por ejemplo, 2 significa '2 en Vertical' (2V) o '2 en Horizontal' (2H).">ℹ️</span></label>
              <input type="number" class="form-input ds-arr-input" id="input-rows-structure" min="1" max="10" value="${arr.rowsPerStructure || 1}" data-key="rowsPerStructure">
            </div>

            <div class="form-group">
              <label class="form-label" style="display:flex; gap:4px; align-items:center;">Pitch (Distancia filas) <span class="unit">[m]</span> <span class="tooltip-trigger" style="font-size:11px;" data-tooltip="Distancia (centro a centro) entre cada mesa o seguidor adyacente. Define cuánto espacio hay en total entre hileras.">ℹ️</span></label>
              <div class="form-input-with-unit">
                <input class="form-input ds-arr-input" type="number" id="input-row-spacing" value="${arr.rowSpacing}" min="0.5" step="0.1" data-key="rowSpacing">
                <span class="input-unit">m</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Estructura y Seguimiento -->
        <div class="arr-tab-pane" id="tab-structure" style="display:none;">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">📐 Estructura y Seguimiento Solar</h3>
          <div class="form-group" style="max-width:400px; margin-bottom:var(--space-md);">
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
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm);">
                <div style="font-size: var(--text-xs); font-weight: 700; color: var(--solar-amber); text-transform: uppercase;">Parámetros Estáticos</div>
                <label style="font-size:0.75rem; display:flex; align-items:center; gap:4px;">
                  <input type="checkbox" id="checkbox-optimal-tilt" ${arr.useOptimalTilt ? 'checked' : ''} style="accent-color:var(--solar-amber);">
                  Usar Óptimo (T: ${optimalTilt}°, A: ${optimalAzimuth}°)
                </label>
              </div>
              
              <div class="grid-2" style="gap:var(--space-md)">
                <div class="form-group">
                  <label class="form-label">Tilt (Inclinación) <span class="unit">[°]</span></label>
                  <div class="form-input-with-unit">
                    <input type="number" class="form-input ds-arr-input" id="input-tilt" min="0" max="90" value="${arr.useOptimalTilt ? optimalTilt : arr.tiltAngle}" data-key="tiltAngle" ${arr.useOptimalTilt ? 'disabled' : ''}>
                    <span class="input-unit">°</span>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Azimut <span class="unit">[°]</span></label>
                  <div class="form-input-with-unit">
                    <input type="number" class="form-input ds-arr-input" id="input-azimuth" min="0" max="360" value="${arr.useOptimalTilt ? optimalAzimuth : arr.azimuthAngle}" data-key="azimuthAngle" ${arr.useOptimalTilt ? 'disabled' : ''}>
                    <span class="input-unit">°</span>
                  </div>
                </div>
              </div>

              <div class="mt-md" style="text-align:center;">
                <div id="compass-visual" style="font-size:2.5rem; line-height:1;">
                  ${getCompassEmoji(arr.trackerType === 'fixed' ? (arr.useOptimalTilt ? optimalAzimuth : arr.azimuthAngle) : (arr.trackerType === 'axis-ns' ? 90 : r.sunAzimuth))}
                </div>
                <div style="color:var(--text-secondary); font-size:var(--text-xs); margin-top:4px;" id="azimuth-tracker-status">
                  ${arr.trackerType === 'fixed' 
                    ? `Fija: <strong>${getCardinal(arr.useOptimalTilt ? optimalAzimuth : arr.azimuthAngle)}</strong>` 
                    : (arr.trackerType === 'axis-ns' ? `E-W | Rotación: <strong>${r.trackerRotation.toFixed(1)}°</strong>` : `Azi: <strong>${r.sunAzimuth.toFixed(1)}°</strong> | Ele: <strong>${r.sunElevation.toFixed(1)}°</strong>`)}
                </div>
              </div>
            </div>

            <!-- Tracking options -->
            <div id="tracker-config-section" style="display: ${arr.trackerType !== 'fixed' ? 'block' : 'none'}; border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--space-md); background: var(--bg-tertiary);">
              
              <div class="form-group" style="margin-bottom:var(--space-md);">
                <label class="form-label">Coeficiente de Realidad Seguidor</label>
                <input class="form-input ds-arr-input" type="number" step="0.01" min="0" max="1" value="${arr.trackerCorrection || 1.0}" data-key="trackerCorrection">
              </div>

              <div id="tracker-ns-config" style="display: ${arr.trackerType === 'axis-ns' ? 'block' : 'none'};">
                <div class="divider"></div>
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
                    <label class="form-label" style="font-size:0.75rem;">Factor Corrección GCR</label>
                    <input class="form-input ds-arr-input" type="number" step="0.01" value="${arr.backtrackingCorrection}" data-key="backtrackingCorrection">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 4: Condiciones Instalación -->
        <div class="arr-tab-pane" id="tab-conditions" style="display:none;">
          <h3 style="font-size: var(--text-base); margin-bottom:var(--space-md);">🌡️ Condiciones Instalación y Cableado</h3>
          <div class="card details-panel" open style="padding:0;">
            <div class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center; padding:16px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <h3 style="font-size: var(--text-base); margin:0;">🔌 Pérdidas por Cableado DC</h3>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:normal;" onclick="event.stopPropagation()">
                  <input type="checkbox" id="checkbox-cable-loss" ${cond.cableLossEnabled ? 'checked' : ''} style="accent-color:var(--solar-amber); width:16px; height:16px;">
                  Habilitar cálculo de pérdidas
                </label>
              </div>
            </div>
            <div class="details-content" id="cable-content-area" style="opacity: ${cond.cableLossEnabled ? '1' : '0.4'}; pointer-events: ${cond.cableLossEnabled ? 'auto' : 'none'}; transition: opacity 0.2s; padding:16px;">
              <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-md);">Estas pérdidas se aplican individualmente a cada inversor/grupo y se suman a nivel global de parque.</p>
              <div style="display:flex; flex-direction:column; gap: var(--space-sm);">
                ${groups.map(renderCable).join('')}
              </div>
            </div>
          </div>
        </div>

      </div>
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
    const loc = state.get('location');
    
    const optimalAzimuth = loc.latitude >= 0 ? 180 : 0;
    const currentAzimuth = arr.useOptimalTilt ? optimalAzimuth : arr.azimuthAngle;
    
    document.getElementById('stat-inverters').textContent = (arr.groups || []).length;
    document.getElementById('stat-total-panels').textContent = freshR.totalPanels;
    
    const statPower = document.getElementById('stat-total-power');
    if (statPower) {
      const panelSpecs = state.get('panelSpecs') || {pmax:0};
      const mainVal = statPower.querySelector('div:first-child');
      const breakdown = document.getElementById('stat-power-breakdown');
      if (mainVal) mainVal.innerHTML = `${(freshR.totalPanels * panelSpecs.pmax / 1000).toFixed(2)}<span class="stat-unit">kWp</span>`;
      if (breakdown) breakdown.innerHTML = freshR.groupsData ? freshR.groupsData.map(g => `${g.name}: ${(g.numStrings * g.panelsPerString * panelSpecs.pmax / 1000).toFixed(2)}`).join(' | ') : '';
    }

    document.getElementById('stat-tilt').innerHTML = `${freshR.activeTilt.toFixed(1)}<span class="stat-unit">°</span>`;

    const compass = document.getElementById('compass-visual');
    if (compass) compass.innerHTML = getCompassEmoji(arr.trackerType === 'fixed' ? currentAzimuth : (arr.trackerType === 'axis-ns' ? 90 : freshR.sunAzimuth));
    
    const statusLabel = document.getElementById('azimuth-tracker-status');
    if (statusLabel) {
      statusLabel.innerHTML = arr.trackerType === 'fixed' 
        ? `Fija: <strong>${getCardinal(currentAzimuth)}</strong> (${currentAzimuth}°)` 
        : (arr.trackerType === 'axis-ns' ? `E-W | Rotación: <strong>${freshR.trackerRotation.toFixed(1)}°</strong>` : `Azi: <strong>${freshR.sunAzimuth.toFixed(1)}°</strong> | Ele: <strong>${freshR.sunElevation.toFixed(1)}°</strong>`);
    }
  };

  // Tabs
  document.querySelectorAll('.arr-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.arr-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = 'var(--text-secondary)';
        b.style.borderBottomColor = 'transparent';
      });
      document.querySelectorAll('.arr-tab-pane').forEach(p => p.style.display = 'none');
      
      const targetId = e.currentTarget.dataset.target;
      e.currentTarget.classList.add('active');
      e.currentTarget.style.color = 'var(--text-primary)';
      e.currentTarget.style.borderBottomColor = 'var(--solar-amber)';
      
      const pane = document.getElementById(targetId);
      if (pane) pane.style.display = 'block';
    });
  });

  // Groups Logic
  const handleGroupInputs = () => {
    document.querySelectorAll('.ds-arr-group-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const key = e.target.dataset.key;
        let val = e.target.value;
        if (key === 'numStrings' || key === 'panelsPerString') {
          val = parseInt(val, 10) || 1;
        }
        
        const currentGroups = JSON.parse(JSON.stringify(state.get('arrayConfig.groups') || []));
        if (currentGroups[idx]) {
          currentGroups[idx][key] = val;
          state.set('arrayConfig.groups', currentGroups);
          updateKPIs();
        }
      });
    });

    document.querySelectorAll('.btn-delete-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        const currentGroups = JSON.parse(JSON.stringify(state.get('arrayConfig.groups') || []));
        if (currentGroups.length > 1) {
          currentGroups.splice(idx, 1);
          state.set('arrayConfig.groups', currentGroups);
          const contentArea = document.getElementById('tab-content');
          if (contentArea) {
             contentArea.innerHTML = render();
             init();
             document.querySelector('[data-target="tab-groups"]').click();
          }
        }
      });
    });
  };
  handleGroupInputs();

  const btnAdd = document.getElementById('btn-add-group');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const currentGroups = JSON.parse(JSON.stringify(state.get('arrayConfig.groups') || []));
      const newId = 'g' + (Date.now());
      currentGroups.push({
        id: newId,
        name: `Grupo ${currentGroups.length + 1}`,
        numStrings: 4,
        panelsPerString: 12
      });
      state.set('arrayConfig.groups', currentGroups);
      const contentArea = document.getElementById('tab-content');
      if (contentArea) {
         contentArea.innerHTML = render();
         init();
         document.querySelector('[data-target="tab-groups"]').click();
      }
    });
  }

  // Base Array inputs
  document.querySelectorAll('.ds-arr-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const val = parseFloat(e.target.value) || 0;
      state.set(`arrayConfig.${key}`, val);
      updateKPIs();
    });
  });

  document.querySelectorAll('.ds-arr-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      state.set(`arrayConfig.${key}`, e.target.value);
      updateKPIs();
    });
  });

  // Optimal Tilt Checkbox
  const cbOptimal = document.getElementById('checkbox-optimal-tilt');
  if (cbOptimal) {
    cbOptimal.addEventListener('change', (e) => {
      state.set('arrayConfig.useOptimalTilt', e.target.checked);
      
      const loc = state.get('location');
      const optimalTilt = Math.max(0, Math.round(loc.latitude * 0.87));
      const optimalAzimuth = loc.latitude >= 0 ? 180 : 0;
      
      const inTilt = document.getElementById('input-tilt');
      const inAzi = document.getElementById('input-azimuth');
      
      if (e.target.checked) {
        if (inTilt) { inTilt.value = optimalTilt; inTilt.disabled = true; }
        if (inAzi) { inAzi.value = optimalAzimuth; inAzi.disabled = true; }
        state.set('arrayConfig.tiltAngle', optimalTilt);
        state.set('arrayConfig.azimuthAngle', optimalAzimuth);
      } else {
        if (inTilt) inTilt.disabled = false;
        if (inAzi) inAzi.disabled = false;
      }
      updateKPIs();
    });
  }

  // Tracker Type Selector
  const trackerSelect = document.getElementById('select-tracker-type');
  if (trackerSelect) {
    trackerSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      state.set('arrayConfig.trackerType', type);
      
      const tcSection = document.getElementById('tracker-config-section');
      const nsConfig = document.getElementById('tracker-ns-config');
      const staticAngles = document.getElementById('static-angles-config');
      
      if (tcSection) tcSection.style.display = type !== 'fixed' ? 'block' : 'none';
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

  // Cable Loss Checkbox
  const cbCableLoss = document.getElementById('checkbox-cable-loss');
  if (cbCableLoss) {
    cbCableLoss.addEventListener('change', (e) => {
      state.set('conditions.cableLossEnabled', e.target.checked);
      const area = document.getElementById('cable-content-area');
      if (area) {
        area.style.opacity = e.target.checked ? '1' : '0.4';
        area.style.pointerEvents = e.target.checked ? 'auto' : 'none';
      }
      updateKPIs();
    });
  }

  // Group Cable inputs
  const updateGroupCable = (e) => {
    const groupId = e.target.dataset.group;
    const key = e.target.dataset.key;
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    
    const arr = state.get('arrayConfig');
    const groups = arr.groups || [];
    const grp = groups.find(g => g.id === groupId);
    if (grp) {
      grp[key] = val;
      state.set('arrayConfig.groups', groups);
      updateKPIs();
    }
  };

  document.querySelectorAll('.group-cable-input').forEach(input => {
    input.addEventListener('input', updateGroupCable);
  });
  document.querySelectorAll('.group-cable-select').forEach(sel => {
    sel.addEventListener('change', updateGroupCable);
  });
}
