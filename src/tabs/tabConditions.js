/**
 * AppSolar — Tab: Condiciones Externas y Escenarios
 */

import { state } from '../state.js';


const CABLE_FIELDS = [
  { key: 'cableLength', label: 'Longitud Cable DC (Hasta Inversor)', unit: 'm', min: 1, max: 500, step: 1 },
  { key: 'cableSection', label: 'Sección Cable DC', unit: 'mm²', min: 1.5, max: 240, step: 0.5 },
];

export function render() {
  const cond = state.get('conditions');


  const renderCable = (f) => `
    <div class="form-group">
      <label class="form-label">${f.label} <span class="unit">[${f.unit}]</span></label>
      <div class="form-input-with-unit">
        <input class="form-input" type="number" id="input-${f.key}" value="${cond[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}">
        <span class="input-unit">${f.unit}</span>
      </div>
    </div>
  `;

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">🌡️</span> Condiciones Externas</h2>
        <p class="page-subtitle">Ajusta los parámetros ambientales de simulación diarios y cableado.</p>
      </div>
    </div>

    <div class="accordion-container" style="display:flex; flex-direction:column; gap:var(--space-md);">
      

      <!-- Panel 2: Cableado -->
      <details class="card details-panel" open>
        <summary class="card-header details-summary" style="cursor:pointer; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <h3 style="font-size: var(--text-base); margin:0;">🔌 Cableado DC</h3>
            <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:normal;" onclick="event.stopPropagation()">
              <input type="checkbox" id="checkbox-cable-loss" ${cond.cableLossEnabled ? 'checked' : ''} style="accent-color:var(--solar-amber); width:16px; height:16px;">
              Habilitar cálculo de pérdidas
            </label>
          </div>
          <span class="details-icon">▼</span>
        </summary>
        
        <div class="details-content mt-md" id="cable-content-area" style="opacity: ${cond.cableLossEnabled ? '1' : '0.4'}; pointer-events: ${cond.cableLossEnabled ? 'auto' : 'none'}; transition: opacity 0.2s;">
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:var(--space-md);">Estas pérdidas se aplican a las agrupaciones finales de strings hacia el inversor.</p>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            ${CABLE_FIELDS.map(renderCable).join('')}
            <div class="form-group">
              <label class="form-label">Material del Conductor</label>
              <select class="form-select" id="select-cable-material">
                <option value="cu" ${cond.cableMaterial === 'cu' ? 'selected' : ''}>Cobre (Cu) — ρ = 0.0172</option>
                <option value="al" ${cond.cableMaterial === 'al' ? 'selected' : ''}>Aluminio (Al) — ρ = 0.0283</option>
              </select>
            </div>
          </div>
        </div>
      </details>

    </div>
  `;
}

export function init() {

  // Cable Loss Checkbox
  const cbCableLoss = document.getElementById('checkbox-cable-loss');
  if (cbCableLoss) {
    cbCableLoss.addEventListener('change', (e) => {
      state.set('conditions.cableLossEnabled', e.target.checked);
      const area = document.getElementById('cable-content-area');
      if (area) {
        area.style.opacity = e.target.checked ? '1' : '0.4';
        area.style.pointerEvents = e.target.checked ? 'auto' : 'none';
      }
    });
  }

  // Cable inputs
  CABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`input-${f.key}`);
    if (input) input.addEventListener('input', e => state.set(`conditions.${f.key}`, parseFloat(e.target.value) || 0));
  });

  const matSelect = document.getElementById('select-cable-material');
  if (matSelect) matSelect.addEventListener('change', e => state.set('conditions.cableMaterial', e.target.value));

  // Accordion toggle
  document.querySelectorAll('details.details-panel').forEach(detail => {
    detail.addEventListener('toggle', () => {
      const icon = detail.querySelector('.details-icon');
      if (icon) icon.style.transform = detail.open ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  });
}
