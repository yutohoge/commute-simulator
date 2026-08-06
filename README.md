# Commute Simulator v1.0

引っ越し候補地から任意の目的地まで、車と公共交通の所要時間を比較する個人用Webアプリです。

## v1.0の機能

- Google Map表示
- 出発地：住所・駅・施設検索
- 出発地：地図タップ
- 出発地：ピンドラッグ
- 出発地：現在地
- 目的地：京急追浜駅を初期値として表示
- 目的地：住所・駅・施設検索
- 車・公共交通・比較
- 現在、平日7:30、平日8:00、平日18:00、任意日時
- 車の有料道路・高速道路・フェリー回避
- 渋滞を考慮した車の所要時間
- 公共交通の所要時間
- 同一条件を30分間だけメモリキャッシュ
- Googleマップ本体で詳細を開く
- 目的地・検索履歴を永続保存しない
- PC・スマートフォン対応

## 1. APIキーを設定する

`js/config.js`を開きます。

```js
GOOGLE_MAPS_API_KEY: "YOUR_API_KEY_HERE",
```

`YOUR_API_KEY_HERE`だけを、Google Cloudで作成したAPIキーへ置き換えます。

APIキーをChatGPTへ送る必要はありません。

## 2. Google Cloud側の前提

有効API：

- Maps JavaScript API
- Places API (New)
- Routes API

APIキー制限：

- アプリケーション：ウェブサイト
- 許可URL：`https://yutohoge.github.io/*`
- API制限：上記3 APIのみ

## 3. GitHubへ公開する

1. GitHubで`commute-simulator`リポジトリを作成
2. ZIPを展開
3. 展開した中身をリポジトリ直下へアップロード
4. Settings → Pages
5. Sourceを`Deploy from a branch`
6. Branchを`main`、フォルダを`/(root)`
7. Save
8. 数分後に公開URLを開く

公開URLの想定：

```text
https://yutohoge.github.io/commute-simulator/
```

## 4. 動作確認

1. 地図が表示される
2. 地図をタップして出発地を設定
3. 「この条件で検索」を押す
4. 車ルートと所要時間が表示される
5. 公共交通と比較も試す

## 注意

- `file://`でHTMLを直接開くと、HTTPリファラー制限のためAPI認証に失敗する場合があります。
- 最初の確認はGitHub Pages上で行うのが確実です。
- 比較検索は車と公共交通の2回分の経路計算になります。
- 公共交通結果はGoogle側の交通データ提供状況に依存します。
