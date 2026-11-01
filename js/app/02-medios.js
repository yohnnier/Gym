/* Rutinas — Imágenes, temporizador, banda de pulso, intervalos guiados y cronómetro.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

// ---------- imagenes ----------
function imgSrc(ex, i) { return (i === 0 && ((photos[ex.id] && photos[ex.id][0]) || (ex.gym && 'img/ex/' + ex.id + '-gym.jpg'))) || 'img/ex/' + ex.id + '-' + (i || 0) + '.jpg'; }
// Respaldo: si un ejercicio aun no tiene foto, evita la imagen rota con un marcador neutro.
const IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
  '<rect width="200" height="200" fill="#e9eef5"/>' +
  '<path d="M100 66a22 22 0 1 0 0 44 22 22 0 0 0 0-44zm-52 86c0-23 23-36 52-36s52 13 52 36v6H48z" fill="#b9c4d4"/>' +
  '</svg>');
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.src.indexOf('img/ex/') !== -1 && t.src !== IMG_PLACEHOLDER) {
    t.src = IMG_PLACEHOLDER;
  }
}, true);

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// Galeria de un ejercicio: imagenes de referencia (inicio y final) + tus fotos
function galleryOf(ex) {
  const items = [{ src: 'img/ex/' + ex.id + '-0.jpg', label: ex.single ? 'Máquina del gimnasio' : 'Inicio del movimiento', own: -1 }];
  if (!ex.single) {
    items.push({ src: 'img/ex/' + ex.id + '-1.jpg', label: 'Final del movimiento', own: -1 });
    // Animacion: alterna suavemente inicio y final para ver la dinamica del movimiento
    items.push({ src: 'img/ex/' + ex.id + '-0.jpg', src2: 'img/ex/' + ex.id + '-1.jpg', anim: true, label: 'Animación del movimiento', own: -1 });
  }
  if (ex.gym) items.unshift({ src: 'img/ex/' + ex.id + '-gym.jpg', label: 'Máquina de tu gimnasio', own: -1 });
  (photos[ex.id] || []).forEach((u, k) => items.push({ src: u, label: 'Tu foto ' + (k + 1), own: k }));
  return items;
}

// Foto a pantalla completa: toca para acercar, desliza o usa las flechas para cambiar de foto
function animPair(it, name) {
  return h('div', { class: 'anim-pair' },
    h('img', { src: it.src, alt: name + ' — inicio' }), h('img', { class: 'b', src: it.src2, alt: name + ' — final' }));
}
function openLightbox(ex, items, start) {
  let i = start, zoom = false, x0 = null;
  let img = h('img', { alt: '' });
  const wrap = h('div', { class: 'lb-scroll' }, img);
  const cap = h('div', { class: 'lb-cap' });
  const paint = () => {
    const it = items[i];
    img = it.anim ? animPair(it, ex.name) : h('img', { src: it.src, alt: ex.name + ' — ' + it.label });
    img.addEventListener('click', () => { zoom = !zoom; img.classList.toggle('zoom', zoom); });
    wrap.replaceChildren(img);
    cap.textContent = ex.name + ' · ' + it.label + ' (' + (i + 1) + '/' + items.length + ')';
    zoom = false; wrap.scrollTo(0, 0);
  };
  const go = (d) => { const n = i + d; if (n < 0 || n >= items.length) return; i = n; paint(); };
  const close = () => { document.removeEventListener('keydown', onKey, true); box.remove(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1);
  };
  wrap.addEventListener('touchstart', (e) => { x0 = !zoom && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  });
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': ex.name },
    h('button', { class: 'lb-x', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×'),
    items.length > 1 ? h('button', { class: 'lb-nav prev', type: 'button', 'aria-label': 'Foto anterior', onclick: () => go(-1) }, '‹') : null,
    items.length > 1 ? h('button', { class: 'lb-nav next', type: 'button', 'aria-label': 'Foto siguiente', onclick: () => go(1) }, '›') : null,
    wrap, cap, h('div', { class: 'lb-hint' }, 'Toca la foto para acercar'));
  document.addEventListener('keydown', onKey, true);
  paint();
  document.body.append(box);
}

function openSheet(ex, startAt) {
  const sheet = $('#sheet');
  const close = () => { sheet.classList.add('hidden'); sheet.replaceChildren(); };
  const items = galleryOf(ex);
  let cur = Math.max(0, Math.min(startAt || 0, items.length - 1));
  const fileInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0]; fileInput.value = '';
    if (!f) return;
    if ((photos[ex.id] || []).length >= 8) { toast('Máximo 8 fotos por ejercicio.'); return; }
    resizeImage(f, 900).then((url) => {
      (photos[ex.id] = photos[ex.id] || []).push(url);
      if (!savePhotos()) { photos[ex.id].pop(); toast('No hay espacio para guardar la foto.'); return; }
      toast('Foto agregada.');
      render(); openSheet(ex, galleryOf(ex).length - 1);
    }).catch(() => toast('No se pudo leer la imagen.'));
  });

  const track = h('div', { class: 'gal-track' }, items.map((it, k) =>
    h('button', { class: 'gal-slide', type: 'button', 'aria-label': 'Ampliar: ' + it.label, onclick: () => openLightbox(ex, items, k) },
      it.anim ? animPair(it, ex.name) : h('img', { src: it.src, alt: ex.name + ' — ' + it.label, loading: 'lazy' }))));
  const dots = h('div', { class: 'gal-dots' }, items.map((it, k) => h('i', { onclick: () => goTo(k) })));
  const cap = h('p', { class: 'muted small gal-cap' });
  const delBtn = h('button', { class: 'btn big danger', type: 'button', onclick: () => {
    const it = items[cur];
    if (it.own < 0 || !confirm('¿Eliminar esta foto?')) return;
    photos[ex.id].splice(it.own, 1); savePhotos(); toast('Foto eliminada.');
    render(); openSheet(ex, Math.max(0, cur - 1));
  } }, 'Eliminar esta foto');
  const sync = () => {
    cap.textContent = items[cur].label + ' · ' + (cur + 1) + ' de ' + items.length + (items.length > 1 ? ' — desliza para ver más' : '');
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === cur));
    delBtn.style.display = items[cur].own >= 0 ? '' : 'none';
  };
  const goTo = (k) => { cur = Math.max(0, Math.min(k, items.length - 1)); track.scrollTo({ left: cur * track.clientWidth, behavior: 'smooth' }); sync(); };
  track.addEventListener('scroll', () => { const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (k !== cur) { cur = k; sync(); } });

  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': ex.name },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'row between' },
      h('h2', {}, ex.name),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×')),
    h('div', { class: 'gal' },
      track,
      items.length > 1 ? h('button', { class: 'gal-nav prev', type: 'button', 'aria-label': 'Foto anterior', onclick: () => goTo(cur - 1) }, '‹') : null,
      items.length > 1 ? h('button', { class: 'gal-nav next', type: 'button', 'aria-label': 'Foto siguiente', onclick: () => goTo(cur + 1) }, '›') : null),
    items.length > 1 ? dots : null, cap,
    h('p', { class: 'muted small' }, 'Toca una foto para verla en grande. Las imágenes de referencia pueden verse distintas a la máquina de tu gimnasio; agrega tus propias fotos del movimiento (se guardan solo en este dispositivo).'),
    ex.notes ? h('p', { class: 'note' }, ex.notes) : null,
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary big', type: 'button', onclick: () => fileInput.click() }, '＋ Agregar foto'),
      delBtn),
    fileInput,
    h('p', { class: 'credit' }, 'Imágenes de referencia: free-exercise-db (dominio público).'));
  sheet.replaceChildren(h('div', { class: 'sheet-bg', onclick: close }), panel);
  sheet.classList.remove('hidden');
  sync();
  if (cur) track.scrollLeft = cur * track.clientWidth;
}

// ---------- temporizador ----------
let timerEnd = 0, timerTotal = 0, timerHandle = null, audioCtx = null, hideToken = 0;

function ensureAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !audioCtx) audioCtx = new AC();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* sin audio */ }
}

function startTimer(sec) {
  ensureAudio();
  hideToken++;
  timerTotal = sec;
  timerEnd = Date.now() + sec * 1000;
  $('#timer').classList.remove('hidden');
  if (!timerHandle) timerHandle = setInterval(tick, 250);
  tick();
}

function tick() {
  const left = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
  $('#t-time').textContent = mmss(left);
  $('#t-bar').style.width = (timerTotal ? 100 * (1 - left / timerTotal) : 100) + '%';
  if (left <= 0) stopTimer(true);
}

function stopTimer(finished) {
  clearInterval(timerHandle);
  timerHandle = null;
  if (!finished) { $('#timer').classList.add('hidden'); return; }
  $('#t-time').textContent = '¡A la siguiente!';
  beep();
  const token = ++hideToken;
  setTimeout(() => { if (token === hideToken && !timerHandle) $('#timer').classList.add('hidden'); }, 4000);
}

function beep() {
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* sin vibracion */ }
  if (!audioCtx) return;
  [0, 0.3, 0.6].forEach((t) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t);
    o.stop(audioCtx.currentTime + t + 0.18);
  });
}

// ---------- banda de pulso (Bluetooth) ----------
// Lee cualquier sensor con el servicio estandar de frecuencia cardiaca de Bluetooth (Polar, Garmin, Wahoo,
// Coospo...) con Web Bluetooth: Chrome en Android o computador; en iPhone, el navegador Bluefy.
const hrm = { dev: null, bpm: null, at: 0, status: 'off', name: '', sum: 0, n: 0, max: 0, wanted: false, retry: 0 };
const hrmSupported = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hrmFresh = () => hrm.status === 'on' && !!hrm.bpm && Date.now() - hrm.at < 5000;
// Formato estandar: bit 0 de las banderas indica si el valor viene en 8 o 16 bits
function hrmParse(dv) { return dv.getUint8(0) & 1 ? dv.getUint16(1, true) : dv.getUint8(1); }
function hrmOnValue(e) {
  const bpm = hrmParse(e.target.value);
  if (!bpm) return; // 0 = la banda no tiene contacto con la piel
  hrm.bpm = bpm; hrm.at = Date.now(); hrm.sum += bpm; hrm.n++; if (bpm > hrm.max) hrm.max = bpm;
  hiitOnHr(bpm);
  hrmPaint();
}
async function hrmConnect() {
  if (!hrmSupported()) {
    toast(isIOS() ? 'En iPhone abre la app en el navegador Bluefy para conectar la banda.' : 'Este navegador no permite Bluetooth. Abre la app en Chrome.');
    return;
  }
  try {
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    if (hrm.dev && hrm.dev !== dev) { hrm.wanted = false; try { hrm.dev.gatt.disconnect(); } catch (e) { /* ya desconectada */ } }
    hrm.dev = dev; hrm.name = dev.name || 'Banda de pulso'; hrm.wanted = true; hrm.status = 'connecting'; hrmPaint();
    dev.addEventListener('gattserverdisconnected', hrmLost);
    await hrmAttach();
    hrm.sum = 0; hrm.n = 0; hrm.max = 0;
    toast('Banda conectada: ' + hrm.name);
    hrmRefresh();
  } catch (e) {
    if (!(e && e.name === 'NotFoundError')) toast('No se pudo conectar la banda. Revisa que esté puesta y con Bluetooth activo.');
    if (hrm.status === 'connecting') hrm.status = 'off';
    hrmPaint();
  }
}
async function hrmAttach() {
  const server = await hrm.dev.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const ch = await service.getCharacteristic('heart_rate_measurement');
  ch.addEventListener('characteristicvaluechanged', hrmOnValue);
  await ch.startNotifications();
  hrm.status = 'on'; hrm.retry = 0; hrmPaint();
}
// Si se corta (banda lejos, sin contacto), reintenta sola con espera creciente
function hrmLost() {
  if (!hrm.wanted) { hrm.status = 'off'; hrmPaint(); return; }
  hrm.status = 'reconnecting'; hrmPaint();
  setTimeout(() => {
    if (hrm.wanted && hrm.dev) hrmAttach().then(() => toast('Banda reconectada.')).catch(hrmLost);
  }, Math.min(10000, 1000 * ++hrm.retry));
}
function hrmDisconnect() {
  hrm.wanted = false; hrm.status = 'off'; hrm.bpm = null;
  try { if (hrm.dev) hrm.dev.gatt.disconnect(); } catch (e) { /* ya desconectada */ }
  hrmRefresh();
}
function hrmResetStats() { hrm.sum = 0; hrm.n = 0; hrm.max = 0; hrmPaint(); }
// Redibuja lo que depende de si hay banda conectada
function hrmRefresh() { if (hiit) hiitRender(); else render(); }
// Actualiza en el lugar los numeros en pantalla (sin redibujar todo)
function hrmPaint() {
  const fresh = hrmFresh();
  const z = fresh ? zoneOf(hrZones(), hrm.bpm) : null;
  document.querySelectorAll('.hrm-bpm').forEach((el) => { el.textContent = fresh ? hrm.bpm : '--'; });
  document.querySelectorAll('.hrm-zone').forEach((el) => {
    el.textContent = z == null ? '' : z === 0 ? 'Bajo la zona 1' : z === 5 ? 'Sobre la zona 4' : 'Zona ' + z;
  });
  document.querySelectorAll('.hrm-live').forEach((el) => { el.dataset.z = z == null ? '' : z; });
  document.querySelectorAll('.hrm-status').forEach((el) => {
    el.textContent = hrm.status === 'reconnecting' ? 'Reconectando…' : hrm.status === 'connecting' ? 'Conectando…'
      : fresh ? hrm.name : 'Sin señal: revisa que la banda esté húmeda y bien puesta';
  });
  document.querySelectorAll('.hrm-avg').forEach((el) => {
    el.textContent = hrm.n ? 'Promedio ' + Math.round(hrm.sum / hrm.n) + ' lpm · máx ' + hrm.max + ' lpm' : 'Aún sin datos';
  });
}
setInterval(() => { if (hrm.status !== 'off') hrmPaint(); }, 2000);

// Recuadro para conectar la banda o ver el pulso en vivo. withAvg: muestra promedio y boton para usarlo en el registro
function hrmWidget(withAvg) {
  if (!hrmSupported()) {
    return h('div', { class: 'hrm-box muted small' }, '❤️ Banda de pulso: ',
      isIOS() ? 'en iPhone, abre esta app en el navegador Bluefy (gratis en la App Store) para conectarla.' : 'abre la app en Chrome para conectarla.');
  }
  if (hrm.status === 'off') {
    return h('div', { class: 'hrm-box' },
      h('button', { class: 'btn full', type: 'button', onclick: hrmConnect }, '❤️ Conectar banda de pulso'),
      h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Con una banda Bluetooth (Polar, Garmin, Coospo…) la app lee tu pulso real y lo anota sola.'));
  }
  const box = h('div', { class: 'hrm-box hrm-live' },
    h('div', { class: 'row between', style: 'align-items:center' },
      h('div', {}, h('span', { class: 'hrm-heart', 'aria-hidden': 'true' }, '❤️ '), h('b', { class: 'hrm-bpm' }, '--'), ' lpm ', h('span', { class: 'hrm-zone' })),
      h('button', { class: 'btn small ghost', type: 'button', onclick: hrmDisconnect }, 'Desconectar')),
    h('div', { class: 'muted small hrm-status' }));
  if (withAvg) {
    box.append(h('div', { class: 'small hrm-avg', style: 'margin-top:8px' }),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px' },
        h('button', { class: 'btn small', type: 'button', onclick: hrmResetStats }, 'Reiniciar'),
        h('button', { class: 'btn small', type: 'button', onclick: () => {
          const i = $('#cardio-hr');
          if (!hrm.n || !i) { toast('Aún no hay datos de la banda.'); return; }
          i.value = Math.round(hrm.sum / hrm.n); toast('Pulso promedio anotado.');
        } }, 'Usar promedio en el registro')));
  }
  setTimeout(hrmPaint, 0);
  return box;
}

// ---------- sesion de intervalos guiada ----------
// Paso a paso: calentamiento -> (intervalo fuerte -> recuperacion) x rondas -> vuelta a la calma.
// Tu das "Iniciar" en cada intervalo; la app cuenta el tiempo, avisa con sonido y vibracion, te deja anotar
// el pulso al terminar el intervalo y al recuperarte, y al final suma los minutos activos.
const HIIT_KEY = 'rutinas.hiit.v1';
const HIIT_WARM = 480, HIIT_COOL = 300;
const HIIT_PRESETS = [
  { id: 'a', name: 'Semanas 1–2', rounds: 6, hard: 30, easy: 90 },
  { id: 'b', name: 'Semanas 3–4', rounds: 8, hard: 60, easy: 120 },
  { id: 'c', name: 'Semana 5 en adelante', rounds: 8, hard: 60, easy: 90 }
];
const HIIT_RUNNING = ['warm', 'hard', 'rec', 'cool'];
let hiit = null, hiitHandle = null, hiitLock = null, hiitLastLeft = null, hiitDoneSummary = null, hiitPulsesOpen = false;
const hiitPreset = (id) => HIIT_PRESETS.find((x) => x.id === id) || HIIT_PRESETS[1];
const hiitSec = (step, pr) => step === 'warm' ? HIIT_WARM : step === 'cool' ? HIIT_COOL : step === 'hard' ? pr.hard : step === 'rec' ? pr.easy : 0;
const hiitTotalSec = (pr) => HIIT_WARM + pr.rounds * (pr.hard + pr.easy) + HIIT_COOL;
const secText = (n) => n < 60 ? n + ' s' : (n % 60 ? mmss(n) + ' min' : n / 60 + ' min');
function hiitStore(v) {
  try { if (v) localStorage.setItem(HIIT_KEY, JSON.stringify(v)); else localStorage.removeItem(HIIT_KEY); } catch (e) { /* sin almacenamiento */ }
}
function hiitSavedRun() {
  try {
    const v = JSON.parse(localStorage.getItem(HIIT_KEY));
    if (v && v.startedAt && v.preset && v.step && Date.now() - v.startedAt < 3 * 3600 * 1000) return v;
  } catch (e) { /* sin datos */ }
  return null;
}
function hiitPresetChoice() { try { return localStorage.getItem(HIIT_KEY + '.preset') || 'b'; } catch (e) { return 'b'; } }
function hiitSetPresetChoice(id) { try { localStorage.setItem(HIIT_KEY + '.preset', id); } catch (e) { /* sin almacenamiento */ } }
function hiitPersist() {
  hiitStore({ preset: hiit.pr.id, step: hiit.step, r: hiit.r, phaseStart: hiit.phaseStart, pausedAcc: hiit.pausedAcc, pausedAt: hiit.pausedAt, active: hiit.active, rounds: hiit.rounds, startedAt: hiit.startedAt,
    hrSum: hiit.hrSum, hrN: hiit.hrN, hrMax: hiit.hrMax, libre: hiit.libre || undefined });
}

const hiitRunning = () => HIIT_RUNNING.indexOf(hiit.step) !== -1;
const hiitElapsed = () => Math.max(0, ((hiit.pausedAt || Date.now()) - hiit.phaseStart - hiit.pausedAcc) / 1000);
const hiitLeft = () => hiitSec(hiit.step, hiit.pr) - hiitElapsed();
// Segundos activos acumulados, incluida la fase en curso
const hiitActive = () => hiit.active + (hiitRunning() ? Math.min(hiitElapsed(), hiitSec(hiit.step, hiit.pr)) : 0);
const hiitRoundsDone = () => hiit.rounds.filter((x) => x.done).length;

function hiitTone(freq, at, dur) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.frequency.value = freq; g.gain.value = 0.18;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(audioCtx.currentTime + at); o.stop(audioCtx.currentTime + at + dur);
}
function hiitCue(kind) {
  try {
    if (kind === 'hard') { if (navigator.vibrate) navigator.vibrate([400, 120, 400]); hiitTone(1046, 0, 0.18); hiitTone(1046, 0.26, 0.18); hiitTone(1318, 0.52, 0.3); }
    else if (kind === 'rec') { if (navigator.vibrate) navigator.vibrate([600]); hiitTone(587, 0, 0.5); }
    else if (kind === 'end') beep();
    else if (kind === 'ok') { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); hiitTone(660, 0, 0.15); hiitTone(880, 0.18, 0.25); }
    else { if (navigator.vibrate) navigator.vibrate([200]); hiitTone(784, 0, 0.2); } // cuenta regresiva
  } catch (e) { /* sin sonido */ }
}
async function hiitWake(on) {
  try {
    if (on && 'wakeLock' in navigator && !hiitLock) hiitLock = await navigator.wakeLock.request('screen');
    else if (!on && hiitLock) { await hiitLock.release(); hiitLock = null; }
  } catch (e) { hiitLock = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && hiit && !hiitDoneSummary) { hiitLock = null; hiitWake(true); hiitTick(); } });

function hiitOpen(saved, libre) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !audioCtx) audioCtx = new AC();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* sin audio */ }
  hiitDoneSummary = null; hiitLastLeft = null;
  if (saved) {
    hiit = { pr: hiitPreset(saved.preset), step: saved.step, r: saved.r, phaseStart: saved.phaseStart, pausedAcc: saved.pausedAcc || 0, pausedAt: saved.pausedAt || null, active: saved.active || 0, rounds: saved.rounds, startedAt: saved.startedAt,
      hrSum: saved.hrSum || 0, hrN: saved.hrN || 0, hrMax: saved.hrMax || 0, libre: !!saved.libre };
  } else {
    const pr = hiitPreset(hiitPresetChoice());
    hiit = { pr: pr, step: 'warm-ready', r: 1, phaseStart: 0, pausedAcc: 0, pausedAt: null, active: 0, startedAt: Date.now(), hrSum: 0, hrN: 0, hrMax: 0, libre: !!libre,
      rounds: pr.rounds ? Array.from({ length: pr.rounds }, () => ({ max: null, rec: null, done: false })) : [] };
    hiitPersist();
  }
  hiitWake(true);
  if (!hiitHandle) hiitHandle = setInterval(hiitTick, 250);
  hiitRender();
}
function hiitClose() {
  clearInterval(hiitHandle); hiitHandle = null; hiit = null; hiitDoneSummary = null; hiitLastLeft = null;
  hiitStore(null); hiitWake(false);
  const el = $('#hiit'); if (el) el.remove();
  render();
}
// Cierra la fase en curso sumando su tiempo activo
function hiitLeave() {
  if (hiitRunning()) hiit.active += Math.min(hiitElapsed(), hiitSec(hiit.step, hiit.pr));
}
function hiitGo(step, r, startAt, cue) {
  // Con banda: el pulso "al terminar" es el pico del intervalo (y de los primeros segundos de recuperacion)
  if (step === 'rec' && hiit.step === 'hard' && hiit.peak) { const rd = hiit.rounds[(r || hiit.r) - 1]; if (!rd.max || hiit.peak > rd.max) rd.max = hiit.peak; }
  if (step === 'hard') hiit.peak = 0;
  hiit.step = step; if (r) hiit.r = r;
  hiit.phaseStart = startAt || Date.now(); hiit.pausedAcc = 0; hiit.pausedAt = null; hiitLastLeft = null;
  hiitPersist(); hiitRender(); if (cue) hiitCue(cue);
}
function hiitTogglePause() {
  if (hiit.pausedAt) { hiit.pausedAcc += Date.now() - hiit.pausedAt; hiit.pausedAt = null; } else hiit.pausedAt = Date.now();
  hiitPersist(); hiitRender();
}
function hiitFinish(early) {
  hiitLeave();
  const rd = hiit.rounds.filter((x) => x.max);
  hiitDoneSummary = {
    early: early, rounds: hiitRoundsDone(), total: hiit.pr.rounds, min: Math.max(1, Math.round(hiit.active / 60)),
    hr: hiit.hrN ? Math.round(hiit.hrSum / hiit.hrN) : rd.length ? Math.round(rd.reduce((t, x) => t + x.max, 0) / rd.length) : null,
    hrMax: hiit.hrMax || null, fromBand: !!hiit.hrN, det: hiit.rounds.slice()
  };
  hiit.step = 'done';
  clearInterval(hiitHandle); hiitHandle = null; hiitStore(null); hiitWake(false);
  if (!early) hiitCue('end');
  hiitRender();
}

// Avanza las fases que terminaron por tiempo y refresca solo los textos que cambian
function hiitTick() {
  if (!hiit || hiit.step === 'done' || !hiitRunning() || hiit.pausedAt) return;
  let left = hiitLeft();
  const pr = hiit.pr;
  if (left <= 0 && hiit.step === 'hard') {
    hiit.rounds[hiit.r - 1].done = true; hiit.active += pr.hard;
    hiitGo('rec', hiit.r, hiit.phaseStart + hiit.pausedAcc + pr.hard * 1000, 'rec'); return;
  }
  if (left <= 0 && hiit.step === 'warm') { hiit.active += HIIT_WARM; hiitGo('ready', 1, null, 'rec'); return; }
  if (left <= 0 && hiit.step === 'cool') { hiitFinish(false); return; }
  const sec = Math.ceil(Math.max(0, left));
  if (hiitLastLeft != null && sec < hiitLastLeft) {
    if (sec <= 3 && sec > 0) hiitCue('tick');
    if (sec === 0 && hiit.step === 'rec') { // fin de la recuperacion: avisa y resalta el boton sin reconstruir la pantalla (no pierdes el teclado)
      hiitCue('hard');
      const nb = $('#hiit-next'); if (nb) { nb.classList.add('hiit-go'); nb.textContent = nb.dataset.over; }
      const pt = $('#hiit-ptitle'); if (pt) pt.textContent = '¡Recuperado el tiempo!';
    }
  }
  hiitLastLeft = sec;
  const t = $('#hiit-time'); if (t) t.textContent = mmss(sec);
  const bar = $('#hiit-bar'); if (bar) bar.style.width = Math.min(100, 100 * (1 - Math.max(0, left) / hiitSec(hiit.step, pr))) + '%';
  const act = $('#hiit-active'); if (act) act.textContent = 'Activo ' + mmss(Math.floor(hiitActive()));
}

// Meta de pulso segun las zonas (si hay edad); si no, por sensacion
function hiitTargets() {
  const z = hrZones();
  return {
    hard: z ? z.z[3].lo + '–' + z.z[3].hi + ' lpm' : 'esfuerzo de 8 de 10',
    rec: z ? 'bajar de ' + z.z[1].hi + ' lpm' : 'bajar unos 25 lpm',
    recMax: z ? z.z[1].hi : null
  };
}
function hiitRecMsg(rd) {
  const tg = hiitTargets();
  if (!rd.rec) return { cls: '', text: 'Meta: ' + tg.rec + ' antes del siguiente intervalo.' };
  const drop = rd.max ? rd.max - rd.rec : null;
  const ok = tg.recMax ? rd.rec <= tg.recMax : (drop != null && drop >= 25);
  return ok
    ? { cls: 'ok', text: '✓ Recuperado' + (drop != null && drop > 0 ? ': bajó ' + drop + ' lpm' : '') + '. Listo para el siguiente.' }
    : { cls: 'warn', text: 'Aún alto' + (drop != null ? ' (bajó ' + Math.max(0, drop) + ' lpm)' : '') + ': espera un poco más o pedalea más suave. Meta: ' + tg.rec + '.' };
}

// Cada lectura de la banda durante la sesion: promedio, pico del intervalo y pulso de recuperacion en vivo
function hiitOnHr(bpm) {
  if (!hiit || hiit.step === 'done' || hiit.pausedAt || !hiitRunning()) return;
  hiit.hrSum += bpm; hiit.hrN++; if (bpm > hiit.hrMax) hiit.hrMax = bpm;
  if (hiit.step === 'hard') hiit.peak = Math.max(hiit.peak || 0, bpm);
  if (hiit.step === 'rec') {
    const rd = hiit.rounds[hiit.r - 1];
    if (hiitElapsed() < 15 && bpm > (rd.max || 0)) rd.max = bpm; // el pulso sigue subiendo unos segundos al parar
    rd.rec = bpm;
    ['max', 'rec'].forEach((k) => { const i = $('#hiit-in-' + k); if (i && document.activeElement !== i) i.value = rd[k] || ''; });
    const m = $('#hiit-recmsg'), msg = hiitRecMsg(rd);
    if (m) { m.className = 'hiit-recmsg ' + msg.cls; m.textContent = msg.text; }
    if (msg.cls === 'ok' && !rd.okCue && hiitElapsed() >= 15) { // aviso una vez por ronda: ya bajo lo suficiente
      rd.okCue = true; hiitCue('ok');
      const nb = $('#hiit-next'); if (nb) nb.classList.add('hiit-go');
    }
  }
  if (hiit.hrN % 5 === 0) hiitPersist();
}

const HIIT_LABEL = { warm: 'Calentamiento', hard: '¡FUERTE!', rec: 'Recupera', cool: 'Vuelta a la calma' };
// Tabla editable con el pulso de cada ronda (al terminar el intervalo y recuperado), para anotar lo que se olvido
function hiitRoundsEditor(upto, onChange) {
  const rows = [];
  for (let i = 0; i < upto; i++) {
    const rd = hiit.rounds[i];
    const mk = (key, label) => {
      const inp = h('input', { inputmode: 'numeric', value: rd[key] || '', 'aria-label': label + ' de la ronda ' + (i + 1) });
      inp.addEventListener('input', () => { rd[key] = parseNum(inp.value) || null; if (hiit.step !== 'done') hiitPersist(); if (onChange) onChange(); });
      return inp;
    };
    rows.push(h('div', { class: 'hiit-tr edit' }, h('span', {}, i + 1), mk('max', 'Pulso al terminar'), mk('rec', 'Pulso recuperado')));
  }
  return h('div', { class: 'hiit-table' },
    h('div', { class: 'hiit-tr head' }, h('span', {}, 'Ronda'), h('span', {}, 'Al terminar (lpm)'), h('span', {}, 'Recuperado (lpm)')), rows);
}

function hiitHrInput(rd, key, label) {
  const input = h('input', { id: 'hiit-in-' + key, inputmode: 'numeric', value: rd[key] || '', 'aria-label': label });
  input.addEventListener('input', () => {
    rd[key] = parseNum(input.value) || null; hiitPersist();
    const m = $('#hiit-recmsg'); if (m) { const r = hiitRecMsg(rd); m.className = 'hiit-recmsg ' + r.cls; m.textContent = r.text; }
  });
  return h('label', {}, label, input);
}

function hiitRender() {
  if (!hiit) return;
  let el = $('#hiit');
  if (!el) { el = h('div', { id: 'hiit', class: 'hiit', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sesión de intervalos' }); document.body.append(el); }
  const pr = hiit.pr, step = hiit.step, r = hiit.r, tg = hiitTargets(), paused = !!hiit.pausedAt;

  if (step === 'done') {
    const d = hiitDoneSummary;
    const form = h('form', { class: 'body-form', autocomplete: 'off' },
      h('label', {}, 'Minutos', h('input', { name: 'min', inputmode: 'numeric', value: d.min })),
      h('label', {}, 'Pulso promedio (lpm)', h('input', { name: 'hr', inputmode: 'numeric', value: d.hr || '' })),
      h('label', { class: 'full' }, 'Rondas completadas (de ' + d.total + ')', h('input', { name: 'rondas', inputmode: 'numeric', value: d.rounds })),
      h('button', { class: 'btn primary big full', type: 'submit' }, 'Guardar sesión de cardio'),
      h('button', { class: 'btn big full', type: 'button', onclick: hiitClose }, 'Descartar'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const m = parseNum(form.elements.min.value);
      if (!m) { toast('Escribe los minutos.'); return; }
      cardio.sessions.push({ id: uid(), date: todayISO(), tipo: 'Intervalos', min: Math.round(m), hr: parseNum(form.elements.hr.value), rondas: parseNum(form.elements.rondas.value) || undefined, dia: hiit.libre ? undefined : 'dia-cardio-2', libre: hiit.libre || undefined,
        det: d.det.some((x) => x.max || x.rec) ? d.det.map((x) => [x.max || null, x.rec || null]) : undefined });
      saveCardio(); toast('Cardio guardado en este dispositivo.'); hiitClose();
    });
    // Se pueden anotar o corregir los pulsos aqui; si no hay banda, el promedio se recalcula con ellos
    let upto = 0; d.det.forEach((x, i) => { if (x.done || x.max || x.rec) upto = i + 1; });
    const table = upto ? h('div', {},
      h('p', { class: 'muted small', style: 'margin:0 0 6px' }, 'Puedes anotar o corregir el pulso de cada ronda.'),
      hiitRoundsEditor(upto, () => {
        if (d.fromBand) return;
        const mx = d.det.filter((x) => x.max);
        form.elements.hr.value = mx.length ? Math.round(mx.reduce((t, x) => t + x.max, 0) / mx.length) : '';
      })) : null;
    el.className = 'hiit end';
    el.replaceChildren(h('div', { class: 'hiit-in' },
      h('div', { class: 'hiit-end-ico', 'aria-hidden': 'true' }, d.early ? '⏹' : '🎉'),
      h('h2', {}, d.early ? 'Sesión terminada' : '¡Sesión completa!'),
      h('p', { class: 'hiit-sum' }, h('b', {}, d.rounds), ' de ' + d.total + ' rondas · ', h('b', {}, d.min), ' min activos'),
      d.fromBand ? h('p', { class: 'muted small', style: 'text-align:center;margin:0' }, '❤️ Medido con la banda: promedio ' + d.hr + ' lpm · máximo ' + d.hrMax + ' lpm') : null,
      table, form));
    return;
  }

  const running = hiitRunning();
  const dots = [];
  for (let i = 1; i <= pr.rounds; i++) dots.push(h('i', { class: hiit.rounds[i - 1].done ? 'on' : (step === 'hard' && r === i ? 'cur' : '') }));
  const top = h('div', { class: 'hiit-top' }, h('span', {}, 'Intervalos · ' + pr.name), h('span', { id: 'hiit-active' }, 'Activo ' + mmss(Math.floor(hiitActive()))));
  const dotsRow = h('div', { class: 'hiit-dots', 'aria-label': hiitRoundsDone() + ' de ' + pr.rounds + ' rondas completadas' }, dots);
  const count = h('div', { class: 'hiit-count' }, h('b', {}, hiitRoundsDone()), ' de ' + pr.rounds + ' rondas hechas');
  const endBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (confirm('¿Terminar la sesión ahora? Podrás guardar lo que llevas.')) hiitFinish(true); } }, 'Terminar y guardar');
  const clock = () => [
    h('div', { class: 'hiit-time', id: 'hiit-time' }, mmss(Math.ceil(Math.max(0, hiitLeft())))),
    h('div', { class: 'hiit-bar' }, h('i', { id: 'hiit-bar', style: 'width:' + Math.min(100, 100 * (1 - Math.max(0, hiitLeft()) / hiitSec(step, pr))) + '%' }))];
  const pauseBtn = h('button', { class: 'btn big', type: 'button', onclick: hiitTogglePause }, paused ? '▶ Continuar' : '⏸ Pausar');
  let body;

  if (step === 'warm-ready') {
    body = [h('div', { class: 'hiit-phase' }, 'Calentamiento'), h('div', { class: 'hiit-round' }, secText(HIIT_WARM) + ' suave'),
      h('p', { class: 'hiit-help' }, 'Bici, elíptica o caminadora. Sube poco a poco hasta sudar, sin cansarte.'),
      h('button', { class: 'btn primary big', type: 'button', onclick: () => hiitGo('warm') }, '▶ Iniciar calentamiento'),
      h('button', { class: 'btn big', type: 'button', onclick: () => hiitGo('ready', 1) }, 'Saltar al intervalo 1')];
  } else if (step === 'warm') {
    body = [h('div', { class: 'hiit-phase' }, 'Calentamiento'), h('div', { class: 'hiit-round' }, paused ? 'En pausa' : 'Suave, subiendo poco a poco'), ...clock(),
      h('div', { class: 'hiit-actions' }, pauseBtn, h('button', { class: 'btn big', type: 'button', onclick: () => { hiitLeave(); hiitGo('ready', 1); } }, 'Saltar ›'))];
  } else if (step === 'ready') {
    body = [h('div', { class: 'hiit-round' }, 'Prepárate'), h('div', { class: 'hiit-phase' }, 'Intervalo ' + r + ' de ' + pr.rounds),
      h('div', { class: 'hiit-bigline' }, secText(pr.hard) + ' fuerte'),
      h('p', { class: 'hiit-help' }, 'Pulso objetivo: ' + tg.hard + '. Después recuperas ' + secText(pr.easy) + '.'),
      h('button', { class: 'btn primary big hiit-go', type: 'button', onclick: () => hiitGo('hard', r, null, 'hard') }, '▶ Iniciar intervalo ' + r)];
  } else if (step === 'hard') {
    body = [h('div', { class: 'hiit-round' }, 'Intervalo ' + r + ' de ' + pr.rounds), h('div', { class: 'hiit-phase' }, HIIT_LABEL.hard), ...clock(),
      h('p', { class: 'hiit-help' }, paused ? 'En pausa' : 'Pulso objetivo: ' + tg.hard + '. Misma intensidad en todas las rondas.'),
      h('div', { class: 'hiit-actions' }, pauseBtn,
        h('button', { class: 'btn big', type: 'button', onclick: () => { hiitLeave(); const e = hiit.rounds[r - 1]; if (hiitElapsed() >= pr.hard * 0.8) e.done = true; hiitGo('rec', r, null, 'rec'); } }, 'Parar ›'))];
  } else if (step === 'rec') {
    const rd = hiit.rounds[r - 1], last = r >= pr.rounds, msg = hiitRecMsg(rd), over = hiitLeft() <= 0;
    body = [h('div', { class: 'hiit-round' }, 'Después del intervalo ' + r), h('div', { class: 'hiit-phase', id: 'hiit-ptitle' }, over ? '¡Recuperado el tiempo!' : HIIT_LABEL.rec), ...clock(),
      h('p', { class: 'hiit-help' }, paused ? 'En pausa' : hrm.status === 'on' ? 'Respira y baja la intensidad. La banda anota tu pulso sola y te avisa cuando ya bajó.' : 'Respira y baja la intensidad. El pulso debe bajar.'),
      h('div', { class: 'body-form hiit-hr' }, hiitHrInput(rd, 'max', 'Pulso al terminar el intervalo'), hiitHrInput(rd, 'rec', 'Pulso ahora (recuperado)')),
      h('div', { class: 'hiit-recmsg ' + msg.cls, id: 'hiit-recmsg' }, msg.text),
      h('button', { id: 'hiit-next', class: 'btn primary big' + (over ? ' hiit-go' : ''), type: 'button',
        'data-over': last ? '▶ Vuelta a la calma · ' + secText(HIIT_COOL) : '▶ Iniciar intervalo ' + (r + 1),
        onclick: () => { hiitLeave(); if (last) hiitGo('cool'); else hiitGo('hard', r + 1, null, 'hard'); } },
        over ? (last ? '▶ Vuelta a la calma · ' + secText(HIIT_COOL) : '▶ Iniciar intervalo ' + (r + 1))
          : (last ? 'Ya recuperé · Vuelta a la calma' : 'Ya me recuperé · Iniciar intervalo ' + (r + 1))),
      pauseBtn];
  } else { // cool
    body = [h('div', { class: 'hiit-phase' }, HIIT_LABEL.cool), h('div', { class: 'hiit-round' }, paused ? 'En pausa' : 'Muy suave hasta bajar de 100 lpm'), ...clock(),
      h('div', { class: 'hiit-actions' }, pauseBtn, h('button', { class: 'btn big', type: 'button', onclick: () => hiitFinish(false) }, 'Terminar ›')),
      h('p', { class: 'hiit-help' }, 'Después estira cuádriceps, isquios, glúteos y pantorrillas, unos 30 s cada uno.')];
  }
  // Pulsos de rondas anteriores: se pueden anotar o corregir desde cualquier pantalla de la sesion
  const upto = step === 'cool' ? pr.rounds : Math.max(0, r - 1);
  let pulses = null;
  if (upto > 0 && step !== 'warm-ready' && step !== 'warm') {
    pulses = h('details', { class: 'hiit-pulses', open: hiitPulsesOpen },
      h('summary', {}, '❤️ Anotar o corregir pulsos de rondas anteriores'),
      hiitRoundsEditor(upto));
    pulses.addEventListener('toggle', () => { hiitPulsesOpen = pulses.open; });
  }
  el.className = 'hiit ' + (step === 'hard' ? 'hard' : step === 'rec' ? 'easy' : '') + (paused ? ' paused' : '');
  const live = hrm.status !== 'off'
    ? h('div', { class: 'hrm-live hiit-live' }, '❤️ ', h('b', { class: 'hrm-bpm' }, '--'), ' lpm ', h('span', { class: 'hrm-zone' }), h('div', { class: 'muted small hrm-status' }))
    : hrmSupported() ? h('button', { class: 'btn small ghost', type: 'button', onclick: hrmConnect }, '❤️ Conectar banda de pulso') : null;
  el.replaceChildren(h('div', { class: 'hiit-in' }, top, live, ...body, running || step === 'ready' ? [dotsRow, count] : null, pulses, step === 'warm-ready' ? null : endBtn));
  if (step === 'warm-ready') el.querySelector('.hiit-in').append(h('button', { class: 'btn ghost', type: 'button', onclick: hiitClose }, 'Cancelar'));
  hrmPaint();
}

// ---------- cronometro libre ----------
let swAcc = 0, swStart = null, swHandle = null;
const swMs = () => swAcc + (swStart ? Date.now() - swStart : 0);
function swText() { const t = Math.floor(swMs() / 1000); return mmss(t); }
function swUpdate() {
  const btn = $('#sw-label');
  if (btn) btn.textContent = swStart || swAcc ? swText() : 'Cronómetro';
  const big = $('#sw-big');
  if (big) big.textContent = swText();
  const el = $('#elapsed');
  if (el) { const r = route(); const s = r.group && todaySession(r.group.id, false); if (s) el.textContent = elapsedText(s); }
}
function swToggle() {
  if (swStart) { swAcc += Date.now() - swStart; swStart = null; } else swStart = Date.now();
  swUpdate(); openStopwatch();
}
function swReset() { swAcc = 0; swStart = null; swUpdate(); openStopwatch(); }

function openStopwatch() {
  const sheet = $('#sheet');
  const close = () => { sheet.classList.add('hidden'); sheet.replaceChildren(); };
  const rest = (sec) => { startTimer(sec); close(); toast('Descanso de ' + (sec < 60 ? sec + ' s' : mmss(sec)) + ' en marcha.'); };
  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cronómetro' },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'row between' },
      h('h2', {}, 'Cronómetro'),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×')),
    h('div', { class: 'sw-big', id: 'sw-big' }, swText()),
    h('div', { class: 'sw-actions' },
      h('button', { class: 'btn primary big', type: 'button', onclick: swToggle }, swStart ? 'Pausar' : (swAcc ? 'Continuar' : 'Iniciar')),
      h('button', { class: 'btn big', type: 'button', onclick: swReset, disabled: !swStart && !swAcc }, 'Reiniciar')),
    h('p', { class: 'muted small' }, 'Útil para planchas, tiempo total o descansos libres. Sigue contando aunque cierres esta ventana.'),
    h('div', { class: 'section-title', style: 'margin-top:18px' }, 'Descanso rápido'),
    h('div', { class: 'rest-presets' },
      [45, 60, 90, 120, 180].map((sec) => h('button', { class: 'btn', type: 'button', onclick: () => rest(sec) }, sec < 60 ? sec + ' s' : mmss(sec)))),
    h('p', { class: 'muted small' }, 'El descanso también arranca solo cada vez que registras una serie, con el tiempo indicado para ese ejercicio.'));
  sheet.replaceChildren(h('div', { class: 'sheet-bg', onclick: close }), panel);
  sheet.classList.remove('hidden');
}
