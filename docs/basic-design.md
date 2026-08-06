# 基本設計書 v1.0（要約）

## 構成

```text
GitHub Pages
  └─ HTML / CSS / JavaScript
        └─ Google Maps Platform
             ├─ Maps JavaScript API
             ├─ Places API (New)
             └─ Routes API
```

## ファイル

- `index.html`：画面構造
- `css/style.css`：レスポンシブUI
- `js/config.js`：APIキーと初期設定
- `js/google-loader.js`：Maps JavaScript API読込
- `js/time-utils.js`：日時プリセット
- `js/cache.js`：セッション内キャッシュ
- `js/app.js`：地図・Places・Routes・画面制御

## 拡張方針
検索結果を共通形式で扱い、次の機能へ拡張可能とする。

- 候補地比較
- 家探し評価
- お気に入り
- CSV出力
- 到達圏表示
- エリアランキング
