/* Rutinas — Arranque de la app.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

// ---------- arranque ----------
document.querySelectorAll('.tabs button').forEach((b) => {
  b.addEventListener('click', () => { go(b.dataset.view === 'hoy' ? '#/' : '#/' + b.dataset.view); });
});
window.addEventListener('hashchange', () => {
  const sh = $('#sheet'); sh.classList.add('hidden'); sh.replaceChildren(); // no dejar la ventana abierta al cambiar de pagina
  render(); window.scrollTo(0, 0);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const s = $('#sheet'); s.classList.add('hidden'); s.replaceChildren(); } });
$('#t-plus').addEventListener('click', () => {
  if (!timerHandle) { startTimer(15); return; }
  timerEnd += 15000; timerTotal += 15; tick();
});
$('#t-skip').addEventListener('click', () => stopTimer(false));
$('#sw-btn').addEventListener('click', openStopwatch);
swHandle = setInterval(swUpdate, 500);

save();
render();
// Pide al navegador que no borre los datos de la app (controles, cardio) si falta espacio
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* sin soporte */ }

if (ghToken) {
  runSync();
  runPrivSync();
} else {
  fetch('data/sessions.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      if (!Array.isArray(list)) return;
      repoSessions = list;
      render();
    })
    .catch(() => { /* sin historial del repositorio */ });
}
loadNutrition();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadNutrition(); });
// Guardar antes de salir de la app y al recuperar la conexion
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (sync.status === 'pending') runSync(); if (priv.status === 'pending') runPrivSync(); } });
window.addEventListener('online', () => { if (ghToken && (sync.status === 'error' || sync.status === 'pending')) runSync(); if (ghToken && (priv.status === 'error' || priv.status === 'pending')) runPrivSync(); });

if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Buscar versiones nuevas al volver a la app
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => { /* sin offline */ });
  // Cuando se publica una version nueva, ofrecer actualizar (sin recargar a la fuerza a mitad de una serie)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || $('#update-bar')) return;
    document.body.append(h('div', { class: 'update-bar', id: 'update-bar', role: 'status' },
      h('span', {}, 'Hay una versión nueva de la app.'),
      h('button', { class: 'btn primary small', type: 'button', onclick: () => location.reload() }, 'Actualizar')));
  });
}

// Expuesto para pruebas
window.__rutinas = { mergeSessions: mergeSessions, plan: plan, sessionToMd: sessionToMd, getState: () => state };
