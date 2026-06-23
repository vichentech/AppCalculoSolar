/**
 * AppSolar — Tab: Diseño en Planta (Park Builder)
 * Mapa interactivo con Leaflet para drag & drop de Strings Individuales e Inversores
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';

let mapInstance = null;
// parkElements -> { id, type: 'string'|'inverter', data: { groupId, azimuth, name, color, locked, showTelemetry }, latlng, layer }
let parkElements = []; 
let selectedElementIds = []; // Multi-select array

let drawingArea = false;
let areaPoints = [];
let areaPolygonLayer = null;
let areaTempLine = null;

let globalShowTelemetry = true;
let isMapLocked = false;
let globalShowInspector = false;

export function render() {
  const arr = state.get('arrayConfig');
  const groups = arr.groups || [];

  // Contar cuántos strings y cuántos inversores hay colocados por cada grupo
  const placedCountsStrings = {};
  const placedCountsInverters = {};
  groups.forEach(g => {
    placedCountsStrings[g.id] = 0;
    placedCountsInverters[g.id] = 0;
  });

  parkElements.forEach(el => {
    if (el.type === 'string' && placedCountsStrings[el.data.groupId] !== undefined) {
      placedCountsStrings[el.data.groupId]++;
    } else if (el.type === 'inverter' && placedCountsInverters[el.data.groupId] !== undefined) {
      placedCountsInverters[el.data.groupId]++;
    }
  });

  const groupOptions = [];
  groups.forEach(g => {
    const placedStr = placedCountsStrings[g.id] || 0;
    const totalStr = g.numStrings;
    if (placedStr < totalStr) {
      groupOptions.push(`<option value="string|${g.id}">🔗 String: ${g.name} (${placedStr}/${totalStr})</option>`);
    }
    const placedInv = placedCountsInverters[g.id] || 0;
    if (placedInv < 1) {
      groupOptions.push(`<option value="inverter|${g.id}">📦 Inv: ${g.name} (${placedInv}/1)</option>`);
    }
  });

  const selectHtml = groupOptions.length > 0 
    ? `<select class="form-select" id="select-insert-element" style="width:250px;">${groupOptions.join('')}</select>
       <button class="btn btn-primary" id="btn-insert-element">Insertar Elemento</button>`
    : `<span style="color:var(--text-tertiary); font-size:0.8rem;">Todos los elementos posicionados.</span>`;

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🏗️</span> Diseño en Planta del Parque Solar</h2>
        <p class="page-subtitle">Dibuja la parcela, posiciona los inversores y distribuye los strings con precisión. <br><em>Consejo: Usa <strong>Shift + Clic</strong> en el mapa para seleccionar múltiples elementos.</em></p>
      </div>
      <div class="page-actions" style="display:flex; gap:12px; align-items:center;">
        <label style="display:flex; align-items:center; gap:4px; font-size:0.8rem; cursor:pointer;">
          <input type="checkbox" id="check-lock-map" ${isMapLocked ? 'checked' : ''} style="accent-color:var(--solar-amber);"> Fijar Vista Mapa
        </label>
        <button class="btn btn-secondary btn-sm" id="btn-clear-map">🗑️ Limpiar Mapa</button>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: var(--space-md); height: calc(100vh - 180px); min-height: 500px;">
      
      <!-- Barra superior de herramientas -->
      <div class="card" style="display:flex; flex-wrap:wrap; align-items:flex-start; gap:var(--space-lg); padding:var(--space-md) var(--space-lg);">
        <div style="display:flex; align-items:center; gap:var(--space-sm); height:100%;">
          <button class="btn btn-secondary" id="btn-draw-area" style="border-style:dashed;">
            ${drawingArea ? 'Finalizar Dibujo' : '📐 Dibujar Parcela'}
          </button>
        </div>
        
        <div style="width:1px; height:40px; background:var(--border-primary);"></div>
        
        <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
          <span style="font-size:var(--text-xs); color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Herramientas de Elemento:</span>
          <div id="group-buttons-container" style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
            ${selectHtml}
            <button class="btn btn-secondary" id="btn-insert-all" title="Inserta todos los elementos restantes de una vez">⚡ Insertar Todos</button>
            <div style="width:1px; height:24px; background:var(--border-primary); margin:0 4px;"></div>
            <button class="btn ${globalShowInspector ? 'btn-primary' : 'btn-secondary'}" id="btn-toggle-inspector" title="Mostrar/Ocultar Panel de Propiedades">⚙️ Propiedades</button>
            <button class="btn ${globalShowTelemetry ? 'btn-primary' : 'btn-secondary'}" id="btn-toggle-telemetry" title="Mostrar/Ocultar Parámetros Eléctricos">📊 Parámetros</button>
          </div>
        </div>
      </div>

      <!-- Área del Mapa -->
      <div style="display:flex; gap:var(--space-md); flex:1; overflow:hidden;">
        
        <!-- Mapa (Posicionado relativo para contener elementos absolutos) -->
        <div class="card" style="padding:0; overflow:hidden; position:relative; flex:1;">
          <div id="park-map" style="width:100%; height:100%; background:var(--bg-tertiary); cursor: ${drawingArea ? 'crosshair' : 'grab'}; z-index:1;"></div>
          
          <!-- Inspector Lateral Flotante (Oculto por defecto) -->
          <div class="card" id="element-inspector" style="display:none; position:absolute; top:10px; left:10px; z-index:2000; width:300px; max-height:calc(100% - 20px); flex-direction:column; gap:var(--space-sm); overflow-y:auto; border:2px solid var(--solar-amber); box-shadow:0 4px 20px rgba(0,0,0,0.5); background:var(--bg-card);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-primary); padding-bottom:8px; margin-bottom:8px;">
              <h3 style="font-size:var(--text-sm); color:var(--solar-amber); margin:0;" id="insp-title">⚙️ Propiedades</h3>
              <button class="btn btn-ghost btn-sm" id="btn-close-inspector" style="padding:0; width:24px; height:24px;">✖</button>
            </div>
            <div id="inspector-content"></div>
          </div>
          
          <!-- Brújula N-S -->
          <div style="position:absolute; top:20px; right:20px; width:40px; height:120px; background:rgba(0,0,0,0.6); border-radius:20px; border:2px solid rgba(255,255,255,0.2); display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:8px 0; z-index:1000; pointer-events:none;">
            <div style="color:var(--solar-red); font-weight:900; font-size:1.2rem; text-shadow:0 0 4px #000;">N</div>
            <div style="width:2px; height:50px; background:linear-gradient(to bottom, var(--solar-red) 50%, white 50%); position:relative;">
              <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:8px; height:8px; border-radius:50%; background:#fff;"></div>
            </div>
            <div style="color:white; font-weight:900; font-size:1.2rem; text-shadow:0 0 4px #000;">S</div>
          </div>

          <div id="map-loading" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:var(--text-secondary); pointer-events:none; z-index:1000;">
            Cargando mapa interactivo...
          </div>
          <div id="drawing-hint" style="display:${drawingArea ? 'block' : 'none'}; position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:white; padding:8px 16px; border-radius:20px; font-size:12px; pointer-events:none; z-index:1000;">
            Haz clic en el mapa para añadir vértices. Doble clic para terminar.
          </div>
        </div>
      </div>
    </div>

    <style>
      .park-telemetry {
        background: rgba(0,0,0,0.85);
        color: #fff;
        font-family: monospace;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 4px;
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        pointer-events: none;
        z-index: 1000;
        border: 1px solid rgba(255,255,255,0.2);
      }
      .inverter-icon {
        background: var(--solar-blue);
        border: 2px solid #fff;
        border-radius: 4px;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      }
    </style>
  `;
}

export function init() {
  setTimeout(() => initLeafletMap(), 100);

  const bindButtons = () => {
    const btnInsert = document.getElementById('btn-insert-element');
    const selectInsert = document.getElementById('select-insert-element');
    if (btnInsert && selectInsert) {
      btnInsert.addEventListener('click', () => {
        if (drawingArea) return;
        const val = selectInsert.value;
        if (!val) return;
        const [type, groupId] = val.split('|');
        addElementToMap(type, groupId);
      });
    }

    document.getElementById('btn-insert-all')?.addEventListener('click', () => {
      if (drawingArea) return;
      insertAllMissingElements();
    });

    document.getElementById('btn-toggle-inspector')?.addEventListener('click', () => {
      globalShowInspector = !globalShowInspector;
      updateToolbarButtons();
      if (globalShowInspector && selectedElementIds.length > 0) {
        showInspector();
      } else {
        hideInspector();
      }
    });

    document.getElementById('btn-toggle-telemetry')?.addEventListener('click', () => {
      globalShowTelemetry = !globalShowTelemetry;
      updateToolbarButtons();
      updateAllVisuals();
    });
  };
  bindButtons();

  document.getElementById('btn-clear-map')?.addEventListener('click', () => {
    if (confirm('¿Seguro que quieres borrar todos los elementos del mapa?')) {
      parkElements.forEach(el => mapInstance.removeLayer(el.layer));
      parkElements = [];
      selectedElementIds = [];
      if (areaPolygonLayer) mapInstance.removeLayer(areaPolygonLayer);
      if (areaTempLine) mapInstance.removeLayer(areaTempLine);
      areaPoints = [];
      areaPolygonLayer = null;
      hideInspector();
      updateToolbarButtons();
    }
  });

  const btnDraw = document.getElementById('btn-draw-area');
  btnDraw?.addEventListener('click', () => {
    drawingArea = !drawingArea;
    btnDraw.innerHTML = drawingArea ? 'Finalizar Dibujo' : '📐 Dibujar Parcela';
    const mapEl = document.getElementById('park-map');
    const hintEl = document.getElementById('drawing-hint');
    if (mapEl) mapEl.style.cursor = drawingArea ? 'crosshair' : 'grab';
    if (hintEl) hintEl.style.display = drawingArea ? 'block' : 'none';
    
    if (drawingArea) {
      if (areaPolygonLayer) mapInstance.removeLayer(areaPolygonLayer);
      if (areaTempLine) mapInstance.removeLayer(areaTempLine);
      areaPoints = [];
      selectedElementIds = [];
      updateAllVisuals();
      hideInspector();
    } else {
      finishDrawing();
    }
  });

  document.getElementById('check-lock-map')?.addEventListener('change', (e) => {
    isMapLocked = e.target.checked;
    if (!mapInstance) return;
    if (isMapLocked) {
      mapInstance.dragging.disable();
      mapInstance.touchZoom.disable();
      mapInstance.doubleClickZoom.disable();
      mapInstance.scrollWheelZoom.disable();
      document.getElementById('park-map').style.cursor = 'default';
    } else {
      mapInstance.dragging.enable();
      mapInstance.touchZoom.enable();
      mapInstance.doubleClickZoom.enable();
      mapInstance.scrollWheelZoom.enable();
      document.getElementById('park-map').style.cursor = drawingArea ? 'crosshair' : 'grab';
    }
  });

  document.getElementById('btn-close-inspector')?.addEventListener('click', () => {
    globalShowInspector = false;
    updateToolbarButtons();
    hideInspector();
  });

  // Escuchar cambios de estado para redibujar
  state.onAny((path) => {
    if (path.startsWith('arrayConfig') || path.startsWith('panelSpecs') || path.startsWith('conditions')) {
      updateAllVisuals();
    }
  });
}

function updateToolbarButtons() {
  const container = document.getElementById('group-buttons-container');
  if (!container) return;
  const arr = state.get('arrayConfig');
  const groups = arr.groups || [];

  const placedCountsStrings = {};
  const placedCountsInverters = {};
  groups.forEach(g => {
    placedCountsStrings[g.id] = 0;
    placedCountsInverters[g.id] = 0;
  });

  parkElements.forEach(el => {
    if (el.type === 'string' && placedCountsStrings[el.data.groupId] !== undefined) {
      placedCountsStrings[el.data.groupId]++;
    } else if (el.type === 'inverter' && placedCountsInverters[el.data.groupId] !== undefined) {
      placedCountsInverters[el.data.groupId]++;
    }
  });

  const groupOptions = [];
  groups.forEach(g => {
    const placedStr = placedCountsStrings[g.id] || 0;
    const totalStr = g.numStrings;
    if (placedStr < totalStr) {
      groupOptions.push(`<option value="string|${g.id}">🔗 String: ${g.name} (${placedStr}/${totalStr})</option>`);
    }
    const placedInv = placedCountsInverters[g.id] || 0;
    if (placedInv < 1) {
      groupOptions.push(`<option value="inverter|${g.id}">📦 Inv: ${g.name} (${placedInv}/1)</option>`);
    }
  });

  const selectHtml = groupOptions.length > 0 
    ? `<select class="form-select" id="select-insert-element" style="width:250px;">${groupOptions.join('')}</select>
       <button class="btn btn-primary" id="btn-insert-element">Insertar Elemento</button>`
    : `<span style="color:var(--text-tertiary); font-size:0.8rem;">Todos los elementos posicionados.</span>`;
  
  container.innerHTML = `
    ${selectHtml}
    <button class="btn btn-secondary" id="btn-insert-all" title="Inserta todos los elementos restantes de una vez">⚡ Insertar Todos</button>
    <div style="width:1px; height:24px; background:var(--border-primary); margin:0 4px;"></div>
    <button class="btn ${globalShowInspector ? 'btn-primary' : 'btn-secondary'}" id="btn-toggle-inspector" title="Mostrar/Ocultar Panel de Propiedades">⚙️ Propiedades</button>
    <button class="btn ${globalShowTelemetry ? 'btn-primary' : 'btn-secondary'}" id="btn-toggle-telemetry" title="Mostrar/Ocultar Parámetros Eléctricos">📊 Parámetros</button>
  `;
  
  // Re-bind
  const btnInsert = document.getElementById('btn-insert-element');
  const selectInsert = document.getElementById('select-insert-element');
  if (btnInsert && selectInsert) {
    btnInsert.addEventListener('click', () => {
      if (drawingArea) return;
      const val = selectInsert.value;
      if (!val) return;
      const [type, groupId] = val.split('|');
      addElementToMap(type, groupId);
    });
  }

  document.getElementById('btn-insert-all')?.addEventListener('click', () => {
    if (drawingArea) return;
    insertAllMissingElements();
  });

  document.getElementById('btn-toggle-inspector')?.addEventListener('click', () => {
    globalShowInspector = !globalShowInspector;
    updateToolbarButtons();
    if (globalShowInspector && selectedElementIds.length > 0) {
      showInspector();
    } else {
      hideInspector();
    }
  });

  document.getElementById('btn-toggle-telemetry')?.addEventListener('click', () => {
    globalShowTelemetry = !globalShowTelemetry;
    updateToolbarButtons();
    updateAllVisuals();
  });
}

function initLeafletMap() {
  if (typeof L === 'undefined') {
    document.getElementById('map-loading').textContent = 'Error: No se pudo cargar Leaflet.';
    return;
  }

  document.getElementById('map-loading').style.display = 'none';
  const loc = state.get('location');
  const lat = loc.latitude || 40.4168;
  const lon = loc.longitude || -3.7038;

  mapInstance = L.map('park-map', { doubleClickZoom: false }).setView([lat, lon], 19);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 22,
    maxNativeZoom: 19
  }).addTo(mapInstance);

  mapInstance.on('click', (e) => {
    if (drawingArea) {
      areaPoints.push(e.latlng);
      if (areaPoints.length === 1) {
        areaTempLine = L.polyline([e.latlng, e.latlng], {color: 'red', dashArray: '5, 5'}).addTo(mapInstance);
      } else {
        areaTempLine.setLatLngs(areaPoints);
      }
    } else {
      // Si hacemos clic en el mapa vacío (sin arrastrar), deseleccionar
      selectedElementIds = [];
      updateAllVisuals();
      hideInspector();
    }
  });

  mapInstance.on('mousemove', (e) => {
    if (drawingArea && areaPoints.length > 0) {
      const pts = [...areaPoints, e.latlng];
      areaTempLine.setLatLngs(pts);
    }
  });

  mapInstance.on('dblclick', (e) => {
    if (drawingArea) {
      areaPoints.push(e.latlng);
      document.getElementById('btn-draw-area').click(); // toggle off
    }
  });

  // Keep elements if changing tabs
  if (parkElements.length > 0) {
    parkElements.forEach(el => {
      el.layer = null;
      renderElementLayer(el);
    });
  }
  
  if (areaPoints.length > 0) {
     areaPolygonLayer = L.polygon(areaPoints, {color: 'orange', fillOpacity: 0.1, weight: 2}).addTo(mapInstance);
  }

  hideInspector();
}

function finishDrawing() {
  if (areaPoints.length > 2) {
    areaPolygonLayer = L.polygon(areaPoints, {color: 'orange', fillOpacity: 0.1, weight: 2}).addTo(mapInstance);
  }
  if (areaTempLine) mapInstance.removeLayer(areaTempLine);
}

function addElementToMap(type, groupId) {
  if (!mapInstance) return;

  const center = mapInstance.getCenter();
  const id = `${type}_${Date.now()}`;
  const arrConfig = state.get('arrayConfig');
  const groupDef = (arrConfig.groups || []).find(g => g.id === groupId);
  if (!groupDef) return;

  const optimalAzimuth = state.get('location').latitude >= 0 ? 180 : 0;
  let azimuth = arrConfig.useOptimalTilt ? optimalAzimuth : arrConfig.azimuthAngle;
  let color = type === 'string' ? '#f59e0b' : '#3b82f6';

  const lastEl = [...parkElements].reverse().find(e => e.type === type);
  if (lastEl) {
    azimuth = lastEl.data.azimuth;
    color = lastEl.data.color;
  }

  // Prompts for naming
  let defaultName = '';
  if (type === 'string') {
    const placed = parkElements.filter(e => e.type === 'string' && e.data.groupId === groupId).length + 1;
    defaultName = `${groupDef.name} - String ${placed}`;
  } else {
    defaultName = `Inversor ${groupDef.name}`;
  }

  const name = prompt(`Introduce nombre para el nuevo ${type}:`, defaultName);
  if (name === null) return; // User cancelled

  const data = {
    groupId: groupId,
    azimuth: azimuth,
    name: name || defaultName,
    color: color,
    locked: false,
    hideTelemetry: false
  };

  const el = { id, type, data, latlng: center, layer: null };
  parkElements.push(el);

  // Auto select the new element
  selectedElementIds = [el.id];

  renderElementLayer(el);
  updateToolbarButtons();
  if (globalShowInspector) showInspector();
}

function insertAllMissingElements() {
  if (!mapInstance) return;
  const arrConfig = state.get('arrayConfig');
  const groups = arrConfig.groups || [];
  
  let startLatLng = mapInstance.getCenter();
  const lastEl = parkElements[parkElements.length - 1];
  if (lastEl) {
    startLatLng = L.latLng(lastEl.latlng.lat, lastEl.latlng.lng);
  }

  const optimalAzimuth = state.get('location').latitude >= 0 ? 180 : 0;
  const pitchMeters = parseFloat(arrConfig.pitch) || 5;

  let currentLat = startLatLng.lat;
  const currentLon = startLatLng.lng;
  
  const latMeters = 111320;
  const deltaLat = pitchMeters / latMeters;

  let addedAny = false;

  groups.forEach(g => {
    // Strings
    const placedStr = parkElements.filter(e => e.type === 'string' && e.data.groupId === g.id).length;
    const missingStr = g.numStrings - placedStr;
    for (let i = 0; i < missingStr; i++) {
      currentLat -= deltaLat;
      
      const lastStr = [...parkElements].reverse().find(e => e.type === 'string');
      const azi = lastStr ? lastStr.data.azimuth : (arrConfig.useOptimalTilt ? optimalAzimuth : arrConfig.azimuthAngle);
      const col = lastStr ? lastStr.data.color : '#f59e0b';
      
      const newPlaced = parkElements.filter(e => e.type === 'string' && e.data.groupId === g.id).length + 1;
      const name = `${g.name} - String ${newPlaced}`;
      
      const el = {
        id: `string_${Date.now()}_${Math.random()}`,
        type: 'string',
        data: { groupId: g.id, azimuth: azi, name: name, color: col, locked: false, hideTelemetry: false },
        latlng: L.latLng(currentLat, currentLon),
        layer: null
      };
      parkElements.push(el);
      addedAny = true;
    }
    
    // Inverters
    const placedInv = parkElements.filter(e => e.type === 'inverter' && e.data.groupId === g.id).length;
    if (placedInv < 1) {
      currentLat -= deltaLat;
      
      const lastInv = [...parkElements].reverse().find(e => e.type === 'inverter');
      const col = lastInv ? lastInv.data.color : '#3b82f6';
      
      const el = {
        id: `inverter_${Date.now()}_${Math.random()}`,
        type: 'inverter',
        data: { groupId: g.id, azimuth: 0, name: `Inversor ${g.name}`, color: col, locked: false, hideTelemetry: false },
        latlng: L.latLng(currentLat, currentLon),
        layer: null
      };
      parkElements.push(el);
      addedAny = true;
    }
  });

  if (addedAny) {
    updateAllVisuals();
    updateToolbarButtons();
  }
}

function renderElementLayer(el) {
  if (el.layer) mapInstance.removeLayer(el.layer);

  const r = calculateAll();
  const arrConfig = state.get('arrayConfig');
  const panel = state.get('panelSpecs');

  const isSelected = selectedElementIds.includes(el.id);
  const selectionStyle = isSelected ? `box-shadow: 0 0 0 3px #fff, 0 0 15px ${el.data.color}; z-index: 1000;` : '';

  if (el.type === 'string') {
    const groupDef = (arrConfig.groups || []).find(g => g.id === el.data.groupId);
    if (!groupDef) {
      parkElements = parkElements.filter(e => e.id !== el.id);
      return;
    }
    const groupCalcData = (r.groupsData || []).find(g => g.id === el.data.groupId);
    
    // Dimensionado
    const wPanel = (panel.width || 1134) / 1000;
    const lPanel = (panel.length || 2278) / 1000;
    const orientation = arrConfig.panelOrientation || 'portrait';
    const rows = arrConfig.rowsPerStructure || 1;
    const panelsPerString = groupDef.panelsPerString || 1;
    
    const wMeters = orientation === 'landscape' ? lPanel : wPanel;
    const lMeters = orientation === 'landscape' ? wPanel : lPanel;
    
    const cols = Math.ceil(panelsPerString / rows);
    
    const structureWidthMeters = cols * wMeters; 
    const structureLengthMeters = rows * lMeters; 

    const latMeters = 111320;
    const lonMeters = 111320 * Math.cos(el.latlng.lat * Math.PI / 180);

    const latDelta = (structureLengthMeters / 2) / latMeters;
    const lonDelta = (structureWidthMeters / 2) / lonMeters;

    const p = groupCalcData ? (groupCalcData.pmax_string / 1000).toFixed(2) : '0';
    const i = groupCalcData ? (groupCalcData.imp_string).toFixed(1) : '0';
    const v = groupCalcData ? (groupCalcData.vmp_string).toFixed(1) : '0';

    const willShowTelemetry = globalShowTelemetry && !el.data.hideTelemetry;
    const tooltipStr = willShowTelemetry ? `<div class="park-telemetry">${el.data.name}<br/>${p}kW | ${v}V | ${i}A</div>` : '';

    // Utilizando el color guardado en el dato (el.data.color) con rgba para opacidad
    const hex = el.data.color || '#f59e0b';
    const rgb = hexToRgb(hex);
    const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;

    const iconHtml = `
      <div style="width:100%; height:100%; background:${bgColor}; border:2px solid ${hex}; box-sizing:border-box; position:relative; ${selectionStyle}">
        <!-- N -->
        <div style="position:absolute; top:0; left:50%; transform:translateX(-50%); width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:8px solid ${hex};"></div>
        ${tooltipStr}
      </div>
    `;
    
    const boundsPx = [
      mapInstance.latLngToLayerPoint(L.latLng(el.latlng.lat - latDelta, el.latlng.lng - lonDelta)),
      mapInstance.latLngToLayerPoint(L.latLng(el.latlng.lat + latDelta, el.latlng.lng + lonDelta))
    ];
    const widthPx = Math.abs(boundsPx[1].x - boundsPx[0].x);
    const heightPx = Math.abs(boundsPx[1].y - boundsPx[0].y);

    const marker = L.marker(el.latlng, {
      draggable: !isMapLocked && !el.data.locked,
      icon: L.divIcon({
        className: '',
        html: `<div style="width:${widthPx}px; height:${heightPx}px; transform: rotate(${el.data.azimuth}deg); transform-origin: center;">${iconHtml}</div>`,
        iconSize: [0, 0], 
        iconAnchor: [0, 0] 
      })
    }).addTo(mapInstance);

    bindMarkerEvents(marker, el);

  } else if (el.type === 'inverter') {
    const groupCalcData = (r.groupsData || []).find(g => g.id === el.data.groupId);
    const p = groupCalcData ? (groupCalcData.pmax_array / 1000).toFixed(2) : '0';
    const v = groupCalcData ? (groupCalcData.vmp_array).toFixed(1) : '0';
    const i = groupCalcData ? (groupCalcData.imp_array).toFixed(1) : '0';

    const willShowTelemetry = globalShowTelemetry && !el.data.hideTelemetry;
    const tooltipStr = willShowTelemetry ? `<div class="park-telemetry" style="bottom:-30px;">${el.data.name}<br/>Total: ${p}kW | ${v}V | ${i}A</div>` : '';

    const hex = el.data.color || '#3b82f6';
    
    const iconHtml = `
      <div style="position:relative; width:40px; height:40px; margin-left:-20px; margin-top:-20px;">
        <div class="inverter-icon" style="background:${hex}; border: 2px solid #fff; ${selectionStyle}">📦</div>
        ${tooltipStr}
      </div>
    `;

    const marker = L.marker(el.latlng, {
      draggable: !isMapLocked && !el.data.locked,
      icon: L.divIcon({ className: '', html: iconHtml })
    }).addTo(mapInstance);

    bindMarkerEvents(marker, el);
  }
}

function bindMarkerEvents(marker, el) {
  marker.on('dragstart', () => {
    // No interrumpimos el drag re-renderizando.
  });

  marker.on('dragend', () => { 
    el.latlng = marker.getLatLng(); 
    if (!selectedElementIds.includes(el.id)) {
      selectedElementIds = [el.id];
    }
    updateAllVisuals(); 
    if (globalShowInspector) showInspector();
  });

  marker.on('click', (e) => {
    L.DomEvent.stopPropagation(e); // prevent map click
    if (e.originalEvent.shiftKey) {
      if (selectedElementIds.includes(el.id)) {
        selectedElementIds = selectedElementIds.filter(id => id !== el.id);
      } else {
        selectedElementIds.push(el.id);
      }
    } else {
      selectedElementIds = [el.id];
    }
    updateAllVisuals();
    if (globalShowInspector) showInspector();
  });

  marker.on('dblclick', (e) => {
    L.DomEvent.stopPropagation(e);
    // Double click simply acts as a click now, doesn't force toggle inspector
    selectedElementIds = [el.id];
    updateAllVisuals();
    if (globalShowInspector) showInspector();
  });

  el.layer = marker;
}

function updateAllVisuals() {
  parkElements.forEach(el => renderElementLayer(el));
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {r: 0, g: 0, b: 0};
}

function showInspector() {
  const inspector = document.getElementById('element-inspector');
  const content = document.getElementById('inspector-content');
  const title = document.getElementById('insp-title');
  inspector.style.display = 'flex';

  if (!globalShowInspector || selectedElementIds.length === 0) {
    hideInspector();
    return;
  }

  if (selectedElementIds.length === 1) {
    // Single Element Inspector
    const el = parkElements.find(e => e.id === selectedElementIds[0]);
    if (!el) return;

    title.innerHTML = `⚙️ Propiedades`;

    let html = `
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-input" id="insp-name" value="${el.data.name}">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Color</label>
          <input type="color" class="form-input" id="insp-color" value="${el.data.color || '#f59e0b'}" style="height:40px; padding:2px; cursor:pointer;">
        </div>
        <div class="form-group" style="display:flex; flex-direction:column; justify-content:center;">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer;">
            <input type="checkbox" id="insp-lock" ${el.data.locked ? 'checked' : ''}> Fijar Posición
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; margin-top:8px;">
            <input type="checkbox" id="insp-hide-tel" ${el.data.hideTelemetry ? 'checked' : ''}> Ocultar Telemetría
          </label>
        </div>
      </div>
    `;

    if (el.type === 'string') {
      html += `
        <div class="form-group">
          <label class="form-label">Azimut Específico [°]</label>
          <div style="display:flex; gap:8px;">
            <input type="range" id="insp-azimuth-slider" min="0" max="360" value="${el.data.azimuth}" style="flex:1;">
            <input type="number" class="form-input" id="insp-azimuth" value="${el.data.azimuth}" min="0" max="360" style="width:60px;">
          </div>
        </div>
      `;
    }

    html += `<button class="btn btn-secondary btn-sm mt-md" style="width:100%; border-color:var(--solar-red); color:var(--solar-red);" id="insp-delete">🗑️ Eliminar Elemento</button>`;
    content.innerHTML = html;

    // Event Bindings Single
    document.getElementById('insp-name').addEventListener('input', (e) => {
      el.data.name = e.target.value;
      renderElementLayer(el);
    });

    document.getElementById('insp-color').addEventListener('input', (e) => {
      el.data.color = e.target.value;
      renderElementLayer(el);
    });

    document.getElementById('insp-lock').addEventListener('change', (e) => {
      el.data.locked = e.target.checked;
      renderElementLayer(el);
    });

    document.getElementById('insp-hide-tel').addEventListener('change', (e) => {
      el.data.hideTelemetry = e.target.checked;
      renderElementLayer(el);
    });

    if (el.type === 'string') {
      const updateAzi = (val) => {
        el.data.azimuth = parseFloat(val) || 0;
        document.getElementById('insp-azimuth').value = el.data.azimuth;
        document.getElementById('insp-azimuth-slider').value = el.data.azimuth;
        renderElementLayer(el);
      };
      document.getElementById('insp-azimuth').addEventListener('input', (e) => updateAzi(e.target.value));
      document.getElementById('insp-azimuth-slider').addEventListener('input', (e) => updateAzi(e.target.value));
    }

    document.getElementById('insp-delete').addEventListener('click', () => {
      mapInstance.removeLayer(el.layer);
      parkElements = parkElements.filter(e => e.id !== el.id);
      selectedElementIds = [];
      hideInspector();
      updateToolbarButtons();
    });

  } else {
    // Multi Element Inspector
    title.innerHTML = `⚙️ Selección Múltiple (${selectedElementIds.length})`;

    let html = `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Color Masivo</label>
          <input type="color" class="form-input" id="insp-multi-color" value="#f59e0b" style="height:40px; padding:2px; cursor:pointer;">
        </div>
        <div class="form-group" style="display:flex; flex-direction:column; justify-content:center;">
          <button class="btn btn-secondary btn-sm" id="insp-multi-lock" style="font-size:10px;">🔒 Bloquear</button>
          <button class="btn btn-secondary btn-sm" id="insp-multi-unlock" style="font-size:10px; margin-top:4px;">🔓 Desbloquear</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Azimut Masivo (Strings)</label>
        <input type="number" class="form-input" id="insp-multi-azimuth" placeholder="Grados [0-360]">
      </div>
      <button class="btn btn-secondary btn-sm mt-md" style="width:100%; border-color:var(--solar-red); color:var(--solar-red);" id="insp-multi-delete">🗑️ Eliminar Selección</button>
    `;
    content.innerHTML = html;

    // Bindings Multi
    document.getElementById('insp-multi-color').addEventListener('input', (e) => {
      const color = e.target.value;
      selectedElementIds.forEach(id => {
        const el = parkElements.find(e => e.id === id);
        if (el) el.data.color = color;
      });
      updateAllVisuals();
    });

    document.getElementById('insp-multi-lock').addEventListener('click', () => {
      selectedElementIds.forEach(id => {
        const el = parkElements.find(e => e.id === id);
        if (el) el.data.locked = true;
      });
      updateAllVisuals();
    });

    document.getElementById('insp-multi-unlock').addEventListener('click', () => {
      selectedElementIds.forEach(id => {
        const el = parkElements.find(e => e.id === id);
        if (el) el.data.locked = false;
      });
      updateAllVisuals();
    });

    document.getElementById('insp-multi-azimuth').addEventListener('input', (e) => {
      const az = parseFloat(e.target.value);
      if (isNaN(az)) return;
      selectedElementIds.forEach(id => {
        const el = parkElements.find(e => e.id === id);
        if (el && el.type === 'string') el.data.azimuth = az;
      });
      updateAllVisuals();
    });

    document.getElementById('insp-multi-delete').addEventListener('click', () => {
      selectedElementIds.forEach(id => {
        const el = parkElements.find(e => e.id === id);
        if (el) {
          mapInstance.removeLayer(el.layer);
          parkElements = parkElements.filter(e => e.id !== id);
        }
      });
      selectedElementIds = [];
      hideInspector();
      updateToolbarButtons();
    });
  }
}

function hideInspector() {
  const inspector = document.getElementById('element-inspector');
  if (inspector) inspector.style.display = 'none';
}
