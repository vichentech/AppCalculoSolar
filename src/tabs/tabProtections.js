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

  // 3. Tensión máxima del sistema
  
  const renderGroupProtections = (g) => {
    const fuseTheoretical = g.isc_string * 1.56;
    const fuseCommercial = getCommercialFuse(fuseTheoretical);
    const switchDcTheoretical = g.imp_array * 1.25;
    const switchDcCommercial = getCommercialSwitch(switchDcTheoretical);
    const vocStringMax = g.voc_string * 1.15; 

    return `
      <div class="card mb-lg" style="border-top: 4px solid var(--solar-amber);">
        <div class="card-header">
          <h3>⚡ Protecciones DC (${g.name})</h3>
          <p style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:var(--space-sm);">
            ${g.numStrings} Strings en paralelo | ${g.panelsPerString} Paneles/String
          </p>
        </div>

        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Cálculo / Referencia</th>
                <th>Valor Resultante</th>
              </tr>
            </thead>
            <tbody>
              <!-- FUSIBLES -->
              <tr>
                <td>Corriente Cortocircuito String (Isc)</td>
                <td style="color:var(--text-secondary); font-size:var(--text-xs);">Ficha Técnica</td>
                <td class="mono">${g.isc_string.toFixed(2)} A</td>
              </tr>
              <tr style="background:rgba(245, 158, 11, 0.05);">
                <td style="font-weight:700; color:var(--solar-amber);">Fusible Comercial (Por String)</td>
                <td style="color:var(--text-secondary); font-size:var(--text-xs);">Normalizado superior a ${fuseTheoretical.toFixed(1)}A</td>
                <td class="mono" style="font-weight:700; color:var(--solar-amber); font-size:1.1rem;">${fuseCommercial} A</td>
              </tr>
              <!-- SECCIONADOR -->
              <tr>
                <td>Corriente Total Inversor (Imp Array)</td>
                <td style="color:var(--text-secondary); font-size:var(--text-xs);">Suma total de Imp por string</td>
                <td class="mono">${g.imp_array.toFixed(2)} A</td>
              </tr>
              <tr style="background:rgba(59, 130, 246, 0.05);">
                <td style="font-weight:700; color:var(--solar-blue);">Seccionador General DC</td>
                <td style="color:var(--text-secondary); font-size:var(--text-xs);">Normalizado superior a ${switchDcTheoretical.toFixed(1)}A</td>
                <td class="mono" style="font-weight:700; color:var(--solar-blue); font-size:1.1rem;">${switchDcCommercial} A</td>
              </tr>
              <!-- TENSION -->
              <tr>
                <td>Tensión Nominal Mínima</td>
                <td style="color:var(--text-secondary); font-size:var(--text-xs);">Voc × 1.15 (Margen Frío)</td>
                <td class="mono">> ${vocStringMax.toFixed(0)} Vdc</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${g.numStrings < 3 ? `
          <div class="alert alert-info mt-md">
            <span>ℹ️</span>
            <div>Como solo tienes ${g.numStrings} string(s) en paralelo, normativa indica que <strong>no es obligatorio</strong> el uso de fusibles de string (aunque sí seccionador general).</div>
          </div>
        ` : ''}
      </div>
    `;
  };

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🛡️</span> Protecciones Eléctricas</h2>
        <p class="page-subtitle">Dimensionamiento de seguridad (fusibles, seccionadores e interruptores) basado en normativas (NEC/IEC).</p>
      </div>
    </div>

    ${(r.groupsData || []).map(renderGroupProtections).join('')}
  `;
}

export function init() {
  // No interactions needed, pure calculated view
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
