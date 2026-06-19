/**
 * AppSolar — Tab: Resumen General
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
        <button class="btn btn-secondary btn-sm" id="btn-export-json">💾 Exportar Proyecto (.sol)</button>
        <button class="btn btn-secondary btn-sm" id="btn-import-json">📂 Importar Proyecto (.sol)</button>
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

    <div class="grid-3">
      <!-- Panel Solar -->
      <div class="card card-accent">
        <div class="card-header">
          <h3>☀️ Panel Solar</h3>
        </div>
        <table class="data-table">
          <tbody>
            <tr><td>Modelo</td><td class="mono">${panel.modelName}</td></tr>
            <tr><td>Fabricante</td><td class="mono">${panel.manufacturer}</td></tr>
            <tr><td>Tipo</td><td class="mono">${panel.cellType}</td></tr>
            <tr><td>Pmax (STC)</td><td class="mono">${panel.pmax} Wp</td></tr>
            <tr><td>Voc / Isc</td><td class="mono">${panel.voc} V / ${panel.isc} A</td></tr>
            <tr><td>Vmp / Imp</td><td class="mono">${panel.vmp} V / ${panel.imp} A</td></tr>
            <tr><td>NOCT</td><td class="mono">${panel.noct}°C</td></tr>
            <tr><td>Eficiencia</td><td class="mono">${panel.efficiency}%</td></tr>
            <tr><td>Coef. β(Voc)</td><td class="mono">${panel.tempCoeffVoc} %/°C</td></tr>
            <tr><td>Coef. γ(Pmax)</td><td class="mono">${panel.tempCoeffPmax} %/°C</td></tr>
            <tr><td>Dimensiones</td><td class="mono">${panel.length}×${panel.width} mm</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Configuración Array -->
      <div class="card card-accent">
        <div class="card-header">
          <h3>🔗 Configuración Array</h3>
        </div>
        <table class="data-table">
          <tbody>
            <tr><td>Strings</td><td class="mono">${arr.numStrings}</td></tr>
            <tr><td>Paneles/String</td><td class="mono">${arr.panelsPerString}</td></tr>
            <tr><td>Total Paneles</td><td class="mono">${r.totalPanels}</td></tr>
            <tr><td>Potencia Pico</td><td class="mono">${(r.pmax_stc_total/1000).toFixed(2)} kWp</td></tr>
            <tr><td>Inclinación</td><td class="mono">${arr.tiltAngle}°</td></tr>
            <tr><td>Azimut</td><td class="mono">${arr.azimuthAngle}°</td></tr>
            <tr><td>Separación filas</td><td class="mono">${arr.rowSpacing} m</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Ubicación -->
      <div class="card card-accent">
        <div class="card-header">
          <h3>📍 Ubicación</h3>
        </div>
        <table class="data-table">
          <tbody>
            <tr><td>Nombre</td><td class="mono">${loc.locationName}</td></tr>
            <tr><td>Latitud</td><td class="mono">${loc.latitude.toFixed(4)}°</td></tr>
            <tr><td>Longitud</td><td class="mono">${loc.longitude.toFixed(4)}°</td></tr>
            <tr><td>Altitud</td><td class="mono">${loc.altitude} m</td></tr>
            <tr><td>Datos API</td><td class="mono">${loc.apiDataLoaded ? '✅ Cargados' : '❌ No cargados'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid-2 mt-lg">
      <!-- Condiciones -->
      <div class="card card-accent">
        <div class="card-header">
          <h3>🌡️ Condiciones de Operación</h3>
        </div>
        <table class="data-table">
          <tbody>
            <tr><td>Irradiancia</td><td class="mono">${cond.irradiance} W/m²</td></tr>
            <tr><td>T. Ambiente</td><td class="mono">${cond.ambientTemp}°C</td></tr>
            <tr><td>T. Celda</td><td class="mono">${r.tCell.toFixed(1)}°C</td></tr>
            <tr><td>Viento</td><td class="mono">${cond.windSpeed} m/s</td></tr>
            <tr><td>Cable DC</td><td class="mono">${cond.cableLength}m × ${cond.cableSection}mm² (${cond.cableMaterial.toUpperCase()})</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Resultados Clave -->
      <div class="card" style="border:2px solid var(--solar-amber);">
        <div class="card-header">
          <h3>⚡ Resultados Clave</h3>
          <span class="badge badge-amber">Calculados</span>
        </div>
        <table class="data-table">
          <tbody>
            <tr><td>Pmax Array</td><td class="mono" style="color:var(--solar-amber);font-weight:700;">${(r.pmax_array/1000).toFixed(2)} kW</td></tr>
            <tr><td>Pmax Neta</td><td class="mono" style="font-weight:700;">${(r.pmax_net/1000).toFixed(2)} kW</td></tr>
            <tr><td>Vmp String</td><td class="mono">${r.vmp_string.toFixed(1)} V</td></tr>
            <tr><td>Voc String</td><td class="mono">${r.voc_string.toFixed(1)} V</td></tr>
            <tr><td>Imp Total</td><td class="mono">${r.imp_array.toFixed(2)} A</td></tr>
            <tr><td>Caída V Cable</td><td class="mono" style="color:var(--solar-${vdStatus.color})">${r.vdPercent.toFixed(2)}% (${vdStatus.message})</td></tr>
            <tr><td>Fill Factor</td><td class="mono">${(r.fillFactor*100).toFixed(1)}%</td></tr>
            <tr><td>Eficiencia Real</td><td class="mono">${r.panelEffReal.toFixed(1)}%</td></tr>
            <tr><td>PR Estimado</td><td class="mono" style="font-weight:700;">${(r.pr_estimated*100).toFixed(1)}%</td></tr>
            <tr><td>Yield Anual</td><td class="mono" style="color:var(--solar-green);font-weight:700;">${(r.annualYield/1000).toFixed(1)} MWh/año</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function init() {
  // Export JSON
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

  // Import JSON
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
        // Re-render
        navigateTo('summary');
      } else {
        alert('Error al importar el archivo.');
      }
    };
    reader.readAsText(file);
  });
}
