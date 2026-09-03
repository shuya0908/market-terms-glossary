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

- 新しい用語がどのカテゴリ（`marketterms.html` の `CATS` に定義された `board` / `order` / `market` / `clearing` / `derivative` / `tech` / `compliance` / `front` / `middle` / `back` / `fx` / `bond` / `quant` など）に属するかを機械的に決めるのではなく、既存の同カテゴリの用語群と並べて意味的に一貫しているか確認する。
- 追加によって、既存の用語のカテゴリ分けが相対的に不自然になっていないか（例：あるカテゴリに新設した概念グループが増えたことで、既存の類似用語がそのカテゴリへ移した方が一貫性が高くなる、逆に既存カテゴリに収まりきらなくなった、など）を確認し、必要なら既存用語のカテゴリも一緒に変更する。
- 既存のカテゴリでは意味的に無理がある場合は、新しいカテゴリを追加してよい（追加する際は `marketterms.html` の `CATS` オブジェクトに `label` と重複しない `hue` を定義する）。
- カテゴリ変更は `terms.json` の `c` フィールドのみで表現され、`marketterms.html` 側にカテゴリ別の用語リストは存在しない（`CATS` はラベル・色の定義のみ）。そのため用語のカテゴリを変更する場合は `terms.json` を編集するだけでよいが、新カテゴリを追加した場合は `marketterms.html` の `CATS` とREADME.mdのカテゴリ一覧の説明も合わせて更新すること。
- カテゴリを見直した結果は、Artifact同期（上記）の対象にも含まれる。`terms.json`のカテゴリ変更も「`terms.json` への変更」に該当するため、Artifact側の`BUILTIN_GLOSSARY`にも必ず反映すること。
