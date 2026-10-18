// sw.js - Service Worker v5 с поддержкой выбора моделей (LG, Samsung, Kentatsu, Ballu) и PWA
const CACHE_NAME = 'ac-3d-cache-v5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './style.css?v=5',
    './sound.js?v=5',
    './scene.js?v=5',
    './app.js?v=5',
    './conditioner/lg.jpg',
    './conditioner/samsung.jpg',
    './conditioner/kentatsu.jpg',
    './icons/apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.warn('Pre-cache warning:', err);
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия Network-First: если есть сеть, берем самое свежее; если нет (офлайн) — берем из кэша
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cached) => {
                    return cached || caches.match('./index.html');
                });
            })
    );
});
