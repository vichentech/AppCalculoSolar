/**
 * AppSolar — Open-Meteo API Integration
 * Free weather and solar radiation data
 */

import { getSolarPosition } from '../engine/solarPosition.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch current/forecast solar and weather data
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Hourly data
 */
export async function fetchWeatherData(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'shortwave_radiation',
      'direct_radiation',
      'diffuse_radiation',
      'direct_normal_irradiance',
    ].join(','),
    timezone: 'auto',
    forecast_days: 1,
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
    
    const data = await res.json();
    
    return {
      timezone: data.timezone,
      hourly: data.hourly.time.map((t, i) => ({
        time: t,
        hour: new Date(t).getHours(),
        temperature: data.hourly.temperature_2m[i],
        humidity: data.hourly.relative_humidity_2m[i],
        windSpeed: data.hourly.wind_speed_10m[i],
        ghi: data.hourly.shortwave_radiation[i],
        directRadiation: data.hourly.direct_radiation[i],
        diffuseRadiation: data.hourly.diffuse_radiation[i],
        dni: data.hourly.direct_normal_irradiance[i],
      })),
    };
  } catch (err) {
    console.warn('OpenMeteo fetch failed, using local simulated weather:', err);
    return getSimulatedHourlyData(lat, lon);
  }
}

function getSimulatedHourlyData(lat, lon) {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const dt = new Date(baseDate.getTime() + h * 3600000);
    const sunPos = getSolarPosition(lat, lon, dt);
    
    let ghi = 0;
    let dni = 0;
    let diffuse = 0;
    
    if (sunPos.elevation > 0) {
      const sinElev = Math.sin(sunPos.elevation * Math.PI / 180);
      ghi = Math.max(0, 1000 * sinElev);
      dni = Math.max(0, 850 * sinElev);
      diffuse = Math.max(0, 150 * sinElev);
    }
    
    const hour = h;
    const tempSeasonal = 8 * Math.cos(2 * Math.PI * (h - 15) / 24);
    const baseTemp = 18;
    const temperature = baseTemp + tempSeasonal;
    const humidity = Math.max(20, Math.min(95, 60 - 20 * Math.sin(2 * Math.PI * (h - 15) / 24)));
    const windSpeed = Math.max(0.5, 2.0 + 1.2 * Math.sin(2 * Math.PI * (h - 12) / 24));
    
    hourly.push({
      time: dt.toISOString(),
      hour,
      temperature,
      humidity,
      windSpeed,
      ghi,
      directRadiation: ghi - diffuse,
      diffuseRadiation: diffuse,
      dni,
    });
  }

  return {
    timezone: 'UTC',
    hourly,
    isSimulated: true,
  };
}

/**
 * Fetch historical daily averages (last 30 days)
 */
export async function fetchHistoricalData(lat, lon) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  const fmt = d => d.toISOString().split('T')[0];
  
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    start_date: fmt(start),
    end_date: fmt(end),
    daily: 'temperature_2m_mean,shortwave_radiation_sum,wind_speed_10m_max',
    timezone: 'auto',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo history error: ${res.status}`);
  
  const data = await res.json();
  return data.daily;
}

/**
 * Fetch historical daily averages for the last year
 */
export async function fetchHistoricalYearData(lat, lon) {
  const end = new Date();
  end.setDate(end.getDate() - 5); // Archive API usually has a 5-day delay
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);

  const fmt = d => d.toISOString().split('T')[0];
  
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    start_date: fmt(start),
    end_date: fmt(end),
    daily: 'temperature_2m_mean,shortwave_radiation_sum',
    timezone: 'auto',
  });

  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo archive error: ${res.status}`);
  
  const data = await res.json();
  
  // Convert to array of objects
  const daily = [];
  if (data.daily && data.daily.time) {
    for (let i = 0; i < data.daily.time.length; i++) {
      daily.push({
        date: data.daily.time[i],
        temperature: data.daily.temperature_2m_mean[i],
        // shortwave_radiation_sum is in MJ/m². Convert to kWh/m²: 1 MJ = 0.277778 kWh
        ghi: data.daily.shortwave_radiation_sum[i] * 0.277778,
      });
    }
  }
  return daily;
}
