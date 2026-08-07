# Commute Simulator v1.3 — 公共交通ショートカット

GitHubで上書きするファイル:

- index.html
- css/style.css
- js/app.js

config.js とAPIキーは変更不要です。

## v1.3の変更

### 1. 交通状況表示の名称を修正

旧:
- 渋滞増加
- 交通状況による増加目安

新:
- 交通状況補正
- 交通状況による補正

計算:
traffic-aware duration - static duration

つまり、
「交通状況を考慮した所要時間 − 同じルートを交通状況なしで走る所要時間」
を表示します。

### 2. 公共交通をGoogle Maps本体で開く

現在の出発地・目的地から
Google Mapsの公共交通検索を直接開くボタンを追加しました。

- 検索結果欄:
  「公共交通をGoogleマップで見る」
- 候補カード:
  「公共交通を見る」

Google Maps URLの travelmode=transit を使います。
このショートカット自体はRoutes APIの公共交通検索を呼びません。

### 3. 既存Transit API機能は残す

既存の「公共交通」「比較」モードは将来の復旧確認用として残しています。
API側で公共交通結果が得られない場合でも、Google Maps本体へのリンクを利用できます。
