/**
 * AppSolar — Tab: Dashboard / Gestión de Proyectos
 */

import { state } from '../state.js';
import { navigateTo } from '../router.js';

export function render() {
  const projects = state.getProjects();
  const currentId = state.get('currentProjectId');

  const listHtml = projects.map(p => {
    const isCurrent = p.id === currentId;
    const dateStr = new Date(p.modified).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    // Calculate some basic stats from project state
    const pmax = p.state?.panelSpecs?.pmax || 0;
    
    let totalPanels = 0;
    let estructuraText = '0 Paneles';
    
    if (p.state?.arrayConfig?.groups && p.state.arrayConfig.groups.length > 0) {
      totalPanels = p.state.arrayConfig.groups.reduce((acc, g) => acc + ((g.numStrings || 0) * (g.panelsPerString || 0)), 0);
      if (p.state.arrayConfig.groups.length === 1) {
        estructuraText = `${p.state.arrayConfig.groups[0].numStrings}x${p.state.arrayConfig.groups[0].panelsPerString} Paneles`;
      } else {
        estructuraText = `${totalPanels} Paneles (${p.state.arrayConfig.groups.length} Grupos)`;
      }
    } else {
      // Legacy fallback
      const numStrings = p.state?.arrayConfig?.numStrings || 0;
      const panelsPerString = p.state?.arrayConfig?.panelsPerString || 0;
      totalPanels = numStrings * panelsPerString;
      estructuraText = `${numStrings}x${panelsPerString} Paneles`;
    }

    const peakPower = ((pmax * totalPanels) / 1000).toFixed(2);
    const locName = p.state?.location?.locationName || 'Sin ubicación';

    return `
      <div class="card project-card ${isCurrent ? 'active-project-card' : ''}" data-id="${p.id}" style="position:relative; transition: transform 0.2s, box-shadow 0.2s; ${isCurrent ? 'border: 2px solid var(--solar-amber); box-shadow: var(--shadow-glow);' : ''}">
        ${isCurrent ? '<span class="badge badge-amber" style="position:absolute; top:12px; right:12px;">Activo</span>' : ''}
        <div style="font-size: 2.2rem; margin-bottom: var(--space-sm);">📂</div>
        <h3 class="project-name-display" style="margin-bottom: 4px; color: var(--text-primary); font-size: var(--text-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</h3>
        <p style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: var(--space-md);">Modificado: ${dateStr}</p>
        
        <div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: var(--space-lg); font-size: var(--text-xs); color: var(--text-secondary);">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Potencia Pico:</span>
            <strong class="mono" style="color: var(--solar-amber);">${peakPower} kWp</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Estructura:</span>
            <strong>${estructuraText}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Ubicación:</span>
            <span style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right;">${locName}</span>
          </div>
        </div>

        <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; margin-top: var(--space-md); padding-top: var(--space-sm); border-top: 1px solid var(--border-primary);">
          <button class="btn btn-primary btn-sm btn-load-proj" data-id="${p.id}" style="flex:1;">Abrir Proyecto</button>
          <div style="display:flex; gap:2px;">
            <button class="btn btn-ghost btn-rename-proj tooltip-trigger" data-id="${p.id}" data-tooltip="Renombrar" style="padding:4px 8px; border-radius:var(--radius-sm); font-size:1rem;">✏️</button>
            <button class="btn btn-ghost btn-duplicate-proj tooltip-trigger" data-id="${p.id}" data-tooltip="Duplicar" style="padding:4px 8px; border-radius:var(--radius-sm); font-size:1rem;">👥</button>
            <button class="btn btn-ghost btn-export-proj tooltip-trigger" data-id="${p.id}" data-tooltip="Exportar" style="padding:4px 8px; border-radius:var(--radius-sm); font-size:1rem;">💾</button>
            <button class="btn btn-ghost btn-delete-proj tooltip-trigger" data-id="${p.id}" data-tooltip="Eliminar" style="padding:4px 8px; border-radius:var(--radius-sm); font-size:1rem; color:var(--solar-red);">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div id="dashboard-root">
      <div class="page-title-bar">
        <div>
          <h2><span class="icon">🏠</span> Mis Proyectos Solar</h2>
          <p class="page-subtitle">Gestiona tus configuraciones y campos solares. Los proyectos se guardan localmente de forma automática.</p>
        </div>
        <div class="page-actions" style="display:flex; gap:var(--space-sm);">
          <button class="btn btn-secondary btn-sm" id="btn-import-sol">📂 Importar .sol</button>
          <button class="btn btn-primary btn-sm" id="btn-create-proj">➕ Nuevo Proyecto</button>
          <input type="file" id="import-sol-input" accept=".sol,.json" style="display:none">
        </div>
      </div>

      <!-- Drag & Drop Import Zone -->
      <div id="drop-zone-import" style="border: 2px dashed var(--border-primary); border-radius: var(--radius-lg); padding: var(--space-xl); text-align: center; background: var(--bg-card); transition: all var(--transition-fast); margin-bottom: var(--space-xl);">
        <div style="font-size: 2.5rem; margin-bottom: var(--space-sm);">📥</div>
        <h3 style="font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Arrastra un archivo de proyecto aquí</h3>
        <p style="font-size: var(--text-xs); color: var(--text-tertiary);">Soporta formatos .sol y .json exportados previamente</p>
      </div>

      <div class="grid-4" style="gap: var(--space-lg);">
        ${listHtml}
      </div>
    </div>
  `;
}

export function init() {
  const root = document.getElementById('dashboard-root');
  if (!root) return;

  // Event Delegation for all dashboard buttons
  root.addEventListener('click', (e) => {

    // Load project
    const btnLoad = e.target.closest('.btn-load-proj');
    if (btnLoad) {
      const id = btnLoad.dataset.id;
      state.loadProject(id);
      if (window.updateProjectHeader) window.updateProjectHeader();
      navigateTo('panel-manual');
      return;
    }

    // Rename project
    const btnRename = e.target.closest('.btn-rename-proj');
    if (btnRename) {
      e.stopPropagation();
      const id = btnRename.dataset.id;
      const projects = state.getProjects();
      const proj = projects.find(p => p.id === id);
      const name = prompt('Nuevo nombre del proyecto:', proj ? proj.name : '');
      if (name !== null) {
        const trimmed = name.trim();
        if (trimmed) {
          state.renameProject(id, trimmed);
          if (window.updateProjectHeader) window.updateProjectHeader();
          navigateTo('dashboard');
        }
      }
      return;
    }

    // Duplicate project
    const btnDuplicate = e.target.closest('.btn-duplicate-proj');
    if (btnDuplicate) {
      e.stopPropagation();
      const id = btnDuplicate.dataset.id;
      state.duplicateProject(id);
      navigateTo('dashboard');
      return;
    }

    // Delete project
    const btnDelete = e.target.closest('.btn-delete-proj');
    if (btnDelete) {
      e.stopPropagation();
      const id = btnDelete.dataset.id;
      const projects = state.getProjects();
      const proj = projects.find(p => p.id === id);
      if (confirm(`¿Estás seguro de que deseas eliminar el proyecto "${proj?.name || ''}"?`)) {
        state.deleteProject(id);
        navigateTo('dashboard');
      }
      return;
    }

    // Export project
    const btnExport = e.target.closest('.btn-export-proj');
    if (btnExport) {
      e.stopPropagation();
      const id = btnExport.dataset.id;
      
      const originalActiveId = state.get('currentProjectId');
      state.loadProject(id);
      const json = state.exportJSON();
      if (originalActiveId && originalActiveId !== id) {
        state.loadProject(originalActiveId);
      }
      
      const projects = state.getProjects();
      const proj = projects.find(p => p.id === id);
      const name = proj ? proj.name : 'proyecto';
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.sol`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Create project
    const btnCreate = e.target.closest('#btn-create-proj');
    if (btnCreate) {
      const name = prompt('Nombre del nuevo proyecto:');
      if (name !== null) {
        const trimmed = name.trim();
        state.createProject(trimmed || 'Proyecto Solar');
        if (window.updateProjectHeader) window.updateProjectHeader();
        navigateTo('panel-manual');
      }
      return;
    }

    // Import project btn
    const btnImport = e.target.closest('#btn-import-sol');
    if (btnImport) {
      document.getElementById('import-sol-input')?.click();
      return;
    }
  });

  // No window click listener needed for dropdowns anymore

  // Handle file input for import
  const importInput = document.getElementById('import-sol-input');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleImportFile(file);
      e.target.value = ''; // reset for next time
    });
  }

  // Drag and drop import zone
  const dropZone = document.getElementById('drop-zone-import');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--solar-amber)';
      dropZone.style.background = 'rgba(245, 158, 11, 0.05)';
    });

    ['dragleave', 'dragend'].forEach(evt => {
      dropZone.addEventListener(evt, () => {
        dropZone.style.borderColor = 'var(--border-primary)';
        dropZone.style.background = 'var(--bg-card)';
      });
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-primary)';
      dropZone.style.background = 'var(--bg-card)';
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImportFile(e.dataTransfer.files[0]);
      }
    });
  }
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const projId = state.importProject(ev.target.result, file.name);
    if (projId) {
      alert('Proyecto importado con éxito.');
      if (window.updateProjectHeader) window.updateProjectHeader();
      navigateTo('panel-manual');
    } else {
      alert('Error: El archivo no contiene un formato de proyecto válido.');
    }
  };
  reader.readAsText(file);
}
