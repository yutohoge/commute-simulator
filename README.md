# Commute Simulator v1.1 candidate comparison

GitHubへ上書きするファイル:

- index.html
- css/style.css
- js/app.js

APIキーやconfig.jsは変更不要です。

## v1.1追加機能

- 車ルート結果から「この出発地を候補に追加」
- 候補名を自由入力
- 所要時間順に自動ランキング
- 距離・渋滞増加・検索条件を比較
- 候補から出発地点を復元
- 個別削除 / 全削除
- 候補はsessionStorageへ保存
  - ページ再読み込みでは残る
  - タブを閉じると消える
  - サーバーには保存しない
- 候補追加/閲覧だけではRoutes APIを呼ばない
- 異なる検索条件が混在した場合は警告表示
