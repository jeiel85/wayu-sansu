// 빌드 시 vite.config.js의 swPrecacheManifest가 아래 두 줄을 채운다
const BUILD_ID = 'dev';
const BUILD_ASSETS = [];

const CACHE_NAME = `wayu-sansu-pwa-${BUILD_ID}`;
// 주소에 해시가 없는 파일. 내용이 바뀌어도 주소가 같아서, 그냥 받으면 HTTP 캐시(Pages 10분)에 남은 옛 파일이
// 새 빌드 캐시에 들어가 캐시 우선으로 나간다(manifest id를 고쳐도 Chrome이 옛 id를 보던 문제).
// 그래서 설치 때 HTTP 캐시를 건너뛰고 새로 받는다. BUILD_ASSETS는 파일 이름에 해시가 붙어 그대로 받는다.
const UNHASHED_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon.svg'
];
const PRECACHE_ASSETS = [
  ...UNHASHED_ASSETS.map((url) => new Request(url, { cache: 'reload' })),
  ...BUILD_ASSETS
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip Vite dev-server internal HMR / module requests
  if (
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@fs') ||
    url.pathname.includes('/node_modules/.vite') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  // Navigation requests: Network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Static assets & fonts: Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
