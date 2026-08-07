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
  pendingCandidate: null,
  timeComparison: null
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
  openTransitMapsButton: document.getElementById("openTransitMapsButton"),
  transitMapNote: document.getElementById("transitMapNote"),
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
  candidateCancelButton: document.getElementById("candidateCancelButton"),

  timeCompareDate: document.getElementById("timeCompareDate"),
  timeCompareEmpty: document.getElementById("timeCompareEmpty"),
  timeCompareControls: document.getElementById("timeCompareControls"),
  timeCompareApiEstimate: document.getElementById("timeCompareApiEstimate"),
  runTimeCompareButton: document.getElementById("runTimeCompareButton"),
  timeCompareStatus: document.getElementById("timeCompareStatus"),
  timeCompareResult: document.getElementById("timeCompareResult"),
  timeCompareHeadRow: document.getElementById("timeCompareHeadRow"),
  timeCompareBody: document.getElementById("timeCompareBody"),
  timeCompareSummary: document.getElementById("timeCompareSummary"),
  clearTimeCompareButton: document.getElementById("clearTimeCompareButton"),

  timeSlotInputs: document.getElementById("timeSlotInputs"),
  addTimeSlotButton: document.getElementById("addTimeSlotButton"),
  resetTimeSlotsButton: document.getElementById("resetTimeSlotsButton")
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

  el.openTransitMapsButton.classList.toggle(
    "hidden",
    !state.origin
  );

  el.transitMapNote.classList.toggle(
    "hidden",
    !state.origin
  );

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

  el.openTransitMapsButton.classList.remove(
    "hidden"
  );

  el.transitMapNote.classList.remove(
    "hidden"
  );

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


/* =========================================================
   Candidate comparison - v1.1.1
========================================================= */

const CANDIDATE_STORAGE_KEY = "commuteSimulatorCandidatesV1_1";
const MAX_CANDIDATES = 12;

function safeSessionStorageGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorageが使えない場合でも、メモリ上では動作を継続する
  }
}

function loadCandidates() {
  const raw = safeSessionStorageGet(CANDIDATE_STORAGE_KEY);

  if (!raw) {
    state.candidates = [];
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.candidates = Array.isArray(parsed) ? parsed : [];
  } catch {
    state.candidates = [];
  }
}

function persistCandidates() {
  safeSessionStorageSet(
    CANDIDATE_STORAGE_KEY,
    JSON.stringify(state.candidates)
  );
}

function currentDrivingResult() {
  return (
    state.lastResults.find(
      (item) => item.mode === "DRIVING"
    ) || null
  );
}

function candidateDurationText(milliseconds) {
  return durationText(milliseconds);
}

function candidateDepartureLabel(date) {
  return formatDateTime(date);
}

function currentConditionSignature() {
  const destination = state.destination.location;

  return JSON.stringify({
    destinationLat: Number(destination.lat).toFixed(5),
    destinationLng: Number(destination.lng).toFixed(5),
    destinationLabel: state.destination.label,
    preset: state.preset,
    customDateTime:
      state.preset === "CUSTOM"
        ? el.customDateTime.value
        : "",
    avoidTolls: el.avoidTolls.checked,
    avoidHighways: el.avoidHighways.checked,
    avoidFerries: el.avoidFerries.checked
  });
}

function currentConditionLabel() {
  let timeLabel = "現在";

  if (state.preset === "WEEKDAY_0730") {
    timeLabel = "平日 7:30";
  } else if (state.preset === "WEEKDAY_0800") {
    timeLabel = "平日 8:00";
  } else if (state.preset === "WEEKDAY_1800") {
    timeLabel = "平日 18:00";
  } else if (
    state.preset === "CUSTOM" &&
    el.customDateTime.value
  ) {
    timeLabel = new Intl.DateTimeFormat(
      "ja-JP",
      {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(
      new Date(el.customDateTime.value)
    );
  }

  const routeOptions = [];

  if (el.avoidTolls.checked) {
    routeOptions.push("有料道路回避");
  }

  if (el.avoidHighways.checked) {
    routeOptions.push("高速回避");
  }

  if (el.avoidFerries.checked) {
    routeOptions.push("フェリー回避");
  }

  return [
    state.destination.label,
    timeLabel,
    routeOptions.length
      ? routeOptions.join("・")
      : "標準ルート"
  ].join(" / ");
}

function genericOriginLabel(label) {
  return [
    "地図で選択した出発地",
    "ピンを移動した出発地",
    "現在地"
  ].includes(label);
}

function suggestedCandidateName() {
  if (
    state.originLabel &&
    !genericOriginLabel(state.originLabel)
  ) {
    return state.originLabel;
  }

  return `候補${state.candidates.length + 1}`;
}

function updateCandidateAddButton() {
  const driving = currentDrivingResult();

  el.addCandidateButton.classList.toggle(
    "hidden",
    !driving || !state.origin
  );
}

function trafficAdjustmentMinutes(candidate) {
  if (
    !Number.isFinite(candidate.durationMillis) ||
    !Number.isFinite(candidate.staticDurationMillis)
  ) {
    return null;
  }

  return Math.round(
    (
      candidate.durationMillis -
      candidate.staticDurationMillis
    ) / 60000
  );
}

function trafficAdjustmentLabel(minutes) {
  if (!Number.isFinite(minutes)) {
    return "—";
  }

  if (minutes > 0) {
    return `+${minutes}分`;
  }

  if (minutes < 0) {
    return `${minutes}分`;
  }

  return "±0分";
}

function renderCandidates() {
  const sorted = [...state.candidates].sort(
    (a, b) =>
      a.durationMillis -
      b.durationMillis
  );

  el.candidateList.replaceChildren();

  el.candidateCount.textContent =
    `${sorted.length}件`;

  updateTimeCompareControls();

  el.candidateEmpty.classList.toggle(
    "hidden",
    sorted.length > 0
  );

  el.clearCandidatesButton.classList.toggle(
    "hidden",
    sorted.length === 0
  );

  const signatures = new Set(
    sorted.map(
      (candidate) =>
        candidate.conditionSignature
    )
  );

  if (signatures.size > 1) {
    el.candidateConditionNotice.textContent =
      "検索条件が異なる候補が含まれています。時刻・目的地・回避設定を確認して比較してください。";

    el.candidateConditionNotice.classList.remove(
      "hidden"
    );
  } else {
    el.candidateConditionNotice.classList.add(
      "hidden"
    );
  }

  sorted.forEach(
    (candidate, index) => {
      const card =
        document.createElement("article");

      card.className =
        `candidate-card${index === 0 ? " best" : ""}`;

      const increase =
        trafficAdjustmentMinutes(candidate);

      card.innerHTML = `
        <div class="candidate-card-top">
          <div class="candidate-card-title-wrap">
            <span class="candidate-rank">${index + 1}</span>
            ${
              index === 0
                ? '<span class="candidate-best-label">最短</span>'
                : ""
            }
            <p class="candidate-name"></p>
          </div>
        </div>

        <div class="candidate-duration">
          ${candidateDurationText(candidate.durationMillis)}
        </div>

        <div class="candidate-metrics">
          <div class="candidate-metric">
            距離<br>
            <strong>${distanceText(candidate.distanceMeters)}</strong>
          </div>

          <div class="candidate-metric">
            交通状況補正<br>
            <strong>
              ${trafficAdjustmentLabel(increase)}
            </strong>
          </div>
        </div>

        <p class="candidate-condition"></p>

        <div class="candidate-actions">
          <button
            class="candidate-use-button"
            type="button">
            この地点を使う
          </button>

          <button
            class="candidate-transit-button"
            type="button">
            公共交通を見る
          </button>

          <button
            class="candidate-delete-button"
            type="button">
            削除
          </button>
        </div>
      `;

      card
        .querySelector(".candidate-name")
        .textContent =
          candidate.name;

      card
        .querySelector(".candidate-condition")
        .textContent =
          `${candidate.conditionLabel} / 検索 ${candidate.departureLabel}`;

      card
        .querySelector(".candidate-use-button")
        .addEventListener(
          "click",
          () => {
            setOrigin(
              candidate.origin,
              candidate.name,
              {
                clearAutocomplete: true
              }
            );

            setMapSelectionTarget(
              "ORIGIN"
            );

            setStatus(
              `「${candidate.name}」を出発地に設定しました。必要ならもう一度検索してください。`
            );
          }
        );

      card
        .querySelector(".candidate-transit-button")
        .addEventListener(
          "click",
          () => {
            const destination =
              candidate.destination?.location ||
              state.destination.location;

            openGoogleMapsDirections(
              candidate.origin,
              destination,
              "transit"
            );
          }
        );

      card
        .querySelector(".candidate-delete-button")
        .addEventListener(
          "click",
          () => {
            state.candidates =
              state.candidates.filter(
                (item) =>
                  item.id !== candidate.id
              );

            persistCandidates();
            clearTimeComparison();
            renderCandidates();
          }
        );

      el.candidateList.appendChild(
        card
      );
    }
  );
}

function openCandidateDialog() {
  const driving =
    currentDrivingResult();

  if (!driving || !state.origin) {
    return;
  }

  if (
    state.candidates.length >=
    MAX_CANDIDATES
  ) {
    setStatus(
      `候補は最大${MAX_CANDIDATES}件までです。不要な候補を削除してください。`,
      "error"
    );

    return;
  }

  state.pendingCandidate = {
    driving,
    conditionSignature:
      currentConditionSignature(),
    conditionLabel:
      currentConditionLabel()
  };

  el.candidateNameInput.value =
    suggestedCandidateName();

  el.candidateDialogSummary.textContent =
    `${candidateDurationText(driving.route.durationMillis)} / ` +
    `${distanceText(driving.route.distanceMeters)} / ` +
    `${state.destination.label}まで`;

  el.candidateDialog.showModal();

  requestAnimationFrame(() => {
    el.candidateNameInput.focus();
    el.candidateNameInput.select();
  });
}

function closeCandidateDialog() {
  state.pendingCandidate = null;

  if (el.candidateDialog.open) {
    el.candidateDialog.close();
  }
}

function savePendingCandidate() {
  if (
    !state.pendingCandidate ||
    !state.origin
  ) {
    return;
  }

  const name =
    el.candidateNameInput.value.trim();

  if (!name) {
    el.candidateNameInput.focus();
    return;
  }

  const {
    driving,
    conditionSignature,
    conditionLabel
  } = state.pendingCandidate;

  const candidate = {
    id:
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,

    name,

    origin: {
      lat: state.origin.lat,
      lng: state.origin.lng
    },

    destination: {
      label: state.destination.label,
      location: {
        lat: state.destination.location.lat,
        lng: state.destination.location.lng
      }
    },

    durationMillis:
      driving.route.durationMillis,

    staticDurationMillis:
      driving.route.staticDurationMillis,

    distanceMeters:
      driving.route.distanceMeters,

    departureTime:
      driving.departureTime.toISOString(),

    departureLabel:
      candidateDepartureLabel(
        driving.departureTime
      ),

    conditionSignature,
    conditionLabel,

    createdAt:
      new Date().toISOString()
  };

  const duplicateIndex =
    state.candidates.findIndex(
      (existing) =>
        Math.abs(
          existing.origin.lat -
          candidate.origin.lat
        ) < 0.00001 &&
        Math.abs(
          existing.origin.lng -
          candidate.origin.lng
        ) < 0.00001 &&
        existing.conditionSignature ===
        candidate.conditionSignature
    );

  if (duplicateIndex >= 0) {
    candidate.id =
      state.candidates[
        duplicateIndex
      ].id;

    state.candidates[
      duplicateIndex
    ] = candidate;
  } else {
    state.candidates.push(
      candidate
    );
  }

  persistCandidates();
  clearTimeComparison();
  renderCandidates();
  closeCandidateDialog();

  setStatus(
    `「${name}」を候補に追加しました。`
  );
}



/* =========================================================
   Time comparison - v1.2
========================================================= */

const TIME_COMPARISON_STORAGE_KEY =
  "commuteSimulatorTimeComparisonV1_2_1";

const TIME_SLOT_SETTINGS_KEY =
  "commuteSimulatorTimeSlotsV1_2_1";

const DEFAULT_TIME_SLOT_VALUES = [
  "07:30",
  "08:00",
  "18:00"
];

let activeTimeSlots = [];

function normalizeTimeValue(value) {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      String(value || "")
    );

  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

function slotFromValue(value) {
  const normalized =
    normalizeTimeValue(value);

  if (!normalized) {
    return null;
  }

  const [hour, minute] =
    normalized
      .split(":")
      .map(Number);

  return {
    key:
      normalized.replace(":", ""),

    value:
      normalized,

    label:
      `${hour}:${String(minute).padStart(2, "0")}`,

    hour,
    minute
  };
}

function sortActiveTimeSlots() {
  activeTimeSlots.sort(
    (a, b) =>
      (
        a.hour * 60 +
        a.minute
      ) -
      (
        b.hour * 60 +
        b.minute
      )
  );
}

function selectedTimeSlots() {
  return [...activeTimeSlots];
}

function loadTimeSlotSettings() {
  const raw =
    safeSessionStorageGet(
      TIME_SLOT_SETTINGS_KEY
    );

  if (!raw) {
    activeTimeSlots =
      DEFAULT_TIME_SLOT_VALUES
        .map(slotFromValue);
    return;
  }

  try {
    const parsed =
      JSON.parse(raw);

    const slots =
      Array.isArray(parsed)
        ? parsed
            .map(slotFromValue)
            .filter(Boolean)
        : [];

    const uniqueSlots =
      slots.filter(
        (slot, index, array) =>
          array.findIndex(
            (item) =>
              item.value === slot.value
          ) === index
      );

    activeTimeSlots =
      uniqueSlots.length
        ? uniqueSlots.slice(0, 3)
        : DEFAULT_TIME_SLOT_VALUES
            .map(slotFromValue);

    sortActiveTimeSlots();
  } catch {
    activeTimeSlots =
      DEFAULT_TIME_SLOT_VALUES
        .map(slotFromValue);
  }
}

function persistTimeSlotSettings() {
  safeSessionStorageSet(
    TIME_SLOT_SETTINGS_KEY,
    JSON.stringify(
      activeTimeSlots.map(
        (slot) => slot.value
      )
    )
  );
}

function setTimeCompareStatus(
  message,
  isError = false
) {
  el.timeCompareStatus.textContent =
    message;

  el.timeCompareStatus.classList.remove(
    "hidden"
  );

  el.timeCompareStatus.classList.toggle(
    "error",
    isError
  );
}

function renderTimeSlotSettings() {
  el.timeSlotInputs.replaceChildren();

  activeTimeSlots.forEach(
    (slot, index) => {
      const row =
        document.createElement("div");

      row.className =
        "time-slot-row";

      const number =
        document.createElement("span");

      number.className =
        "time-slot-number";

      number.textContent =
        `${index + 1}`;

      const input =
        document.createElement("input");

      input.type = "time";
      input.className =
        "time-slot-input";
      input.value = slot.value;
      input.step = 300;

      input.setAttribute(
        "aria-label",
        `比較時刻${index + 1}`
      );

      input.addEventListener(
        "change",
        () => {
          const normalized =
            normalizeTimeValue(
              input.value
            );

          if (!normalized) {
            input.value =
              activeTimeSlots[index].value;
            return;
          }

          const duplicate =
            activeTimeSlots.some(
              (item, itemIndex) =>
                itemIndex !== index &&
                item.value === normalized
            );

          if (duplicate) {
            input.value =
              activeTimeSlots[index].value;

            setTimeCompareStatus(
              "同じ時刻は複数登録できません。",
              true
            );

            return;
          }

          activeTimeSlots[index] =
            slotFromValue(
              normalized
            );

          sortActiveTimeSlots();
          persistTimeSlotSettings();

          clearTimeComparison();
          renderTimeSlotSettings();
          updateTimeCompareControls();

          setTimeCompareStatus(
            "比較時刻を変更しました。時間帯比較を再実行してください。"
          );
        }
      );

      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.className =
        "time-slot-remove-button";

      removeButton.textContent =
        "削除";

      removeButton.disabled =
        activeTimeSlots.length <= 1;

      removeButton.addEventListener(
        "click",
        () => {
          if (
            activeTimeSlots.length <= 1
          ) {
            return;
          }

          activeTimeSlots.splice(
            index,
            1
          );

          persistTimeSlotSettings();

          clearTimeComparison();
          renderTimeSlotSettings();
          updateTimeCompareControls();

          setTimeCompareStatus(
            "比較時刻を削除しました。"
          );
        }
      );

      row.append(
        number,
        input,
        removeButton
      );

      el.timeSlotInputs.appendChild(
        row
      );
    }
  );

  el.addTimeSlotButton.disabled =
    activeTimeSlots.length >= 3;
}

function resetTimeSlots() {
  activeTimeSlots =
    DEFAULT_TIME_SLOT_VALUES
      .map(slotFromValue);

  persistTimeSlotSettings();

  clearTimeComparison();
  renderTimeSlotSettings();
  updateTimeCompareControls();

  setTimeCompareStatus(
    "比較時刻を 7:30 / 8:00 / 18:00 に戻しました。"
  );
}

function nextWeekdayForBatch() {
  const result = new Date();
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() + 1);

  while (
    result.getDay() === 0 ||
    result.getDay() === 6
  ) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

function departureForBatch(baseDate, slot) {
  const result = new Date(baseDate);

  result.setHours(
    slot.hour,
    slot.minute,
    0,
    0
  );

  return result;
}

function formatBatchDate(date) {
  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }
  ).format(date);
}

function batchConditionSignature(baseDate) {
  return JSON.stringify({
    candidateOrigins: state.candidates
      .map((candidate) => ({
        id: candidate.id,
        lat: Number(candidate.origin.lat).toFixed(5),
        lng: Number(candidate.origin.lng).toFixed(5)
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),

    destination: {
      lat: Number(state.destination.location.lat).toFixed(5),
      lng: Number(state.destination.location.lng).toFixed(5),
      label: state.destination.label
    },

    date: baseDate.toISOString().slice(0, 10),

    timeSlots:
      selectedTimeSlots().map(
        (slot) => slot.value
      ),

    avoidTolls: el.avoidTolls.checked,
    avoidHighways: el.avoidHighways.checked,
    avoidFerries: el.avoidFerries.checked
  });
}

function batchConditionLabel(baseDate) {
  const routeOptions = [];

  if (el.avoidTolls.checked) {
    routeOptions.push("有料道路回避");
  }

  if (el.avoidHighways.checked) {
    routeOptions.push("高速回避");
  }

  if (el.avoidFerries.checked) {
    routeOptions.push("フェリー回避");
  }

  return [
    `${state.destination.label}まで`,
    formatBatchDate(baseDate),
    routeOptions.length
      ? routeOptions.join("・")
      : "標準ルート"
  ].join(" / ");
}

function loadTimeComparison() {
  const raw =
    safeSessionStorageGet(
      TIME_COMPARISON_STORAGE_KEY
    );

  if (!raw) {
    state.timeComparison = null;
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    state.timeComparison =
      parsed &&
      Array.isArray(parsed.rows)
        ? parsed
        : null;
  } catch {
    state.timeComparison = null;
  }
}

function persistTimeComparison() {
  if (!state.timeComparison) {
    try {
      sessionStorage.removeItem(
        TIME_COMPARISON_STORAGE_KEY
      );
    } catch {
      // no-op
    }

    return;
  }

  safeSessionStorageSet(
    TIME_COMPARISON_STORAGE_KEY,
    JSON.stringify(
      state.timeComparison
    )
  );
}

function clearTimeComparison() {
  state.timeComparison = null;
  persistTimeComparison();
  renderTimeComparison();
}

function updateTimeCompareControls() {
  const count = state.candidates.length;

  el.timeCompareEmpty.classList.toggle(
    "hidden",
    count > 0
  );

  el.timeCompareControls.classList.toggle(
    "hidden",
    count === 0
  );

  if (count > 0) {
    const slots =
      selectedTimeSlots();

    const maxRequests =
      count * slots.length;

    const labels =
      slots
        .map(
          (slot) => slot.label
        )
        .join(" / ");

    el.timeCompareApiEstimate.textContent =
      `比較時刻 ${labels}｜候補${count}件 × ${slots.length}時間帯 = 最大${maxRequests}回の経路計算。候補追加や表を見るだけではAPIを呼びません。`;

    el.runTimeCompareButton.textContent =
      `${slots.length}時間帯を一括比較（最大${maxRequests}回）`;
  }
}

function comparisonMinutes(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(
    1,
    Math.round(value / 60000)
  );
}

function average(values) {
  const valid =
    values.filter(Number.isFinite);

  if (!valid.length) {
    return null;
  }

  return valid.reduce(
    (sum, value) => sum + value,
    0
  ) / valid.length;
}

function calculateRowStats(row) {
  const values = selectedTimeSlots()
    .map(
      (slot) =>
        row.times[slot.key]?.durationMillis
    )
    .filter(Number.isFinite);

  if (!values.length) {
    return {
      averageMillis: null,
      maxMillis: null,
      minMillis: null,
      spreadMillis: null
    };
  }

  const averageMillis =
    average(values);

  const maxMillis =
    Math.max(...values);

  const minMillis =
    Math.min(...values);

  return {
    averageMillis,
    maxMillis,
    minMillis,
    spreadMillis:
      maxMillis - minMillis
  };
}

function renderTimeComparison() {
  updateTimeCompareControls();

  const comparison =
    state.timeComparison;

  if (!comparison?.rows?.length) {
    el.timeCompareDate.textContent =
      "未実行";

    el.timeCompareResult.classList.add(
      "hidden"
    );

    el.timeCompareHeadRow.replaceChildren();

    const candidateHead =
      document.createElement("th");

    candidateHead.textContent =
      "候補";

    el.timeCompareHeadRow.appendChild(
      candidateHead
    );

    selectedTimeSlots().forEach(
      (slot) => {
        const th =
          document.createElement("th");

        th.textContent =
          slot.label;

        el.timeCompareHeadRow.appendChild(
          th
        );
      }
    );

    ["平均", "最大", "ブレ"].forEach(
      (label) => {
        const th =
          document.createElement("th");

        th.textContent =
          label;

        el.timeCompareHeadRow.appendChild(
          th
        );
      }
    );

    el.timeCompareBody.replaceChildren();
    el.timeCompareSummary.textContent = "";
    return;
  }

  el.timeCompareResult.classList.remove(
    "hidden"
  );

  const baseDate =
    new Date(
      `${comparison.date}T12:00:00`
    );

  el.timeCompareDate.textContent =
    formatBatchDate(baseDate);

  const rows =
    comparison.rows.map((row) => ({
      ...row,
      stats:
        calculateRowStats(row)
    }));

  rows.sort((a, b) => {
    const aValue =
      a.stats.averageMillis ??
      Infinity;

    const bValue =
      b.stats.averageMillis ??
      Infinity;

    return aValue - bValue;
  });

  const finiteAverages =
    rows
      .map(
        (row) =>
          row.stats.averageMillis
      )
      .filter(Number.isFinite);

  const bestAverage =
    finiteAverages.length
      ? Math.min(...finiteAverages)
      : null;

  const bestPerSlot = {};

  selectedTimeSlots().forEach((slot) => {
    const values =
      rows
        .map(
          (row) =>
            row.times[slot.key]
              ?.durationMillis
        )
        .filter(Number.isFinite);

    bestPerSlot[slot.key] =
      values.length
        ? Math.min(...values)
        : null;
  });

  el.timeCompareHeadRow.replaceChildren();

  const candidateHead =
    document.createElement("th");

  candidateHead.textContent =
    "候補";

  el.timeCompareHeadRow.appendChild(
    candidateHead
  );

  selectedTimeSlots().forEach(
    (slot) => {
      const th =
        document.createElement("th");

      th.textContent =
        slot.label;

      el.timeCompareHeadRow.appendChild(
        th
      );
    }
  );

  ["平均", "最大", "ブレ"].forEach(
    (label) => {
      const th =
        document.createElement("th");

      th.textContent =
        label;

      el.timeCompareHeadRow.appendChild(
        th
      );
    }
  );

  el.timeCompareBody.replaceChildren();

  rows.forEach((row) => {
    const tr =
      document.createElement("tr");

    if (
      Number.isFinite(bestAverage) &&
      row.stats.averageMillis ===
        bestAverage
    ) {
      tr.classList.add("best-row");
    }

    const nameCell =
      document.createElement("td");

    const nameSpan =
      document.createElement("span");

    nameSpan.className =
      "time-compare-name";

    nameSpan.textContent =
      row.name;

    nameCell.appendChild(nameSpan);
    tr.appendChild(nameCell);

    selectedTimeSlots().forEach((slot) => {
      const td =
        document.createElement("td");

      const result =
        row.times[slot.key];

      if (
        result &&
        Number.isFinite(
          result.durationMillis
        )
      ) {
        td.textContent =
          `${comparisonMinutes(
            result.durationMillis
          )}分`;

        if (
          bestPerSlot[slot.key] ===
          result.durationMillis
        ) {
          td.classList.add(
            "best-cell"
          );
        }
      } else {
        td.textContent = "取得失敗";
        td.classList.add(
          "failed-cell"
        );
      }

      tr.appendChild(td);
    });

    const averageCell =
      document.createElement("td");

    averageCell.textContent =
      Number.isFinite(
        row.stats.averageMillis
      )
        ? `${comparisonMinutes(
            row.stats.averageMillis
          )}分`
        : "—";

    if (
      Number.isFinite(bestAverage) &&
      row.stats.averageMillis ===
        bestAverage
    ) {
      averageCell.classList.add(
        "best-cell"
      );
    }

    tr.appendChild(averageCell);

    const maxCell =
      document.createElement("td");

    maxCell.textContent =
      Number.isFinite(
        row.stats.maxMillis
      )
        ? `${comparisonMinutes(
            row.stats.maxMillis
          )}分`
        : "—";

    tr.appendChild(maxCell);

    const spreadCell =
      document.createElement("td");

    spreadCell.textContent =
      Number.isFinite(
        row.stats.spreadMillis
      )
        ? `${Math.round(
            row.stats.spreadMillis /
            60000
          )}分`
        : "—";

    tr.appendChild(spreadCell);

    el.timeCompareBody.appendChild(tr);
  });

  const bestRow =
    rows.find(
      (row) =>
        Number.isFinite(bestAverage) &&
        row.stats.averageMillis ===
          bestAverage
    );

  if (bestRow) {
    el.timeCompareSummary.textContent =
      `平均所要時間が最短なのは「${bestRow.name}」で約${comparisonMinutes(bestRow.stats.averageMillis)}分。` +
      ` 最長時は約${comparisonMinutes(bestRow.stats.maxMillis)}分、選択した時間帯によるブレは約${Math.round(bestRow.stats.spreadMillis / 60000)}分です。`;
  } else {
    el.timeCompareSummary.textContent =
      "時間帯比較の結果を取得できませんでした。";
  }
}

async function computeCandidateTimeSlot(
  candidate,
  slot,
  baseDate
) {
  const departureTime =
    departureForBatch(
      baseDate,
      slot
    );

  const cacheParams = {
    origin:
      candidate.origin,

    destination:
      state.destination.location,

    mode:
      "DRIVING",

    departureTime,

    avoidTolls:
      el.avoidTolls.checked,

    avoidHighways:
      el.avoidHighways.checked,

    avoidFerries:
      el.avoidFerries.checked
  };

  const key =
    createCacheKey(
      cacheParams
    );

  const cached =
    getCachedResult(key);

  if (
    cached?.route &&
    Number.isFinite(
      cached.route.durationMillis
    )
  ) {
    return {
      durationMillis:
        cached.route.durationMillis,

      staticDurationMillis:
        cached.route.staticDurationMillis,

      distanceMeters:
        cached.route.distanceMeters,

      fromCache:
        true
    };
  }

  const request = {
    origin:
      candidate.origin,

    destination:
      state.destination.location,

    travelMode:
      "DRIVING",

    departureTime,

    routingPreference:
      "TRAFFIC_AWARE_OPTIMAL",

    routeModifiers: {
      avoidTolls:
        el.avoidTolls.checked,

      avoidHighways:
        el.avoidHighways.checked,

      avoidFerries:
        el.avoidFerries.checked
    },

    fields: [
      "durationMillis",
      "staticDurationMillis",
      "distanceMeters"
    ]
  };

  const { routes } =
    await state.Route.computeRoutes(
      request
    );

  if (!routes?.length) {
    throw new Error(
      "経路が見つかりませんでした。"
    );
  }

  const route =
    routes[0];

  storeCachedResult(
    key,
    {
      mode: "DRIVING",
      route,
      departureTime,
      fromCache: false
    }
  );

  return {
    durationMillis:
      route.durationMillis,

    staticDurationMillis:
      route.staticDurationMillis,

    distanceMeters:
      route.distanceMeters,

    fromCache:
      false
  };
}

async function runWithConcurrency(
  jobs,
  concurrency = 4
) {
  const results =
    new Array(jobs.length);

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index =
        nextIndex++;

      if (index >= jobs.length) {
        return;
      }

      try {
        results[index] = {
          status: "fulfilled",
          value:
            await jobs[index]()
        };
      } catch (error) {
        results[index] = {
          status: "rejected",
          reason: error
        };
      }
    }
  }

  const workers =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            jobs.length
          )
      },
      () => worker()
    );

  await Promise.all(workers);

  return results;
}

async function runTimeComparison() {
  if (!state.candidates.length) {
    return;
  }

  const baseDate =
    nextWeekdayForBatch();

  const signature =
    batchConditionSignature(
      baseDate
    );

  const slots =
    selectedTimeSlots();

  const maxRequests =
    state.candidates.length *
    slots.length;

  el.runTimeCompareButton.disabled =
    true;

  el.timeCompareStatus.classList.remove(
    "hidden",
    "error"
  );

  el.timeCompareStatus.textContent =
    `時間帯比較を実行中… ${slots.length}時間帯・最大${maxRequests}回の経路計算です。`;

  const rows =
    state.candidates.map(
      (candidate) => ({
        id: candidate.id,
        name: candidate.name,
        origin: candidate.origin,
        times: {}
      })
    );

  const jobs = [];

  rows.forEach((row) => {
    slots.forEach((slot) => {
      jobs.push({
        row,
        slot,
        run: () =>
          computeCandidateTimeSlot(
            row,
            slot,
            baseDate
          )
      });
    });
  });

  let completed = 0;

  const wrappedJobs =
    jobs.map((job) => async () => {
      try {
        return await job.run();
      } finally {
        completed += 1;

        el.timeCompareStatus.textContent =
          `時間帯比較を実行中… ${completed}/${jobs.length}`;
      }
    });

  try {
    const settled =
      await runWithConcurrency(
        wrappedJobs,
        4
      );

    settled.forEach(
      (result, index) => {
        const job =
          jobs[index];

        if (
          result.status ===
          "fulfilled"
        ) {
          job.row.times[
            job.slot.key
          ] = result.value;
        } else {
          job.row.times[
            job.slot.key
          ] = {
            error:
              result.reason?.message ||
              "取得失敗"
          };
        }
      }
    );

    state.timeComparison = {
      version: 1,

      date:
        baseDate
          .toISOString()
          .slice(0, 10),

      createdAt:
        new Date().toISOString(),

      conditionSignature:
        signature,

      conditionLabel:
        batchConditionLabel(
          baseDate
        ),

      rows
    };

    persistTimeComparison();
    renderTimeComparison();

    const failedCount =
      rows.reduce(
        (sum, row) =>
          sum +
          slots.filter(
            (slot) =>
              !Number.isFinite(
                row.times[slot.key]
                  ?.durationMillis
              )
          ).length,
        0
      );

    if (failedCount) {
      el.timeCompareStatus.classList.add(
        "error"
      );

      el.timeCompareStatus.textContent =
        `比較は完了しましたが、${failedCount}件の経路を取得できませんでした。`;
    } else {
      el.timeCompareStatus.classList.remove(
        "error"
      );

      el.timeCompareStatus.textContent =
        `比較完了：${batchConditionLabel(baseDate)}`;
    }
  } catch (error) {
    console.error(error);

    el.timeCompareStatus.classList.add(
      "error"
    );

    el.timeCompareStatus.textContent =
      error.message ||
      "時間帯比較に失敗しました。";
  } finally {
    el.runTimeCompareButton.disabled =
      false;
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
    const adjustment = Math.round(
      (
        (route.durationMillis || 0) -
        route.staticDurationMillis
      ) / 60000
    );

    const note = document.createElement("p");
    note.className = "result-note";
    note.textContent =
      `交通状況による補正：${trafficAdjustmentLabel(adjustment)}`;

    const help = document.createElement("p");
    help.className = "traffic-adjustment-help";
    help.textContent =
      "交通状況を考慮した所要時間 − 同じルートを交通状況なしで走る所要時間";

    card.append(
      note,
      help
    );
  }

  if (mode === "TRANSIT") {
    const note = document.createElement("p");
    note.className = "result-note";
    note.textContent = "公共交通のAPI結果です。取得できない場合は専用の「公共交通をGoogleマップで見る」からGoogle Maps本体を確認できます。";
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
    updateCandidateAddButton();

    const routeToDraw = results.reduce((best, item) => {
      if (!best) return item;
      return (item.route.durationMillis || Infinity) < (best.route.durationMillis || Infinity) ? item : best;
    }, null);

    drawRoute(routeToDraw.route);
    el.resultTime.textContent = formatDateTime(results[0].departureTime);
    el.openGoogleMapsButton.classList.remove("hidden");

    el.openTransitMapsButton.classList.remove(
      "hidden"
    );

    el.transitMapNote.classList.remove(
      "hidden"
    );

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

function googleMapsDirectionsUrl(
  origin,
  destination,
  travelMode
) {
  const params =
    new URLSearchParams({
      api: "1",

      origin:
        `${origin.lat},${origin.lng}`,

      destination:
        `${destination.lat},${destination.lng}`,

      travelmode:
        travelMode
    });

  return (
    `https://www.google.com/maps/dir/?${params.toString()}`
  );
}

function openGoogleMapsDirections(
  origin,
  destination,
  travelMode
) {
  window.open(
    googleMapsDirectionsUrl(
      origin,
      destination,
      travelMode
    ),
    "_blank",
    "noopener"
  );
}

function openGoogleMaps() {
  if (!state.origin) {
    return;
  }

  const travelMode =
    selectedMode() === "TRANSIT"
      ? "transit"
      : "driving";

  openGoogleMapsDirections(
    state.origin,
    state.destination.location,
    travelMode
  );
}

function openTransitGoogleMaps() {
  if (!state.origin) {
    setStatus(
      "出発地を設定してください。",
      "error"
    );

    return;
  }

  openGoogleMapsDirections(
    state.origin,
    state.destination.location,
    "transit"
  );
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

  el.openTransitMapsButton.classList.add(
    "hidden"
  );

  el.transitMapNote.classList.add(
    "hidden"
  );

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

  el.openTransitMapsButton.addEventListener(
    "click",
    openTransitGoogleMaps
  );

  el.addCandidateButton.addEventListener(
    "click",
    openCandidateDialog
  );

  el.candidateForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      savePendingCandidate();
    }
  );

  el.candidateCancelButton.addEventListener(
    "click",
    closeCandidateDialog
  );

  el.candidateDialogClose.addEventListener(
    "click",
    closeCandidateDialog
  );

  el.candidateDialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      closeCandidateDialog();
    }
  );

  el.clearCandidatesButton.addEventListener(
    "click",
    () => {
      if (
        !confirm(
          "このタブ内の候補をすべて削除しますか？"
        )
      ) {
        return;
      }

      state.candidates = [];
      persistCandidates();
      clearTimeComparison();
      renderCandidates();

      setStatus(
        "候補をすべて削除しました。"
      );
    }
  );

  el.addTimeSlotButton.addEventListener(
    "click",
    () => {
      if (
        activeTimeSlots.length >= 3
      ) {
        return;
      }

      const commonTimes = [
        "07:00",
        "07:30",
        "08:00",
        "08:30",
        "09:00",
        "17:30",
        "18:00",
        "18:30",
        "19:00"
      ];

      const nextValue =
        commonTimes.find(
          (value) =>
            !activeTimeSlots.some(
              (slot) =>
                slot.value === value
            )
        ) || "12:00";

      activeTimeSlots.push(
        slotFromValue(
          nextValue
        )
      );

      sortActiveTimeSlots();
      persistTimeSlotSettings();

      clearTimeComparison();
      renderTimeSlotSettings();
      updateTimeCompareControls();

      setTimeCompareStatus(
        "比較時刻を追加しました。時刻欄から自由に変更できます。"
      );
    }
  );

  el.resetTimeSlotsButton.addEventListener(
    "click",
    resetTimeSlots
  );

  el.runTimeCompareButton.addEventListener(
    "click",
    runTimeComparison
  );

  el.clearTimeCompareButton.addEventListener(
    "click",
    () => {
      clearTimeComparison();

      el.timeCompareStatus.classList.add(
        "hidden"
      );
    }
  );

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
    loadTimeSlotSettings();
    loadTimeComparison();

    renderTimeSlotSettings();
    renderCandidates();
    renderTimeComparison();

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
