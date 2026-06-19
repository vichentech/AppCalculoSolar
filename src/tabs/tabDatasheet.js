/**
 * AppSolar — Tab: Hoja de Datos (PDF Upload & AI Agent)
 */

import { state } from '../state.js';
import { navigateTo } from '../router.js';

export function render() {
  const savedWebhook = localStorage.getItem('appsolar-n8n-webhook') || '';

  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📄</span> Ficha Técnica del Panel</h2>
        <p class="page-subtitle">Sube el PDF técnico del panel solar. Opcionalmente puedes conectar tu servidor n8n con IA para extraer los datos.</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>📤 Cargar Ficha Técnica (PDF)</h3>
        </div>
        
        <div class="file-upload-zone" id="pdf-drop-zone" style="margin-bottom:var(--space-md);">
          <div class="upload-icon">📄</div>
          <div class="upload-text">
            Arrastra tu PDF aquí o <span class="upload-btn-text">haz clic para seleccionar</span>
          </div>
          <div class="upload-hint">Soporta formatos PDF oficiales (máx. 10 MB)</div>
          <input type="file" id="pdf-file-input" accept=".pdf" style="display:none">
        </div>

        <div class="form-group" style="margin-top:var(--space-md); margin-bottom:var(--space-md);">
          <label class="form-label">
            Webhook de n8n (Integración Agente IA)
            <span class="tooltip-trigger" data-tooltip="URL del webhook activo en tu n8n que recibe el PDF, lo procesa con un LLM y devuelve el JSON estructurado.">i</span>
          </label>
          <input class="form-input" type="url" id="input-n8n-webhook" value="${savedWebhook}" placeholder="https://tu-n8n.dominio.com/webhook/extraer-pdf" style="font-size:0.8rem; padding:6px 10px;">
        </div>

        <div id="pdf-status" class="mt-md" style="display:none">
          <div class="alert alert-success">
            <span>✅</span>
            <div>
              <strong id="pdf-filename"></strong>
              <div class="mt-sm" style="font-size: var(--text-xs)">Archivo cargado correctamente</div>
            </div>
          </div>
        </div>

        <div class="mt-lg">
          <div class="alert alert-info">
            <span>ℹ️</span>
            <div>
              <strong>Procesamiento con Agente de IA</strong>
              <div style="margin-top:4px; color: var(--text-secondary); font-size:var(--text-xs)">
                Si rellenas la URL del Webhook de n8n, el PDF se enviará mediante POST. Tu flujo de n8n puede leer el texto/imágenes con un modelo de IA (ej: Gemini) y retornar las variables estructuradas directamente para rellenar el formulario en un clic.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>⚡ Acceso Rápido</h3>
        </div>
        
        <p style="color: var(--text-secondary); margin-bottom: var(--space-lg); font-size: var(--text-sm);">
          Si no dispones del PDF o prefieres omitir este paso, puedes rellenar las especificaciones del panel solar de forma manual.
        </p>

        <button class="btn btn-primary btn-lg" id="btn-go-manual" style="width:100%">
          ⚡ Introducir Datos Manualmente
        </button>

        <div class="divider"></div>

        <h4 style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-sm);">💡 Datos típicos de referencia según tecnología</h4>
        
        <div class="data-table-wrapper" style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tecnología</th>
                <th>Eficiencia</th>
                <th>NOCT</th>
                <th>β(Voc)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Mono PERC</td>
                <td class="mono">20-22%</td>
                <td class="mono">43-45°C</td>
                <td class="mono">-0.27%/°C</td>
              </tr>
              <tr>
                <td>Mono TOPCon</td>
                <td class="mono">21-24%</td>
                <td class="mono">42-44°C</td>
                <td class="mono">-0.26%/°C</td>
              </tr>
              <tr>
                <td>HJT (Heterounión)</td>
                <td class="mono">22-25%</td>
                <td class="mono">41-43°C</td>
                <td class="mono">-0.24%/°C</td>
              </tr>
              <tr>
                <td>Policristalino</td>
                <td class="mono">17-19%</td>
                <td class="mono">45-47°C</td>
                <td class="mono">-0.30%/°C</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const dropZone = document.getElementById('pdf-drop-zone');
  const fileInput = document.getElementById('pdf-file-input');
  const btnManual = document.getElementById('btn-go-manual');
  const webhookInput = document.getElementById('input-n8n-webhook');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });
  }

  if (webhookInput) {
    webhookInput.addEventListener('input', (e) => {
      localStorage.setItem('appsolar-n8n-webhook', e.target.value.trim());
    });
  }

  if (btnManual) {
    btnManual.addEventListener('click', () => navigateTo('panel-specs'));
  }
}

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    alert('Por favor, selecciona un archivo PDF válido.');
    return;
  }

  const n8nUrl = document.getElementById('input-n8n-webhook')?.value.trim() || '';
  const statusDiv = document.getElementById('pdf-status');
  
  if (n8nUrl) {
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="alert alert-info">
          <span>⏳</span>
          <div>
            <strong>Enviando archivo a n8n...</strong>
            <div style="font-size:var(--text-xs)">El agente IA está leyendo el PDF y extrayendo los datos...</div>
          </div>
        </div>
      `;
      statusDiv.style.display = 'block';
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch(n8nUrl, {
      method: 'POST',
      body: formData
    })
    .then(res => {
      if (!res.ok) throw new Error(`El webhook de n8n devolvió un estado HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      // Import the extracted specs directly
      state.update('panelSpecs', {
        manufacturer: data.manufacturer || 'Desconocido',
        modelName: data.modelName || file.name.replace(/\.pdf$/i, ''),
        pmax: parseFloat(data.pmax) || 550,
        voc: parseFloat(data.voc) || 49.5,
        isc: parseFloat(data.isc) || 13.89,
        vmp: parseFloat(data.vmp) || 41.65,
        imp: parseFloat(data.imp) || 13.21,
        noct: parseFloat(data.noct) || 45,
        tempCoeffIsc: parseFloat(data.tempCoeffIsc) || 0.048,
        tempCoeffVoc: parseFloat(data.tempCoeffVoc) || -0.272,
        tempCoeffPmax: parseFloat(data.tempCoeffPmax) || -0.350,
        efficiency: parseFloat(data.efficiency) || 21.3,
        numCells: parseInt(data.numCells) || 144,
        length: parseFloat(data.length) || 2278,
        width: parseFloat(data.width) || 1134,
        weight: parseFloat(data.weight) || 28.6,
      });

      if (statusDiv) {
        statusDiv.innerHTML = `
          <div class="alert alert-success">
            <span>✅</span>
            <div>
              <strong>Agente IA completado con éxito</strong>
              <div style="font-size:var(--text-xs)">Datos extraídos correctamente. Redirigiendo a especificaciones...</div>
            </div>
          </div>
        `;
      }
      setTimeout(() => navigateTo('panel-specs'), 2000);
    })
    .catch(err => {
      console.error(err);
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div class="alert alert-danger">
            <span>❌</span>
            <div>
              <strong>Error en Agente IA de n8n</strong>
              <div style="font-size:var(--text-xs)">${err.message}. Redirigiendo a introducción manual...</div>
            </div>
          </div>
        `;
      }
      setTimeout(() => navigateTo('panel-specs'), 3000);
    });
  } else {
    // Normal simulator guide (no webhook)
    state.set('pdfUploaded', true);
    state.set('pdfFileName', file.name);
    
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="alert alert-success">
          <span>✅</span>
          <div>
            <strong>${file.name}</strong>
            <div style="font-size:var(--text-xs)">Archivo cargado. Redirigiendo a introducción manual...</div>
          </div>
        </div>
      `;
      statusDiv.style.display = 'block';
    }
    
    setTimeout(() => {
      navigateTo('panel-specs');
    }, 1500);
  }
}
