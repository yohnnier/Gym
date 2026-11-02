/* Rutinas — Constantes, guardado privado, utilidades, estado, progresión, volumen semanal y acciones.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

const VERSION = '50';
const KEY = 'rutinas.v1';
const IMG_KEY = 'rutinas.img.v1';
const REST_KEY = 'rutinas.rest.v1';
const UNIT_KEY = 'rutinas.unit.v1'; // ejercicios cuyo peso cambiaste entre "total" y "por lado"
const PHOTOS_KEY = 'rutinas.photos.v1'; // fotos propias de cada ejercicio (varias), solo en este dispositivo
const SNOOZE_KEY = 'rutinas.bodysnooze.v1';
const BODY_REMIND_DAYS = 30; // aviso de nuevo control corporal completo (Fitdays) cada mes
const CARDIO_KEY = 'rutinas.cardio.v1'; // sesiones de cardio: solo en este dispositivo
const ALT_KEY = 'rutinas.alts.v1'; // maquina elegida para cada lugar del plan (o rotacion automatica)
const DOSE_KEY = 'rutinas.dose.v1'; // recordatorio de aplicacion: SOLO en este dispositivo, nunca se sube a GitHub
const WEIGHT_KEY = 'rutinas.weight.v1'; // peso diario: SOLO en este dispositivo, nunca se sube a GitHub
const WAIST_KEY = 'rutinas.waist.v1'; // cintura/abdomen semanal: SOLO en este dispositivo, nunca se sube a GitHub
const LAB_KEY = 'rutinas.labs.v1'; // examenes de laboratorio: SOLO en este dispositivo, nunca se suben a GitHub
const BODY_KEY = 'rutinas.body.v1'; // medidas corporales: SOLO en este dispositivo, nunca se suben a GitHub
const exById = {};
ROUTINES.forEach((r) => r.exercises.forEach((e) => { exById[e.id] = e; e.baseUnit = e.unit; }));
const routineById = {};
ROUTINES.forEach((r) => { routineById[r.id] = r; });
// Dias del plan: rutinas armadas con ejercicios de varios grupos (copias, para poder cambiar las series)
const DAYS = PLAN.days.map((d) => ({
  id: d.id, name: d.name, focus: d.focus, isDay: true, cardio: d.cardio || null, covers: d.covers || null,
  exercises: d.exercises.map((x) => Object.assign({}, exById[x.id], x.sets ? { sets: x.sets, setsText: null } : {}))
}));
DAYS.forEach((d) => { routineById[d.id] = d; });
const routineOf = (s) => routineById[(s && s.routineId) || 'piernas'] || ROUTINES[0];

let state = load();
let customImg = loadImages();
let photos = (function () { try { return JSON.parse(localStorage.getItem(PHOTOS_KEY)) || {}; } catch (e) { return {}; } })();
function savePhotos() { try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)); return true; } catch (e) { return false; } }
// Fotos de la version anterior (una por ejercicio): pasan a la galeria
if (Object.keys(customImg).length) {
  Object.keys(customImg).forEach((id) => { (photos[id] = photos[id] || []).unshift(customImg[id]); });
  if (savePhotos()) { customImg = {}; try { localStorage.setItem(IMG_KEY, '{}'); } catch (e) { /* sin almacenamiento */ } }
}
let body = (function () {
  try { const b = JSON.parse(localStorage.getItem(BODY_KEY)); if (b && Array.isArray(b.controls)) return b; } catch (e) { /* sin datos */ }
  return { profile: {}, controls: [] };
})();
let cardio = (function () {
  try { const c = JSON.parse(localStorage.getItem(CARDIO_KEY)); if (c && Array.isArray(c.sessions)) return c; } catch (e) { /* sin datos */ }
  return { sessions: [] };
})();

// ---------- guardado privado (repositorio privado gym-datos) ----------
// Los datos privados (cuerpo, cardio, peso, abdomen, examenes, dosis) se guardan en datos.json de un repositorio PRIVADO.
// Nunca van al repositorio publico. Si la llave no tiene permiso para ese repositorio, todo sigue funcionando solo en este dispositivo.
const PRIV_META_KEY = 'rutinas.privmeta.v1';
const GH_PRIV = { owner: 'yohnnier', repo: 'gym-datos', path: 'datos.json' };
const GH_PRIV_API = 'https://api.github.com/repos/' + GH_PRIV.owner + '/' + GH_PRIV.repo;
let privMeta = (function () { try { return JSON.parse(localStorage.getItem(PRIV_META_KEY)) || {}; } catch (e) { return {}; } })();
const priv = { status: 'off', error: '', at: 0, running: false, again: false, timer: null };
function privTouch(name) {
  try {
    privMeta[name] = Date.now();
    localStorage.setItem(PRIV_META_KEY, JSON.stringify(privMeta));
    schedulePrivSync();
  } catch (e) { /* aun no iniciado o sin almacenamiento */ }
}
function saveCardio() { try { localStorage.setItem(CARDIO_KEY, JSON.stringify(cardio)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } privTouch('cardio'); }
let labs = (function () {
  try { const l = JSON.parse(localStorage.getItem(LAB_KEY)); if (l && Array.isArray(l.records)) return l; } catch (e) { /* sin datos */ }
  return { records: [] };
})();
let dose = (function () {
  try { const d = JSON.parse(localStorage.getItem(DOSE_KEY)); if (d && d.proxima) return d; } catch (e) { /* sin datos */ }
  return null;
})();
function saveDose() { try { localStorage.setItem(DOSE_KEY, JSON.stringify(dose)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } privTouch('dose'); }
let wlog = (function () {
  try { const w = JSON.parse(localStorage.getItem(WEIGHT_KEY)); if (w && Array.isArray(w.entries)) return w; } catch (e) { /* sin datos */ }
  return { entries: [] };
})();
function saveW() { try { localStorage.setItem(WEIGHT_KEY, JSON.stringify(wlog)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } privTouch('weight'); }
let waist = (function () {
  try { const w = JSON.parse(localStorage.getItem(WAIST_KEY)); if (w && Array.isArray(w.entries)) return w; } catch (e) { /* sin datos */ }
  return { entries: [] };
})();
function saveWaist() { try { localStorage.setItem(WAIST_KEY, JSON.stringify(waist)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } privTouch('waist'); }
function saveLabs() { try { localStorage.setItem(LAB_KEY, JSON.stringify(labs)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } privTouch('labs'); }
function saveBody() { try { localStorage.setItem(BODY_KEY, JSON.stringify(body)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } privTouch('body'); }
const bodySorted = () => body.controls.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
const lastBody = () => { const s = bodySorted(); return s.length ? s[s.length - 1] : null; };
// Estimacion de calorias de una sesion: ~3,2 min por serie (trabajo + descanso), MET 4 para pesas con descansos largos
function kcalEstimate(nSets) {
  if (!nSets || !(wlog.entries.length || (lastBody() && lastBody().peso))) return null;
  const minutes = nSets * 3.2;
  return { minutes: Math.round(minutes), kcal: Math.round(4 * curKg() * minutes / 60) };
}
// Peso actual para todos los calculos de calorias: promedio de los pesos diarios de los ultimos 7 dias;
// si no hay, el ultimo peso diario (hasta 30 dias); si no, el del ultimo control; si no, 75 kg
function curKg() {
  const w = wlog.entries.filter((e) => daysSince(e.date) < 7);
  if (w.length) return w.reduce((t, e) => t + e.kg, 0) / w.length;
  const ws = wlog.entries.slice().sort((x, y) => (x.date < y.date ? 1 : -1))[0];
  if (ws && daysSince(ws.date) < 30) return ws.kg;
  const lb = lastBody();
  return (lb && lb.peso) || 75;
}
// Descanso entre series elegido por ti para cada ejercicio (segundos); si no hay, se usa el del plan
// Peso "total" o "por lado" por ejercicio: cambia solo la etiqueta (y, si quieres, convierte los registros viejos)
let customUnit = (function () { try { return JSON.parse(localStorage.getItem(UNIT_KEY)) || {}; } catch (e) { return {}; } })();
function saveUnits() { try { localStorage.setItem(UNIT_KEY, JSON.stringify(customUnit)); } catch (e) { /* sin almacenamiento */ } }
function setUnit(id, unit) {
  exById[id].unit = unit;
  DAYS.forEach((d) => d.exercises.forEach((e) => { if (e.id === id) e.unit = unit; }));
}
Object.keys(customUnit).forEach((id) => { if (exById[id]) setUnit(id, customUnit[id]); });
const canSwapUnit = (ex) => /^(kg|lb)(\/lado)?$/.test(ex.baseUnit || ex.unit);
const perSide = (ex) => /\/lado$/.test(ex.unit);
let customRest = (function () { try { return JSON.parse(localStorage.getItem(REST_KEY)) || {}; } catch (e) { return {}; } })();
const REST_OPTIONS = [45, 60, 75, 90, 120, 150, 180, 240];
const restOf = (ex) => customRest[ex.id] || ex.rest;
function restTxt(sec) { return sec < 60 ? sec + ' s' : sec % 60 === 0 ? (sec / 60) + ' min' : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + ' min'; }
function saveRest() { try { localStorage.setItem(REST_KEY, JSON.stringify(customRest)); } catch (e) { /* sin almacenamiento */ } }
function setRest(ex, sec, quiet) {
  sec = Math.max(15, Math.min(600, sec));
  if (sec === ex.rest) delete customRest[ex.id]; else customRest[ex.id] = sec;
  saveRest();
  if (!quiet) toast('Descanso de ' + ex.name + ': ' + restTxt(sec) + '.');
  render();
}
function resetRests() {
  if (!confirm('¿Volver todos los descansos a los del plan?')) return;
  customRest = {}; saveRest(); toast('Descansos restaurados al plan.'); render();
}
let repoSessions = [];
let nutrition = []; // comidas registradas desde el chat (data/nutrition.json)
let nutAdjust = []; // ajustes puntuales de la meta de un dia (p. ej. compensar un exceso): [{date, kcal, motivo}]
const drafts = {}; // valores escritos y aun no registrados: drafts[exId][fila] = { w, r }

// ---------- utilidades ----------
const $ = (s, r) => (r || document).querySelector(s);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (v === false || v == null) return;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  kids.flat().forEach((kid) => {
    if (kid == null || kid === false) return;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  });
  return el;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDate(iso) { const p = iso.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
function fmt(n) { return n == null ? '—' : String(Math.round(n * 100) / 100).replace('.', ','); }
function parseNum(v) {
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
const DAY = 86400000;
function isoToDate(iso) { const p = iso.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
function isoAdd(iso, n) { const d = isoToDate(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function daysSince(iso) { return Math.round((isoToDate(todayISO()) - isoToDate(iso)) / DAY); }
function agoText(iso) {
  const d = daysSince(iso);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días';
}
function longDate(d) {
  const s = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Buenos días' : hr < 20 ? 'Buenas tardes' : 'Buenas noches';
}
function mmss(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
const setStr = (x) => fmt(x.weight) + '×' + x.reps;
// Maquinas de poleas: el peso va en libras y aqui se muestra su equivalente en kg
const isLb = (ex) => /^lb/.test(ex.unit);
// Equivalencia en la otra unidad: lb -> kg; kg con ex.dual (p. ej. peck deck) -> lb
const hasEq = (ex) => isLb(ex) || (!!ex.dual && /^kg/.test(ex.unit));
const eqName = (ex) => (isLb(ex) ? 'kg' : 'lb');
const eqNum = (ex, w) => (w == null || isNaN(w) ? '' : fmt(Math.round(w * (isLb(ex) ? 0.45359237 : 2.20462262) * 10) / 10));
const kgEq = (ex, w) => (hasEq(ex) && w != null && !isNaN(w) ? '≈ ' + eqNum(ex, w) + ' ' + eqName(ex) : '');

const RPE_TEXT = {
  6: 'Te quedaban 4 o más', 7: 'Te quedaban 3', 8: 'Te quedaban 2', 9: 'Te quedaba 1', 10: 'Al límite'
};

let toastHandle = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- estado ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.sessions)) {
      const sessions = s.sessions;
      // Version anterior: una sesion "en curso" separada. Se guarda como sesion normal.
      if (s.current && s.current.entries && s.current.entries.length) sessions.push(s.current);
      return { sessions: sessions, deleted: Array.isArray(s.deleted) ? s.deleted : [] };
    }
  } catch (e) { /* sin datos */ }
  return { sessions: [], deleted: [] };
}
// changed = true cuando cambian los registros: se programa el guardado en la nube
function save(changed) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento no disponible */ }
  if (changed) scheduleSync();
}
function touch(s) { s.updatedAt = Date.now(); }
function forget(s) {
  state.sessions = state.sessions.filter((x) => x.id !== s.id);
  if (state.deleted.indexOf(s.id) === -1) state.deleted.push(s.id);
}
function loadImages() {
  try { return JSON.parse(localStorage.getItem(IMG_KEY)) || {}; } catch (e) { return {}; }
}
function saveImages() {
  try { localStorage.setItem(IMG_KEY, JSON.stringify(customImg)); return true; } catch (e) { return false; }
}

// Une dos listas de sesiones por id: gana la copia modificada mas recientemente (en empate, la primera lista).
function mergeSessions(base, local, deleted) {
  const del = {};
  (deleted || []).forEach((id) => { del[id] = true; });
  const map = new Map();
  base.forEach((x) => { if (!del[x.id]) map.set(x.id, x); });
  local.forEach((x) => {
    if (del[x.id]) return;
    const b = map.get(x.id);
    if (!b || (x.updatedAt || 0) > (b.updatedAt || 0)) map.set(x.id, x);
  });
  return collapseDays(Array.from(map.values()));
}
// Si hay dos sesiones del mismo dia y mismo grupo (por ejemplo una subida desde el chat y otra
// registrada en la app), se unen: por cada ejercicio se queda la copia mas reciente, sin duplicar series.
function collapseDays(list) {
  const groups = new Map();
  list.forEach((x) => {
    const k = x.date + '|' + (x.routineId || 'piernas');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  });
  const out = [];
  groups.forEach((g) => {
    if (g.length === 1) { out.push(g[0]); return; }
    const byTime = g.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const order = [];
    const best = {};
    byTime.forEach((x) => {
      const per = {};
      x.entries.forEach((e) => { (per[e.exerciseId] = per[e.exerciseId] || []).push(e); });
      Object.keys(per).forEach((id) => {
        if (order.indexOf(id) === -1) order.push(id);
        const cur = best[id];
        if (!cur || (x.updatedAt || 0) > (cur.t || 0) || ((x.updatedAt || 0) === (cur.t || 0) && per[id].length > cur.list.length)) best[id] = { t: x.updatedAt || 0, list: per[id] };
      });
    });
    const entries = [];
    order.forEach((id) => best[id].list.forEach((e) => entries.push(e)));
    renumber(entries);
    const app = g.find((x) => x.source === 'app');
    const base = app || byTime[0];
    out.push(Object.assign({}, base, { entries: entries, updatedAt: Math.max.apply(null, g.map((x) => x.updatedAt || 0)) }));
  });
  return out;
}
// Historial del repositorio (data/sessions.json) unido con lo guardado en este dispositivo.
function allSessions() { return mergeSessions(repoSessions, state.sessions, state.deleted); }
function sortedSessions() {
  return allSessions().sort((a, b) =>
    a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : (a.date < b.date ? 1 : -1));
}

// Sesion de hoy para un grupo (solo en este dispositivo). Se crea al registrar la primera serie.
const sameDay = (x, routineId) => x.date === todayISO() && (x.routineId || 'piernas') === routineId;

// create = false: vista de lectura de la sesion de hoy (une lo registrado en la app con lo subido desde el chat).
// create = true: version editable. Si hay mas de una copia, se unen en una sola y las demas se retiran.
function todaySession(routineId, create) {
  const view = allSessions().find((x) => sameDay(x, routineId)) || null;
  if (!create) return view;
  const locals = state.sessions.filter((x) => sameDay(x, routineId));
  const repos = repoSessions.filter((x) => sameDay(x, routineId));
  if (locals.length === 1 && repos.length === 0) return locals[0];
  if (!view) {
    const n = { id: uid(), date: todayISO(), createdAt: Date.now(), routineId: routineId, source: 'app', entries: [] };
    state.sessions.push(n);
    return n;
  }
  const keepId = locals.length ? locals[0].id : view.id;
  const n = Object.assign({}, view, { id: keepId, source: 'app', entries: view.entries.map((e) => Object.assign({}, e)) });
  locals.concat(repos).forEach((x) => { if (x.id !== keepId && state.deleted.indexOf(x.id) === -1) state.deleted.push(x.id); });
  state.sessions = state.sessions.filter((x) => !sameDay(x, routineId));
  state.sessions.push(n);
  return n;
}
function todaySets(ex, routineId) {
  const s = todaySession(routineId, false);
  return s ? s.entries.filter((x) => x.exerciseId === ex.id) : [];
}

// Registros anteriores de este ejercicio (mas reciente primero), sin contar lo que registras hoy en este dispositivo
function records(exId, n, includeToday) {
  const today = todayISO();
  const out = [];
  const sessions = sortedSessions();
  for (let i = 0; i < sessions.length && out.length < n; i++) {
    if (!includeToday && sessions[i].date >= today) continue; // lo de hoy no cuenta como "registro anterior"
    const sets = sessions[i].entries.filter((x) => x.exerciseId === exId);
    if (sets.length) out.push({ session: sessions[i], sets: sets });
  }
  return out;
}
function lastRecord(exId) { return records(exId, 1)[0] || null; }
// Ultimo registro en otra maquina del mismo grupo de alternativas (para ejercicios sin historial propio)
function altLast(ex) {
  const g = altGroupOf(ex.slot || ex.id);
  let best = null;
  (g || []).forEach((id) => {
    if (id === ex.id) return;
    const r = lastRecord(id);
    if (r && (!best || r.session.date > best.rec.session.date)) best = { id: id, rec: r };
  });
  return best;
}

// Resumen de una sesion: peso de trabajo (el maximo valido), series con ese peso y fuerza estimada
function summarize(rec) {
  const valid = rec.sets.filter((x) => x.weight != null && !x.badTech);
  if (!valid.length) return null;
  const W = Math.max.apply(null, valid.map((x) => x.weight));
  const top = valid.filter((x) => x.weight === W);
  const best = top.reduce((a, b) => (b.reps > a.reps ? b : a));
  const rpes = top.map((x) => x.rpe).filter((x) => x != null);
  // Calentamiento: series claramente mas ligeras y faciles (dificultad 8 o menos, o sin anotar). Una serie ligera pero dificil es de trabajo.
  const warm = valid.filter((x) => x.weight < 0.85 * W && (x.rpe == null || x.rpe <= 8)).slice(0, 3).map((x) => ({ w: x.weight, r: x.reps }));
  return {
    W: W, top: top, warm: warm,
    avgReps: top.reduce((t, x) => t + x.reps, 0) / top.length,
    avgRpe: rpes.length ? rpes.reduce((x, y) => x + y, 0) / rpes.length : null,
    e1rm: W * (1 + best.reps / 30) // Epley: sirve para comparar sesiones entre si
  };
}

function bestWeight(exId, sessions) {
  let best = null;
  sessions.forEach((s) => s.entries.forEach((x) => {
    if (x.exerciseId === exId && x.weight != null && !x.badTech && (best == null || x.weight > best)) best = x.weight;
  }));
  return best;
}

// ---------- progresion (doble progresion para hipertrofia) ----------
// Reglas:
//  1. Subir peso cuando completas el tope del rango en todas las series (o te sobraban, dificultad <= 7).
//     Si el salto de peso es grande para ese ejercicio (> 15 %), primero se piden mas repeticiones.
//  2. Estancamiento: 3 sesiones sin superar la de antes -> descarga (~90 % del peso, mas reps en reserva).
//  3. Si quedaste 2 o mas reps bajo el minimo del rango (meta de peso no lograda), baja el peso ya la proxima vez.
//     Con 1 rep de margen, o si ese dia cambiaste el orden/maquina (altOrder), se mantiene.
//  4. Si no, mantener el peso y sumar +1 repeticion por serie.
const BIG_JUMP = 0.15;
const EXTRA_REPS = 3;

// includeToday = true calcula la meta de la PROXIMA sesion, usando tambien lo registrado hoy
function plan(ex, includeToday) {
  const p = planCore(ex, includeToday);
  const rec = records(ex.id, 1, includeToday)[0];
  const sm = rec && summarize(rec);
  p.warm = sm ? sm.warm : []; // series de calentamiento de la ultima vez (mas ligeras que el peso de trabajo)
  return p;
}
function planCore(ex, includeToday) {
  const recs = records(ex.id, 4, includeToday);
  const range = ex.repMin + '–' + ex.repMax;
  const reps = (n) => Array(ex.sets).fill(n);
  const last = recs[0] && summarize(recs[0]);
  if (!recs.length && ex.startKg != null && ex.unit === 'kg/lado') {
    return { weight: ex.startKg, reps: reps(ex.repMin), trend: 'new',
      title: 'Primera vez · peso de partida',
      text: 'Parte con ' + ex.startKg + ' kg por lado y busca ' + range + ' reps con 1–2 en reserva. Si sobra mucho o no llegas, ajústalo.' };
  }
  if (!recs.length) {
    return { weight: null, reps: reps(ex.repMin), trend: 'new',
      title: 'Primera vez',
      text: 'Elige un peso con el que completes ' + range + ' reps dejando 1–2 en reserva. Prioriza la técnica.' };
  }
  if (!last) {
    return { weight: null, reps: reps(ex.repMin), trend: 'new',
      title: 'Sin peso de referencia',
      text: 'La última vez no quedó un peso válido. Busca uno para ' + range + ' reps con 1–2 en reserva.' };
  }
  const W = last.W;
  const jump = W > 0 ? ex.step / W : 0;
  const big = jump > BIG_JUMP;
  const cap = big ? ex.repMax + EXTRA_REPS : ex.repMax; // tope de reps antes de subir el peso
  const setsDone = Math.min(ex.sets, recs[0].sets.length);
  // La ultima serie de la sesion fue con el peso de trabajo (por ejemplo, tras series mas ligeras)
  const lastSetAtTop = recs[0].sets.length && recs[0].sets[recs[0].sets.length - 1].weight === W;
  const allTop = last.top.every((x) => x.reps >= cap) && (last.top.length >= Math.min(setsDone, 2) || lastSetAtTop);
  const easy = last.avgRpe != null && last.avgRpe <= 7 && last.avgReps >= ex.repMin && !big;

  // 1. Subir
  if (allTop || easy) {
    const nw = W + ex.step;
    return { weight: nw, reps: reps(ex.repMin), trend: 'up',
      title: 'Sube a ' + fmt(nw) + ' ' + ex.unit,
      text: allTop
        ? 'Completaste ' + cap + ' reps con ' + fmt(W) + '. Sube el peso y vuelve a construir desde ' + ex.repMin + ' reps.'
        : 'Te sobraron repeticiones con ' + fmt(W) + '. Más carga = más estímulo para crecer.' };
  }

  // Dias con orden de ejercicios o maquina distintos (marcados por ti): un mal dia asi no es motivo para bajar peso ni cuenta como estancamiento
  const alt = recs[0].sets.some((x) => x.altOrder);

  // 2. Estancamiento
  const sums = recs.map(summarize);
  // Solo se comparan sesiones con un peso de trabajo parecido (±20 %): si cambiaste de maquina o bajaste el peso
  // a proposito, una marca con otra carga no cuenta como estancamiento
  const comparable = sums.length >= 4 && sums.every(Boolean) && sums.slice(0, 4).every((x) => Math.abs(x.W - W) <= W * 0.2);
  if (!recs.slice(0, 3).some((rc) => rc.sets.some((x) => x.altOrder)) && comparable) {
    const ref = sums[3].e1rm;
    if (Math.max(sums[0].e1rm, sums[1].e1rm, sums[2].e1rm) <= ref) {
      const dw = Math.max(0, Math.min(W - ex.step, Math.round(W * 0.9 / ex.step) * ex.step));
      return { weight: dw, reps: reps(ex.repMin), trend: 'deload', title: 'Semana de descarga: ' + fmt(dw) + ' ' + ex.unit,
        text: 'Llevas 3 sesiones sin superar tu marca. Es normal: hoy baja el peso y deja 3–4 reps en reserva. Si sigue igual tras la descarga, prueba otra variante.' };
    }
  }

  // 3. Bajo el minimo: la carga es demasiado alta para hipertrofia -> bajar ya la proxima vez
  //    al peso con el que, segun tu fuerza estimada, alcanzarias el minimo del rango.
  if (last.avgReps < ex.repMin && (alt || last.avgReps >= ex.repMin - 1)) {
    // Margen: solo faltó 1 rep, o el día fue distinto al habitual -> se repite el peso
    return { weight: W, reps: reps(ex.repMin), trend: 'same',
      title: 'Mantén ' + fmt(W) + ' ' + ex.unit,
      text: alt ? 'La última vez cambiaste el orden o la máquina, así que no bajamos el peso. Repite ' + fmt(W) + ' e intenta llegar a ' + ex.repMin + ' reps.'
        : 'Te faltó solo 1 rep para el mínimo (' + ex.repMin + '). Repite ' + fmt(W) + '; si vuelve a pasar, bajamos el peso.' };
  }
  if (last.avgReps < ex.repMin) {
    const est = last.e1rm / (1 + ex.repMin / 30);
    const nw = Math.max(0, Math.min(W - ex.step, Math.floor(est / ex.step) * ex.step));
    return { weight: nw, reps: reps(ex.repMin), trend: 'down',
      title: 'Baja a ' + fmt(nw) + ' ' + ex.unit,
      text: 'No llegaste a ' + ex.repMin + ' reps con ' + fmt(W) + (last.avgRpe != null && last.avgRpe >= 9.5 ? ' (dificultad ' + fmt(last.avgRpe) + ')' : '') + '. Con ' + fmt(nw) + ' vuelves al rango de hipertrofia (' + range + ') y luego subes de nuevo.' };
  }

  // 4. Mantener y sumar repeticiones
  const target = [];
  for (let i = 0; i < ex.sets; i++) {
    const prev = last.top[Math.min(i, last.top.length - 1)].reps;
    target.push(Math.max(ex.repMin, Math.min(cap, prev + 1)));
  }
  return { weight: W, reps: target, trend: 'same',
    title: 'Mantén ' + fmt(W) + ' ' + ex.unit + ' y suma reps',
    text: big
      ? 'Subir a ' + fmt(W + ex.step) + ' sería un salto de ' + Math.round(jump * 100) + ' %. Antes, llega a ' + cap + ' reps en todas las series.'
      : 'Busca +1 repetición por serie. Cuando hagas ' + cap + ' en todas, sube el peso.' +
        (last.avgRpe != null && last.avgRpe >= 9.5 ? ' La última vez llegaste al límite (dificultad ' + fmt(last.avgRpe) + '): deja 1 repetición en reserva y descansa un poco más.' : '') };
}

// Texto corto de la meta: "80 kg/lado · 8 reps"
function targetText(ex, p) {
  const same = p.reps.every((x) => x === p.reps[0]);
  const w = p.warm || [];
  return (w.length ? 'Calienta ' + w.map((x) => fmt(x.w)).join(' y ') + ', luego ' : '') +
    (p.weight != null ? fmt(p.weight) + ' ' + ex.unit + ' · ' : '') + (same ? p.reps[0] + ' reps' : p.reps.join(' / ') + ' reps') +
    ' × ' + Math.max(1, ex.sets - w.length) + ' series de trabajo';
}

// Cumplimiento de las metas de hoy: las series claramente mas ligeras que la meta se toman como calentamiento
function goalStats(ex, routineId) {
  const p = plan(ex);
  const logged = todaySets(ex, routineId);
  let wi = 0; // indice entre las series de trabajo (el calentamiento no cuenta)
  const rows = logged.map((e) => {
    const work = !e.altOrder && (p.weight == null || (e.weight != null && e.weight >= 0.85 * p.weight));
    const tr = p.reps[Math.min(wi, p.reps.length - 1)];
    if (work || e.altOrder) wi++;
    // Hipertrofia: la carga manda mientras la serie siga dentro del rango de repeticiones.
    // Con mas peso que la meta basta llegar al minimo del rango; con el peso de la meta hay que igualar las reps.
    const heavier = work && p.weight != null && e.weight != null && e.weight > p.weight;
    const hit = work && (heavier ? e.reps >= ex.repMin : e.reps >= tr && (p.weight == null || e.weight == null || e.weight >= p.weight));
    return { work: work, hit: hit, up: hit && heavier && e.reps < tr, target: tr };
  });
  return { rows: rows, work: rows.filter((x) => x.work).length, hit: rows.filter((x) => x.hit).length, plan: p };
}

// Ajuste dentro de la sesion segun la serie recien hecha
function adjustAfter(ex, set, base) {
  if (set.weight == null) return base;
  if (set.reps < ex.repMin) return Math.max(0, set.weight - ex.step);
  if (set.rpe != null && set.rpe <= 7 && set.reps >= ex.repMin && ex.step / Math.max(set.weight, 1) <= BIG_JUMP) return set.weight + ex.step;
  return set.weight;
}

// ---------- volumen semanal ----------
// Series directas por musculo en los ultimos 7 dias. Referencia para hipertrofia: 10–20 por semana.
const VOL_MIN = 10, VOL_MAX = 20;
const VOL_MIN_BY = { isquios: 8 }; // meta propia: los isquiotibiales tambien trabajan en prensa e hip thrust
const volMin = (k) => VOL_MIN_BY[k] || VOL_MIN;
function weeklyVolume() {
  const out = {};
  Object.keys(MUSCLES).forEach((k) => { out[k] = 0; });
  allSessions().forEach((s) => {
    if (daysSince(s.date) >= 7) return;
    s.entries.forEach((x) => { const ex = exById[x.exerciseId]; if (ex && ex.muscle) out[ex.muscle]++; });
  });
  return out;
}
// Mensaje en palabras simples para cada musculo
function volStatus(n, key) {
  const min = volMin(key), left = min - n;
  if (n === 0) return { cls: 'low', text: 'Sin series esta semana. Meta: ' + min + '.' };
  if (left > 0) return { cls: 'low', text: 'Te ' + (left === 1 ? 'falta 1 serie' : 'faltan ' + left + ' series') + ' para la meta.' };
  if (n > VOL_MAX) return { cls: 'high', text: 'Más de ' + VOL_MAX + ': es suficiente, prioriza recuperar.' };
  return { cls: 'ok', text: '¡Meta cumplida!' };
}
function volumeMeter(key, n) {
  const st = volStatus(n, key), min = volMin(key);
  const pct = Math.min(100, 100 * n / min);
  return h('div', { class: 'goal ' + st.cls },
    h('div', { class: 'goal-top' },
      h('span', { class: 'goal-name' }, MUSCLES[key]),
      h('span', { class: 'goal-num' }, h('b', {}, n), ' de ' + min + ' series')),
    h('div', { class: 'goal-bar', role: 'progressbar', 'aria-label': MUSCLES[key], 'aria-valuenow': n, 'aria-valuemin': 0, 'aria-valuemax': min },
      h('i', { style: 'width:' + pct + '%' })),
    h('div', { class: 'goal-msg' }, (st.cls === 'ok' ? '✓ ' : st.cls === 'high' ? '! ' : '') + st.text));
}
function volumeIntro(list, vol) {
  const done = list.filter((k) => vol[k] >= volMin(k)).length;
  return h('div', { class: 'goal-intro' },
    h('div', { class: 'goal-score' }, h('b', {}, done), ' de ' + list.length + ' músculos cumplen la meta'),
    h('p', { class: 'muted small' }, 'Para ganar músculo, cada uno necesita al menos ' + VOL_MIN + ' series por semana. Aquí se cuentan las que hiciste en los últimos 7 días, incluido hoy.'));
}

// ---------- acciones ----------
function renumber(entries) {
  const count = {};
  entries.forEach((e) => { count[e.exerciseId] = (count[e.exerciseId] || 0) + 1; e.set = count[e.exerciseId]; });
}

function logSet(ex, routineId, row, w, r) {
  const reps = parseInt(r, 10);
  if (!(reps > 0)) { toast('Escribe las repeticiones de la serie ' + (row + 1) + '.'); return; }
  const entry = { exerciseId: ex.id, set: 0, weight: parseNum(w), reps: reps, rpe: null };
  if (drafts[ex.id].alt) entry.altOrder = true;
  const before = bestWeight(ex.id, allSessions());
  const s = todaySession(routineId, true);
  s.entries.push(entry);
  renumber(s.entries);
  touch(s);
  delete drafts[ex.id][row];
  save(true);
  startTimer(restOf(ex));
  if (entry.weight != null && before != null && entry.weight > before) toast('¡Nuevo récord en ' + ex.name + '! 🎉');
  else if (entry.reps < ex.repMin) toast('Está bien quedarse corto: ajusta el peso y sigue.');
  else toast('Serie ' + (row + 1) + ' registrada. ¡Bien hecho!');
  render();
}

function unlogSet(entry, routineId) {
  const s = todaySession(routineId, true);
  // La entrada puede venir de la vista unida: se busca por contenido en la copia editable
  const target = s.entries.find((x) => x.exerciseId === entry.exerciseId && x.set === entry.set);
  s.entries = s.entries.filter((x) => x !== target);
  renumber(s.entries);
  touch(s);
  if (!s.entries.length) forget(s);
  save(true); render();
}
