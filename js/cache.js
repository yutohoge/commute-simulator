import { CONFIG } from "./config.js";

const cache = new Map();
const ttlMs = CONFIG.CACHE_TTL_MINUTES * 60 * 1000;

function normalizeLocation(location) {
  return {
    lat: Number(location.lat).toFixed(5),
    lng: Number(location.lng).toFixed(5)
  };
}

export function createCacheKey(params) {
  return JSON.stringify({
    origin: normalizeLocation(params.origin),
    destination: normalizeLocation(params.destination),
    mode: params.mode,
    departure: params.departureTime.toISOString().slice(0, 16),
    avoidTolls: params.avoidTolls,
    avoidHighways: params.avoidHighways,
    avoidFerries: params.avoidFerries
  });
}

export function getCachedResult(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > ttlMs) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function storeCachedResult(key, value) {
  cache.set(key, { createdAt: Date.now(), value });
}

export function clearRouteCache() {
  cache.clear();
}
