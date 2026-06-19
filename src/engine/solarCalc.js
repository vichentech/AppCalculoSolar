/**
 * AppSolar — Solar Calculations Engine
 * Core functions for PV system calculations
 */

import { state } from '../state.js';
import { calculateCellTemperature } from './thermalModel.js';
import { calculateVoltageDrop, calculateCablePowerLoss } from './cableLoss.js';
import { getSolarPosition, calculateTrackerAngles } from './solarPosition.js';

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
  
  const G = cond.irradiance;
  const totalPanels = array.numStrings * array.panelsPerString;
  const panelArea = (panel.length / 1000) * (panel.width / 1000); // m²

  // 1. Calculate active panel tilt and azimuth based on tracker type
  const now = new Date();
  const currentHour = cond.hourOfDay !== undefined ? cond.hourOfDay : 12;
  now.setHours(Math.floor(currentHour));
  now.setMinutes(Math.round((currentHour % 1) * 60));
  
  const sunPos = getSolarPosition(location.latitude, location.longitude, now);
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

  const activeTilt = tracker ? tracker.tilt : (array.tiltAngle || 30);
  const activeAzimuth = tracker ? tracker.azimuth : (array.azimuthAngle || 180);
  const trackerRotation = tracker ? tracker.rotation : 0;

  // 2. Cell Temperature
  const tCell = calculateCellTemperature(
    cellTempConfig.method,
    cond.ambientTemp,
    G,
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

  // 4. String calculations
  const voc_string = voc_adj * array.panelsPerString;
  const vmp_string = vmp_adj * array.panelsPerString;
  const isc_string = isc_adj; // Same current through series string
  const imp_string = imp_adj;
  const pmax_string = pmax_adj * array.panelsPerString;

  // 5. Array calculations (strings in parallel)
  const voc_array = voc_string; // Voltage same for parallel strings
  const vmp_array = vmp_string;
  const isc_array = isc_string * array.numStrings;
  const imp_array = imp_string * array.numStrings;
  const pmax_array = pmax_string * array.numStrings;

  // 6. Cable losses
  const cableLoss = calculateVoltageDrop(
    cond.cableLength,
    imp_array,
    cond.cableSection,
    cond.cableMaterial
  );
  
  const vmp_net = vmp_array - cableLoss.voltageDrop;
  const vdPercent = vmp_array > 0 ? (cableLoss.voltageDrop / vmp_array) * 100 : 0;
  
  const cablePowerLoss = calculateCablePowerLoss(
    cond.cableLength,
    imp_array,
    cond.cableSection,
    cond.cableMaterial
  );

  const pmax_net = pmax_array - cablePowerLoss;

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

    // String
    voc_string,
    vmp_string,
    isc_string,
    imp_string,
    pmax_string,

    // Array
    voc_array,
    vmp_array,
    isc_array,
    imp_array,
    pmax_array,
    totalPanels,

    // Cable
    voltageDrop: cableLoss.voltageDrop,
    vdPercent,
    cableResistance: cableLoss.totalResistance,
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
  };
}
