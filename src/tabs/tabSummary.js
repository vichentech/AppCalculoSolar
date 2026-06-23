/**
 * VichenSolarApp — Tab: Resumen General
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';
import { getVoltageDropStatus } from '../engine/cableLoss.js';
import { navigateTo } from '../router.js';

export function render() {
  const r = calculateAll();
  const panel = state.get('panelSpecs');
  const arr = state.get('arrayConfig');
  const cond = state.get('conditions');
  const loc = state.get('location');
  const vdStatus = getVoltageDropStatus(r.vdPercent);

  const alerts = [];
  if (r.vdPercent > 3) alerts.push({ type: 'danger', msg: `⚠️ Caída de tensión excesiva: ${r.vdPercent.toFixed(1)}% (máx. recomendado: 2%)` });
  if (r.tCell > 70) alerts.push({ type: 'warning', msg: `🌡️ Temperatura de celda muy alta: ${r.tCell.toFixed(1)}°C` });
  if (r.thermalLoss > 15) alerts.push({ type: 'warning', msg: `📉 Pérdidas térmicas elevadas: ${r.thermalLoss.toFixed(1)}%` });
  if (r.fillFactor < 0.65) alerts.push({ type: 'warning', msg: `📊 Fill Factor bajo: ${(r.fillFactor*100).toFixed(1)}%` });
  if (r.pr_estimated < 0.7) alerts.push({ type: 'warning', msg: `📈 Performance Ratio bajo: ${(r.pr_estimated*100).toFixed(1)}%` });

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📋</span> Resumen General</h2>
        <p class="page-subtitle">Resumen completo de la configuración y resultados del campo solar fotovoltaico.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-export-json">💾 Exportar Proyecto</button>
        <button class="btn btn-secondary btn-sm" id="btn-import-json">📂 Importar Proyecto</button>
        <input type="file" id="import-file-input" accept=".sol,.json" style="display:none">
      </div>
    </div>

    ${alerts.length > 0 ? `
      <div class="mb-lg">
        ${alerts.map(a => `<div class="alert alert-${a.type} mb-sm"><span>${a.msg}</span></div>`).join('')}
      </div>
    ` : `
      <div class="alert alert-success mb-lg"><span>✅ Todos los parámetros están dentro de los rangos recomendados.</span></div>
    `}

    <div class="accordion-container" style="display:flex; flex-direction:column; gap:var(--space-md);">
      
      <!-- Panel Solar -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">☀️ Especificaciones del Panel Solar</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md">
          <table class="data-table">
            <tbody>
              <tr><td>Modelo</td><td class="mono">${panel.modelName || '—'}</td></tr>
              <tr><td>Fabricante</td><td class="mono">${panel.manufacturer || '—'}</td></tr>
              <tr><td>Tipo</td><td class="mono">${panel.cellType || '—'}</td></tr>
              <tr><td>Pmax (STC)</td><td class="mono">${panel.pmax || '—'} Wp</td></tr>
              <tr><td>Voc / Isc</td><td class="mono">${panel.voc || '—'} V / ${panel.isc || '—'} A</td></tr>
              <tr><td>Vmp / Imp</td><td class="mono">${panel.vmp || '—'} V / ${panel.imp || '—'} A</td></tr>
              <tr><td>NOCT</td><td class="mono">${panel.noct || '—'}°C</td></tr>
              <tr><td>Eficiencia</td><td class="mono">${panel.efficiency || '—'}%</td></tr>
              <tr><td>Coef. β(Voc)</td><td class="mono">${panel.tempCoeffVoc || '—'} %/°C</td></tr>
              <tr><td>Coef. γ(Pmax)</td><td class="mono">${panel.tempCoeffPmax || '—'} %/°C</td></tr>
              <tr><td>Dimensiones</td><td class="mono">${panel.length || '—'}×${panel.width || '—'} mm</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <!-- Configuración Array -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">🔗 Configuración del Parque</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md">
          <table class="data-table">
            <tbody>
              <tr><td>Strings</td><td class="mono">${arr.numStrings}</td></tr>
              <tr><td>Paneles/String</td><td class="mono">${arr.panelsPerString}</td></tr>
              <tr><td>Total Paneles</td><td class="mono">${r.totalPanels}</td></tr>
              <tr><td>Potencia Pico Total</td><td class="mono">${(r.pmax_stc_total/1000).toFixed(2)} kWp</td></tr>
              <tr><td>Inclinación (Tilt)</td><td class="mono">${arr.tiltAngle}°</td></tr>
              <tr><td>Azimut</td><td class="mono">${arr.azimuthAngle}°</td></tr>
              <tr><td>Pitch (Separación filas)</td><td class="mono">${arr.rowSpacing} m</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <!-- Condiciones y Ubicación -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0;">🌡️ Condiciones y 📍 Ubicación</h3>
          <span class="details-icon">▼</span>
        </summary>
        <div class="details-content mt-md grid-2" style="gap:var(--space-md); align-items:start;">
          <table class="data-table">
            <tbody>
              <tr><th colspan="2" style="background:var(--bg-secondary);">Condiciones Actuales</th></tr>
              <tr><td>Irradiancia</td><td class="mono">${cond.irradiance} W/m²</td></tr>
              <tr><td>T. Ambiente</td><td class="mono">${cond.ambientTemp}°C</td></tr>
              <tr><td>T. Celda</td><td class="mono">${r.tCell.toFixed(1)}°C</td></tr>
              <tr><td>Viento</td><td class="mono">${cond.windSpeed} m/s</td></tr>
              <tr><td>Cable DC</td><td class="mono">${cond.cableLength}m × ${cond.cableSection}mm² (${cond.cableMaterial.toUpperCase()})</td></tr>
            </tbody>
          </table>
          <table class="data-table">
            <tbody>
              <tr><th colspan="2" style="background:var(--bg-secondary);">Ubicación GPS</th></tr>
              <tr><td>Nombre</td><td class="mono">${loc.locationName || '—'}</td></tr>
              <tr><td>Latitud</td><td class="mono">${loc.latitude.toFixed(4)}°</td></tr>
              <tr><td>Longitud</td><td class="mono">${loc.longitude.toFixed(4)}°</td></tr>
              <tr><td>Altitud</td><td class="mono">${loc.altitude} m</td></tr>
              <tr><td>Datos Climáticos (API)</td><td class="mono">${loc.apiDataLoaded ? '✅ Cargados' : '❌ No cargados'}</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <!-- Resultados Clave -->
      <details class="card details-panel" open style="border:2px solid var(--solar-amber);">
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: var(--text-base); margin:0; color:var(--solar-amber);">⚡ Resultados Eléctricos Globales</h3>
          <span class="details-icon" style="color:var(--solar-amber);">▼</span>
        </summary>
        <div class="details-content mt-md">
          <table class="data-table">
            <tbody>
              <tr><td>Potencia Máxima Teórica (Pmax Array)</td><td class="mono" style="color:var(--solar-amber);font-weight:700;">${(r.pmax_array/1000).toFixed(2)} kW</td></tr>
              <tr><td>Potencia Máxima Neta (En inversor)</td><td class="mono" style="font-weight:700;">${(r.pmax_net/1000).toFixed(2)} kW</td></tr>
              <tr><td>Vmp de cada String</td><td class="mono">${r.vmp_string.toFixed(1)} V</td></tr>
              <tr><td>Voc de cada String</td><td class="mono">${r.voc_string.toFixed(1)} V</td></tr>
              <tr><td>Corriente Total (Imp Array)</td><td class="mono">${r.imp_array.toFixed(2)} A</td></tr>
              <tr><td>Corriente Cortocircuito Total (Isc Array)</td><td class="mono">${(r.isc_string * arr.numStrings).toFixed(2)} A</td></tr>
              <tr><td>Caída Tensión DC</td><td class="mono" style="color:var(--solar-${vdStatus.color})">${r.vdPercent.toFixed(2)}% (${vdStatus.message})</td></tr>
              <tr><td>Fill Factor Real</td><td class="mono">${(r.fillFactor*100).toFixed(1)}%</td></tr>
              <tr><td>Eficiencia Real del Panel</td><td class="mono">${r.panelEffReal.toFixed(1)}%</td></tr>
              <tr><td>Performance Ratio (PR) Estimado</td><td class="mono" style="font-weight:700;">${(r.pr_estimated*100).toFixed(1)}%</td></tr>
              <tr><td>Rendimiento Anual (Yield PVGIS)</td><td class="mono" style="color:var(--solar-green);font-weight:700;">${(r.annualYield/1000).toFixed(1)} MWh/año</td></tr>
            </tbody>
          </table>
        </div>
      </details>

    </div>
  `;
}

export function init() {
  document.querySelectorAll('details.details-panel').forEach(detail => {
    detail.addEventListener('toggle', () => {
      const icon = detail.querySelector('.details-icon');
      if (icon) icon.style.transform = detail.open ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  });

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const json = state.exportJSON();
    const projects = state.getProjects();
    const current = projects.find(p => p.id === state.get('currentProjectId'));
    const name = current ? current.name : 'proyecto';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.sol`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById('import-file-input');
  document.getElementById('btn-import-json')?.addEventListener('click', () => {
    importInput?.click();
  });

  importInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const success = state.importJSON(ev.target.result);
      if (success) {
        alert('Configuración importada correctamente.');
        navigateTo('summary');
      } else {
        alert('Error al importar el archivo.');
      }
    };
    reader.readAsText(file);
  });
}
