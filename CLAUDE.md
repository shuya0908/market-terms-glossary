# CLAUDE.md

このリポジトリは `marketterms.html` を中心とした単一ページのWebアプリ（マーケット用語ターミナル）です。

## Artifactとの同期（重要）

このアプリは以下のClaude Artifactとしても公開されています。

https://claude.ai/code/artifact/1f6a23bb-decd-4610-9d4b-354ca3267fc3

**`marketterms.html` / `terms.json` / `manifest.json` / `icon.png` のいずれかに変更を加えてコミットした場合は、同じ内容を必ず上記URLにも再公開してください。**（Artifactツールの publish アクションで、`url` に上記URLを指定して同一アーティファクトを更新する。）

これにより、リポジトリへの変更が自動的にArtifact URLへ反映される。

### Artifact版とリポジトリ版の違い

Artifactは単一HTMLファイルとしてのみ公開できる制約があるため、リポジトリ版とは実装が一部異なる。反映時は以下の変換が必要:

- `terms.json` の内容は、リポジトリ版の `fetch("terms.json")` ではなく、`BUILTIN_GLOSSARY` 配列としてHTML内に直接インライン化する（Artifactは外部ファイルをfetchできないため）。
- `icon.png` は `<link rel="apple-touch-icon">` で参照する際、ファイルパスではなく `data:image/png;base64,...` のdata URIとして埋め込む。
- `manifest.json` はArtifact版には含めない（`<link rel="manifest">` を追加しない）。data URI化すると1行が5万文字を超え、Artifactツールの `read` が1回のRead呼び出しでは読めなくなり、以後の同期作業が行えなくなるため。iPhoneのSafariでの「ホーム画面に追加」自体はmanifest.jsonなしでも`apple-mobile-web-app-*` 系のmetaタグだけで機能する。
- それ以外のロジック（検索・クイズ・マーク・バックアップなど）はリポジトリ版と同一の内容にする。

Artifactを再公開する前に、必ずArtifactツールの `read` アクションで現在公開されているバージョンの全行を読み、差分をマージすること（未読のまま publish すると拒否される）。BUILTIN_GLOSSARY配列など、リポジトリ側にない変更がArtifact側に直接加えられていることがあるため、単純な上書きはせず、差分を確認したうえでリポジトリ側にも反映すること。

`icon.png`をdata URI化した行（apple-touch-icon・icon）はそれぞれ約1.9万文字で、Readツール1回の上限（25000トークン）にほぼ収まる。万一収まらなくなった場合は、アイコンのファイルサイズを縮小すること。

## 用語を追加する際のカテゴリ見直し（重要）

`terms.json` に新しい用語を追加するたびに、追加した用語だけでなく **用語集全体のカテゴリ分類を見直すこと**。具体的には:

- 新しい用語がどのカテゴリ（`marketterms.html` の `CATS` に定義された `board` / `order` / `market` / `clearing` / `derivative` / `tech` / `compliance` / `front` / `middle` / `back` / `fx` / `bond` / `quant` / `margin` など）に属するかを機械的に決めるのではなく、既存の同カテゴリの用語群と並べて意味的に一貫しているか確認する。カテゴリの正確な一覧は、都度 `marketterms.html` の `CATS` オブジェクトを確認すること（このリストは例示であり、新カテゴリ追加時にここを更新し忘れても実害はない）。
- 追加によって、既存の用語のカテゴリ分けが相対的に不自然になっていないか（例：あるカテゴリに新設した概念グループが増えたことで、既存の類似用語がそのカテゴリへ移した方が一貫性が高くなる、逆に既存カテゴリに収まりきらなくなった、など）を確認し、必要なら既存用語のカテゴリも一緒に変更する。
- 既存のカテゴリでは意味的に無理がある場合は、新しいカテゴリを追加してよい（追加する際は `marketterms.html` の `CATS` オブジェクトに `label` と重複しない `hue` を定義する）。
- カテゴリ変更は `terms.json` の `c` フィールドのみで表現され、`marketterms.html` 側にカテゴリ別の用語リストは存在しない（`CATS` はラベル・色の定義のみ）。そのため用語のカテゴリを変更する場合は `terms.json` を編集するだけでよいが、新カテゴリを追加した場合は `marketterms.html` の `CATS` とREADME.mdのカテゴリ一覧の説明も合わせて更新すること。
- カテゴリを見直した結果は、Artifact同期（上記）の対象にも含まれる。`terms.json`のカテゴリ変更も「`terms.json` への変更」に該当するため、Artifact側の`BUILTIN_GLOSSARY`にも必ず反映すること。

## 用語カードの並び順

用語集（GLOSSARY）画面・マーク済み（WATCHLIST）画面の用語カードは、**カテゴリ順にグループ化して表示する**。実装は `marketterms.html` の `sortByCategory()`（`CAT_ORDER = Object.keys(CATS)` の順で並べ替え）で、`renderGlossary()` と `renderMarked()` の両方から呼び出している。

- 新しいカテゴリを `CATS` に追加する際は、そのカテゴリが並び順のどこに来てほしいかを意識して `CATS` オブジェクト内の追加位置（キーの並び順）を決めること。`CATS` はJavaScriptのオブジェクトなので、キーの定義順がそのまま `Object.keys(CATS)` の順序になり、カード表示順・カテゴリフィルターのチップ表示順の両方に影響する。
- `terms.json`（`BUILTIN_GLOSSARY`）内での用語エントリ自体の並び順はこの表示順に影響しない（表示時に毎回 `sortByCategory()` でソートし直すため）。そのため用語追加時に配列内のどこに挿入するかは、可読性のために近いカテゴリの近くに置く程度でよく、厳密な並び替えは不要。

## 用語を追加する際の参考文献の更新（重要）

`terms.json` に新しい用語を追加する際、その用語の情報源とした参考文献（Webサイト・記事など）を、`marketterms.html` の用語集画面下部にある「参考文献」セクション（`<div class="refs">` 内の `<ul>`）にも追加すること。

- 追加する用語のカテゴリに対応する参考文献が既にリストにある場合（例: 証券用語一般なら日本取引所グループや野村證券の用語集）は、重複して追加しなくてよい。
- 新しい分野・出典（例: 特定の業界団体の公式サイト、専門解説サイトなど）から用語を追加した場合は、その出典を1件追加する。個別記事へのディープリンクではなく、なるべく安定した（リンク切れしにくい）トップページ・用語集トップ・公式ドキュメントのURLを選ぶこと。
- リンクを追加する前に、実際にアクセス可能でリンク切れでないことを確認すること（このセッションでは`WebFetch`が使えない場合があるため、`WebSearch`等で存在を確認できれば足りる）。
- この変更も `marketterms.html` への変更に該当するため、Artifact同期（上記）の対象に含まれる。
