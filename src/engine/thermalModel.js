/**
 * AppSolar — Thermal Models
 * Cell temperature calculation methods
 */

/**
 * Calculate cell temperature using selected method
 * @param {string} method - 'noct', 'faiman', 'sandia', 'manual'
 * @param {number} tAmb - Ambient temperature (°C)
 * @param {number} G - Irradiance (W/m²)
 * @param {number} windSpeed - Wind speed (m/s)
 * @param {number} noct - NOCT from datasheet (°C)
 * @param {Object} config - Additional config parameters
 * @returns {number} Cell temperature (°C)
 */
export function calculateCellTemperature(method, tAmb, G, windSpeed, noct, config = {}) {
  switch (method) {
    case 'noct':
      return noctModel(tAmb, G, noct);
    case 'faiman':
      return faimanModel(tAmb, G, windSpeed, config.faimanU0 || 25, config.faimanU1 || 6.84);
    case 'sandia':
      return sandiaModel(tAmb, G, windSpeed, config.sandiaA || -3.56, config.sandiaB || -0.075, config.sandiaDeltaT || 3);
    case 'manual':
      return config.manualTemp || 45;
    default:
      return noctModel(tAmb, G, noct);
  }
}

/**
 * NOCT Standard Model
 * T_cell = T_amb + ((NOCT - 20) / 800) × G
 */
export function noctModel(tAmb, G, noct) {
  return tAmb + ((noct - 20) / 800) * G;
}

/**
 * Faiman Model (with wind correction)
 * T_cell = T_amb + G / (U0 + U1 × v_wind)
 * Default: U0 = 25 W/(m²·K), U1 = 6.84 W·s/(m³·K)
 */
export function faimanModel(tAmb, G, windSpeed, U0 = 25, U1 = 6.84) {
  const denominator = U0 + U1 * windSpeed;
  if (denominator <= 0) return tAmb;
  return tAmb + G / denominator;
}

/**
 * Sandia Model
 * T_module = G × exp(a + b × v_wind) + T_amb
 * T_cell = T_module + (G / G_STC) × ΔT
 * Default: a = -3.56, b = -0.075, ΔT = 3°C (glass/cell/glass)
 */
export function sandiaModel(tAmb, G, windSpeed, a = -3.56, b = -0.075, deltaT = 3) {
  const tModule = G * Math.exp(a + b * windSpeed) + tAmb;
  const tCell = tModule + (G / 1000) * deltaT;
  return tCell;
}

/**
 * Calculate cell temperature for a range of irradiances (for charts)
 * @param {string} method
 * @param {number} tAmb
 * @param {number[]} irradiances
 * @param {number} windSpeed
 * @param {number} noct
 * @param {Object} config
 * @returns {number[]}
 */
export function calculateTempVsIrradiance(method, tAmb, irradiances, windSpeed, noct, config = {}) {
  return irradiances.map(G => calculateCellTemperature(method, tAmb, G, windSpeed, noct, config));
}

/**
 * Calculate cell temperature for all three models (for comparison table)
 */
export function compareAllModels(tAmb, G, windSpeed, noct, config = {}) {
  return {
    noct: noctModel(tAmb, G, noct),
    faiman: faimanModel(tAmb, G, windSpeed, config.faimanU0 || 25, config.faimanU1 || 6.84),
    sandia: sandiaModel(tAmb, G, windSpeed, config.sandiaA || -3.56, config.sandiaB || -0.075, config.sandiaDeltaT || 3),
  };
}
