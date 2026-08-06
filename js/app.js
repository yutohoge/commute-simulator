import { CONFIG } from "./config.js";
import { apiKeyIsConfigured, loadGoogleMaps } from "./google-loader.js";
import { resolveDepartureTime, formatDateTime, toDateTimeLocalValue } from "./time-utils.js";
import { createCacheKey, getCachedResult, storeCachedResult, clearRouteCache } from "./cache.js";

const state = {
  map: null,
  AdvancedMarkerElement: null,
  Route: null,
  originMarker: null,
  destinationMarker: null,
  polylines: [],
  origin: null,
  originLabel: "",
  destination: {
    label: CONFIG.DEFAULT_DESTINATION.label,
    address: CONFIG.DEFAULT_DESTINATION.address,
    location: { ...CONFIG.DEFAULT_DESTINATION.location }
  },
  preset: "NOW",
  lastResults: []
};

const el = {
  setupWarning: document.getElementById("setupWarning"),
  map: document.getElementById("map"),
  originAutocomplete: document.getElementById("originAutocomplete"),
  destinationAutocomplete: document.getElementById("destinationAutocomplete"),
  originLabel: document.getElementById("originLabel"),
  destinationLabel: document.getElementById("destinationLabel"),
  currentLocationButton: document.getElementById("currentLocationButton"),
  defaultDestinationButton: document.getElementById("defaultDestinationButton"),
  resetButton: document.getElementById("resetButton"),
  customDateTime: document.getElementById("customDateTime"),
  drivingOptions: document.getElementById("drivingOptions"),
  avoidTolls: document.getElementById("avoidTolls"),
  avoidHighways: document.getElementById("avoidHighways"),
  avoidFerries: document.getElementById("avoidFerries"),
  searchButton: document.getElementById("searchButton"),
  status: document.getElementById("status"),
  resultCards: document.getElementById("resultCards"),
  resultTime: document.getElementById("resultTime"),
  openGoogleMapsButton: document.getElementById("openGoogleMapsButton")
};

function setStatus(message, type = "") {
  el.status.textContent = message;
  el.status.className = `status ${type}`.trim();
}

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "DRIVING";
}

function clearPolylines() {
  state.polylines.forEach((polyline) => polyline.setMap(null));
  state.polylines = [];
}

function clearDisplayedResult() {
  clearPolylines();
  el.resultCards.replaceChildren();
  el.resultTime.textContent = "";
  el.openGoogleMapsButton.classList.add("hidden");
  state.lastResults = [];
}

function setOrigin(location, label) {
  state.origin = { lat: Number(location.lat), lng: Number(location.lng) };
  state.originLabel = label;
  el.originLabel.textContent = label;
  el.searchButton.disabled = false;

  if (!state.originMarker) {
    state.originMarker = new state.AdvancedMarkerElement({
      map: state.map,
      position: state.origin,
      title: label,
      gmpDraggable: true
    });

    state.originMarker.addListener("dragend", () => {
      const position = state.originMarker.position;
      if (!position) return;

      const literal = typeof position.toJSON === "function"
        ? position.toJSON()
        : { lat: Number(position.lat), lng: Number(position.lng) };

      state.origin = literal;
      state.originLabel = "ピンを移動した地点";
      el.originLabel.textContent = state.originLabel;
      clearDisplayedResult();
      setStatus("条件を確認して検索ボタンを押してください。");
    });
  } else {
    state.originMarker.position = state.origin;
    state.originMarker.title = label;
  }

  state.map.panTo(state.origin);
  if ((state.map.getZoom() || 0) < 14) state.map.setZoom(14);

  clearDisplayedResult();
  setStatus("条件を確認して検索ボタンを押してください。");
}

function setDestination(location, label, address = "") {
  state.destination = {
    location: { lat: Number(location.lat), lng: Number(location.lng) },
    label,
    address
  };

  el.destinationLabel.textContent = address ? `${label}｜${address}` : label;
  state.destinationMarker.position = state.destination.location;
  state.destinationMarker.title = label;

  clearDisplayedResult();
}

function restoreDefaultDestination() {
  setDestination(
    CONFIG.DEFAULT_DESTINATION.location,
    CONFIG.DEFAULT_DESTINATION.label,
    CONFIG.DEFAULT_DESTINATION.address
  );
}

async function createAutocomplete(host, placeholder, onSelect) {
  const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
  const autocomplete = new PlaceAutocompleteElement({
    includedRegionCodes: ["JP"]
  });
  autocomplete.placeholder = placeholder;
  autocomplete.style.width = "100%";
  host.replaceChildren(autocomplete);

  autocomplete.addEventListener("gmp-select", async ({ placePrediction }) => {
    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"]
      });

      if (!place.location) throw new Error("選択した場所の座標を取得できませんでした。");

      onSelect({
        location: place.location.toJSON(),
        label: place.displayName || place.formattedAddress || placeholder,
        address: place.formattedAddress || ""
      });
    } catch (error) {
      console.error(error);
      setStatus(error.message || "場所の取得に失敗しました。", "error");
    }
  });
}

function createRouteRequest(mode) {
  const departureTime = resolveDepartureTime(state.preset, el.customDateTime.value);

  const request = {
    origin: state.origin,
    destination: state.destination.location,
    travelMode: mode,
    departureTime,
    fields: [
      "path",
      "viewport",
      "durationMillis",
      "staticDurationMillis",
      "distanceMeters",
      "warnings"
    ]
  };

  if (mode === "DRIVING") {
    request.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
    request.trafficModel = "BEST_GUESS";
    request.routeModifiers = {
      avoidTolls: el.avoidTolls.checked,
      avoidHighways: el.avoidHighways.checked,
      avoidFerries: el.avoidFerries.checked
    };
  }

  return { request, departureTime };
}

async function computeRoute(mode) {
  const { request, departureTime } = createRouteRequest(mode);
  const cacheParams = {
    origin: state.origin,
    destination: state.destination.location,
    mode,
    departureTime,
    avoidTolls: el.avoidTolls.checked,
    avoidHighways: el.avoidHighways.checked,
    avoidFerries: el.avoidFerries.checked
  };
  const key = createCacheKey(cacheParams);
  const cached = getCachedResult(key);

  if (cached) return { ...cached, fromCache: true };

  const { routes } = await state.Route.computeRoutes(request);
  if (!routes?.length) throw new Error("条件に合う経路が見つかりませんでした。");

  const result = {
    mode,
    route: routes[0],
    departureTime,
    fromCache: false
  };

  storeCachedResult(key, result);
  return result;
}

function durationText(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "—";
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}時間${minutes}分` : `${hours}時間`;
}

function distanceText(meters) {
  if (!Number.isFinite(meters)) return "—";
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function createResultCard(result) {
  const { route, mode, departureTime, fromCache } = result;
  const card = document.createElement("article");
  card.className = "result-card";

  const arrivalTime = new Date(departureTime.getTime() + (route.durationMillis || 0));
  const modeLabel = mode === "DRIVING" ? "車" : "公共交通";

  const header = document.createElement("div");
  header.className = "result-card-header";
  header.innerHTML = `
    <h3>${modeLabel}</h3>
    <span class="cache-label">${fromCache ? "直前の結果を再利用" : "新規取得"}</span>
  `;

  const duration = document.createElement("div");
  duration.className = "duration";
  duration.textContent = durationText(route.durationMillis);

  const meta = document.createElement("div");
  meta.className = "result-meta";
  meta.innerHTML = `
    <div class="meta-box">距離<br><strong>${distanceText(route.distanceMeters)}</strong></div>
    <div class="meta-box">到着予定<br><strong>${new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(arrivalTime)}</strong></div>
  `;

  card.append(header, duration, meta);

  if (mode === "DRIVING" && Number.isFinite(route.staticDurationMillis)) {
    const increase = Math.round(
      ((route.durationMillis || 0) - route.staticDurationMillis) / 60000
    );
    const note = document.createElement("p");
    note.className = "result-note";
    note.textContent = increase > 0
      ? `交通状況による増加目安：+${increase}分`
      : "交通状況による大きな増加はありません。";
    card.appendChild(note);
  }

  if (mode === "TRANSIT") {
    const note = document.createElement("p");
    note.className = "result-note";
    note.textContent = "徒歩・バス・鉄道を含むGoogleの公共交通経路です。詳細は「Googleマップで開く」から確認できます。";
    card.appendChild(note);
  }

  if (route.warnings?.length) {
    const warning = document.createElement("p");
    warning.className = "result-note";
    warning.textContent = route.warnings.join(" ");
    card.appendChild(warning);
  }

  return card;
}

function renderResults(results) {
  el.resultCards.replaceChildren();

  results.forEach((result) => {
    el.resultCards.appendChild(createResultCard(result));
  });

  if (results.length === 2) {
    const driving = results.find((item) => item.mode === "DRIVING");
    const transit = results.find((item) => item.mode === "TRANSIT");

    if (driving && transit) {
      const drivingDuration = driving.route.durationMillis || 0;
      const transitDuration = transit.route.durationMillis || 0;
      const faster = drivingDuration <= transitDuration ? "車" : "公共交通";
      const difference = Math.round(Math.abs(drivingDuration - transitDuration) / 60000);

      const note = document.createElement("div");
      note.className = "compare-note";
      note.textContent = difference === 0
        ? "車と公共交通の予測時間はほぼ同じです。"
        : `${faster}の方が約${difference}分短い予測です。`;
      el.resultCards.appendChild(note);
    }
  }
}

function drawRoute(route) {
  clearPolylines();
  state.polylines = route.createPolylines();
  state.polylines.forEach((polyline) => polyline.setMap(state.map));

  if (route.viewport) state.map.fitBounds(route.viewport, 40);
}

async function searchRoutes() {
  if (!state.origin) {
    setStatus("出発地を設定してください。", "error");
    return;
  }

  const mode = selectedMode();
  const modes = mode === "COMPARE" ? ["DRIVING", "TRANSIT"] : [mode];

  el.searchButton.disabled = true;
  setStatus("経路を計算しています…", "loading");

  try {
    const results = await Promise.all(modes.map(computeRoute));
    state.lastResults = results;

    renderResults(results);

    const routeToDraw = results.reduce((best, item) => {
      if (!best) return item;
      return (item.route.durationMillis || Infinity) < (best.route.durationMillis || Infinity)
        ? item
        : best;
    }, null);

    drawRoute(routeToDraw.route);
    el.resultTime.textContent = formatDateTime(results[0].departureTime);
    el.openGoogleMapsButton.classList.remove("hidden");

    setStatus(
      results.some((item) => item.fromCache)
        ? "結果を表示しました。一部は直前の同一条件結果を再利用しています。"
        : "結果を表示しました。"
    );
  } catch (error) {
    console.error(error);
    setStatus(error.message || "経路検索に失敗しました。", "error");
  } finally {
    el.searchButton.disabled = !state.origin;
  }
}

function updateModeUi() {
  el.drivingOptions.classList.toggle("hidden", selectedMode() === "TRANSIT");
}

function openGoogleMaps() {
  if (!state.origin) return;

  const travelMode = selectedMode() === "TRANSIT" ? "transit" : "driving";
  const params = new URLSearchParams({
    api: "1",
    origin: `${state.origin.lat},${state.origin.lng}`,
    destination: `${state.destination.location.lat},${state.destination.location.lng}`,
    travelmode: travelMode
  });

  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
}

function resetApp() {
  clearRouteCache();
  clearDisplayedResult();

  state.origin = null;
  state.originLabel = "";
  state.preset = "NOW";

  if (state.originMarker) {
    state.originMarker.map = null;
    state.originMarker = null;
  }

  el.originLabel.textContent = "地図をタップするか、場所を検索してください。";
  el.searchButton.disabled = true;
  el.customDateTime.value = "";

  document.querySelectorAll(".preset").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === "NOW");
  });

  restoreDefaultDestination();
  state.map.setCenter(CONFIG.INITIAL_MAP.center);
  state.map.setZoom(CONFIG.INITIAL_MAP.zoom);
  setStatus("出発地を設定してください。");
}

function bindEvents() {
  state.map.addListener("click", (event) => {
    if (!event.latLng) return;
    setOrigin(event.latLng.toJSON(), "地図で選択した地点");
  });

  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.addEventListener("change", updateModeUi);
  });

  document.querySelectorAll(".preset").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".preset").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.preset = button.dataset.preset;
      el.customDateTime.value = "";
    });
  });

  el.customDateTime.addEventListener("change", () => {
    if (!el.customDateTime.value) return;
    document.querySelectorAll(".preset").forEach((item) => item.classList.remove("active"));
    state.preset = "CUSTOM";
  });

  el.searchButton.addEventListener("click", searchRoutes);
  el.defaultDestinationButton.addEventListener("click", restoreDefaultDestination);
  el.resetButton.addEventListener("click", resetApp);
  el.openGoogleMapsButton.addEventListener("click", openGoogleMaps);

  el.currentLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("このブラウザは現在地取得に対応していません。", "error");
      return;
    }

    setStatus("現在地を取得しています…", "loading");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin(
          { lat: coords.latitude, lng: coords.longitude },
          "現在地"
        );
      },
      () => {
        setStatus("現在地を取得できませんでした。ブラウザの位置情報設定を確認してください。", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      }
    );
  });
}

async function init() {
  if (!apiKeyIsConfigured()) {
    el.setupWarning.classList.remove("hidden");
    el.map.innerHTML = `
      <div style="display:grid;place-items:center;height:100%;padding:30px;text-align:center;color:#687588">
        <div>
          <strong>APIキー未設定</strong><br>
          <code>js/config.js</code>を編集してからGitHub Pagesへアップロードしてください。
        </div>
      </div>
    `;
    setStatus("APIキーを設定すると利用できます。", "error");
    return;
  }

  try {
    await loadGoogleMaps();

    const [{ Map }, { AdvancedMarkerElement }, { Route }] = await Promise.all([
      google.maps.importLibrary("maps"),
      google.maps.importLibrary("marker"),
      google.maps.importLibrary("routes")
    ]);

    state.AdvancedMarkerElement = AdvancedMarkerElement;
    state.Route = Route;

    state.map = new Map(el.map, {
      center: CONFIG.INITIAL_MAP.center,
      zoom: CONFIG.INITIAL_MAP.zoom,
      mapId: "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    state.destinationMarker = new AdvancedMarkerElement({
      map: state.map,
      position: state.destination.location,
      title: state.destination.label
    });

    await Promise.all([
      createAutocomplete(
        el.originAutocomplete,
        "出発地の住所・駅・施設を検索",
        ({ location, label, address }) => setOrigin(location, address || label)
      ),
      createAutocomplete(
        el.destinationAutocomplete,
        "目的地を変更",
        ({ location, label, address }) => setDestination(location, label, address)
      )
    ]);

    el.customDateTime.min = toDateTimeLocalValue(new Date(Date.now() + 60_000));
    bindEvents();
    updateModeUi();
  } catch (error) {
    console.error(error);
    el.setupWarning.classList.remove("hidden");
    el.setupWarning.innerHTML = `
      <strong>Google Mapsの初期化に失敗しました。</strong>
      <span>${error.message}</span>
    `;
    setStatus("APIキー・有効API・ウェブサイト制限を確認してください。", "error");
  }
}

init();
