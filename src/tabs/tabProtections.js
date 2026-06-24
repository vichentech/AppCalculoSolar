/**
 * AppSolar — Tab: Protecciones Eléctricas
 * Cálculo de fusibles, secciones e interruptores
 */

import { state } from '../state.js';
import { calculateAll } from '../engine/solarCalc.js';

export function render() {
  const r = calculateAll();
  const arr = state.get('arrayConfig');
  const panel = state.get('panelSpecs');
  const multipliers = state.get('protectionMultipliers') || { fuse: 1.56, switch: 1.25, voc: 1.15 };

  const savedScenarios = state.get('savedScenarios') || [];
  const currentScenarioName = state.get('conditions.scenarioName') || 'Condiciones Actuales';
  const isCompareMode = currentScenarioName === 'Comparativa Global';

  const renderSingleTable = (r_data, sName, sDesc) => {
    const renderGroupProtections = (g) => {
      const isc_string_calc = g.isc_string || panel.isc;
      const voc_string_calc = g.voc_string || ((panel.voc || 0) * g.panelsPerString);
      const imp_array_calc = g.imp_array || ((panel.imp || 0) * g.numStrings);
      const vmp_array_calc = g.vmp_array || ((panel.vmp || 0) * g.panelsPerString);

      const fuseTheoretical = isc_string_calc * multipliers.fuse;
      const fuseCommercial = g.fuseCommercial || getCommercialFuse(fuseTheoretical);
      const switchDcTheoretical = imp_array_calc * multipliers.switch;
      const switchDcCommercial = g.switchCommercial || getCommercialSwitch(switchDcTheoretical);
      const vocStringMax = voc_string_calc * multipliers.voc; 
      const iscPtoTotal = isc_string_calc * g.numStrings;

      return `
        <tr style="background:var(--bg-card);">
          <td><strong>${g.name}</strong><br><span style="font-size:0.7rem;color:var(--text-secondary);">${g.numStrings} Str × ${g.panelsPerString} Pan.</span></td>
          <td class="mono">${voc_string_calc.toFixed(1)}</td>
          <td class="mono">${isc_string_calc.toFixed(2)}</td>
          <td class="mono">${vmp_array_calc.toFixed(1)}</td>
          <td class="mono">${iscPtoTotal.toFixed(2)}</td>
          <td>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tco: ${fuseTheoretical.toFixed(1)}A</div>
            <div style="display:flex; align-items:center; gap:4px;">
              <input type="number" class="form-input form-input-sm ds-fuse-override" data-group="${g.id}" value="${fuseCommercial}" style="width:70px; padding:2px; font-weight:700; color:var(--solar-amber); text-align:center;">
              <span style="font-size:0.8rem;">A</span>
            </div>
          </td>
          <td>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tco: ${switchDcTheoretical.toFixed(1)}A</div>
            <div style="display:flex; align-items:center; gap:4px;">
              <input type="number" class="form-input form-input-sm ds-switch-override" data-group="${g.id}" value="${switchDcCommercial}" style="width:70px; padding:2px; font-weight:700; color:var(--solar-blue); text-align:center;">
              <span style="font-size:0.8rem;">A</span>
            </div>
          </td>
          <td>
            <div style="font-size:0.7rem; color:var(--text-secondary);">Tco: > ${vocStringMax.toFixed(0)}V</div>
            <span class="mono" style="font-weight:700;">> ${vocStringMax.toFixed(0)} Vdc</span>
          </td>
        </tr>
      `;
    };

    const totalsIsc = (r_data.groupsData || []).reduce((acc, g) => acc + ((g.isc_string || panel.isc) * g.numStrings), 0);
    const totalsImp = (r_data.groupsData || []).reduce((acc, g) => acc + (g.imp_string || panel.imp || 0) * g.numStrings, 0);

    return `
      ${sDesc ? `<div class="alert alert-info mb-sm" style="font-size:0.8rem;">${sDesc}</div>` : ''}
      <div style="overflow-x:auto; margin-bottom: 20px;">
        <table class="data-table">
          <thead>
            <tr style="background:var(--bg-tertiary);">
              <th rowspan="2" style="border-right:1px solid var(--border-primary);">Grupo / Inversor</th>
              <th colspan="2" style="text-align:center; border-right:1px solid var(--border-primary);">Datos por String</th>
              <th colspan="2" style="text-align:center; border-right:1px solid var(--border-primary);">Datos por Inversor</th>
              <th colspan="3" style="text-align:center;">Protecciones Resultantes</th>
            </tr>
            <tr style="background:var(--bg-tertiary);">
              <th>Voc (V)</th>
              <th style="border-right:1px solid var(--border-primary);">Isc (A)</th>
              <th>Vmp (V)</th>
              <th style="border-right:1px solid var(--border-primary);">Isc Tot (A)</th>
              <th>Fusible</th>
              <th>Seccionador</th>
              <th>Tensión Máx.</th>
            </tr>
          </thead>
          <tbody>
            ${(r_data.groupsData || []).map(renderGroupProtections).join('')}
            <tr style="border-top:2px solid var(--border-primary); background:rgba(0,0,0,0.1);">
              <td><strong>TOTAL PLANTA</strong></td>
              <td class="mono">-</td>
              <td class="mono">-</td>
              <td class="mono">-</td>
              <td class="mono" style="font-weight:700;">${totalsIsc.toFixed(2)} A (Isc)<br><span style="font-size:0.8rem; color:var(--text-secondary);">${totalsImp.toFixed(2)} A (Imp)</span></td>
              <td colspan="3" style="text-align:center; color:var(--text-secondary); font-size:0.8rem;">Los fusibles y seccionadores se dimensionan por Inversor/Grupo</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  // Build Tables
  let tablesHtml = '';
  if (isCompareMode) {
    const currentConds = { ...state.get('conditions') };
    const scenarios = [
      { id: 'stc', name: 'STC (1000 W/m², 25°C)', conditions: { irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 0, albedo: 0.2 } },
      { id: 'worst', name: 'Peor Caso (-10°C, 1000 W/m²)', conditions: { irradiance: 1000, ambientTemp: -10, windSpeed: 0, humidity: 0, albedo: 0.2 } },
      { id: 'summer', name: 'Verano Caluroso (1100 W/m², 40°C)', conditions: { irradiance: 1100, ambientTemp: 40, windSpeed: 2, humidity: 20, albedo: 0.2 } },
      { id: 'winter', name: 'Invierno Frío (400 W/m², 5°C)', conditions: { irradiance: 400, ambientTemp: 5, windSpeed: 4, humidity: 60, albedo: 0.8 } }
    ];
    savedScenarios.forEach(sc => scenarios.push({ id: sc.id, name: `[Guardado] ${sc.name}`, conditions: sc.conditions }));
    
    scenarios.forEach(sc => {
      Object.entries(sc.conditions).forEach(([k, v]) => state.set(`conditions.${k}`, v));
      const res = calculateAll();
      const desc = `<strong>${sc.name}</strong> - G: ${sc.conditions.irradiance} W/m², Tª: ${sc.conditions.ambientTemp}°C, Viento: ${sc.conditions.windSpeed} m/s`;
      tablesHtml += renderSingleTable(res, sc.name, desc);
    });
    // Restore
    Object.entries(currentConds).forEach(([k, v]) => state.set(`conditions.${k}`, v));
  } else {
    tablesHtml = renderSingleTable(r, currentScenarioName, `Los cálculos se están realizando bajo las condiciones: <strong>${currentScenarioName}</strong>.`);
  }

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🛡️</span> Protecciones Eléctricas</h2>
        <p class="page-subtitle">Cálculo de tensiones, intensidades y protecciones. Edita los multiplicadores normativos o los valores comerciales resultantes.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-export-protections">💾 Exportar HTML</button>
      </div>
    </div>

    <!-- Fórmulas y Multiplicadores -->
    <div class="card mb-md" style="border-top: 3px solid var(--solar-amber);">
      <h3 style="font-size:var(--text-base); margin-bottom:var(--space-md);"><span class="icon">📐</span> Fórmulas de Cálculo y Multiplicadores</h3>
      
      <div class="grid-3" style="gap:var(--space-md);">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Fusible String (I_fusible)</label>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; font-family:var(--font-mono);">Isc_string × K_fus</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.8rem;">K_fus =</span>
            <input type="number" step="0.01" class="form-input form-input-sm" id="input-mult-fuse" value="${multipliers.fuse}" style="width:80px;">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Seccionador/Interruptor (I_sw)</label>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; font-family:var(--font-mono);">Imp_inversor × K_sw</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.8rem;">K_sw =</span>
            <input type="number" step="0.01" class="form-input form-input-sm" id="input-mult-switch" value="${multipliers.switch}" style="width:80px;">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Tensión Máxima Sistema (V_max)</label>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; font-family:var(--font-mono);">Voc_string × K_voc</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.8rem;">K_voc =</span>
            <input type="number" step="0.01" class="form-input form-input-sm" id="input-mult-voc" value="${multipliers.voc}" style="width:80px;">
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla Completa -->
    <div class="card" id="protections-table-container">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-md);">
        <div style="display:flex; align-items:center; gap:8px;">
          <h3 style="font-size:var(--text-base); margin:0;"><span class="icon">📊</span> Tabla de Resultados por Inversor / Grupo</h3>
          <span class="icon" id="btn-toggle-prot-help" style="cursor:pointer; font-size:1.1rem; color:var(--solar-blue); transition: opacity 0.2s;" title="Mostrar ayuda de cálculo">ℹ️</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.8rem; font-weight:600;">Escenario de Cálculo:</label>
          <select class="form-select" id="prot-scenario-select" style="width:250px; font-size:0.85rem; padding:4px 8px; height:32px;">
            <option value="">-- ${currentScenarioName} --</option>
            <option value="all" style="font-weight:bold; color:var(--solar-blue);">📊 Comparativa Global (Todos)</option>
            <option value="stc">☀️ STC (1000 W/m², 25°C)</option>
            <option value="worst">⚠️ Peor Caso (-10°C, 1000 W/m²)</option>
            <option value="summer">☀️ Verano Caluroso (1100 W/m², 40°C)</option>
            <option value="winter">❄️ Invierno Frío (400 W/m², 5°C)</option>
            <optgroup label="Mis Escenarios Guardados">
              ${savedScenarios.map(sc => `<option value="${sc.id}">${sc.name}</option>`).join('')}
            </optgroup>
          </select>
        </div>
      </div>

      <div id="prot-help-content" style="display:none; margin-bottom:var(--space-md);">
        <div class="alert alert-info" style="font-size:0.8rem; line-height:1.4; margin:0;">
          <strong>¿Cómo se calculan las protecciones en esta tabla?</strong><br>
          El valor teórico de corte (<strong>Tco</strong>) se obtiene multiplicando un parámetro eléctrico (intensidad o tensión) del panel por un factor de seguridad (<strong>K</strong>) que dicta la normativa (ej. REBT). 
          <ul style="margin-top:4px; margin-bottom:0; padding-left:20px;">
            <li>El parámetro eléctrico base (Isc, Imp o Voc) se extrae del <strong>motor físico de simulación</strong> basándose en el <em>Escenario de Cálculo</em> seleccionado.</li>
            <li>Por ejemplo, en el escenario de "Peor Caso", el motor calcula cuánto aumenta el <em>Voc</em> debido al frío extremo (-10°C), y utiliza ese <em>Voc</em> incrementado para calcular la Tensión Máxima.</li>
            <li>A partir del valor <strong>Tco</strong> teórico, el sistema selecciona el calibre comercial superior más cercano, el cual puedes sobrescribir manualmente pulsando sobre él.</li>
          </ul>
        </div>
      </div>

      ${tablesHtml}
    </div>
  `;
}

export function init() {
  const refresh = () => {
    const mainUi = document.querySelector('.page-title-bar').parentElement;
    mainUi.innerHTML = render();
    init();
  };

  // Listeners para los multiplicadores
  ['fuse', 'switch', 'voc'].forEach(key => {
    const input = document.getElementById(`input-mult-${key}`);
    if (input) {
      input.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          const multipliers = state.get('protectionMultipliers') || { fuse: 1.56, switch: 1.25, voc: 1.15 };
          multipliers[key] = val;
          state.set('protectionMultipliers', multipliers);
          refresh();
        }
      });
    }
  });

  // Listeners para sobrescribir valores comerciales
  document.querySelectorAll('.ds-fuse-override').forEach(el => {
    el.addEventListener('change', (e) => {
      const groupId = e.target.dataset.group;
      const val = parseFloat(e.target.value);
      const arr = state.get('arrayConfig');
      const group = arr.groups.find(g => g.id === groupId);
      if (group && !isNaN(val)) {
        group.fuseCommercial = val;
        state.set('arrayConfig', arr);
        // We don't necessarily need a full refresh if we just bind the value, but let's refresh to be consistent
      }
    });
  });

  document.querySelectorAll('.ds-switch-override').forEach(el => {
    el.addEventListener('change', (e) => {
      const groupId = e.target.dataset.group;
      const val = parseFloat(e.target.value);
      const arr = state.get('arrayConfig');
      const group = arr.groups.find(g => g.id === groupId);
      if (group && !isNaN(val)) {
        group.switchCommercial = val;
        state.set('arrayConfig', arr);
      }
    });
  });

  // Listener para el selector de escenarios
  document.getElementById('prot-scenario-select')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;

    const setScenario = (name, conds) => {
      state.set('conditions.scenarioName', name);
      Object.entries(conds).forEach(([key, value]) => {
        state.set(`conditions.${key}`, value);
      });
      refresh();
    };

    if (val === 'all') setScenario('Comparativa Global', {});
    else if (val === 'stc') setScenario('STC (1000 W/m², 25°C)', { irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 0, albedo: 0.2 });
    else if (val === 'worst') setScenario('Peor Caso (-10°C, 1000 W/m²)', { irradiance: 1000, ambientTemp: -10, windSpeed: 0, humidity: 0, albedo: 0.2 });
    else if (val === 'summer') setScenario('Verano Caluroso (1100 W/m², 40°C)', { irradiance: 1100, ambientTemp: 40, windSpeed: 2, humidity: 20, albedo: 0.2 });
    else if (val === 'winter') setScenario('Invierno Frío (400 W/m², 5°C)', { irradiance: 400, ambientTemp: 5, windSpeed: 4, humidity: 60, albedo: 0.8 });
    else {
      const scenarios = state.get('savedScenarios') || [];
      const sc = scenarios.find(s => s.id === val);
      if (sc) setScenario(sc.name, sc.conditions);
    }
  });

  // Listener para mostrar/ocultar ayuda
  document.getElementById('btn-toggle-prot-help')?.addEventListener('click', () => {
    const helpContent = document.getElementById('prot-help-content');
    if (helpContent) {
      if (helpContent.style.display === 'none') {
        helpContent.style.display = 'block';
      } else {
        helpContent.style.display = 'none';
      }
    }
  });

  // Exportar a HTML
  document.getElementById('btn-export-protections')?.addEventListener('click', () => {
    // Save current conditions
    const currentScenarioName = state.get('conditions.scenarioName') || 'Condiciones Actuales';
    const currentConds = { ...state.get('conditions') };
    
    // Define scenarios
    const exportScenarios = [
      { id: 'stc', name: 'STC (1000 W/m², 25°C)', conditions: { irradiance: 1000, ambientTemp: 25, windSpeed: 1, humidity: 0, albedo: 0.2 } },
      { id: 'worst', name: 'Peor Caso (-10°C, 1000 W/m²)', conditions: { irradiance: 1000, ambientTemp: -10, windSpeed: 0, humidity: 0, albedo: 0.2 } },
      { id: 'summer', name: 'Verano Caluroso (1100 W/m², 40°C)', conditions: { irradiance: 1100, ambientTemp: 40, windSpeed: 2, humidity: 20, albedo: 0.2 } },
      { id: 'winter', name: 'Invierno Frío (400 W/m², 5°C)', conditions: { irradiance: 400, ambientTemp: 5, windSpeed: 4, humidity: 60, albedo: 0.8 } }
    ];
    
    // Add saved custom scenarios
    const savedScenarios = state.get('savedScenarios') || [];
    savedScenarios.forEach(sc => {
      exportScenarios.push({ id: sc.id, name: `[Guardado] ${sc.name}`, conditions: sc.conditions });
    });

    const panel = state.get('panelSpecs');
    const multipliers = state.get('protectionMultipliers') || { fuse: 1.56, switch: 1.25, voc: 1.15 };

    let allTablesHtml = '';

    // Loop through scenarios, calculate and build HTML
    exportScenarios.forEach(sc => {
      // Set state to scenario
      Object.entries(sc.conditions).forEach(([k, v]) => state.set(`conditions.${k}`, v));
      
      const r = calculateAll();
      
      const totalsIsc = (r.groupsData || []).reduce((acc, g) => acc + ((g.isc_string || panel.isc) * g.numStrings), 0);
      const totalsImp = (r.groupsData || []).reduce((acc, g) => acc + (g.imp_string || panel.imp || 0) * g.numStrings, 0);

      const rowsHtml = (r.groupsData || []).map(g => {
        const isc_string_calc = g.isc_string || panel.isc;
        const voc_string_calc = g.voc_string || ((panel.voc || 0) * g.panelsPerString);
        const imp_array_calc = g.imp_array || ((panel.imp || 0) * g.numStrings);
        const vmp_array_calc = g.vmp_array || ((panel.vmp || 0) * g.panelsPerString);

        const fuseTheoretical = isc_string_calc * multipliers.fuse;
        const fuseCommercial = g.fuseCommercial || getCommercialFuse(fuseTheoretical);
        const switchDcTheoretical = imp_array_calc * multipliers.switch;
        const switchDcCommercial = g.switchCommercial || getCommercialSwitch(switchDcTheoretical);
        const vocStringMax = voc_string_calc * multipliers.voc; 
        const iscPtoTotal = isc_string_calc * g.numStrings;

        return `
          <tr>
            <td><strong>${g.name}</strong><br><span style="font-size:0.8em;color:#666;">${g.numStrings} Str × ${g.panelsPerString} Pan.</span></td>
            <td class="mono">${voc_string_calc.toFixed(1)}</td>
            <td class="mono">${isc_string_calc.toFixed(2)}</td>
            <td class="mono">${vmp_array_calc.toFixed(1)}</td>
            <td class="mono">${iscPtoTotal.toFixed(2)}</td>
            <td><strong>${fuseCommercial} A</strong><br><span style="font-size:0.7em; color:#666;">Tco: ${fuseTheoretical.toFixed(1)}A</span></td>
            <td><strong>${switchDcCommercial} A</strong><br><span style="font-size:0.7em; color:#666;">Tco: ${switchDcTheoretical.toFixed(1)}A</span></td>
            <td><strong>> ${vocStringMax.toFixed(0)} Vdc</strong></td>
          </tr>
        `;
      }).join('');

      allTablesHtml += `
        <h3 style="margin-top: 40px; padding-bottom: 5px; border-bottom: 2px solid #2563eb; color: #1e3a8a;">Escenario: ${sc.name}</h3>
        <p style="font-size:14px; color:#555; background: #f0fdf4; padding: 8px; border-left: 4px solid #16a34a; margin-bottom: 10px;">
          <strong>Condiciones de simulación:</strong> Irradiancia ${sc.conditions.irradiance} W/m², Temp ${sc.conditions.ambientTemp}°C, Viento ${sc.conditions.windSpeed} m/s
        </p>
        <table>
          <thead>
            <tr>
              <th rowspan="2">Grupo / Inversor</th>
              <th colspan="2">Datos por String</th>
              <th colspan="2">Datos por Inversor</th>
              <th colspan="3">Protecciones Resultantes</th>
            </tr>
            <tr>
              <th>Voc (V)</th>
              <th>Isc (A)</th>
              <th>Vmp (V)</th>
              <th>Isc Tot (A)</th>
              <th>Fusible</th>
              <th>Seccionador</th>
              <th>Tensión Máx.</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td>TOTAL PLANTA</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td style="color:#047857;">${totalsIsc.toFixed(2)} A (Isc) / ${totalsImp.toFixed(2)} A (Imp)</td>
              <td colspan="3" style="font-weight:normal; font-size:12px; color:#666; text-align:center;">Protecciones dimensionadas por Inversor/Grupo</td>
            </tr>
          </tbody>
        </table>
      `;
    });

    // Restore original state
    Object.entries(currentConds).forEach(([k, v]) => state.set(`conditions.${k}`, v));
    state.set('conditions.scenarioName', currentScenarioName);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Informe de Protecciones Múltiples</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; max-width: 1200px; margin: 0 auto; }
          h2 { color: #0f172a; border-bottom: 3px solid #f59e0b; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; }
          th { background-color: #e2e8f0; color: #1e293b; font-weight: 600; }
          .mono { font-family: 'Courier New', Courier, monospace; }
        </style>
      </head>
      <body>
        <h2>Informe Avanzado de Protecciones del Parque Solar</h2>
        <p style="font-size:14px; color:#475569;">
          Este documento detalla el dimensionamiento de las protecciones eléctricas para cada grupo e inversor bajo diferentes condiciones operativas.
          Los valores de protección se calculan multiplicando el valor eléctrico (Voc, Isc, Imp) por los factores normativos configurados en la aplicación.
        </p>
        ${allTablesHtml}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'protecciones_informe_completo.html';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Valores comerciales estándar para fusibles DC (A)
function getCommercialFuse(theoreticalValue) {
  const standardFuses = [2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40];
  for (let f of standardFuses) {
    if (f >= theoreticalValue) return f;
  }
  return Math.ceil(theoreticalValue / 5) * 5; // Fallback
}

// Valores comerciales estándar para magnetotérmicos (A)
function getCommercialSwitch(theoreticalValue) {
  const standardSwitches = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];
  for (let s of standardSwitches) {
    if (s >= theoreticalValue) return s;
  }
  return Math.ceil(theoreticalValue / 10) * 10;
}
