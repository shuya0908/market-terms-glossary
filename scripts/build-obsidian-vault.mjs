// terms.json から Obsidian の Vault（obsidian-vault/）を生成する。
// 使い方: node scripts/build-obsidian-vault.mjs
//
// - 用語ごとに 用語/<見出し>.md を作り、対義語（ant）・関連語（rel）を [[リンク]] にする（グラフの基本の線）。
// - 説明文に他の用語名が出てくる関係は、説明文の用語/<見出し>（説明文）.md という中継ノートを経由してリンクする。
//   グラフビューの検索欄の -path:説明文の用語 を消すと表示され、付けると隠れる。
// - カテゴリ/<カテゴリ名>.md に、カテゴリごとの用語一覧を作る。
// 生成のたびに obsidian-vault/ の中身（.obsidian/ 以外）を作り直す。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "obsidian-vault");
const DIR_TERM = "用語";
const DIR_MENTION = "説明文の用語";
const DIR_CAT = "カテゴリ";
// これより多くの説明文に出てくる用語名は、説明文からのリンクを張らない（「債券」などが全体の中心を占めるため）
const MENTION_DF_MAX = 30;

const terms = JSON.parse(fs.readFileSync(path.join(ROOT, "terms.json"), "utf8"));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// index.html の CATS からカテゴリの並び順とラベルを読む
const catBlock = html.match(/var CATS = \{([\s\S]*?)\};/)[1];
const CATS = [...catBlock.matchAll(/(\w+):\s*\{\s*label:"([^"]*)",\s*hue:(\d+)/g)]
  .map(m => ({ key: m[1], label: m[2], hue: Number(m[3]) }));
const catLabel = Object.fromEntries(CATS.map(c => [c.key, c.label]));

const shortName = t => t.replace(/[（(].*$/, "").trim();
const aliasesOf = t => {
  const m = t.match(/[（(]([^）)]+)[）)]/);
  return m ? m[1].split(/[、,]/).map(s => s.trim()).filter(Boolean) : [];
};
// Obsidian のファイル名に使えない文字を全角に置き換える
const fileName = s => s.replace(/[\\/:*?"<>|#^\[\]]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));

// 見出し → ノート名（括弧の前の短い名前。重複したら見出し全体を使う）
const shortCount = {};
terms.forEach(x => { const s = shortName(x.t); shortCount[s] = (shortCount[s] || 0) + 1; });
const noteName = new Map(terms.map(x => [x.t, fileName(shortCount[shortName(x.t)] > 1 ? x.t : shortName(x.t))]));
const link = t => {
  const n = noteName.get(t), s = shortName(t);
  return `[[${DIR_TERM}/${n}|${s}]]`;
};

// 説明文に出てくる他の用語（最長一致。カタカナ・英数字の語は前後が同じ文字種なら一致とみなさない）
const isKana = c => /[゠-ヿ]/.test(c);
const isAlnum = c => /[A-Za-z0-9]/.test(c);
const names = terms.map(x => ({ t: x.t, n: shortName(x.t) })).filter(o => [...o.n].length >= 2 && shortCount[o.n] === 1);
function mentionsIn(x) {
  const d = x.d, found = new Set();
  for (let i = 0; i < d.length;) {
    let best = null;
    for (const o of names) {
      if (o.t === x.t || !d.startsWith(o.n, i)) continue;
      const before = d[i - 1] || "", after = d[i + o.n.length] || "";
      const first = o.n[0], last = o.n[o.n.length - 1];
      if ((isKana(first) && isKana(before)) || (isKana(last) && isKana(after))) continue;
      if ((isAlnum(first) && isAlnum(before)) || (isAlnum(last) && isAlnum(after))) continue;
      if (!best || o.n.length > best.n.length) best = o;
    }
    if (best) { found.add(best.t); i += best.n.length; } else i++;
  }
  return [...found];
}
const mentions = new Map(terms.map(x => [x.t, mentionsIn(x)]));
const df = {};
mentions.forEach(ts => ts.forEach(t => { df[t] = (df[t] || 0) + 1; }));
mentions.forEach((ts, k) => mentions.set(k, ts.filter(t => df[t] <= MENTION_DF_MAX)));

// 出力先を作り直す（.obsidian/ の利用者設定は残す）
fs.mkdirSync(OUT, { recursive: true });
for (const e of fs.readdirSync(OUT)) if (e !== ".obsidian") fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
for (const d of [DIR_TERM, DIR_MENTION, DIR_CAT]) fs.mkdirSync(path.join(OUT, d));

const yamlStr = s => JSON.stringify(s);
for (const x of terms) {
  const n = noteName.get(x.t), lines = [];
  const aliases = [...new Set([x.t, ...aliasesOf(x.t)])].filter(a => a !== n);
  lines.push("---");
  if (aliases.length) lines.push(`aliases: [${aliases.map(yamlStr).join(", ")}]`);
  lines.push(`読み: ${yamlStr(x.k)}`, `カテゴリ: ${yamlStr(catLabel[x.c] || x.c)}`, `tags: [${yamlStr("cat/" + x.c)}]`, "---", "");
  lines.push(`# ${x.t}`, "", x.d, "");
  if ((x.ant || []).length) lines.push(`- 対義語：${x.ant.map(link).join("、")}`);
  if ((x.rel || []).length) lines.push(`- 関連語：${x.rel.map(link).join("、")}`);
  if ((x.ant || []).length || (x.rel || []).length) lines.push("");
  if (x.s) lines.push(`> [!example] 実務シーン`, `> ${x.s}`, "");
  lines.push(`カテゴリ：[[${DIR_CAT}/${fileName(catLabel[x.c] || x.c)}|${catLabel[x.c] || x.c}]]`);
  if (mentions.get(x.t).length) lines.push(`説明文に出てくる用語：[[${DIR_MENTION}/${n}（説明文）|一覧]]`);
  fs.writeFileSync(path.join(OUT, DIR_TERM, n + ".md"), lines.join("\n") + "\n");

  const ms = mentions.get(x.t);
  if (ms.length) {
    fs.writeFileSync(path.join(OUT, DIR_MENTION, n + "（説明文）.md"),
      ["---", `tags: ["mention"]`, "---", "", `# ${shortName(x.t)} の説明文に出てくる用語`, "",
        `元の用語：${link(x.t)}`, "", ...ms.map(t => `- ${link(t)}`)].join("\n") + "\n");
  }
}

for (const c of CATS) {
  const ts = terms.filter(x => x.c === c.key);
  if (!ts.length) continue;
  fs.writeFileSync(path.join(OUT, DIR_CAT, fileName(c.label) + ".md"),
    ["---", `tags: ["category"]`, "---", "", `# ${c.label}`, "", `${ts.length}語`, "",
      ...ts.map(x => `- ${link(x.t)}`)].join("\n") + "\n");
}

fs.writeFileSync(path.join(OUT, "はじめに.md"), `# マーケット用語 Vault

[マーケット用語ターミナル](https://shuya0908.github.io/market-terms-glossary/) の \`terms.json\` から自動生成したノートです（${terms.length}語）。直接編集しても、次の生成で上書きされます。

- \`${DIR_TERM}/\`：1用語1ノート。対義語・関連語をリンクにしています。
- \`${DIR_CAT}/\`：カテゴリごとの用語一覧。
- \`${DIR_MENTION}/\`：説明文に他の用語名が出てくる関係（${MENTION_DF_MAX}を超える数の説明文に出てくる用語名は除いています）。

## グラフビューの見方

最初は、対義語・関連語の線だけを表示する設定になっています（検索欄に \`-path:${DIR_MENTION} -path:${DIR_CAT}\`）。

- 説明文に出てくる用語の線も見る：検索欄から \`-path:${DIR_MENTION}\` を消します。用語どうしが中継ノートを経由してつながります。
- カテゴリの一覧ノートも見る：検索欄から \`-path:${DIR_CAT}\` を消します。
- 色はカテゴリごとに分けています（グループの設定）。

## カテゴリ

${CATS.filter(c => terms.some(x => x.c === c.key)).map(c => `- [[${DIR_CAT}/${fileName(c.label)}|${c.label}]]`).join("\n")}
`);

// グラフビューの初期設定（初回だけ作る。利用者が変えた設定は上書きしない）
const graphPath = path.join(OUT, ".obsidian", "graph.json");
if (!fs.existsSync(graphPath)) {
  const hsl = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))); return (f(0) << 16) + (f(8) << 8) + f(4); };
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  fs.writeFileSync(graphPath, JSON.stringify({
    search: `-path:${DIR_MENTION} -path:${DIR_CAT}`,
    showTags: false, showAttachments: false, hideUnresolved: true, showOrphans: true,
    showArrow: false, textFadeMultiplier: 0, nodeSizeMultiplier: 1, lineSizeMultiplier: 1,
    colorGroups: [
      { query: `path:${DIR_MENTION}`, color: { a: 1, rgb: 0x999999 } },
      ...CATS.map(c => ({ query: `tag:#cat/${c.key}`, color: { a: 1, rgb: hsl(c.hue, 60, 50) } })),
    ],
  }, null, 2) + "\n");
}

const edges = terms.reduce((s, x) => s + (x.ant || []).length + (x.rel || []).length, 0) / 2;
const mentionEdges = [...mentions.values()].reduce((s, ts) => s + ts.length, 0);
console.log(`${terms.length}語、対義語・関連語 ${edges}組、説明文からのリンク ${mentionEdges}本を ${path.relative(ROOT, OUT)}/ に生成しました`);
