/**
 * AppSolar — Tab: Localización GPS + Datos Climáticos
 */

import { state } from '../state.js';
import { fetchWeatherData } from '../api/openMeteo.js';
import { fetchMonthlyData } from '../api/pvgis.js';
import { createChart, CHART_COLORS } from '../charts/chartManager.js';

export function render() {
  const loc = state.get('location');
  
  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📍</span> Localización GPS y Datos Climáticos</h2>
        <p class="page-subtitle">Selecciona la ubicación del parque solar para obtener datos reales de irradiancia y clima de APIs abiertas.</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>🗺️ Ubicación</h3>
        </div>

        <div class="grid-2" style="gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Latitud <span class="unit">[°]</span></label>
            <div class="form-input-with-unit">
              <input class="form-input" type="number" id="input-lat" value="${loc.latitude}" step="0.0001" min="-90" max="90">
              <span class="input-unit">°</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Longitud <span class="unit">[°]</span></label>
            <div class="form-input-with-unit">
              <input class="form-input" type="number" id="input-lon" value="${loc.longitude}" step="0.0001" min="-180" max="180">
              <span class="input-unit">°</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Altitud <span class="unit">[m]</span></label>
          <div class="form-input-with-unit">
            <input class="form-input" type="number" id="input-alt" value="${loc.altitude}" step="1">
            <span class="input-unit">m</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nombre de la Ubicación</label>
          <input class="form-input" type="text" id="input-loc-name" value="${loc.locationName}" placeholder="Ej: Sevilla, España">
        </div>

        <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap;">
          <button class="btn btn-secondary" id="btn-geolocate">📍 Mi Ubicación</button>
          <button class="btn btn-primary" id="btn-fetch-climate">☁️ Consultar Datos Climáticos</button>
        </div>

        <div class="divider"></div>
        <div id="fetch-status" class="mt-md" style="display:none;"></div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>🗺️ Mapa</h3>
        </div>
        <div id="map-container" class="map-container" style="height:350px; background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center; color:var(--text-tertiary);">
          <div style="text-align:center;">
            <div style="font-size:3rem; margin-bottom:var(--space-sm);">🗺️</div>
            <p>Lat: <strong id="map-lat-display">${loc.latitude.toFixed(4)}</strong></p>
            <p>Lon: <strong id="map-lon-display">${loc.longitude.toFixed(4)}</strong></p>
            <p style="margin-top:var(--space-sm); font-size:var(--text-xs);">Mapa interactivo (Leaflet) disponible cuando se cargue la librería</p>
          </div>
        </div>
      </div>
    </div>

    <div id="climate-results" style="display:${loc.apiDataLoaded ? 'block' : 'none'};">
      <div class="card mt-lg">
        <div class="card-header">
          <h3>☀️ Datos Mensuales de Irradiancia (PVGIS)</h3>
          <span class="badge badge-blue">Histórico</span>
        </div>
        <div id="monthly-table-container"></div>
        <div style="height:320px; margin-top:var(--space-md);">
          <canvas id="chart-monthly-irradiance"></canvas>
        </div>
      </div>

      <div class="card mt-lg">
        <div class="card-header">
          <h3>🌡️ Datos Actuales (Open-Meteo)</h3>
          <span class="badge badge-green">Hoy</span>
        </div>
        <div style="height:320px;">
          <canvas id="chart-hourly-irradiance"></canvas>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  // Input bindings
  document.getElementById('input-lat')?.addEventListener('input', e => {
    state.set('location.latitude', parseFloat(e.target.value) || 0);
    updateMapDisplay();
  });
  document.getElementById('input-lon')?.addEventListener('input', e => {
    state.set('location.longitude', parseFloat(e.target.value) || 0);
    updateMapDisplay();
  });
  document.getElementById('input-alt')?.addEventListener('input', e => {
    state.set('location.altitude', parseFloat(e.target.value) || 0);
  });
  document.getElementById('input-loc-name')?.addEventListener('input', e => {
    state.set('location.locationName', e.target.value);
  });

  // Geolocation
  document.getElementById('btn-geolocate')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showStatus('error', 'Geolocalización no soportada por este navegador.');
      return;
    }
    showStatus('loading', 'Obteniendo ubicación...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, altitude } = pos.coords;
        setLocation(latitude, longitude, altitude || 0, 'Mi Ubicación');
        showStatus('success', `Ubicación obtenida: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      (err) => {
        showStatus('error', `Error: ${err.message}`);
      }
    );
  });

  // Fetch climate data
  document.getElementById('btn-fetch-climate')?.addEventListener('click', fetchClimateData);

  // Preset locations
  document.querySelectorAll('.preset-loc').forEach(btn => {
    btn.addEventListener('click', () => {
      setLocation(
        parseFloat(btn.dataset.lat),
        parseFloat(btn.dataset.lon),
        parseFloat(btn.dataset.alt),
        btn.dataset.name
      );
    });
  });

  // Init Leaflet map if available
  initMap();

  // If data already loaded, render it
  if (state.get('location.apiDataLoaded')) {
    renderMonthlyData();
  }
}

function setLocation(lat, lon, alt, name) {
  state.update('location', { latitude: lat, longitude: lon, altitude: alt, locationName: name });
  document.getElementById('input-lat').value = lat;
  document.getElementById('input-lon').value = lon;
  document.getElementById('input-alt').value = alt;
  document.getElementById('input-loc-name').value = name;
  updateMapDisplay();
}

function updateMapDisplay() {
  const lat = state.get('location.latitude');
  const lon = state.get('location.longitude');
  const latEl = document.getElementById('map-lat-display');
  const lonEl = document.getElementById('map-lon-display');
  if (latEl) latEl.textContent = lat?.toFixed(4);
  if (lonEl) lonEl.textContent = lon?.toFixed(4);
}

function showStatus(type, msg) {
  const el = document.getElementById('fetch-status');
  if (!el) return;
  el.style.display = 'block';
  const cls = type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : '⏳';
  el.innerHTML = `<div class="alert ${cls}"><span>${icon}</span><span>${msg}</span></div>`;
}

async function fetchClimateData() {
  const lat = state.get('location.latitude');
  const lon = state.get('location.longitude');
  const tilt = state.get('arrayConfig.tiltAngle');

  showStatus('loading', 'Consultando datos climáticos...');

  try {
    const [pvgisData, weatherData] = await Promise.all([
      fetchMonthlyData(lat, lon, tilt),
      fetchWeatherData(lat, lon),
    ]);

    state.update('location', {
      apiDataLoaded: true,
      monthlyData: pvgisData.monthlyData,
      hourlyData: weatherData.hourly,
      pvgisOptimalAngle: pvgisData.optimalAngle,
      pvgisTotals: pvgisData.totals,
    });

    showStatus('success', `Datos obtenidos correctamente. Irradiancia anual: ${pvgisData.totals.annualGHI.toFixed(0)} kWh/m²`);
    
    document.getElementById('climate-results').style.display = 'block';
    renderMonthlyData();
    renderHourlyData();
  } catch (err) {
    showStatus('error', `Error al obtener datos: ${err.message}`);
  }
}

function renderMonthlyData() {
  const monthly = state.get('location.monthlyData');
  if (!monthly) return;

  // Table
  const container = document.getElementById('monthly-table-container');
  if (container) {
    let html = `<table class="data-table"><thead><tr>
      <th>Mes</th><th>GHI (kWh/m²)</th><th>Inclinado (kWh/m²)</th><th>Temp. Media (°C)</th>
    </tr></thead><tbody>`;
    monthly.forEach(m => {
      html += `<tr>
        <td>${m.monthName}</td>
        <td class="mono">${m.ghi?.toFixed(1) || '—'}</td>
        <td class="mono">${m.irradiance?.toFixed(1) || '—'}</td>
        <td class="mono">${m.temperature?.toFixed(1) || '—'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Chart
  createChart('chart-monthly-irradiance', {
    type: 'bar',
    data: {
      labels: monthly.map(m => m.monthName.substring(0, 3)),
      datasets: [
        {
          label: 'Irradiancia Inclinada (kWh/m²)',
          data: monthly.map(m => m.irradiance || 0),
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: CHART_COLORS.amber,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Temperatura Media (°C)',
          data: monthly.map(m => m.temperature || 0),
          type: 'line',
          borderColor: CHART_COLORS.red,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          pointRadius: 4,
          pointBackgroundColor: CHART_COLORS.red,
          yAxisID: 'y1',
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: {
        y: { title: { text: 'Irradiancia (kWh/m²/mes)' }, beginAtZero: true },
        y1: { position: 'right', title: { text: 'Temperatura (°C)' }, grid: { drawOnChartArea: false } },
        x: { title: { text: 'Mes' } },
      },
    },
  });
}

function renderHourlyData() {
  const hourly = state.get('location.hourlyData');
  if (!hourly) return;

  createChart('chart-hourly-irradiance', {
    type: 'line',
    data: {
      labels: hourly.map(h => `${h.hour}:00`),
      datasets: [
        {
          label: 'GHI (W/m²)',
          data: hourly.map(h => h.ghi || 0),
          borderColor: CHART_COLORS.amber,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Temperatura (°C)',
          data: hourly.map(h => h.temperature || 0),
          borderColor: CHART_COLORS.red,
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    },
    options: {
      scales: {
        y: { title: { text: 'Irradiancia (W/m²)' }, beginAtZero: true },
        y1: { position: 'right', title: { text: 'Temperatura (°C)' }, grid: { drawOnChartArea: false } },
        x: { title: { text: 'Hora' } },
      },
    },
  });
}

function initMap() {
  // Leaflet map initialization (if loaded via CDN)
  if (typeof L !== 'undefined') {
    try {
      const lat = state.get('location.latitude');
      const lon = state.get('location.longitude');
      const container = document.getElementById('map-container');
      container.innerHTML = '';
      const map = L.map(container).setView([lat, lon], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
      const marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setLocation(pos.lat, pos.lng, state.get('location.altitude'), state.get('location.locationName'));
      });
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setLocation(e.latlng.lat, e.latlng.lng, state.get('location.altitude'), state.get('location.locationName'));
      });
    } catch (e) {
      console.warn('Map init error:', e);
    }
  }
}
