# Commute Simulator v2.1.2 — スーパー検索の改善

GitHubで上書きするファイル:

- index.html
- js/app.js

css/style.css は変更なしです。
config.js とAPIキーも変更不要です。

## v2.1.2変更内容

周辺施設の「スーパー」判定をシンプルに改善しました。

旧:
- supermarket
- grocery_store
- discount_supermarket
- hypermarket

新:
- supermarket
- discount_supermarket
- hypermarket

`grocery_store` は小規模な食料品店や個人商店も拾いやすいため、
スーパー候補から除外しました。

さらに、スーパーについては
`place.primaryType` が上記スーパー系typeのいずれかである施設だけを採用します。

これにより、
「たまたま grocery 系typeを持つ小規模店舗」よりも
日常のまとめ買い先として使いやすいスーパーを拾いやすくします。

## API利用

変更なしです。

「周辺施設を検索」1回につき:
- Nearby Search 1回

追加取得する `primaryType` も同じNearby Searchのfieldsに含めるだけなので、
検索回数は増えません。

## そのほか

v2.1.1の交通施設分類もそのまま維持しています。

- 電車・地下鉄駅
- バス停

`transit_station` は引き続き除外しています。
