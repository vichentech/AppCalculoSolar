/**
 * AppSolar — Tab: Diseño en Planta (Park Builder)
 * Mapa interactivo con Leaflet para drag & drop de Arrays e Inversores
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';

let mapInstance = null;
let parkElements = []; // { id, type, latlng, data, marker }

export function render() {
  const loc = state.get('location');

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🏗️</span> Diseño en Planta del Parque Solar</h2>
        <p class="page-subtitle">Arrastra componentes al mapa satelital para diseñar físicamente tu planta y visualizar los parámetros eléctricos en tiempo real.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-clear-map">🗑️ Limpiar Mapa</button>
      </div>
    </div>

    <div class="grid-layout" style="display: grid; grid-template-columns: 280px 1fr; gap: var(--space-md); height: calc(100vh - 180px); min-height: 500px;">
      
      <!-- Panel lateral de herramientas -->
      <div class="card" style="display:flex; flex-direction:column; overflow-y:auto; padding:var(--space-md);">
        
        <h3 style="font-size:var(--text-sm); margin-bottom:var(--space-sm); color:var(--text-secondary);">🏗️ Herramientas</h3>
        <button class="btn btn-secondary" id="btn-draw-area" style="margin-bottom:var(--space-lg); border-style:dashed;">📐 Dibujar Área Parcela</button>

        <h3 style="font-size:var(--text-sm); margin-bottom:var(--space-sm); color:var(--text-secondary);">🧱 Componentes Disponibles</h3>
        <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-bottom:var(--space-md);">Haz clic para añadirlos al centro del mapa, luego arrástralos.</p>
        
        <div style="display:flex; flex-direction:column; gap:var(--space-sm);">
          <button class="btn btn-ghost park-element-btn" data-type="array" style="border: 1px solid var(--solar-amber); justify-content:flex-start;">
            <span style="font-size:1.2rem; margin-right:8px;">🔗</span> Añadir Array (Strings)
          </button>
          
          <button class="btn btn-ghost park-element-btn" data-type="inverter" style="border: 1px solid var(--solar-blue); justify-content:flex-start;">
            <span style="font-size:1.2rem; margin-right:8px;">📦</span> Añadir Inversor
          </button>
        </div>

        <div class="divider"></div>

        <div id="element-inspector" style="display:none; flex-direction:column; gap:var(--space-sm);">
          <h3 style="font-size:var(--text-sm); color:var(--solar-amber);">⚙️ Propiedades</h3>
          <div id="inspector-content"></div>
        </div>
      </div>

      <!-- Área del Mapa -->
      <div class="card" style="padding:0; overflow:hidden; position:relative;">
        <div id="park-map" style="width:100%; height:100%; background:var(--bg-tertiary);"></div>
        <div id="map-loading" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:var(--text-secondary); pointer-events:none;">
          Cargando mapa interactivo...
        </div>
      </div>
    </div>

    <!-- Estilos específicos del Park Builder -->
    <style>
      .park-marker-array {
        background: rgba(245, 158, 11, 0.9);
        border: 2px solid #fff;
        border-radius: 4px;
        color: #000;
        font-weight: 700;
        font-size: 10px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        justify-content: center;
        cursor: grab;
      }
      .park-marker-inverter {
        background: rgba(59, 130, 246, 0.9);
        border: 2px solid #fff;
        border-radius: 8px;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        justify-content: center;
        cursor: grab;
      }
      .leaflet-dragging .park-marker-array, .leaflet-dragging .park-marker-inverter {
        cursor: grabbing;
      }
    </style>
  `;
}

export function init() {
  setTimeout(() => initLeafletMap(), 100);

  document.querySelectorAll('.park-element-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      addElementToMap(type);
    });
  });

  document.getElementById('btn-clear-map')?.addEventListener('click', () => {
    if (confirm('¿Seguro que quieres borrar todos los elementos del mapa?')) {
      parkElements.forEach(el => mapInstance.removeLayer(el.marker));
      parkElements = [];
      hideInspector();
    }
  });

  // Suscribirse a cambios en config (paneles, strings, condiciones) para recalcular KPIs del mapa
  const updateMapKPIs = () => {
    parkElements.forEach(el => updateMarkerVisuals(el));
  };
  // Simplificación: escuchar clicks globalmente que puedan ser de inputs
  document.addEventListener('input', updateMapKPIs);
}

function initLeafletMap() {
  if (typeof L === 'undefined') {
    document.getElementById('map-loading').textContent = 'Error: No se pudo cargar Leaflet (Verifica conexión a internet).';
    return;
  }

  document.getElementById('map-loading').style.display = 'none';

  const loc = state.get('location');
  const lat = loc.latitude || 40.4168;
  const lon = loc.longitude || -3.7038;

  mapInstance = L.map('park-map').setView([lat, lon], 18);

  // Capa satélite (Esri World Imagery)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }).addTo(mapInstance);

  // Recuperar elementos guardados si implementamos persistencia de layout
  // por ahora empezamos limpio cada vez que se carga la página
  parkElements = [];
  hideInspector();
}

function addElementToMap(type) {
  if (!mapInstance) return;

  const center = mapInstance.getCenter();
  const id = `${type}_${Date.now()}`;
  const r = calculateAll();
  const arrConfig = state.get('arrayConfig');

  const data = type === 'array' ? {
    name: `Array ${parkElements.filter(e=>e.type==='array').length + 1}`,
    tilt: arrConfig.tiltAngle,
    azimuth: arrConfig.azimuthAngle,
    strings: arrConfig.numStrings,
  } : {
    name: `Inversor ${parkElements.filter(e=>e.type==='inverter').length + 1}`,
    connectedArrays: []
  };

  const el = { id, type, data, latlng: center, marker: null };
  parkElements.push(el);

  const iconHtml = generateMarkerHtml(el, r);

  const marker = L.marker(center, {
    draggable: true,
    icon: L.divIcon({
      className: '',
      html: iconHtml,
      iconSize: type === 'array' ? [60, 40] : [70, 50],
      iconAnchor: type === 'array' ? [30, 20] : [35, 25]
    })
  }).addTo(mapInstance);

  marker.on('dragend', (e) => {
    el.latlng = marker.getLatLng();
  });

  marker.on('click', () => {
    showInspector(el);
  });

  el.marker = marker;
  updateMarkerVisuals(el);
}

function updateMarkerVisuals(el) {
  if (!el.marker) return;
  const r = calculateAll();
  const iconHtml = generateMarkerHtml(el, r);
  
  el.marker.setIcon(L.divIcon({
    className: '',
    html: iconHtml,
    iconSize: el.type === 'array' ? [60, 40] : [80, 50],
    iconAnchor: el.type === 'array' ? [30, 20] : [40, 25]
  }));
}

function generateMarkerHtml(el, r) {
  if (el.type === 'array') {
    // Calculamos potencia del array basándonos en sus strings y las condiciones globales
    const p = (r.pmax_string * el.data.strings) / 1000; // kW
    return `
      <div class="park-marker-array" style="width:100%; height:100%; transform: rotate(${el.data.azimuth}deg);">
        <div style="transform: rotate(-${el.data.azimuth}deg);">
          <div>${el.data.name}</div>
          <div style="font-size:8px;">${p.toFixed(1)} kW</div>
        </div>
      </div>
    `;
  } else {
    // Inverter
    return `
      <div class="park-marker-inverter" style="width:100%; height:100%;">
        <div style="font-size:14px; margin-bottom:2px;">📦</div>
        <div>${el.data.name}</div>
      </div>
    `;
  }
}

function showInspector(el) {
  const inspector = document.getElementById('element-inspector');
  const content = document.getElementById('inspector-content');
  inspector.style.display = 'flex';

  let html = `
    <div class="form-group">
      <label class="form-label">Nombre</label>
      <input type="text" class="form-input" id="insp-name" value="${el.data.name}">
    </div>
  `;

  if (el.type === 'array') {
    html += `
      <div class="form-group">
        <label class="form-label">Azimut Específico [°]</label>
        <input type="number" class="form-input" id="insp-azimuth" value="${el.data.azimuth}">
      </div>
      <div class="form-group">
        <label class="form-label">Tilt Específico [°]</label>
        <input type="number" class="form-input" id="insp-tilt" value="${el.data.tilt}">
      </div>
      <div class="form-group">
        <label class="form-label">Nº Strings Asignados</label>
        <input type="number" class="form-input" id="insp-strings" value="${el.data.strings}">
      </div>
    `;
  } else if (el.type === 'inverter') {
    const arrays = parkElements.filter(e => e.type === 'array');
    html += `
      <div class="form-group">
        <label class="form-label">Conectar a Arrays:</label>
        <div style="max-height:100px; overflow-y:auto; border:1px solid var(--border-primary); padding:4px; border-radius:4px;">
          ${arrays.map(a => `
            <label style="display:flex; align-items:center; gap:4px; font-size:12px;">
              <input type="checkbox" class="insp-inv-conn" value="${a.id}" ${el.data.connectedArrays.includes(a.id) ? 'checked' : ''}>
              ${a.data.name}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="mt-sm" style="font-size:12px; color:var(--text-secondary);">
        Al conectar arrays al inversor, este sumará sus potencias automáticamente. (Simulado)
      </div>
    `;
  }

  html += `<button class="btn btn-secondary btn-sm mt-md" style="width:100%; border-color:var(--solar-red); color:var(--solar-red);" id="insp-delete">Eliminar Elemento</button>`;

  content.innerHTML = html;

  // Bindings
  document.getElementById('insp-name').addEventListener('input', (e) => {
    el.data.name = e.target.value;
    updateMarkerVisuals(el);
  });

  if (el.type === 'array') {
    document.getElementById('insp-azimuth').addEventListener('input', (e) => {
      el.data.azimuth = parseFloat(e.target.value) || 0;
      updateMarkerVisuals(el);
    });
    document.getElementById('insp-tilt').addEventListener('input', (e) => {
      el.data.tilt = parseFloat(e.target.value) || 0;
    });
    document.getElementById('insp-strings').addEventListener('input', (e) => {
      el.data.strings = parseInt(e.target.value) || 1;
      updateMarkerVisuals(el);
    });
  } else if (el.type === 'inverter') {
    document.querySelectorAll('.insp-inv-conn').forEach(cb => {
      cb.addEventListener('change', () => {
        el.data.connectedArrays = Array.from(document.querySelectorAll('.insp-inv-conn:checked')).map(c => c.value);
        updateMarkerVisuals(el);
      });
    });
  }

  document.getElementById('insp-delete').addEventListener('click', () => {
    mapInstance.removeLayer(el.marker);
    parkElements = parkElements.filter(e => e.id !== el.id);
    hideInspector();
  });
}

function hideInspector() {
  const inspector = document.getElementById('element-inspector');
  if (inspector) inspector.style.display = 'none';
}
