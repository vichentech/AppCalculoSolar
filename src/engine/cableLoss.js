/**
 * AppSolar — Cable Loss Calculations
 * DC voltage drop and power loss in PV string cables
 */

// Resistivity values at 20°C (Ω·mm²/m)
const RESISTIVITY = {
  cu: 0.01724,  // Copper
  al: 0.02826,  // Aluminum
};

// Temperature coefficient of resistance (1/°C)
const TEMP_COEFF = {
  cu: 0.00393,
  al: 0.00403,
};

/**
 * Calculate cable resistance
 * @param {number} length - One-way cable length (m)
 * @param {number} section - Cable cross-section (mm²)
 * @param {string} material - 'cu' or 'al'
 * @param {number} [temp=40] - Cable operating temperature (°C)
 * @returns {number} Total resistance (Ω) for round-trip
 */
export function calculateCableResistance(length, section, material = 'cu', temp = 40) {
  const rho = RESISTIVITY[material] || RESISTIVITY.cu;
  const alpha = TEMP_COEFF[material] || TEMP_COEFF.cu;
  
  // Resistance at operating temperature
  const rho_t = rho * (1 + alpha * (temp - 20));
  
  // Round-trip resistance (×2 for positive and negative conductors)
  return (2 * length * rho_t) / section;
}

/**
 * Calculate voltage drop in DC cables
 * VD = 2 × L × I × ρ / A
 * 
 * @param {number} length - One-way cable length (m)
 * @param {number} current - Operating current (A)
 * @param {number} section - Cable cross-section (mm²)
 * @param {string} material - 'cu' or 'al'
 * @returns {Object} { voltageDrop, totalResistance }
 */
export function calculateVoltageDrop(length, current, section, material = 'cu') {
  const totalResistance = calculateCableResistance(length, section, material);
  const voltageDrop = current * totalResistance;
  
  return {
    voltageDrop: Math.abs(voltageDrop),
    totalResistance,
  };
}

/**
 * Calculate voltage drop percentage
 * @param {number} voltageDrop - Voltage drop (V)
 * @param {number} systemVoltage - System operating voltage (V)
 * @returns {number} Percentage
 */
export function calculateVoltageDropPercent(voltageDrop, systemVoltage) {
  if (systemVoltage <= 0) return 0;
  return (voltageDrop / systemVoltage) * 100;
}

/**
 * Calculate power loss in cables (I²R)
 * @param {number} length - One-way cable length (m)
 * @param {number} current - Operating current (A)
 * @param {number} section - Cable cross-section (mm²)
 * @param {string} material - 'cu' or 'al'
 * @returns {number} Power loss (W)
 */
export function calculateCablePowerLoss(length, current, section, material = 'cu') {
  const R = calculateCableResistance(length, section, material);
  return current * current * R;
}

/**
 * Get voltage drop status (good / warning / danger)
 * @param {number} vdPercent - Voltage drop percentage
 * @returns {Object} { status, message, color }
 */
export function getVoltageDropStatus(vdPercent) {
  if (vdPercent <= 1) {
    return { status: 'ok', message: 'Excelente (≤1%)', color: 'green' };
  } else if (vdPercent <= 2) {
    return { status: 'ok', message: 'Aceptable (≤2%)', color: 'green' };
  } else if (vdPercent <= 3) {
    return { status: 'warning', message: 'Marginal (>2%)', color: 'amber' };
  } else {
    return { status: 'error', message: 'Excesivo (>3%)', color: 'red' };
  }
}

/**
 * Recommend cable section based on target voltage drop
 * @param {number} length - Cable length (m)
 * @param {number} current - Operating current (A)
 * @param {number} voltage - System voltage (V)
 * @param {number} targetVdPercent - Target max voltage drop (%)
 * @param {string} material - 'cu' or 'al'
 * @returns {number} Recommended section (mm²)
 */
export function recommendCableSection(length, current, voltage, targetVdPercent = 2, material = 'cu') {
  const rho = RESISTIVITY[material] || RESISTIVITY.cu;
  const targetVd = voltage * (targetVdPercent / 100);
  
  if (targetVd <= 0) return 240;
  
  const section = (2 * length * current * rho) / targetVd;
  
  // Standard cable sections
  const standardSections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  return standardSections.find(s => s >= section) || 240;
}
