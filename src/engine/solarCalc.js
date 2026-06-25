/**
 * AppSolar — Solar Calculations Engine
 * Core functions for PV system calculations
 */

import { state } from '../state.js';
import { calculateCellTemperature } from './thermalModel.js';
import { calculateVoltageDrop, calculateCablePowerLoss } from './cableLoss.js';
import { getSolarPosition, calculateTrackerAngles, angleOfIncidence, getSunriseSunset } from './solarPosition.js';

// Physical constants
export const BOLTZMANN = 1.380649e-23;  // J/K
export const ELECTRON_CHARGE = 1.602176634e-19; // C
export const G_STC = 1000;  // W/m² Standard Test Conditions irradiance
export const T_STC = 25;    // °C Standard Test Conditions temperature

/**
 * Adjust Voc for temperature
 */
export function adjustVoc(voc_stc, tempCoeffVoc, tCell) {
  const deltaT = tCell - T_STC;
  return voc_stc * (1 + (tempCoeffVoc / 100) * deltaT);
}

/**
 * Adjust Vmp for temperature
 */
export function adjustVmp(vmp_stc, tempCoeffVoc, tCell) {
  const deltaT = tCell - T_STC;
  return vmp_stc * (1 + (tempCoeffVoc / 100) * deltaT);
}

/**
 * Adjust Isc for irradiance and temperature
 */
export function adjustIsc(isc_stc, tempCoeffIsc, tCell, G) {
  const deltaT = tCell - T_STC;
  return isc_stc * (G / G_STC) * (1 + (tempCoeffIsc / 100) * deltaT);
}

/**
 * Adjust Imp for irradiance and temperature
 */
export function adjustImp(imp_stc, tempCoeffIsc, tCell, G) {
  const deltaT = tCell - T_STC;
  return imp_stc * (G / G_STC) * (1 + (tempCoeffIsc / 100) * deltaT);
}

/**
 * Adjust Pmax for irradiance and temperature
 */
export function adjustPmax(pmax_stc, tempCoeffPmax, tCell, G) {
  const deltaT = tCell - T_STC;
  return pmax_stc * (G / G_STC) * (1 + (tempCoeffPmax / 100) * deltaT);
}

/**
 * Calculate Fill Factor
 */
export function calculateFillFactor(vmp, imp, voc, isc) {
  if (voc <= 0 || isc <= 0) return 0;
  return (vmp * imp) / (voc * isc);
}

/**
 * Calculate panel real efficiency
 * @param {number} pmax - Actual power (W)
 * @param {number} G - Irradiance (W/m²)
 * @param {number} area - Panel area (m²)
 */
export function calculatePanelEfficiency(pmax, G, area) {
  if (G <= 0 || area <= 0) return 0;
  return (pmax / (G * area)) * 100;
}

/**
 * Calculate thermal losses percentage
 */
export function calculateThermalLosses(tempCoeffPmax, tCell) {
  const deltaT = tCell - T_STC;
  return Math.abs(tempCoeffPmax) * deltaT;
}

/**
 * Run all calculations from current state
 * Returns complete results object
 */
export function calculateAll() {
  const panel = state.get('panelSpecs');
  const array = state.get('arrayConfig');
  const cond = state.get('conditions');
  const cellTempConfig = state.get('cellTemp');
  const location = state.get('location');
  
  const groups = array.groups || [{ id: 'g1', name: 'Grupo', numStrings: array.numStrings || 1, panelsPerString: array.panelsPerString || 1 }];
  const totalPanels = groups.reduce((acc, g) => acc + (g.numStrings * g.panelsPerString), 0);
  const panelArea = (panel.length / 1000) * (panel.width / 1000); // m²

  // 1. Calculate active panel tilt and azimuth based on tracker type
  const now = new Date();
  
  // Set date based on day of year
  const dayOfYear = cond.simDayOfYear || 172; 
  now.setMonth(0);
  now.setDate(dayOfYear);

  const currentHour = cond.hourOfDay !== undefined ? cond.hourOfDay : 12;
  now.setHours(Math.floor(currentHour));
  now.setMinutes(Math.round((currentHour % 1) * 60));
  
  const sunPos = getSolarPosition(location.latitude, location.longitude, now);
  const { sunrise, sunset } = getSunriseSunset(location.latitude, location.longitude, now);
  
  const tracker = calculateTrackerAngles(
    array.trackerType || 'fixed',
    sunPos.zenith,
    sunPos.azimuth,
    panel.width,
    array.rowSpacing,
    array.backtracking || false,
    array.backtrackingStartHour !== undefined ? array.backtrackingStartHour : 9.0,
    array.backtrackingEndHour !== undefined ? array.backtrackingEndHour : 17.0,
    array.backtrackingCorrection !== undefined ? array.backtrackingCorrection : 0.95,
    currentHour
  );

  const activeTilt = tracker ? tracker.tilt : (array.useOptimalTilt ? Math.max(0, Math.round(location.latitude * 0.87)) : (array.tiltAngle || 30));
  const activeAzimuth = tracker ? tracker.azimuth : (array.useOptimalTilt ? (location.latitude >= 0 ? 180 : 0) : (array.azimuthAngle || 180));
  const trackerRotation = tracker ? tracker.rotation : 0;

  // Modificador de irradiancia basado en la posición solar y AOI (Angle of Incidence)
  let G = 0;
  let tAmb = cond.ambientTemp; // max ambient temp
  const simMode = cond.simMode || 'dynamic';

  if (simMode === 'fixedMax') {
    G = cond.irradiance;
    tAmb = cond.ambientTemp;
  } else {
    if (sunPos.elevation > 0) {
      if (simMode === 'timeOnly') {
        const zenithAtNoon = getSolarPosition(location.latitude, location.longitude, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0)).zenith;
        const elevationFactor = Math.max(0, Math.cos(sunPos.zenith * Math.PI / 180)) / Math.max(0.01, Math.cos(zenithAtNoon * Math.PI / 180));
        G = cond.irradiance * Math.max(0, Math.min(1, elevationFactor));
      } else {
        // Irradiance curve simple model
        const aoi = angleOfIncidence(sunPos.zenith, sunPos.azimuth, activeTilt, activeAzimuth);
        const cosAoi = Math.max(0, Math.cos(aoi * Math.PI / 180));
        
        // Base envelope (atmosphere)
        const atmTransmittance = 0.7; // simplified
        const maxG_theoretical = 1367 * Math.pow(atmTransmittance, Math.pow(1 / Math.max(0.01, Math.cos(sunPos.zenith * Math.PI / 180)), 0.678));
        
        // Normalize user's max irradiance to the zenith of the day
        const zenithAtNoon = getSolarPosition(location.latitude, location.longitude, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0)).zenith;
        const peakG_theoretical = 1367 * Math.pow(atmTransmittance, Math.pow(1 / Math.max(0.01, Math.cos(zenithAtNoon * Math.PI / 180)), 0.678));
        
        const timeFactor = maxG_theoretical / peakG_theoretical; 
        
        // Final irradiance = UserMax * TimeFactor * Cos(AOI)
        G = cond.irradiance * Math.max(0, timeFactor) * cosAoi;

        // Apply tracker reality coefficient if tracker is used
        if (array.trackerType !== 'fixed') {
           G = G * (array.trackerCorrection || 1.0);
        }
      }
      
      // Simulate Temperature curve (peak is around 14:00 - 15:00)
      // Tmin is typically Tmax - 10
      const tMin = cond.ambientTemp - 10;
      const hourShifted = currentHour - 14.5;
      tAmb = tMin + (cond.ambientTemp - tMin) * Math.max(0, Math.cos(hourShifted * Math.PI / 12));
    }
  }

  // 2. Cell Temperature
  const tCell = calculateCellTemperature(
    cellTempConfig.method,
    tAmb, // use dynamic ambient temp
    G,    // use dynamic irradiance
    cond.windSpeed,
    panel.noct,
    cellTempConfig
  );

  // 3. Adjusted electrical parameters (per panel)
  const voc_adj = adjustVoc(panel.voc, panel.tempCoeffVoc, tCell);
  const vmp_adj = adjustVmp(panel.vmp, panel.tempCoeffVoc, tCell);
  const isc_adj = adjustIsc(panel.isc, panel.tempCoeffIsc, tCell, G);
  const imp_adj = adjustImp(panel.imp, panel.tempCoeffIsc, tCell, G);
  const pmax_adj = adjustPmax(panel.pmax, panel.tempCoeffPmax, tCell, G);

  // 4 & 5. String and Array calculations per Group
  const groupsData = groups.map(g => {
    const voc_string = voc_adj * g.panelsPerString;
    const vmp_string = vmp_adj * g.panelsPerString;
    const isc_string = isc_adj;
    const imp_string = imp_adj;
    const pmax_string = pmax_adj * g.panelsPerString;
    
    const voc_array = voc_string;
    const vmp_array = vmp_string;
    const isc_array = isc_string * g.numStrings;
    const imp_array = imp_string * g.numStrings;
    const pmax_array = pmax_string * g.numStrings;

    // STC / Máximos
    const voc_stc_array = panel.voc * g.panelsPerString;
    const isc_stc_array = panel.isc * g.numStrings;
    const pmax_stc_array = panel.pmax * g.panelsPerString * g.numStrings;

    // Cable Losses per Group
    let groupVoltageDrop = 0;
    let groupVdPercent = 0;
    let groupCablePowerLoss = 0;
    
    if (cond.cableLossEnabled !== false) {
      const cLength = g.cableLength !== undefined ? g.cableLength : (cond.cableLength || 50);
      const cSection = g.cableSection !== undefined ? g.cableSection : (cond.cableSection || 6);
      const cMat = g.cableMaterial !== undefined ? g.cableMaterial : (cond.cableMaterial || 'cu');
      
      const cableLoss = calculateVoltageDrop(cLength, imp_array, cSection, cMat);
      groupVoltageDrop = cableLoss.voltageDrop;
      groupVdPercent = vmp_array > 0 ? (groupVoltageDrop / vmp_array) * 100 : 0;
      groupCablePowerLoss = calculateCablePowerLoss(cLength, imp_array, cSection, cMat);
    }

    return {
      ...g,
      voc_string, vmp_string, isc_string, imp_string, pmax_string,
      voc_array, vmp_array, isc_array, imp_array, pmax_array,
      voc_stc_array, isc_stc_array, pmax_stc_array,
      groupVoltageDrop, groupVdPercent, groupCablePowerLoss
    };
  });

  // Global totals (Summing currents and powers. Voltages are independent per inverter)
  const imp_total_system = groupsData.reduce((acc, g) => acc + g.imp_array, 0);
  const pmax_total_system = groupsData.reduce((acc, g) => acc + g.pmax_array, 0);
  
  // Average voltage for global cable loss estimate (simplified)
  const vmp_avg_system = groupsData.length > 0 ? groupsData.reduce((acc, g) => acc + g.vmp_array, 0) / groupsData.length : 0;

  // 6. Global Cable losses aggregated
  const voltageDrop = groupsData.length > 0 ? groupsData.reduce((acc, g) => acc + g.groupVoltageDrop, 0) / groupsData.length : 0; // Avg
  const cablePowerLoss = groupsData.reduce((acc, g) => acc + g.groupCablePowerLoss, 0);
  const vdPercent = vmp_avg_system > 0 ? (voltageDrop / vmp_avg_system) * 100 : 0;
  const cableResistance = 0; // No longer globally aggregated

  const vmp_net = vmp_avg_system - voltageDrop;
  const pmax_net = pmax_total_system - cablePowerLoss;

  const voc_stc_total = groupsData.length > 0 ? groupsData[0].voc_stc_array : 0; // Aproximación (asumiendo voc de strings paralelos)
  const isc_stc_total = groupsData.reduce((acc, g) => acc + g.isc_stc_array, 0);

  // 7. Efficiency and performance metrics
  const fillFactor = calculateFillFactor(vmp_adj, imp_adj, voc_adj, isc_adj);
  const panelEffReal = calculatePanelEfficiency(pmax_adj, G, panelArea);
  const thermalLoss = calculateThermalLosses(panel.tempCoeffPmax, tCell);
  
  // STC total power
  const pmax_stc_total = panel.pmax * totalPanels;
  
  // Performance Ratio estimate (simplified)
  const pr_thermal = 1 + (panel.tempCoeffPmax / 100) * (tCell - T_STC);
  const pr_cable = 1 - (vdPercent / 100);
  const pr_mismatch = 0.98; // 2% mismatch losses
  const pr_soiling = 0.97;  // 3% soiling losses
  const pr_estimated = pr_thermal * pr_cable * pr_mismatch * pr_soiling;

  // Annual yield estimate
  const psh_default = 5.0; // Peak sun hours
  let annualPSH = psh_default * 365;
  
  if (location.monthlyData && location.monthlyData.length === 12) {
    annualPSH = location.monthlyData.reduce((sum, m) => sum + (m.irradiance || 0), 0);
  }
  
  // Factor in solar tracking yield gains
  let trackerGain = 1.0;
  if (array.trackerType === 'axis-ns') {
    trackerGain = 1.22; // 22% average annual increase (NS single-axis)
  } else if (array.trackerType === 'dual-axis') {
    trackerGain = 1.35; // 35% average annual increase (dual-axis)
  }

  const annualYield = (pmax_stc_total / 1000) * annualPSH * Math.max(0, pr_estimated) * trackerGain;

  return {
    // Cell Temperature
    tCell,

    // Panel (adjusted per panel)
    voc_adj,
    vmp_adj,
    isc_adj,
    imp_adj,
    pmax_adj,

    // Breakdowns
    groupsData,

    // Array / System totals
    totalPanels,
    imp_total_system,
    pmax_total_system,
    vmp_avg_system,
    isc_stc_total,
    voc_stc_total,

    // Cable
    voltageDrop,
    vdPercent,
    cableResistance,
    cablePowerLoss,
    vmp_net,
    pmax_net,

    // Performance
    fillFactor,
    panelEffReal,
    thermalLoss,
    pmax_stc_total,
    pr_thermal,
    pr_cable,
    pr_mismatch,
    pr_soiling,
    pr_estimated,
    annualYield,
    annualPSH,
    panelArea,

    // Tracker status
    activeTilt,
    activeAzimuth,
    trackerRotation,
    trackerType: array.trackerType || 'fixed',
    sunElevation: sunPos.elevation,
    sunAzimuth: sunPos.azimuth,
    
    // Realtime conditions applied
    G_actual: G,
    tAmb_actual: tAmb
  };
}
