// Service Worker for Sidequest Digital Portal
const CACHE_NAME = 'sidequest-portal-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/leads.html',
    '/projects.html',
    '/clients.html',
    '/tickets.html',
    '/posts.html',
    '/archive.html',
    '/css/portal.css',
    '/js/app.js',
    '/js/firebase-config.js',
    '/js/constants.js',
    '/js/components/loaders.js',
    '/js/components/filters.js',
    '/js/components/modals.js',
    '/js/pages/dashboard.js',
    '/js/pages/leads.js',
    '/js/pages/projects.js',
    '/js/pages/clients.js',
    '/js/pages/tickets.js',
    '/js/pages/posts.js',
    '/assets/logo.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('[SW] Cache install failed:', err))
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests (Firebase, etc.)
    if (url.origin !== location.origin) {
        return;
    }

    // Network first for HTML pages (always get fresh content)
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Cache first for static assets (JS, CSS, images)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Stale-while-revalidate for other requests
    event.respondWith(staleWhileRevalidate(request));
});

// Check if request is for a static asset
function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/.test(pathname);
}

// Network first strategy - try network, fall back to cache
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Return offline page if available
        return caches.match('/index.html');
    }
}

// Cache first strategy - try cache, fall back to network
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);

    const fetchPromise = fetch(request)
        .then(networkResponse => {
            if (networkResponse.ok) {
                const cache = caches.open(CACHE_NAME);
                cache.then(c => c.put(request, networkResponse.clone()));
            }
            return networkResponse;
        })
        .catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}
