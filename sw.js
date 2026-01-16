/* ============================================
   SIDEQUEST DIGITAL - Service Worker
   Offline support and caching
   ============================================ */

const CACHE_NAME = 'sidequest-portal-v1';
const STATIC_CACHE_NAME = 'sidequest-static-v1';
const DYNAMIC_CACHE_NAME = 'sidequest-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/projects.html',
    '/leads.html',
    '/tickets.html',
    '/clients.html',
    '/archive.html',
    '/posts.html',
    '/project-detail.html',
    '/lead-detail.html',
    '/css/portal.css',
    '/css/theme.css',
    '/assets/logo.png',
    // External fonts
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap'
];

// Firebase SDK URLs (we'll cache these for offline)
const FIREBASE_ASSETS = [
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Cache Firebase SDK
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('[SW] Caching Firebase SDK');
                return cache.addAll(FIREBASE_ASSETS);
            })
        ]).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => {
                        return name.startsWith('sidequest-') &&
                               name !== STATIC_CACHE_NAME &&
                               name !== DYNAMIC_CACHE_NAME;
                    })
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Firebase API calls (they need to be live)
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('cloudfunctions.net')) {
        return;
    }

    // Strategy: Stale-while-revalidate for most resources
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            // Return cached response immediately if available
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    // Update cache with fresh response
                    if (networkResponse && networkResponse.status === 200) {
                        const cacheName = isStaticAsset(url) ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
                        caches.open(cacheName).then((cache) => {
                            cache.put(request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed, return cached or offline page
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                    return cachedResponse;
                });

            return cachedResponse || fetchPromise;
        })
    );
});

// Check if URL is a static asset
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com' ||
           url.hostname === 'www.gstatic.com';
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'New notification',
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Sidequest Portal', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open a new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// Background sync (for future use)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncMessages() {
    // This would sync any pending messages when back online
    console.log('[SW] Syncing messages...');
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data === 'clearCache') {
        caches.keys().then((names) => {
            names.forEach((name) => {
                if (name.startsWith('sidequest-')) {
                    caches.delete(name);
                }
            });
        });
    }
});
