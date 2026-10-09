export async function getEnvironmentalSnapshot(coords, signal) {
  const base = new URLSearchParams({ latitude: String(coords[1]), longitude: String(coords[0]), timezone: 'auto' });
  const weather = new URLSearchParams(base);
  weather.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code');
  const air = new URLSearchParams(base);
  air.set('current', 'us_aqi,pm2_5');
  const [w, a] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${weather}`, { signal }),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${air}`, { signal }),
  ]);
  if (!w.ok || !a.ok) throw new Error('Environmental provider unavailable');
  const [wd, ad] = await Promise.all([w.json(), a.json()]);
  if (!wd.current || !ad.current) throw new Error('Environmental data unavailable');
  return { weather: wd.current, air: ad.current };
}

export function conditionText(code) {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Cloudy / partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Conditions unavailable';
}

export function asMeasure(number, suffix = '') {
  return typeof number === 'number' && Number.isFinite(number)
    ? `${Math.round(number * 10) / 10}${suffix}` : 'N/A';
}
export function aqiBand(value) {
  if (value <= 50) return { label: 'Good', color: '#61e4a4' };
  if (value <= 100) return { label: 'Moderate', color: '#edc864' };
  if (value <= 150) return { label: 'Unhealthy for sensitive groups', color: '#f3a15e' };
  if (value <= 200) return { label: 'Unhealthy', color: '#fc7c83' };
  if (value <= 300) return { label: 'Very unhealthy', color: '#c1a0ff' };
  return { label: 'Hazardous', color: '#e589ad' };
}
