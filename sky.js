/** Sunrise/sunset + weather. Professional sky position. */

export const CITIES = [
  { id: "tehran", name: "تهران", lat: 35.6892, lon: 51.3890, tz: 3.5 },
  { id: "mashhad", name: "مشهد", lat: 36.2605, lon: 59.6168, tz: 3.5 },
  { id: "isfahan", name: "اصفهان", lat: 32.6546, lon: 51.6680, tz: 3.5 },
  { id: "shiraz", name: "شیراز", lat: 29.5918, lon: 52.5837, tz: 3.5 },
  { id: "tabriz", name: "تبریز", lat: 38.0962, lon: 46.2738, tz: 3.5 },
  { id: "karaj", name: "کرج", lat: 35.8400, lon: 50.9391, tz: 3.5 },
  { id: "ahvaz", name: "اهواز", lat: 31.3183, lon: 48.6706, tz: 3.5 },
  { id: "qom", name: "قم", lat: 34.6416, lon: 50.8746, tz: 3.5 },
  { id: "rasht", name: "رشت", lat: 37.2808, lon: 49.5832, tz: 3.5 },
  { id: "yazd", name: "یزد", lat: 31.8974, lon: 54.3569, tz: 3.5 },
  { id: "kerman", name: "کرمان", lat: 30.2832, lon: 57.0788, tz: 3.5 },
  { id: "kermanshah", name: "کرمانشاه", lat: 34.3142, lon: 47.0650, tz: 3.5 },
  { id: "urmia", name: "ارومیه", lat: 37.5527, lon: 45.0761, tz: 3.5 },
  { id: "sari", name: "ساری", lat: 36.5633, lon: 53.0601, tz: 3.5 },
  { id: "bandarabbas", name: "بندرعباس", lat: 27.1832, lon: 56.2666, tz: 3.5 },
  { id: "istanbul", name: "استانبول", lat: 41.0082, lon: 28.9784, tz: 3 },
  { id: "dubai", name: "دبی", lat: 25.2048, lon: 55.2708, tz: 4 },
  { id: "london", name: "لندن", lat: 51.5074, lon: -0.1278, tz: 0 }
];

/** Offline approximation — minutes from local midnight in city TZ. */
export function sunTimes(lat, lon, date = new Date(), tzOffsetHours = 3.5) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date - start) / 86400000);
  const latR = lat * Math.PI / 180;
  // declination
  const decl = 0.4093 * Math.sin(2 * Math.PI * (day - 81) / 365);
  let cosH = -Math.tan(latR) * Math.tan(decl);
  cosH = Math.max(-1, Math.min(1, cosH));
  const H = Math.acos(cosH); // hour angle radians
  // solar noon approx UTC then + tz; lon correction: 4 min per degree
  const eqTime = 7.5 * Math.sin(2 * Math.PI * (day - 81) / 365); // rough minutes
  const solarNoonLocal = 12 * 60 - lon * 4 + tzOffsetHours * 0 - eqTime;
  // Actually solar noon in local civil time ≈ 12:00 adjusted by lon relative to tz meridian
  const tzMeridian = tzOffsetHours * 15;
  const noon = 12 * 60 + (tzMeridian - lon) * 4 - eqTime;
  const half = (H * 180 / Math.PI) * 4; // degrees * 4 min
  let riseMin = Math.round(noon - half);
  let setMin = Math.round(noon + half);
  riseMin = ((riseMin % (24 * 60)) + 24 * 60) % (24 * 60);
  setMin = ((setMin % (24 * 60)) + 24 * 60) % (24 * 60);
  return { riseMin, setMin, polar: false };
}

export function fmtMin(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

/** Position on arc 0..100. Uses city-local clock minutes. */
export function skyPosition(now, riseMin, setMin, tzOffsetHours = 3.5) {
  // convert "now" to approximate city-local minutes
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  let mins = utcMins + tzOffsetHours * 60;
  mins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const isDay = riseMin <= setMin
    ? (mins >= riseMin && mins < setMin)
    : (mins >= riseMin || mins < setMin);
  let t;
  if (isDay) {
    const span = riseMin <= setMin ? (setMin - riseMin) : (24 * 60 - riseMin + setMin);
    const elapsed = mins >= riseMin ? (mins - riseMin) : (mins + 24 * 60 - riseMin);
    t = elapsed / Math.max(1, span);
  } else {
    const span = riseMin <= setMin ? (24 * 60 - (setMin - riseMin)) : (riseMin - setMin);
    let elapsed;
    if (mins >= setMin) elapsed = mins - setMin;
    else elapsed = mins + 24 * 60 - setMin;
    t = elapsed / Math.max(1, span);
  }
  t = Math.max(0, Math.min(1, t));
  const x = 8 + t * 84;
  const y = 78 - Math.sin(t * Math.PI) * 58;
  return { isDay, x, y, t, localMins: mins };
}

/** Optional: fetch accurate sunrise/sunset from Open-Meteo */
export async function fetchSunTimes(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout?.(8000) });
  if (!res.ok) throw new Error("sun");
  const data = await res.json();
  const rise = data.daily?.sunrise?.[0];
  const set = data.daily?.sunset?.[0];
  if (!rise || !set) throw new Error("sun empty");
  const parse = (iso) => {
    const d = new Date(iso);
    // local components as returned in timezone=auto are in that TZ as local string
    // Open-Meteo returns ISO with offset
    return d.getHours() * 60 + d.getMinutes();
  };
  // Better parse the time portion if offset included
  const parseIsoLocal = (iso) => {
    const m = String(iso).match(/T(\d{2}):(\d{2})/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return parse(iso);
  };
  return { riseMin: parseIsoLocal(rise), setMin: parseIsoLocal(set), polar: false, source: "api" };
}

const WMO = {
  0: { label: "آفتابی", icon: "☀️" },
  1: { label: "عمدتاً صاف", icon: "🌤" },
  2: { label: "نیمه‌ابری", icon: "⛅" },
  3: { label: "ابری", icon: "☁️" },
  45: { label: "مه", icon: "🌫" },
  48: { label: "مه یخ‌زده", icon: "🌫" },
  51: { label: "نم‌نم", icon: "🌦" },
  61: { label: "باران", icon: "🌧" },
  71: { label: "برف", icon: "❄️" },
  80: { label: "رگبار", icon: "🌧" },
  95: { label: "رعدوبرق", icon: "⛈" }
};

export function weatherLabel(code) {
  if (WMO[code]) return WMO[code];
  if (code >= 71 && code < 80) return WMO[71];
  if (code >= 61 && code < 70) return WMO[61];
  if (code >= 51 && code < 60) return WMO[51];
  if (code >= 95) return WMO[95];
  return { label: "نامشخص", icon: "🌡" };
}

export async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
  const res = await fetch(url, { signal: AbortSignal.timeout?.(8000) });
  if (!res.ok) throw new Error("weather");
  const data = await res.json();
  const code = data.current?.weather_code ?? 0;
  const info = weatherLabel(code);
  return { ...info, temp: data.current?.temperature_2m, offline: false };
}

export function offlineWeatherHint(isDay) {
  return { label: isDay ? "روز" : "شب", icon: isDay ? "☀️" : "🌙", temp: null, offline: true };
}
