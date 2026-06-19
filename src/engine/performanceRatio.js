/**
 * AppSolar — Performance Ratio & System Losses
 */

/**
 * Calculate Performance Ratio components
 * @param {Object} params
 * @returns {Object} Detailed PR breakdown
 */
export function calculatePerformanceRatio(params) {
  const {
    tempCoeffPmax = -0.35, // %/°C
    tCell = 45,
    vdPercent = 1.5,
    mismatchLoss = 2,    // %
    soilingLoss = 3,      // %
    shadingLoss = 0,      // %
    inverterEff = 97,     // %
    degradation = 0,      // %
    otherLosses = 1,      // %
  } = params;

  const losses = {
    thermal: Math.abs(tempCoeffPmax) * (tCell - 25),
    cable: vdPercent,
    mismatch: mismatchLoss,
    soiling: soilingLoss,
    shading: shadingLoss,
    inverter: 100 - inverterEff,
    degradation,
    other: otherLosses,
  };

  // Each loss factor
  const factors = {
    thermal: 1 - losses.thermal / 100,
    cable: 1 - losses.cable / 100,
    mismatch: 1 - losses.mismatch / 100,
    soiling: 1 - losses.soiling / 100,
    shading: 1 - losses.shading / 100,
    inverter: inverterEff / 100,
    degradation: 1 - losses.degradation / 100,
    other: 1 - losses.other / 100,
  };

  // Overall PR
  const pr = Object.values(factors).reduce((acc, f) => acc * Math.max(0, f), 1);

  return {
    losses,
    factors,
    pr,
    prPercent: pr * 100,
  };
}

/**
 * Calculate estimated annual energy yield
 * @param {number} peakPowerKw - System peak power (kWp)
 * @param {number} annualPSH - Annual Peak Sun Hours (kWh/m²/year)
 * @param {number} pr - Performance Ratio (0-1)
 * @returns {Object} { annualKwh, monthlyAvgKwh, dailyAvgKwh, specificYield }
 */
export function calculateAnnualYield(peakPowerKw, annualPSH, pr) {
  const annualKwh = peakPowerKw * annualPSH * pr;
  return {
    annualKwh,
    monthlyAvgKwh: annualKwh / 12,
    dailyAvgKwh: annualKwh / 365,
    specificYield: annualPSH * pr, // kWh/kWp
  };
}

/**
 * Generate waterfall chart data for loss breakdown
 * @param {Object} prData - Result from calculatePerformanceRatio()
 * @param {number} nominalPower - Nominal power (W)
 * @returns {Array} Array of { label, value, cumulative, type }
 */
export function generateLossWaterfall(prData, nominalPower) {
  const { losses } = prData;
  let cumulative = nominalPower;
  
  const items = [
    { label: 'Potencia Nominal', value: nominalPower, cumulative, type: 'start' },
  ];

  const lossEntries = [
    { key: 'thermal', label: 'Pérdidas Térmicas' },
    { key: 'cable', label: 'Pérdidas en Cable' },
    { key: 'mismatch', label: 'Mismatch' },
    { key: 'soiling', label: 'Suciedad' },
    { key: 'shading', label: 'Sombras' },
    { key: 'inverter', label: 'Inversor' },
    { key: 'degradation', label: 'Degradación' },
    { key: 'other', label: 'Otras Pérdidas' },
  ];

  lossEntries.forEach(({ key, label }) => {
    const lossPercent = losses[key] || 0;
    if (lossPercent > 0) {
      const lossValue = nominalPower * (lossPercent / 100);
      cumulative -= lossValue;
      items.push({
        label,
        value: -lossValue,
        percent: lossPercent,
        cumulative: Math.max(0, cumulative),
        type: 'loss',
      });
    }
  });

  items.push({
    label: 'Potencia Real',
    value: Math.max(0, cumulative),
    cumulative: Math.max(0, cumulative),
    type: 'end',
  });

  return items;
}
