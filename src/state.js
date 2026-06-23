/**
 * AppSolar — Global State Manager
 * Reactive state management with subscriber pattern
 */

const defaultPanelSpecs = {
  pmax: 550,
  voc: 49.5,
  isc: 13.89,
  vmp: 41.65,
  imp: 13.21,
  noct: 45,
  tempCoeffIsc: 0.048,    // %/°C (alpha)
  tempCoeffVoc: -0.272,   // %/°C (beta)
  tempCoeffPmax: -0.350,  // %/°C (gamma)
  efficiency: 21.3,
  numCells: 144,
  cellType: 'monocrystalline',
  length: 2278,           // mm
  width: 1134,            // mm
  thickness: 35,          // mm
  weight: 28.6,           // kg
  tolerance: 3,           // %
  modelName: 'Panel Solar 550Wp (Ejemplo)',
  manufacturer: 'Genérico'
};

const defaultArrayConfig = {
  groups: [
    { id: 'g1', name: 'Grupo 1', numStrings: 4, panelsPerString: 12 }
  ],
  panelOrientation: 'portrait',
  rowsPerStructure: 1,
  rowSpacing: 6,          // m
  useOptimalTilt: false,
  tiltAngle: 30,          // degrees
  azimuthAngle: 180,      // degrees (180 = south)
  trackerType: 'fixed',   // fixed, axis-ns, dual-axis
  trackerCorrection: 1.0, // reality vs theory coefficient
  backtracking: false,
  backtrackingStartHour: 9.0,
  backtrackingEndHour: 17.0,
  backtrackingCorrection: 0.95,
};

const defaultConditions = {
  irradiance: 1000,       // W/m² (Max at solar noon)
  ambientTemp: 25,        // °C (Max at solar noon)
  windSpeed: 1,           // m/s
  humidity: 50,           // %
  albedo: 0.2,
  cableLossEnabled: true,
  cableLength: 50,        // m
  cableSection: 6,        // mm²
  cableMaterial: 'cu',    // cu or al
  hourOfDay: 12,          // decimal hours (12 = noon)
  simDayOfYear: 172,      // Default: Summer solstice ~June 21
};

const defaultLocation = {
  latitude: 40.4168,      // Madrid default
  longitude: -3.7038,
  altitude: 650,
  locationName: 'Madrid, España',
  apiDataLoaded: false,
  monthlyData: null,
  hourlyData: null,
};

const defaultCellTemp = {
  method: 'noct',         // noct, faiman, sandia, manual
  manualTemp: 45,
  faimanU0: 25,
  faimanU1: 6.84,
  sandiaDeltaT: 3,
  sandiaA: -3.56,
  sandiaB: -0.075,
};

const initialState = {
  panelSpecs: { ...defaultPanelSpecs },
  arrayConfig: { ...defaultArrayConfig },
  conditions: { ...defaultConditions },
  location: { ...defaultLocation },
  cellTemp: { ...defaultCellTemp },
  pdfUploaded: false,
  pdfFileName: '',
  savedScenarios: [],
  activeTab: 'dashboard',
  theme: localStorage.getItem('appsolar-theme') || 'dark',
};

// Deep clone helper
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class StateManager {
  constructor() {
    this.state = deepClone(initialState);
    this.state.currentProjectId = null;
    this.subscribers = new Map();
    this.globalSubscribers = [];
    this.initProjects();
  }

  initProjects() {
    if (typeof localStorage !== 'undefined') {
      const projects = this.getProjects();
      if (projects.length === 0) {
        this.createProject('Proyecto por Defecto');
      } else {
        const lastActive = localStorage.getItem('appsolar-last-active-project');
        const activeId = lastActive && projects.some(p => p.id === lastActive) ? lastActive : projects[0].id;
        this.loadProject(activeId);
      }
    }
  }

  // Get list of all saved projects
  getProjects() {
    try {
      const stored = localStorage.getItem('appsolar-projects');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading projects list:', e);
      return [];
    }
  }

  // Save projects list to localStorage
  _saveProjectsList(projects) {
    localStorage.setItem('appsolar-projects', JSON.stringify(projects));
  }

  // Create new project
  createProject(name) {
    const projects = this.getProjects();
    const id = 'proj_' + Date.now();
    const newProj = {
      id,
      name: name || 'Proyecto Sin Nombre',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      state: {
        panelSpecs: deepClone(defaultPanelSpecs),
        arrayConfig: deepClone(defaultArrayConfig),
        conditions: deepClone(defaultConditions),
        location: deepClone(defaultLocation),
        cellTemp: deepClone(defaultCellTemp),
      }
    };
    projects.push(newProj);
    this._saveProjectsList(projects);
    this.loadProject(id);
    return id;
  }

  // Load a project into active state
  loadProject(id) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === id);
    if (!proj) return false;

    this.state.currentProjectId = id;
    this.state.panelSpecs = deepClone(proj.state.panelSpecs || defaultPanelSpecs);
    this.state.arrayConfig = deepClone(proj.state.arrayConfig || defaultArrayConfig);
    this.state.conditions = deepClone(proj.state.conditions || defaultConditions);
    this.state.location = deepClone(proj.state.location || defaultLocation);
    this.state.cellTemp = deepClone(proj.state.cellTemp || defaultCellTemp);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('appsolar-last-active-project', id);
    }

    // Notify changes
    this._notify('panelSpecs');
    this._notify('arrayConfig');
    this._notify('conditions');
    this._notify('location');
    this._notify('cellTemp');
    this._notifyGlobal('project_loaded', id);
    return true;
  }

  // Auto-save active project state
  saveCurrentProject() {
    const id = this.state.currentProjectId;
    if (!id) return;

    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return;

    projects[idx].modified = new Date().toISOString();
    projects[idx].state = {
      panelSpecs: deepClone(this.state.panelSpecs),
      arrayConfig: deepClone(this.state.arrayConfig),
      conditions: deepClone(this.state.conditions),
      location: {
        latitude: this.state.location.latitude,
        longitude: this.state.location.longitude,
        altitude: this.state.location.altitude,
        locationName: this.state.location.locationName,
      },
      cellTemp: deepClone(this.state.cellTemp),
    };
    this._saveProjectsList(projects);
  }

  // Duplicate project
  duplicateProject(id) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === id);
    if (!proj) return null;

    const newId = 'proj_' + Date.now();
    const newProj = {
      id: newId,
      name: `${proj.name} (Copia)`,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      state: deepClone(proj.state)
    };
    projects.push(newProj);
    this._saveProjectsList(projects);
    return newId;
  }

  // Rename project
  renameProject(id, newName) {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return false;

    projects[idx].name = newName;
    projects[idx].modified = new Date().toISOString();
    this._saveProjectsList(projects);
    
    this._notifyGlobal('project_renamed', newName);
    return true;
  }

  // Delete project
  deleteProject(id) {
    const projects = this.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    this._saveProjectsList(filtered);

    if (this.state.currentProjectId === id) {
      this.state.currentProjectId = null;
      if (filtered.length > 0) {
        this.loadProject(filtered[0].id);
      } else {
        this.createProject('Proyecto por Defecto');
      }
    }
    return true;
  }

  // Import a project from JSON string (supports .sol / .json)
  importProject(jsonStr, fileName = '') {
    try {
      const data = JSON.parse(jsonStr);
      const projects = this.getProjects();
      const id = 'proj_' + Date.now();
      
      const name = data.name || fileName.replace(/\.sol$/, '').replace(/\.json$/, '') || 'Proyecto Importado';
      const projState = data.state || {
        panelSpecs: data.panelSpecs || defaultPanelSpecs,
        arrayConfig: data.arrayConfig || defaultArrayConfig,
        conditions: data.conditions || defaultConditions,
        location: data.location || defaultLocation,
        cellTemp: data.cellTemp || defaultCellTemp,
      };

      // Retrocompatibility for old arrayConfig format
      if (projState.arrayConfig && !projState.arrayConfig.groups) {
        projState.arrayConfig.groups = [
          {
            id: 'g1',
            name: 'Grupo 1',
            numStrings: projState.arrayConfig.numStrings || 4,
            panelsPerString: projState.arrayConfig.panelsPerString || 12
          }
        ];
        projState.arrayConfig.panelOrientation = projState.arrayConfig.panelOrientation || 'portrait';
        projState.arrayConfig.rowsPerStructure = projState.arrayConfig.rowsPerStructure || 1;
      }

      const newProj = {
        id,
        name,
        created: data.created || new Date().toISOString(),
        modified: new Date().toISOString(),
        state: projState
      };
      
      projects.push(newProj);
      this._saveProjectsList(projects);
      this.loadProject(id);
      return id;
    } catch (e) {
      console.error('Error importing project:', e);
      return null;
    }
  }

  /**
   * Get current state or a specific path
   */
  get(path) {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Update state at a specific path
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this.state);
    
    if (target[lastKey] === value) return;
    
    target[lastKey] = value;
    
    const rootKey = keys.length > 0 ? keys[0] : lastKey;
    this._notify(rootKey);
    this._notify(path);
    this._notifyGlobal(path, value);
    this.saveCurrentProject();
  }

  /**
   * Update multiple properties in a section
   */
  update(section, updates) {
    Object.assign(this.state[section], updates);
    this._notify(section);
    this._notifyGlobal(section, updates);
    this.saveCurrentProject();
  }

  /**
   * Subscribe to changes on a specific state path
   */
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, []);
    }
    this.subscribers.get(path).push(callback);
    
    return () => {
      const subs = this.subscribers.get(path);
      const idx = subs.indexOf(callback);
      if (idx > -1) subs.splice(idx, 1);
    };
  }

  /**
   * Subscribe to all state changes
   */
  onAny(callback) {
    this.globalSubscribers.push(callback);
    return () => {
      const idx = this.globalSubscribers.indexOf(callback);
      if (idx > -1) this.globalSubscribers.splice(idx, 1);
    };
  }

  _notify(path) {
    const subs = this.subscribers.get(path);
    if (subs) {
      const value = this.get(path);
      subs.forEach(cb => cb(value));
    }
  }

  _notifyGlobal(path, value) {
    this.globalSubscribers.forEach(cb => cb(path, value));
  }

  /**
   * Reset a section to defaults
   */
  reset(section) {
    const defaults = {
      panelSpecs: defaultPanelSpecs,
      arrayConfig: defaultArrayConfig,
      conditions: defaultConditions,
      location: defaultLocation,
      cellTemp: defaultCellTemp,
    };
    if (defaults[section]) {
      this.state[section] = deepClone(defaults[section]);
      this._notify(section);
      this._notifyGlobal(section, this.state[section]);
      this.saveCurrentProject();
    }
  }

  /**
   * Export full state as JSON (.sol extension layout)
   */
  exportJSON() {
    const projects = this.getProjects();
    const current = projects.find(p => p.id === this.state.currentProjectId);
    
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      name: current ? current.name : 'Proyecto Solar',
      state: {
        panelSpecs: this.state.panelSpecs,
        arrayConfig: this.state.arrayConfig,
        conditions: this.state.conditions,
        location: {
          latitude: this.state.location.latitude,
          longitude: this.state.location.longitude,
          altitude: this.state.location.altitude,
          locationName: this.state.location.locationName,
        },
        cellTemp: this.state.cellTemp,
      }
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import state from JSON
   */
  importJSON(json) {
    try {
      const data = JSON.parse(json);
      const projState = data.state || data; // backward compatibility
      if (projState.panelSpecs) this.update('panelSpecs', projState.panelSpecs);
      if (projState.arrayConfig) this.update('arrayConfig', projState.arrayConfig);
      if (projState.conditions) this.update('conditions', projState.conditions);
      if (projState.location) this.update('location', projState.location);
      if (projState.cellTemp) this.update('cellTemp', projState.cellTemp);
      return true;
    } catch (e) {
      console.error('Error importing state:', e);
      return false;
    }
  }
}

// Singleton
export const state = new StateManager();
export { defaultPanelSpecs, defaultArrayConfig, defaultConditions, defaultLocation, defaultCellTemp };
