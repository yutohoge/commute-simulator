import { CONFIG } from "./config.js";

let loaderPromise = null;

export function apiKeyIsConfigured() {
  const key = CONFIG.GOOGLE_MAPS_API_KEY?.trim();
  return Boolean(key && key !== "YOUR_API_KEY_HERE");
}

export function loadGoogleMaps() {
  if (!apiKeyIsConfigured()) {
    return Promise.reject(new Error("APIキーが未設定です。"));
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps);
  }

  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callback = "__commuteSimulatorGoogleMapsReady";

    window[callback] = () => {
      delete window[callback];
      resolve(window.google.maps);
    };

    const params = new URLSearchParams({
      key: CONFIG.GOOGLE_MAPS_API_KEY,
      v: "weekly",
      language: CONFIG.LANGUAGE,
      region: CONFIG.REGION,
      loading: "async",
      callback
    });

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      delete window[callback];
      reject(new Error("Google Maps JavaScript APIを読み込めませんでした。"));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
}
