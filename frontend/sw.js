// ============================================================
// UKOPERASI — Service Worker (Cache First for static assets)
// ============================================================
const CACHE_NAME  = 'ukoperasi-v1';
const STATIC_URLS = [
  '/',
  '/pages/dashboard.html',
  '/pages/login.html',
  '/assets/css/app.css',
  '/assets/js/app.js',
  '/assets/js/api.js',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(err => {
      return new Response(JSON.stringify({ success: false, message: "Koneksi ke backend gagal / server sedang mati" }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // Cache-first for static
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        if(response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(err => {
          return new Response(`<h2>Koneksi Terputus</h2> <p>Pastikan perintah "npx serve . -p 8080" sedang berjalan di terminal dan tidak tertutup/berhenti.</p>`, {
              headers: {'Content-Type': 'text/html'}
          });
      })
    )
  );
});
