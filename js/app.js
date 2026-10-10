/* Rutinas — registro de series, progresion y temporizador. Sin dependencias. */
(function () {
  'use strict';

  const VERSION = '45';
  const KEY = 'rutinas.v1';
  const IMG_KEY = 'rutinas.img.v1';
  const REST_KEY = 'rutinas.rest.v1';
  const SNOOZE_KEY = 'rutinas.bodysnooze.v1';
  const BODY_REMIND_DAYS = 35; // aviso de nuevo control corporal a las 5 semanas
  const CARDIO_KEY = 'rutinas.cardio.v1'; // sesiones de cardio: solo en este dispositivo
  const BODY_KEY = 'rutinas.body.v1'; // medidas corporales: SOLO en este dispositivo, nunca se suben a GitHub
  const exById = {};
  ROUTINES.forEach((r) => r.exercises.forEach((e) => { exById[e.id] = e; }));
  const routineById = {};
  ROUTINES.forEach((r) => { routineById[r.id] = r; });
  // Dias del plan: rutinas armadas con ejercicios de varios grupos (copias, para poder cambiar las series)
  const DAYS = PLAN.days.map((d) => ({
    id: d.id, name: d.name, focus: d.focus, isDay: true, cardio: !!d.cardio,
    exercises: d.exercises.map((x) => Object.assign({}, exById[x.id], x.sets ? { sets: x.sets, setsText: null } : {}))
  }));
  DAYS.forEach((d) => { routineById[d.id] = d; });
  const routineOf = (s) => routineById[(s && s.routineId) || 'piernas'] || ROUTINES[0];

  let state = load();
  let customImg = loadImages();
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
  //  3. Bajar peso solo si quedaste bajo el minimo dos sesiones seguidas; si fue una, se mantiene.
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

    // 2. Estancamiento
    const sums = recs.map(summarize);
    if (sums.length >= 4 && sums.every(Boolean)) {
      const ref = sums[3].e1rm;
      if (Math.max(sums[0].e1rm, sums[1].e1rm, sums[2].e1rm) <= ref) {
        const dw = Math.max(0, Math.min(W - ex.step, Math.round(W * 0.9 / ex.step) * ex.step));
        return { weight: dw, reps: reps(ex.repMin), trend: 'deload', title: 'Semana de descarga: ' + fmt(dw) + ' ' + ex.unit,
          text: 'Llevas 3 sesiones sin superar tu marca. Es normal: hoy baja el peso y deja 3–4 reps en reserva. Si sigue igual tras la descarga, prueba otra variante.' };
      }
    }

    // 3. Bajo el minimo
    if (last.avgReps < ex.repMin) {
      const prev = sums[1];
      if (prev && prev.avgReps < ex.repMin && prev.W <= W) {
        const nw = Math.max(0, W - ex.step);
        return { weight: nw, reps: reps(ex.repMin), trend: 'down',
          title: 'Baja a ' + fmt(nw) + ' ' + ex.unit,
          text: 'Dos sesiones seguidas bajo ' + ex.repMin + ' reps. Un poco menos de peso te devuelve al rango de hipertrofia (' + range + ').' };
      }
      return { weight: W, reps: reps(ex.repMin), trend: 'same',
        title: 'Mantén ' + fmt(W) + ' ' + ex.unit,
        text: 'La última vez quedaste bajo ' + ex.repMin + ' reps' + (last.avgRpe != null && last.avgRpe >= 9.5 ? ' y al límite (dificultad ' + fmt(last.avgRpe) + ')' : '') + '. Un día flojo no define tu progreso: intenta llegar a ' + ex.repMin + ', con 1 repetición en reserva en la primera serie. Si vuelve a pasar, bajamos el peso.' };
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
      const work = p.weight == null || (e.weight != null && e.weight >= 0.85 * p.weight);
      const tr = p.reps[Math.min(wi, p.reps.length - 1)];
      if (work) wi++;
      const hit = work && e.reps >= tr && (p.weight == null || e.weight == null || e.weight >= p.weight);
      return { work: work, hit: hit, target: tr };
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
  function volStatus(n) {
    const left = VOL_MIN - n;
    if (n === 0) return { cls: 'low', text: 'Sin series esta semana. Meta: ' + VOL_MIN + '.' };
    if (left > 0) return { cls: 'low', text: 'Te ' + (left === 1 ? 'falta 1 serie' : 'faltan ' + left + ' series') + ' para la meta.' };
    if (n > VOL_MAX) return { cls: 'high', text: 'Más de ' + VOL_MAX + ': es suficiente, prioriza recuperar.' };
    return { cls: 'ok', text: '¡Meta cumplida!' };
  }
  function volumeMeter(key, n) {
    const st = volStatus(n);
    const pct = Math.min(100, 100 * n / VOL_MIN);
    return h('div', { class: 'goal ' + st.cls },
      h('div', { class: 'goal-top' },
        h('span', { class: 'goal-name' }, MUSCLES[key]),
        h('span', { class: 'goal-num' }, h('b', {}, n), ' de ' + VOL_MIN + ' series')),
      h('div', { class: 'goal-bar', role: 'progressbar', 'aria-label': MUSCLES[key], 'aria-valuenow': n, 'aria-valuemin': 0, 'aria-valuemax': VOL_MIN },
        h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'goal-msg' }, (st.cls === 'ok' ? '✓ ' : st.cls === 'high' ? '! ' : '') + st.text));
  }
  function volumeIntro(list, vol) {
    const done = list.filter((k) => vol[k] >= VOL_MIN).length;
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
  function imgSrc(ex, i) { return (i === 0 && customImg[ex.id]) || 'img/ex/' + ex.id + '-' + (i || 0) + '.jpg'; }
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

  function openSheet(ex) {
    const sheet = $('#sheet');
    const close = () => { sheet.classList.add('hidden'); sheet.replaceChildren(); };
    const fileInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      resizeImage(f, 720).then((url) => {
        customImg[ex.id] = url;
        if (!saveImages()) { delete customImg[ex.id]; toast('No hay espacio para guardar la imagen.'); return; }
        toast('Imagen actualizada.');
        close(); render();
      }).catch(() => toast('No se pudo leer la imagen.'));
    });
    const custom = !!customImg[ex.id];
    const one = custom || !!ex.single; // foto unica (la tuya, o la de la maquina del gimnasio)
    const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': ex.name },
      h('div', { class: 'sheet-grip' }),
      h('div', { class: 'row between' },
        h('h2', {}, ex.name),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×')),
      h('div', { class: 'sheet-imgs' + (one ? ' one' : '') },
        h('img', { src: imgSrc(ex, 0), alt: ex.name + ' — posición inicial' }),
        one ? null : h('img', { src: imgSrc(ex, 1), alt: ex.name + ' — posición final' })),
      h('p', { class: 'muted small' }, custom
        ? 'Foto de tu gimnasio (guardada en este dispositivo).'
        : ex.single ? 'Foto de la máquina de tu gimnasio.'
        : 'Inicio y final del movimiento. Imagen de referencia: la máquina de tu gimnasio puede verse distinta.'),
      ex.notes ? h('p', { class: 'note' }, ex.notes) : null,
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary big', type: 'button', onclick: () => fileInput.click() }, custom ? 'Cambiar foto' : 'Usar foto de mi gimnasio'),
        custom ? h('button', { class: 'btn big', type: 'button', onclick: () => { delete customImg[ex.id]; saveImages(); toast('Imagen original restaurada.'); close(); render(); } }, 'Restaurar imagen original') : null),
      fileInput,
      (custom || ex.single) ? null : h('p', { class: 'credit' }, 'Imágenes: free-exercise-db (dominio público).'));
    sheet.replaceChildren(h('div', { class: 'sheet-bg', onclick: close }), panel);
    sheet.classList.remove('hidden');
  }

  // ---------- temporizador ----------
  let timerEnd = 0, timerTotal = 0, timerHandle = null, audioCtx = null, hideToken = 0;

  function startTimer(sec) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !audioCtx) audioCtx = new AC();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* sin audio */ }
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

  function lastDoneByGroup() {
    const out = {};
    sortedSessions().forEach((x) => { const id = x.routineId || 'piernas'; if (!out[id]) out[id] = x.date; });
    return out;
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

    // Plan: el siguiente es el que sigue al ultimo dia del plan que hiciste
    let lastDay = -1;
    const sorted = sortedSessions();
    for (let i = 0; i < sorted.length; i++) {
      const k = DAYS.findIndex((d) => d.id === sorted[i].routineId);
      if (k !== -1) { lastDay = k; break; }
    }
    const nextDay = DAYS[(lastDay + 1) % DAYS.length];
    root.append(h('div', { class: 'section-title' }, 'Tu ' + PLAN.name.toLowerCase()));
    const days = h('div', { class: 'days' });
    DAYS.forEach((d, i) => {
      const today = todaySession(d.id, false);
      const sets = d.exercises.reduce((t, e) => t + e.sets, 0);
      const status = today ? 'En curso hoy · ' + today.entries.length + ' de ' + sets + ' series'
        : d.cardio ? 'Cardio: ' + cardioWeekMinutes() + ' de ' + CARDIO_GOAL + ' min esta semana'
        : lastDone[d.id] ? 'Último: ' + agoText(lastDone[d.id]) : d.exercises.length + ' ejercicios · ' + sets + ' series';
      // Portada: una imagen por cada grupo principal del dia
      const covers = [];
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
    root.append(h('div', { class: 'progress-wrap' },
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'progress-label' }, done
        ? done + ' de ' + total + ' series' + (goalTotals.work ? ' · Metas: ' + goalTotals.hit + ' de ' + goalTotals.work : '') + (kcalEstimate(done) ? ' · ≈ ' + kcalEstimate(done).kcal + ' kcal' : '') + (pct >= 100 ? ' · ¡Rutina completa! 💪' : pct >= 50 ? ' · Ya pasaste la mitad' : '')
        : total + ' series planificadas · la fecha se guarda sola'),
      syncBadge()));

    if (r.cardio) root.append(cardioPlanCard());

    const vol = weeklyVolume();
    const muscles = [];
    r.exercises.forEach((e) => { if (muscles.indexOf(e.muscle) === -1) muscles.push(e.muscle); });
    const doneM = muscles.filter((m) => vol[m] >= VOL_MIN).length;
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
        h('strong', {}, p.title + ' · ' + ex.sets + ' × ' + (p.reps[0] === p.reps[p.reps.length - 1] ? p.reps[0] : p.reps.join('/')) + ' reps'),
        h('div', {}, p.text)));

    // Tabla: anterior | hoy
    const table = h('div', { class: 'log' },
      h('div', { class: 'log-row log-th' },
        h('span', {}, '#'), h('span', {}, 'Anterior'), h('span', {}, ex.unit), h('span', {}, 'Reps'), h('span', {})));
    if (!drafts[ex.id]) drafts[ex.id] = {};
    let carry = p.weight;
    for (let i = 0; i < rows; i++) {
      const prev = last && last.sets[i];
      const entry = logged[i];
      if (entry) {
        carry = adjustAfter(ex, entry, carry);
        const gr = gs.rows[i];
        const gcls = !gr || !gr.work ? '' : gr.hit ? ' hit' : ' miss';
        table.append(h('div', { class: 'log-row done' + gcls },
          h('span', { class: 'n' }, i + 1),
          h('span', { class: 'prev' }, prev ? setStr(prev) : '—'),
          h('span', { class: 'val' }, fmt(entry.weight)),
          h('span', { class: 'val' }, entry.reps),
          h('button', { class: 'tick on', type: 'button', 'aria-label': 'Deshacer serie ' + (i + 1), onclick: () => unlogSet(entry, r.id) }, '✓')));
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
      const wIn = h('input', { inputmode: 'decimal', value: d.w != null ? d.w : defW, 'aria-label': 'Peso serie ' + (i + 1), oninput: (e) => { d.w = e.target.value; keep(); } });
      const rIn = h('input', { inputmode: 'numeric', type: 'number', min: '1', value: d.r != null ? d.r : defR, 'aria-label': 'Reps serie ' + (i + 1), oninput: (e) => { d.r = e.target.value; keep(); } });
      const isNext = i === logged.length;
      table.append(h('div', { class: 'log-row' + (isNext ? ' next' : '') },
        h('span', { class: 'n' }, i + 1),
        h('span', { class: 'prev' }, prev ? setStr(prev) : '—'),
        wIn, rIn,
        h('button', { class: 'tick', type: 'button', 'aria-label': 'Registrar serie ' + (i + 1), onclick: () => logSet(ex, r.id, i, d.w != null ? d.w : defW, d.r != null ? d.r : defR) }, '✓')));
    }
    const addRow = h('button', { class: 'btn ghost small add', type: 'button', onclick: () => {
      drafts[ex.id].extra = rows + 1; render();
    } }, '+ Añadir serie');

    const goalLine = gs.work
      ? h('div', { class: 'goal-line ' + (gs.hit === gs.work ? 'ok' : '') }, (gs.hit === gs.work ? '✓ ' : '') + 'Metas cumplidas: ' + gs.hit + ' de ' + gs.work + ' series de trabajo')
      : null;
    return h('section', { class: 'card ex' + (complete ? ' done' : '') }, head, sugg, table, goalLine, addRow);
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
    ['peso', 'Peso', 'kg'], ['grasa', 'Grasa corporal', '%'], ['masaGrasa', 'Masa grasa', 'kg'], ['musculo', 'Masa muscular', 'kg'],
    ['esqueletico', 'Músculo esquelético', 'kg'], ['imc', 'IMC', ''], ['visceral', 'Grasa visceral', 'grado'], ['tmb', 'Metabolismo basal', 'kcal'],
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
      if (c.pulsoReposo) body.profile.pulsoReposo = +c.pulsoReposo;
      body.controls = body.controls.filter((x) => x.date !== ctl.date); // un control por fecha
      body.controls.push(ctl); added++;
    });
    if (!added) { toast('No encontré controles en el texto.'); return; }
    saveBody(); toast(added + ' control' + (added > 1 ? 'es' : '') + ' guardado' + (added > 1 ? 's' : '') + ' en este dispositivo.'); render();
  }

  function renderCuerpo(root) {
    root.append(h('div', { class: 'group-head' },
      h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/prog') }),
      h('div', { class: 'grow' }, h('h2', {}, 'Mi cuerpo'), h('div', { class: 'muted small' }, 'Controles de peso y composición corporal'))));
    $('.back', root).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    root.append(h('div', { class: 'card soft' }, h('p', { class: 'small', style: 'margin:0' }, '🔒 Estos datos se guardan solo en este dispositivo. No se suben a GitHub ni forman parte del repositorio público.')));

    const ctrls = bodySorted();
    const last = ctrls[ctrls.length - 1], prev = ctrls[ctrls.length - 2];
    if (last) {
      const stats = h('div', { class: 'stats' });
      [['peso', 'kg'], ['grasa', '%'], ['musculo', 'kg']].forEach((k) => {
        if (last[k[0]] == null) return;
        const d = prev && prev[k[0]] != null ? last[k[0]] - prev[k[0]] : null;
        const f = BODY_FIELDS.find((x) => x[0] === k[0]);
        stats.append(h('div', { class: 'stat' }, h('b', {}, fmt(last[k[0]])),
          h('span', {}, f[1] + ' (' + k[1] + ')' + (d != null ? ' · ' + (d > 0 ? '+' : '') + fmt(Math.round(d * 10) / 10) : ''))));
      });
      root.append(h('div', { class: 'section-title' }, 'Último control · ' + fmtDate(last.date)), stats);
      if (last.tmb) root.append(h('p', { class: 'muted small', style: 'margin:8px 4px' }, 'Metabolismo basal: ' + fmt(last.tmb) + ' kcal · gasto en días de entreno aprox. ' + fmt(Math.round(last.tmb * 1.4 / 10) * 10) + ' kcal.'));
    }
    ['peso', 'grasa', 'musculo', 'pulsoReposo'].forEach((key) => {
      const pts = ctrls.filter((c) => c[key] != null);
      if (!pts.length) return;
      const f = BODY_FIELDS.find((x) => x[0] === key);
      root.append(h('section', { class: 'card' },
        h('div', { class: 'ex-name' }, f[1] + ' (' + f[2] + ')'),
        h('p', { class: 'headline' }, pts.length === 1 ? 'Primer control. El punto punteado es tu próximo control.'
          : (pts[pts.length - 1][key] - pts[0][key] > 0 ? '↑ +' : pts[pts.length - 1][key] - pts[0][key] < 0 ? '↓ ' : '→ ') + fmt(Math.round((pts[pts.length - 1][key] - pts[0][key]) * 10) / 10) + ' ' + f[2] + ' desde ' + fmtDate(pts[0].date)),
        progressChart(pts.map((c) => ({ date: c.date, weight: c[key] })), f[2], { noReps: true, nextLabel: 'Próximo', label: f[1] })));
    });

    // Nuevo control
    const form = h('form', { class: 'body-form', autocomplete: 'off' });
    form.append(h('label', { class: 'full' }, 'Fecha', h('input', { name: 'fecha', type: 'date', value: todayISO() })));
    BODY_FIELDS.forEach((f) => form.append(h('label', {}, f[1] + (f[2] ? ' (' + f[2] + ')' : ''), h('input', { name: f[0], inputmode: 'decimal' }))));
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
    root.append(h('div', { class: 'section-title' }, 'Nuevo control'), h('section', { class: 'card' }, form));

    // Importar desde texto
    const ta = h('textarea', { class: 'body-paste', rows: '3', placeholder: '{"fecha":"2026-08-05","peso":…}', 'aria-label': 'Texto de controles para importar' });
    root.append(h('div', { class: 'section-title' }, 'Importar controles'),
      h('section', { class: 'card' },
        h('p', { class: 'muted small', style: 'margin-top:0' }, 'Pega aquí el texto que te dé el asistente para cargar un control de una vez.'),
        ta, h('button', { class: 'btn', type: 'button', style: 'margin-top:8px', onclick: () => { importBody(ta.value.trim()); } }, 'Importar')));

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
  const CARDIO_TYPES = [['Caminata rápida', 4.5], ['Trote suave', 7], ['Bicicleta', 6], ['Elíptica', 5], ['Escaleras', 6.5], ['Natación', 6], ['Otro', 5]];
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

  // Plan de la sesion de cardio del dia 4, con el pulso objetivo si hay zonas calculadas
  function cardioPlanCard() {
    const zones = hrZones();
    const hr = (lo, hi) => (lo ? lo + '–' : 'hasta ') + hi + ' lpm';
    const steps = [
      ['1 · Calentamiento · 5 min', 'Bici o caminadora suave', zones ? hr(0, zones.z[0].hi) : 'suave · 3 de 10'],
      ['2 · Ritmo constante · 25 min', 'Bici, elíptica o caminadora inclinada (8–12 %)', zones ? hr(zones.z[1].lo, zones.z[1].hi) : '5–6 de 10', true],
      ['3 · Intervalos (opcional) · 10 min', '5 × 30 s fuerte + 90 s suave. Sáltalo si tienes las piernas cansadas', zones ? hr(zones.z[3].lo, zones.z[3].hi) : '8 de 10'],
      ['4 · Vuelta a la calma · 5 min', 'Muy suave y luego estira piernas', zones ? hr(0, zones.z[0].hi) : 'suave · 3 de 10']
    ];
    const min = cardioWeekMinutes();
    return h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, '🏃 Cardio de hoy'), h('span', { class: 'muted small' }, min + ' de ' + CARDIO_GOAL + ' min esta semana')),
      h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, zones
        ? 'Pulso objetivo calculado con tu edad y pulso en reposo (' + zones.rest + ' lpm).'
        : 'Debes poder hablar en frases completas en el bloque principal. Escribe tu edad en Cardio para ver tu pulso objetivo.'),
      steps.map((st) => h('div', { class: 'zone-row' + (st[3] ? ' base' : ''), style: 'align-items:center;gap:10px' },
        h('span', {}, st[0], h('div', { class: 'muted small', style: 'font-weight:400' }, st[1])),
        h('b', { style: 'white-space:nowrap' }, st[2]))),
      h('button', { class: 'btn primary full', type: 'button', style: 'margin-top:12px', onclick: () => go('#/cardio') }, 'Registrar mis minutos de cardio'),
      h('p', { class: 'muted small', style: 'margin:10px 0 0' }, 'Después, abdomen con la plataforma: registra las series abajo.'));
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

    // Nueva sesion
    const form = h('form', { class: 'body-form', autocomplete: 'off' });
    const typeSel = h('select', { name: 'tipo' }, CARDIO_TYPES.map((t) => h('option', { value: t[0] }, t[0])));
    form.append(h('label', { class: 'full' }, 'Fecha', h('input', { name: 'fecha', type: 'date', value: todayISO() })),
      h('label', { class: 'full' }, 'Tipo', typeSel),
      h('label', {}, 'Minutos', h('input', { name: 'min', inputmode: 'numeric' })),
      h('label', {}, 'Pulso promedio (lpm)', h('input', { name: 'hr', inputmode: 'numeric' })),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Guardar sesión de cardio'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const m = parseNum(form.elements.min.value), date = form.elements.fecha.value;
      if (!m || !date) { toast('Escribe la fecha y los minutos.'); return; }
      cardio.sessions.push({ id: uid(), date: date, tipo: form.elements.tipo.value, min: Math.round(m), hr: parseNum(form.elements.hr.value) });
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
          h('div', {}, h('strong', {}, c.tipo), h('div', { class: 'muted small' }, fmtDate(c.date) + ' · ' + c.min + ' min' + (c.hr ? ' · ' + c.hr + ' lpm' : '') + (kcal ? ' · ≈ ' + kcal + ' kcal' : '')),
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
        h('ul', { class: 'plain' }, d.exercises.map((e) => h('li', {}, e.name + ' — ' + e.sets + ' × ' + e.repMin + '–' + e.repMax)))));
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
    DAYS.forEach((d) => {
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
