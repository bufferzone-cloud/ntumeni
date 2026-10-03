const CACHE_VERSION = 'ntumeni-v1';
const SHELL_CACHE   = CACHE_VERSION + '-shell';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const SHELL_FILES = [
    './',
    './index.html',
    './manifest.json',
    './logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) =>
            Promise.all(
                SHELL_FILES.map((url) =>
                    cache.add(new Request(url, { cache: 'reload' }))
                        .catch(() => null)
                )
            )
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) {
                        return caches.delete(key);
                    }
                })
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isFirebaseOrCloudinary(url) {
    return url.includes('firebaseio.com') ||
           url.includes('googleapis.com') ||
           url.includes('firebaseapp.com') ||
           url.includes('cloudinary.com') ||
           url.includes('gstatic.com/firebasejs') ||
           url.includes('upload-widget.cloudinary.com');
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    if (isFirebaseOrCloudinary(req.url)) return;
    if (url.origin.includes('firebase')) return;

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
                    return res;
                })
                .catch(() =>
                    caches.match('./index.html').then((r) => r || caches.match('./'))
                )
        );
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(req).then((cached) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.status === 200) {
                            const copy = res.clone();
                            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
                        }
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req)
                .then((res) => {
                    if (res && res.status === 200) {
                        const copy = res.clone();
                        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
