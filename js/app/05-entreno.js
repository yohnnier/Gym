/* Rutinas — Máquinas alternativas, página de un día de entrenamiento y gráfica de progreso.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

// ---------- maquinas alternativas ----------
// Cada lugar del plan puede usar cualquiera de las maquinas de su grupo (ALT_GROUPS): fija una, o rota la que llevas mas tiempo sin usar.
// Cada maquina guarda su propio historial (los pesos no se comparan entre maquinas).
let altPref = (function () { try { return JSON.parse(localStorage.getItem(ALT_KEY)) || {}; } catch (e) { return {}; } })();
function saveAlts() { try { localStorage.setItem(ALT_KEY, JSON.stringify(altPref)); } catch (e) { /* sin almacenamiento */ } }
const altNames = (id) => { const g = altGroupOf(id); return g ? g.filter((x) => x !== id && exById[x]).map((x) => exById[x].name).join(', ') : ''; };
const altGroupOf = (id) => (typeof ALT_GROUPS !== 'undefined' ? ALT_GROUPS.find((g) => g.indexOf(id) !== -1) : null) || null;
const lastUsedOn = (id) => { const r = lastRecord(id); return r ? r.session.date : ''; };
// Maquinas que participan en la rotacion: las elegidas, o por defecto las que ya usaste mas la del plan
function altRotationSet(slot, g) {
  const p = altPref[slot];
  if (p && Array.isArray(p.set) && p.set.length) return p.set.filter((m) => g.indexOf(m) !== -1);
  return g.filter((m) => m === slot || lastUsedOn(m));
}
function effectiveId(slot, routineId) {
  const g = altGroupOf(slot);
  if (!g) return slot;
  const s = todaySession(routineId, false);
  if (s) { const used = g.find((m) => s.entries.some((e) => e.exerciseId === m)); if (used) return used; } // hoy ya empezaste con una: no cambia
  const p = altPref[slot];
  if (p && p.mode === 'rotar') {
    const set = altRotationSet(slot, g);
    let best = set[0] || slot, bd = lastUsedOn(best);
    set.forEach((m) => { const d = lastUsedOn(m); if (d < bd) { best = m; bd = d; } });
    return best;
  }
  return p && p.pick && g.indexOf(p.pick) !== -1 ? p.pick : slot;
}
function slotView(r) {
  if (!r.isDay) return r;
  return Object.assign({}, r, { exercises: r.exercises.map((ex) => {
    const slot = ex.slot || ex.id, eff = effectiveId(slot, r.id);
    if (eff === ex.id) return Object.assign({}, ex, { slot: slot });
    return Object.assign({}, exById[eff], { sets: ex.sets, setsText: null, slot: slot });
  }) });
}
function altSheet(ex, r) {
  const slot = ex.slot, g = altGroupOf(slot);
  if (!g) return;
  if (todaySets(ex, r.id).length) { toast('Ya registraste series hoy con esta máquina. Cámbiala en tu próxima sesión.'); return; }
  const p = altPref[slot] || {};
  const sheet = $('#sheet');
  const close = () => { sheet.classList.add('hidden'); sheet.replaceChildren(); };
  const rot = p.mode === 'rotar';
  const picks = g.map((m) => ({ id: m, ex: exById[m], used: lastUsedOn(m) }));
  const rotSet = altRotationSet(slot, g);
  const radios = picks.map((o) => h('label', { class: 'alt-opt' },
    h('input', { type: 'radio', name: 'altmode', value: o.id, checked: !rot && ex.id === o.id }),
    h('span', {}, h('b', {}, o.ex.name), h('span', { class: 'muted small' }, ' · ' + (o.used ? 'última vez ' + fmtDate(o.used) : 'sin usar aún') + ' · ' + o.ex.unit))));
  const rotRadio = h('input', { type: 'radio', name: 'altmode', value: '__rotar', checked: rot });
  const checks = picks.map((o) => h('label', { class: 'alt-opt sub' },
    h('input', { type: 'checkbox', name: 'altset', value: o.id, checked: rotSet.indexOf(o.id) !== -1 }), h('span', {}, o.ex.name)));
  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'row between' }, h('h2', {}, '🔁 Máquina para este ejercicio'), h('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×')),
    h('p', { class: 'muted small' }, 'Estas máquinas trabajan lo mismo: usa una u otra. Cada una guarda su propio historial, porque el peso no es comparable entre máquinas. Las series cuentan igual para tu meta semanal del músculo.'),
    h('div', { class: 'alt-list' }, radios,
      h('label', { class: 'alt-opt' }, rotRadio, h('span', {}, h('b', {}, '↻ Rotar automáticamente'), h('span', { class: 'muted small' }, ' · cada sesión usa la que llevas más tiempo sin hacer'))),
      h('div', { class: 'alt-sub' }, h('div', { class: 'muted small' }, 'Rotar entre:'), checks)),
    h('div', { class: 'hiit-actions' },
      h('button', { class: 'btn primary big', type: 'button', onclick: () => {
        const mode = (panel.querySelector('input[name=altmode]:checked') || {}).value;
        if (mode === '__rotar') {
          const set = [].slice.call(panel.querySelectorAll('input[name=altset]:checked')).map((i) => i.value);
          if (set.length < 2) { toast('Marca al menos dos máquinas para rotar.'); return; }
          altPref[slot] = { mode: 'rotar', set: set };
        } else if (mode && mode !== slot) altPref[slot] = { mode: 'fija', pick: mode };
        else delete altPref[slot];
        saveAlts(); close(); render();
      } }, 'Guardar'),
      h('button', { class: 'btn big', type: 'button', onclick: close }, 'Cancelar')));
  sheet.replaceChildren(h('div', { class: 'sheet-bg', onclick: close }), panel);
  sheet.classList.remove('hidden');
}

function renderGroup(root, r) {
  r = slotView(r);
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
      ex.slot && altGroupOf(ex.slot) ? h('button', { class: 'alt-btn', type: 'button', onclick: () => altSheet(ex, r) },
        '🔁 ' + (altPref[ex.slot] && altPref[ex.slot].mode === 'rotar' ? 'Rotando máquinas' : 'Cambiar de máquina')) : null,
      h('div', { class: 'muted small' }, specText(ex)),
      restPicker(ex),
      h('div', { class: 'last small' }, last
        ? h('span', {}, h('b', {}, 'Último (' + fmtDate(last.session.date) + '): '), last.sets.map(setStr).join(' · '))
        : altLast(ex) ? h('span', { class: 'muted' }, 'Sin registro en esta máquina. En ' + exById[altLast(ex).id].name + ' (' + fmtDate(altLast(ex).rec.session.date) + '): ' + altLast(ex).rec.sets.map(setStr).join(' · ') + '. Es otra máquina: el peso no es comparable.')
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
      h('span', {}, '#'), h('span', {}, 'Anterior'), h('span', {}, ex.unit), hasEq(ex) ? h('span', {}, eqName(ex) + ' ≈') : null, h('span', {}, ex.timed ? 'Seg' : 'Reps'), h('span', {})));
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
