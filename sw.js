const CACHE = 'rutinas-v11';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/routine.js',
  './js/app.js',
  './manifest.webmanifest',
  './data/sessions.json',
  './icons/icon.svg'
].concat(
  // Imagen principal de cada ejercicio, para usar la app sin conexion
  ["abductores-0.jpg", "aperturas-peck-deck-0.jpg", "cruce-poleas-0.jpg", "crunch-maquina-0.jpg", "crunch-polea-0.jpg", "curl-barra-0.jpg", "curl-femoral-0.jpg", "curl-inclinado-0.jpg", "curl-martillo-0.jpg", "curl-predicador-0.jpg", "elevacion-piernas-0.jpg", "elevaciones-laterales-0.jpg", "elevaciones-laterales-polea-0.jpg", "encogimientos-0.jpg", "extension-cuadriceps-0.jpg", "extension-lumbar-0.jpg", "extension-polea-0.jpg", "extension-sobre-cabeza-0.jpg", "face-pull-0.jpg", "fondos-asistidos-0.jpg", "fondos-banco-0.jpg", "hip-thrust-0.jpg", "jalon-pecho-0.jpg", "pajaros-0.jpg", "pantorrillas-0.jpg", "patada-gluteo-0.jpg", "plancha-0.jpg", "prensa-0.jpg", "press-frances-0.jpg", "press-hombro-maquina-0.jpg", "press-inclinado-0.jpg", "press-pecho-maquina-0.jpg", "pullover-polea-0.jpg", "remo-mancuerna-0.jpg", "remo-maquina-0.jpg", "rotacion-polea-0.jpg", "sentadilla-pendular-0.jpg"].map((f) => './img/ex/' + f)
);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero para recibir actualizaciones; si no hay conexion, usa la cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // no-cache: revalida con el servidor y evita servir una copia vieja de la cache HTTP del navegador
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
