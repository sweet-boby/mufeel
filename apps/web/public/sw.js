/**
 * Service Worker：让应用在离线时也能打开。
 *
 * 策略刻意简单：
 *   * 钢琴采样（public/samples/piano/*.mp3，约 1.8 MB）是重资产且永不变化 —— 缓存优先；
 *   * 其余同源 GET 走「网络优先，失败回落缓存」，这样发版后不会一直吃旧壳；
 *   * 跨域请求一律放过（本项目没有任何跨域依赖，留着只是为了不制造怪问题）。
 */

const CACHE = 'yuegan-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isSample = url.pathname.includes('/samples/');

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: isSample });
      if (cached !== undefined && isSample) {
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          void cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (cached !== undefined) {
          return cached;
        }
        throw error;
      }
    }),
  );
});
