# Commute Simulator v2.1.1 — 交通施設分類の改善

GitHubで上書きするファイル:

- index.html
- js/app.js

css/style.css は変更なしです。
config.js とAPIキーも変更不要です。

## v2.1.1変更内容

周辺施設の交通カテゴリを整理しました。

旧:
- 鉄道駅
  - train_station
  - subway_station
  - light_rail_station
  - transit_station

新:
- 電車・地下鉄駅
  - train_station
  - subway_station
  - light_rail_station

- バス停
  - bus_stop
  - bus_station

`transit_station` は分類が曖昧で、バス停が鉄道駅として表示される原因になるため検索対象から外しました。

## API利用

変更なしです。

「周辺施設を検索」1回につき:
- Nearby Search 1回

6カテゴリを1回の検索でまとめて取得します。

対象カテゴリ:
- スーパー
- コンビニ
- ドラッグストア
- ジム
- 電車・地下鉄駅
- バス停

表示やカテゴリ分けだけでは追加のAPIリクエストは発生しません。
