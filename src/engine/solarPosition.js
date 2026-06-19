/**
 * AppSolar — Solar Position Algorithms
 * Calculate sun position (elevation, azimuth) for any location and time
 */

/**
 * Calculate day of year from a Date object
 * @param {Date} date 
 * @returns {number} Day of year (1-365/366)
 */
export function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Solar Declination (δ)
 * δ ≈ 23.45° × sin(360/365 × (J - 81))
 * @param {number} J - Day of year
 * @returns {number} Declination in degrees
 */
export function solarDeclination(J) {
  return 23.45 * Math.sin(toRad((360 / 365) * (J - 81)));
}

/**
 * Equation of Time (minutes)
 * Accounts for the eccentricity of Earth's orbit and axial tilt
 * @param {number} J - Day of year
 * @returns {number} Minutes
 */
export function equationOfTime(J) {
  const B = toRad((360 / 365) * (J - 81));
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * Local Solar Time
 * @param {number} localHour - Local standard time (decimal hours, e.g., 13.5 = 1:30 PM)
 * @param {number} longitude - Longitude (degrees, E positive)
 * @param {number} timeZoneOffset - UTC offset (hours, e.g., +1 for CET)
 * @param {number} J - Day of year
 * @returns {number} Solar time in decimal hours
 */
export function localSolarTime(localHour, longitude, timeZoneOffset, J) {
  const eot = equationOfTime(J);
  const lstMeridian = 15 * timeZoneOffset;
  const correction = 4 * (longitude - lstMeridian) + eot;
  return localHour + correction / 60;
}

/**
 * Solar Hour Angle (ω)
 * ω = (LST - 12) × 15°
 * @param {number} solarTime - Local solar time (decimal hours)
 * @returns {number} Hour angle in degrees
 */
export function hourAngle(solarTime) {
  return (solarTime - 12) * 15;
}

/**
 * Solar Zenith Angle
 * cos(θz) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(ω)
 * @param {number} latitude - Latitude (degrees)
 * @param {number} declination - Solar declination (degrees)
 * @param {number} hAngle - Hour angle (degrees)
 * @returns {number} Zenith angle in degrees
 */
export function solarZenith(latitude, declination, hAngle) {
  const phi = toRad(latitude);
  const delta = toRad(declination);
  const omega = toRad(hAngle);

  const cosZenith = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
  return toDeg(Math.acos(Math.max(-1, Math.min(1, cosZenith))));
}

/**
 * Solar Elevation Angle (altitude)
 * α = 90° - θz
 * @param {number} zenith - Zenith angle (degrees)
 * @returns {number} Elevation in degrees
 */
export function solarElevation(zenith) {
  return 90 - zenith;
}

/**
 * Solar Azimuth Angle (measured clockwise from North)
 * @param {number} latitude - Latitude (degrees)
 * @param {number} declination - Solar declination (degrees)
 * @param {number} hAngle - Hour angle (degrees)
 * @param {number} zenith - Zenith angle (degrees)
 * @returns {number} Azimuth in degrees (0-360, 0=North, 90=East, 180=South)
 */
export function solarAzimuth(latitude, declination, hAngle, zenith) {
  const phi = toRad(latitude);
  const delta = toRad(declination);
  const theta_z = toRad(zenith);

  if (Math.abs(Math.sin(theta_z)) < 0.001) return 180; // Sun at zenith

  let cosAz = (Math.sin(delta) - Math.sin(phi) * Math.cos(theta_z)) / (Math.cos(phi) * Math.sin(theta_z));
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let azimuth = toDeg(Math.acos(cosAz));

  if (hAngle > 0) {
    azimuth = 360 - azimuth;
  }

  return azimuth;
}

/**
 * Calculate complete solar position for a given date, time, and location
 * @param {number} latitude - degrees
 * @param {number} longitude - degrees
 * @param {Date} datetime - Date and time
 * @returns {Object} { elevation, azimuth, zenith, declination, hourAngle }
 */
export function getSolarPosition(latitude, longitude, datetime) {
  const J = dayOfYear(datetime);
  const decl = solarDeclination(J);
  const timeZoneOffset = -datetime.getTimezoneOffset() / 60;
  const localHour = datetime.getHours() + datetime.getMinutes() / 60;
  const solarTime = localSolarTime(localHour, longitude, timeZoneOffset, J);
  const hAngle = hourAngle(solarTime);
  const zenith = solarZenith(latitude, decl, hAngle);
  const elevation = solarElevation(zenith);
  const azimuth = solarAzimuth(latitude, decl, hAngle, zenith);

  return {
    elevation: Math.max(0, elevation),
    azimuth,
    zenith,
    declination: decl,
    hourAngle: hAngle,
    solarTime,
  };
}

/**
 * Generate sun path data for an entire day
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {Date} date - Any date (time will be iterated)
 * @param {number} [stepMinutes=15] - Time step in minutes
 * @returns {Array} Array of { hour, elevation, azimuth }
 */
export function generateSunPath(latitude, longitude, date, stepMinutes = 15) {
  const path = [];
  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const dt = new Date(baseDate.getTime() + minutes * 60000);
    const pos = getSolarPosition(latitude, longitude, dt);
    
    if (pos.elevation > 0) {
      path.push({
        hour: minutes / 60,
        elevation: pos.elevation,
        azimuth: pos.azimuth,
        timeLabel: `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`,
      });
    }
  }

  return path;
}

/**
 * Calculate sunrise and sunset times
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {Date} date 
 * @returns {Object} { sunrise, sunset, daylightHours }
 */
export function getSunriseSunset(latitude, longitude, date) {
  const J = dayOfYear(date);
  const decl = solarDeclination(J);
  const phi = toRad(latitude);
  const delta = toRad(decl);

  const cosOmega = -Math.tan(phi) * Math.tan(delta);
  
  if (cosOmega > 1) return { sunrise: null, sunset: null, daylightHours: 0 }; // No sunrise
  if (cosOmega < -1) return { sunrise: null, sunset: null, daylightHours: 24 }; // Midnight sun

  const omega = toDeg(Math.acos(cosOmega));
  const daylightHours = (2 * omega) / 15;
  
  const solarNoon = 12; // Approximate
  const sunrise = solarNoon - daylightHours / 2;
  const sunset = solarNoon + daylightHours / 2;

  return { sunrise, sunset, daylightHours };
}

/**
 * Calculate angle of incidence on a tilted surface
 * @param {number} solarZenithAngle - degrees
 * @param {number} solarAzimuthAngle - degrees (from North)
 * @param {number} tilt - Surface tilt from horizontal (degrees)
 * @param {number} surfaceAzimuth - Surface azimuth (degrees from North, 180=South)
 * @returns {number} Angle of incidence in degrees
 */
export function angleOfIncidence(solarZenithAngle, solarAzimuthAngle, tilt, surfaceAzimuth) {
  const theta_z = toRad(solarZenithAngle);
  const gamma_s = toRad(solarAzimuthAngle);
  const beta = toRad(tilt);
  const gamma = toRad(surfaceAzimuth);

  const cosAOI = Math.cos(theta_z) * Math.cos(beta) +
    Math.sin(theta_z) * Math.sin(beta) * Math.cos(gamma_s - gamma);

  return toDeg(Math.acos(Math.max(-1, Math.min(1, cosAOI))));
}

/**
 * Calculate tracker tilt and azimuth angles
 */
export function calculateTrackerAngles(trackerType, zenith, azimuth, panelWidth, rowSpacing, backtracking, startHour, endHour, correction, currentHour) {
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;

  if (trackerType === 'axis-ns') {
    const zRad = rad(zenith);
    const aRad = rad(azimuth);
    
    let R_ideal = Math.atan2(Math.sin(zRad) * Math.sin(aRad - Math.PI), Math.cos(zRad));
    let R_ideal_deg = deg(R_ideal);
    
    R_ideal_deg = Math.max(-60, Math.min(60, R_ideal_deg));
    
    let R_final = R_ideal_deg;
    
    if (backtracking && rowSpacing > 0 && panelWidth > 0) {
      const isBacktrackingHour = currentHour <= startHour || currentHour >= endHour;
      if (isBacktrackingHour) {
        const gcr = (panelWidth / 1000) / rowSpacing;
        const cosR = Math.cos(rad(R_ideal_deg));
        if (cosR < gcr) {
          const term = cosR / gcr;
          if (term >= -1 && term <= 1) {
            const correctionAngle = deg(Math.acos(term)) * correction;
            R_final = R_ideal_deg - Math.sign(R_ideal_deg) * correctionAngle;
            R_final = Math.max(-60, Math.min(60, R_final));
          }
        }
      }
    }
    
    const panelTilt = Math.abs(R_final);
    const panelAzimuth = R_final >= 0 ? 270 : 90;
    
    return { tilt: panelTilt, azimuth: panelAzimuth, rotation: R_final };
  } else if (trackerType === 'dual-axis') {
    return { tilt: zenith, azimuth: azimuth, rotation: 0 };
  } else {
    return null;
  }
}

// Helpers
function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }
