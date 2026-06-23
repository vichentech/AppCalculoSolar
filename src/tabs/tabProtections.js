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

  // Cálculos de protecciones
  // 1. Fusibles de String DC (Típicamente Isc * 1.56, se normaliza al valor comercial superior)
  const iscString = r.isc_string;
  const fuseTheoretical = iscString * 1.56;
  const fuseCommercial = getCommercialFuse(fuseTheoretical);

  // 2. Interruptor General DC (Corte en carga)
  const impArray = r.imp_array;
  const switchDcTheoretical = impArray * 1.25;
  const switchDcCommercial = getCommercialSwitch(switchDcTheoretical);

  // 3. Tensión máxima del sistema (Voc max considerando temperatura más fría, ej. -10ºC)
  // Simplificado: usamos Voc STC * 1.15 como margen de seguridad estándar si no calculamos exacto a -10ºC
  const vocStringMax = r.voc_string * 1.15; 
  
  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🛡️</span> Protecciones Eléctricas</h2>
        <p class="page-subtitle">Dimensionamiento de seguridad (fusibles, seccionadores e interruptores) basado en normativas (NEC/IEC).</p>
      </div>
    </div>

    <div class="grid-2" style="gap:var(--space-md); align-items:start;">
      
      <!-- Protecciones DC por String -->
      <div class="card" style="border-top: 4px solid var(--solar-amber);">
        <div class="card-header">
          <h3>⚡ Protecciones DC (Por String)</h3>
        </div>
        <p style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:var(--space-md);">
          Se deben proteger los strings contra corrientes inversas cuando hay 3 o más strings en paralelo.
        </p>

        <div class="stats-row" style="grid-template-columns: 1fr;">
          <div class="stat-card" style="margin-bottom:var(--space-sm);">
            <div class="stat-icon">🔥</div>
            <div class="stat-label">Corriente Cortocircuito (Isc)</div>
            <div class="stat-value">${iscString.toFixed(2)}<span class="stat-unit">A</span></div>
          </div>
          <div class="stat-card" style="margin-bottom:var(--space-sm);">
            <div class="stat-icon">🧮</div>
            <div class="stat-label">Valor Teórico (Isc × 1.56)</div>
            <div class="stat-value">${fuseTheoretical.toFixed(2)}<span class="stat-unit">A</span></div>
          </div>
          <div class="stat-card" style="background:rgba(245, 158, 11, 0.1); border-color:var(--solar-amber);">
            <div class="stat-icon">🔌</div>
            <div class="stat-label" style="color:var(--text-primary); font-weight:700;">Fusible Comercial Recomendado</div>
            <div class="stat-value" style="color:var(--solar-amber);">${fuseCommercial}<span class="stat-unit">A</span></div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Tensión nominal: > ${vocStringMax.toFixed(0)} Vdc</div>
          </div>
        </div>

        ${arr.numStrings < 3 ? `
          <div class="alert alert-info mt-md">
            <span>ℹ️</span>
            <div>Como solo tienes ${arr.numStrings} string(s) en paralelo, normativa indica que <strong>no es obligatorio</strong> el uso de fusibles de string (aunque sí seccionador general).</div>
          </div>
        ` : ''}
      </div>

      <!-- Interruptor / Seccionador General -->
      <div class="card" style="border-top: 4px solid var(--solar-blue);">
        <div class="card-header">
          <h3>📦 Seccionador General DC (Array)</h3>
        </div>
        <p style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:var(--space-md);">
          Interruptor de corte en carga para aislar el campo fotovoltaico del inversor.
        </p>

        <div class="stats-row" style="grid-template-columns: 1fr;">
          <div class="stat-card" style="margin-bottom:var(--space-sm);">
            <div class="stat-icon">🌊</div>
            <div class="stat-label">Corriente Total (Imp Array)</div>
            <div class="stat-value">${impArray.toFixed(2)}<span class="stat-unit">A</span></div>
          </div>
          <div class="stat-card" style="margin-bottom:var(--space-sm);">
            <div class="stat-icon">🧮</div>
            <div class="stat-label">Valor Teórico (Imp × 1.25)</div>
            <div class="stat-value">${switchDcTheoretical.toFixed(2)}<span class="stat-unit">A</span></div>
          </div>
          <div class="stat-card" style="background:rgba(59, 130, 246, 0.1); border-color:var(--solar-blue);">
            <div class="stat-icon">🎛️</div>
            <div class="stat-label" style="color:var(--text-primary); font-weight:700;">Interruptor Magnetotérmico DC</div>
            <div class="stat-value" style="color:var(--solar-blue);">${switchDcCommercial}<span class="stat-unit">A</span></div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Número de polos: 2 (Corte omnipolar)</div>
          </div>
        </div>
      </div>
    </div>
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
