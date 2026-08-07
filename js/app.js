import { CONFIG } from "./config.js";
import { apiKeyIsConfigured, loadGoogleMaps } from "./google-loader.js";
import { resolveDepartureTime, formatDateTime, toDateTimeLocalValue } from "./time-utils.js";
import { createCacheKey, getCachedResult, storeCachedResult, clearRouteCache } from "./cache.js";

const state = {
  map: null,
  AdvancedMarkerElement: null,
  PinElement: null,
  Route: null,
  originMarker: null,
  destinationMarker: null,
  originAutocompleteControl: null,
  destinationAutocompleteControl: null,
  polylines: [],
  origin: null,
  originLabel: "",
  destination: {
    label: CONFIG.DEFAULT_DESTINATION.label,
    address: CONFIG.DEFAULT_DESTINATION.address,
    location: { ...CONFIG.DEFAULT_DESTINATION.location }
  },
  preset: "NOW",
  mapSelectionTarget: "ORIGIN",
  lastResults: [],
  candidates: [],
  pendingCandidate: null
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
  openGoogleMapsButton: document.getElementById("openGoogleMapsButton"),
  mapTargetOrigin: document.getElementById("mapTargetOrigin"),
  mapTargetDestination: document.getElementById("mapTargetDestination"),
  mapSelectionHint: document.getElementById("mapSelectionHint"),

  addCandidateButton: document.getElementById("addCandidateButton"),
  candidateCount: document.getElementById("candidateCount"),
  candidateConditionNotice: document.getElementById("candidateConditionNotice"),
  candidateEmpty: document.getElementById("candidateEmpty"),
  candidateList: document.getElementById("candidateList"),
  clearCandidatesButton: document.getElementById("clearCandidatesButton"),

  candidateDialog: document.getElementById("candidateDialog"),
  candidateForm: document.getElementById("candidateForm"),
  candidateNameInput: document.getElementById("candidateNameInput"),
  candidateDialogSummary: document.getElementById("candidateDialogSummary"),
  candidateDialogClose: document.getElementById("candidateDialogClose"),
  candidateCancelButton: document.getElementById("candidateCancelButton")
};

function setStatus(message, type = "") {
  el.status.textContent = message;
  el.status.className = `status ${type}`.trim();
}

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "DRIVING";
}

function setMapSelectionTarget(target) {
  state.mapSelectionTarget = target;

  const originActive = target === "ORIGIN";
  const destinationActive = target === "DESTINATION";

  el.mapTargetOrigin.classList.toggle("active", originActive);
  el.mapTargetDestination.classList.toggle("active", destinationActive);
  el.mapTargetOrigin.setAttribute("aria-pressed", String(originActive));
  el.mapTargetDestination.setAttribute("aria-pressed", String(destinationActive));

  el.mapSelectionHint.textContent = originActive
    ? "地図をタップして出発地を選択"
    : "地図をタップして目的地を選択";
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
  updateCandidateAddButton();
}

function createOriginPin() {
  return new state.PinElement({
    background: "#1769e0",
    borderColor: "#1057bf",
    glyphColor: "#ffffff",
    glyphText: "出",
    scale: 1.08
  });
}

function createDestinationPin() {
  return new state.PinElement({
    background: "#d93025",
    borderColor: "#a61b13",
    glyphColor: "#ffffff",
    glyphText: "目",
    scale: 1.08
  });
}

function createOriginMarker(location, label) {
  const marker = new state.AdvancedMarkerElement({
    map: state.map,
    position: location,
    title: label,
    gmpDraggable: true,
    zIndex: 20
  });

  marker.append(createOriginPin());

  marker.addListener("dragend", () => {
    const position = marker.position;
    if (!position) return;

    const literal = typeof position.toJSON === "function"
      ? position.toJSON()
      : { lat: Number(position.lat), lng: Number(position.lng) };

    state.origin = literal;
    state.originLabel = "ピンを移動した出発地";
    el.originLabel.textContent = state.originLabel;

    if (state.originAutocompleteControl) {
      state.originAutocompleteControl.value = "";
    }

    clearDisplayedResult();
    setStatus("出発地を移動しました。条件を確認して検索してください。");
  });

  return marker;
}

function createDestinationMarker(location, label) {
  const marker = new state.AdvancedMarkerElement({
    map: state.map,
    position: location,
    title: label,
    gmpDraggable: true,
    zIndex: 10
  });

  marker.append(createDestinationPin());

  marker.addListener("dragend", () => {
    const position = marker.position;
    if (!position) return;

    const literal = typeof position.toJSON === "function"
      ? position.toJSON()
      : { lat: Number(position.lat), lng: Number(position.lng) };

    state.destination = {
      location: literal,
      label: "ピンを移動した目的地",
      address: ""
    };

    el.destinationLabel.textContent = state.destination.label;

    if (state.destinationAutocompleteControl) {
      state.destinationAutocompleteControl.value = "";
    }

    clearDisplayedResult();

    if (state.origin) {
      setStatus("目的地を移動しました。条件を確認して検索してください。");
    } else {
      setStatus("目的地を移動しました。次に出発地を設定してください。");
    }
  });

  return marker;
}

function setOrigin(location, label, options = {}) {
  state.origin = {
    lat: Number(location.lat),
    lng: Number(location.lng)
  };

  state.originLabel = label;
  el.originLabel.textContent = label;
  el.searchButton.disabled = false;

  if (!state.originMarker) {
    state.originMarker = createOriginMarker(state.origin, label);
  } else {
    state.originMarker.position = state.origin;
    state.originMarker.title = label;
  }

  if (options.clearAutocomplete && state.originAutocompleteControl) {
    state.originAutocompleteControl.value = "";
  }

  state.map.panTo(state.origin);

  if ((state.map.getZoom() || 0) < 14) {
    state.map.setZoom(14);
  }

  clearDisplayedResult();
  setStatus("条件を確認して検索ボタンを押してください。");
}

function setDestination(location, label, address = "", options = {}) {
  state.destination = {
    location: {
      lat: Number(location.lat),
      lng: Number(location.lng)
    },
    label,
    address
  };

  el.destinationLabel.textContent = label;

  if (!state.destinationMarker) {
    state.destinationMarker = createDestinationMarker(state.destination.location, label);
  } else {
    state.destinationMarker.position = state.destination.location;
    state.destinationMarker.title = label;
  }

  if (options.clearAutocomplete && state.destinationAutocompleteControl) {
    state.destinationAutocompleteControl.value = "";
  }

  clearDisplayedResult();

  if (state.origin) {
    setStatus("目的地を変更しました。もう一度検索してください。");
  }
}

function restoreDefaultDestination() {
  setDestination(
    CONFIG.DEFAULT_DESTINATION.location,
    CONFIG.DEFAULT_DESTINATION.label,
    CONFIG.DEFAULT_DESTINATION.address
  );

  if (state.destinationAutocompleteControl) {
    state.destinationAutocompleteControl.value = "";
  }
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

      if (!place.location) {
        throw new Error("選択した場所の座標を取得できませんでした。");
      }

      autocomplete.value = place.displayName || place.formattedAddress || "";

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

  return autocomplete;
}

function createRouteRequest(mode) {
  const departureTime = resolveDepartureTime(state.preset, el.customDateTime.value);

  const fields = mode === "TRANSIT"
    ? ["path", "legs", "viewport", "durationMillis", "distanceMeters", "warnings"]
    : ["path", "viewport", "durationMillis", "staticDurationMillis", "distanceMeters", "warnings"];

  const request = {
    origin: state.origin,
    destination: state.destination.location,
    travelMode: mode,
    departureTime,
    fields
  };

  if (mode === "DRIVING") {
    request.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
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

  if (cached) {
    return { ...cached, fromCache: true };
  }

  const { routes } = await state.Route.computeRoutes(request);

  if (!routes?.length) {
    if (mode === "TRANSIT") {
      throw new Error("この条件では公共交通ルートが見つかりませんでした。");
    }
    throw new Error("条件に合う経路が見つかりませんでした。");
  }

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
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
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
    <div class="meta-box">到着予定<br><strong>${new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(arrivalTime)}</strong></div>
  `;

  card.append(header, duration, meta);

  if (mode === "DRIVING" && Number.isFinite(route.staticDurationMillis)) {
    const increase = Math.round(((route.durationMillis || 0) - route.staticDurationMillis) / 60000);
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
  results.forEach((result) => el.resultCards.appendChild(createResultCard(result)));

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

  clearDisplayedResult();

  const mode = selectedMode();
  const modes = mode === "COMPARE" ? ["DRIVING", "TRANSIT"] : [mode];

  el.searchButton.disabled = true;
  setStatus("経路を計算しています…", "loading");

  try {
    const settled = await Promise.allSettled(modes.map((currentMode) => computeRoute(currentMode)));
    const results = [];
    const errors = [];

    settled.forEach((result) => {
      if (result.status === "fulfilled") results.push(result.value);
      else errors.push(result.reason);
    });

    if (!results.length) {
      throw errors[0] || new Error("経路を取得できませんでした。");
    }

    state.lastResults = results;
    renderResults(results);

    const routeToDraw = results.reduce((best, item) => {
      if (!best) return item;
      return (item.route.durationMillis || Infinity) < (best.route.durationMillis || Infinity) ? item : best;
    }, null);

    drawRoute(routeToDraw.route);
    el.resultTime.textContent = formatDateTime(results[0].departureTime);
    el.openGoogleMapsButton.classList.remove("hidden");

    if (errors.length) {
      setStatus(`一部の経路を取得できませんでした：${errors[0].message}`, "error");
    } else {
      setStatus(
        results.some((item) => item.fromCache)
          ? "結果を表示しました。一部は直前の同一条件結果を再利用しています。"
          : "結果を表示しました。"
      );
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "経路検索に失敗しました。", "error");
  } finally {
    el.searchButton.disabled = !state.origin;
  }
}

function updateModeUi() {
  el.drivingOptions.classList.toggle("hidden", selectedMode() === "TRANSIT");

  if (state.lastResults.length) {
    clearDisplayedResult();
    if (state.origin) setStatus("移動手段を変更しました。もう一度検索してください。");
  }
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
  if (state.originAutocompleteControl) state.originAutocompleteControl.value = "";

  el.searchButton.disabled = true;
  el.customDateTime.value = "";

  document.querySelectorAll(".preset").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === "NOW");
  });

  restoreDefaultDestination();
  setMapSelectionTarget("ORIGIN");
  state.map.setCenter(CONFIG.INITIAL_MAP.center);
  state.map.setZoom(CONFIG.INITIAL_MAP.zoom);
  setStatus("出発地を設定してください。");
}

function bindEvents() {
  state.map.addListener("click", (event) => {
    if (!event.latLng) return;

    const location = event.latLng.toJSON();

    if (state.mapSelectionTarget === "ORIGIN") {
      setOrigin(location, "地図で選択した出発地", { clearAutocomplete: true });
    } else {
      setDestination(location, "地図で選択した目的地", "", { clearAutocomplete: true });
      if (!state.origin) {
        setStatus("目的地を設定しました。次に出発地を設定してください。");
      }
    }
  });

  el.mapTargetOrigin.addEventListener("click", () => setMapSelectionTarget("ORIGIN"));
  el.mapTargetDestination.addEventListener("click", () => setMapSelectionTarget("DESTINATION"));

  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.addEventListener("change", updateModeUi);
  });

  document.querySelectorAll(".preset").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".preset").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.preset = button.dataset.preset;
      el.customDateTime.value = "";

      if (state.lastResults.length) {
        clearDisplayedResult();
        if (state.origin) setStatus("出発時刻を変更しました。もう一度検索してください。");
      }
    });
  });

  el.customDateTime.addEventListener("change", () => {
    if (!el.customDateTime.value) return;

    document.querySelectorAll(".preset").forEach((item) => item.classList.remove("active"));
    state.preset = "CUSTOM";

    if (state.lastResults.length) {
      clearDisplayedResult();
      if (state.origin) setStatus("出発時刻を変更しました。もう一度検索してください。");
    }
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
          "現在地",
          { clearAutocomplete: true }
        );
      },
      () => {
        setStatus("現在地を取得できませんでした。ブラウザの位置情報設定を確認してください。", "error");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
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

    const [
      { Map },
      { AdvancedMarkerElement, PinElement },
      { Route }
    ] = await Promise.all([
      google.maps.importLibrary("maps"),
      google.maps.importLibrary("marker"),
      google.maps.importLibrary("routes")
    ]);

    state.AdvancedMarkerElement = AdvancedMarkerElement;
    state.PinElement = PinElement;
    state.Route = Route;

    state.map = new Map(el.map, {
      center: CONFIG.INITIAL_MAP.center,
      zoom: CONFIG.INITIAL_MAP.zoom,
      mapId: "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    state.destinationMarker = createDestinationMarker(
      state.destination.location,
      state.destination.label
    );

    const [originAutocompleteControl, destinationAutocompleteControl] = await Promise.all([
      createAutocomplete(
        el.originAutocomplete,
        "出発地の住所・駅・施設を検索",
        ({ location, label }) => setOrigin(location, label)
      ),
      createAutocomplete(
        el.destinationAutocomplete,
        "目的地を変更",
        ({ location, label, address }) => setDestination(location, label, address)
      )
    ]);

    state.originAutocompleteControl = originAutocompleteControl;
    state.destinationAutocompleteControl = destinationAutocompleteControl;

    el.customDateTime.min = toDateTimeLocalValue(new Date(Date.now() + 60000));

    loadCandidates();
    renderCandidates();

    bindEvents();
    updateModeUi();
    updateCandidateAddButton();
    setMapSelectionTarget("ORIGIN");
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
