/**
 * AppSolar — I-V Curve Model
 * Single-diode model implementation for generating I-V and P-V curves
 */

import { BOLTZMANN, ELECTRON_CHARGE, G_STC, T_STC } from './solarCalc.js';

/**
 * Estimate the 5 parameters of the single-diode model from datasheet values
 * Uses a simplified extraction method suitable for engineering applications
 * 
 * @param {Object} params - Panel parameters
 * @param {number} params.voc - Open circuit voltage at STC (V)
 * @param {number} params.isc - Short circuit current at STC (A)
 * @param {number} params.vmp - MPP voltage at STC (V)
 * @param {number} params.imp - MPP current at STC (A)
 * @param {number} params.numCells - Number of cells in series
 * @param {number} [params.G] - Irradiance (W/m²)
 * @param {number} [params.tCell] - Cell temperature (°C)
 * @param {number} [params.tempCoeffIsc] - Temperature coefficient of Isc (%/°C)
 * @param {number} [params.tempCoeffVoc] - Temperature coefficient of Voc (%/°C)
 * @returns {Object} Model parameters { IL, I0, Rs, Rsh, n }
 */
export function extractModelParams(params) {
  const {
    voc, isc, vmp, imp, numCells,
    G = G_STC,
    tCell = T_STC,
    tempCoeffIsc = 0.048,
    tempCoeffVoc = -0.272
  } = params;

  const T = tCell + 273.15; // Convert to Kelvin
  const Vt = (BOLTZMANN * T) / ELECTRON_CHARGE; // Thermal voltage per cell
  const Ns = numCells;

  // Adjust for conditions
  const deltaT = tCell - T_STC;
  const Isc_adj = isc * (G / G_STC) * (1 + (tempCoeffIsc / 100) * deltaT);
  const Voc_adj = voc * (1 + (tempCoeffVoc / 100) * deltaT);
  const Vmp_adj = vmp * (1 + (tempCoeffVoc / 100) * deltaT);
  const Imp_adj = imp * (G / G_STC) * (1 + (tempCoeffIsc / 100) * deltaT);

  // Ideality factor (typical for crystalline silicon)
  const n = 1.2;
  const nVt = n * Ns * Vt;

  // Photocurrent ≈ Isc
  const IL = Isc_adj;

  // Reverse saturation current from Voc
  const I0 = Isc_adj / (Math.exp(Voc_adj / nVt) - 1);

  // Series resistance estimation
  const Rs_est = (Voc_adj - Vmp_adj + nVt * Math.log(1 - Imp_adj / Isc_adj)) / Imp_adj;
  const Rs = Math.max(0.001, Math.min(Rs_est, 2.0)); // Clamp to reasonable range

  // Shunt resistance estimation
  const Rsh_num = Vmp_adj + Imp_adj * Rs;
  const Rsh_den = Isc_adj - Imp_adj - I0 * (Math.exp((Vmp_adj + Imp_adj * Rs) / nVt) - 1);
  const Rsh = Rsh_den > 0.001 ? Math.min(Rsh_num / Rsh_den, 10000) : 5000;

  return { IL, I0, Rs: Math.abs(Rs), Rsh: Math.max(Rsh, 50), n, Ns, Vt };
}

/**
 * Solve for current I at a given voltage V using Newton-Raphson
 * Equation: I = IL - I0 * [exp(q(V + I*Rs)/(n*k*T)) - 1] - (V + I*Rs)/Rsh
 *
 * @param {number} V - Voltage (V)
 * @param {Object} model - Model parameters from extractModelParams
 * @returns {number} Current (A)
 */
export function solveCurrentAtVoltage(V, model) {
  const { IL, I0, Rs, Rsh, n, Ns, Vt } = model;
  const nVt = n * Ns * Vt;

  // Initial guess
  let I = IL - I0 * (Math.exp(V / nVt) - 1) - V / Rsh;
  I = Math.max(0, I);

  // Newton-Raphson iteration
  for (let iter = 0; iter < 50; iter++) {
    const expArg = (V + I * Rs) / nVt;
    
    // Limit exp argument to prevent overflow
    const safeExpArg = Math.min(expArg, 80);
    const expVal = Math.exp(safeExpArg);

    const fI = IL - I - I0 * (expVal - 1) - (V + I * Rs) / Rsh;
    const dfI = -1 - I0 * Rs / nVt * expVal - Rs / Rsh;

    const dI = fI / dfI;
    I -= dI;

    if (Math.abs(dI) < 1e-8) break;
    I = Math.max(0, I);
  }

  return Math.max(0, I);
}

/**
 * Generate I-V curve data points
 * 
 * @param {Object} panelParams - Panel datasheet parameters
 * @param {number} [numPoints=100] - Number of data points
 * @returns {Object} { voltages: [], currents: [], powers: [], mpp: {v, i, p} }
 */
export function generateIVCurve(panelParams, numPoints = 100) {
  const model = extractModelParams(panelParams);
  
  // Determine Voc for this condition (slightly overestimate)
  const nVt = model.n * model.Ns * model.Vt;
  const Voc_est = nVt * Math.log(model.IL / model.I0 + 1);
  const Vmax = Voc_est * 1.05;

  const voltages = [];
  const currents = [];
  const powers = [];
  let mpp = { v: 0, i: 0, p: 0 };

  for (let i = 0; i <= numPoints; i++) {
    const V = (i / numPoints) * Vmax;
    const I = solveCurrentAtVoltage(V, model);
    const P = V * I;

    voltages.push(V);
    currents.push(I);
    powers.push(P);

    if (P > mpp.p) {
      mpp = { v: V, i: I, p: P };
    }
  }

  return { voltages, currents, powers, mpp, voc: Vmax / 1.05 };
}

/**
 * Generate family of I-V curves for different irradiances
 * 
 * @param {Object} panelParams - Base panel parameters
 * @param {number[]} irradiances - Array of irradiance values to plot
 * @param {number} tCell - Cell temperature (°C)
 * @returns {Array} Array of curve data
 */
export function generateIVCurveFamily_Irradiance(panelParams, irradiances, tCell) {
  return irradiances.map(G => {
    const params = { ...panelParams, G, tCell };
    const curve = generateIVCurve(params);
    return {
      G,
      label: `${G} W/m²`,
      ...curve
    };
  });
}

/**
 * Generate family of I-V curves for different temperatures
 * 
 * @param {Object} panelParams - Base panel parameters
 * @param {number[]} temperatures - Array of cell temperatures (°C)
 * @param {number} G - Irradiance (W/m²)
 * @returns {Array} Array of curve data
 */
export function generateIVCurveFamily_Temperature(panelParams, temperatures, G) {
  return temperatures.map(tCell => {
    const params = { ...panelParams, G, tCell };
    const curve = generateIVCurve(params);
    return {
      tCell,
      label: `${tCell}°C`,
      ...curve
    };
  });
}
