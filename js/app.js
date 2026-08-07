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
  originAddress: "",
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
  editingProfileCandidateId: null,
  editingStationAccesses: [],
  editingStationAccessSelection: "manual",
  suumoOcrBusy: false,
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

  scoreCandidateCount: document.getElementById("scoreCandidateCount"),
  scoreSettings: document.getElementById("scoreSettings"),
  scoreWeightCommute: document.getElementById("scoreWeightCommute"),
  scoreWeightHousing: document.getElementById("scoreWeightHousing"),
  scoreWeightArea: document.getElementById("scoreWeightArea"),
  scoreWeightAge: document.getElementById("scoreWeightAge"),
  scoreWeightWalk: document.getElementById("scoreWeightWalk"),
  scoreWeightNearby: document.getElementById("scoreWeightNearby"),
  scoreWeightTotal: document.getElementById("scoreWeightTotal"),
  resetScoreWeightsButton: document.getElementById("resetScoreWeightsButton"),
  scoreNotice: document.getElementById("scoreNotice"),
  scoreResultList: document.getElementById("scoreResultList"),
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

  candidateProfileDialog: document.getElementById("candidateProfileDialog"),
  candidateProfileForm: document.getElementById("candidateProfileForm"),
  candidateProfileDialogClose: document.getElementById("candidateProfileDialogClose"),
  candidateProfileCancelButton: document.getElementById("candidateProfileCancelButton"),
  clearCandidateProfileButton: document.getElementById("clearCandidateProfileButton"),
  profileCandidateName: document.getElementById("profileCandidateName"),
  profileRent: document.getElementById("profileRent"),
  profileManagementFee: document.getElementById("profileManagementFee"),
  profileArea: document.getElementById("profileArea"),
  profileLayout: document.getElementById("profileLayout"),
  profileBuildingAge: document.getElementById("profileBuildingAge"),
  profileStationWalk: document.getElementById("profileStationWalk"),
  profileParking: document.getElementById("profileParking"),
  profileMemo: document.getElementById("profileMemo"),
  profileCalculationPreview: document.getElementById("profileCalculationPreview"),

  suumoScreenshotButton: document.getElementById("suumoScreenshotButton"),
  suumoScreenshotInput: document.getElementById("suumoScreenshotInput"),
  suumoOcrStatus: document.getElementById("suumoOcrStatus"),
  suumoOcrStatusText: document.getElementById("suumoOcrStatusText"),
  suumoOcrPercent: document.getElementById("suumoOcrPercent"),
  suumoOcrProgress: document.getElementById("suumoOcrProgress"),
  suumoOcrSummary: document.getElementById("suumoOcrSummary"),
  profileStationAccessSection: document.getElementById("profileStationAccessSection"),
  profileStationAccessList: document.getElementById("profileStationAccessList"),

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

  expandTimeCompareButton: document.getElementById("expandTimeCompareButton"),
  timeCompareDialog: document.getElementById("timeCompareDialog"),
  closeTimeCompareDialogButton: document.getElementById("closeTimeCompareDialogButton"),
  expandedTimeCompareDate: document.getElementById("expandedTimeCompareDate"),
  expandedTimeCompareCondition: document.getElementById("expandedTimeCompareCondition"),
  expandedTimeCompareHeadRow: document.getElementById("expandedTimeCompareHeadRow"),
  expandedTimeCompareBody: document.getElementById("expandedTimeCompareBody"),
  expandedTimeCompareSummary: document.getElementById("expandedTimeCompareSummary"),

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
    state.originAddress = "";
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
  state.originAddress =
    typeof options.address ===
      "string"
      ? options.address.trim()
      : "";

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

    state.candidates =
      Array.isArray(parsed)
        ? parsed.map(
            (candidate) => ({
              ...candidate,

              originLabel:
                typeof candidate.originLabel === "string"
                  ? candidate.originLabel
                  : candidate.name || "",

              originAddress:
                typeof candidate.originAddress === "string"
                  ? candidate.originAddress
                  : "",

              profile:
                normalizeCandidateProfile(
                  candidate.profile
                ),

              nearby:
                normalizeNearbyData(
                  candidate.nearby
                ),

              nearbyError:
                ""
            })
          )
        : [];
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



const NEARBY_SEARCH_RADIUS_METERS = 1500;
const NEARBY_SEARCH_MAX_RESULTS = 20;

const NEARBY_FACILITY_CATEGORIES = [
  {
    key: "supermarket",
    label: "スーパー",
    types: [
      "supermarket",
      "discount_supermarket",
      "hypermarket"
    ]
  },
  {
    key: "convenience",
    label: "コンビニ",
    types: [
      "convenience_store"
    ]
  },
  {
    key: "drugstore",
    label: "ドラッグストア",
    types: [
      "drugstore",
      "pharmacy"
    ]
  },
  {
    key: "gym",
    label: "ジム",
    types: [
      "gym",
      "fitness_center",
      "sports_club"
    ]
  },
  {
    key: "railStation",
    label: "電車・地下鉄駅",
    types: [
      "train_station",
      "subway_station",
      "light_rail_station"
    ]
  },
  {
    key: "busStop",
    label: "バス停",
    types: [
      "bus_stop",
      "bus_station"
    ]
  }
];

const NEARBY_SEARCH_GROUPS = [
  {
    key: "life",
    label: "生活施設",
    categoryKeys: [
      "supermarket",
      "convenience",
      "drugstore",
      "gym"
    ]
  },
  {
    key: "rail",
    label: "電車・地下鉄駅",
    categoryKeys: [
      "railStation"
    ]
  },
  {
    key: "bus",
    label: "バス停",
    categoryKeys: [
      "busStop"
    ]
  }
];

function nearbyCategoriesForGroup(group) {
  return NEARBY_FACILITY_CATEGORIES.filter(
    (category) =>
      group.categoryKeys.includes(
        category.key
      )
  );
}

function nearbyIncludedTypesForGroup(group) {
  return [
    ...new Set(
      nearbyCategoriesForGroup(group)
        .flatMap(
          (category) =>
            category.types
        )
    )
  ];
}

function normalizeNearbyFacility(facility) {
  if (
    !facility ||
    typeof facility !== "object"
  ) {
    return null;
  }

  const lat =
    Number(
      facility.location?.lat
    );

  const lng =
    Number(
      facility.location?.lng
    );

  return {
    name:
      typeof facility.name === "string"
        ? facility.name
        : "",

    distanceMeters:
      Number.isFinite(
        Number(
          facility.distanceMeters
        )
      )
        ? Number(
            facility.distanceMeters
          )
        : null,

    googleMapsURI:
      typeof facility.googleMapsURI === "string"
        ? facility.googleMapsURI
        : "",

    location:
      Number.isFinite(lat) &&
      Number.isFinite(lng)
        ? { lat, lng }
        : null
  };
}

function normalizeNearbyData(nearby) {
  if (
    !nearby ||
    typeof nearby !== "object"
  ) {
    return null;
  }

  const facilities = {};

  NEARBY_FACILITY_CATEGORIES.forEach(
    (category) => {
      facilities[category.key] =
        normalizeNearbyFacility(
          nearby.facilities?.[
            category.key
          ]
        );
    }
  );

  return {
    version:
      Number.isFinite(
        Number(
          nearby.version
        )
      )
        ? Number(
            nearby.version
          )
        : 1,

    radiusMeters:
      Number.isFinite(
        Number(
          nearby.radiusMeters
        )
      )
        ? Number(
            nearby.radiusMeters
          )
        : NEARBY_SEARCH_RADIUS_METERS,

    searchGroups:
      Array.isArray(
        nearby.searchGroups
      )
        ? nearby.searchGroups.filter(
            (value) =>
              typeof value === "string"
          )
        : [],

    searchedAt:
      typeof nearby.searchedAt === "string"
        ? nearby.searchedAt
        : "",

    facilities
  };
}

function locationLiteral(location) {
  if (!location) {
    return null;
  }

  if (
    typeof location.toJSON ===
    "function"
  ) {
    return location.toJSON();
  }

  const lat =
    typeof location.lat ===
    "function"
      ? location.lat()
      : location.lat;

  const lng =
    typeof location.lng ===
    "function"
      ? location.lng()
      : location.lng;

  if (
    !Number.isFinite(
      Number(lat)
    ) ||
    !Number.isFinite(
      Number(lng)
    )
  ) {
    return null;
  }

  return {
    lat: Number(lat),
    lng: Number(lng)
  };
}

function haversineDistanceMeters(
  pointA,
  pointB
) {
  const toRadians =
    (degrees) =>
      degrees *
      Math.PI /
      180;

  const earthRadius =
    6371000;

  const lat1 =
    toRadians(
      pointA.lat
    );

  const lat2 =
    toRadians(
      pointB.lat
    );

  const deltaLat =
    toRadians(
      pointB.lat -
      pointA.lat
    );

  const deltaLng =
    toRadians(
      pointB.lng -
      pointA.lng
    );

  const a =
    Math.sin(
      deltaLat / 2
    ) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(
      deltaLng / 2
    ) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

function formatNearbyDistance(
  meters
) {
  if (
    !Number.isFinite(meters)
  ) {
    return "距離不明";
  }

  if (meters < 1000) {
    return `約${Math.round(
      meters / 10
    ) * 10}m（直線）`;
  }

  return `約${(
    meters / 1000
  ).toFixed(1)}km（直線）`;
}

function placeMatchesCategory(
  place,
  category
) {
  const types =
    Array.isArray(
      place.types
    )
      ? place.types
      : [];

  if (
    category.key ===
    "supermarket"
  ) {
    return category.types.includes(
      place.primaryType
    );
  }

  return category.types.some(
    (type) =>
      types.includes(type)
  );
}

function plainNearbyFacility(
  candidate,
  place
) {
  const location =
    locationLiteral(
      place.location
    );

  return {
    name:
      place.displayName ||
      "名称不明",

    distanceMeters:
      location
        ? Math.round(
            haversineDistanceMeters(
              candidate.origin,
              location
            )
          )
        : null,

    googleMapsURI:
      place.googleMapsURI ||
      "",

    location
  };
}

function fallbackFacilityMapsUrl(
  facility
) {
  if (
    facility.googleMapsURI
  ) {
    return facility.googleMapsURI;
  }

  if (facility.location) {
    const params =
      new URLSearchParams({
        api: "1",
        query:
          `${facility.location.lat},${facility.location.lng}`
      });

    return (
      `https://www.google.com/maps/search/?${params.toString()}`
    );
  }

  const params =
    new URLSearchParams({
      api: "1",
      query:
        facility.name
    });

  return (
    `https://www.google.com/maps/search/?${params.toString()}`
  );
}

function formatNearbySearchTime(
  isoString
) {
  if (!isoString) {
    return "";
  }

  const date =
    new Date(isoString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

async function searchNearbyFacilities(
  candidateId,
  button
) {
  const candidate =
    state.candidates.find(
      (item) =>
        item.id === candidateId
    );

  if (!candidate) {
    return;
  }

  const previousText =
    button.textContent;

  button.disabled = true;
  button.textContent =
    "周辺施設を検索中…";

  try {
    const {
      Place,
      SearchNearbyRankPreference
    } =
      await google.maps.importLibrary(
        "places"
      );

    const facilities = {};

    for (
      const group of
      NEARBY_SEARCH_GROUPS
    ) {
      const categories =
        nearbyCategoriesForGroup(
          group
        );

      const request = {
        fields: [
          "displayName",
          "location",
          "googleMapsURI",
          "types",
          "primaryType"
        ],

        locationRestriction: {
          center:
            candidate.origin,

          radius:
            NEARBY_SEARCH_RADIUS_METERS
        },

        includedTypes:
          nearbyIncludedTypesForGroup(
            group
          ),

        maxResultCount:
          NEARBY_SEARCH_MAX_RESULTS,

        rankPreference:
          SearchNearbyRankPreference.DISTANCE,

        language:
          "ja",

        region:
          "JP"
      };

      const { places } =
        await Place.searchNearby(
          request
        );

      const normalizedPlaces =
        (places || [])
          .map(
            (place) => ({
              place,
              facility:
                plainNearbyFacility(
                  candidate,
                  place
                )
            })
          )
          .filter(
            (item) =>
              item.facility.location
          )
          .sort(
            (a, b) =>
              (
                a.facility
                  .distanceMeters ??
                Infinity
              ) -
              (
                b.facility
                  .distanceMeters ??
                Infinity
              )
          );

      categories.forEach(
        (category) => {
          const match =
            normalizedPlaces.find(
              ({ place }) =>
                placeMatchesCategory(
                  place,
                  category
                )
            );

          facilities[
            category.key
          ] =
            match
              ? match.facility
              : null;
        }
      );
    }

    candidate.nearby = {
      version: 2,
      radiusMeters:
        NEARBY_SEARCH_RADIUS_METERS,
      searchGroups:
        NEARBY_SEARCH_GROUPS.map(
          (group) =>
            group.key
        ),
      searchedAt:
        new Date().toISOString(),
      facilities
    };

    candidate.nearbyError = "";

    persistCandidates();
    renderCandidates();

    setStatus(
      `「${candidate.name}」の周辺施設を取得しました。`
    );
  } catch (error) {
    console.error(error);

    candidate.nearbyError =
      error?.message ||
      "周辺施設の取得に失敗しました。";

    renderCandidates();

    setStatus(
      candidate.nearbyError,
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent =
      previousText;
  }
}


function nearbyDataIsCurrent(nearby) {
  return Boolean(
    nearby &&
    Number(nearby.radiusMeters) ===
      NEARBY_SEARCH_RADIUS_METERS &&
    Number(nearby.version) >= 2 &&
    Array.isArray(
      nearby.searchGroups
    ) &&
    nearby.searchGroups.includes(
      "life"
    ) &&
    nearby.searchGroups.includes(
      "rail"
    ) &&
    nearby.searchGroups.includes(
      "bus"
    )
  );
}

function renderCandidateNearbyPanel(
  candidate,
  details
) {
  const nearby =
    normalizeNearbyData(
      candidate.nearby
    );

  const status =
    details.querySelector(
      ".candidate-nearby-status"
    );

  const panel =
    details.querySelector(
      ".candidate-nearby-panel"
    );

  panel.replaceChildren();

  if (
    nearby &&
    !nearbyDataIsCurrent(
      nearby
    )
  ) {
    status.textContent =
      "要再検索";

    status.classList.remove(
      "filled"
    );

    const intro =
      document.createElement("p");

    intro.className =
      "nearby-search-intro";

    intro.textContent =
      `周辺検索を1.5km・3分割検索へ更新しました。旧${(
        nearby.radiusMeters /
        1000
      ).toFixed(1)}km / 旧検索方式の結果は総合スコアには使用しません。再検索してください。`;

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "nearby-search-button";

    button.textContent =
      "1.5kmで周辺施設を再検索（Places API 3回）";

    button.addEventListener(
      "click",
      () =>
        searchNearbyFacilities(
          candidate.id,
          button
        )
    );

    panel.append(
      intro,
      button
    );

    return;
  }

  if (!nearby) {
    status.textContent =
      "未検索";

    status.classList.remove(
      "filled"
    );

    if (
      candidate.nearbyError
    ) {
      const error =
        document.createElement(
          "p"
        );

      error.className =
        "nearby-error";

      error.textContent =
        candidate.nearbyError;

      panel.appendChild(error);
    }

    const intro =
      document.createElement("p");

    intro.className =
      "nearby-search-intro";

    intro.textContent =
      `候補地点から約${(
        NEARBY_SEARCH_RADIUS_METERS /
        1000
      ).toFixed(1)}km圏内のスーパー・コンビニ・ドラッグストア・ジム・電車・地下鉄駅・バス停を検索します。距離は直線距離です。`;

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "nearby-search-button";

    button.textContent =
      "周辺施設を検索（Places API 3回）";

    button.addEventListener(
      "click",
      () =>
        searchNearbyFacilities(
          candidate.id,
          button
        )
    );

    panel.append(
      intro,
      button
    );

    return;
  }

  status.textContent =
    "取得済み";

  status.classList.add(
    "filled"
  );

  const list =
    document.createElement(
      "div"
    );

  list.className =
    "nearby-result-list";

  NEARBY_FACILITY_CATEGORIES.forEach(
    (category) => {
      const facility =
        nearby.facilities[
          category.key
        ];

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "nearby-result-item";

      const categoryElement =
        document.createElement(
          "span"
        );

      categoryElement.className =
        "nearby-result-category";

      categoryElement.textContent =
        category.label;

      const main =
        document.createElement(
          "div"
        );

      main.className =
        "nearby-result-main";

      if (facility) {
        const name =
          document.createElement(
            "span"
          );

        name.className =
          "nearby-result-name";

        name.textContent =
          facility.name;

        const distance =
          document.createElement(
            "span"
          );

        distance.className =
          "nearby-result-distance";

        distance.textContent =
          formatNearbyDistance(
            facility.distanceMeters
          );

        main.append(
          name,
          distance
        );

        const mapButton =
          document.createElement(
            "button"
          );

        mapButton.type =
          "button";

        mapButton.className =
          "nearby-map-link";

        mapButton.textContent =
          "地図";

        mapButton.addEventListener(
          "click",
          () => {
            window.open(
              fallbackFacilityMapsUrl(
                facility
              ),
              "_blank",
              "noopener"
            );
          }
        );

        row.append(
          categoryElement,
          main,
          mapButton
        );
      } else {
        const missing =
          document.createElement(
            "span"
          );

        missing.className =
          "nearby-result-missing";

        missing.textContent =
          "今回の検索では見つからず";

        main.appendChild(
          missing
        );

        row.append(
          categoryElement,
          main
        );
      }

      list.appendChild(
        row
      );
    }
  );

  const meta =
    document.createElement("p");

  meta.className =
    "nearby-meta";

  const searchedAt =
    formatNearbySearchTime(
      nearby.searchedAt
    );

  meta.textContent =
    `${(
      nearby.radiusMeters /
      1000
    ).toFixed(1)}km圏内 / 直線距離${
      searchedAt
        ? ` / 取得 ${searchedAt}`
        : ""
    }`;

  const refreshButton =
    document.createElement(
      "button"
    );

  refreshButton.type =
    "button";

  refreshButton.className =
    "nearby-search-button";

  refreshButton.textContent =
    "周辺施設を再検索（Places API 3回）";

  refreshButton.addEventListener(
    "click",
    () =>
      searchNearbyFacilities(
        candidate.id,
        refreshButton
      )
  );

  panel.append(
    list,
    meta,
    refreshButton
  );
}


const TESSERACT_CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js",
  "https://unpkg.com/tesseract.js@7/dist/tesseract.min.js"
];

let tesseractLoadPromise = null;

function simpleIdPart(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠ー]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeStationAccess(access, index = 0) {
  if (
    !access ||
    typeof access !== "object"
  ) {
    return null;
  }

  const walkMinutes =
    Number(access.walkMinutes);

  if (
    !Number.isFinite(walkMinutes) ||
    walkMinutes < 0
  ) {
    return null;
  }

  const route =
    typeof access.route === "string"
      ? access.route.trim()
      : "";

  const station =
    typeof access.station === "string"
      ? access.station.trim()
      : "";

  if (!station) {
    return null;
  }

  const fallbackId =
    `access-${simpleIdPart(route)}-${simpleIdPart(station)}-${Math.round(walkMinutes)}-${index}`;

  return {
    id:
      typeof access.id === "string" &&
      access.id.trim()
        ? access.id.trim()
        : fallbackId,

    route,
    station,
    walkMinutes:
      Math.round(walkMinutes)
  };
}

function normalizeStationAccesses(accesses) {
  if (!Array.isArray(accesses)) {
    return [];
  }

  const normalized =
    accesses
      .map(normalizeStationAccess)
      .filter(Boolean);

  const seen = new Set();

  return normalized.filter(
    (access) => {
      const key =
        `${access.route}|${access.station}|${access.walkMinutes}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}

function shortestStationAccessId(accesses) {
  if (!accesses.length) {
    return "manual";
  }

  return [...accesses]
    .sort(
      (a, b) =>
        a.walkMinutes -
        b.walkMinutes
    )[0].id;
}

function selectedStationAccess(
  accesses,
  selection
) {
  if (selection === "manual") {
    return null;
  }

  return accesses.find(
    (access) =>
      access.id === selection
  ) || null;
}

function renderStationAccessOptions() {
  const accesses =
    normalizeStationAccesses(
      state.editingStationAccesses
    );

  state.editingStationAccesses =
    accesses;

  const show =
    accesses.length > 0;

  el.profileStationAccessSection.classList.toggle(
    "hidden",
    !show
  );

  el.profileStationAccessList.replaceChildren();

  if (!show) {
    state.editingStationAccessSelection =
      "manual";
    return;
  }

  const validSelection =
    state.editingStationAccessSelection === "manual" ||
    accesses.some(
      (access) =>
        access.id ===
        state.editingStationAccessSelection
    );

  if (!validSelection) {
    state.editingStationAccessSelection =
      shortestStationAccessId(
        accesses
      );
  }

  accesses.forEach(
    (access) => {
      const label =
        document.createElement("label");

      label.className =
        "station-access-option";

      const radio =
        document.createElement("input");

      radio.type = "radio";
      radio.name =
        "profileStationAccessSelection";
      radio.value =
        access.id;
      radio.checked =
        state.editingStationAccessSelection ===
        access.id;

      radio.addEventListener(
        "change",
        () => {
          if (!radio.checked) {
            return;
          }

          state.editingStationAccessSelection =
            access.id;

          el.profileStationWalk.value =
            access.walkMinutes;

          updateProfileCalculationPreview();
        }
      );

      const main =
        document.createElement("div");

      main.className =
        "station-access-main";

      const title =
        document.createElement("strong");

      title.textContent =
        access.route
          ? `${access.route}｜${access.station}`
          : access.station;

      const detail =
        document.createElement("span");

      detail.textContent =
        `徒歩${access.walkMinutes}分`;

      main.append(
        title,
        detail
      );

      label.append(
        radio,
        main
      );

      el.profileStationAccessList.appendChild(
        label
      );
    }
  );

  const manualLabel =
    document.createElement("label");

  manualLabel.className =
    "station-access-option";

  const manualRadio =
    document.createElement("input");

  manualRadio.type = "radio";
  manualRadio.name =
    "profileStationAccessSelection";
  manualRadio.value =
    "manual";
  manualRadio.checked =
    state.editingStationAccessSelection ===
    "manual";

  manualRadio.addEventListener(
    "change",
    () => {
      if (manualRadio.checked) {
        state.editingStationAccessSelection =
          "manual";
      }
    }
  );

  const manualMain =
    document.createElement("div");

  manualMain.className =
    "station-access-main";

  const manualTitle =
    document.createElement("strong");

  manualTitle.textContent =
    "手入力を使う";

  const manualDetail =
    document.createElement("span");

  manualDetail.textContent =
    "上の「駅徒歩」欄の値を総合スコアに使用";

  manualMain.append(
    manualTitle,
    manualDetail
  );

  manualLabel.append(
    manualRadio,
    manualMain
  );

  el.profileStationAccessList.appendChild(
    manualLabel
  );
}

function loadScript(src) {
  return new Promise(
    (resolve, reject) => {
      const existing =
        [...document.scripts].find(
          (script) =>
            script.src === src
        );

      if (existing) {
        if (window.Tesseract) {
          resolve();
          return;
        }

        existing.addEventListener(
          "load",
          resolve,
          { once: true }
        );

        existing.addEventListener(
          "error",
          reject,
          { once: true }
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src = src;
      script.async = true;

      script.addEventListener(
        "load",
        resolve,
        { once: true }
      );

      script.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              `OCRライブラリを読み込めませんでした: ${src}`
            )
          ),
        { once: true }
      );

      document.head.appendChild(
        script
      );
    }
  );
}

async function ensureTesseractLoaded() {
  if (window.Tesseract) {
    return window.Tesseract;
  }

  if (tesseractLoadPromise) {
    return tesseractLoadPromise;
  }

  tesseractLoadPromise =
    (async () => {
      let lastError = null;

      for (
        const url of
        TESSERACT_CDN_URLS
      ) {
        try {
          await loadScript(url);

          if (window.Tesseract) {
            return window.Tesseract;
          }
        } catch (error) {
          lastError = error;
        }
      }

      throw (
        lastError ||
        new Error(
          "OCRライブラリを読み込めませんでした。"
        )
      );
    })();

  try {
    return await tesseractLoadPromise;
  } catch (error) {
    tesseractLoadPromise = null;
    throw error;
  }
}

function updateSuumoOcrProgress(
  message,
  percent
) {
  const safePercent =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(percent) || 0
        )
      )
    );

  el.suumoOcrStatus.classList.remove(
    "hidden"
  );

  el.suumoOcrStatusText.textContent =
    message;

  el.suumoOcrPercent.textContent =
    `${safePercent}%`;

  el.suumoOcrProgress.value =
    safePercent;
}

function setSuumoOcrSummary(
  message,
  tone = "success"
) {
  el.suumoOcrSummary.textContent =
    message;

  el.suumoOcrSummary.className =
    "suumo-ocr-summary";

  if (tone !== "success") {
    el.suumoOcrSummary.classList.add(
      tone
    );
  }

  el.suumoOcrSummary.classList.remove(
    "hidden"
  );
}

function normalizeOcrText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\r/g, "\n")
    .replace(/[|｜]/g, " ")
    .replace(/[／]/g, "/")
    .replace(/[：]/g, ":")
    .replace(/[，]/g, ",")
    .replace(/[．]/g, ".")
    .replace(/[㎡]/g, "m2")
    .replace(/[²]/g, "2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function firstRegexNumber(
  text,
  regex,
  min,
  max
) {
  const match =
    regex.exec(text);

  if (!match) {
    return null;
  }

  const value =
    Number(
      String(match[1])
        .replace(/,/g, "")
    );

  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    return null;
  }

  return value;
}

function parseStationAccessesFromText(
  normalizedText
) {
  const lines =
    normalizedText
      .split("\n")
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);

  const results = [];

  const addMatch =
    (
      route,
      station,
      walkMinutes
    ) => {
      const minutes =
        Number(walkMinutes);

      if (
        !Number.isFinite(minutes) ||
        minutes < 0 ||
        minutes > 60 ||
        !String(station).includes("駅")
      ) {
        return;
      }

      results.push({
        route:
          String(route || "")
            .replace(
              /^[・●◆■□◇▶▷\-\s]+/,
              ""
            )
            .trim(),

        station:
          String(station || "")
            .trim(),

        walkMinutes:
          Math.round(minutes)
      });
    };

  lines.forEach(
    (line) => {
      if (
        !line.includes("駅") ||
        !/(徒歩|歩)\s*\d{1,2}\s*分/.test(
          line
        )
      ) {
        return;
      }

      let match =
        /(.{1,50}?)\/\s*([^\/\s]{1,24}駅)\s*(?:徒歩|歩)\s*(\d{1,2})\s*分/.exec(
          line
        );

      if (match) {
        addMatch(
          match[1],
          match[2],
          match[3]
        );
        return;
      }

      match =
        /(.{1,50}?)\s+([^\s]{1,24}駅)\s*(?:徒歩|歩)\s*(\d{1,2})\s*分/.exec(
          line
        );

      if (match) {
        addMatch(
          match[1],
          match[2],
          match[3]
        );
        return;
      }

      match =
        /([^\s\/]{1,24}駅)\s*(?:徒歩|歩)\s*(\d{1,2})\s*分/.exec(
          line
        );

      if (match) {
        addMatch(
          "",
          match[1],
          match[2]
        );
      }
    }
  );

  return normalizeStationAccesses(
    results
  );
}

function parseSuumoOcrText(rawText) {
  const text =
    normalizeOcrText(
      rawText
    );

  const rentManYen =
    firstRegexNumber(
      text,
      /(?:^|\n|\s)(\d{1,3}(?:\.\d{1,2})?)\s*万円(?=\s|$|\(|（)/m,
      1,
      200
    );

  const managementFeeYen =
    firstRegexNumber(
      text,
      /(?:管理費(?:・共益費)?|共益費)\s*:?\s*([\d,]{1,10})\s*円/,
      0,
      1000000
    );

  const areaSqm =
    firstRegexNumber(
      text,
      /(\d{1,3}(?:\.\d{1,2})?)\s*(?:m2|m\^?2)/i,
      5,
      500
    );

  const layoutMatch =
    /\b(\d{1,2}\s*(?:SLDK|LDK|SDK|DK|SK|K|R))\b/i.exec(
      text
    );

  const buildingAgeYears =
    firstRegexNumber(
      text,
      /築\s*(\d{1,3})\s*年/,
      0,
      200
    );

  let parking =
    "UNKNOWN";

  const parkingLines =
    text
      .split("\n")
      .filter(
        (line) =>
          /駐車場/.test(line) &&
          !/駐輪場/.test(line)
      );

  if (
    parkingLines.some(
      (line) =>
        /(なし|無し|無|空無|空きなし)/.test(
          line
        )
    )
  ) {
    parking = "NO";
  } else if (
    parkingLines.some(
      (line) =>
        /(あり|有|空有|空きあり|空車)/.test(
          line
        )
    )
  ) {
    parking = "YES";
  }

  const stationAccesses =
    parseStationAccessesFromText(
      text
    );

  return {
    rentManYen,
    managementFeeYen,
    areaSqm,
    layout:
      layoutMatch
        ? layoutMatch[1]
            .replace(/\s/g, "")
            .toUpperCase()
        : "",

    buildingAgeYears,
    parking,
    stationAccesses,
    rawText: text
  };
}

function applySuumoParsedData(parsed) {
  const applied = [];

  if (
    Number.isFinite(
      parsed.rentManYen
    )
  ) {
    el.profileRent.value =
      parsed.rentManYen;
    applied.push("家賃");
  }

  if (
    Number.isFinite(
      parsed.managementFeeYen
    )
  ) {
    el.profileManagementFee.value =
      parsed.managementFeeYen;
    applied.push("管理・共益費");
  }

  if (
    Number.isFinite(
      parsed.areaSqm
    )
  ) {
    el.profileArea.value =
      parsed.areaSqm;
    applied.push("専有面積");
  }

  if (parsed.layout) {
    el.profileLayout.value =
      parsed.layout;
    applied.push("間取り");
  }

  if (
    Number.isFinite(
      parsed.buildingAgeYears
    )
  ) {
    el.profileBuildingAge.value =
      parsed.buildingAgeYears;
    applied.push("築年数");
  }

  if (
    parsed.parking !==
    "UNKNOWN"
  ) {
    el.profileParking.value =
      parsed.parking;
    applied.push("駐車場");
  }

  if (
    parsed.stationAccesses.length
  ) {
    state.editingStationAccesses =
      parsed.stationAccesses;

    state.editingStationAccessSelection =
      shortestStationAccessId(
        parsed.stationAccesses
      );

    const selected =
      selectedStationAccess(
        parsed.stationAccesses,
        state.editingStationAccessSelection
      );

    if (selected) {
      el.profileStationWalk.value =
        selected.walkMinutes;
    }

    renderStationAccessOptions();

    applied.push(
      `駅アクセス${parsed.stationAccesses.length}件`
    );
  }

  updateProfileCalculationPreview();

  return applied;
}

function ocrProgressMessage(status) {
  const labels = {
    "loading tesseract core":
      "OCRエンジンを読み込み中…",

    "initializing tesseract":
      "OCRエンジンを初期化中…",

    "loading language traineddata":
      "日本語データを読み込み中…",

    "initializing api":
      "文字認識を準備中…",

    "recognizing text":
      "スクショを読み取り中…"
  };

  return (
    labels[status] ||
    "OCR処理中…"
  );
}

async function importSuumoScreenshot(
  file
) {
  if (
    !file ||
    state.suumoOcrBusy
  ) {
    return;
  }

  state.suumoOcrBusy = true;
  el.suumoScreenshotButton.disabled =
    true;

  el.suumoOcrSummary.classList.add(
    "hidden"
  );

  updateSuumoOcrProgress(
    "OCRライブラリを読み込み中…",
    2
  );

  let worker = null;

  try {
    const Tesseract =
      await ensureTesseractLoaded();

    worker =
      await Tesseract.createWorker(
        "jpn+eng",
        1,
        {
          logger:
            (message) => {
              const progress =
                Number.isFinite(
                  message.progress
                )
                  ? (
                      8 +
                      message.progress *
                      88
                    )
                  : 8;

              updateSuumoOcrProgress(
                ocrProgressMessage(
                  message.status
                ),
                progress
              );
            }
        }
      );

    const result =
      await worker.recognize(
        file
      );

    updateSuumoOcrProgress(
      "読み取り結果を解析中…",
      97
    );

    const parsed =
      parseSuumoOcrText(
        result?.data?.text || ""
      );

    const applied =
      applySuumoParsedData(
        parsed
      );

    updateSuumoOcrProgress(
      "読み取り完了",
      100
    );

    if (applied.length) {
      setSuumoOcrSummary(
        `${applied.join(" / ")} をフォームへ反映しました。内容を確認・修正してから「保存」を押してください。`
      );
    } else {
      setSuumoOcrSummary(
        "物件情報を十分に読み取れませんでした。別のスクショを試すか、手入力してください。",
        "warning"
      );
    }
  } catch (error) {
    console.error(error);

    setSuumoOcrSummary(
      error?.message ||
      "スクショの読み取りに失敗しました。",
      "error"
    );

    updateSuumoOcrProgress(
      "OCRに失敗しました",
      0
    );
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // no-op
      }
    }

    state.suumoOcrBusy = false;
    el.suumoScreenshotButton.disabled =
      false;

    el.suumoScreenshotInput.value =
      "";
  }
}

function profileHasValue(profile) {
  if (!profile || typeof profile !== "object") {
    return false;
  }

  return [
    profile.rentManYen,
    profile.managementFeeYen,
    profile.areaSqm,
    profile.layout,
    profile.buildingAgeYears,
    profile.stationWalkMinutes,
    profile.memo,
    Array.isArray(profile.stationAccesses)
      ? profile.stationAccesses.length
      : 0
  ].some(
    (value) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
  ) || (
    profile.parking &&
    profile.parking !== "UNKNOWN"
  );
}

function optionalNumberFromInput(input) {
  const raw =
    String(input.value || "").trim();

  if (raw === "") {
    return null;
  }

  const value =
    Number(raw);

  return Number.isFinite(value)
    ? value
    : null;
}

function normalizeCandidateProfile(profile) {
  const source =
    profile &&
    typeof profile === "object"
      ? profile
      : {};

  const stationAccesses =
    normalizeStationAccesses(
      source.stationAccesses
    );

  let selectedStationAccessId =
    typeof source.selectedStationAccessId ===
      "string"
      ? source.selectedStationAccessId
      : "manual";

  if (
    selectedStationAccessId !==
      "manual" &&
    !stationAccesses.some(
      (access) =>
        access.id ===
        selectedStationAccessId
    )
  ) {
    selectedStationAccessId =
      stationAccesses.length
        ? shortestStationAccessId(
            stationAccesses
          )
        : "manual";
  }

  let stationWalkMinutes =
    Number.isFinite(
      Number(
        source.stationWalkMinutes
      )
    )
      ? Number(
          source.stationWalkMinutes
        )
      : null;

  const selectedAccess =
    selectedStationAccess(
      stationAccesses,
      selectedStationAccessId
    );

  if (selectedAccess) {
    stationWalkMinutes =
      selectedAccess.walkMinutes;
  }

  return {
    rentManYen:
      Number.isFinite(
        Number(source.rentManYen)
      )
        ? Number(source.rentManYen)
        : null,

    managementFeeYen:
      Number.isFinite(
        Number(source.managementFeeYen)
      )
        ? Number(source.managementFeeYen)
        : null,

    areaSqm:
      Number.isFinite(
        Number(source.areaSqm)
      )
        ? Number(source.areaSqm)
        : null,

    layout:
      typeof source.layout === "string"
        ? source.layout.trim()
        : "",

    buildingAgeYears:
      Number.isFinite(
        Number(source.buildingAgeYears)
      )
        ? Number(source.buildingAgeYears)
        : null,

    stationWalkMinutes,

    stationAccesses,

    selectedStationAccessId,

    parking:
      ["YES", "NO", "UNKNOWN"].includes(
        source.parking
      )
        ? source.parking
        : "UNKNOWN",

    memo:
      typeof source.memo === "string"
        ? source.memo.trim()
        : ""
  };
}

function candidateProfileCalculations(profile) {
  const normalized =
    normalizeCandidateProfile(profile);

  const rentYen =
    Number.isFinite(
      normalized.rentManYen
    )
      ? normalized.rentManYen * 10000
      : null;

  const area =
    Number.isFinite(
      normalized.areaSqm
    ) &&
    normalized.areaSqm > 0
      ? normalized.areaSqm
      : null;

  const managementFee =
    Number.isFinite(
      normalized.managementFeeYen
    )
      ? normalized.managementFeeYen
      : null;

  const rentPerSqm =
    Number.isFinite(rentYen) &&
    Number.isFinite(area)
      ? rentYen / area
      : null;

  const totalMonthlyCost =
    Number.isFinite(rentYen) &&
    Number.isFinite(managementFee)
      ? rentYen + managementFee
      : null;

  const effectiveCostPerSqm =
    Number.isFinite(totalMonthlyCost) &&
    Number.isFinite(area)
      ? totalMonthlyCost / area
      : null;

  return {
    rentYen,
    area,
    managementFee,
    rentPerSqm,
    totalMonthlyCost,
    effectiveCostPerSqm
  };
}

function formatYen(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatManYen(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${Number(value).toLocaleString(
    "ja-JP",
    {
      maximumFractionDigits: 2
    }
  )}万円`;
}

function formatSquareMeters(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${Number(value).toLocaleString(
    "ja-JP",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  )}㎡`;
}

function parkingLabel(value) {
  if (value === "YES") {
    return "あり";
  }

  if (value === "NO") {
    return "なし";
  }

  return "—";
}

function profileTeaserValues(profile) {
  const p =
    normalizeCandidateProfile(profile);

  const values = [];

  if (Number.isFinite(p.rentManYen)) {
    values.push(
      formatManYen(p.rentManYen)
    );
  }

  if (Number.isFinite(p.areaSqm)) {
    values.push(
      formatSquareMeters(p.areaSqm)
    );
  }

  if (p.layout) {
    values.push(p.layout);
  }

  return values.slice(0, 3);
}

function addProfileDisplayItem(
  container,
  label,
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "—"
  ) {
    return;
  }

  const item =
    document.createElement("div");

  item.className =
    "profile-display-item";

  const labelElement =
    document.createElement("span");

  labelElement.className =
    "label";

  labelElement.textContent =
    label;

  const valueElement =
    document.createElement("span");

  valueElement.className =
    "value";

  valueElement.textContent =
    String(value);

  item.append(
    labelElement,
    valueElement
  );

  container.appendChild(item);
}

function renderCandidateProfilePanel(
  candidate,
  details
) {
  const profile =
    normalizeCandidateProfile(
      candidate.profile
    );

  const hasProfile =
    profileHasValue(profile);

  const status =
    details.querySelector(
      ".candidate-profile-status"
    );

  status.textContent =
    hasProfile
      ? "入力済み"
      : "未入力";

  status.classList.toggle(
    "filled",
    hasProfile
  );

  const panel =
    details.querySelector(
      ".candidate-profile-panel"
    );

  panel.replaceChildren();

  if (!hasProfile) {
    const empty =
      document.createElement("p");

    empty.className =
      "profile-empty-message";

    empty.textContent =
      "物件情報はまだ入力されていません。通勤比較だけでもそのまま利用できます。";

    panel.appendChild(empty);
  } else {
    const grid =
      document.createElement("div");

    grid.className =
      "profile-display-grid";

    addProfileDisplayItem(
      grid,
      "家賃",
      Number.isFinite(
        profile.rentManYen
      )
        ? `${formatManYen(profile.rentManYen)}/月`
        : null
    );

    addProfileDisplayItem(
      grid,
      "管理・共益費",
      Number.isFinite(
        profile.managementFeeYen
      )
        ? `${formatYen(profile.managementFeeYen)}/月`
        : null
    );

    addProfileDisplayItem(
      grid,
      "専有面積",
      Number.isFinite(
        profile.areaSqm
      )
        ? formatSquareMeters(
            profile.areaSqm
          )
        : null
    );

    addProfileDisplayItem(
      grid,
      "間取り",
      profile.layout || null
    );

    addProfileDisplayItem(
      grid,
      "築年数",
      Number.isFinite(
        profile.buildingAgeYears
      )
        ? `築${profile.buildingAgeYears}年`
        : null
    );

    addProfileDisplayItem(
      grid,
      "駅徒歩",
      Number.isFinite(
        profile.stationWalkMinutes
      )
        ? `${profile.stationWalkMinutes}分`
        : null
    );

    addProfileDisplayItem(
      grid,
      "駐車場",
      parkingLabel(
        profile.parking
      )
    );

    if (grid.children.length) {
      panel.appendChild(grid);
    }

    if (
      profile.stationAccesses.length
    ) {
      const accessBox =
        document.createElement(
          "div"
        );

      accessBox.className =
        "profile-station-access-display";

      const accessTitle =
        document.createElement(
          "div"
        );

      accessTitle.className =
        "profile-station-access-display-title";

      accessTitle.textContent =
        "駅アクセス";

      accessBox.appendChild(
        accessTitle
      );

      profile.stationAccesses.forEach(
        (access) => {
          const row =
            document.createElement(
              "div"
            );

          row.className =
            "profile-station-access-row";

          const isSelected =
            profile.selectedStationAccessId ===
            access.id;

          if (isSelected) {
            row.classList.add(
              "selected"
            );

            const badge =
              document.createElement(
                "span"
              );

            badge.className =
              "profile-station-access-badge";

            badge.textContent =
              "評価";

            row.appendChild(
              badge
            );
          }

          const text =
            document.createElement(
              "span"
            );

          text.textContent =
            `${
              access.route
                ? `${access.route} / `
                : ""
            }${access.station} 徒歩${access.walkMinutes}分`;

          row.appendChild(text);
          accessBox.appendChild(row);
        }
      );

      panel.appendChild(
        accessBox
      );
    }

    const calc =
      candidateProfileCalculations(
        profile
      );

    if (
      Number.isFinite(
        calc.rentPerSqm
      )
    ) {
      const calculatedCard =
        document.createElement("div");

      calculatedCard.className =
        "profile-calculated-card";

      const title =
        document.createElement("div");

      title.className =
        "profile-calculated-card-title";

      title.textContent =
        "自動計算";

      const values =
        document.createElement("div");

      values.className =
        "profile-calculated-values";

      const rentUnit =
        document.createElement("div");

      rentUnit.className =
        "profile-calculated-value";

      rentUnit.innerHTML =
        "<span>1㎡あたり家賃</span>";

      const rentUnitStrong =
        document.createElement("strong");

      rentUnitStrong.textContent =
        `${formatYen(calc.rentPerSqm)}/㎡`;

      rentUnit.appendChild(
        rentUnitStrong
      );

      values.appendChild(
        rentUnit
      );

      if (
        Number.isFinite(
          calc.totalMonthlyCost
        )
      ) {
        const total =
          document.createElement("div");

        total.className =
          "profile-calculated-value";

        total.innerHTML =
          "<span>月額住居費</span>";

        const totalStrong =
          document.createElement("strong");

        totalStrong.textContent =
          formatYen(
            calc.totalMonthlyCost
          );

        total.appendChild(
          totalStrong
        );

        values.appendChild(
          total
        );
      }

      if (
        Number.isFinite(
          calc.effectiveCostPerSqm
        )
      ) {
        const effective =
          document.createElement("div");

        effective.className =
          "profile-calculated-value";

        effective.innerHTML =
          "<span>実質住居費単価</span>";

        const effectiveStrong =
          document.createElement("strong");

        effectiveStrong.textContent =
          `${formatYen(calc.effectiveCostPerSqm)}/㎡`;

        effective.appendChild(
          effectiveStrong
        );

        values.appendChild(
          effective
        );
      }

      calculatedCard.append(
        title,
        values
      );

      panel.appendChild(
        calculatedCard
      );
    }

    if (profile.memo) {
      const memo =
        document.createElement("div");

      memo.className =
        "profile-memo";

      memo.textContent =
        profile.memo;

      panel.appendChild(memo);
    }
  }

  const editButton =
    document.createElement("button");

  editButton.type =
    "button";

  editButton.className =
    "candidate-profile-edit-button";

  editButton.textContent =
    hasProfile
      ? "プロフィールを編集"
      : "プロフィールを入力";

  editButton.addEventListener(
    "click",
    () => {
      openCandidateProfileDialog(
        candidate.id
      );
    }
  );

  panel.appendChild(editButton);
}

function currentProfileFromForm() {
  return normalizeCandidateProfile({
    rentManYen:
      optionalNumberFromInput(
        el.profileRent
      ),

    managementFeeYen:
      optionalNumberFromInput(
        el.profileManagementFee
      ),

    areaSqm:
      optionalNumberFromInput(
        el.profileArea
      ),

    layout:
      el.profileLayout.value,

    buildingAgeYears:
      optionalNumberFromInput(
        el.profileBuildingAge
      ),

    stationWalkMinutes:
      optionalNumberFromInput(
        el.profileStationWalk
      ),

    stationAccesses:
      state.editingStationAccesses,

    selectedStationAccessId:
      state.editingStationAccessSelection,

    parking:
      el.profileParking.value,

    memo:
      el.profileMemo.value
  });
}

function setProfileForm(profile) {
  const p =
    normalizeCandidateProfile(
      profile
    );

  el.profileRent.value =
    Number.isFinite(p.rentManYen)
      ? p.rentManYen
      : "";

  el.profileManagementFee.value =
    Number.isFinite(
      p.managementFeeYen
    )
      ? p.managementFeeYen
      : "";

  el.profileArea.value =
    Number.isFinite(p.areaSqm)
      ? p.areaSqm
      : "";

  el.profileLayout.value =
    p.layout;

  el.profileBuildingAge.value =
    Number.isFinite(
      p.buildingAgeYears
    )
      ? p.buildingAgeYears
      : "";

  el.profileStationWalk.value =
    Number.isFinite(
      p.stationWalkMinutes
    )
      ? p.stationWalkMinutes
      : "";

  state.editingStationAccesses =
    p.stationAccesses;

  state.editingStationAccessSelection =
    p.selectedStationAccessId;

  renderStationAccessOptions();

  el.profileParking.value =
    p.parking;

  el.profileMemo.value =
    p.memo;

  updateProfileCalculationPreview();
}

function addProfilePreviewItem(
  label,
  value
) {
  const item =
    document.createElement("div");

  item.className =
    "profile-preview-item";

  const labelElement =
    document.createElement("span");

  labelElement.textContent =
    label;

  const valueElement =
    document.createElement("strong");

  valueElement.textContent =
    value;

  item.append(
    labelElement,
    valueElement
  );

  el.profileCalculationPreview.appendChild(
    item
  );
}

function updateProfileCalculationPreview() {
  const profile =
    currentProfileFromForm();

  const calc =
    candidateProfileCalculations(
      profile
    );

  el.profileCalculationPreview.replaceChildren();

  addProfilePreviewItem(
    "1㎡あたり家賃",
    Number.isFinite(
      calc.rentPerSqm
    )
      ? `${formatYen(calc.rentPerSqm)}/㎡`
      : "家賃＋面積で計算"
  );

  addProfilePreviewItem(
    "月額住居費",
    Number.isFinite(
      calc.totalMonthlyCost
    )
      ? formatYen(
          calc.totalMonthlyCost
        )
      : "家賃＋管理費で計算"
  );

  addProfilePreviewItem(
    "実質住居費単価",
    Number.isFinite(
      calc.effectiveCostPerSqm
    )
      ? `${formatYen(calc.effectiveCostPerSqm)}/㎡`
      : "家賃＋管理費＋面積で計算"
  );
}

function openCandidateProfileDialog(
  candidateId
) {
  const candidate =
    state.candidates.find(
      (item) =>
        item.id === candidateId
    );

  if (!candidate) {
    return;
  }

  state.editingProfileCandidateId =
    candidateId;

  el.profileCandidateName.textContent =
    candidate.name;

  setProfileForm(
    candidate.profile
  );

  el.suumoOcrStatus.classList.add(
    "hidden"
  );

  el.suumoOcrSummary.classList.add(
    "hidden"
  );

  el.suumoScreenshotInput.value =
    "";

  el.clearCandidateProfileButton.disabled =
    !profileHasValue(
      candidate.profile
    );

  el.candidateProfileDialog.showModal();
}

function closeCandidateProfileDialog() {
  state.editingProfileCandidateId =
    null;

  state.editingStationAccesses = [];
  state.editingStationAccessSelection =
    "manual";

  if (
    el.candidateProfileDialog.open
  ) {
    el.candidateProfileDialog.close();
  }
}

function saveCandidateProfile() {
  const candidate =
    state.candidates.find(
      (item) =>
        item.id ===
        state.editingProfileCandidateId
    );

  if (!candidate) {
    closeCandidateProfileDialog();
    return;
  }

  candidate.profile =
    currentProfileFromForm();

  persistCandidates();
  renderCandidates();

  closeCandidateProfileDialog();

  setStatus(
    `「${candidate.name}」のプロフィールを保存しました。`
  );
}

function clearCandidateProfile() {
  const candidate =
    state.candidates.find(
      (item) =>
        item.id ===
        state.editingProfileCandidateId
    );

  if (!candidate) {
    return;
  }

  candidate.profile =
    normalizeCandidateProfile(null);

  persistCandidates();
  renderCandidates();

  setProfileForm(
    candidate.profile
  );

  el.clearCandidateProfileButton.disabled =
    true;

  setStatus(
    `「${candidate.name}」のプロフィールをクリアしました。`
  );
}


/* =========================================================
   Total score - v2.2
========================================================= */

const SCORE_WEIGHT_STORAGE_KEY =
  "commuteSimulatorScoreWeightsV2_2";

const DEFAULT_SCORE_WEIGHTS = {
  commute: 30,
  housing: 25,
  area: 15,
  age: 10,
  walk: 10,
  nearby: 10
};

let scoreWeights = {
  ...DEFAULT_SCORE_WEIGHTS
};

const SCORE_CRITERIA = [
  {
    key: "commute",
    label: "車通勤",
    lowerIsBetter: true
  },
  {
    key: "housing",
    label: "月額住居費",
    lowerIsBetter: true
  },
  {
    key: "area",
    label: "専有面積",
    lowerIsBetter: false
  },
  {
    key: "age",
    label: "築年数",
    lowerIsBetter: true
  },
  {
    key: "walk",
    label: "駅徒歩",
    lowerIsBetter: true
  },
  {
    key: "nearby",
    label: "周辺利便性",
    lowerIsBetter: true
  }
];

function sanitizeScoreWeight(value) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(numeric)
    )
  );
}

function loadScoreWeights() {
  const raw =
    safeSessionStorageGet(
      SCORE_WEIGHT_STORAGE_KEY
    );

  if (!raw) {
    scoreWeights = {
      ...DEFAULT_SCORE_WEIGHTS
    };
    return;
  }

  try {
    const parsed =
      JSON.parse(raw);

    scoreWeights = {};

    Object.keys(
      DEFAULT_SCORE_WEIGHTS
    ).forEach(
      (key) => {
        scoreWeights[key] =
          sanitizeScoreWeight(
            parsed?.[key] ??
            DEFAULT_SCORE_WEIGHTS[
              key
            ]
          );
      }
    );
  } catch {
    scoreWeights = {
      ...DEFAULT_SCORE_WEIGHTS
    };
  }
}

function persistScoreWeights() {
  safeSessionStorageSet(
    SCORE_WEIGHT_STORAGE_KEY,
    JSON.stringify(
      scoreWeights
    )
  );
}

function setScoreWeightInputs() {
  el.scoreWeightCommute.value =
    scoreWeights.commute;

  el.scoreWeightHousing.value =
    scoreWeights.housing;

  el.scoreWeightArea.value =
    scoreWeights.area;

  el.scoreWeightAge.value =
    scoreWeights.age;

  el.scoreWeightWalk.value =
    scoreWeights.walk;

  el.scoreWeightNearby.value =
    scoreWeights.nearby;

  const total =
    Object.values(
      scoreWeights
    ).reduce(
      (sum, value) =>
        sum + value,
      0
    );

  el.scoreWeightTotal.textContent =
    total > 0
      ? `入力重み 合計${total} → 自動で100%換算`
      : "重みがすべて0です";
}

function updateScoreWeightsFromInputs() {
  scoreWeights = {
    commute:
      sanitizeScoreWeight(
        el.scoreWeightCommute.value
      ),

    housing:
      sanitizeScoreWeight(
        el.scoreWeightHousing.value
      ),

    area:
      sanitizeScoreWeight(
        el.scoreWeightArea.value
      ),

    age:
      sanitizeScoreWeight(
        el.scoreWeightAge.value
      ),

    walk:
      sanitizeScoreWeight(
        el.scoreWeightWalk.value
      ),

    nearby:
      sanitizeScoreWeight(
        el.scoreWeightNearby.value
      )
  };

  persistScoreWeights();
  setScoreWeightInputs();
  renderScoreComparison();
}

function resetScoreWeights() {
  scoreWeights = {
    ...DEFAULT_SCORE_WEIGHTS
  };

  persistScoreWeights();
  setScoreWeightInputs();
  renderScoreComparison();
}

function nearbyConvenienceDistance(
  candidate
) {
  const nearby =
    normalizeNearbyData(
      candidate.nearby
    );

  if (
    !nearby ||
    !nearbyDataIsCurrent(
      nearby
    )
  ) {
    return null;
  }

  const distances =
    NEARBY_FACILITY_CATEGORIES.map(
      (category) => {
        const facility =
          nearby.facilities[
            category.key
          ];

        if (
          facility &&
          Number.isFinite(
            facility.distanceMeters
          )
        ) {
          return Math.min(
            facility.distanceMeters,
            NEARBY_SEARCH_RADIUS_METERS
          );
        }

        return NEARBY_SEARCH_RADIUS_METERS;
      }
    );

  return (
    distances.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    distances.length
  );
}

function candidateScoreValues(
  candidate
) {
  const profile =
    normalizeCandidateProfile(
      candidate.profile
    );

  const calc =
    candidateProfileCalculations(
      profile
    );

  return {
    commute:
      Number.isFinite(
        candidate.durationMillis
      )
        ? candidate.durationMillis /
          60000
        : null,

    housing:
      Number.isFinite(
        calc.totalMonthlyCost
      )
        ? calc.totalMonthlyCost
        : null,

    area:
      Number.isFinite(
        profile.areaSqm
      ) &&
      profile.areaSqm > 0
        ? profile.areaSqm
        : null,

    age:
      Number.isFinite(
        profile.buildingAgeYears
      )
        ? profile.buildingAgeYears
        : null,

    walk:
      Number.isFinite(
        profile.stationWalkMinutes
      )
        ? profile.stationWalkMinutes
        : null,

    nearby:
      nearbyConvenienceDistance(
        candidate
      )
  };
}

function activeScoreCriteria() {
  return SCORE_CRITERIA.filter(
    (criterion) =>
      (
        scoreWeights[
          criterion.key
        ] || 0
      ) > 0
  );
}

function missingScoreCriteria(
  values
) {
  return activeScoreCriteria()
    .filter(
      (criterion) =>
        !Number.isFinite(
          values[
            criterion.key
          ]
        )
    )
    .map(
      (criterion) =>
        criterion.label
    );
}

function relativeCriterionScore(
  value,
  minValue,
  maxValue,
  lowerIsBetter
) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(minValue) ||
    !Number.isFinite(maxValue)
  ) {
    return null;
  }

  if (
    Math.abs(
      maxValue -
      minValue
    ) < 1e-9
  ) {
    return 100;
  }

  const raw =
    lowerIsBetter
      ? (
          maxValue -
          value
        ) /
        (
          maxValue -
          minValue
        )
      : (
          value -
          minValue
        ) /
        (
          maxValue -
          minValue
        );

  return Math.max(
    0,
    Math.min(
      100,
      raw * 100
    )
  );
}

function calculateScoreResults() {
  const criteria =
    activeScoreCriteria();

  const totalWeight =
    criteria.reduce(
      (sum, criterion) =>
        sum +
        scoreWeights[
          criterion.key
        ],
      0
    );

  const prepared =
    state.candidates.map(
      (candidate) => {
        const values =
          candidateScoreValues(
            candidate
          );

        return {
          candidate,
          values,
          missing:
            missingScoreCriteria(
              values
            )
        };
      }
    );

  if (
    totalWeight <= 0 ||
    criteria.length === 0
  ) {
    return {
      criteria,
      totalWeight,
      prepared,
      scorable: [],
      scored: []
    };
  }

  const scorable =
    prepared.filter(
      (item) =>
        item.missing.length === 0
    );

  if (scorable.length < 2) {
    return {
      criteria,
      totalWeight,
      prepared,
      scorable,
      scored: []
    };
  }

  const ranges = {};

  criteria.forEach(
    (criterion) => {
      const values =
        scorable.map(
          (item) =>
            item.values[
              criterion.key
            ]
        );

      ranges[
        criterion.key
      ] = {
        min:
          Math.min(
            ...values
          ),

        max:
          Math.max(
            ...values
          )
      };
    }
  );

  const scored =
    scorable.map(
      (item) => {
        const breakdown = {};
        let weightedSum = 0;

        criteria.forEach(
          (criterion) => {
            const range =
              ranges[
                criterion.key
              ];

            const criterionScore =
              relativeCriterionScore(
                item.values[
                  criterion.key
                ],
                range.min,
                range.max,
                criterion.lowerIsBetter
              );

            breakdown[
              criterion.key
            ] =
              criterionScore;

            weightedSum +=
              criterionScore *
              scoreWeights[
                criterion.key
              ];
          }
        );

        return {
          ...item,
          breakdown,
          totalScore:
            weightedSum /
            totalWeight
        };
      }
    )
    .sort(
      (a, b) =>
        b.totalScore -
        a.totalScore
    );

  return {
    criteria,
    totalWeight,
    prepared,
    scorable,
    scored
  };
}

function formatScoreValue(
  criterionKey,
  value
) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (criterionKey === "commute") {
    return `${Math.round(value)}分`;
  }

  if (criterionKey === "housing") {
    return formatYen(value);
  }

  if (criterionKey === "area") {
    return formatSquareMeters(
      value
    );
  }

  if (criterionKey === "age") {
    return `築${value}年`;
  }

  if (criterionKey === "walk") {
    return `${value}分`;
  }

  if (criterionKey === "nearby") {
    return formatNearbyDistance(
      value
    ).replace(
      "（直線）",
      ""
    );
  }

  return String(value);
}

function renderScoreComparison() {
  const result =
    calculateScoreResults();

  el.scoreResultList.replaceChildren();

  el.scoreCandidateCount.textContent =
    state.candidates.length
      ? `${state.candidates.length}件`
      : "未算出";

  el.scoreNotice.className =
    "score-notice";

  if (!state.candidates.length) {
    el.scoreNotice.textContent =
      "候補を追加すると総合スコアを比較できます。";

    return;
  }

  if (
    result.totalWeight <= 0
  ) {
    el.scoreNotice.textContent =
      "評価の重みがすべて0です。1項目以上に重みを設定してください。";

    el.scoreNotice.classList.add(
      "warning"
    );

    return;
  }

  const unavailable =
    result.prepared.filter(
      (item) =>
        item.missing.length > 0
    );

  if (
    result.scorable.length < 2
  ) {
    el.scoreNotice.textContent =
      `総合スコアには、必要情報が揃った候補が2件以上必要です。現在の比較可能候補は${result.scorable.length}件です。`;

    el.scoreNotice.classList.add(
      "warning"
    );
  } else {
    el.scoreNotice.textContent =
      `比較可能な${result.scorable.length}件を候補内で相対評価しています。最高条件を100、最低条件を0として各項目を換算し、設定した重みで合成します。`;

    el.scoreNotice.classList.add(
      "success"
    );
  }

  result.scored.forEach(
    (item, index) => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        `score-result-card${
          index === 0
            ? " best"
            : ""
        }`;

      const top =
        document.createElement(
          "div"
        );

      top.className =
        "score-result-top";

      const rank =
        document.createElement(
          "span"
        );

      rank.className =
        "score-rank";

      rank.textContent =
        `${index + 1}`;

      const name =
        document.createElement(
          "p"
        );

      name.className =
        "score-name";

      name.textContent =
        item.candidate.name;

      const total =
        document.createElement(
          "span"
        );

      total.className =
        "score-total";

      total.textContent =
        `${Math.round(
          item.totalScore
        )}点`;

      top.append(
        rank,
        name,
        total
      );

      const breakdown =
        document.createElement(
          "div"
        );

      breakdown.className =
        "score-breakdown";

      result.criteria.forEach(
        (criterion) => {
          const box =
            document.createElement(
              "div"
            );

          box.className =
            "score-breakdown-item";

          const label =
            document.createElement(
              "span"
            );

          label.textContent =
            `${criterion.label}｜重み${scoreWeights[criterion.key]}`;

          const value =
            document.createElement(
              "strong"
            );

          value.textContent =
            `${Math.round(
              item.breakdown[
                criterion.key
              ]
            )}点・${formatScoreValue(
              criterion.key,
              item.values[
                criterion.key
              ]
            )}`;

          box.append(
            label,
            value
          );

          breakdown.appendChild(
            box
          );
        }
      );

      const note =
        document.createElement(
          "p"
        );

      note.className =
        "score-relative-note";

      note.textContent =
        "この点数は現在保存されている比較可能候補の中での相対評価です。";

      card.append(
        top,
        breakdown,
        note
      );

      el.scoreResultList.appendChild(
        card
      );
    }
  );

  unavailable.forEach(
    (item) => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "score-result-card unavailable";

      const top =
        document.createElement(
          "div"
        );

      top.className =
        "score-result-top";

      const name =
        document.createElement(
          "p"
        );

      name.className =
        "score-name";

      name.textContent =
        item.candidate.name;

      const total =
        document.createElement(
          "span"
        );

      total.className =
        "score-total";

      total.textContent =
        "算出不可";

      top.append(
        name,
        total
      );

      const missing =
        document.createElement(
          "p"
        );

      missing.className =
        "score-missing";

      missing.textContent =
        `不足：${item.missing.join(
          " / "
        )}`;

      card.append(
        top,
        missing
      );

      el.scoreResultList.appendChild(
        card
      );
    }
  );
}

function candidateTotalScore(
  candidateId
) {
  const result =
    calculateScoreResults();

  const match =
    result.scored.find(
      (item) =>
        item.candidate.id ===
        candidateId
    );

  return match
    ? match.totalScore
    : null;
}


function candidateLocationMapsUrl(
  candidate
) {
  const hasAddress =
    typeof candidate.originAddress ===
      "string" &&
    candidate.originAddress.trim() !== "";

  const query =
    hasAddress
      ? candidate.originAddress.trim()
      : `${candidate.origin.lat},${candidate.origin.lng}`;

  const params =
    new URLSearchParams({
      api: "1",
      query
    });

  return (
    `https://www.google.com/maps/search/?${params.toString()}`
  );
}

function openCandidateLocationMaps(
  candidate
) {
  window.open(
    candidateLocationMapsUrl(
      candidate
    ),
    "_blank",
    "noopener"
  );
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

        <div class="candidate-profile-teaser"></div>

        <details class="candidate-profile-details">
          <summary>
            <span>物件プロフィール</span>
            <span class="candidate-profile-status">未入力</span>
          </summary>
          <div class="candidate-profile-panel"></div>
        </details>

        <details class="candidate-nearby-details">
          <summary>
            <span>周辺施設</span>
            <span class="candidate-nearby-status">未検索</span>
          </summary>
          <div class="candidate-nearby-panel"></div>
        </details>

        <p class="candidate-condition"></p>

        <div class="candidate-actions">
          <button
            class="candidate-use-button"
            type="button">
            この地点を使う
          </button>

          <button
            class="candidate-location-button"
            type="button">
            地点をGoogleマップで見る
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

      const teaser =
        card.querySelector(
          ".candidate-profile-teaser"
        );

      profileTeaserValues(
        candidate.profile
      ).forEach(
        (value) => {
          const chip =
            document.createElement("span");

          chip.className =
            "profile-teaser-chip";

          chip.textContent =
            value;

          teaser.appendChild(
            chip
          );
        }
      );

      const totalScore =
        candidateTotalScore(
          candidate.id
        );

      if (
        Number.isFinite(
          totalScore
        )
      ) {
        const scoreChip =
          document.createElement(
            "span"
          );

        scoreChip.className =
          "candidate-score-chip";

        scoreChip.textContent =
          `総合 ${Math.round(
            totalScore
          )}点`;

        teaser.appendChild(
          scoreChip
        );
      }

      if (!teaser.children.length) {
        teaser.classList.add(
          "hidden"
        );
      }

      renderCandidateProfilePanel(
        candidate,
        card.querySelector(
          ".candidate-profile-details"
        )
      );

      renderCandidateNearbyPanel(
        candidate,
        card.querySelector(
          ".candidate-nearby-details"
        )
      );

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
              candidate.originLabel ||
                candidate.name,
              {
                clearAutocomplete: true,
                address:
                  candidate.originAddress ||
                  ""
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
        .querySelector(".candidate-location-button")
        .addEventListener(
          "click",
          () => {
            openCandidateLocationMaps(
              candidate
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

  renderScoreComparison();
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

    originLabel:
      state.originLabel || name,

    originAddress:
      state.originAddress || "",

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
    const existingCandidate =
      state.candidates[
        duplicateIndex
      ];

    candidate.id =
      existingCandidate.id;

    candidate.profile =
      normalizeCandidateProfile(
        existingCandidate.profile
      );

    candidate.nearby =
      normalizeNearbyData(
        existingCandidate.nearby
      );

    candidate.nearbyError = "";

    state.candidates[
      duplicateIndex
    ] = candidate;
  } else {
    candidate.profile =
      normalizeCandidateProfile(
        null
      );

    candidate.nearby = null;
    candidate.nearbyError = "";

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


function syncExpandedTimeComparison() {
  const hasResult =
    Boolean(
      state.timeComparison?.rows?.length
    );

  el.expandTimeCompareButton.classList.toggle(
    "hidden",
    !hasResult
  );

  if (!hasResult) {
    el.expandedTimeCompareDate.textContent = "";
    el.expandedTimeCompareCondition.textContent = "";
    el.expandedTimeCompareHeadRow.replaceChildren();
    el.expandedTimeCompareBody.replaceChildren();
    el.expandedTimeCompareSummary.textContent = "";

    if (el.timeCompareDialog.open) {
      el.timeCompareDialog.close();
    }

    return;
  }

  el.expandedTimeCompareDate.textContent =
    el.timeCompareDate.textContent;

  el.expandedTimeCompareCondition.textContent =
    state.timeComparison.conditionLabel ||
    "保存した候補の時間帯比較";

  el.expandedTimeCompareHeadRow.innerHTML =
    el.timeCompareHeadRow.innerHTML;

  el.expandedTimeCompareBody.innerHTML =
    el.timeCompareBody.innerHTML;

  el.expandedTimeCompareSummary.textContent =
    el.timeCompareSummary.textContent;
}

function openExpandedTimeComparison() {
  if (
    !state.timeComparison?.rows?.length
  ) {
    return;
  }

  syncExpandedTimeComparison();

  if (!el.timeCompareDialog.open) {
    el.timeCompareDialog.showModal();
  }
}

function closeExpandedTimeComparison() {
  if (el.timeCompareDialog.open) {
    el.timeCompareDialog.close();
  }
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
    syncExpandedTimeComparison();
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

  syncExpandedTimeComparison();
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
  state.originAddress = "";
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

  el.suumoScreenshotButton.addEventListener(
    "click",
    () => {
      if (!state.suumoOcrBusy) {
        el.suumoScreenshotInput.click();
      }
    }
  );

  el.suumoScreenshotInput.addEventListener(
    "change",
    () => {
      const file =
        el.suumoScreenshotInput.files?.[0];

      if (file) {
        importSuumoScreenshot(
          file
        );
      }
    }
  );

  el.profileStationWalk.addEventListener(
    "input",
    () => {
      if (
        state.editingStationAccesses.length
      ) {
        state.editingStationAccessSelection =
          "manual";

        renderStationAccessOptions();
      }
    }
  );

  el.candidateProfileForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      saveCandidateProfile();
    }
  );

  el.candidateProfileDialogClose.addEventListener(
    "click",
    closeCandidateProfileDialog
  );

  el.candidateProfileCancelButton.addEventListener(
    "click",
    closeCandidateProfileDialog
  );

  el.candidateProfileDialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      closeCandidateProfileDialog();
    }
  );

  el.candidateProfileDialog.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        el.candidateProfileDialog
      ) {
        closeCandidateProfileDialog();
      }
    }
  );

  el.clearCandidateProfileButton.addEventListener(
    "click",
    () => {
      const candidate =
        state.candidates.find(
          (item) =>
            item.id ===
            state.editingProfileCandidateId
        );

      if (
        !candidate ||
        !profileHasValue(
          candidate.profile
        )
      ) {
        return;
      }

      if (
        !confirm(
          `「${candidate.name}」のプロフィール入力をすべてクリアしますか？`
        )
      ) {
        return;
      }

      clearCandidateProfile();
    }
  );

  [
    el.profileRent,
    el.profileManagementFee,
    el.profileArea,
    el.profileLayout,
    el.profileBuildingAge,
    el.profileStationWalk,
    el.profileParking,
    el.profileMemo
  ].forEach(
    (input) => {
      input.addEventListener(
        "input",
        updateProfileCalculationPreview
      );

      input.addEventListener(
        "change",
        updateProfileCalculationPreview
      );
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

  el.expandTimeCompareButton.addEventListener(
    "click",
    openExpandedTimeComparison
  );

  el.closeTimeCompareDialogButton.addEventListener(
    "click",
    closeExpandedTimeComparison
  );

  el.timeCompareDialog.addEventListener(
    "click",
    (event) => {
      if (event.target === el.timeCompareDialog) {
        closeExpandedTimeComparison();
      }
    }
  );

  el.timeCompareDialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      closeExpandedTimeComparison();
    }
  );

  [
    el.scoreWeightCommute,
    el.scoreWeightHousing,
    el.scoreWeightArea,
    el.scoreWeightAge,
    el.scoreWeightWalk,
    el.scoreWeightNearby
  ].forEach(
    (input) => {
      input.addEventListener(
        "change",
        updateScoreWeightsFromInputs
      );
    }
  );

  el.resetScoreWeightsButton.addEventListener(
    "click",
    resetScoreWeights
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
        ({ location, label, address }) =>
          setOrigin(
            location,
            label,
            { address }
          )
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
    loadScoreWeights();
    loadTimeSlotSettings();
    loadTimeComparison();

    setScoreWeightInputs();
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
