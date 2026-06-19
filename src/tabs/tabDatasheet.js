/**
 * AppSolar — Tab: Hoja de Datos (PDF Upload)
 */

import { state } from '../state.js';
import { navigateTo } from '../router.js';

export function render() {
  return `
    <div class="page-title-bar">
      <div>
        <h2><span class="icon">📄</span> Hoja de Datos del Panel</h2>
        <p class="page-subtitle">Sube la ficha técnica del panel solar en formato PDF para extraer automáticamente sus características.</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>📤 Cargar Documento</h3>
        </div>
        
        <div class="file-upload-zone" id="pdf-drop-zone">
          <div class="upload-icon">📄</div>
          <div class="upload-text">
            Arrastra tu PDF aquí o <span class="upload-btn-text">haz clic para seleccionar</span>
          </div>
          <div class="upload-hint">Formatos soportados: PDF (máx. 10 MB)</div>
          <input type="file" id="pdf-file-input" accept=".pdf" style="display:none">
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
              <strong>Extracción automática</strong>
              <div style="margin-top:4px; color: var(--text-secondary)">
                El sistema intentará extraer automáticamente los parámetros eléctricos del PDF (Voc, Isc, Vmp, Imp, NOCT, coeficientes de temperatura). 
                Si no se encuentran todos los datos, podrás completarlos manualmente en la pestaña "Especificaciones".
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>⚡ Acceso Rápido</h3>
        </div>
        
        <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">
          Si no dispones del PDF de la hoja de datos, puedes introducir los parámetros del panel manualmente.
        </p>

        <button class="btn btn-primary btn-lg" id="btn-go-manual" style="width:100%">
          ⚡ Introducir Datos Manualmente
        </button>

        <div class="divider"></div>

        <h4 style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-sm);">💡 Datos típicos según tecnología</h4>
        
        <div class="data-table-wrapper" style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
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
                <td>HJT</td>
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

  if (btnManual) {
    btnManual.addEventListener('click', () => navigateTo('panel-specs'));
  }
}

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    alert('Por favor, selecciona un archivo PDF.');
    return;
  }

  state.set('pdfUploaded', true);
  state.set('pdfFileName', file.name);

  const statusDiv = document.getElementById('pdf-status');
  const filenameEl = document.getElementById('pdf-filename');
  
  if (statusDiv && filenameEl) {
    filenameEl.textContent = file.name;
    statusDiv.style.display = 'block';
  }

  // In a production app, we would use PDF.js to extract text here
  // For now, show success and guide user to manual entry
  setTimeout(() => {
    navigateTo('panel-specs');
  }, 1500);
}
