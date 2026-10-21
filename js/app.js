/* Rutinas — registro de series, progresion y temporizador. Sin dependencias. */
(function () {
  'use strict';

  const VERSION = '45';
  const KEY = 'rutinas.v1';
  const IMG_KEY = 'rutinas.img.v1';
  const REST_KEY = 'rutinas.rest.v1';
  const UNIT_KEY = 'rutinas.unit.v1'; // ejercicios cuyo peso cambiaste entre "total" y "por lado"
  const PHOTOS_KEY = 'rutinas.photos.v1'; // fotos propias de cada ejercicio (varias), solo en este dispositivo
  const SNOOZE_KEY = 'rutinas.bodysnooze.v1';
  const BODY_REMIND_DAYS = 35; // aviso de nuevo control corporal a las 5 semanas
  const CARDIO_KEY = 'rutinas.cardio.v1'; // sesiones de cardio: solo en este dispositivo
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
  function saveCardio() { try { localStorage.setItem(CARDIO_KEY, JSON.stringify(cardio)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } }
  function saveBody() { try { localStorage.setItem(BODY_KEY, JSON.stringify(body)); } catch (e) { toast('No se pudo guardar en este dispositivo.'); } }
  const bodySorted = () => body.controls.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const lastBody = () => { const s = bodySorted(); return s.length ? s[s.length - 1] : null; };
  // Estimacion de calorias de una sesion: ~3,2 min por serie (trabajo + descanso), MET 4 para pesas con descansos largos
  function kcalEstimate(nSets) {
    const lb = lastBody();
    if (!lb || !lb.peso || !nSets) return null;
    const minutes = nSets * 3.2;
    return { minutes: Math.round(minutes), kcal: Math.round(4 * lb.peso * minutes / 60) };
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
    if (!recs.slice(0, 3).some((rc) => rc.sets.some((x) => x.altOrder)) && sums.length >= 4 && sums.every(Boolean)) {
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

  // ---------- guardado en la nube (GitHub) ----------
  // La app guarda las sesiones en data/sessions.json del repositorio, con una llave de acceso
  // (token de GitHub con permiso solo para este repositorio) guardada en este dispositivo.
  const GH = { owner: 'yohnnier', repo: 'Gym', branch: 'main', path: 'data/sessions.json' };
  const GH_API = 'https://api.github.com/repos/' + GH.owner + '/' + GH.repo;
  const TOKEN_KEY = 'rutinas.gh.v1';
  let ghToken = null;
  try { ghToken = localStorage.getItem(TOKEN_KEY) || null; } catch (e) { /* sin almacenamiento */ }
  const sync = { status: ghToken ? 'idle' : 'off', at: 0, error: '', running: false, again: false, timer: null };

  function b64enc(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64dec(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function ghError(status) {
    const e = new Error(
      status === 401 ? 'la llave no es válida o ya venció'
        : status === 403 || status === 404 ? 'la llave no tiene permiso para guardar en el repositorio Gym'
        : status === 0 ? 'no hubo respuesta de GitHub (revisa tu conexión a internet)'
        : 'GitHub respondió con un error (' + status + ')');
    e.status = status;
    return e;
  }
  function ghHeaders(token) {
    return { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }
  // Con limite de 20 s para que nunca se quede esperando
  async function ghFetch(url, opts) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    try { return await fetch(url, Object.assign({}, opts, ctrl ? { signal: ctrl.signal } : {})); }
    catch (e) { throw ghError(0); }
    finally { clearTimeout(t); }
  }
  async function ghRead(token) {
    const r = await ghFetch(GH_API + '/contents/' + GH.path + '?ref=' + GH.branch + '&t=' + Date.now(), { headers: ghHeaders(token), cache: 'no-store' });
    if (r.status === 404) {
      // ¿No existe el archivo o la llave no ve el repositorio?
      const repo = await ghFetch(GH_API, { headers: ghHeaders(token), cache: 'no-store' });
      if (repo.ok) return { list: [], sha: null };
      throw ghError(repo.status);
    }
    if (!r.ok) throw ghError(r.status);
    const j = await r.json();
    const list = JSON.parse(b64dec(j.content || '') || '[]');
    return { list: Array.isArray(list) ? list : [], sha: j.sha };
  }
  async function ghWrite(token, list, sha, message) {
    const body = { message: message, content: b64enc(JSON.stringify(list, null, 1) + '\n'), branch: GH.branch };
    if (sha) body.sha = sha;
    const r = await ghFetch(GH_API + '/contents/' + GH.path, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) { const e = ghError(r.status); e.conflict = true; throw e; }
    if (!r.ok) throw ghError(r.status);
  }
  function fileOrder(list) {
    return list.slice().sort((a, b) => (a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : (a.date < b.date ? -1 : 1)));
  }

  function setSync(status, error) {
    sync.status = status;
    if (error != null) sync.error = error;
    document.querySelectorAll('.sync-status').forEach((el) => { el.replaceWith(syncBadge()); });
  }
  function syncText() {
    switch (sync.status) {
      case 'off': return { cls: 'off', text: 'Guardado solo en este dispositivo. Actívalo en Rutinas → Guardado en la nube.' };
      case 'pending': return { cls: 'wait', text: '☁ Cambios pendientes de guardar…' };
      case 'saving': return { cls: 'wait', text: '☁ Guardando en la nube…' };
      case 'ok': return { cls: 'ok', text: '☁ Guardado en la nube · ' + new Date(sync.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) };
      case 'error': return { cls: 'err', text: '⚠ No se pudo guardar en la nube: ' + sync.error + '. Tus datos siguen en este dispositivo y se reintentará.' };
      default: return { cls: 'wait', text: '☁ Conectado a la nube' };
    }
  }
  function syncBadge() {
    const t = syncText();
    return h('div', { class: 'sync-status ' + t.cls, role: 'status' }, t.text);
  }

  function scheduleSync(delay) {
    if (!ghToken) return;
    if (sync.status !== 'saving') setSync('pending');
    clearTimeout(sync.timer);
    sync.timer = setTimeout(runSync, delay == null ? 6000 : delay);
  }

  async function runSync() {
    if (!ghToken) return;
    if (sync.running) { sync.again = true; return; }
    sync.running = true;
    clearTimeout(sync.timer);
    setSync('saving');
    try {
      for (let attempt = 0; ; attempt++) {
        const remote = await ghRead(ghToken);
        const merged = mergeSessions(remote.list, state.sessions, state.deleted);
        const before = JSON.stringify(fileOrder(remote.list));
        const after = fileOrder(merged);
        if (JSON.stringify(after) !== before) {
          const latest = merged.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
          const msg = latest ? 'Registro desde la app: ' + routineOf(latest).name + ' ' + latest.date : 'Registro desde la app';
          try { await ghWrite(ghToken, after, remote.sha, msg); }
          catch (e) { if (e.conflict && attempt < 2) continue; throw e; }
        }
        const remoteChanged = JSON.stringify(fileOrder(repoSessions)) !== JSON.stringify(after);
        state.sessions = merged;
        repoSessions = merged;
        save(false);
        sync.at = Date.now();
        setSync('ok', '');
        // Redibujar solo si llegaron datos nuevos y no estas escribiendo en un campo
        if (remoteChanged && !(document.activeElement && document.activeElement.tagName === 'INPUT')) render();
        break;
      }
    } catch (e) {
      setSync('error', e.message);
      if (e.status === 0 || !e.status || e.status >= 500) sync.timer = setTimeout(runSync, 60000);
    } finally {
      sync.running = false;
      if (sync.again) { sync.again = false; scheduleSync(1000); }
    }
  }

  async function connectGitHub(token, done) {
    token = token.trim();
    if (!token) { done('primero pega la llave en el campo (empieza por github_pat_)'); return; }
    try {
      await ghRead(token);
    } catch (e) { done(e.message); return; }
    ghToken = token;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* sin almacenamiento */ }
    toast('Conectado. Guardando tus registros en la nube…');
    done(null);
    await runSync();
    render();
  }
  function disconnectGitHub() {
    if (!confirm('¿Desconectar? Tus registros quedan guardados en la nube y en este dispositivo, pero los nuevos solo se guardarán aquí.')) return;
    ghToken = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* sin almacenamiento */ }
    clearTimeout(sync.timer);
    setSync('off', '');
    render();
  }

  function cloudCard() {
    const card = h('section', { class: 'card cloud' });
    if (ghToken) {
      card.append(
        h('strong', {}, '☁ Conectado a GitHub'),
        h('p', { class: 'muted small' }, 'Cada serie que registras se guarda sola en tu repositorio (' + GH.owner + '/' + GH.repo + '). Puedes abrir la app en otro dispositivo y conectarlo con la misma llave.'),
        syncBadge(),
        h('div', { class: 'row wrap', style: 'margin-top:10px' },
          h('button', { class: 'btn', type: 'button', onclick: () => runSync() }, 'Guardar ahora'),
          h('button', { class: 'btn ghost', type: 'button', onclick: disconnectGitHub }, 'Desconectar')));
      return card;
    }
    const input = h('input', { type: 'password', autocomplete: 'off', placeholder: 'github_pat_…', 'aria-label': 'Llave de acceso de GitHub' });
    const msg = h('p', { class: 'small', style: 'margin:8px 0 0' });
    const btn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
      btn.disabled = true; msg.textContent = 'Comprobando…'; msg.className = 'small muted';
      connectGitHub(input.value, (err) => {
        btn.disabled = false;
        if (err) { msg.textContent = 'No se pudo conectar: ' + err + '.'; msg.className = 'small err-text'; }
      });
    } }, 'Conectar');
    card.append(
      h('strong', {}, 'Guarda tus registros en la nube'),
      h('p', { class: 'muted small' }, 'Ahora tus registros están solo en este dispositivo. Conecta tu repositorio de GitHub para guardarlos solos, verlos en todos tus dispositivos y no perderlos nunca.'),
      h('ol', { class: 'steps small' },
        h('li', {}, 'Abre ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'github.com/settings/personal-access-tokens/new'), '.'),
        h('li', {}, 'Nombre: "Rutinas". Caducidad: la que prefieras (por ejemplo, 1 año).'),
        h('li', {}, 'En "Repository access" elige "Only select repositories" y marca ', h('b', {}, 'Gym'), '.'),
        h('li', {}, 'En "Permissions" pulsa "+ Add permissions", marca ', h('b', {}, 'Contents'), ' y cambia su acceso a ', h('b', {}, '"Read and write"'), '.'),
        h('li', {}, 'Pulsa "Generate token", copia la llave y pégala aquí.')),
      h('div', { class: 'row' }, input, btn),
      msg,
      h('p', { class: 'muted small' }, 'La llave se guarda solo en este dispositivo y solo sirve para el repositorio Gym. No la compartas con nadie, ni en el chat. Las fotos que cambies no se suben, solo los registros.'));
    return card;
  }

  // ---------- exportar / importar ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function sessionToMd(s) {
    let md = '# ' + routineOf(s).name + ' — Registro ' + fmtDate(s.date) + '\n\n';
    md += '| Ejercicio | Serie | Peso | Repeticiones | Dificultad |\n|---|---|---|---|---|\n';
    s.entries.forEach((e) => {
      const ex = exById[e.exerciseId] || { name: e.exerciseId, unit: 'kg' };
      const extra = [e.note, e.badTech ? 'técnica incompleta' : ''].filter(Boolean).join('; ');
      md += '| ' + ex.name + ' | ' + e.set + ' | ' + (e.weight == null ? '—' : fmt(e.weight) + ' ' + ex.unit) +
        ' | ' + e.reps + (extra ? ' (' + extra + ')' : '') + ' | ' + (e.rpe == null ? '—' : e.rpe + '/10') + ' |\n';
    });
    return md;
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.sessions)) throw new Error('formato');
        if (!confirm('Esto reemplaza tus datos actuales. ¿Continuar?')) return;
        state = { sessions: data.sessions, deleted: Array.isArray(data.deleted) ? data.deleted : [] };
        if (data.body && Array.isArray(data.body.controls)) { body = data.body; saveBody(); }
        if (data.cardio && Array.isArray(data.cardio.sessions)) { cardio = data.cardio; saveCardio(); }
        save(true); render();
      } catch (e) {
        alert('El archivo no es una exportación válida de esta app.');
      }
    };
    reader.readAsText(file);
  }

  // ---------- navegacion ----------
  // #/  inicio · #/g/<grupo>  pagina del grupo · #/prog · #/hist · #/rutina
  function route() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'g' && routineById[p[1]]) return { view: 'group', group: routineById[p[1]] };
    if (p[0] === 'prog' || p[0] === 'hist' || p[0] === 'rutina' || p[0] === 'cuerpo' || p[0] === 'cardio') return { view: p[0] };
    return { view: 'hoy' };
  }
  function go(hash) {
    if (location.hash === hash) render(); else location.hash = hash;
  }

  // ---------- vistas ----------
  function render() {
    const r = route();
    const root = $('#app');
    root.replaceChildren();
    $('#sub').textContent = longDate(new Date());
    const tab = r.view === 'group' ? 'hoy' : (r.view === 'cuerpo' || r.view === 'cardio') ? 'prog' : r.view;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    if (r.view === 'group') renderGroup(root, r.group);
    else if (r.view === 'prog') renderProg(root);
    else if (r.view === 'cuerpo') renderCuerpo(root);
    else if (r.view === 'cardio') renderCardio(root);
    else if (r.view === 'hist') renderHist(root);
    else if (r.view === 'rutina') renderRutina(root);
    else renderHome(root);
  }

  function specText(ex) {
    return (ex.setsText || ex.sets) + ' × ' + ex.repMin + '–' + ex.repMax + (ex.perLeg ? ' por lado' : '') + ' · descanso ' + (customRest[ex.id] ? restTxt(customRest[ex.id]) : ex.restText);
  }

  // A que dia del plan cuenta una sesion de cardio: la guardada desde el dia, o por su tipo si vino de la pagina Cardio
  function cardioDayOf(c) {
    if (c.libre) return null; // cardio extra: no mueve el plan
    if (c.dia) return c.dia;
    const want = c.tipo === 'Intervalos' ? 'dia-cardio-2' : 'dia-cardio';
    return DAYS.some((d) => d.id === want) ? want : null;
  }
  // Siguiente dia del plan: el que sigue al ultimo que hiciste (cuenta pesas y cardio); como el plan intercala
  // pesas y cardio, asi te toca un dia de cada uno. Si dos dias caen en la misma fecha, vale el de mas adelante.
  function planNext() {
    const ld = lastDoneByGroup();
    let best = -1, bestDate = '';
    DAYS.forEach((d, i) => { const dt = ld[d.id]; if (dt && dt >= bestDate) { bestDate = dt; best = i; } });
    return DAYS[(best + 1) % DAYS.length];
  }
  function lastDoneByGroup() {
    const out = {};
    sortedSessions().forEach((x) => { const id = x.routineId || 'piernas'; if (!out[id]) out[id] = x.date; });
    cardio.sessions.forEach((c) => { const id = cardioDayOf(c); if (id && (!out[id] || c.date > out[id])) out[id] = c.date; });
    return out;
  }

  // ---------- recuperacion por musculo ----------
  // Musculos grandes: 72 h; el resto (brazos, hombros, pantorrillas, abdomen): 48 h.
  // El trabajo indirecto (musculo secundario del ejercicio) tambien cansa, pero un dia menos.
  const REC_DAYS = { cuadriceps: 3, isquios: 3, gluteos: 3, pecho: 3, espalda: 3, lumbar: 3 };
  const recNeed = (k) => REC_DAYS[k] || 2;
  function recovery() {
    const out = {};
    Object.keys(MUSCLES).forEach((k) => { out[k] = { left: 0, last: null }; });
    allSessions().forEach((s) => {
      const d = daysSince(s.date);
      if (d < 0 || d > 7) return;
      s.entries.forEach((x) => {
        const ex = exById[x.exerciseId];
        if (!ex) return;
        const hit = (k, direct) => {
          const o = out[k];
          if (!o) return;
          o.left = Math.max(o.left, recNeed(k) - (direct ? 0 : 1) - d);
          if (direct && (o.last == null || d < o.last)) o.last = d;
        };
        hit(ex.muscle, true);
        (ex.secondary || []).forEach((k) => hit(k, false));
      });
    });
    return out;
  }
  // Mapa del cuerpo (frente y espalda) coloreado segun la recuperacion de cada musculo.
  // Formas de los musculos derivadas de react-body-highlighter (MIT License, Copyright (c) 2020 GV79),
  // suavizadas y con volumen, fibras y brillo hechos con filtros SVG.
  const BODY_PATHS = {"front":[["pecho","M51.8 41.6C50.0 43.9 50.0 52.4 51.0 55.1C52.0 57.8 55.2 57.9 58.0 58.0C60.7 58.0 65.6 57.3 67.8 55.5C69.9 53.7 71.6 49.7 70.6 47.3C69.7 45.0 65.2 42.6 62.0 41.6C58.9 40.7 53.7 39.4 51.8 41.6Z"],["pecho","M29.8 46.5C28.8 48.8 29.6 53.6 31.4 55.5C33.3 57.4 38.0 58.0 40.8 58.0C43.6 57.9 47.0 57.8 48.2 55.1C49.3 52.4 49.5 44.2 47.8 42.0C46.0 39.9 40.5 41.3 37.6 42.0C34.6 42.8 30.8 44.3 29.8 46.5Z"],["abdomen","M68.6 63.3C68.7 61.2 69.0 57.8 67.3 57.1C65.7 56.5 60.0 58.4 58.8 59.6C57.6 60.7 59.7 60.1 60.0 64.1C60.3 68.0 59.5 80.8 60.4 83.3C61.4 85.7 64.7 81.0 65.7 78.8C66.7 76.5 66.1 72.4 66.5 69.8C67.0 67.2 68.4 65.4 68.6 63.3Z"],["abdomen","M33.9 78.4C32.9 76.4 33.5 74.4 33.1 71.8C32.6 69.3 31.2 65.7 31.0 63.3C30.9 60.8 30.6 57.8 32.2 57.1C33.9 56.5 39.7 58.2 40.8 59.2C42.0 60.2 39.5 59.2 39.2 63.3C38.9 67.3 40.1 81.2 39.2 83.7C38.3 86.2 34.9 80.3 33.9 78.4Z"],["abdomen","M56.3 59.2C57.5 60.3 57.6 61.0 58.0 64.1C58.3 67.2 58.3 73.2 58.4 78.0C58.4 82.7 58.7 89.3 58.4 92.7C58.0 96.1 56.9 96.5 56.3 98.4C55.8 100.3 55.9 102.5 55.1 104.1C54.3 105.6 52.1 111.0 51.4 107.8C50.7 104.5 51.2 91.2 51.0 84.5C50.9 77.8 50.6 71.9 50.6 67.3C50.6 62.8 50.1 58.5 51.0 57.1C52.0 55.8 55.2 58.0 56.3 59.2Z"],["abdomen","M43.7 58.8C44.9 57.6 47.7 55.7 48.6 57.1C49.5 58.6 49.0 62.8 49.0 67.3C49.0 71.9 48.7 77.8 48.6 84.5C48.4 91.2 48.8 104.1 48.2 107.3C47.5 110.5 45.7 106.3 44.5 103.7C43.3 101.0 41.4 95.6 40.8 91.4C40.2 87.2 40.7 82.9 40.8 78.4C40.9 73.9 40.7 67.8 41.2 64.5C41.7 61.2 42.4 60.0 43.7 58.8Z"],["biceps","M16.7 68.2C16.3 70.7 16.9 71.8 18.0 71.4C19.0 71.1 21.0 69.0 22.9 66.1C24.7 63.2 28.2 56.7 29.0 53.9C29.8 51.1 29.2 49.0 27.8 49.4C26.3 49.7 22.2 52.8 20.4 55.9C18.6 59.0 17.1 65.6 16.7 68.2Z"],["biceps","M71.4 49.4C70.0 49.3 69.4 51.9 70.2 54.7C71.0 57.5 74.4 63.3 76.3 66.1C78.2 69.0 80.5 71.4 81.6 71.8C82.7 72.3 83.3 71.7 82.9 69.0C82.4 66.3 80.7 58.8 78.8 55.5C76.9 52.2 72.9 49.5 71.4 49.4Z"],["triceps","M69.4 55.5C68.4 54.6 68.3 58.8 69.4 61.6C70.5 64.5 74.6 71.2 75.9 72.7C77.3 74.1 77.6 71.1 77.6 70.2C77.5 69.3 76.9 69.8 75.5 67.3C74.1 64.9 70.4 56.5 69.4 55.5Z"],["triceps","M22.4 69.4C23.6 66.5 28.6 56.9 29.8 55.5C31.0 54.1 31.0 57.9 29.8 60.8C28.6 63.7 24.1 71.6 22.9 73.1C21.6 74.5 21.3 72.3 22.4 69.4Z"],["","M55.5 23.7C54.2 24.1 51.4 30.9 50.6 33.5C49.8 36.1 48.8 38.1 50.6 39.2C52.4 40.3 58.3 39.0 61.6 40.0C65.0 41.0 69.3 45.4 70.6 44.9C71.9 44.4 70.6 38.4 69.4 36.7C68.2 35.1 65.1 36.1 63.3 35.1C61.4 34.1 59.7 32.5 58.4 30.6C57.1 28.7 56.8 23.2 55.5 23.7Z"],["","M29.0 44.9C27.7 44.5 29.0 38.8 30.2 37.1C31.4 35.5 34.5 36.3 36.3 35.1C38.2 33.9 39.9 32.0 41.2 30.2C42.6 28.4 43.2 23.9 44.5 24.5C45.8 25.1 48.3 31.4 49.0 33.9C49.7 36.3 50.4 38.2 48.6 39.2C46.7 40.1 41.2 38.6 38.0 39.6C34.7 40.5 30.3 45.3 29.0 44.9Z"],["hombros","M78.4 53.1C79.7 53.1 79.5 49.7 79.6 47.8C79.7 45.8 79.8 42.9 79.2 41.2C78.6 39.6 77.3 38.8 75.9 38.0C74.6 37.1 71.6 35.5 71.0 36.3C70.4 37.1 72.2 41.0 72.2 42.9C72.3 44.7 70.4 45.6 71.4 47.3C72.4 49.0 77.0 53.0 78.4 53.1Z"],["hombros","M28.2 47.3C27.2 49.0 22.6 53.0 21.2 53.1C19.9 53.1 20.1 49.8 20.0 47.8C19.9 45.7 19.7 42.6 20.4 40.8C21.2 39.0 23.1 37.8 24.5 37.1C25.9 36.5 28.2 36.1 28.6 37.1C29.0 38.2 27.0 41.6 26.9 43.3C26.9 45.0 29.1 45.7 28.2 47.3Z"],["head","M42.4 2.9C39.5 6.4 40.1 6.8 40.0 11.8C39.9 16.9 40.2 16.2 42.0 19.6C43.9 23.0 43.8 21.6 46.1 23.3C48.4 25.0 47.2 25.6 49.8 25.3C52.4 25.1 52.4 24.3 54.7 22.4C57.0 20.6 56.2 22.9 57.6 19.2C58.9 15.5 59.3 15.2 59.2 10.2C59.1 5.2 60.0 5.5 57.1 2.4C54.3 -0.6 54.2 -0.1 49.8 0.0C45.4 0.1 45.4 -0.7 42.4 2.9Z"],["","M52.7 110.2C52.2 113.6 53.1 124.9 54.3 124.9C55.5 124.9 58.7 114.4 60.0 110.2C61.3 106.1 61.2 102.7 62.0 100.0C62.9 97.3 65.2 95.5 64.9 94.3C64.6 93.1 61.4 91.0 60.0 92.7C58.6 94.4 58.0 101.6 56.7 104.5C55.5 107.4 53.1 106.8 52.7 110.2Z"],["","M47.8 110.6C48.0 113.9 45.9 124.4 44.9 125.3C43.9 126.2 42.8 118.0 42.0 115.9C41.3 113.9 40.8 114.5 40.4 113.1C40.0 111.6 40.0 109.1 39.6 107.3C39.2 105.6 38.8 104.7 38.0 102.4C37.1 100.2 34.4 95.6 34.7 93.9C35.0 92.2 38.4 91.4 39.6 92.2C40.7 93.1 41.0 97.0 41.6 99.2C42.3 101.4 42.7 103.4 43.7 105.3C44.7 107.2 47.6 107.3 47.8 110.6Z"],["cuadriceps","M34.7 98.8C35.5 101.0 36.7 103.3 37.1 108.2C37.6 113.0 37.6 122.9 37.1 127.8C36.7 132.6 35.3 136.3 34.3 137.1C33.3 138.0 31.8 135.5 31.0 132.7C30.2 129.8 29.9 123.5 29.4 120.0C28.9 116.5 28.2 114.6 28.2 111.4C28.2 108.2 28.7 103.6 29.4 100.8C30.1 98.0 31.4 95.0 32.2 94.7C33.1 94.4 33.9 96.5 34.7 98.8Z"],["cuadriceps","M63.3 105.7C63.7 103.8 63.9 101.8 64.5 100.0C65.1 98.2 66.0 94.5 66.9 94.7C67.9 94.9 69.5 98.4 70.2 101.2C70.9 104.1 71.4 106.5 71.0 111.8C70.7 117.1 69.1 128.8 68.2 133.1C67.2 137.3 66.3 138.3 65.3 137.6C64.4 136.8 63.0 132.9 62.4 128.6C61.9 124.2 61.9 115.2 62.0 111.4C62.2 107.6 62.9 107.6 63.3 105.7Z"],["cuadriceps","M38.8 129.4C39.3 124.8 38.0 114.1 38.4 112.2C38.8 110.4 40.2 115.5 41.2 118.4C42.2 121.2 44.2 126.6 44.5 129.4C44.8 132.2 43.6 132.3 42.9 135.1C42.1 137.9 41.1 144.2 40.0 146.1C38.9 148.0 37.1 147.6 36.3 146.5C35.6 145.5 35.1 142.9 35.5 140.0C35.9 137.1 38.3 134.0 38.8 129.4Z"],["cuadriceps","M59.6 145.7C58.4 142.8 55.3 134.3 55.5 129.0C55.7 123.7 59.9 113.7 60.8 113.9C61.8 114.1 60.7 125.9 61.2 130.2C61.8 134.5 63.8 136.9 64.1 139.6C64.4 142.3 63.6 145.5 62.9 146.5C62.1 147.6 60.8 148.6 59.6 145.7Z"],["cuadriceps","M32.7 138.4C32.2 140.4 27.7 146.0 26.5 145.7C25.4 145.4 25.9 139.8 25.7 136.7C25.6 133.7 25.5 131.1 25.7 127.3C25.9 123.6 26.3 113.3 26.9 114.3C27.6 115.3 28.4 129.5 29.4 133.5C30.3 137.5 33.1 136.3 32.7 138.4Z"],["cuadriceps","M71.8 113.1C72.4 111.5 73.5 119.5 73.9 124.1C74.2 128.6 74.1 136.8 73.9 140.4C73.7 144.0 73.9 146.1 72.7 145.7C71.4 145.4 66.9 140.4 66.5 138.4C66.1 136.3 69.3 137.7 70.2 133.5C71.1 129.3 71.2 114.6 71.8 113.1Z"],["","M33.9 140.0C34.6 139.9 34.4 142.0 34.7 143.3C35.0 144.5 35.2 146.1 35.5 147.3C35.8 148.6 36.4 149.5 36.3 151.0C36.3 152.6 36.2 155.8 35.1 156.7C34.0 157.7 31.1 157.4 29.8 156.7C28.5 156.1 27.8 154.2 27.3 152.7C26.9 151.1 26.9 148.8 27.3 147.3C27.8 145.9 29.1 145.3 30.2 144.1C31.3 142.9 33.1 140.1 33.9 140.0Z"],["","M65.7 140.0C67.3 139.5 71.2 145.7 72.2 147.8C73.3 149.8 72.7 150.7 72.2 152.2C71.8 153.8 71.0 156.4 69.8 157.1C68.6 157.9 66.1 157.8 64.9 156.7C63.7 155.7 62.7 153.8 62.9 151.0C63.0 148.2 64.1 140.5 65.7 140.0Z"],["pantorrillas","M71.4 160.4C71.2 153.4 72.6 153.3 73.5 153.5C74.4 153.6 75.7 158.8 76.7 161.2C77.8 163.6 79.3 163.3 79.6 167.8C79.9 172.2 78.4 183.1 78.4 187.8C78.4 192.4 80.2 194.2 79.6 195.5C79.0 196.8 76.1 201.4 74.7 195.5C73.3 189.7 71.6 167.4 71.4 160.4Z"],["pantorrillas","M24.9 194.7C26.1 189.6 27.2 170.6 27.8 164.9C28.3 159.2 28.4 162.2 28.2 160.4C27.9 158.6 26.7 154.8 26.1 154.3C25.6 153.8 25.5 156.3 24.9 157.6C24.3 158.8 23.1 159.9 22.4 161.6C21.8 163.3 20.9 163.3 20.8 167.8C20.7 172.2 22.0 183.5 22.0 188.2C22.0 192.8 20.3 194.4 20.8 195.5C21.3 196.6 23.7 199.8 24.9 194.7Z"],["pantorrillas","M72.7 195.1C73.3 192.1 71.0 165.3 69.8 159.2C68.6 153.1 66.3 157.8 65.3 158.4C64.4 158.9 64.3 161.3 64.1 162.4C63.9 163.6 63.8 162.9 64.1 165.3C64.4 167.8 64.3 172.2 65.7 177.1C67.1 182.1 72.0 198.1 72.7 195.1Z"],["pantorrillas","M35.5 158.4C36.5 159.0 35.9 161.0 35.9 162.4C36.0 163.9 36.1 165.3 35.9 166.9C35.8 168.6 35.2 170.6 35.1 172.2C35.0 173.9 35.6 175.1 35.1 176.7C34.6 178.4 33.0 180.3 32.2 182.0C31.5 183.8 31.5 185.2 30.6 187.3C29.7 189.5 27.5 194.6 26.9 194.7C26.4 194.8 27.1 190.1 27.3 187.8C27.6 185.4 28.0 182.4 28.2 180.4C28.4 178.4 28.4 177.3 28.6 175.5C28.7 173.7 28.8 171.7 29.0 169.8C29.2 167.9 29.6 165.9 29.8 164.1C30.0 162.2 29.3 159.7 30.2 158.8C31.2 157.8 34.6 157.8 35.5 158.4Z"],["","M6.1 88.6C7.8 84.4 8.8 78.2 10.2 75.1C11.6 72.0 13.7 70.3 14.7 70.2C15.7 70.1 15.6 73.7 16.3 74.3C17.1 74.8 21.2 69.6 19.2 73.5C17.2 77.3 7.7 93.1 4.5 97.6C1.3 102.0 -0.3 101.5 0.0 100.0C0.3 98.5 4.4 92.7 6.1 88.6Z"],["","M84.5 69.8C83.4 69.3 84.0 72.9 83.3 73.5C82.5 74.0 78.0 68.9 80.0 73.1C82.0 77.2 91.8 93.8 95.1 98.4C98.4 102.9 100.3 101.9 100.0 100.4C99.7 98.9 95.2 93.4 93.5 89.4C91.8 85.4 91.3 79.6 89.8 76.3C88.3 73.1 85.6 70.3 84.5 69.8Z"],["","M77.6 72.2C74.7 68.6 77.1 75.6 77.6 77.6C78.0 79.5 79.1 82.0 80.4 84.1C81.7 86.1 83.3 86.9 85.3 89.8C87.3 92.7 90.7 99.6 92.2 101.2C93.8 102.9 97.1 104.4 94.7 99.6C92.2 94.8 80.4 75.9 77.6 72.2Z"],["","M6.9 101.2C8.4 99.9 11.5 93.5 13.5 90.6C15.4 87.8 17.4 86.3 18.8 84.1C20.1 81.8 21.2 79.2 21.6 77.1C22.0 75.1 24.0 68.2 21.2 71.8C18.4 75.4 7.3 93.9 4.9 98.8C2.5 103.7 5.5 102.6 6.9 101.2Z"]],"back":[["head","M50.6 0.0C47.7 -0.1 48.9 -0.8 46.0 0.9C43.0 2.5 42.5 2.0 40.9 5.5C39.2 9.1 39.1 8.4 40.4 12.8C41.7 17.1 40.5 17.8 45.1 20.0C49.7 22.2 51.5 21.9 55.7 20.0C60.0 18.1 58.0 18.2 59.1 13.6C60.3 9.0 60.6 8.4 59.6 4.7C58.6 1.0 58.4 2.7 55.7 1.3C53.1 -0.1 53.6 0.1 50.6 0.0Z"],["trapecio","M44.7 21.7C45.3 20.8 47.2 18.9 47.7 21.7C48.1 24.5 47.2 31.1 47.2 38.3C47.2 45.5 49.1 62.2 47.7 64.7C46.2 67.2 40.4 57.2 38.3 53.2C36.2 49.2 36.5 43.6 35.3 40.9C34.1 38.1 30.4 37.9 31.1 36.6C31.7 35.3 37.0 34.8 39.1 33.2C41.3 31.6 42.9 29.1 43.8 27.2C44.8 25.3 44.0 22.6 44.7 21.7Z"],["trapecio","M52.3 21.7C52.8 18.9 55.0 20.8 55.7 21.7C56.5 22.6 55.7 25.4 56.6 27.2C57.4 29.1 58.8 31.2 60.9 32.8C62.9 34.3 68.3 35.3 68.9 36.6C69.6 37.9 65.9 37.7 64.7 40.4C63.5 43.2 63.8 49.1 61.7 53.2C59.6 57.2 53.8 67.2 52.3 64.7C50.9 62.2 53.2 45.5 53.2 38.3C53.2 31.1 51.9 24.5 52.3 21.7Z"],["hombros","M29.4 37.0C28.7 35.8 25.0 37.9 23.0 39.1C21.0 40.4 18.2 41.8 17.4 44.3C16.7 46.7 17.2 52.8 18.3 53.6C19.4 54.5 22.8 50.6 24.3 49.4C25.7 48.2 26.4 48.4 27.2 46.4C28.1 44.3 30.1 38.2 29.4 37.0Z"],["hombros","M71.1 37.0C72.1 36.1 76.4 38.3 78.3 39.6C80.2 40.9 82.0 42.3 82.6 44.7C83.1 47.0 83.0 52.9 81.7 53.6C80.4 54.3 76.5 50.4 74.9 48.9C73.3 47.5 73.0 47.1 72.3 45.1C71.7 43.1 70.1 37.9 71.1 37.0Z"],["espalda","M31.1 38.7C30.1 40.0 28.5 46.2 28.1 48.9C27.7 51.7 27.5 50.9 28.5 55.3C29.5 59.7 30.9 72.7 34.0 75.3C37.2 77.9 45.0 72.6 47.2 71.1C49.4 69.6 49.0 69.2 47.2 66.4C45.5 63.5 38.9 58.2 36.6 54.0C34.3 49.9 34.5 43.8 33.6 41.3C32.7 38.7 32.0 37.4 31.1 38.7Z"],["espalda","M68.9 38.7C69.9 40.0 71.5 46.5 71.9 49.4C72.3 52.3 72.5 51.8 71.5 56.2C70.5 60.5 69.1 72.8 66.0 75.3C62.8 77.8 55.0 72.6 52.8 71.1C50.6 69.6 51.0 69.1 52.8 66.4C54.5 63.6 61.1 58.6 63.4 54.5C65.7 50.4 65.5 44.3 66.4 41.7C67.3 39.1 68.0 37.4 68.9 38.7Z"],["triceps","M26.8 49.8C25.3 49.8 19.9 52.0 17.9 55.7C15.8 59.5 14.7 68.0 14.5 72.3C14.3 76.7 15.4 83.1 16.6 81.7C17.8 80.3 20.0 68.2 21.7 63.8C23.4 59.5 26.0 58.1 26.8 55.7C27.7 53.4 28.3 49.8 26.8 49.8Z"],["triceps","M73.6 50.2C75.1 50.2 80.1 51.9 82.1 55.7C84.2 59.6 85.7 68.8 86.0 73.2C86.2 77.6 84.8 83.8 83.4 82.1C82.1 80.4 79.6 67.4 77.9 63.0C76.2 58.6 73.9 57.9 73.2 55.7C72.5 53.6 72.1 50.2 73.6 50.2Z"],["triceps","M26.8 58.3C27.5 58.8 27.4 65.7 26.8 68.5C26.2 71.3 24.3 73.8 23.0 75.3C21.7 76.8 19.2 79.1 19.1 77.4C19.1 75.8 21.3 68.7 22.6 65.5C23.8 62.3 26.1 57.8 26.8 58.3Z"],["triceps","M72.8 58.3C73.5 57.6 75.7 61.5 77.0 64.7C78.3 67.9 80.5 75.7 80.4 77.4C80.4 79.2 77.9 76.7 76.6 75.3C75.3 73.9 73.4 71.8 72.8 68.9C72.1 66.1 72.1 59.0 72.8 58.3Z"],["lumbar","M47.7 72.8C45.6 71.8 36.5 75.2 34.5 77.0C32.4 78.8 32.8 79.2 35.3 83.4C37.8 87.6 47.4 102.2 49.4 102.1C51.3 102.1 47.1 87.9 46.8 83.0C46.5 78.1 49.7 73.8 47.7 72.8Z"],["lumbar","M52.3 72.8C54.4 71.6 63.5 75.2 65.5 77.0C67.6 78.8 67.2 79.2 64.7 83.4C62.2 87.6 52.6 102.1 50.6 102.1C48.7 102.2 52.9 88.7 53.2 83.8C53.5 78.9 50.3 73.9 52.3 72.8Z"],["","M86.4 75.7C87.5 75.7 89.9 80.4 91.1 83.4C92.2 86.5 91.7 90.2 93.2 94.0C94.7 97.9 99.5 104.7 100.0 106.4C100.5 108.1 98.2 107.1 96.2 104.3C94.2 101.4 90.1 92.8 88.1 89.4C86.1 86.0 84.5 86.1 84.3 83.8C84.0 81.6 85.2 75.8 86.4 75.7Z"],["","M13.6 75.7C12.5 75.9 10.1 80.9 8.9 83.8C7.8 86.8 8.3 89.9 6.8 93.6C5.3 97.4 0.5 104.6 0.0 106.4C-0.5 108.2 1.8 107.2 3.8 104.3C5.9 101.3 10.4 92.1 12.3 88.5C14.3 85.0 15.5 85.1 15.7 83.0C16.0 80.9 14.8 75.6 13.6 75.7Z"],["","M81.3 79.6C78.4 75.1 77.8 77.0 77.4 77.9C77.1 78.7 76.9 80.4 79.1 84.7C81.4 89.0 88.7 99.8 91.1 103.8C93.4 107.9 92.6 108.8 93.2 108.9C93.8 109.1 96.5 109.6 94.5 104.7C92.5 99.8 84.1 84.0 81.3 79.6Z"],["","M18.7 79.6C21.6 75.1 21.8 77.1 22.1 77.9C22.5 78.7 23.0 80.1 20.9 84.3C18.7 88.4 11.7 98.9 9.4 103.0C7.0 107.0 7.5 108.2 6.8 108.5C6.1 108.8 3.1 109.5 5.1 104.7C7.1 99.9 15.9 84.0 18.7 79.6Z"],["gluteos","M44.7 99.6C41.5 98.5 32.7 105.3 30.2 108.5C27.7 111.7 29.6 115.8 29.8 118.7C30.0 121.6 28.6 125.5 31.5 126.0C34.4 126.4 44.3 123.1 47.2 121.3C50.2 119.4 49.8 118.5 49.4 114.9C48.9 111.3 47.9 100.6 44.7 99.6Z"],["gluteos","M55.3 99.1C52.3 100.1 51.6 110.9 51.1 114.5C50.6 118.1 49.5 118.9 52.3 120.9C55.2 122.8 65.2 126.2 68.1 126.0C71.0 125.7 69.6 122.1 69.8 119.1C70.0 116.2 71.8 111.8 69.4 108.5C67.0 105.2 58.4 98.2 55.3 99.1Z"],["gluteos","M48.1 123.0C47.4 121.9 45.8 122.6 44.7 123.0C43.5 123.4 41.2 122.0 41.3 125.5C41.3 129.1 43.9 142.6 45.1 144.3C46.3 146.0 47.9 138.2 48.5 135.7C49.1 133.3 49.0 131.5 48.9 129.4C48.9 127.2 48.8 124.0 48.1 123.0Z"],["gluteos","M51.9 122.6C52.7 121.6 54.5 122.8 55.7 123.4C57.0 124.0 59.3 122.5 59.1 126.0C59.0 129.4 56.1 142.6 54.9 144.3C53.7 146.0 52.6 138.7 51.9 136.2C51.3 133.7 51.1 131.6 51.1 129.4C51.1 127.1 51.1 123.5 51.9 122.6Z"],["isquios","M28.9 122.1C29.6 121.8 29.8 128.7 31.1 129.4C32.3 130.0 35.9 125.0 36.6 126.0C37.3 127.0 35.7 131.3 35.3 135.3C35.0 139.4 35.5 146.4 34.5 150.2C33.5 154.0 30.3 158.9 29.4 158.3C28.4 157.7 29.2 149.6 28.9 146.8C28.7 144.0 27.9 143.8 27.7 141.3C27.4 138.7 27.0 134.7 27.2 131.5C27.4 128.3 28.3 122.5 28.9 122.1Z"],["isquios","M71.5 121.7C70.8 121.2 70.6 128.2 69.4 128.9C68.1 129.6 64.5 124.7 63.8 126.0C63.2 127.2 65.1 132.6 65.5 136.6C66.0 140.6 65.5 146.6 66.4 150.2C67.3 153.8 70.2 158.7 71.1 158.3C71.9 157.9 71.2 150.4 71.5 147.7C71.8 145.0 72.4 144.8 72.8 142.1C73.1 139.5 73.8 135.3 73.6 131.9C73.4 128.5 72.2 122.2 71.5 121.7Z"],["isquios","M38.7 125.5C39.9 127.3 44.0 139.1 44.3 146.0C44.5 152.8 41.8 165.7 40.4 166.8C39.1 167.9 36.7 158.0 36.2 152.8C35.6 147.5 36.6 139.9 37.0 135.3C37.4 130.8 37.5 123.8 38.7 125.5Z"],["isquios","M61.7 125.5C62.9 123.8 63.0 131.6 63.4 136.2C63.8 140.8 64.8 148.1 64.3 153.2C63.7 158.3 61.3 167.9 60.0 166.8C58.7 165.7 55.9 153.3 56.2 146.4C56.5 139.5 60.5 127.2 61.7 125.5Z"],["","M34.5 153.2C33.4 152.6 31.2 157.0 31.1 159.1C30.9 161.3 32.6 165.8 33.6 166.4C34.7 167.0 37.3 164.8 37.4 162.6C37.6 160.4 35.5 153.8 34.5 153.2Z"],["","M66.4 153.6C65.3 154.3 62.9 160.9 63.0 163.0C63.0 165.1 65.7 167.0 66.8 166.4C67.9 165.7 69.4 161.3 69.4 159.1C69.3 157.0 67.4 153.0 66.4 153.6Z"],["pantorrillas","M29.4 160.4C28.8 160.5 29.3 164.0 28.5 167.2C27.7 170.4 25.5 175.3 24.7 179.6C23.9 183.8 23.7 189.9 23.8 192.8C24.0 195.7 24.8 197.0 25.5 197.0C26.3 197.1 27.8 196.0 28.5 193.2C29.2 190.4 29.2 183.7 29.8 180.0C30.4 176.3 31.6 173.3 31.9 171.1C32.3 168.9 32.3 168.6 31.9 166.8C31.5 165.0 29.9 160.4 29.4 160.4Z"],["pantorrillas","M37.4 165.1C36.8 164.9 36.0 166.5 35.3 167.7C34.6 168.8 33.9 169.8 33.2 171.9C32.5 174.0 31.6 177.1 31.1 180.4C30.6 183.8 29.7 188.7 30.2 191.9C30.7 195.2 32.6 200.2 34.0 200.0C35.5 199.8 37.9 195.8 38.7 190.6C39.6 185.5 39.4 173.2 39.1 168.9C38.9 164.7 38.1 165.3 37.4 165.1Z"],["pantorrillas","M63.0 165.1C62.1 164.8 61.5 164.3 61.3 168.5C61.1 172.8 60.9 185.5 61.7 190.6C62.6 195.8 64.9 199.4 66.4 199.6C67.9 199.8 70.2 195.2 70.6 191.9C71.1 188.6 69.6 183.2 68.9 179.6C68.3 176.0 67.8 172.6 66.8 170.2C65.8 167.8 63.9 165.4 63.0 165.1Z"],["pantorrillas","M70.6 160.4C71.3 160.5 71.5 165.4 72.3 168.5C73.2 171.6 75.0 175.1 75.7 179.1C76.5 183.2 76.8 189.9 76.6 192.8C76.4 195.7 75.2 196.5 74.5 196.6C73.8 196.7 73.0 196.5 72.3 193.6C71.7 190.8 71.3 183.8 70.6 179.6C69.9 175.3 68.1 171.3 68.1 168.1C68.1 164.9 69.9 160.4 70.6 160.4Z"],["pantorrillas","M28.5 195.7C29.1 195.3 29.4 194.8 30.2 195.7C31.1 196.7 33.5 197.7 33.6 201.7C33.7 205.7 31.5 218.0 30.6 220.0C29.8 222.0 29.1 217.2 28.5 213.6C27.9 210.0 26.8 201.3 26.8 198.3C26.8 195.3 27.9 196.2 28.5 195.7Z"],["pantorrillas","M69.8 195.7C70.6 194.7 71.3 195.3 71.9 195.7C72.6 196.2 73.6 195.4 73.6 198.3C73.6 201.2 72.5 209.6 71.9 213.2C71.3 216.7 71.0 221.4 70.2 219.6C69.4 217.7 67.3 206.1 67.2 202.1C67.2 198.2 69.0 196.8 69.8 195.7Z"]]}
;
  function bodyFilters(id) {
    const f = (fid, freq) => '<filter id="' + fid + '" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="b"/>' +
      '<feSpecularLighting in="b" surfaceScale="3" specularConstant=".8" specularExponent="16" lighting-color="#fff" result="sp"><fePointLight x="20" y="-40" z="60"/></feSpecularLighting>' +
      '<feComposite in="sp" in2="SourceAlpha" operator="in" result="spec"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="2" seed="4" result="t"/>' +
      '<feColorMatrix in="t" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.25" result="ta"/>' +
      '<feComposite in="ta" in2="SourceAlpha" operator="in" result="fib"/>' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b2"/><feComposite in="SourceAlpha" in2="b2" operator="out" result="rim"/>' +
      '<feFlood flood-color="#000" flood-opacity=".45"/><feComposite in2="rim" operator="in" result="rimc"/>' +
      '<feFlood flood-color="#000" flood-opacity=".16"/><feComposite in2="fib" operator="in" result="fibc"/>' +
      '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="fibc"/><feMergeNode in="rimc"/><feMergeNode in="spec"/></feMerge></filter>';
    return '<defs>' + f(id + 'v', '1.5 0.07') + f(id + 'h', '0.07 1.5') + '</defs>';
  }
  function bodyMap(rec, stOf, ago) {
    const svg = (items, id, label) => {
      let base = '', mus = '';
      items.forEach((it) => { base += '<path d="' + it[1] + '"/>'; });
      items.forEach((it) => {
        const k = it[0], o = k && rec[k];
        const cls = o ? 'bm-m ' + stOf(o)[0] : k === 'head' ? 'bm-head' : 'bm-neutral';
        const fid = id + (k === 'pecho' || k === 'trapecio' ? 'h' : 'v');
        mus += '<path class="' + cls + '"' + (o ? ' data-k="' + k + '"' : '') + ' d="' + it[1] + '" filter="url(#' + fid + ')"/>';
      });
      return '<figure><svg viewBox="0 -2 100 212" role="img" aria-label="' + label + '">' + bodyFilters(id) +
        '<g class="bm-fascia">' + base + '</g><g class="bm-mus">' + mus + '</g></svg><figcaption>' + label + '</figcaption></figure>';
    };
    const box = h('div', { class: 'bodymap' });
    box.innerHTML = svg(BODY_PATHS.front, 'bmf', 'Frente') + svg(BODY_PATHS.back, 'bmb', 'Espalda');
    box.addEventListener('click', (e) => {
      const g = e.target.closest('[data-k]');
      if (!g) return;
      const k = g.dataset.k, o = rec[k];
      toast(MUSCLES[k] + ': ' + stOf(o)[1].toLowerCase() + ' · ' + ago(o.last));
    });
    return box;
  }
  function recoveryCard() {
    const rec = recovery();
    const keys = Object.keys(MUSCLES).filter((k) => (k !== 'lumbar' && k !== 'trapecio') || rec[k].last != null);
    const stOf = (o) => (o.left <= 0 ? ['ok', 'Listo'] : o.left === 1 ? ['mid', 'Listo mañana'] : ['low', 'Listo en ' + o.left + ' días']);
    const ago = (d) => (d == null ? 'sin entrenar esta semana' : d === 0 ? 'entrenado hoy' : d === 1 ? 'entrenado ayer' : 'hace ' + d + ' días');
    const nx = planNext();
    const nm = [];
    (nx.exercises || []).forEach((e) => { if (nm.indexOf(e.muscle) === -1) nm.push(e.muscle); });
    const waiting = nm.filter((k) => rec[k] && rec[k].left > 0);
    const card = h('section', { class: 'card rec' },
      nm.length ? h('div', { class: 'rec-next ' + (waiting.length ? 'mid' : 'ok') }, waiting.length
        ? '⚠ Siguiente (' + nx.name.replace(/^Día \d+ · /, '') + '): aún se recupera ' + waiting.map((k) => MUSCLES[k].toLowerCase()).join(', ') + '. Si puedes, espera un día o baja un poco la intensidad.'
        : '✓ Siguiente (' + nx.name.replace(/^Día \d+ · /, '') + '): todos sus músculos están recuperados.') : null,
      bodyMap(rec, stOf, ago),
      h('p', { class: 'muted small', style: 'text-align:center;margin:2px 0 8px' }, 'Toca un músculo para ver su estado.'),
      h('details', { class: 'rec-more' }, h('summary', {}, 'Ver detalle por músculo'), h('div', { class: 'rec-grid' }, keys.map((k) => {
        const o = rec[k], st = stOf(o);
        return h('div', { class: 'rec-chip ' + st[0] }, h('i', { class: 'rec-dot', 'aria-hidden': 'true' }),
          h('span', {}, h('b', {}, MUSCLES[k]), h('small', {}, st[1] + ' · ' + ago(o.last))));
      }))),
      h('p', { class: 'muted small rec-legend', style: 'margin:8px 0 0' },
        h('span', { class: 'rec-chip ok' }, h('i', { class: 'rec-dot' })), ' listo  ', h('span', { class: 'rec-chip mid' }, h('i', { class: 'rec-dot' })), ' listo mañana  ', h('span', { class: 'rec-chip low' }, h('i', { class: 'rec-dot' })), ' aún recuperándose. ',
        'Grandes (piernas, pecho, espalda): 72 h; pequeños (brazos, hombros, pantorrillas, abdomen): 48 h. El trabajo indirecto también cuenta, pero menos.'));
    return card;
  }

  // ---------- nutricion (registrada desde el chat en data/nutrition.json) ----------
  const MEALS = ['desayuno', 'almuerzo', 'colación', 'cena'];
  const isWeightDay = (id) => NUTRITION.weightDays.indexOf(id) !== -1;
  // Tipo de dia: la sesion de pesas registrada ese dia; si no hay, hoy usa el siguiente dia del plan
  function dayTypeOf(date) {
    const s = allSessions().filter((x) => x.date === date && x.entries.length && isWeightDay(x.routineId));
    if (s.length) { const id = s.some((x) => x.routineId === NUTRITION.legsDay) ? NUTRITION.legsDay : s[0].routineId; return { kind: 'pesas', legs: id === NUTRITION.legsDay, id: id, from: 'sesión registrada' }; }
    const cs = cardio.sessions.filter((c) => c.date === date && !c.libre);
    if (cs.some((c) => c.dia === NUTRITION.intervalDay || c.tipo === 'Intervalos')) return { kind: 'intervalos', legs: false, id: NUTRITION.intervalDay, from: 'cardio registrado' };
    if (date !== todayISO() || cs.length || allSessions().some((x) => x.date === date && x.entries.length)) return { kind: 'descanso', legs: false, id: null, from: date === todayISO() ? 'lo registrado hoy' : 'registro' };
    const nx = planNext();
    return { kind: isWeightDay(nx.id) ? 'pesas' : nx.id === NUTRITION.intervalDay ? 'intervalos' : 'descanso', legs: nx.id === NUTRITION.legsDay, id: nx.id, from: 'siguiente día del plan (' + nx.name.replace(/^Día \d+ · /, '') + ')' };
  }
  // Calorias netas de una sesion de cardio (por encima del reposo), con tu peso del ultimo control
  function cardioNetKcal(c) {
    const met = (CARDIO_TYPES.find((t) => t[0] === c.tipo) || [0, 5])[1];
    const lb = lastBody(), kg = (lb && lb.peso) || 75;
    return Math.max(0, (met - 1) * kg * (c.min || 0) / 60);
  }
  function nutTarget(dt, date) {
    const b = NUTRITION.targets[dt.kind];
    const t = { label: b.label, kind: dt.kind, kcal: b.kcal, prot: b.prot, carb: b.carb, extra: 0 };
    if (dt.legs) { t.kcal += NUTRITION.legsExtra.kcal; t.carb += NUTRITION.legsExtra.carb; t.label = 'Día de piernas'; }
    // Cardio libre extra de ese dia: suma la mitad de lo quemado, en carbohidratos
    const extra = Math.round(cardio.sessions.filter((c) => c.date === (date || todayISO()) && c.libre).reduce((s, c) => s + cardioNetKcal(c), 0) * NUTRITION.extraCardioShare / 10) * 10;
    if (extra) { t.extra = extra; t.kcal += extra; t.carb += Math.round(extra / 4); }
    t.fat = Math.max(0, Math.round((t.kcal - 4 * t.prot - 4 * t.carb) / 9));
    return t;
  }
  function nutDay(date) {
    const list = nutrition.filter((e) => e.date === date);
    const tot = { kcal: 0, prot: 0, carb: 0, fat: 0 };
    list.forEach((e) => { ['kcal', 'prot', 'carb', 'fat'].forEach((k) => { tot[k] += +e[k] || 0; }); });
    return { list: list, tot: tot };
  }
  function loadNutrition() {
    fetch('data/nutrition.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const list = d && Array.isArray(d.entries) ? d.entries : null;
      if (!list || JSON.stringify(list) === JSON.stringify(nutrition)) return;
      nutrition = list; render();
    }).catch(() => { /* sin conexion */ });
  }
  function nutBar(label, val, goal, unit) {
    const pct = goal ? Math.min(100, Math.round(100 * val / goal)) : 0;
    const left = Math.round(goal - val);
    const over = val > goal * 1.05;
    return h('div', { class: 'goal nut' },
      h('div', { class: 'goal-top' }, h('span', { class: 'goal-name' }, label),
        h('span', { class: 'goal-num' }, h('b', {}, fmt(Math.round(val))), ' de ' + fmt(goal) + ' ' + unit)),
      h('div', { class: 'goal-bar' }, h('i', { style: 'width:' + pct + '%' + (over ? ';background:var(--warm)' : pct >= 95 ? ';background:var(--accent)' : '') })),
      h('div', { class: 'goal-msg' }, left > 0 ? 'Te quedan ' + fmt(left) + ' ' + unit : over ? 'Pasaste la meta por ' + fmt(-left) + ' ' + unit : '✓ Meta cumplida'));
  }
  function nutritionCard() {
    const today = todayISO(), dt = dayTypeOf(today), t = nutTarget(dt, today), d = nutDay(today);
    const card = h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, '🍽️ ' + t.label), h('span', { class: 'muted small' }, 'según ' + dt.from)),
      t.extra ? h('p', { class: 'muted small', style: 'margin:2px 0 0' }, '+' + t.extra + ' kcal por tu cardio extra de hoy (en carbohidratos).') : null);
    if (!d.list.length) {
      card.append(h('p', { class: 'muted small', style: 'margin:6px 0 4px' }, 'Aún no registras comidas hoy. Dímelas en el chat ("desayuno: 3 huevos y un kiwi") y aparecen aquí.'),
        h('p', { class: 'small', style: 'margin:0' }, 'Meta: ' + fmt(t.kcal) + ' kcal · ' + t.prot + ' g proteína · ' + t.carb + ' g carbohidratos · ' + t.fat + ' g grasa'));
      return card;
    }
    card.append(nutBar('Calorías', d.tot.kcal, t.kcal, 'kcal'), nutBar('Proteína', d.tot.prot, t.prot, 'g'), nutBar('Carbohidratos', d.tot.carb, t.carb, 'g'), nutBar('Grasa', d.tot.fat, t.fat, 'g'));
    const meals = h('div', { style: 'margin-top:8px' });
    d.list.slice().sort((x, y) => MEALS.indexOf(x.meal) - MEALS.indexOf(y.meal)).forEach((e) => meals.append(h('details', { class: 'ctl' },
      h('summary', {}, h('strong', {}, (e.meal || 'comida').replace(/^./, (c) => c.toUpperCase())), h('span', { class: 'muted small' }, fmt(Math.round(e.kcal || 0)) + ' kcal · ' + fmt(Math.round(e.prot || 0)) + ' g prot')),
      h('div', { class: 'ctl-body' }, (e.items || []).map((it) => h('div', { class: 'ctl-row' }, h('span', {}, it.food + (it.g ? ' · ' + fmt(it.g) + ' g' : '')), h('b', {}, fmt(Math.round(it.kcal || 0)) + ' kcal'))),
        e.notes ? h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Supuestos: ' + e.notes) : null))));
    card.append(meals);
    return card;
  }
  // Ultimos 7 dias de nutricion frente a la meta de cada dia
  function nutWeek() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const date = isoAdd(todayISO(), -i), d = nutDay(date);
      if (!d.list.length) continue;
      const t = nutTarget(dayTypeOf(date), date);
      out.push({ date: date, tot: d.tot, t: t, protOk: d.tot.prot >= t.prot * 0.95, open: i === 0 });
    }
    return out;
  }
  function nutWeekCard() {
    const wk = nutWeek();
    const card = h('section', { class: 'card' }, h('strong', {}, '🍽️ Nutrición · últimos 7 días'));
    if (!wk.length) { card.append(h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Sin comidas registradas esta semana. Regístralas desde el chat.')); return card; }
    wk.forEach((x) => card.append(h('div', { class: 'ctl-row' },
      h('span', {}, fmtDate(x.date) + (x.open ? ' (hoy, en curso)' : ''), h('div', { class: 'muted small' }, x.t.label)),
      h('b', {}, fmt(Math.round(x.tot.kcal)) + '/' + fmt(x.t.kcal) + ' kcal · ' + Math.round(x.tot.prot) + '/' + x.t.prot + ' g ' + (x.protOk ? '✓' : '')))));
    const done = wk.filter((x) => !x.open);
    if (!done.length) return card;
    const avg = (f) => Math.round(done.reduce((s, x) => s + f(x), 0) / done.length);
    card.append(h('p', { class: 'small', style: 'margin:8px 0 0' }, 'Promedio: ' + fmt(avg((x) => x.tot.kcal)) + ' kcal (meta ' + fmt(avg((x) => x.t.kcal)) + ') · ' + avg((x) => x.tot.prot) + ' g de proteína · proteína en meta ' + done.filter((x) => x.protOk).length + ' de ' + done.length + ' días (sin contar hoy).'));
    return card;
  }
  // Fuerza: compara la fuerza estimada de cada ejercicio con la de 2 a 4 semanas antes
  function strengthTrend() {
    let up = 0, down = 0, flat = 0;
    Object.keys(exById).forEach((id) => {
      const recs = records(id, 12, true).filter((r) => daysSince(r.session.date) <= 35);
      if (recs.length < 2) return;
      const last = summarize(recs[0]);
      const old = recs.slice(1).reverse().find((r) => daysSince(r.session.date) - daysSince(recs[0].session.date) >= 10) || recs[recs.length - 1];
      const prev = summarize(old);
      if (!last || !prev || !prev.e1rm) return;
      const ch = last.e1rm / prev.e1rm - 1;
      if (ch > 0.02) up++; else if (ch < -0.02) down++; else flat++;
    });
    return { up: up, down: down, flat: flat, word: up + down + flat === 0 ? null : up > down ? 'subiendo' : down > up ? 'bajando' : 'estable' };
  }
  function weeklyEvalCard() {
    const vol = weeklyVolume();
    const ms = Object.keys(MUSCLES).filter((k) => k !== 'lumbar' && k !== 'trapecio');
    const okM = ms.filter((k) => vol[k] >= volMin(k)).length;
    const wk = nutWeek().filter((x) => !x.open), str = strengthTrend(), cmin = cardioWeekMinutes();
    const ctrls = bodySorted().filter((c) => c.peso);
    const last = ctrls[ctrls.length - 1];
    const ref = last && ctrls.slice(0, -1).reverse().find((c) => daysSince(c.date) - daysSince(last.date) >= 14);
    const b = bmrInfo();
    const parts = [], tips = [];
    parts.push('series en meta ' + okM + ' de ' + ms.length + ' músculos');
    if (wk.length) {
      const pOk = wk.filter((x) => x.protOk).length;
      parts.push('proteína en meta ' + pOk + ' de ' + wk.length + ' días');
      if (b) {
        const spend = wk.reduce((s, x) => s + b.kcal * (x.t.kind === 'pesas' ? 1.55 : 1.3) + cardio.sessions.filter((c) => c.date === x.date && (x.t.kind !== 'pesas' || c.libre)).reduce((k, c) => k + cardioNetKcal(c), 0), 0) / wk.length;
        const eat = wk.reduce((s, x) => s + x.tot.kcal, 0) / wk.length;
        const def = Math.round((spend - eat) / 10) * 10;
        parts.push(def >= 0 ? 'déficit promedio de ' + def + ' kcal' : 'superávit promedio de ' + (-def) + ' kcal');
      }
      if (pOk < Math.ceil(wk.length * 0.7)) tips.push('Prioriza la proteína: llega a ~155 g repartidos en 4 comidas (yogurt griego, huevos, carnes, pescado).');
    } else parts.push('sin comidas registradas');
    parts.push('cardio ' + cmin + ' de ' + CARDIO_GOAL + ' min');
    let weeks = null, dW = null;
    if (last && ref) {
      weeks = (daysSince(ref.date) - daysSince(last.date)) / 7; dW = last.peso - ref.peso;
      const dG = last.grasa != null && ref.grasa != null ? last.grasa - ref.grasa : null;
      parts.push(Math.abs(dW) <= 0.3 ? 'peso estable' : dW < 0 ? 'peso bajando ' + fmt(Math.round(-dW * 10) / 10) + ' kg' : 'peso subiendo ' + fmt(Math.round(dW * 10) / 10) + ' kg');
      if (dG != null) parts.push(Math.abs(dG) < 0.3 ? 'grasa estable' : dG < 0 ? 'grasa −' + fmt(Math.round(-dG * 10) / 10) + ' %' : 'grasa +' + fmt(Math.round(dG * 10) / 10) + ' %');
      if (Math.abs(dW) <= 0.3 && (dG == null || dG > -0.5) && weeks >= 2) tips.push('El peso no se mueve en ' + Math.round(weeks) + ' semanas: baja ~150 kcal, mejor de carbohidratos en días de descanso.');
      else if (dW < 0 && -dW / last.peso / weeks > 0.01) tips.push('Bajas más de 1 % por semana: sube ~150 kcal para proteger el músculo.');
    } else tips.push('Haz un control en la báscula cada 2–3 semanas para evaluar peso y grasa.');
    if (str.word) parts.push('fuerza ' + str.word);
    if (str.word === 'bajando') tips.push('La fuerza baja: sube ~150 kcal en días de pesas y cuida el sueño.');
    if (!tips.length) tips.push('Vas bien: mantén las metas actuales.');
    return h('section', { class: 'card' },
      h('strong', {}, '📊 Evaluación de la semana'),
      h('p', { style: 'margin:6px 0 8px' }, parts.join(' · ').replace(/^./, (c) => c.toUpperCase()) + '.'),
      tips.map((t) => h('div', { class: 'rec-next mid', style: 'margin:0 0 6px' }, '💡 ' + t)),
      h('p', { class: 'muted small', style: 'margin:4px 0 0' }, 'Cruza tus series, comidas registradas (días completos), cardio y controles de la báscula. Objetivo: ' + NUTRITION.goal + '.'));
  }

  function renderHome(root) {
    const sessions = sortedSessions();
    const last = sessions[0];
    const monthKey = todayISO().slice(0, 7);
    const thisMonth = sessions.filter((x) => x.date.slice(0, 7) === monthKey).length;
    const week = sessions.filter((x) => daysSince(x.date) < 7).length;
    const sets = sessions.reduce((t, x) => t + x.entries.length, 0);

    let msg;
    if (!last) msg = 'Empecemos con calma. Elige un grupo muscular y registra tu primera serie.';
    else if (daysSince(last.date) === 0) msg = 'Hoy ya sumaste. Recuperar también es parte del progreso.';
    else if (daysSince(last.date) > 7) msg = 'Qué bueno verte de nuevo. Retoma con pesos cómodos y ve subiendo.';
    else msg = 'Cada serie suma. ¿Qué entrenamos hoy?';

    root.append(h('section', { class: 'hero' }, h('h2', {}, greeting()), h('p', {}, msg)));
    root.append(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, week), h('span', {}, 'Sesiones en 7 días')),
      h('div', { class: 'stat' }, h('b', {}, thisMonth), h('span', {}, 'Este mes')),
      h('div', { class: 'stat' }, h('b', {}, sets), h('span', {}, 'Series en total'))));

    // Aviso de control corporal: pasan 5 semanas desde el ultimo
    const lbody = lastBody();
    let snoozed = 0;
    try { snoozed = +localStorage.getItem(SNOOZE_KEY) || 0; } catch (e) { /* sin almacenamiento */ }
    if (lbody && daysSince(lbody.date) >= BODY_REMIND_DAYS && Date.now() > snoozed) {
      root.append(h('section', { class: 'card warm remind' },
        h('strong', {}, '📏 Toca un nuevo control corporal'),
        h('p', { class: 'small', style: 'margin:4px 0 10px' }, 'Tu último control fue el ' + fmtDate(lbody.date) + ' (hace ' + daysSince(lbody.date) + ' días). Hazlo en las mismas condiciones: en ayunas o a la misma hora, sin entrenar antes, para poder comparar.'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn primary small', type: 'button', onclick: () => go('#/cuerpo') }, 'Registrar control'),
          h('button', { class: 'btn small', type: 'button', onclick: () => {
            try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * DAY)); } catch (e) { /* sin almacenamiento */ }
            toast('Te lo recordaré en una semana.'); render();
          } }, 'Más tarde'))));
    }

    const lastDone = lastDoneByGroup();

    const nextDay = planNext();
    root.append(h('div', { class: 'section-title' }, 'Tu ' + PLAN.name.toLowerCase()));
    const days = h('div', { class: 'days' });
    DAYS.forEach((d, i) => {
      const cardioOnly = !!d.cardio && !d.exercises.length;
      const cDone = cardioOnly ? cardioToday(d) : [];
      const today = cardioOnly ? (cDone.length ? cDone[0] : null) : todaySession(d.id, false);
      const sets = d.exercises.reduce((t, e) => t + e.sets, 0);
      const status = cDone.length ? 'Hoy: ' + cDone.reduce((t, c) => t + c.min, 0) + ' min registrados'
        : today ? 'En curso hoy · ' + today.entries.length + ' de ' + sets + ' series'
        : d.cardio ? (lastDone[d.id] ? 'Último: ' + agoText(lastDone[d.id]) + ' · ' : '') + 'Cardio: ' + cardioWeekMinutes() + ' de ' + CARDIO_GOAL + ' min en 7 días'
        : lastDone[d.id] ? 'Último: ' + agoText(lastDone[d.id]) : d.exercises.length + ' ejercicios · ' + sets + ' series';
      // Portada: una imagen por cada grupo principal del dia
      const covers = (d.covers || []).map((id) => [{ id: id }, 0]);
      d.exercises.forEach((e) => { if (covers.length < 3 && !covers.some((c) => c[0].muscle === e.muscle)) covers.push([e, 0]); });
      // Si el dia trabaja pocos musculos (p. ej. cardio + abdomen), completa con la foto final de otros ejercicios
      d.exercises.forEach((e) => { if (covers.length < 3 && !covers.some((c) => c[0] === e)) covers.push([e, 1]); });
      days.append(h('button', { class: 'day' + (d === nextDay && !today ? ' next' : ''), type: 'button', onclick: () => go('#/g/' + d.id) },
        h('span', { class: 'day-cover' },
          covers.map((c) => h('img', { src: imgSrc(c[0], c[1]), alt: '', loading: 'lazy' })),
          today ? h('span', { class: 'pill live' }, 'Hoy')
            : d === nextDay ? h('span', { class: 'pill' }, 'Siguiente') : null),
        h('span', { class: 'day-body' },
          h('span', { class: 'day-n' }, i + 1),
          h('span', { class: 'day-txt' },
            h('strong', {}, d.name.replace(/^Día \d+ · /, '')),
            h('span', {}, d.focus),
            h('span', { class: 'day-st' }, status)),
          h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›'))));
    });
    root.append(days);
    root.append(h('button', { class: 'btn full free-link', type: 'button', onclick: () => go('#/cardio') },
      freeRun.start || freeRun.acc ? '⏱ Cardio libre en curso · toca para verlo' : '⏱ Cardio libre (opcional): cronómetro, constante o intervalos'));

    root.append(h('div', { class: 'section-title' }, 'Nutrición de hoy'), nutritionCard());
    root.append(h('div', { class: 'section-title' }, 'Recuperación muscular'), recoveryCard());

    const vol = weeklyVolume();
    // Lumbar y trapecio no estan en el plan: solo se muestran si tienen series
    const shown = Object.keys(MUSCLES).filter((k) => vol[k] || (k !== 'lumbar' && k !== 'trapecio'));
    const volCard = h('section', { class: 'card vol' }, volumeIntro(shown, vol));
    shown.forEach((k) => volCard.append(volumeMeter(k, vol[k])));
    root.append(h('div', { class: 'section-title' }, 'Meta de la semana'));
    root.append(volCard);


  }

  function elapsedText(s) {
    const first = s.entries.length ? (s.startedAt || s.createdAt) : Date.now();
    return 'En sesión: ' + Math.max(0, Math.round((Date.now() - first) / 60000)) + ' min';
  }

  function renderGroup(root, r) {
    const today = todaySession(r.id, false);
    const total = r.exercises.reduce((t, e) => t + e.sets, 0);
    // Cuenta tambien lo subido desde el chat (sesion de hoy en el historial)
    const todayAll = allSessions().find((x) => x.date === todayISO() && (x.routineId || 'piernas') === r.id);
    const done = todayAll ? Math.min(todayAll.entries.length, total) : 0;
    const pct = Math.round(100 * done / total);
    const goalTotals = { work: 0, hit: 0 };
    r.exercises.forEach((ex) => { const g = goalStats(ex, r.id); goalTotals.work += g.work; goalTotals.hit += g.hit; });

    root.append(h('div', { class: 'group-head' },
      h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/') }),
      h('div', { class: 'grow' },
        h('h2', {}, r.name),
        h('div', { class: 'muted small' }, r.focus ? r.focus : 'Hoy · ' + longDate(new Date())),
        today ? h('div', { class: 'muted small', id: 'elapsed' }, elapsedText(today)) : null)));
    $('.back', root).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (r.cardio && !r.exercises.length) { root.append(cardioPlanCard(r)); return; }
    root.append(h('div', { class: 'progress-wrap' },
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'progress-label' }, done
        ? done + ' de ' + total + ' series' + (goalTotals.work ? ' · Metas: ' + goalTotals.hit + ' de ' + goalTotals.work : '') + (kcalEstimate(done) ? ' · ≈ ' + kcalEstimate(done).kcal + ' kcal' : '') + (pct >= 100 ? ' · ¡Rutina completa! 💪' : pct >= 50 ? ' · Ya pasaste la mitad' : '')
        : total + ' series planificadas · la fecha se guarda sola'),
      syncBadge()));

    if (r.cardio) root.append(cardioPlanCard(r));

    const vol = weeklyVolume();
    const muscles = [];
    r.exercises.forEach((e) => { if (muscles.indexOf(e.muscle) === -1) muscles.push(e.muscle); });
    const doneM = muscles.filter((m) => vol[m] >= volMin(m)).length;
    root.append(h('details', { class: 'card vol compact' },
      h('summary', {},
        h('strong', {}, 'Meta de la semana: ' + doneM + ' de ' + muscles.length + ' músculos'),
        h('span', { class: 'muted small' }, 'Toca para ver cuántas series le faltan a cada uno')),
      h('div', { style: 'margin-top:12px' }, muscles.map((m) => volumeMeter(m, vol[m]))),
      h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'Meta: al menos ' + VOL_MIN + ' series por músculo en 7 días. Lo que registres hoy se suma al momento.')));

    // Metas para la proxima sesion, calculadas con lo que ya registraste hoy
    const doneEx = r.exercises.filter((ex) => todaySets(ex, r.id).length);
    if (doneEx.length) {
      const list = h('div', { class: 'next-list' });
      doneEx.forEach((ex) => {
        const np = plan(ex, true);
        list.append(h('div', { class: 'next-item' },
          h('div', { class: 'row between' }, h('strong', {}, ex.name), h('span', { class: 'sugg-tag ' + np.trend }, { up: '↑ Sube', down: '↓ Baja', same: '→ Mantén', new: '★ Nuevo', deload: '↺ Descarga' }[np.trend])),
          h('div', { class: 'next-goal' }, targetText(ex, np)),
          h('div', { class: 'muted small' }, np.text)));
      });
      root.append(h('details', { class: 'card next-plan', open: doneEx.length > 0 ? true : false },
        h('summary', {}, h('strong', {}, '🎯 Tus metas para la próxima sesión'),
          h('span', { class: 'muted small' }, 'Se actualizan con cada serie que registras. Cumplirlas es lo que te hace progresar.')),
        list));
    }

    r.exercises.forEach((ex, i) => root.append(exerciseCard(ex, i, r)));
  }

  function musclesLine(ex) {
    return h('div', { class: 'muscles' },
      h('span', { class: 'chip' }, MUSCLES[ex.muscle] || ex.muscle),
      ex.secondary && ex.secondary.length
        ? h('span', { class: 'muted small' }, 'también ' + ex.secondary.map((m) => MUSCLES[m].toLowerCase()).join(', '))
        : null);
  }

  function restPicker(ex) {
    const cur = restOf(ex);
    const opts = REST_OPTIONS.slice();
    if (opts.indexOf(cur) === -1) opts.push(cur);
    opts.sort((x, y) => x - y);
    const sel = h('select', { class: 'rest-sel', 'aria-label': 'Descanso entre series de ' + ex.name, onchange: (e) => setRest(ex, parseInt(e.target.value, 10)) },
      opts.map((sec) => h('option', { value: sec, selected: sec === cur }, restTxt(sec) + (sec === ex.rest ? ' (plan)' : ''))));
    return h('div', { class: 'rest-pick' }, '⏱',
      h('button', { class: 'rest-step', type: 'button', 'aria-label': 'Menos 15 segundos', onclick: () => setRest(ex, cur - 15, true) }, '−15'),
      sel,
      h('button', { class: 'rest-step', type: 'button', 'aria-label': 'Más 15 segundos', onclick: () => setRest(ex, cur + 15, true) }, '+15'));
  }

  // Cambia el peso de un ejercicio entre "total" y "por lado". Los registros viejos se pueden convertir (x2 / ÷2).
  function changeUnit(ex, toSide) {
    const newUnit = toSide ? ex.unit.replace(/\/lado$/, '') + '/lado' : ex.unit.replace(/\/lado$/, '');
    const factor = toSide ? 0.5 : 2;
    const hist = allSessions().filter((x) => x.entries.some((e) => e.exerciseId === ex.id && e.weight != null));
    const apply = (convert) => {
      if (convert) {
        hist.forEach((sess) => {
          const n = Object.assign({}, sess, { updatedAt: Date.now(), entries: sess.entries.map((e) =>
            Object.assign({}, e, e.exerciseId === ex.id && e.weight != null ? { weight: Math.round(e.weight * factor * 100) / 100 } : {})) });
          state.sessions = state.sessions.filter((x) => x.id !== n.id);
          state.sessions.push(n);
        });
        save(true);
      }
      if (newUnit === ex.baseUnit) delete customUnit[ex.id]; else customUnit[ex.id] = newUnit;
      saveUnits(); setUnit(ex.id, newUnit);
      toast(ex.name + ': ahora el peso es ' + (toSide ? 'por lado' : 'total') + (convert ? ' (registros convertidos)' : '') + '.');
      closeSheet(); render();
    };
    const closeSheet = () => { const sh = $('#sheet'); sh.classList.add('hidden'); sh.replaceChildren(); };
    if (!hist.length) { apply(false); return; }
    const sheet = $('#sheet');
    const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'sheet-grip' }),
      h('div', { class: 'row between' }, h('h2', {}, ex.name), h('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: closeSheet }, '×')),
      h('p', {}, 'Vas a anotar el peso ', h('b', {}, toSide ? 'por lado' : 'total'), '. ¿Qué hago con tus registros anteriores de este ejercicio?'),
      h('p', { class: 'muted small' }, toSide
        ? 'Si los pesos que anotaste eran totales, conviértelos: se dividen entre 2 (por ejemplo 150 pasa a 75 por lado).'
        : 'Si los pesos que anotaste eran por lado, conviértelos: se multiplican por 2 (por ejemplo 75 pasa a 150 en total).'),
      h('div', { class: 'hiit-actions' },
        h('button', { class: 'btn primary big', type: 'button', onclick: () => apply(true) }, 'Convertir registros anteriores'),
        h('button', { class: 'btn big', type: 'button', onclick: () => apply(false) }, 'Dejarlos como están'),
        h('button', { class: 'btn big', type: 'button', onclick: closeSheet }, 'Cancelar')));
    sheet.replaceChildren(h('div', { class: 'sheet-bg', onclick: closeSheet }), panel);
    sheet.classList.remove('hidden');
  }

  function exerciseCard(ex, idx, r) {
    const last = lastRecord(ex.id);
    const gs = goalStats(ex, r.id);
    const p = gs.plan;
    const logged = todaySets(ex, r.id);
    const rows = Math.max(ex.sets, logged.length, (drafts[ex.id] && drafts[ex.id].extra) || 0);
    const complete = logged.length >= ex.sets;

    const head = h('div', { class: 'ex-head' },
      h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver imagen de ' + ex.name, onclick: () => openSheet(ex) },
        h('img', { src: imgSrc(ex, 0), alt: '', loading: 'lazy' }),
        h('span', { class: 'thumb-edit', 'aria-hidden': 'true' }, '⤢')),
      h('div', { class: 'grow' },
        h('div', { class: 'ex-name' }, (idx + 1) + '. ' + ex.name),
        musclesLine(ex),
        h('div', { class: 'muted small' }, specText(ex)),
        restPicker(ex),
        h('div', { class: 'last small' }, last
          ? h('span', {}, h('b', {}, 'Último (' + fmtDate(last.session.date) + '): '), last.sets.map(setStr).join(' · '))
          : h('span', { class: 'muted' }, 'Sin registro anterior'))),
      h('span', { class: 'badge' + (complete ? ' ok' : '') }, logged.length + '/' + ex.sets));

    const icon = { up: '↑', down: '↓', same: '→', new: '★', deload: '↺' }[p.trend];
    const sugg = h('div', { class: 'sugg ' + p.trend },
      h('span', { class: 'sugg-ico', 'aria-hidden': 'true' }, icon),
      h('div', {},
        h('strong', {}, p.title + (p.weight != null && hasEq(ex) ? ' (' + kgEq(ex, p.weight) + ')' : '') + ' · ' + ex.sets + ' × ' + (p.reps[0] === p.reps[p.reps.length - 1] ? p.reps[0] : p.reps.join('/')) + ' reps'),
        h('div', {}, p.text)));

    // Tabla: anterior | hoy
    const table = h('div', { class: 'log' + (hasEq(ex) ? ' has-kg' : '') },
      h('div', { class: 'log-row log-th' },
        h('span', {}, '#'), h('span', {}, 'Anterior'), h('span', {}, ex.unit), hasEq(ex) ? h('span', {}, eqName(ex) + ' ≈') : null, h('span', {}, 'Reps'), h('span', {})));
    if (!drafts[ex.id]) drafts[ex.id] = {};
    let carry = p.weight;
    for (let i = 0; i < rows; i++) {
      const prev = last && last.sets[i];
      const entry = logged[i];
      if (entry) {
        carry = adjustAfter(ex, entry, carry);
        const gr = gs.rows[i];
        const gcls = !gr || !gr.work ? '' : gr.hit ? ' hit' : ' miss';
        const upNote = gr && gr.up ? h('div', { class: 'goal-up' }, '↑ Más peso que la meta: cuenta como logro') : null;
        table.append(h('div', { class: 'log-row done' + gcls },
          h('span', { class: 'n' }, i + 1),
          h('span', { class: 'prev' }, prev ? setStr(prev) : '—'),
          h('span', { class: 'val' }, fmt(entry.weight)),
          hasEq(ex) ? h('span', { class: 'val kg' }, eqNum(ex, entry.weight)) : null,
          h('span', { class: 'val' }, entry.reps),
          h('button', { class: 'tick on', type: 'button', 'aria-label': 'Deshacer serie ' + (i + 1), onclick: () => unlogSet(entry, r.id) }, '✓')));
        if (upNote) table.append(upNote);
        if (gr && gr.work && !gr.hit) table.append(h('div', { class: 'goal-miss' }, 'Meta: ' + (p.weight != null ? fmt(p.weight) + ' × ' : '') + gr.target + ' reps'));
        if (entry.rpe == null && i === logged.length - 1) {
          const chips = h('div', { class: 'rpe-ask' }, h('span', { class: 'muted small' }, '¿Qué tan difícil fue?'));
          const row = h('div', { class: 'rpe' });
          [6, 7, 8, 9, 10].forEach((v) => row.append(h('button', {
            type: 'button', title: RPE_TEXT[v],
            onclick: () => { const ts = todaySession(r.id, true); const te = ts.entries.find((x) => x.exerciseId === entry.exerciseId && x.set === entry.set); if (te) te.rpe = v; touch(ts); save(true); toast(RPE_TEXT[v] + '. Anotado.'); render(); }
          }, String(v))));
          chips.append(row);
          table.append(chips);
        } else if (entry.rpe != null) {
          table.lastChild.title = 'Dificultad ' + entry.rpe + '/10';
        }
        continue;
      }
      // Valor sugerido por defecto; lo que escribas se guarda como borrador y tiene prioridad.
      const wu = p.warm && p.warm[i]; // fila de calentamiento, como la ultima vez
      const defW = wu ? fmt(wu.w) : carry != null ? fmt(carry) : (prev && prev.weight != null ? fmt(prev.weight) : '');
      const defR = wu ? String(wu.r) : String(p.reps[Math.min(i - ((p.warm && p.warm.length) || 0), p.reps.length - 1)] || ex.repMin);
      const d = drafts[ex.id][i] || {};
      const keep = () => { drafts[ex.id][i] = d; };
      const eqF = isLb(ex) ? 0.45359237 : 2.20462262;
      const kgCell = hasEq(ex) ? h('input', { class: 'eq-in', inputmode: 'decimal', 'aria-label': 'Equivalente en ' + eqName(ex) + ', serie ' + (i + 1), value: eqNum(ex, parseNum(d.w != null ? d.w : defW)),
        oninput: (e) => { const v = parseNum(e.target.value); if (v == null) return; wIn.value = fmt(isLb(ex) ? Math.round(v / eqF) : Math.round(v / eqF * 2) / 2); d.w = wIn.value; keep(); } }) : null;
      const wIn = h('input', { inputmode: 'decimal', value: d.w != null ? d.w : defW, 'aria-label': 'Peso serie ' + (i + 1), oninput: (e) => { d.w = e.target.value; keep(); if (kgCell) kgCell.value = eqNum(ex, parseNum(e.target.value)); } });
      const rIn = h('input', { inputmode: 'numeric', type: 'number', min: '1', value: d.r != null ? d.r : defR, 'aria-label': 'Reps serie ' + (i + 1), oninput: (e) => { d.r = e.target.value; keep(); } });
      const isNext = i === logged.length;
      table.append(h('div', { class: 'log-row' + (isNext ? ' next' : '') },
        h('span', { class: 'n' }, i + 1),
        h('span', { class: 'prev' }, prev ? setStr(prev) : '—'),
        wIn, kgCell, rIn,
        h('button', { class: 'tick', type: 'button', 'aria-label': 'Registrar serie ' + (i + 1), onclick: () => logSet(ex, r.id, i, d.w != null ? d.w : defW, d.r != null ? d.r : defR) }, '✓')));
    }
    const addRow = h('button', { class: 'btn ghost small add', type: 'button', onclick: () => {
      drafts[ex.id].extra = rows + 1; render();
    } }, '+ Añadir serie');

    const goalLine = gs.work
      ? h('div', { class: 'goal-line ' + (gs.hit === gs.work ? 'ok' : '') }, (gs.hit === gs.work ? '✓ ' : '') + 'Metas cumplidas: ' + gs.hit + ' de ' + gs.work + ' series de trabajo')
      : null;
    const altOn = !!drafts[ex.id].alt || logged.some((e) => e.altOrder);
    const altBtn = h('button', { class: 'btn ghost small add' + (altOn ? ' on' : ''), type: 'button',
      title: 'Úsalo cuando no pudiste seguir el orden habitual o usaste otra máquina: este día no baja tu peso',
      onclick: () => {
        const v = !altOn; drafts[ex.id].alt = v;
        if (logged.length) { const ts = todaySession(r.id, true); ts.entries.forEach((e) => { if (e.exerciseId === ex.id) { if (v) e.altOrder = true; else delete e.altOrder; } }); touch(ts); save(true); }
        render();
      } }, altOn ? '✓ Orden o máquina distinta: no baja el peso' : '🔀 Orden o máquina distinta hoy');
    const unitRow = canSwapUnit(ex) ? h('div', { class: 'row between', style: 'margin-top:8px;align-items:center' },
      h('span', { class: 'muted small' }, 'El peso que anotas es:'),
      h('div', { class: 'unit-seg' },
        h('button', { class: 'btn small' + (perSide(ex) ? '' : ' primary'), type: 'button', 'aria-pressed': String(!perSide(ex)), onclick: () => { if (perSide(ex)) changeUnit(ex, false); } }, 'Total'),
        h('button', { class: 'btn small' + (perSide(ex) ? ' primary' : ''), type: 'button', 'aria-pressed': String(perSide(ex)), onclick: () => { if (!perSide(ex)) changeUnit(ex, true); } }, 'Por lado'))) : null;
    return h('section', { class: 'card ex' + (complete ? ' done' : '') }, head, sugg, table, goalLine, unitRow, addRow, altBtn);
  }

  // ---------- grafica de progreso (una linea por ejercicio) ----------
  // Frase que resume que paso, para no tener que interpretar la grafica
  function progressHeadline(rows, unit) {
    const first = rows[0], last = rows[rows.length - 1];
    if (rows.length === 1) return 'Primera sesión: ' + fmt(last.weight) + ' ' + unit + ' × ' + last.reps + '. El punto punteado es tu próxima sesión: ahí verás si subes.';
    const diff = last.weight - first.weight;
    const days = Math.round((isoToDate(last.date) - isoToDate(first.date)) / DAY);
    const span = days < 14 ? days + ' días' : Math.round(days / 7) + ' semanas';
    if (diff > 0) return '↑ Subiste ' + fmt(diff) + ' ' + unit + ' en ' + span + ' (de ' + fmt(first.weight) + ' a ' + fmt(last.weight) + ').';
    if (diff < 0) return '↓ Bajaste ' + fmt(-diff) + ' ' + unit + ' en ' + span + '. Es normal tras una descarga o un día flojo.';
    let same = 1;
    for (let i = rows.length - 2; i >= 0 && rows[i].weight === last.weight; i--) same++;
    if (last.reps > rows[rows.length - 2].reps) return '→ Mismo peso, pero ' + (last.reps - rows[rows.length - 2].reps) + ' repetición(es) más que la vez anterior. Vas bien.';
    return '→ Llevas ' + same + ' sesiones con ' + fmt(last.weight) + ' ' + unit + '. Intenta sumar una repetición.';
  }

  function progressChart(rows, unit, opts) {
    opts = opts || {};
    const W = 320, H = 150, L = 14, R = 14, T = 26, B = 24;
    const n = rows.length;
    const ws = rows.map((x) => x.weight);
    let lo = Math.min.apply(null, ws), hi = Math.max.apply(null, ws);
    if (lo === hi) { lo -= 5; hi += 5; }
    const pad = (hi - lo) * 0.15;
    lo = Math.max(0, lo - pad); hi += pad;
    const x = (i) => n === 1 ? L + 40 : L + (W - L - R) * i / (n - 1);
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const maxI = ws.indexOf(Math.max.apply(null, ws));
    const labelIdx = (i) => n <= 6 || i === 0 || i === n - 1 || i === maxI;
    const dateIdx = (i) => n <= 5 || i === 0 || i === n - 1;
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(opts.label || 'Peso por sesión') + ' en ' + esc(unit) + '">';
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" class="chart-base"/>';
    if (n === 1) {
      // Con una sola sesion: punto punteado donde ira la proxima
      const gx = W - R - 40, gy = y(rows[0].weight);
      svg += '<line x1="' + (x(0) + 8) + '" y1="' + gy + '" x2="' + (gx - 8) + '" y2="' + gy + '" class="chart-ghost-line"/>' +
        '<circle cx="' + gx + '" cy="' + gy + '" r="4.5" class="chart-ghost"/>' +
        '<text x="' + gx + '" y="' + (gy - 10) + '" class="chart-val" text-anchor="middle">?</text>' +
        '<text x="' + gx + '" y="' + (H - 6) + '" class="chart-date" text-anchor="middle">' + (opts.nextLabel || 'Próxima') + '</text>';
    }
    if (n > 1) svg += '<polyline class="chart-line" points="' + rows.map((r, i) => x(i).toFixed(1) + ',' + y(r.weight).toFixed(1)).join(' ') + '"/>';
    rows.forEach((r, i) => {
      const cx = x(i).toFixed(1), cy = y(r.weight).toFixed(1);
      svg += '<g class="chart-pt"><circle cx="' + cx + '" cy="' + cy + '" r="12" class="chart-hit"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="4.5" class="chart-dot' + (i === n - 1 ? ' last' : '') + '"/>' +
        '<title>' + fmtDate(r.date) + ': ' + esc(fmt(r.weight) + ' ' + unit + (opts.noReps ? '' : ' × ' + r.reps + ' reps')) + '</title></g>';
      if (labelIdx(i)) svg += '<text x="' + cx + '" y="' + (+cy - 10) + '" class="chart-val' + (i === n - 1 ? ' last' : '') + '" text-anchor="middle">' + esc(fmt(r.weight)) + '</text>';
      if (dateIdx(i)) {
        const p = r.date.split('-');
        const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        svg += '<text x="' + cx + '" y="' + (H - 6) + '" class="chart-date" text-anchor="' + anchor + '">' + p[2] + '/' + p[1] + '</text>';
      }
    });
    svg += '</svg>';
    const box = h('div', { class: 'chart-box' });
    box.innerHTML = svg;
    return box;
  }

  // ---------- mi cuerpo ----------
  const BODY_FIELDS = [
    ['peso', 'Peso', 'kg'], ['grasa', 'Grasa corporal', '%'], ['tmb', 'Calorías basales', 'kcal'], ['masaGrasa', 'Masa grasa', 'kg'], ['musculo', 'Masa muscular', 'kg'],
    ['esqueletico', 'Músculo esquelético', 'kg'], ['imc', 'IMC', ''], ['visceral', 'Grasa visceral', 'grado'],
    ['edadCorporal', 'Edad corporal', 'años'], ['puntuacion', 'Puntuación corporal', '/100'], ['agua', 'Agua', 'kg'], ['proteina', 'Proteína', 'kg'],
    ['osea', 'Masa ósea', 'kg'], ['whr', 'Relación cintura-cadera', ''], ['pulsoReposo', 'Pulso en reposo', 'lpm']
  ];
  function importBody(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('El texto no es válido. Pégalo completo.'); return; }
    const list = Array.isArray(data) ? data : [data];
    let added = 0;
    list.forEach((c) => {
      if (!c || !c.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) return;
      const ctl = { id: uid(), date: c.fecha };
      BODY_FIELDS.forEach((f) => { if (c[f[0]] != null && !isNaN(+c[f[0]])) ctl[f[0]] = +c[f[0]]; });
      if (c.altura) body.profile.altura = +c.altura;
      if (c.edad) body.profile.edad = +c.edad;
      if (c.sexo === 'h' || c.sexo === 'm') body.profile.sexo = c.sexo;
      if (c.pulsoReposo) body.profile.pulsoReposo = +c.pulsoReposo;
      body.controls = body.controls.filter((x) => x.date !== ctl.date); // un control por fecha
      body.controls.push(ctl); added++;
    });
    if (!added) { toast('No encontré controles en el texto.'); return; }
    saveBody(); toast(added + ' control' + (added > 1 ? 'es' : '') + ' guardado' + (added > 1 ? 's' : '') + ' en este dispositivo.'); render();
  }

  // Calorias basales: la medida por tu bascula (ultimo control que la tenga) o, si no, la estimada (Mifflin-St Jeor)
  function bmrInfo() {
    const measured = bodySorted().filter((c) => c.tmb).pop();
    if (measured) return { kcal: Math.round(measured.tmb), measured: true, date: measured.date };
    const lb = lastBody(), p = body.profile;
    if (lb && lb.peso && p.altura && p.edad && p.sexo) {
      return { kcal: Math.round(10 * lb.peso + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'h' ? 5 : -161)), measured: false };
    }
    return null;
  }
  const round10 = (n) => Math.round(n / 10) * 10;

  // Tarjeta de calorias: basales y gasto diario estimado con tu plan (pesas + cardio, 5 dias por semana)
  function caloriesCard() {
    const b = bmrInfo();
    if (!b) {
      return h('section', { class: 'card' }, h('strong', {}, '🔥 Calorías basales'),
        h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Escribe tu sexo, edad y altura abajo (y guarda un control con tu peso) para estimarlas, o anota la TMB que te da tu báscula.'));
    }
    const train = b.kcal * 1.55, rest = b.kcal * 1.3;
    const row = (label, kcal, note) => h('div', { class: 'ctl-row' }, h('span', {}, label, note ? h('div', { class: 'muted small' }, note) : null), h('b', {}, fmt(round10(kcal)) + ' kcal'));
    return h('section', { class: 'card' },
      h('strong', {}, '🔥 Calorías basales'),
      h('div', { class: 'goal-top', style: 'margin-top:6px' }, h('span', { class: 'goal-num' }, h('b', {}, fmt(b.kcal)), ' kcal al día')),
      h('p', { class: 'muted small', style: 'margin:2px 0 10px' }, b.measured
        ? 'Medidas por tu báscula en el control del ' + fmtDate(b.date) + '. Es lo que gastas en reposo total.'
        : 'Estimadas con tu peso, altura, edad y sexo (fórmula de Mifflin-St Jeor). Si anotas la TMB de tu báscula, la app usa esa.'),
      row('Día de descanso', rest, 'basales × 1,3'),
      row('Día de entreno', train, 'pesas + cardio · basales × 1,55'),
      h('div', { class: 'section-title', style: 'margin:12px 0 4px' }, 'Según tu objetivo, en días de entreno'),
      row('Perder grasa', train * 0.85, '15 % menos'),
      row('Mantener peso', train),
      row('Ganar músculo', train * 1.1, '10 % más'),
      h('p', { class: 'muted small', style: 'margin:10px 0 0' }, 'Son estimaciones. Pésate cada semana y ajusta unas 100–150 kcal si en 2–3 semanas no ves el cambio que buscas.'));
  }


  // ---------- leer el informe de la bascula (foto o captura del informe Fitdays) ----------
  // Lee el texto de la imagen en el propio celular (OCR, se descarga la primera vez) y rellena el formulario para que lo revises.
  function parseFitdays(text) {
    const num = (x) => parseFloat(String(x).replace(',', '.'));
    const out = {};
    const put = (k, v, lo, hi) => { if (v != null && !isNaN(v) && v >= lo && v <= hi && out[k] == null) out[k] = v; };
    let m = text.match(/prueba:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (m) out.fecha = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    m = text.match(/Edad:\s*(\d{2})/i); if (m) out.edad = +m[1];
    m = text.match(/Alto:\s*(\d{3})/i); if (m && +m[1] >= 120 && +m[1] <= 230) out.altura = +m[1];
    if (/G[eé]nero:\s*Hombre/i.test(text)) out.sexo = 'h'; else if (/G[eé]nero:\s*Mujer/i.test(text)) out.sexo = 'm';
    // Tabla principal: peso, grasa, masa osea, proteina, agua, masa muscular, musculo esqueletico (en ese orden)
    const rows = [];
    text.split('\n').forEach((ln) => { const r = ln.match(/(\d{1,3}[.,]\d)\s*\(([^)]*)\)\s*(\d{1,3}[.,]\d)/); if (r) rows.push([num(r[1]), num(r[3])]); });
    if (rows.length >= 7) {
      put('peso', rows[0][0], 20, 300); put('masaGrasa', rows[1][0], 1, 150); put('grasa', rows[1][1], 2, 70);
      put('osea', rows[2][0], 0.5, 10); put('proteina', rows[3][0], 2, 40); put('agua', rows[4][0], 10, 120);
      put('musculo', rows[5][0], 10, 150); put('esqueletico', rows[6][0], 5, 100);
    } else {
      m = text.match(/^\s*Peso\s+(\d{2,3}[.,]\d)\s*\(/mi); if (m) put('peso', num(m[1]), 20, 300);
      m = text.match(/Masa muscular\s+(\d{2,3}[.,]\d)/i); if (m) put('musculo', num(m[1]), 10, 150);
      m = text.match(/esquel[eé]tico\s+(\d{2,3}[.,]\d)\s*\(/i); if (m) put('esqueletico', num(m[1]), 5, 100);
      m = text.match(/prote[ií]na\s+(\d{1,2}[.,]\d)/i); if (m) put('proteina', num(m[1]), 2, 40);
      m = text.match(/agua\s+(\d{2,3}[.,]\d)/i); if (m) put('agua', num(m[1]), 10, 120);
    }
    m = text.match(/IMC\s*(?:\(kg[^)]*\))?[^\d\n]*\n?[^\d\n]*(\d{2}[.,]\d)\b/i); if (m) put('imc', num(m[1]), 10, 60);
    m = text.match(/grasa visceral\s+(\d{1,2})\b/i); if (m) put('visceral', +m[1], 1, 30);
    m = text.match(/metab[oó]lica basal\s+(\d{3,4})/i); if (m) put('tmb', +m[1], 800, 4000);
    m = text.match(/Edad corporal\s+(\d{2})\b/i); if (m) put('edadCorporal', +m[1], 15, 90);
    m = text.match(/(\d{1,3})\s*\/\s*100/); if (m) put('puntuacion', +m[1], 1, 150);
    m = text.match(/WHR\s+(\d[.,]\d{2})/i); if (m) put('whr', num(m[1]), 0.5, 1.5);
    return out;
  }
  let ocrLoading = null;
  function loadOcr() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!ocrLoading) ocrLoading = new Promise((ok, fail) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      sc.onload = () => ok(window.Tesseract); sc.onerror = () => { ocrLoading = null; fail(new Error('sin conexión')); };
      document.head.appendChild(sc);
    });
    return ocrLoading;
  }
  // Recorta la columna derecha del informe (indicadores pequeños), la agranda y la pasa a escala de grises: se lee mucho mejor
  async function rightColumn(file) {
    const bmp = await createImageBitmap(file);
    const sx = Math.floor(bmp.width * 0.6), sw = bmp.width - sx, k = Math.min(3, 2400 / sw);
    const cv = document.createElement('canvas'); cv.width = Math.round(sw * k); cv.height = Math.round(bmp.height * k);
    const cx = cv.getContext('2d'); cx.filter = 'grayscale(1) contrast(1.2)';
    cx.drawImage(bmp, sx, 0, sw, bmp.height, 0, 0, cv.width, cv.height);
    return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('imagen no válida'))), 'image/png'));
  }
  // Lee el informe en dos pasadas (imagen completa y columna derecha ampliada) y junta los valores
  async function readReport(file, onStep) {
    const T = await loadOcr();
    const opts = { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa/4.0.0_best_int', gzip: true };
    const w = await T.createWorker('spa', 1, opts);
    try {
      const a = parseFitdays((await w.recognize(file)).data.text);
      let b = {};
      try {
        if (onStep) onStep();
        await w.setParameters({ tessedit_pageseg_mode: '6' });
        b = parseFitdays((await w.recognize(await rightColumn(file))).data.text);
      } catch (e) { /* si falla la segunda pasada, vale la primera */ }
      const d = Object.assign({}, a);
      ['edadCorporal', 'whr', 'tmb', 'puntuacion', 'imc', 'visceral', 'fecha'].forEach((k) => { if (b[k] != null) d[k] = b[k]; });
      Object.keys(b).forEach((k) => { if (d[k] == null) d[k] = b[k]; });
      const alto = d.altura || body.profile.altura;
      if (d.imc == null && d.peso && alto) d.imc = Math.round(d.peso / Math.pow(alto / 100, 2) * 10) / 10;
      return d;
    } finally { await w.terminate(); }
  }

  // Meta de grasa: etapas de % de grasa manteniendo tu masa sin grasa del ultimo control
  const FAT_STAGES = [[20, 'Meta 1'], [17, 'Meta 2'], [15, 'Meta final']];
  const FAT_PACE = 0.45; // kg de grasa por semana, ritmo sano que protege el musculo
  const fatKg = (c) => c && c.peso && (c.masaGrasa != null ? c.masaGrasa : c.grasa != null ? c.peso * c.grasa / 100 : null);
  function fatGoalCard(ctrls) {
    const withFat = ctrls.filter((c) => c.peso && fatKg(c) != null);
    if (!withFat.length) return null;
    const last = withFat[withFat.length - 1], first = withFat[0];
    const fat = fatKg(last), lean = last.peso - fat, pct = 100 * fat / last.peso;
    const r1 = (x) => Math.round(x * 10) / 10;
    const card = h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, 'Meta de grasa'), h('span', { class: 'muted small' }, fmt(r1(pct)) + ' % hoy')),
      h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, 'Calculado con tu masa sin grasa (' + fmt(r1(lean)) + ' kg) del control del ' + fmtDate(last.date) + ', suponiendo que mantienes tu músculo. Ritmo sano: unos ' + fmt(FAT_PACE) + ' kg de grasa por semana.'));
    FAT_STAGES.forEach((st) => {
      const f = st[0] / 100, targetFat = lean * f / (1 - f), targetW = lean + targetFat, toLose = fat - targetFat;
      const done = pct <= st[0];
      card.append(h('div', { class: 'zone-row' + (done ? ' base' : ''), style: 'align-items:center;gap:10px' },
        h('span', {}, (done ? '✓ ' : '') + st[1] + ' · ' + st[0] + ' %',
          h('div', { class: 'muted small', style: 'font-weight:400' }, done ? '¡Lograda!' : 'peso ≈ ' + fmt(r1(targetW)) + ' kg · unas ' + Math.ceil(toLose / FAT_PACE) + ' semanas')),
        h('b', { style: 'white-space:nowrap' }, done ? '' : '−' + fmt(r1(toLose)) + ' kg grasa')));
    });
    const fin = FAT_STAGES[FAT_STAGES.length - 1][0] / 100, finFat = lean * fin / (1 - fin);
    const f0 = fatKg(first);
    if (withFat.length > 1 && f0 > finFat) {
      const prog = Math.max(0, Math.min(100, Math.round(100 * (f0 - fat) / (f0 - finFat))));
      card.append(h('div', { class: 'goal-bar', style: 'margin-top:10px' }, h('i', { style: 'width:' + prog + '%' })),
        h('div', { class: 'goal-msg' }, 'Desde ' + fmtDate(first.date) + ' has bajado ' + fmt(r1(Math.max(0, f0 - fat))) + ' kg de grasa (' + prog + ' % del camino a la meta final).'));
    }
    card.append(h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'La báscula estima la grasa y varía unos 2–3 puntos con la hidratación: mídete siempre en las mismas condiciones y mira la tendencia de varias semanas.'));
    return card;
  }

  function renderCuerpo(root) {
    root.append(h('div', { class: 'group-head' },
      h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/prog') }),
      h('div', { class: 'grow' }, h('h2', {}, 'Mi cuerpo'), h('div', { class: 'muted small' }, 'Controles de peso y composición corporal'))));
    $('.back', root).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    root.append(h('div', { class: 'card soft' }, h('p', { class: 'small', style: 'margin:0' }, '🔒 Estos datos se guardan solo en este dispositivo. No se suben a GitHub ni forman parte del repositorio público.')));

    const ctrls = bodySorted();
    const last = ctrls[ctrls.length - 1], prev = ctrls[ctrls.length - 2];
    if (!ctrls.length) {
      root.append(h('section', { class: 'card', style: 'border-color:var(--warm)' },
        h('strong', {}, 'Aún no hay controles guardados aquí'),
        h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Tus controles se guardan solo en el navegador del celular donde los anotas. Si ya subiste uno y no aparece, puede estar en otro navegador (Chrome, la app instalada, Bluefy…) o se borró al limpiar los datos del navegador. Vuelve a cargarlo en "Importar controles", más abajo, o anótalo en "Nuevo control".')));
    }
    if (last) {
      const stats = h('div', { class: 'stats' });
      [['peso', 'kg'], ['grasa', '%'], ['musculo', 'kg'], ['tmb', 'kcal']].forEach((k) => {
        if (last[k[0]] == null) return;
        const d = prev && prev[k[0]] != null ? last[k[0]] - prev[k[0]] : null;
        const f = BODY_FIELDS.find((x) => x[0] === k[0]);
        stats.append(h('div', { class: 'stat' }, h('b', {}, fmt(last[k[0]])),
          h('span', {}, f[1] + ' (' + k[1] + ')' + (d != null ? ' · ' + (d > 0 ? '+' : '') + fmt(Math.round(d * 10) / 10) : ''))));
      });
      root.append(h('div', { class: 'section-title' }, 'Último control · ' + fmtDate(last.date)), stats);
    }
    const fg = fatGoalCard(ctrls);
    if (fg) root.append(h('div', { class: 'section-title' }, 'Meta de grasa'), fg);
    root.append(h('div', { class: 'section-title' }, 'Calorías'), caloriesCard());
    ['peso', 'grasa', 'musculo', 'tmb', 'pulsoReposo'].forEach((key) => {
      const pts = ctrls.filter((c) => c[key] != null);
      if (!pts.length) return;
      const f = BODY_FIELDS.find((x) => x[0] === key);
      root.append(h('section', { class: 'card' },
        h('div', { class: 'ex-name' }, f[1] + ' (' + f[2] + ')'),
        h('p', { class: 'headline' }, pts.length === 1 ? 'Primer control. El punto punteado es tu próximo control.'
          : (pts[pts.length - 1][key] - pts[0][key] > 0 ? '↑ +' : pts[pts.length - 1][key] - pts[0][key] < 0 ? '↓ ' : '→ ') + fmt(Math.round((pts[pts.length - 1][key] - pts[0][key]) * 10) / 10) + ' ' + f[2] + ' desde ' + fmtDate(pts[0].date)),
        progressChart(pts.map((c) => ({ date: c.date, weight: c[key] })), f[2], { noReps: true, nextLabel: 'Próximo', label: f[1] })));
    });

    // Mis datos: sirven para estimar las calorias basales y las zonas de pulso
    const pf = h('form', { class: 'body-form', autocomplete: 'off' },
      h('label', {}, 'Sexo', h('select', { name: 'sexo' },
        h('option', { value: '' }, 'Elegir'), h('option', { value: 'h', selected: body.profile.sexo === 'h' }, 'Hombre'), h('option', { value: 'm', selected: body.profile.sexo === 'm' }, 'Mujer'))),
      h('label', {}, 'Edad', h('input', { name: 'edad', inputmode: 'numeric', value: body.profile.edad || '' })),
      h('label', { class: 'full' }, 'Altura (cm)', h('input', { name: 'altura', inputmode: 'decimal', value: body.profile.altura || '' })),
      h('button', { class: 'btn full', type: 'submit' }, 'Guardar mis datos'));
    pf.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const e = parseNum(pf.elements.edad.value), a = parseNum(pf.elements.altura.value), sx = pf.elements.sexo.value;
      if (sx) body.profile.sexo = sx; else delete body.profile.sexo;
      if (e) body.profile.edad = e; else delete body.profile.edad;
      if (a) body.profile.altura = a; else delete body.profile.altura;
      saveBody(); toast('Datos guardados en este dispositivo.'); render();
    });
    root.append(h('div', { class: 'section-title' }, 'Mis datos'), h('section', { class: 'card' }, pf));

    // Nuevo control
    const form = h('form', { class: 'body-form', autocomplete: 'off' });
    form.append(h('label', { class: 'full' }, 'Fecha', h('input', { name: 'fecha', type: 'date', value: todayISO() })));
    const est = bmrInfo();
    BODY_FIELDS.forEach((f) => form.append(h('label', {}, f[1] + (f[2] ? ' (' + f[2] + ')' : ''),
      h('input', { name: f[0], inputmode: 'decimal', placeholder: f[0] === 'tmb' && est && !est.measured ? 'estimada ' + est.kcal : '' }))));
    form.append(h('button', { class: 'btn primary full', type: 'submit' }, 'Guardar control'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const date = form.elements.fecha.value;
      const peso = parseNum(form.elements.peso.value);
      if (!date || peso == null) { toast('Escribe al menos la fecha y el peso.'); return; }
      const c = { id: uid(), date: date };
      BODY_FIELDS.forEach((f) => { const v = parseNum(form.elements[f[0]].value); if (v != null) c[f[0]] = v; });
      body.controls = body.controls.filter((x) => x.date !== date); body.controls.push(c);
      saveBody(); toast('Control guardado en este dispositivo.'); render();
    });
    // Subir el informe de la bascula: lee la imagen y rellena el formulario para revisarlo
    const upStatus = h('p', { class: 'muted small', style: 'margin:8px 0 0' });
    const upInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (ev) => {
      const file = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!file) return;
      upStatus.textContent = '⏳ Leyendo el informe… la primera vez descarga el lector (necesita internet) y puede tardar un minuto.';
      try {
        const d = await readReport(file, () => { upStatus.textContent = '⏳ Leyendo los indicadores pequeños…'; });
        const keys = BODY_FIELDS.map((f) => f[0]).filter((k) => d[k] != null);
        if (!keys.length) { upStatus.textContent = 'No pude leer valores en esa imagen. Prueba con una captura más nítida o escríbelos a mano.'; return; }
        keys.forEach((k) => { form.elements[k].value = d[k]; });
        if (d.fecha) form.elements.fecha.value = d.fecha;
        if (d.sexo && !body.profile.sexo) body.profile.sexo = d.sexo;
        if (d.edad && !body.profile.edad) body.profile.edad = d.edad;
        if (d.altura && !body.profile.altura) body.profile.altura = d.altura;
        saveBody();
        upStatus.textContent = '✓ Leí ' + keys.length + ' valores' + (d.fecha ? ' del ' + fmtDate(d.fecha) : '') + '. Revísalos con el informe (la lectura puede equivocarse) y toca "Guardar control".';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { upStatus.textContent = 'No se pudo leer el informe: ' + (e && e.message ? e.message : 'error') + '. Revisa tu conexión e intenta de nuevo.'; }
    } });
    root.append(h('div', { class: 'section-title' }, 'Nuevo control'), h('section', { class: 'card' },
      h('button', { class: 'btn full', type: 'button', style: 'margin-bottom:12px', onclick: () => upInput.click() }, '📷 Subir informe de la báscula (foto o captura)'),
      upInput, upStatus, form));

    // Importar desde texto
    const ta = h('textarea', { class: 'body-paste', rows: '3', placeholder: '{"fecha":"2026-08-05","peso":…}', 'aria-label': 'Texto de controles para importar' });
    root.append(h('div', { class: 'section-title' }, 'Importar controles'),
      h('section', { class: 'card' },
        h('p', { class: 'muted small', style: 'margin-top:0' }, 'Pega aquí el texto que te dé el asistente para cargar un control de una vez.'),
        ta, h('button', { class: 'btn', type: 'button', style: 'margin-top:8px', onclick: () => { importBody(ta.value.trim()); } }, 'Importar')));

    // Copia de seguridad de los controles (mismo formato que Importar)
    if (ctrls.length) {
      const backup = () => JSON.stringify(ctrls.map((c, i) => {
        const o = { fecha: c.date };
        BODY_FIELDS.forEach((f) => { if (c[f[0]] != null) o[f[0]] = c[f[0]]; });
        if (i === ctrls.length - 1) ['altura', 'edad', 'sexo'].forEach((k) => { if (body.profile[k]) o[k] = body.profile[k]; });
        return o;
      }), null, 1);
      root.append(h('div', { class: 'section-title' }, 'Copia de seguridad'),
        h('section', { class: 'card' },
          h('p', { class: 'muted small', style: 'margin:0 0 8px' }, 'Guarda una copia de tus controles por si cambias de celular o borras los datos del navegador. Para recuperarlos, pega el texto en "Importar controles".'),
          h('div', { class: 'hiit-actions' },
            h('button', { class: 'btn', type: 'button', onclick: () => {
              const t = backup();
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copiado. Pégalo en un lugar seguro.'), () => toast('No se pudo copiar.'));
              else toast('Tu navegador no permite copiar. Usa Descargar.');
            } }, 'Copiar texto'),
            h('button', { class: 'btn', type: 'button', onclick: () => download('mis-controles.json', backup(), 'application/json') }, 'Descargar'))));
    }

    // Historial de controles
    if (ctrls.length) {
      const list = h('section', { class: 'card' });
      ctrls.slice().reverse().forEach((c) => {
        list.append(h('details', { class: 'ctl' },
          h('summary', {}, h('strong', {}, fmtDate(c.date)), h('span', { class: 'muted small' }, (c.peso ? fmt(c.peso) + ' kg' : '') + (c.grasa ? ' · ' + fmt(c.grasa) + ' % grasa' : ''))),
          h('div', { class: 'ctl-body' },
            BODY_FIELDS.filter((f) => c[f[0]] != null).map((f) => h('div', { class: 'ctl-row' }, h('span', {}, f[1]), h('b', {}, fmt(c[f[0]]) + (f[2] ? ' ' + f[2] : '')))),
            h('button', { class: 'btn small danger', type: 'button', style: 'margin-top:8px', onclick: () => {
              if (!confirm('¿Eliminar el control del ' + fmtDate(c.date) + '?')) return;
              body.controls = body.controls.filter((x) => x.id !== c.id); saveBody(); render();
            } }, 'Eliminar'))));
      });
      root.append(h('div', { class: 'section-title' }, 'Todos los controles'), list);
    }
  }

  // ---------- cardio ----------
  const CARDIO_GOAL = 90; // minutos por semana en zona 2 (2-3 sesiones de 30-40 min)
  const CARDIO_TYPES = [['Caminata rápida', 4.5], ['Trote suave', 7], ['Bicicleta', 6], ['Elíptica', 5], ['Intervalos', 8], ['Escaleras', 6.5], ['Salto de cuerda', 11], ['Natación', 6], ['Otro', 5]];
  function cardioWeekMinutes() {
    return cardio.sessions.filter((c) => daysSince(c.date) >= 0 && daysSince(c.date) < 7).reduce((t, c) => t + (c.min || 0), 0);
  }
  function hrZones() {
    const lb = bodySorted().filter((c) => c.pulsoReposo != null).pop();
    const rest = (lb && lb.pulsoReposo) || body.profile.pulsoReposo;
    const age = body.profile.edad;
    if (!rest || !age) return null;
    const max = 220 - age, res = max - rest;
    const at = (f) => Math.round(rest + f * res);
    return { max: max, rest: rest, z: [
      { n: 1, name: 'Recuperación', lo: at(0.5), hi: at(0.6) },
      { n: 2, name: 'Quema de grasa', lo: at(0.6), hi: at(0.7) },
      { n: 3, name: 'Moderado', lo: at(0.7), hi: at(0.8) },
      { n: 4, name: 'Intenso', lo: at(0.8), hi: at(0.9) }] };
  }
  const zoneOf = (zones, hr) => !zones || !hr ? null : hr < zones.z[0].lo ? 0 : (zones.z.find((z) => hr <= z.hi) || { n: 5 }).n;

  // Pulsos de cada ronda de una sesion de intervalos: al terminar / recuperado
  function detLine(c) {
    if (!c.det || !c.det.some((x) => x && (x[0] || x[1]))) return null;
    return h('div', { class: 'muted small' }, 'Pulsos: ' + c.det.map((x, i) => (i + 1) + ') ' + (x[0] || '—') + (x[1] ? '→' + x[1] : '')).join(' · '));
  }
  // Sesiones de cardio guardadas hoy desde un dia del plan
  function cardioToday(day) { return cardio.sessions.filter((c) => c.date === todayISO() && c.dia === day.id); }

  // Cronometro de la sesion de cardio a ritmo constante (los dias de intervalos usan la sesion guiada)
  const STEADY_KEY = 'rutinas.steady.v1';
  let steady = (function () {
    try { const v = JSON.parse(localStorage.getItem(STEADY_KEY)); if (v && typeof v.acc === 'number') return v; } catch (e) { /* sin datos */ }
    return { acc: 0, start: null };
  })();
  let steadyFill = null; // minutos y pulso medio del cronometro, para precargar el formulario
  function steadyPersist() { try { localStorage.setItem(STEADY_KEY, JSON.stringify(steady)); } catch (e) { /* sin almacenamiento */ } }
  const steadyMs = () => steady.acc + (steady.start ? Date.now() - steady.start : 0);
  const steadyText = () => mmss(Math.floor(steadyMs() / 1000));
  setInterval(() => { const el = $('#steady-clock'); if (el) el.textContent = steadyText(); }, 500);
  function steadyStop() { if (steady.start) { steady.acc += Date.now() - steady.start; steady.start = null; } }
  function steadyBlock() {
    const running = !!steady.start, has = running || steady.acc > 0;
    return h('div', { class: 'hiit-launch' },
      h('strong', {}, '⏱ Sesión con cronómetro'),
      h('div', { class: 'sw-big', id: 'steady-clock' }, steadyText()),
      h('div', { class: 'row between', style: 'margin-bottom:8px' },
        h('span', { class: 'muted small' }, 'Pulso ahora'),
        h('b', {}, h('span', { class: 'hrm-bpm' }, hrmFresh() ? hrm.bpm : '--'), ' lpm')),
      h('div', { class: 'hiit-actions' },
        h('button', { class: 'btn primary big', type: 'button', onclick: () => {
          if (running) steadyStop(); else steady.start = Date.now();
          steadyPersist(); render();
        } }, running ? '⏸ Pausar' : (has ? '▶ Continuar' : '▶ Iniciar')),
        h('button', { class: 'btn big', type: 'button', disabled: !has, onclick: () => {
          steadyStop();
          const mins = Math.max(1, Math.round(steady.acc / 60000));
          steadyFill = { min: mins, hr: hrm.n ? Math.round(hrm.sum / hrm.n) : null };
          steady = { acc: 0, start: null }; steadyPersist();
          toast(mins + ' min listos: revisa y guarda la sesión.'); render();
        } }, 'Terminar y registrar')),
      h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'Toca Iniciar cuando empieces; el tiempo sigue contando aunque bloquees el celular. Con la banda de pulso conectada se guarda tu pulso medio; sin banda, anótalo al final.'));
  }

  // Plan de la sesion de cardio de un dia del plan, con el pulso objetivo si hay zonas calculadas
  // y un formulario para registrar la sesion ahi mismo.
  function cardioPlanCard(day) {
    const zones = hrZones();
    const hr = (lo, hi) => (lo ? lo + '–' : 'hasta ') + hi + ' lpm';
    const intervals = day.cardio === 'intervalos';
    const calm = zones ? hr(0, zones.z[0].hi) : 'suave · 3 de 10';
    const gentle = day.cardio === 'suave';
    const steps = gentle ? [
      ['1 · Calentamiento · 5 min', 'Bici, elíptica o caminadora muy suave', calm],
      ['2 · Ritmo constante · 30 min', 'Después de piernas: suave y sin cargar. Debes poder conversar', zones ? hr(zones.z[1].lo, zones.z[1].hi) : '5–6 de 10', true],
      ['3 · Vuelta a la calma · 5 min', 'Muy suave y luego estira piernas', calm]
    ] : intervals ? [
      ['1 · Calentamiento · 8 min', 'Bici, elíptica o caminadora, subiendo poco a poco', calm],
      ['2 · 8 rondas · 24 min', '', null],
      ['   Fuerte · 1 min', 'Difícil hablar: 8 de 10. Misma intensidad en todas las rondas', zones ? hr(zones.z[3].lo, zones.z[3].hi) : '8 de 10', true],
      ['   Suave · 2 min', 'Recupera: el pulso baja a la zona 1 o 2', zones ? hr(0, zones.z[1].hi) : '3–4 de 10'],
      ['3 · Vuelta a la calma · 5 min', 'Muy suave hasta bajar de 100 lpm y luego estira piernas', calm]
    ] : [
      ['1 · Calentamiento · 5 min', 'Bici o caminadora suave', calm],
      ['2 · Ritmo constante · 30 min', 'Bici, elíptica o caminadora inclinada (8–12 %)', zones ? hr(zones.z[1].lo, zones.z[1].hi) : '5–6 de 10', true],
      ['3 · Vuelta a la calma · 5 min', 'Muy suave y luego estira piernas. Sin intervalos: mañana toca piernas', calm]
    ];
    const card = h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, '🏃 Cardio de hoy'), h('span', { class: 'muted small' }, cardioWeekMinutes() + ' de ' + CARDIO_GOAL + ' min esta semana')),
      h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, zones
        ? 'Pulso objetivo calculado con tu edad y pulso en reposo (' + zones.rest + ' lpm).'
        : 'Escribe tu edad en Cardio para ver tu pulso objetivo; mientras, guíate por la sensación (de 0 a 10).'),
      lastDoneByGroup()[day.id] ? h('p', { class: 'small', style: 'margin:0 0 8px' }, 'Última vez que lo hiciste: ' + agoText(lastDoneByGroup()[day.id]) + '.') : null,
      steps.map((st) => h('div', { class: 'zone-row' + (st[3] ? ' base' : ''), style: 'align-items:center;gap:10px' },
        h('span', {}, st[0], st[1] ? h('div', { class: 'muted small', style: 'font-weight:400' }, st[1]) : null),
        st[2] ? h('b', { style: 'white-space:nowrap' }, st[2]) : null)));
    if (intervals) {
      card.append(h('details', { style: 'margin-top:10px' },
        h('summary', {}, h('strong', {}, 'Cómo progresar')),
        h('ul', { class: 'plain small', style: 'margin:8px 0 0' },
          h('li', {}, 'Semanas 1–2: 6 rondas de 30 s fuerte y 90 s suave (unos 12 min).'),
          h('li', {}, 'Semanas 3–4: 8 rondas de 1 min fuerte y 2 min suave (este plan).'),
          h('li', {}, 'Semana 5 en adelante: 8 rondas de 1 min fuerte y 90 s suave.'),
          h('li', {}, 'Deja 48 horas entre este día y el de piernas. Si dormiste mal o tienes las piernas cargadas, haz ritmo constante en zona 2.'))));
    }

    card.append(hrmWidget(!intervals));
    if (!intervals) card.append(steadyBlock());
    if (intervals) {
      // Sesion guiada con cronometro
      const saved = hiitSavedRun();
      let chosen = hiitPresetChoice();
      const info = h('div', { class: 'muted small', style: 'margin:6px 0 10px' });
      const refresh = () => {
        const pr = hiitPreset(chosen);
        info.textContent = pr.rounds + ' rondas · ' + secText(pr.hard) + ' fuerte + ' + secText(pr.easy) + ' de recuperación · unos ' + Math.round(hiitTotalSec(pr) / 60) + ' min con calentamiento y vuelta a la calma';
      };
      const sel = h('select', { 'aria-label': 'Semana del plan', onchange: (e) => { chosen = e.target.value; hiitSetPresetChoice(chosen); refresh(); } },
        HIIT_PRESETS.map((x) => h('option', { value: x.id, selected: x.id === chosen }, x.name)));
      refresh();
      card.append(h('div', { class: 'hiit-launch' },
        h('strong', {}, '⏱ Sesión guiada con cronómetro'),
        h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, 'Te dice cada intervalo, tú das Iniciar y la app cuenta el tiempo. Al terminar anotas tu pulso, te indica cuánto recuperar y pasas al siguiente. Al final suma tus minutos. Mantén la pantalla encendida.'),
        saved ? null : h('label', { class: 'full' }, 'Semana del plan', sel), saved ? null : info,
        saved
          ? h('div', { class: 'hiit-actions' },
              h('button', { class: 'btn primary big', type: 'button', onclick: () => hiitOpen(saved) }, '▶ Continuar sesión en curso'),
              h('button', { class: 'btn big', type: 'button', onclick: () => { hiitStore(null); render(); } }, 'Descartarla'))
          : h('button', { class: 'btn primary big', type: 'button', onclick: () => hiitOpen(null) }, '▶ Empezar intervalos')));
    }

    // Registro de hoy
    const done = cardioToday(day);
    done.forEach((c) => card.append(h('div', { class: 'ctl-row cardio-row', style: 'margin-top:10px' },
      h('div', {}, h('strong', {}, '✓ Registrado hoy'),
        h('div', { class: 'muted small' }, c.tipo + ' · ' + c.min + ' min' + (c.hr ? ' · ' + c.hr + ' lpm' : '') + (c.rondas ? ' · ' + c.rondas + ' rondas' : '')),
        detLine(c)),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Eliminar', onclick: () => {
        if (!confirm('¿Eliminar esta sesión de cardio?')) return;
        cardio.sessions = cardio.sessions.filter((x) => x.id !== c.id); saveCardio(); render();
      } }, '✕'))));
    const form = h('form', { class: 'body-form', autocomplete: 'off', style: 'margin-top:12px' });
    const fillNow = steadyFill; steadyFill = null;
    const typeSel = h('select', { name: 'tipo' }, CARDIO_TYPES.map((t) => h('option', { value: t[0], selected: t[0] === (intervals ? 'Intervalos' : gentle ? 'Elíptica' : 'Bicicleta') }, t[0])));
    form.append(h('strong', { class: 'full' }, intervals ? 'O registrarla a mano' : (done.length ? 'Registrar otra sesión' : 'Registrar la sesión')),
      h('label', { class: 'full' }, 'Fecha', h('input', { name: 'fecha', type: 'date', value: todayISO() })),
      h('label', { class: 'full' }, 'Tipo', typeSel),
      h('label', {}, 'Minutos', h('input', { name: 'min', inputmode: 'numeric', value: fillNow ? fillNow.min : intervals ? 37 : 40 })),
      h('label', {}, 'Pulso promedio (lpm)', h('input', { name: 'hr', id: 'cardio-hr', inputmode: 'numeric', value: fillNow && fillNow.hr ? fillNow.hr : '' })),
      intervals ? h('label', { class: 'full' }, 'Rondas completadas (de 8)', h('input', { name: 'rondas', inputmode: 'numeric', value: 8 })) : null,
      h('button', { class: 'btn primary full', type: 'submit' }, 'Guardar sesión de cardio'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const m = parseNum(form.elements.min.value), date = form.elements.fecha.value;
      if (!m || !date) { toast('Escribe la fecha y los minutos.'); return; }
      const rondas = intervals ? parseNum(form.elements.rondas.value) : null;
      cardio.sessions.push({ id: uid(), date: date, tipo: form.elements.tipo.value, min: Math.round(m), hr: parseNum(form.elements.hr.value), rondas: rondas || undefined, dia: day.id });
      saveCardio(); toast('Cardio guardado en este dispositivo.'); render();
    });
    card.append(form,
      h('button', { class: 'btn small full', type: 'button', style: 'margin-top:8px', onclick: () => go('#/cardio') }, 'Ver historial y mis zonas de pulso'));
    if (day.exercises.length) card.append(h('p', { class: 'muted small', style: 'margin:10px 0 0' }, intervals ? 'Después del cardio: pantorrillas. Registra las series abajo.' : 'Después, core: silla romana, rollout y leñador. Registra las series abajo.'));
    return card;
  }

  // ---------- cardio libre (opcional, no cuenta como dia del plan) ----------
  const FREE_KEY = 'rutinas.freecardio.v1';
  let freeRun = (function () {
    try { const v = JSON.parse(localStorage.getItem(FREE_KEY)); if (v && typeof v.acc === 'number') return v; } catch (e) { /* sin datos */ }
    return { acc: 0, start: null, mode: 'constante', tipo: 'Bicicleta' };
  })();
  let freeDone = null; // minutos y pulso al terminar, para revisar antes de guardar
  function freePersist() { try { localStorage.setItem(FREE_KEY, JSON.stringify(freeRun)); } catch (e) { /* sin almacenamiento */ } }
  const freeMs = () => freeRun.acc + (freeRun.start ? Date.now() - freeRun.start : 0);
  setInterval(() => { const el = $('#free-clock'); if (el) el.textContent = mmss(Math.floor(freeMs() / 1000)); }, 500);
  function freeCardioCard() {
    const zones = hrZones();
    const running = !!freeRun.start, has = running || freeRun.acc > 0;
    const card = h('section', { class: 'card' },
      h('strong', {}, '⏱ Cardio libre'),
      h('p', { class: 'muted small', style: 'margin:4px 0 10px' }, 'Para cuando quieras hacer cardio extra. Suma a tus minutos de la semana, pero no cuenta como día del plan.'));
    const seg = (m, label) => h('button', { class: 'btn' + (freeRun.mode === m ? ' primary' : ''), type: 'button', disabled: has,
      onclick: () => { freeRun.mode = m; freePersist(); render(); } }, label);
    card.append(h('div', { class: 'hiit-actions' }, seg('constante', 'Ritmo constante'), seg('intervalos', 'Intervalos guiados')));

    if (freeRun.mode === 'intervalos') {
      const saved = hiitSavedRun();
      let chosen = hiitPresetChoice();
      const info = h('p', { class: 'muted small', style: 'margin:8px 0' });
      const refresh = () => { const pr = hiitPreset(chosen); info.textContent = pr.rounds + ' rondas · ' + secText(pr.hard) + ' fuerte + ' + secText(pr.easy) + ' suave · unos ' + Math.round(hiitTotalSec(pr) / 60) + ' min con calentamiento y vuelta a la calma' + (zones ? ' · fuerte: ' + zones.z[3].lo + '–' + zones.z[3].hi + ' lpm' : ''); };
      refresh();
      card.append(saved ? null : h('label', { class: 'full', style: 'display:block;margin-top:10px' }, 'Nivel',
          h('select', { onchange: (e) => { chosen = e.target.value; hiitSetPresetChoice(chosen); refresh(); } }, HIIT_PRESETS.map((x) => h('option', { value: x.id, selected: x.id === chosen }, x.name)))),
        saved ? null : info,
        saved ? h('button', { class: 'btn primary big full', type: 'button', style: 'margin-top:10px', onclick: () => hiitOpen(saved) }, '▶ Continuar sesión en curso')
          : h('button', { class: 'btn primary big full', type: 'button', onclick: () => hiitOpen(null, true) }, '▶ Empezar intervalos'));
      return card;
    }

    // Ritmo constante con cronometro
    const typeSel = h('select', { onchange: (e) => { freeRun.tipo = e.target.value; freePersist(); } },
      CARDIO_TYPES.filter((t) => t[0] !== 'Intervalos').map((t) => h('option', { value: t[0], selected: t[0] === freeRun.tipo }, t[0])));
    card.append(h('label', { class: 'full', style: 'display:block;margin-top:10px' }, 'Máquina o actividad', typeSel),
      zones ? h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'Zona 2 (quema de grasa): ' + zones.z[1].lo + '–' + zones.z[1].hi + ' lpm. Debes poder conversar.') : null,
      h('div', { class: 'sw-big', id: 'free-clock' }, mmss(Math.floor(freeMs() / 1000))),
      h('div', { class: 'row between', style: 'margin-bottom:8px' }, h('span', { class: 'muted small' }, 'Pulso ahora'),
        h('b', {}, h('span', { class: 'hrm-bpm' }, hrmFresh() ? hrm.bpm : '--'), ' lpm')));
    if (freeDone) {
      const form = h('form', { class: 'body-form', autocomplete: 'off' },
        h('label', {}, 'Minutos', h('input', { name: 'min', inputmode: 'numeric', value: freeDone.min })),
        h('label', {}, 'Pulso promedio (lpm)', h('input', { name: 'hr', inputmode: 'numeric', value: freeDone.hr || '' })),
        h('button', { class: 'btn primary full', type: 'submit' }, 'Guardar cardio extra'),
        h('button', { class: 'btn full', type: 'button', onclick: () => { freeDone = null; render(); } }, 'Descartar'));
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const m = parseNum(form.elements.min.value);
        if (!m) { toast('Escribe los minutos.'); return; }
        cardio.sessions.push({ id: uid(), date: todayISO(), tipo: freeRun.tipo, min: Math.round(m), hr: parseNum(form.elements.hr.value), libre: true });
        saveCardio(); freeDone = null; toast('Cardio extra guardado.'); render();
      });
      card.append(form);
      return card;
    }
    card.append(h('div', { class: 'hiit-actions' },
      h('button', { class: 'btn primary big', type: 'button', onclick: () => {
        ensureAudio();
        if (running) { freeRun.acc += Date.now() - freeRun.start; freeRun.start = null; } else { if (!has) hrmResetStats(); freeRun.start = Date.now(); }
        freePersist(); render();
      } }, running ? '⏸ Pausar' : (has ? '▶ Continuar' : '▶ Iniciar')),
      h('button', { class: 'btn big', type: 'button', disabled: !has, onclick: () => {
        if (freeRun.start) { freeRun.acc += Date.now() - freeRun.start; freeRun.start = null; }
        freeDone = { min: Math.max(1, Math.round(freeRun.acc / 60000)), hr: hrm.n ? Math.round(hrm.sum / hrm.n) : null };
        freeRun.acc = 0; freePersist(); render();
      } }, 'Terminar')),
      h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'El tiempo sigue contando aunque bloquees el celular o cambies de pantalla.'));
    return card;
  }

  function renderCardio(root) {
    root.append(h('div', { class: 'group-head' },
      h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/prog') }),
      h('div', { class: 'grow' }, h('h2', {}, 'Cardio'), h('div', { class: 'muted small' }, 'Zona 2 · quema de grasa'))));
    $('.back', root).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    root.append(h('div', { class: 'card soft' }, h('p', { class: 'small', style: 'margin:0' }, '🔒 Estos datos se guardan solo en este dispositivo.')));

    // Semana
    const min = cardioWeekMinutes();
    const pct = Math.min(100, Math.round(100 * min / CARDIO_GOAL));
    root.append(h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, 'Esta semana'), h('span', { class: 'muted small' }, 'Meta: ' + CARDIO_GOAL + ' min')),
      h('div', { class: 'goal-top', style: 'margin-top:8px' }, h('span', { class: 'goal-num' }, h('b', {}, min), ' de ' + CARDIO_GOAL + ' min')),
      h('div', { class: 'goal-bar' }, h('i', { style: 'width:' + pct + '%' + (min >= CARDIO_GOAL ? ';background:var(--accent)' : '') })),
      h('div', { class: 'goal-msg' }, min >= CARDIO_GOAL ? '✓ ¡Meta cumplida!' : 'Te faltan ' + (CARDIO_GOAL - min) + ' min para la meta. Son 2 o 3 sesiones de 30 a 40 min.')));

    root.append(h('div', { class: 'section-title' }, 'Cardio libre (opcional)'), freeCardioCard());

    // Zonas
    const zones = hrZones();
    const zform = h('form', { class: 'body-form', autocomplete: 'off' },
      h('label', {}, 'Edad', h('input', { name: 'edad', inputmode: 'numeric', value: body.profile.edad || '' })),
      h('label', {}, 'Pulso en reposo (lpm)', h('input', { name: 'rest', inputmode: 'numeric', value: body.profile.pulsoReposo || '' })),
      h('button', { class: 'btn full', type: 'submit' }, 'Calcular mis zonas'));
    zform.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const e = parseNum(zform.elements.edad.value), r = parseNum(zform.elements.rest.value);
      if (!e || !r) { toast('Escribe tu edad y tu pulso en reposo.'); return; }
      body.profile.edad = e; body.profile.pulsoReposo = r; saveBody(); toast('Zonas calculadas.'); render();
    });
    const zcard = h('section', { class: 'card' }, h('strong', {}, 'Mis zonas de pulso'));
    if (zones) {
      zcard.append(h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, 'FC máxima ≈ ' + zones.max + ' lpm · pulso en reposo ' + zones.rest + ' lpm (fórmula de Karvonen).'));
      zones.z.forEach((z) => zcard.append(h('div', { class: 'zone-row' + (z.n === 2 ? ' base' : '') },
        h('span', {}, 'Zona ' + z.n + ' · ' + z.name), h('b', {}, z.lo + '–' + z.hi + ' lpm'))));
      zcard.append(h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'Para el cardio base apunta a la zona 2. Si puedes conversar en frases completas, vas bien.'));
    } else zcard.append(h('p', { class: 'muted small' }, 'Escribe tu edad y tu pulso en reposo para calcular tus zonas.'));
    zcard.append(zform);
    root.append(zcard);
    root.append(h('section', { class: 'card' }, h('strong', {}, 'Banda de pulso'), h('div', { style: 'margin-top:8px' }, hrmWidget(true))));

    // Nueva sesion
    const form = h('form', { class: 'body-form', autocomplete: 'off' });
    const typeSel = h('select', { name: 'tipo' }, CARDIO_TYPES.map((t) => h('option', { value: t[0] }, t[0])));
    form.append(h('label', { class: 'full' }, 'Fecha', h('input', { name: 'fecha', type: 'date', value: todayISO() })),
      h('label', { class: 'full' }, 'Tipo', typeSel),
      h('label', {}, 'Minutos', h('input', { name: 'min', inputmode: 'numeric' })),
      h('label', {}, 'Pulso promedio (lpm)', h('input', { name: 'hr', id: 'cardio-hr', inputmode: 'numeric' })),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Guardar sesión de cardio'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const m = parseNum(form.elements.min.value), date = form.elements.fecha.value;
      if (!m || !date) { toast('Escribe la fecha y los minutos.'); return; }
      const nx = planNext();
      cardio.sessions.push({ id: uid(), date: date, tipo: form.elements.tipo.value, min: Math.round(m), hr: parseNum(form.elements.hr.value), dia: form.elements.tipo.value === 'Intervalos' ? 'dia-cardio-2' : (nx && nx.cardio && nx.cardio !== 'intervalos' ? nx.id : undefined) });
      saveCardio(); toast('Cardio guardado en este dispositivo.'); render();
    });
    root.append(h('div', { class: 'section-title' }, 'Nueva sesión'), h('section', { class: 'card' }, form));

    // Historial
    const lb = lastBody();
    if (cardio.sessions.length) {
      const list = h('section', { class: 'card' });
      cardio.sessions.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).forEach((c) => {
        const met = (CARDIO_TYPES.find((t) => t[0] === c.tipo) || [0, 5])[1];
        const kcal = lb && lb.peso ? Math.round(met * lb.peso * c.min / 60) : null;
        const z = zoneOf(zones, c.hr);
        list.append(h('div', { class: 'ctl-row cardio-row' },
          h('div', {}, h('strong', {}, c.tipo + (c.libre ? ' · extra' : '')), h('div', { class: 'muted small' }, fmtDate(c.date) + ' · ' + c.min + ' min' + (c.hr ? ' · ' + c.hr + ' lpm' : '') + (c.rondas ? ' · ' + c.rondas + ' rondas' : '') + (kcal ? ' · ≈ ' + kcal + ' kcal' : '')), detLine(c),
            z != null ? h('span', { class: 'sugg-tag' + (z === 2 ? '' : ' down') }, z === 0 ? 'Bajo la zona 1' : z === 5 ? 'Sobre la zona 4' : 'Zona ' + z) : null),
          h('button', { class: 'x', type: 'button', 'aria-label': 'Eliminar', onclick: () => {
            if (!confirm('¿Eliminar esta sesión de cardio?')) return;
            cardio.sessions = cardio.sessions.filter((x) => x.id !== c.id); saveCardio(); render();
          } }, '×')));
      });
      root.append(h('div', { class: 'section-title' }, 'Tus sesiones'), list);
    }
  }

  function renderProg(root) {
    root.append(h('section', { class: 'hero' }, h('h2', {}, 'Tu progreso'), h('p', {}, 'Cada punto es el peso más alto que usaste en una sesión. Si la línea sube, estás progresando.')));
    const lb = lastBody();
    root.append(h('button', { class: 'card body-link', type: 'button', onclick: () => go('#/cuerpo') },
      h('div', {}, h('strong', {}, '🧍 Mi cuerpo'),
        h('div', { class: 'muted small' }, lb
          ? 'Último control ' + fmtDate(lb.date) + (lb.peso ? ' · ' + fmt(lb.peso) + ' kg' : '') + (lb.grasa ? ' · ' + fmt(lb.grasa) + ' % grasa' : '')
          : 'Guarda tus controles de peso y composición corporal')),
      h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›')));
    const cmin = cardioWeekMinutes();
    root.append(h('button', { class: 'card body-link', type: 'button', onclick: () => go('#/cardio') },
      h('div', {}, h('strong', {}, '🏃 Cardio'),
        h('div', { class: 'muted small' }, cmin + ' de ' + CARDIO_GOAL + ' min en los últimos 7 días')),
      h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›')));
    root.append(weeklyEvalCard(), nutWeekCard());
    const sessions = sortedSessions().reverse(); // de la mas antigua a la mas reciente
    let any = false;
    ROUTINES.forEach((r) => {
      const cards = [];
      r.exercises.forEach((ex) => {
        const rows = [];
        sessions.forEach((s) => {
          const sets = s.entries.filter((x) => x.exerciseId === ex.id && x.weight != null && !x.badTech);
          if (!sets.length) return;
          const maxW = Math.max.apply(null, sets.map((x) => x.weight));
          const best = sets.filter((x) => x.weight === maxW).reduce((a, b) => (b.reps > a.reps ? b : a));
          rows.push({ date: s.date, weight: maxW, reps: best.reps, vol: sets.reduce((t, x) => t + x.weight * x.reps, 0) });
        });
        if (!rows.length) return;
        const tbody = h('tbody');
        rows.forEach((x, i) => {
          const d = i ? x.weight - rows[i - 1].weight : 0;
          tbody.append(h('tr', {},
            h('td', {}, fmtDate(x.date)),
            h('td', { class: 'num' }, fmt(x.weight) + ' × ' + x.reps),
            h('td', { class: 'num' }, fmt(Math.round(x.vol))),
            h('td', { class: 'num' + (d > 0 ? ' pr' : '') }, i ? (d > 0 ? '+' : '') + fmt(d) : '—')));
        });
        cards.push(h('section', { class: 'card' },
          h('div', { class: 'row' },
            h('img', { class: 'mini', src: imgSrc(ex, 0), alt: '', loading: 'lazy' }),
            h('div', {}, h('div', { class: 'ex-name' }, ex.name), h('div', { class: 'muted small' }, 'Peso en ' + ex.unit + ' · ' + rows.length + (rows.length === 1 ? ' sesión' : ' sesiones')))),
          h('p', { class: 'headline' }, progressHeadline(rows, ex.unit)),
          progressChart(rows, ex.unit),
          h('details', { class: 'chart-table' },
            h('summary', { class: 'muted small' }, 'Ver detalle en tabla'),
            h('table', { class: 'sets' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', { class: 'num' }, 'Peso × reps'), h('th', { class: 'num' }, 'Volumen'), h('th', { class: 'num' }, 'Δ peso'))),
              tbody))));
      });
      if (cards.length) { any = true; root.append(h('div', { class: 'section-title' }, r.name)); cards.forEach((c) => root.append(c)); }
    });
    if (!any) root.append(h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Cuando registres algunas sesiones verás aquí cómo evolucionan tus pesos.')));
  }

  function renderHist(root) {
    root.append(h('section', { class: 'hero' }, h('h2', {}, 'Historial'), h('p', {}, 'Todas tus sesiones, de la más reciente a la más antigua.')));
    const sessions = sortedSessions();
    if (!sessions.length) {
      root.append(h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Aún no hay sesiones guardadas. Tu historial aparecerá aquí después de tu primer entrenamiento.')));
      return;
    }
    sessions.forEach((s) => {
      const n = s.entries.length;
      const exIds = routineOf(s).exercises.map((e) => e.id).filter((id) => s.entries.some((x) => x.exerciseId === id));
      const inner = h('div', { class: 'inner' });
      exIds.forEach((id) => {
        const ex = exById[id];
        const parts = s.entries.filter((x) => x.exerciseId === id).map((x) =>
          fmt(x.weight) + '×' + x.reps + (x.rpe != null ? ' (' + x.rpe + ')' : '') + (x.badTech ? ' ⚠' : ''));
        inner.append(h('div', { class: 'line' }, h('strong', {}, ex.name), h('span', { class: 'muted' }, ' · ' + ex.unit), h('div', {}, parts.join('  ·  '))));
      });
      inner.append(h('div', { class: 'row wrap', style: 'margin-top:10px' },
        h('button', { class: 'btn small', type: 'button', onclick: () => download('rutina-' + routineOf(s).id + '-' + s.date + '.md', sessionToMd(s), 'text/markdown') }, 'Exportar .md'),
        h('button', {
          class: 'btn small danger', type: 'button',
          onclick: () => {
            if (!confirm(ghToken ? '¿Eliminar esta sesión? También se borrará de la nube.' : '¿Eliminar esta sesión de este dispositivo?')) return;
            forget(s);
            save(true); render();
          }
        }, 'Eliminar')));
      root.append(h('details', { class: 'sess' },
        h('summary', {}, h('span', {}, h('strong', {}, routineOf(s).name), h('div', { class: 'muted small' }, fmtDate(s.date) + ' · ' + agoText(s.date))), h('span', { class: 'muted small' }, exIds.length + ' ej. · ' + n + ' series' + (kcalEstimate(n) ? ' · ≈ ' + kcalEstimate(n).kcal + ' kcal' : ''))),
        inner));
    });
    root.append(h('p', { class: 'muted small' }, 'Formato de cada serie: peso×repeticiones (dificultad). ⚠ = técnica incompleta.'));
  }

  function groupsGrid() {
    const lastDone = lastDoneByGroup();
    const grid = h('div', { class: 'groups' });
    ROUTINES.forEach((r) => {
      const today = todaySession(r.id, false);
      const status = today ? 'En curso hoy · ' + today.entries.length + ' series'
        : lastDone[r.id] ? 'Último: ' + agoText(lastDone[r.id]) : 'Sin registros aún';
      grid.append(h('button', { class: 'group', type: 'button', onclick: () => go('#/g/' + r.id) },
        h('span', { class: 'cover' },
          h('img', { src: imgSrc(r.exercises[0], 0), alt: '', loading: 'lazy' }),
          today ? h('span', { class: 'pill live' }, 'Hoy') : null),
        h('span', { class: 'group-txt' },
          h('strong', {}, r.name),
          h('span', {}, r.exercises.length + ' ejercicios'),
          h('span', {}, status))));
    });
    return grid;
  }

  function renderRutina(root) {
    root.append(h('section', { class: 'hero' }, h('h2', {}, 'Rutinas'), h('p', {}, 'Tu ' + PLAN.name.toLowerCase() + ' y los ejercicios de cada grupo. Toca una imagen para cambiarla.')), h('div', { class: 'section-title' }, PLAN.name));
    DAYS.forEach((d) => {
      root.append(h('section', { class: 'card' },
        h('div', { class: 'ex-name' }, d.name),
        h('div', { class: 'muted small' }, d.focus),
        d.exercises.length
          ? h('ul', { class: 'plain' }, d.exercises.map((e) => h('li', {}, e.name + ' — ' + e.sets + ' × ' + e.repMin + '–' + e.repMax)))
          : h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Solo cardio, sin series con peso. El plan está en la tarjeta del inicio.')));
    });
    root.append(h('div', { class: 'section-title' }, 'Grupos sueltos'));
    root.append(h('p', { class: 'muted small', style: 'margin:-4px 4px 10px' }, 'Para un día en que quieras entrenar un solo grupo.'));
    root.append(groupsGrid());
    ROUTINES.forEach((r) => {
      root.append(h('div', { class: 'section-title' }, r.name));
      r.exercises.forEach((ex, i) => {
        root.append(h('section', { class: 'card' },
          h('div', { class: 'row', style: 'align-items:flex-start;gap:12px' },
            h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver imagen de ' + ex.name, onclick: () => openSheet(ex) }, h('img', { src: imgSrc(ex, 0), alt: '', loading: 'lazy' })),
            h('div', { class: 'grow' },
              h('div', { class: 'ex-name' }, (i + 1) + '. ' + ex.name),
              musclesLine(ex),
              h('div', { class: 'muted small' }, specText(ex) + ' · ' + ex.unit),
              ex.notes ? h('p', { class: 'note' }, ex.notes) : null))));
      });
    });

    const fileInput = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) importData(fileInput.files[0]); });

    // Descansos de todos los ejercicios en un solo lugar
    root.append(h('div', { class: 'section-title' }, 'Tiempos de descanso'));
    root.append(h('p', { class: 'muted small', style: 'margin:-4px 4px 10px' }, 'Ajusta cuánto descansas entre series en cada ejercicio. El cronómetro automático usa este tiempo cuando marcas ✓.'));
    const restCard = h('section', { class: 'card' });
    DAYS.filter((d) => d.exercises.length).forEach((d) => {
      restCard.append(h('div', { class: 'rest-day' }, d.name));
      d.exercises.forEach((ex) => restCard.append(h('div', { class: 'rest-row' }, h('span', { class: 'rest-name' }, ex.name), restPicker(ex))));
    });
    restCard.append(h('button', { class: 'btn small', type: 'button', style: 'margin-top:12px', onclick: resetRests }, 'Restaurar los del plan'));
    root.append(restCard);

    root.append(h('div', { class: 'section-title' }, 'Guardado en la nube'));
    root.append(cloudCard());
    root.append(h('div', { class: 'section-title' }, 'Copia de seguridad'));
    root.append(h('section', { class: 'card' },
      h('p', { class: 'muted small', style: 'margin-top:0' }, 'Descarga o carga un archivo con tus registros. Útil como respaldo extra.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => download('rutinas-datos.json', JSON.stringify(Object.assign({}, state, { body: body, cardio: cardio }), null, 2), 'application/json') }, 'Exportar datos'),
        h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, 'Importar datos'),
        h('button', {
          class: 'btn danger', type: 'button',
          onclick: () => {
            if (!confirm('Se borrarán las sesiones guardadas en este dispositivo.' + (ghToken ? ' La copia en la nube no se borra y volverá a cargarse.' : '') + ' ¿Continuar?')) return;
            state = { sessions: [], deleted: state.deleted };
            stopTimer(false);
            save(false); render();
          }
        }, 'Borrar de este dispositivo')),
      fileInput));
    root.append(h('p', { class: 'muted small', style: 'text-align:center;margin-top:18px' }, 'Versión ' + VERSION));
  }

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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && sync.status === 'pending') runSync(); });
  window.addEventListener('online', () => { if (ghToken && (sync.status === 'error' || sync.status === 'pending')) runSync(); });

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
})();
