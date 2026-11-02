// マーケット用語ターミナルの端末間同期サーバー（Cloudflare Workers + Workers KV）。
//
// 同期キーごとに、マーク（ウォッチリスト）とクイズ成績を保存する。
//   POST /v1/new   {}                 → 新しい同期キーを発行する { key }
//   POST /v1/pull  { key }            → 保存されている状態を返す { state, updatedAt }
//   POST /v1/push  { key, state }     → 保存済みの状態と合わせて保存し、合わせた結果を返す
//
// 状態（state）の形式：
//   { v: 1,
//     marks: { "<用語ID>": [付けている=1 / 外した=0, 最後に操作した時刻(ms)] },
//     stats: { "<端末ID>": [その端末で解いた問題数, そのうち正解数] } }
//
// 2台で同時に変更しても失われないよう、上書きではなく「合わせる」方式で保存する。
// マークは用語ごとに最後の操作を採用し、成績は端末ごとの累計（増えるだけ）を大きい方で採る。
// 同期キーは URL に含めず本文で受け取り、KV にはキーそのものではなく SHA-256 のハッシュで保存する。

const KEY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 0/1/I/O を除いた32文字
const KEY_LENGTH = 16;                                     // 32^16 = 2^80 通り
const KEY_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/;
const TERM_ID_RE = /^(b\d{1,5}|c[0-9a-z]{1,32})$/;
const DEVICE_ID_RE = /^[a-z0-9]{8,32}$/;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MARKS = 5000;
const MAX_DEVICES = 50;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "https://shuya0908.github.io")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin) ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    } : { "Vary": "Origin" };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!allowed.includes(origin)) return json({ error: "origin_not_allowed" }, 403, cors);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    const path = new URL(request.url).pathname;
    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, cors);
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      return json({ error: "bad_json" }, 400, cors);
    }

    if (path === "/v1/new") {
      const key = newKey();
      const record = { state: emptyState(), updatedAt: Date.now() };
      await env.SYNC_KV.put(await storageKey(key), JSON.stringify(record));
      return json({ key }, 200, cors);
    }

    const key = typeof body.key === "string" ? body.key : "";
    if (!KEY_RE.test(key)) return json({ error: "bad_key" }, 400, cors);
    const sk = await storageKey(key);
    const stored = await env.SYNC_KV.get(sk);
    if (!stored) return json({ error: "unknown_key" }, 404, cors);
    const current = JSON.parse(stored);

    if (path === "/v1/pull") return json(current, 200, cors);

    if (path === "/v1/push") {
      const incoming = sanitize(body.state);
      if (!incoming) return json({ error: "bad_state" }, 400, cors);
      const merged = mergeState(sanitize(current.state) || emptyState(), incoming);
      if (Object.keys(merged.marks).length > MAX_MARKS || Object.keys(merged.stats).length > MAX_DEVICES) {
        return json({ error: "too_large" }, 413, cors);
      }
      const record = { state: merged, updatedAt: Date.now() };
      await env.SYNC_KV.put(sk, JSON.stringify(record));
      return json(record, 200, cors);
    }

    return json({ error: "not_found" }, 404, cors);
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function newKey() {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += KEY_ALPHABET[b & 31];
  return s;
}

async function storageKey(key) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return "s:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function emptyState() {
  return { v: 1, marks: {}, stats: {} };
}

// 受け取った状態から、形式に合う項目だけを取り出す（合わないものは捨てる）
function sanitize(s) {
  if (!s || typeof s !== "object") return null;
  const out = emptyState();
  const marks = s.marks && typeof s.marks === "object" ? s.marks : {};
  const stats = s.stats && typeof s.stats === "object" ? s.stats : {};
  for (const id of Object.keys(marks)) {
    const e = marks[id];
    if (!TERM_ID_RE.test(id) || !Array.isArray(e) || e.length !== 2) continue;
    if ((e[0] !== 0 && e[0] !== 1) || !Number.isFinite(e[1]) || e[1] < 0) continue;
    out.marks[id] = [e[0], Math.floor(e[1])];
  }
  for (const dev of Object.keys(stats)) {
    const e = stats[dev];
    if (!DEVICE_ID_RE.test(dev) || !Array.isArray(e) || e.length !== 2) continue;
    const a = Math.floor(e[0]), c = Math.floor(e[1]);
    if (!Number.isFinite(a) || !Number.isFinite(c) || a < 0 || c < 0 || c > a) continue;
    out.stats[dev] = [a, c];
  }
  return out;
}

function mergeState(a, b) {
  const out = emptyState();
  for (const id of new Set([...Object.keys(a.marks), ...Object.keys(b.marks)])) {
    const x = a.marks[id], y = b.marks[id];
    out.marks[id] = !x ? y : !y ? x : (y[1] > x[1] || (y[1] === x[1] && y[0] === 1)) ? y : x;
  }
  for (const dev of new Set([...Object.keys(a.stats), ...Object.keys(b.stats)])) {
    const x = a.stats[dev], y = b.stats[dev];
    out.stats[dev] = !x ? y : !y ? x : (y[0] > x[0] ? y : x);
  }
  return out;
}
