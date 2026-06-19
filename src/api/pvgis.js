/**
 * AppSolar — PVGIS API Integration
 * European Commission's solar radiation database
 */

const BASE_URL = 'https://re.jrc.ec.europa.eu/api';

/**
 * Fetch monthly irradiance data from PVGIS
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} [angle] - Panel tilt angle (degrees). If omitted, PVGIS uses optimal.
 * @param {number} [aspect=0] - Panel azimuth (0=South, 90=West, -90=East)
 * @returns {Promise<Object>} Monthly data
 */
export async function fetchMonthlyData(lat, lon, angle, aspect = 0) {
  const params = new URLSearchParams({
    lat: lat.toFixed(4),
    lon: lon.toFixed(4),
    outputformat: 'json',
    raddatabase: 'PVGIS-SARAH2',
    horirrad: 1,
    optrad: angle === undefined ? 1 : 0,
    mr_dni: 1,
    d2g: 1,
    avtemp: 1,
  });

  if (angle !== undefined) {
    params.set('angle', angle);
    params.set('aspect', aspect);
    params.set('selectrad', 1);
  }

  try {
    const res = await fetch(`${BASE_URL}/MRcalc?${params}`);
    if (!res.ok) throw new Error(`PVGIS API error: ${res.status}`);
    
    const data = await res.json();
    
    const months = data.outputs?.monthly || [];
    
    return {
      location: data.inputs?.location || {},
      monthlyData: months.map(m => ({
        month: m.month,
        monthName: getMonthName(m.month),
        ghi: m['H(h)_m'] || 0,           // kWh/m²/month horizontal
        gi: m['H(i_opt)_m'] || m['H(i)_m'] || 0,  // kWh/m²/month inclined
        dni: m['Hb(n)_m'] || 0,           // Direct normal kWh/m²/month
        dhi: m['Hd(h)_m'] || m['Kd'] || 0, // Diffuse
        temperature: m['T2m'] || 0,        // Avg temperature °C
        irradiance: (m['H(i_opt)_m'] || m['H(i)_m'] || m['H(h)_m'] || 0), // Best available
      })),
      totals: {
        annualGHI: months.reduce((s, m) => s + (m['H(h)_m'] || 0), 0),
        annualGI: months.reduce((s, m) => s + (m['H(i_opt)_m'] || m['H(i)_m'] || 0), 0),
        avgTemp: months.reduce((s, m) => s + (m['T2m'] || 0), 0) / (months.length || 1),
      },
      optimalAngle: data.inputs?.mounting_system?.fixed?.slope?.value,
    };
  } catch (err) {
    console.warn('PVGIS fetch error (posiblemente CORS). Usando simulación solar matemática local:', err);
    return getSimulatedMonthlyData(lat, lon, angle, aspect);
  }
}

/**
 * Fetch PV power estimation from PVGIS
 */
export async function fetchPVEstimate(lat, lon, peakPower, angle, aspect = 0) {
  const params = new URLSearchParams({
    lat: lat.toFixed(4),
    lon: lon.toFixed(4),
    peakpower: peakPower,
    loss: 14,
    angle: angle || 35,
    aspect: aspect,
    outputformat: 'json',
    raddatabase: 'PVGIS-SARAH2',
  });

  try {
    const res = await fetch(`${BASE_URL}/PVcalc?${params}`);
    if (!res.ok) throw new Error(`PVGIS PVcalc error: ${res.status}`);
    
    const data = await res.json();
    return data.outputs;
  } catch (err) {
    console.error('PVGIS PVcalc error:', err);
    throw err;
  }
}

function getMonthName(num) {
  const names = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return names[num] || '';
}

function getSimulatedMonthlyData(lat, lon, angle, aspect = 0) {
  const tilt = angle === undefined ? Math.abs(lat) * 0.9 : angle;
  const months = [
    { num: 1, name: 'Enero', days: 31, jDay: 17 },
    { num: 2, name: 'Febrero', days: 28, jDay: 46 },
    { num: 3, name: 'Marzo', days: 31, jDay: 75 },
    { num: 4, name: 'Abril', days: 30, jDay: 105 },
    { num: 5, name: 'Mayo', days: 31, jDay: 135 },
    { num: 6, name: 'Junio', days: 30, jDay: 166 },
    { num: 7, name: 'Julio', days: 31, jDay: 196 },
    { num: 8, name: 'Agosto', days: 31, jDay: 227 },
    { num: 9, name: 'Septiembre', days: 30, jDay: 258 },
    { num: 10, name: 'Octubre', days: 31, jDay: 288 },
    { num: 11, name: 'Noviembre', days: 30, jDay: 319 },
    { num: 12, name: 'Diciembre', days: 31, jDay: 349 },
  ];

  const rad = d => d * Math.PI / 180;

  const latRad = rad(lat);
  const tiltRad = rad(tilt);
  const aspectRad = rad(aspect);

  const simulatedMonths = months.map(m => {
    // Declination
    const decl = 23.45 * Math.sin(2 * Math.PI * (m.jDay - 80) / 365);
    const declRad = rad(decl);

    // Sunrise hour angle
    let cosOmegaS = -Math.tan(latRad) * Math.tan(declRad);
    let omegaS = Math.acos(Math.max(-1, Math.min(1, cosOmegaS)));

    // Extraterrestrial daily radiation H0 (Wh/m²/day)
    const dFactor = 1 + 0.033 * Math.cos(2 * Math.PI * m.jDay / 365);
    const h0Val = (24 / Math.PI) * 1367 * dFactor * (
      Math.cos(latRad) * Math.cos(declRad) * Math.sin(omegaS) +
      omegaS * Math.sin(latRad) * Math.sin(declRad)
    );

    // Clearness index Kt
    const hemisphereSign = lat >= 0 ? 1 : -1;
    const seasonalFactor = Math.cos(2 * Math.PI * (m.jDay - 172 * hemisphereSign) / 365);
    const kt = 0.50 + 0.12 * seasonalFactor;

    // GHI in kWh/m²/month
    const ghiDay = (h0Val * kt) / 1000;
    const ghiMonth = ghiDay * m.days;

    // Diffuse fraction
    const kd = 1 - 1.13 * kt;
    const dhiMonth = ghiMonth * Math.max(0.15, Math.min(0.8, kd));
    const dniMonth = (ghiMonth - dhiMonth) / Math.sin(omegaS / 2 || 0.5);

    // Transposition to tilted surface
    let rFactor = 1.0;
    if (lat >= 0) {
      const phiMinusBeta = latRad - tiltRad;
      const cosOmegaS_t = -Math.tan(phiMinusBeta) * Math.tan(declRad);
      const omegaS_t = Math.acos(Math.max(-1, Math.min(1, cosOmegaS_t)));
      
      const numer = Math.cos(phiMinusBeta) * Math.cos(declRad) * Math.sin(omegaS_t) + omegaS_t * Math.sin(phiMinusBeta) * Math.sin(declRad);
      const denom = Math.cos(latRad) * Math.cos(declRad) * Math.sin(omegaS) + omegaS * Math.sin(latRad) * Math.sin(declRad);
      rFactor = denom > 0 ? numer / denom : 1.0;
    } else {
      const phiPlusBeta = latRad + tiltRad;
      const cosOmegaS_t = -Math.tan(phiPlusBeta) * Math.tan(declRad);
      const omegaS_t = Math.acos(Math.max(-1, Math.min(1, cosOmegaS_t)));
      
      const numer = Math.cos(phiPlusBeta) * Math.cos(declRad) * Math.sin(omegaS_t) + omegaS_t * Math.sin(phiPlusBeta) * Math.sin(declRad);
      const denom = Math.cos(latRad) * Math.cos(declRad) * Math.sin(omegaS) + omegaS * Math.sin(latRad) * Math.sin(declRad);
      rFactor = denom > 0 ? numer / denom : 1.0;
    }
    
    const aspectLoss = Math.cos(aspectRad);
    const giMonth = (ghiMonth - dhiMonth) * rFactor * Math.max(0.7, aspectLoss) + dhiMonth * (1 + Math.cos(tiltRad)) / 2 + ghiMonth * 0.2 * (1 - Math.cos(tiltRad)) / 2;

    // Temperature model
    const latAbs = Math.abs(lat);
    const tempEquator = 28 - (latAbs * 0.45);
    const tempSeasonal = 12 * Math.cos(2 * Math.PI * (m.jDay - 200 * hemisphereSign) / 365);
    const tempAltitude = - 0.0065 * 100;
    const avgTemp = tempEquator + tempSeasonal + tempAltitude;

    return {
      month: m.num,
      monthName: m.name,
      ghi: ghiMonth,
      gi: giMonth,
      dni: dniMonth,
      dhi: dhiMonth,
      temperature: avgTemp,
      irradiance: giMonth,
    };
  });

  return {
    location: { latitude: lat, longitude: lon, elevation: 100 },
    monthlyData: simulatedMonths,
    totals: {
      annualGHI: simulatedMonths.reduce((s, m) => s + m.ghi, 0),
      annualGI: simulatedMonths.reduce((s, m) => s + m.gi, 0),
      avgTemp: simulatedMonths.reduce((s, m) => s + m.temperature, 0) / 12,
    },
    optimalAngle: Math.abs(lat) * 0.85,
    isSimulated: true,
  };
}
