/* Rutinas — registro de series, progresion y temporizador. Sin dependencias. */
(function () {
  'use strict';

  const KEY = 'rutinas.v1';
  const exById = {};
  ROUTINES.forEach((r) => r.exercises.forEach((e) => { exById[e.id] = e; }));
  const routineById = {};
  ROUTINES.forEach((r) => { routineById[r.id] = r; });
  const routineOf = (s) => routineById[(s && s.routineId) || 'piernas'] || ROUTINES[0];
  const curRoutine = () => routineOf(state.current);

  let state = load();
  let view = 'hoy';
  let openId = null;
  let lastSummary = null;

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
    return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function greeting() {
    const hr = new Date().getHours();
    return hr < 12 ? 'Buenos días' : hr < 20 ? 'Buenas tardes' : 'Buenas noches';
  }
  const RPE_TEXT = {
    1: 'Muy fácil', 2: 'Muy fácil', 3: 'Fácil', 4: 'Fácil', 5: 'Moderado',
    6: 'Te quedaban 4 o más', 7: 'Te quedaban 3', 8: 'Te quedaban 2', 9: 'Te quedaba 1', 10: 'Al límite, no salía otra'
  };
  let toastHandle = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function bestWeight(exId, sessions) {
    let best = null;
    sessions.forEach((s) => s.entries.forEach((x) => {
      if (x.exerciseId === exId && x.weight != null && !x.badTech && (best == null || x.weight > best)) best = x.weight;
    }));
    return best;
  }

  function mmss(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

  // ---------- estado ----------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.sessions)) return { sessions: s.sessions, current: s.current || null };
    } catch (e) { /* sin datos */ }
    return { sessions: [], current: null };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento no disponible */ }
  }
  // Historial del repositorio (data/sessions.json), solo lectura; se une al guardado en este dispositivo.
  let repoSessions = [];
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

  // ---------- progresion ----------
  function suggestAfter(ex, set) {
    const w = set.weight;
    const range = ex.repMin + '–' + ex.repMax;
    if (w == null) return { weight: null, text: 'Objetivo: ' + range + ' reps con 0–2 en reserva.' };
    if (set.reps < ex.repMin) {
      return { weight: Math.max(0, w - ex.step), text: 'Quedaste bajo ' + ex.repMin + ' reps: baja el peso.' };
    }
    if (set.rpe != null && set.rpe <= 7) {
      return { weight: w + ex.step, text: 'Te sobraban repeticiones: sube el peso.' };
    }
    if (set.reps >= ex.repMax && set.rpe != null && set.rpe <= 8) {
      return { weight: w + ex.step, text: 'Llegaste al tope con margen: sube el peso.' };
    }
    return { weight: w, text: 'Mantén el peso. Objetivo: ' + range + ' reps con 0–2 en reserva.' };
  }

  function lastSessionSets(exId) {
    const sessions = sortedSessions();
    for (let i = 0; i < sessions.length; i++) {
      const sets = sessions[i].entries.filter((x) => x.exerciseId === exId);
      if (sets.length) return { session: sessions[i], sets: sets };
    }
    return null;
  }

  function suggestStart(ex) {
    const last = lastSessionSets(ex.id);
    if (!last) return { weight: null, text: 'Sin historial: elige un peso con el que llegues a ' + ex.repMin + '–' + ex.repMax + ' reps.' };
    const valid = last.sets.filter((x) => x.weight != null && !x.badTech);
    if (!valid.length) return { weight: null, text: 'La sesión anterior no tiene pesos válidos: elige uno para ' + ex.repMin + '–' + ex.repMax + ' reps.' };
    const maxW = Math.max.apply(null, valid.map((x) => x.weight));
    const top = valid.filter((x) => x.weight === maxW);
    const best = top.reduce((a, b) => (b.reps > a.reps ? b : a));
    const avg = top.reduce((s, x) => s + x.reps, 0) / top.length;
    const base = avg < ex.repMin ? { weight: maxW, reps: Math.round(avg), rpe: best.rpe } : best;
    const s = suggestAfter(ex, base);
    s.text = 'Última vez (' + fmtDate(last.session.date) + '): ' + fmt(best.weight) + ' ' + ex.unit + ' × ' + best.reps + '. ' + s.text;
    return s;
  }

  // ---------- acciones ----------
  function startSession(routine) {
    state.current = { id: uid(), date: todayISO(), createdAt: Date.now(), routineId: routine.id, entries: [] };
    openId = routine.exercises[0].id;
    save(); render();
  }

  function finishSession() {
    const cur = state.current;
    if (!cur) return;
    if (!cur.entries.length) {
      if (!confirm('No registraste series. ¿Descartar la sesión?')) return;
      state.current = null;
    } else {
      if (!confirm('¿Terminar la sesión y guardarla en el historial?')) return;
      const prev = allSessions();
      const prs = [];
      curRoutine().exercises.forEach((ex) => {
        const now = bestWeight(ex.id, [cur]);
        const before = bestWeight(ex.id, prev);
        if (now != null && before != null && now > before) prs.push(ex.name);
      });
      lastSummary = {
        routine: curRoutine().name,
        sets: cur.entries.length,
        exercises: new Set(cur.entries.map((x) => x.exerciseId)).size,
        volume: Math.round(cur.entries.reduce((t, x) => t + (x.weight || 0) * x.reps, 0)),
        prs: prs
      };
      state.sessions.push(cur);
      state.current = null;
      view = 'hoy';
      $('#toast').classList.remove('show');
    }
    stopTimer(false);
    save(); render();
  }

  function renumber(entries) {
    const count = {};
    entries.forEach((e) => { count[e.exerciseId] = (count[e.exerciseId] || 0) + 1; e.set = count[e.exerciseId]; });
  }

  function addEntry(ex, form) {
    const reps = parseInt(form.elements.reps.value, 10);
    if (!(reps > 0)) { form.elements.reps.focus(); return; }
    const entry = {
      exerciseId: ex.id,
      set: 0,
      weight: parseNum(form.elements.weight.value),
      reps: reps,
      rpe: parseNum(form.elements.rpe.value)
    };
    const note = form.elements.note.value.trim();
    if (note) entry.note = note;
    if (form.elements.bad.checked) entry.badTech = true;
    const before = bestWeight(ex.id, allSessions().concat([state.current]));
    state.current.entries.push(entry);
    renumber(state.current.entries);
    save();
    startTimer(ex.rest);
    if (entry.weight != null && before != null && entry.weight > before && !entry.badTech) toast('¡Nuevo récord en ' + ex.name + '! 🎉');
    else if (entry.rpe >= 10) toast('Serie al límite. Respira y recupera bien.');
    else if (entry.reps < ex.repMin) toast('Está bien quedarse corto: ajusta el peso y sigue.');
    else toast('Serie registrada. ¡Bien hecho!');

    const done = state.current.entries.filter((x) => x.exerciseId === ex.id).length >= ex.sets;
    if (done) {
      const next = curRoutine().exercises.find((e) => state.current.entries.filter((x) => x.exerciseId === e.id).length < e.sets);
      openId = next ? next.id : null;
    }
    render();
  }

  function deleteEntry(entry) {
    state.current.entries = state.current.entries.filter((x) => x !== entry);
    renumber(state.current.entries);
    save(); render();
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
    $('#t-time').textContent = '¡Listo!';
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
        state = { sessions: data.sessions, current: data.current || null };
        save(); render();
      } catch (e) {
        alert('El archivo no es una exportación válida de esta app.');
      }
    };
    reader.readAsText(file);
  }

  // ---------- vistas ----------
  function render() {
    const root = $('#app');
    root.replaceChildren();
    const sub = longDate(new Date());
    $('#sub').textContent = sub.charAt(0).toUpperCase() + sub.slice(1);
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'hoy') renderHoy(root);
    else if (view === 'prog') renderProg(root);
    else if (view === 'hist') renderHist(root);
    else renderRutina(root);
  }

  function specText(ex) {
    return (ex.setsText || ex.sets) + ' × ' + ex.repMin + '–' + ex.repMax + (ex.perLeg ? ' por pierna' : '') + ' · descanso ' + ex.restText;
  }

  function renderHoy(root) {
    const cur = state.current;
    if (!cur) { renderHome(root); return; }

    const total = curRoutine().exercises.reduce((t, e) => t + e.sets, 0);
    const done = Math.min(cur.entries.length, total);
    const pct = Math.round(100 * done / total);
    root.append(h('div', { class: 'session-head' },
      h('div', { class: 'row between' },
        h('span', { class: 'eyebrow' }, 'Sesión en curso · ' + fmtDate(cur.date)),
        h('button', { class: 'btn small', type: 'button', onclick: finishSession }, 'Terminar')),
      h('h2', {}, curRoutine().name),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'progress-label' }, done + ' de ' + total + ' series' + (pct >= 100 ? ' · ¡Completaste la rutina!' : pct >= 50 ? ' · Ya pasaste la mitad' : ''))));
    curRoutine().exercises.forEach((ex, i) => root.append(exerciseCard(ex, i)));
  }

  function renderHome(root) {
    const sessions = sortedSessions();
    const last = sessions[0];
    const monthKey = todayISO().slice(0, 7);
    const thisMonth = sessions.filter((x) => x.date.slice(0, 7) === monthKey).length;
    const week = sessions.filter((x) => daysSince(x.date) < 7).length;
    const sets = sessions.reduce((t, x) => t + x.entries.length, 0);

    let msg;
    if (!last) msg = 'Empecemos con calma. Elige un grupo muscular y registra tu primera sesión.';
    else if (daysSince(last.date) === 0) msg = 'Ya entrenaste hoy. Recuperar también es parte del progreso.';
    else if (daysSince(last.date) > 7) msg = 'Qué bueno verte de nuevo. Retoma con pesos cómodos y ve subiendo.';
    else msg = 'Cada serie suma. Vamos por la sesión de hoy.';

    root.append(h('section', { class: 'hero' },
      h('h2', {}, greeting()),
      h('p', {}, msg)));
    root.append(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, week), h('span', {}, 'Sesiones en 7 días')),
      h('div', { class: 'stat' }, h('b', {}, thisMonth), h('span', {}, 'Este mes')),
      h('div', { class: 'stat' }, h('b', {}, sets), h('span', {}, 'Series en total'))));

    if (lastSummary) {
      const sm = lastSummary;
      root.append(h('section', { class: 'card soft summary', style: 'margin-top:18px' },
        h('span', { class: 'eyebrow' }, 'Sesión guardada'),
        h('h2', {}, '¡Buen trabajo con ' + sm.routine + '!'),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', {}, sm.exercises), h('span', {}, 'Ejercicios')),
          h('div', { class: 'stat' }, h('b', {}, sm.sets), h('span', {}, 'Series')),
          h('div', { class: 'stat' }, h('b', {}, fmt(sm.volume)), h('span', {}, 'Volumen (peso × reps)'))),
        h('p', { class: 'small', style: 'margin:0' }, sm.prs.length
          ? 'Nuevos récords: ' + sm.prs.join(', ') + '.'
          : 'Constancia antes que intensidad: hoy sumaste otra sesión.'),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { lastSummary = null; render(); } }, 'Cerrar')));
    }

    // Sugerencia: el grupo que lleva mas tiempo sin entrenar
    const lastDone = {};
    sessions.forEach((x) => { const id = x.routineId || 'piernas'; if (!lastDone[id]) lastDone[id] = x.date; });
    const next = ROUTINES.slice().sort((a, b) => {
      const da = lastDone[a.id] ? daysSince(lastDone[a.id]) : 1e9;
      const db = lastDone[b.id] ? daysSince(lastDone[b.id]) : 1e9;
      return db - da;
    })[0];

    root.append(h('div', { class: 'section-title' }, 'Sugerido para hoy'));
    root.append(h('section', { class: 'card' },
      h('div', { class: 'next' },
        h('div', { class: 'txt' },
          h('strong', {}, next.name),
          h('span', { class: 'muted small' }, (lastDone[next.id] ? 'Último: ' + agoText(lastDone[next.id]) : 'Aún sin registros') + ' · ' + next.exercises.length + ' ejercicios'))),
      h('button', { class: 'btn primary big', type: 'button', style: 'margin-top:14px', onclick: () => startSession(next) }, 'Empezar ' + next.name)));

    root.append(h('div', { class: 'section-title' }, 'O elige otro grupo'));
    const grid = h('div', { class: 'groups' });
    ROUTINES.forEach((r) => {
      grid.append(h('button', { class: 'group', type: 'button', onclick: () => startSession(r), 'aria-label': 'Empezar ' + r.name },
        h('span', { class: 'ico' }, r.name.charAt(0)),
        h('div', {},
          h('strong', {}, r.name),
          h('div', {}, h('span', {}, lastDone[r.id] ? agoText(lastDone[r.id]) : r.exercises.length + ' ejercicios')))));
    });
    root.append(grid);

    if (last) {
      root.append(h('div', { class: 'section-title' }, 'Última sesión'));
      root.append(h('section', { class: 'card' },
        h('div', { class: 'row between' },
          h('strong', {}, routineOf(last).name),
          h('span', { class: 'muted small' }, fmtDate(last.date) + ' · ' + agoText(last.date))),
        h('div', { class: 'muted small', style: 'margin-top:4px' }, new Set(last.entries.map((x) => x.exerciseId)).size + ' ejercicios · ' + last.entries.length + ' series'),
        h('button', { class: 'btn small', type: 'button', style: 'margin-top:12px', onclick: () => { view = 'hist'; render(); } }, 'Ver detalle')));
    }
  }

  function exerciseCard(ex, idx) {
    const sets = state.current.entries.filter((e) => e.exerciseId === ex.id);
    const done = sets.length >= ex.sets;
    const isOpen = openId === ex.id;

    const head = h('button', {
      class: 'card-head', type: 'button',
      onclick: () => { openId = isOpen ? null : ex.id; render(); }
    },
      h('div', {},
        h('div', { class: 'ex-name' }, (idx + 1) + '. ' + ex.name),
        h('div', { class: 'muted small' }, specText(ex))),
      h('span', { class: 'badge' + (done ? ' ok' : '') }, sets.length + '/' + ex.sets));

    const card = h('section', { class: 'card ex' + (done ? ' done' : '') }, head);
    if (!isOpen) return card;

    const body = h('div', { class: 'ex-body' });
    if (ex.notes) body.append(h('p', { class: 'note' }, ex.notes));

    if (sets.length) {
      const tbody = h('tbody');
      sets.forEach((e) => {
        tbody.append(h('tr', {},
          h('td', {}, e.set),
          h('td', { class: 'num' }, fmt(e.weight) + ' ' + ex.unit),
          h('td', { class: 'num' }, e.reps),
          h('td', { class: 'num' }, e.rpe == null ? '—' : e.rpe + '/10'),
          h('td', { class: 'num' }, h('button', { class: 'x', type: 'button', 'aria-label': 'Borrar serie', onclick: () => deleteEntry(e) }, '×'))));
        if (e.note || e.badTech) {
          tbody.append(h('tr', {}, h('td', { colspan: 5, class: 'flag' }, [e.badTech ? 'Técnica incompleta' : '', e.note || ''].filter(Boolean).join(' · '))));
        }
      });
      body.append(h('table', { class: 'sets' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Serie'), h('th', { class: 'num' }, 'Peso'), h('th', { class: 'num' }, 'Reps'), h('th', { class: 'num' }, 'Dif.'), h('th', {}))),
        tbody));
    }

    const sugg = sets.length ? suggestAfter(ex, sets[sets.length - 1]) : suggestStart(ex);
    const nextNum = sets.length + 1;
    body.append(h('div', { class: 'tip' },
      h('strong', {}, 'Serie ' + nextNum + (sugg.weight != null ? ': ' + fmt(sugg.weight) + ' ' + ex.unit : '') + ' · ' + ex.repMin + '–' + ex.repMax + ' reps'),
      h('div', {}, sugg.text)));

    const rpeInput = h('input', { type: 'hidden', name: 'rpe', value: '8' });
    const rpeHelp = h('div', { class: 'rpe-help' }, RPE_TEXT[8]);
    const rpeGrid = h('div', { class: 'rpe', role: 'radiogroup', 'aria-label': 'Dificultad' });
    [6, 7, 8, 9, 10].forEach((v) => {
      rpeGrid.append(h('button', {
        type: 'button', class: v === 8 ? 'on' : '', role: 'radio', 'aria-checked': v === 8 ? 'true' : 'false',
        onclick: (ev) => {
          rpeInput.value = String(v);
          rpeHelp.textContent = RPE_TEXT[v];
          rpeGrid.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === ev.currentTarget); b.setAttribute('aria-checked', b === ev.currentTarget ? 'true' : 'false'); });
        }
      }, String(v)));
    });

    const form = h('form', { class: 'set-form', autocomplete: 'off' },
      h('label', {}, 'Peso (' + ex.unit + ')', h('input', { name: 'weight', inputmode: 'decimal', value: sugg.weight != null ? fmt(sugg.weight) : '' })),
      h('label', {}, ex.perLeg ? 'Reps (por pierna)' : 'Repeticiones', h('input', { name: 'reps', inputmode: 'numeric', type: 'number', min: '1' })),
      h('div', { class: 'full' }, h('label', {}, '¿Qué tan difícil fue?'), rpeGrid, rpeHelp, rpeInput),
      h('label', { class: 'full' }, 'Nota (opcional)', h('input', { name: 'note', type: 'text' })),
      h('label', { class: 'full check' }, h('input', { name: 'bad', type: 'checkbox' }), 'La técnica o la pausa no salió completa'),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Registrar serie ' + nextNum));
    form.addEventListener('submit', (ev) => { ev.preventDefault(); addEntry(ex, form); });
    body.append(form);

    card.append(body);
    return card;
  }

  function renderProg(root) {
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
            h('td', { class: 'num' }, i ? (d > 0 ? '+' : '') + fmt(d) : '—')));
        });
        cards.push(h('section', { class: 'card' },
          h('div', { class: 'ex-name' }, ex.name),
          h('div', { class: 'muted small' }, 'Mejor serie por sesión · ' + ex.unit),
          h('table', { class: 'sets' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', { class: 'num' }, 'Peso × reps'), h('th', { class: 'num' }, 'Volumen'), h('th', { class: 'num' }, 'Δ peso'))),
            tbody)));
      });
      if (cards.length) { any = true; root.append(h('h2', { class: 'grp' }, r.name)); cards.forEach((c) => root.append(c)); }
    });
    if (!any) root.append(h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Cuando registres algunas sesiones verás aquí cómo evolucionan tus pesos.')));
  }

  function renderHist(root) {
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
        h('summary', {}, h('strong', {}, fmtDate(s.date) + ' · ' + routineOf(s).name), h('span', { class: 'muted small' }, exIds.length + ' ejercicios · ' + n + ' series')),
        inner));
    });
    root.append(h('p', { class: 'muted small' }, 'Formato de cada serie: peso×repeticiones (dificultad). ⚠ = técnica incompleta.'));
  }

  function renderRutina(root) {
    ROUTINES.forEach((r) => { root.append(h('h2', { class: 'grp' }, r.name)); r.exercises.forEach((ex, i) => {
      root.append(h('section', { class: 'card' },
        h('div', { class: 'ex-name' }, (i + 1) + '. ' + ex.name),
        h('div', { class: 'muted small' }, specText(ex) + ' · ' + ex.unit),
        ex.notes ? h('p', { class: 'note' }, ex.notes) : null,
        ex.provisional ? h('div', { class: 'flag' }, 'Rango provisorio: ajústalo en js/routine.js') : null));
    }); });

    const fileInput = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) importData(fileInput.files[0]); });

    root.append(h('section', { class: 'card' },
      h('h2', {}, 'Datos'),
      h('p', { class: 'muted small' }, 'Tus registros se guardan solo en este dispositivo. Exporta una copia de vez en cuando.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => download('rutinas-datos.json', JSON.stringify(state, null, 2), 'application/json') }, 'Exportar datos'),
        h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, 'Importar datos'),
        h('button', {
          class: 'btn danger', type: 'button',
          onclick: () => {
            if (!confirm('Se borrarán todas las sesiones de este dispositivo. ¿Continuar?')) return;
            state = { sessions: [], current: null };
            stopTimer(false);
            save(); render();
          }
        }, 'Borrar todo')),
      fileInput));
  }

  // ---------- arranque ----------
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => { view = b.dataset.view; render(); window.scrollTo(0, 0); });
  });
  $('#t-plus').addEventListener('click', () => {
    if (!timerHandle) { startTimer(15); return; }
    timerEnd += 15000; timerTotal += 15; tick();
  });
  $('#t-skip').addEventListener('click', () => stopTimer(false));

  if (state.current) {
    const next = curRoutine().exercises.find((e) => state.current.entries.filter((x) => x.exerciseId === e.id).length < e.sets);
    openId = next ? next.id : null;
  }
  render();

  fetch('data/sessions.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => { if (Array.isArray(list)) { repoSessions = list; render(); } })
    .catch(() => { /* sin historial del repositorio */ });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline */ });
  }

  // Expuesto para pruebas
  window.__rutinas = { suggestStart: suggestStart, suggestAfter: suggestAfter, sessionToMd: sessionToMd, getState: () => state };
})();
