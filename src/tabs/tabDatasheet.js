/**
 * VichenSolarApp — Tab: Hoja de Datos (PDF Upload & AI Agent)
 * Flujo en 3 pasos: Subir PDF → Elegir Modelo → Confirmar y Aplicar
 */

import { state } from '../state.js';
import { navigateTo } from '../router.js';
import { extractModels, extractSpecs, getN8nBaseUrl } from '../api/n8nDatasheet.js';

// ─── Claves de localStorage ────────────────────────────────────────────────
const LS_WEBHOOK = 'vichensolar-n8n-webhook';

// ─── Estado interno del tab ────────────────────────────────────────────────
let _currentStep = 1;      // 1 = upload, 2 = select model, 3 = confirm specs
let _extractedData = null; // { manufacturer, models, rawText }
let _selectedSpecs = null; // Resultado de extractSpecs
let _currentFile = null;   // File object del PDF

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

export function render() {
  const savedWebhook = localStorage.getItem(LS_WEBHOOK) || '';

  return `
    <!-- PAGE HEADER -->
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📄</span> Ficha Técnica del Panel</h2>
        <p class="page-subtitle">Sube el PDF del fabricante y el Agente IA extraerá automáticamente todos los parámetros del panel solar.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-ds-manual">✏️ Datos Manuales</button>
      </div>
    </div>

    <!-- STEPPER -->
    <div class="ds-stepper" id="ds-stepper">
      <div class="ds-step active" id="step-ind-1">
        <div class="ds-step-circle">1</div>
        <div class="ds-step-label">Subir PDF</div>
      </div>
      <div class="ds-step-line" id="step-line-1"></div>
      <div class="ds-step" id="step-ind-2">
        <div class="ds-step-circle">2</div>
        <div class="ds-step-label">Elegir Modelo</div>
      </div>
      <div class="ds-step-line" id="step-line-2"></div>
      <div class="ds-step" id="step-ind-3">
        <div class="ds-step-circle">3</div>
        <div class="ds-step-label">Confirmar Datos</div>
      </div>
    </div>

    <!-- STEP PANELS -->
    <div id="ds-content">

      <!-- ── STEP 1: Upload PDF ──────────────────────────────────────────── -->
      <div id="ds-step-1" class="ds-panel">
        <div class="grid-2" style="gap: var(--space-xl); align-items: start;">

          <!-- Upload card -->
          <div class="card" style="border: 1px solid var(--border-primary);">
            <div class="card-header">
              <h3>📤 Selecciona la Ficha Técnica</h3>
            </div>

            <div class="file-upload-zone" id="pdf-drop-zone">
              <div class="upload-icon" id="upload-icon-display">📄</div>
              <div class="upload-text" id="upload-text-display">
                Arrastra el PDF aquí o <span class="upload-btn-text">haz clic para seleccionar</span>
              </div>
              <div class="upload-hint">PDF oficial del fabricante (máx. 20 MB). Puede contener múltiples modelos.</div>
              <input type="file" id="pdf-file-input" accept=".pdf" style="display:none">
            </div>

            <div id="pdf-selected-info" style="display:none; margin-top: var(--space-md);">
              <div class="alert alert-success" style="margin-bottom: var(--space-md);">
                <span>📄</span>
                <div>
                  <strong id="pdf-file-name"></strong>
                  <div style="font-size: var(--text-xs); color: var(--text-secondary);" id="pdf-file-size"></div>
                </div>
              </div>
            </div>

            <!-- Webhook config -->
            <div class="form-group" style="margin-top: var(--space-lg);">
              <label class="form-label">
                URL del Webhook N8N
                <span class="tooltip-trigger" data-tooltip="Endpoint de tu servicio N8N. Si está en local con Docker Compose, usa http://localhost:5678. El campo es opcional si usas la URL por defecto configurada en el servidor.">i</span>
              </label>
              <input class="form-input" type="url" id="input-n8n-webhook"
                value="${savedWebhook}"
                placeholder="http://localhost:5678  (usa la URL por defecto si está vacío)"
                style="font-size:0.8rem; padding: 6px 10px;">
              <div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 4px;">
                URL por defecto configurada: <code style="color: var(--solar-amber);">${getN8nBaseUrl()}/webhook/datasheet/...</code>
              </div>
            </div>

            <button class="btn btn-primary btn-lg" id="btn-analyze-pdf"
              style="width:100%; margin-top: var(--space-lg);" disabled>
              🤖 Analizar PDF con IA
            </button>

            <div id="ds-step1-status" style="display:none; margin-top: var(--space-md);"></div>
          </div>

          <!-- Info card -->
          <div class="card" style="border: 1px solid var(--border-primary);">
            <div class="card-header">
              <h3>💡 ¿Cómo funciona?</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
              <div class="ds-info-step">
                <div class="ds-info-number">1</div>
                <div>
                  <strong>Sube el PDF del fabricante</strong>
                  <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px;">La ficha puede contener varios modelos en distintas páginas.</p>
                </div>
              </div>
              <div class="ds-info-step">
                <div class="ds-info-number">2</div>
                <div>
                  <strong>La IA detecta los modelos disponibles</strong>
                  <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px;">Gemini analiza el PDF y lista todas las variantes del panel.</p>
                </div>
              </div>
              <div class="ds-info-step">
                <div class="ds-info-number">3</div>
                <div>
                  <strong>Elige el modelo que te interesa</strong>
                  <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px;">Se extraen automáticamente Voc, Isc, NOCT, coeficientes de temperatura y más.</p>
                </div>
              </div>
              <div class="ds-info-step">
                <div class="ds-info-number">4</div>
                <div>
                  <strong>Los datos se pre-rellenan en el formulario</strong>
                  <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px;">Revisa y confirma antes de aplicar. Puedes editarlo después.</p>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <div class="alert alert-info" style="margin-bottom: 0;">
              <span>🔒</span>
              <div style="font-size: var(--text-xs);">
                <strong>Privacidad</strong>: El PDF se envía directamente a tu instancia de N8N. No pasa por ningún servidor externo de VichenSolarApp.
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── STEP 2: Select Model ────────────────────────────────────────── -->
      <div id="ds-step-2" class="ds-panel" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>🔍 Modelos detectados en la ficha técnica</h3>
              <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 4px;">
                Fabricante: <strong id="ds-manufacturer-name" style="color: var(--solar-amber);"></strong>
                &nbsp;·&nbsp; Haz clic en el modelo que quieres cargar
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-back-to-upload">← Volver</button>
          </div>

          <div id="ds-models-grid" class="grid-4" style="gap: var(--space-md); margin-top: var(--space-lg);">
            <!-- Populated dynamically -->
          </div>

          <div id="ds-step2-status" style="display:none; margin-top: var(--space-md);"></div>
        </div>
      </div>

      <!-- ── STEP 3: Confirm Specs ───────────────────────────────────────── -->
      <div id="ds-step-3" class="ds-panel" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>✅ Parámetros extraídos</h3>
              <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 4px;">
                Revisa los datos antes de aplicarlos al formulario. Podrás editarlos después en Especificaciones del Panel.
              </p>
            </div>
            <div style="display: flex; gap: var(--space-sm);">
              <button class="btn btn-secondary btn-sm" id="btn-back-to-models">← Modelos</button>
              <button class="btn btn-primary btn-sm" id="btn-apply-specs">⚡ Aplicar al Formulario</button>
            </div>
          </div>

          <div class="grid-2" style="gap: var(--space-xl); margin-top: var(--space-lg);">

            <!-- Specs preview table -->
            <div>
              <h4 style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-md); color: var(--solar-amber);">
                📊 Parámetros eléctricos (STC)
              </h4>
              <table class="data-table" id="ds-specs-table-elec">
                <tbody></tbody>
              </table>
            </div>

            <div>
              <h4 style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-md); color: var(--solar-amber);">
                🌡️ Parámetros térmicos y mecánicos
              </h4>
              <table class="data-table" id="ds-specs-table-thermal">
                <tbody></tbody>
              </table>
            </div>

          </div>

          <div id="ds-specs-warnings" style="margin-top: var(--space-lg);"></div>

        </div>
      </div>

    </div><!-- /#ds-content -->

    <!-- STYLES INLINE (scoped to datasheet tab) -->
    <style>
      /* ── Stepper ── */
      .ds-stepper {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-xl);
        padding: var(--space-lg) 0;
        gap: 0;
      }
      .ds-step {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 80px;
      }
      .ds-step-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--bg-tertiary);
        border: 2px solid var(--border-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--text-tertiary);
        transition: all var(--transition-normal);
      }
      .ds-step-label {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        white-space: nowrap;
        transition: color var(--transition-normal);
      }
      .ds-step.active .ds-step-circle {
        background: var(--solar-amber);
        border-color: var(--solar-amber);
        color: #000;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
      }
      .ds-step.active .ds-step-label { color: var(--solar-amber); font-weight: 600; }
      .ds-step.done .ds-step-circle {
        background: var(--solar-green);
        border-color: var(--solar-green);
        color: #000;
      }
      .ds-step.done .ds-step-label { color: var(--solar-green); }
      .ds-step-line {
        flex: 1;
        height: 2px;
        background: var(--border-primary);
        margin-bottom: 20px;
        min-width: 60px;
        transition: background var(--transition-normal);
      }
      .ds-step-line.done { background: var(--solar-green); }

      /* ── Info steps ── */
      .ds-info-step {
        display: flex;
        align-items: flex-start;
        gap: var(--space-md);
      }
      .ds-info-number {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.4);
        color: var(--solar-amber);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-sm);
        font-weight: 700;
        flex-shrink: 0;
      }

      /* ── Model cards ── */
      .ds-model-card {
        background: var(--bg-card);
        border: 2px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .ds-model-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: var(--solar-amber);
        opacity: 0;
        transition: opacity var(--transition-fast);
      }
      .ds-model-card:hover {
        border-color: var(--solar-amber);
        transform: translateY(-3px);
        box-shadow: var(--shadow-glow);
      }
      .ds-model-card:hover::before { opacity: 1; }
      .ds-model-card:active { transform: translateY(-1px); }
      .ds-model-pmax {
        font-size: var(--text-2xl);
        font-weight: 800;
        color: var(--solar-amber);
        font-family: var(--font-mono);
        margin-bottom: 4px;
      }
      .ds-model-name {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        word-break: break-all;
        margin-bottom: var(--space-sm);
      }
      .ds-model-desc {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        line-height: 1.4;
      }
      .ds-model-select-btn {
        margin-top: var(--space-md);
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: var(--solar-amber);
        border-radius: var(--radius-md);
        padding: 4px 12px;
        font-size: var(--text-xs);
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .ds-model-select-btn:hover {
        background: var(--solar-amber);
        color: #000;
      }

      /* ── Specs null warning ── */
      .ds-null-badge {
        display: inline-block;
        background: rgba(239, 68, 68, 0.15);
        color: var(--solar-red);
        border-radius: var(--radius-sm);
        padding: 1px 6px;
        font-size: 10px;
        font-weight: 600;
      }
    </style>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — Event listeners
// ─────────────────────────────────────────────────────────────────────────────

export function init() {
  // Reset state on tab open
  _currentStep = 1;
  _extractedData = null;
  _selectedSpecs = null;
  _currentFile = null;
  updateStepper(1);

  // ── File input / drop zone ────────────────────────────────────────────────
  const dropZone = document.getElementById('pdf-drop-zone');
  const fileInput = document.getElementById('pdf-file-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) onFileSelected(f);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) onFileSelected(fileInput.files[0]);
    });
  }

  // ── Webhook URL — persistencia ────────────────────────────────────────────
  document.getElementById('input-n8n-webhook')?.addEventListener('input', (e) => {
    localStorage.setItem(LS_WEBHOOK, e.target.value.trim());
  });

  // ── Botón: Analizar con IA ────────────────────────────────────────────────
  document.getElementById('btn-analyze-pdf')?.addEventListener('click', () => {
    if (_currentFile) runExtractModels(_currentFile);
  });

  // ── Botón: Manual ────────────────────────────────────────────────────────
  document.getElementById('btn-ds-manual')?.addEventListener('click', () => {
    navigateTo('panel-manual');
  });

  // ── Botón: Volver al upload ───────────────────────────────────────────────
  document.getElementById('btn-back-to-upload')?.addEventListener('click', () => {
    goToStep(1);
  });

  // ── Botón: Volver a modelos ───────────────────────────────────────────────
  document.getElementById('btn-back-to-models')?.addEventListener('click', () => {
    goToStep(2);
  });

  // ── Botón: Aplicar specs al formulario ───────────────────────────────────
  document.getElementById('btn-apply-specs')?.addEventListener('click', () => {
    if (_selectedSpecs) applySpecs(_selectedSpecs);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

function onFileSelected(file) {
  if (file.type !== 'application/pdf') {
    showStatus('ds-step1-status', 'error', '❌ El archivo debe ser un PDF.');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showStatus('ds-step1-status', 'error', '❌ El archivo supera el límite de 20 MB.');
    return;
  }

  _currentFile = file;

  // Actualizar UI de drop zone
  document.getElementById('upload-icon-display').textContent = '✅';
  document.getElementById('upload-text-display').innerHTML =
    `<strong style="color: var(--solar-green);">${file.name}</strong>`;

  const infoDiv = document.getElementById('pdf-selected-info');
  if (infoDiv) {
    document.getElementById('pdf-file-name').textContent = file.name;
    document.getElementById('pdf-file-size').textContent =
      `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    infoDiv.style.display = 'block';
  }

  document.getElementById('btn-analyze-pdf').removeAttribute('disabled');
  clearStatus('ds-step1-status');
}

async function runExtractModels(file) {
  const btn = document.getElementById('btn-analyze-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ Analizando PDF...';

  showStatus('ds-step1-status', 'loading',
    '🤖 El Agente IA está leyendo la ficha técnica... Esto puede tardar 15-30 segundos.');

  try {
    const customUrl = getCustomWebhookBase();
    const result = await extractModels(file, customUrl);

    _extractedData = result;

    if (!result.models || result.models.length === 0) {
      showStatus('ds-step1-status', 'warning',
        '⚠️ La IA no detectó modelos en el PDF. Comprueba que el PDF contiene una ficha técnica estándar.');
      btn.disabled = false;
      btn.textContent = '🤖 Analizar PDF con IA';
      return;
    }

    // Ir al paso 2
    renderModelsGrid(result);
    goToStep(2);

  } catch (err) {
    console.error('[VichenSolar] Error extracting models:', err);
    showStatus('ds-step1-status', 'error',
      `❌ Error al conectar con N8N: ${err.message}. Comprueba que el servicio N8N está en marcha y la URL es correcta.`);
  }

  btn.disabled = false;
  btn.textContent = '🤖 Analizar PDF con IA';
}

function renderModelsGrid(data) {
  const manEl = document.getElementById('ds-manufacturer-name');
  if (manEl) manEl.textContent = data.manufacturer || 'Desconocido';

  const grid = document.getElementById('ds-models-grid');
  if (!grid) return;

  grid.innerHTML = data.models.map((m, idx) => `
    <div class="ds-model-card" data-idx="${idx}" id="model-card-${idx}">
      <div style="font-size: 1.6rem; margin-bottom: var(--space-sm);">☀️</div>
      <div class="ds-model-pmax">${m.pmax ? m.pmax + ' Wp' : '—'}</div>
      <div class="ds-model-name">${escapeHtml(m.modelName)}</div>
      ${m.shortDesc ? `<div class="ds-model-desc">${escapeHtml(m.shortDesc)}</div>` : ''}
      <button class="ds-model-select-btn" data-idx="${idx}">Seleccionar →</button>
    </div>
  `).join('');

  // Event listeners en las tarjetas
  grid.querySelectorAll('.ds-model-select-btn, .ds-model-card').forEach(el => {
    el.addEventListener('click', (e) => {
      const card = e.target.closest('.ds-model-card');
      if (!card) return;
      const idx = parseInt(card.dataset.idx, 10);
      const model = data.models[idx];
      if (model) onModelSelected(model);
    });
  });
}

async function onModelSelected(model) {
  showStatus('ds-step2-status', 'loading',
    `🤖 Extrayendo parámetros técnicos de <strong>${escapeHtml(model.modelName)}</strong>...`);

  // Deshabilitar tarjetas mientras carga
  document.querySelectorAll('.ds-model-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.style.opacity = '0.6';
  });

  try {
    const customUrl = getCustomWebhookBase();
    const specs = await extractSpecs(
      model.modelName,
      _extractedData?.rawText || '',
      customUrl
    );

    _selectedSpecs = specs;
    renderSpecsPreview(specs);
    goToStep(3);

  } catch (err) {
    console.error('[VichenSolar] Error extracting specs:', err);
    showStatus('ds-step2-status', 'error',
      `❌ Error al extraer las especificaciones: ${err.message}`);
  }

  document.querySelectorAll('.ds-model-card').forEach(c => {
    c.style.pointerEvents = '';
    c.style.opacity = '';
  });
}

function renderSpecsPreview(specs) {
  // Tabla eléctrica
  const elecRows = [
    ['Fabricante', specs.manufacturer],
    ['Modelo', specs.modelName],
    ['Tipo de celda', specs.cellType],
    ['Pmax (STC)', specs.pmax != null ? `${specs.pmax} Wp` : null],
    ['Voc', specs.voc != null ? `${specs.voc} V` : null],
    ['Isc', specs.isc != null ? `${specs.isc} A` : null],
    ['Vmp', specs.vmp != null ? `${specs.vmp} V` : null],
    ['Imp', specs.imp != null ? `${specs.imp} A` : null],
    ['Eficiencia', specs.efficiency != null ? `${specs.efficiency} %` : null],
    ['Tolerancia', specs.tolerance != null ? `±${specs.tolerance} %` : null],
  ];

  const thermalRows = [
    ['NOCT', specs.noct != null ? `${specs.noct} °C` : null],
    ['Coef. α (Isc)', specs.tempCoeffIsc != null ? `${specs.tempCoeffIsc} %/°C` : null],
    ['Coef. β (Voc)', specs.tempCoeffVoc != null ? `${specs.tempCoeffVoc} %/°C` : null],
    ['Coef. γ (Pmax)', specs.tempCoeffPmax != null ? `${specs.tempCoeffPmax} %/°C` : null],
    ['Nº células', specs.numCells],
    ['Largo', specs.length != null ? `${specs.length} mm` : null],
    ['Ancho', specs.width != null ? `${specs.width} mm` : null],
    ['Grosor', specs.thickness != null ? `${specs.thickness} mm` : null],
    ['Peso', specs.weight != null ? `${specs.weight} kg` : null],
  ];

  fillSpecsTable('ds-specs-table-elec', elecRows);
  fillSpecsTable('ds-specs-table-thermal', thermalRows);

  // Avisos de valores nulos
  const nullFields = [...elecRows, ...thermalRows]
    .filter(([, v]) => v == null)
    .map(([k]) => k);

  const warningsEl = document.getElementById('ds-specs-warnings');
  if (warningsEl && nullFields.length > 0) {
    warningsEl.innerHTML = `
      <div class="alert alert-warning">
        <span>⚠️</span>
        <div>
          <strong>Parámetros no encontrados</strong>
          <div style="font-size: var(--text-xs); margin-top: 4px;">
            La IA no pudo extraer estos valores: <em>${nullFields.join(', ')}</em>.
            Podrás introducirlos manualmente en el formulario de Especificaciones.
          </div>
        </div>
      </div>
    `;
  } else if (warningsEl) {
    warningsEl.innerHTML = `
      <div class="alert alert-success">
        <span>✅</span>
        <div><strong>Extracción completa</strong> — Todos los parámetros fueron encontrados correctamente.</div>
      </div>
    `;
  }
}

function fillSpecsTable(tableId, rows) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = rows.map(([label, value]) => `
    <tr>
      <td>${label}</td>
      <td class="mono" style="${value == null ? 'color: var(--text-tertiary);' : ''}">
        ${value != null ? escapeHtml(String(value)) : '<span class="ds-null-badge">No detectado</span>'}
      </td>
    </tr>
  `).join('');
}

function applySpecs(specs) {
  const updates = {};

  if (specs.manufacturer)    updates.manufacturer    = specs.manufacturer;
  if (specs.modelName)       updates.modelName       = specs.modelName;
  if (specs.cellType)        updates.cellType        = specs.cellType;
  if (specs.pmax != null)    updates.pmax            = specs.pmax;
  if (specs.voc != null)     updates.voc             = specs.voc;
  if (specs.isc != null)     updates.isc             = specs.isc;
  if (specs.vmp != null)     updates.vmp             = specs.vmp;
  if (specs.imp != null)     updates.imp             = specs.imp;
  if (specs.noct != null)    updates.noct            = specs.noct;
  if (specs.tempCoeffIsc != null)   updates.tempCoeffIsc   = specs.tempCoeffIsc;
  if (specs.tempCoeffVoc != null)   updates.tempCoeffVoc   = specs.tempCoeffVoc;
  if (specs.tempCoeffPmax != null)  updates.tempCoeffPmax  = specs.tempCoeffPmax;
  if (specs.efficiency != null)     updates.efficiency     = specs.efficiency;
  if (specs.numCells != null)       updates.numCells       = specs.numCells;
  if (specs.length != null)         updates.length         = specs.length;
  if (specs.width != null)          updates.width          = specs.width;
  if (specs.thickness != null)      updates.thickness      = specs.thickness;
  if (specs.weight != null)         updates.weight         = specs.weight;
  if (specs.tolerance != null)      updates.tolerance      = specs.tolerance;

  state.update('panelSpecs', updates);

  // Feedback visual y redirección
  const btn = document.getElementById('btn-apply-specs');
  if (btn) {
    btn.textContent = '✅ ¡Aplicado!';
    btn.style.background = 'var(--solar-green)';
    btn.disabled = true;
  }

  setTimeout(() => navigateTo('panel-manual'), 1200);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEPPER & NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function goToStep(step) {
  _currentStep = step;

  // Show/hide panels
  [1, 2, 3].forEach(n => {
    const panel = document.getElementById(`ds-step-${n}`);
    if (panel) panel.style.display = n === step ? 'block' : 'none';
  });

  updateStepper(step);
}

function updateStepper(currentStep) {
  [1, 2, 3].forEach(n => {
    const ind = document.getElementById(`step-ind-${n}`);
    if (!ind) return;
    ind.className = 'ds-step';
    if (n < currentStep) ind.classList.add('done');
    else if (n === currentStep) ind.classList.add('active');
  });

  [1, 2].forEach(n => {
    const line = document.getElementById(`step-line-${n}`);
    if (!line) return;
    line.className = 'ds-step-line';
    if (n < currentStep) line.classList.add('done');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getCustomWebhookBase() {
  const raw = localStorage.getItem(LS_WEBHOOK) || '';
  if (!raw) return null; // usa la URL por defecto del módulo API
  // Quitar /webhook/... final si se pegó la URL completa
  return raw.replace(/\/webhook\/.*$/, '').replace(/\/$/, '');
}

function showStatus(containerId, type, html) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const icons = { error: '❌', warning: '⚠️', loading: '⏳', success: '✅' };
  const alertClass = type === 'loading' ? 'alert-info' :
                     type === 'error'   ? 'alert-danger' :
                     type === 'warning' ? 'alert-warning' :
                     'alert-success';

  el.innerHTML = `
    <div class="alert ${alertClass}">
      <span>${icons[type] || 'ℹ️'}</span>
      <div style="font-size: var(--text-xs);">${html}</div>
    </div>
  `;
  el.style.display = 'block';
}

function clearStatus(containerId) {
  const el = document.getElementById(containerId);
  if (el) { el.innerHTML = ''; el.style.display = 'none'; }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
