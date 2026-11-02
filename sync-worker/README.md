# 端末間同期サーバー（sync-worker）

マーケット用語ターミナルのマーク（ウォッチリスト）とクイズ成績を、同期キーで複数の端末に同期するためのサーバーです。Cloudflare Workers と Workers KV（無料枠で動きます）を使います。

このフォルダは GitHub Pages には配信されません（`.github/workflows/pages.yml` で配信するファイルを個別に指定しているため）。

## 仕組み

- `POST /v1/new`：新しい同期キー（16文字、例 `K7QP-M2XD-9WFA-3JRT`）を発行する。
- `POST /v1/pull`：同期キーに保存されている状態を返す。
- `POST /v1/push`：端末の状態を、保存済みの状態と合わせて保存し、合わせた結果を返す。
- 2台で同時に変更しても失われないよう、上書きではなく合わせる方式にしている。マークは用語ごとに最後の操作を採り、クイズ成績は端末ごとの累計を持って合計を表示する。
- 同期キーは URL に含めず本文で送る。KV にはキーそのものではなく SHA-256 のハッシュで保存する。
- 用語集のページ（`ALLOWED_ORIGINS`）からの通信だけを受け付ける。データの大きさと形式も制限している。

## デプロイ手順（Cloudflare のダッシュボードで行う場合）

画面の名前や配置は変わることがあります。見つからない場合は、Cloudflare の公式ドキュメント（Workers と KV）を参照してください。

1. Cloudflare のアカウントを作成する（無料プランでよい）。
2. **KV ネームスペースを作る**：ダッシュボードの「Storage & Databases」→「KV」で、ネームスペースを作成する（名前は例：`market-terms-sync`）。
3. **Worker を作る**：「Workers & Pages」→「Create」で Worker を新規作成する（名前は例：`market-terms-sync`）。いったんそのままデプロイし、「Edit code」でコードを `worker.js` の内容にすべて置き換えて、もう一度デプロイする。
4. **KV を Worker に結び付ける**：作った Worker の「Settings」→「Bindings」で「KV namespace」を追加し、変数名を `SYNC_KV`、ネームスペースを手順2のものにして保存する。
5. **（任意）受け付けるページを設定する**：「Settings」→「Variables and Secrets」でテキスト変数 `ALLOWED_ORIGINS` に `https://shuya0908.github.io` を設定する。設定しない場合もこの値が使われる。複数指定する場合はカンマで区切る。
6. Worker の URL（例：`https://market-terms-sync.<アカウント名>.workers.dev`）を控える。`index.html` の `SYNC_ENDPOINT` にこの URL を設定すると、用語集のページ下部に同期の欄が表示される。

## デプロイ手順（wrangler を使う場合）

1. `npx wrangler login`
2. `npx wrangler kv namespace create SYNC_KV` を実行し、表示された ID を `wrangler.toml` の `id` に書く。
3. このフォルダで `npx wrangler deploy` を実行する。

## 無料枠の目安

Workers KV の無料プランは、読み込み1日10万回、書き込み1日1,000回（同じキーへの書き込みは1秒に1回まで）。用語集のページは変更後1.5秒待ってまとめて送るので、個人の利用ではこの範囲に収まる。上限を超えた日はその日の同期が失敗し、翌日（UTCの0時）に戻る。最新の上限は Cloudflare の KV の料金・制限のページを確認すること。

## 注意

- 同期キーを知っている人は、そのキーのデータを読み書きできる。キーは他人に教えないこと。
- 同期の解除は端末側の設定を消すだけで、サーバーのデータは残る。
- Workers KV は世界中の拠点で結果整合（反映に最大60秒程度かかることがある）なので、2台でほぼ同時に操作した直後は、片方の変更が少し遅れて反映されることがある。
