/* 拾刻 TickVerse Service Worker（清单 M5-4）：离线可用。
 * 静态资源缓存优先 + 运行时缓存；页面导航网络优先、离线回退到应用壳。
 * 数据本身在 IndexedDB，不经 SW。
 */
const CACHE = 'tickverse-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  // 页面导航：网络优先，离线回退应用壳
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // 静态资源：缓存优先，未命中则网络并写入运行时缓存
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        }),
    ),
  );
});
