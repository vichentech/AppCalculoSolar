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

  const renderGroupProtections = (g) => {
    const isc_string_stc = panel.isc || g.isc_string;
    const voc_string_stc = (panel.voc || 0) * g.panelsPerString;
    const imp_array_stc = (panel.imp || 0) * g.numStrings;
    const vmp_array_stc = (panel.vmp || 0) * g.panelsPerString;

    const fuseTheoretical = isc_string_stc * multipliers.fuse;
    const fuseCommercial = g.fuseCommercial || getCommercialFuse(fuseTheoretical);
    const switchDcTheoretical = imp_array_stc * multipliers.switch;
    const switchDcCommercial = g.switchCommercial || getCommercialSwitch(switchDcTheoretical);
    const vocStringMax = voc_string_stc * multipliers.voc; 
    const iscPtoTotal = isc_string_stc * g.numStrings;

    return `
      <tr style="background:var(--bg-card);">
        <td><strong>${g.name}</strong><br><span style="font-size:0.7rem;color:var(--text-secondary);">${g.numStrings} Str × ${g.panelsPerString} Pan.</span></td>
        <td class="mono">${voc_string_stc.toFixed(1)}</td>
        <td class="mono">${isc_string_stc.toFixed(2)}</td>
        <td class="mono">${vmp_array_stc.toFixed(1)}</td>
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

  const totalsIsc = (r.groupsData || []).reduce((acc, g) => acc + ((panel.isc || g.isc_string) * g.numStrings), 0);
  const totalsImp = (r.groupsData || []).reduce((acc, g) => acc + ((panel.imp || 0) * g.numStrings), 0);

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
      <h3 style="font-size:var(--text-base); margin-bottom:var(--space-md);"><span class="icon">📊</span> Tabla de Resultados por Inversor / Grupo</h3>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr style="background:var(--bg-tertiary);">
              <th rowspan="2" style="border-right:1px solid var(--border-primary);">Grupo / Inversor</th>
              <th colspan="2" style="text-align:center; border-right:1px solid var(--border-primary);">Datos por String (Condiciones STC Peores)</th>
              <th colspan="2" style="text-align:center; border-right:1px solid var(--border-primary);">Datos por Inversor (Total STC)</th>
              <th colspan="3" style="text-align:center;">Protecciones Resultantes</th>
            </tr>
            <tr style="background:var(--bg-tertiary);">
              <th>Voc (V)</th>
              <th style="border-right:1px solid var(--border-primary);">Isc (A)</th>
              <th>Vmp (V)</th>
              <th style="border-right:1px solid var(--border-primary);">Isc Tot (A)</th>
              <th>Fusible (Por String)</th>
              <th>Seccionador (General DC)</th>
              <th>Tensión Aislamiento</th>
            </tr>
          </thead>
          <tbody>
            ${(r.groupsData || []).map(renderGroupProtections).join('')}
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

  // Exportar a HTML
  document.getElementById('btn-export-protections')?.addEventListener('click', () => {
    const container = document.getElementById('protections-table-container');
    if (!container) return;

    // Clone and prepare for export (replace inputs with static text)
    const clone = container.cloneNode(true);
    clone.querySelectorAll('input.ds-fuse-override, input.ds-switch-override').forEach(inp => {
      const span = document.createElement('span');
      span.textContent = inp.value;
      span.style.fontWeight = 'bold';
      inp.parentNode.replaceChild(span, inp);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Listado de Protecciones</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          th { background-color: #f4f4f4; }
          .mono { font-family: monospace; }
        </style>
      </head>
      <body>
        <h2>Listado de Protecciones del Parque Solar</h2>
        ${clone.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protecciones_parque.html`;
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
