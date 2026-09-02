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
