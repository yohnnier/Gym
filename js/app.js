/* Rutinas — registro de series, progresion y temporizador. Sin dependencias. */
(function () {
  'use strict';

  const KEY = 'rutinas.v1';
  const IMG_KEY = 'rutinas.img.v1';
  const exById = {};
  ROUTINES.forEach((r) => r.exercises.forEach((e) => { exById[e.id] = e; }));
  const routineById = {};
  ROUTINES.forEach((r) => { routineById[r.id] = r; });
  const routineOf = (s) => routineById[(s && s.routineId) || 'piernas'] || ROUTINES[0];

  let state = load();
  let customImg = loadImages();
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
        return { sessions: sessions };
      }
    } catch (e) { /* sin datos */ }
    return { sessions: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento no disponible */ }
  }
  function loadImages() {
    try { return JSON.parse(localStorage.getItem(IMG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveImages() {
    try { localStorage.setItem(IMG_KEY, JSON.stringify(customImg)); return true; } catch (e) { return false; }
  }

  // Historial del repositorio (data/sessions.json), solo lectura; se une al guardado en este dispositivo.
  function allSessions() {
    const ids = {};
    repoSessions.forEach((x) => { ids[x.id] = true; });
    return repoSessions.concat(state.sessions.filter((x) => !ids[x.id]));
  }
  const isRepo = (s) => repoSessions.indexOf(s) !== -1;
  function sortedSessions() {
    return allSessions().sort((a, b) =>
      a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : (a.date < b.date ? 1 : -1));
  }

  // Sesion de hoy para un grupo (solo en este dispositivo). Se crea al registrar la primera serie.
  function todaySession(routineId, create) {
    const today = todayISO();
    let s = state.sessions.find((x) => x.date === today && (x.routineId || 'piernas') === routineId);
    if (!s && create) {
      s = { id: uid(), date: today, createdAt: Date.now(), routineId: routineId, entries: [] };
      state.sessions.push(s);
    }
    return s || null;
  }
  function todaySets(ex, routineId) {
    const s = todaySession(routineId, false);
    return s ? s.entries.filter((x) => x.exerciseId === ex.id) : [];
  }

  // Ultimo registro de este ejercicio, sin contar lo que estas registrando hoy en este dispositivo
  function lastRecord(exId) {
    const today = todayISO();
    const sessions = sortedSessions();
    for (let i = 0; i < sessions.length; i++) {
      if (!isRepo(sessions[i]) && sessions[i].date >= today) continue;
      const sets = sessions[i].entries.filter((x) => x.exerciseId === exId);
      if (sets.length) return { session: sessions[i], sets: sets };
    }
    return null;
  }

  function bestWeight(exId, sessions) {
    let best = null;
    sessions.forEach((s) => s.entries.forEach((x) => {
      if (x.exerciseId === exId && x.weight != null && !x.badTech && (best == null || x.weight > best)) best = x.weight;
    }));
    return best;
  }

  // ---------- progresion (doble progresion para hipertrofia) ----------
  // Devuelve el plan de hoy: peso, repeticiones objetivo por serie, tendencia y explicacion.
  function plan(ex) {
    const last = lastRecord(ex.id);
    const range = ex.repMin + '–' + ex.repMax;
    const reps = (n) => Array(ex.sets).fill(n);
    if (!last) {
      return { weight: null, reps: reps(ex.repMin), trend: 'new',
        title: 'Primera vez',
        text: 'Elige un peso con el que completes ' + range + ' reps dejando 1–2 en reserva. Prioriza la técnica.' };
    }
    const valid = last.sets.filter((x) => x.weight != null && !x.badTech);
    if (!valid.length) {
      return { weight: null, reps: reps(ex.repMin), trend: 'new',
        title: 'Sin peso de referencia',
        text: 'La última vez no quedó un peso válido. Busca uno para ' + range + ' reps con 1–2 en reserva.' };
    }
    const W = Math.max.apply(null, valid.map((x) => x.weight));
    const top = valid.filter((x) => x.weight === W);
    const avgReps = top.reduce((t, x) => t + x.reps, 0) / top.length;
    const rpes = top.map((x) => x.rpe).filter((x) => x != null);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const allTop = top.length >= Math.min(ex.sets, last.sets.length) && top.every((x) => x.reps >= ex.repMax);

    if (allTop || (avgRpe != null && avgRpe <= 7 && avgReps >= ex.repMin)) {
      const nw = W + ex.step;
      return { weight: nw, reps: reps(ex.repMin), trend: 'up',
        title: 'Sube a ' + fmt(nw) + ' ' + ex.unit,
        text: allTop
          ? 'Completaste ' + ex.repMax + ' reps con ' + fmt(W) + '. Sube el peso y vuelve a construir desde ' + ex.repMin + ' reps.'
          : 'Te sobraron repeticiones con ' + fmt(W) + '. Más carga = más estímulo para crecer.' };
    }
    if (avgReps < ex.repMin) {
      const nw = Math.max(0, W - ex.step);
      return { weight: nw, reps: reps(ex.repMin), trend: 'down',
        title: 'Baja a ' + fmt(nw) + ' ' + ex.unit,
        text: 'Quedaste bajo ' + ex.repMin + ' reps. Un peso un poco menor te mantiene en el rango de hipertrofia (' + range + ').' };
    }
    const target = [];
    for (let i = 0; i < ex.sets; i++) {
      const prev = top[Math.min(i, top.length - 1)].reps;
      target.push(Math.min(ex.repMax, prev + 1));
    }
    return { weight: W, reps: target, trend: 'same',
      title: 'Mantén ' + fmt(W) + ' ' + ex.unit + ' y suma reps',
      text: 'Busca +1 repetición por serie. Cuando hagas ' + ex.repMax + ' en todas, sube el peso.' };
  }

  // Ajuste dentro de la sesion segun la serie recien hecha
  function adjustAfter(ex, set, base) {
    if (set.weight == null) return base;
    if (set.reps < ex.repMin) return Math.max(0, set.weight - ex.step);
    if (set.rpe != null && set.rpe <= 7 && set.reps >= ex.repMin) return set.weight + ex.step;
    return set.weight;
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
    delete drafts[ex.id][row];
    save();
    startTimer(ex.rest);
    if (entry.weight != null && before != null && entry.weight > before) toast('¡Nuevo récord en ' + ex.name + '! 🎉');
    else if (entry.reps < ex.repMin) toast('Está bien quedarse corto: ajusta el peso y sigue.');
    else toast('Serie ' + (row + 1) + ' registrada. ¡Bien hecho!');
    render();
  }

  function unlogSet(entry, routineId) {
    const s = todaySession(routineId, false);
    if (!s) return;
    s.entries = s.entries.filter((x) => x !== entry);
    renumber(s.entries);
    if (!s.entries.length) state.sessions = state.sessions.filter((x) => x !== s);
    save(); render();
  }

  // ---------- imagenes ----------
  function imgSrc(ex, i) { return (i === 0 && customImg[ex.id]) || 'img/ex/' + ex.id + '-' + (i || 0) + '.jpg'; }

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
    const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': ex.name },
      h('div', { class: 'sheet-grip' }),
      h('div', { class: 'row between' },
        h('h2', {}, ex.name),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×')),
      h('div', { class: 'sheet-imgs' + (custom ? ' one' : '') },
        h('img', { src: imgSrc(ex, 0), alt: ex.name + ' — posición inicial' }),
        custom ? null : h('img', { src: imgSrc(ex, 1), alt: ex.name + ' — posición final' })),
      h('p', { class: 'muted small' }, custom
        ? 'Foto de tu gimnasio (guardada en este dispositivo).'
        : 'Inicio y final del movimiento. Imagen de referencia: la máquina de tu gimnasio puede verse distinta.'),
      ex.notes ? h('p', { class: 'note' }, ex.notes) : null,
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary big', type: 'button', onclick: () => fileInput.click() }, custom ? 'Cambiar foto' : 'Usar foto de mi gimnasio'),
        custom ? h('button', { class: 'btn big', type: 'button', onclick: () => { delete customImg[ex.id]; saveImages(); toast('Imagen original restaurada.'); close(); render(); } }, 'Restaurar imagen original') : null),
      fileInput,
      custom ? null : h('p', { class: 'credit' }, 'Imágenes: free-exercise-db (dominio público).'));
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
        state = { sessions: data.sessions };
        save(); render();
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
    if (p[0] === 'prog' || p[0] === 'hist' || p[0] === 'rutina') return { view: p[0] };
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
    const tab = r.view === 'group' ? 'hoy' : r.view;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    if (r.view === 'group') renderGroup(root, r.group);
    else if (r.view === 'prog') renderProg(root);
    else if (r.view === 'hist') renderHist(root);
    else if (r.view === 'rutina') renderRutina(root);
    else renderHome(root);
  }

  function specText(ex) {
    return (ex.setsText || ex.sets) + ' × ' + ex.repMin + '–' + ex.repMax + (ex.perLeg ? ' por lado' : '') + ' · descanso ' + ex.restText;
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

    const lastDone = lastDoneByGroup();
    const suggested = ROUTINES.slice().sort((a, b) => {
      const da = lastDone[a.id] ? daysSince(lastDone[a.id]) : 1e9;
      const db = lastDone[b.id] ? daysSince(lastDone[b.id]) : 1e9;
      return db - da;
    })[0];

    root.append(h('div', { class: 'section-title' }, 'Elige grupo muscular'));
    const grid = h('div', { class: 'groups' });
    ROUTINES.forEach((r) => {
      const today = todaySession(r.id, false);
      const status = today ? 'En curso hoy · ' + today.entries.length + ' series'
        : lastDone[r.id] ? 'Último: ' + agoText(lastDone[r.id]) : 'Sin registros aún';
      grid.append(h('button', { class: 'group', type: 'button', onclick: () => go('#/g/' + r.id) },
        h('span', { class: 'cover' },
          h('img', { src: imgSrc(r.exercises[0], 0), alt: '', loading: 'lazy' }),
          r === suggested && !today ? h('span', { class: 'pill' }, 'Sugerido') : null,
          today ? h('span', { class: 'pill live' }, 'Hoy') : null),
        h('span', { class: 'group-txt' },
          h('strong', {}, r.name),
          h('span', {}, r.exercises.length + ' ejercicios'),
          h('span', {}, status))));
    });
    root.append(grid);
  }

  function renderGroup(root, r) {
    const today = todaySession(r.id, false);
    const total = r.exercises.reduce((t, e) => t + e.sets, 0);
    const done = today ? Math.min(today.entries.length, total) : 0;
    const pct = Math.round(100 * done / total);

    root.append(h('div', { class: 'group-head' },
      h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/') }),
      h('div', { class: 'grow' },
        h('h2', {}, r.name),
        h('div', { class: 'muted small' }, 'Hoy · ' + longDate(new Date())))));
    $('.back', root).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    root.append(h('div', { class: 'progress-wrap' },
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'progress-label' }, done
        ? done + ' de ' + total + ' series' + (pct >= 100 ? ' · ¡Rutina completa! 💪' : pct >= 50 ? ' · Ya pasaste la mitad' : '')
        : total + ' series planificadas · la fecha se guarda sola')));

    r.exercises.forEach((ex, i) => root.append(exerciseCard(ex, i, r)));
  }

  function exerciseCard(ex, idx, r) {
    const last = lastRecord(ex.id);
    const p = plan(ex);
    const logged = todaySets(ex, r.id);
    const rows = Math.max(ex.sets, logged.length, (drafts[ex.id] && drafts[ex.id].extra) || 0);
    const complete = logged.length >= ex.sets;

    const head = h('div', { class: 'ex-head' },
      h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver imagen de ' + ex.name, onclick: () => openSheet(ex) },
        h('img', { src: imgSrc(ex, 0), alt: '', loading: 'lazy' }),
        h('span', { class: 'thumb-edit', 'aria-hidden': 'true' }, '⤢')),
      h('div', { class: 'grow' },
        h('div', { class: 'ex-name' }, (idx + 1) + '. ' + ex.name),
        h('div', { class: 'muted small' }, specText(ex)),
        h('div', { class: 'last small' }, last
          ? h('span', {}, h('b', {}, 'Último (' + fmtDate(last.session.date) + '): '), last.sets.map(setStr).join(' · '))
          : h('span', { class: 'muted' }, 'Sin registro anterior'))),
      h('span', { class: 'badge' + (complete ? ' ok' : '') }, logged.length + '/' + ex.sets));

    const icon = { up: '↑', down: '↓', same: '→', new: '★' }[p.trend];
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
        table.append(h('div', { class: 'log-row done' },
          h('span', { class: 'n' }, i + 1),
          h('span', { class: 'prev' }, prev ? setStr(prev) : '—'),
          h('span', { class: 'val' }, fmt(entry.weight)),
          h('span', { class: 'val' }, entry.reps),
          h('button', { class: 'tick on', type: 'button', 'aria-label': 'Deshacer serie ' + (i + 1), onclick: () => unlogSet(entry, r.id) }, '✓')));
        if (entry.rpe == null && i === logged.length - 1) {
          const chips = h('div', { class: 'rpe-ask' }, h('span', { class: 'muted small' }, '¿Qué tan difícil fue?'));
          const row = h('div', { class: 'rpe' });
          [6, 7, 8, 9, 10].forEach((v) => row.append(h('button', {
            type: 'button', title: RPE_TEXT[v],
            onclick: () => { entry.rpe = v; save(); toast(RPE_TEXT[v] + '. Anotado.'); render(); }
          }, String(v))));
          chips.append(row);
          table.append(chips);
        } else if (entry.rpe != null) {
          table.lastChild.title = 'Dificultad ' + entry.rpe + '/10';
        }
        continue;
      }
      // Valor sugerido por defecto; lo que escribas se guarda como borrador y tiene prioridad.
      const defW = carry != null ? fmt(carry) : (prev && prev.weight != null ? fmt(prev.weight) : '');
      const defR = String(p.reps[Math.min(i, p.reps.length - 1)] || ex.repMin);
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

    return h('section', { class: 'card ex' + (complete ? ' done' : '') }, head, sugg, table, addRow);
  }

  function renderProg(root) {
    root.append(h('section', { class: 'hero' }, h('h2', {}, 'Tu progreso'), h('p', {}, 'Mejor serie de cada sesión por ejercicio.')));
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
            h('div', {}, h('div', { class: 'ex-name' }, ex.name), h('div', { class: 'muted small' }, ex.unit))),
          h('table', { class: 'sets' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', { class: 'num' }, 'Peso × reps'), h('th', { class: 'num' }, 'Volumen'), h('th', { class: 'num' }, 'Δ peso'))),
            tbody)));
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
        isRepo(s) ? h('span', { class: 'muted small' }, 'Registro del repositorio') : h('button', {
          class: 'btn small danger', type: 'button',
          onclick: () => {
            if (!confirm('¿Eliminar esta sesión?')) return;
            state.sessions = state.sessions.filter((x) => x !== s);
            save(); render();
          }
        }, 'Eliminar')));
      root.append(h('details', { class: 'sess' },
        h('summary', {}, h('span', {}, h('strong', {}, routineOf(s).name), h('div', { class: 'muted small' }, fmtDate(s.date) + ' · ' + agoText(s.date))), h('span', { class: 'muted small' }, exIds.length + ' ej. · ' + n + ' series')),
        inner));
    });
    root.append(h('p', { class: 'muted small' }, 'Formato de cada serie: peso×repeticiones (dificultad). ⚠ = técnica incompleta.'));
  }

  function renderRutina(root) {
    root.append(h('section', { class: 'hero' }, h('h2', {}, 'Rutinas'), h('p', {}, 'Ejercicios, rangos y descansos de cada grupo. Toca una imagen para cambiarla.')));
    ROUTINES.forEach((r) => {
      root.append(h('div', { class: 'section-title' }, r.name));
      r.exercises.forEach((ex, i) => {
        root.append(h('section', { class: 'card' },
          h('div', { class: 'row', style: 'align-items:flex-start;gap:12px' },
            h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver imagen de ' + ex.name, onclick: () => openSheet(ex) }, h('img', { src: imgSrc(ex, 0), alt: '', loading: 'lazy' })),
            h('div', { class: 'grow' },
              h('div', { class: 'ex-name' }, (i + 1) + '. ' + ex.name),
              h('div', { class: 'muted small' }, specText(ex) + ' · ' + ex.unit),
              ex.notes ? h('p', { class: 'note' }, ex.notes) : null))));
      });
    });

    const fileInput = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) importData(fileInput.files[0]); });

    root.append(h('div', { class: 'section-title' }, 'Datos'));
    root.append(h('section', { class: 'card' },
      h('p', { class: 'muted small', style: 'margin-top:0' }, 'Lo que registras en la app se guarda en este dispositivo. Exporta una copia de vez en cuando.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => download('rutinas-datos.json', JSON.stringify(state, null, 2), 'application/json') }, 'Exportar datos'),
        h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, 'Importar datos'),
        h('button', {
          class: 'btn danger', type: 'button',
          onclick: () => {
            if (!confirm('Se borrarán todas las sesiones de este dispositivo. ¿Continuar?')) return;
            state = { sessions: [] };
            stopTimer(false);
            save(); render();
          }
        }, 'Borrar todo')),
      fileInput));
  }

  // ---------- arranque ----------
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => { go(b.dataset.view === 'hoy' ? '#/' : '#/' + b.dataset.view); });
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const s = $('#sheet'); s.classList.add('hidden'); s.replaceChildren(); } });
  $('#t-plus').addEventListener('click', () => {
    if (!timerHandle) { startTimer(15); return; }
    timerEnd += 15000; timerTotal += 15; tick();
  });
  $('#t-skip').addEventListener('click', () => stopTimer(false));

  save();
  render();

  fetch('data/sessions.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      if (!Array.isArray(list)) return;
      repoSessions = list;
      render();
    })
    .catch(() => { /* sin historial del repositorio */ });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline */ });
  }

  // Expuesto para pruebas
  window.__rutinas = { plan: plan, sessionToMd: sessionToMd, getState: () => state };
})();
