export const CONFIG = Object.freeze({
  // Google Cloudで作成・制限したAPIキーを、引用符の内側へ貼り付けます。
  GOOGLE_MAPS_API_KEY: "AIzaSyAuMWKZJVNvql4-E7XMuX-A3Lid7yN6zQE",

  DEFAULT_DESTINATION: Object.freeze({
    label: "京急追浜駅",
    address: "追浜駅（神奈川県横須賀市追浜町）",
    location: Object.freeze({ lat: 35.31594, lng: 139.62454 })
  }),

  INITIAL_MAP: Object.freeze({
    center: Object.freeze({ lat: 35.365, lng: 139.620 }),
    zoom: 11
  }),

  LANGUAGE: "ja",
  REGION: "JP",
  CACHE_TTL_MINUTES: 30
});
