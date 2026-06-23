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

  const totalPanels = arr.invertersCount * arr.numStrings * arr.panelsPerString;

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

    <!-- Pestañas del Resumen -->
    <div class="tabs-header mb-md" style="display:flex; gap:16px; border-bottom:1px solid var(--border-primary); padding-bottom:8px;">
      <button class="btn btn-ghost summary-tab-btn active" data-target="sum-panel" style="border-bottom:2px solid var(--solar-amber); border-radius:0;">☀️ Panel Solar</button>
      <button class="btn btn-ghost summary-tab-btn" data-target="sum-array" style="border-radius:0;">🔗 Configuración Parque</button>
      <button class="btn btn-ghost summary-tab-btn" data-target="sum-cond" style="border-radius:0;">🌡️ Condiciones y Ubicación</button>
      <button class="btn btn-ghost summary-tab-btn" data-target="sum-results" style="border-radius:0;">⚡ Resultados Eléctricos</button>
    </div>

    <div class="tabs-content" style="min-height: 300px;">
      
      <!-- Panel Solar -->
      <div id="sum-panel" class="summary-tab-content">
        <div class="card">
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
      </div>

      <!-- Configuración Array -->
      <div id="sum-array" class="summary-tab-content" style="display:none;">
        <div class="card">
          <table class="data-table">
            <tbody>
              <tr><td>Inversores / Grupos</td><td class="mono">${arr.invertersCount}</td></tr>
              <tr><td>Strings por Grupo</td><td class="mono">${arr.numStrings}</td></tr>
              <tr><td>Paneles por String</td><td class="mono">${arr.panelsPerString}</td></tr>
              <tr><td>Total Paneles (Planta)</td><td class="mono">${totalPanels}</td></tr>
              <tr><td>Potencia Pico Total</td><td class="mono">${((totalPanels * panel.pmax)/1000).toFixed(2)} kWp</td></tr>
              <tr><td>Inclinación (Tilt)</td><td class="mono">${arr.useOptimalTilt ? 'Óptima Automática' : arr.tiltAngle + '°'}</td></tr>
              <tr><td>Azimut</td><td class="mono">${arr.useOptimalTilt ? 'Óptimo Automático' : arr.azimuthAngle + '°'}</td></tr>
              <tr><td>Pitch (Separación filas)</td><td class="mono">${arr.rowSpacing} m</td></tr>
              <tr><td>Tipo Seguimiento</td><td class="mono">${arr.trackerType}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Condiciones y Ubicación -->
      <div id="sum-cond" class="summary-tab-content" style="display:none;">
        <div class="grid-2" style="gap:var(--space-md); align-items:start;">
          <div class="card">
            <h3 style="font-size:var(--text-sm); margin-bottom:var(--space-sm);">Condiciones de Simulación Actuales</h3>
            <table class="data-table">
              <tbody>
                <tr><td>Irradiancia (Pico)</td><td class="mono">${cond.irradiance} W/m²</td></tr>
                <tr><td>T. Ambiente (Pico)</td><td class="mono">${cond.ambientTemp}°C</td></tr>
                <tr><td>T. Celda Calculada</td><td class="mono">${r.tCell.toFixed(1)}°C</td></tr>
                <tr><td>Viento</td><td class="mono">${cond.windSpeed} m/s</td></tr>
                <tr><td>Pérdidas Cableado</td><td class="mono">${cond.cableLossEnabled ? 'Activado' : 'Desactivado'}</td></tr>
                ${cond.cableLossEnabled ? `<tr><td>Cable DC</td><td class="mono">${cond.cableLength}m × ${cond.cableSection}mm² (${cond.cableMaterial.toUpperCase()})</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div class="card">
            <h3 style="font-size:var(--text-sm); margin-bottom:var(--space-sm);">Ubicación GPS</h3>
            <table class="data-table">
              <tbody>
                <tr><td>Nombre</td><td class="mono">${loc.locationName || '—'}</td></tr>
                <tr><td>Latitud</td><td class="mono">${loc.latitude.toFixed(4)}°</td></tr>
                <tr><td>Longitud</td><td class="mono">${loc.longitude.toFixed(4)}°</td></tr>
                <tr><td>Altitud</td><td class="mono">${loc.altitude} m</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Resultados Clave -->
      <div id="sum-results" class="summary-tab-content" style="display:none;">
        <div class="card" style="border:2px solid var(--solar-amber);">
          <table class="data-table">
            <tbody>
              <tr><td>Potencia Máxima Teórica (Sistema)</td><td class="mono" style="color:var(--solar-amber);font-weight:700;">${(r.pmax_total_system/1000).toFixed(2)} kW</td></tr>
              <tr><td>Potencia Máxima Neta (En inversor)</td><td class="mono" style="font-weight:700;">${(r.pmax_net/1000).toFixed(2)} kW</td></tr>
              <tr><td>Vmp (Promedio Sistema)</td><td class="mono">${r.vmp_avg_system.toFixed(1)} V</td></tr>
              <tr><td>Corriente Total Sistema (Imp)</td><td class="mono">${r.imp_total_system.toFixed(2)} A</td></tr>
              <tr><td>Caída Tensión DC</td><td class="mono" style="color:var(--solar-${vdStatus.color})">${r.vdPercent.toFixed(2)}% (${vdStatus.message})</td></tr>
              <tr><td>Fill Factor Real</td><td class="mono">${(r.fillFactor*100).toFixed(1)}%</td></tr>
              <tr><td>Eficiencia Real del Panel</td><td class="mono">${r.panelEffReal.toFixed(1)}%</td></tr>
              <tr><td>Performance Ratio (PR) Estimado</td><td class="mono" style="font-weight:700;">${(r.pr_estimated*100).toFixed(1)}%</td></tr>
              <tr><td>Rendimiento Anual (Yield PVGIS)</td><td class="mono" style="color:var(--solar-green);font-weight:700;">${(r.annualYield/1000).toFixed(1)} MWh/año</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Advertencias en la parte inferior -->
    <div class="mt-lg">
      ${alerts.length > 0 ? alerts.map(a => `<div class="alert alert-${a.type} mb-sm"><span>${a.msg}</span></div>`).join('') : `<div class="alert alert-success"><span>✅ Todos los parámetros operativos están dentro de los rangos recomendados.</span></div>`}
    </div>
  `;
}

export function init() {
  document.querySelectorAll('.summary-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.summary-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.borderBottom = 'none';
      });
      document.querySelectorAll('.summary-tab-content').forEach(c => c.style.display = 'none');
      
      e.target.classList.add('active');
      e.target.style.borderBottom = '2px solid var(--solar-amber)';
      
      const targetId = e.target.dataset.target;
      document.getElementById(targetId).style.display = 'block';
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
