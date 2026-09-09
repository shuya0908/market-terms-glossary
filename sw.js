// ホーム画面に追加した状態（standalone表示）では、iOS等のWebKitがページやfetchの
// レスポンスを非常に長く（場合によっては次に手動でアプリを消すまで）キャッシュしてしまい、
// GitHub Pages側は最新化されていてもアプリ側の表示が更新されないことがある。
// このService Workerは常にネットワークを優先し、取得できたレスポンスでキャッシュを
// 上書きすることで、オンライン時は常に最新のファイルを表示しつつ、オフライン時のみ
// 直近に取得できたキャッシュへフォールバックする（network-first）。
const CACHE_NAME = "market-terms-glossary-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./terms.json",
  "./changelog.json",
  "./manifest.json",
  "./icon.png",
];

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(CORE_ASSETS); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then(function(response){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        return response;
      })
      .catch(function(){ return caches.match(event.request); })
  );
});
