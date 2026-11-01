/* Rutinas — Pestañas Progreso, Historial y Ajustes.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

function renderProg(root) {
  root.append(h('section', { class: 'hero' }, h('h2', {}, 'Tu progreso'), h('p', {}, 'Cómo vas esta semana y la evolución de tus pesos.')));
  const all = sortedSessions(), monthKey = todayISO().slice(0, 7);
  root.append(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('b', {}, all.filter((x) => daysSince(x.date) < 7).length), h('span', {}, 'Sesiones en 7 días')),
    h('div', { class: 'stat' }, h('b', {}, all.filter((x) => x.date.slice(0, 7) === monthKey).length), h('span', {}, 'Este mes')),
    h('div', { class: 'stat' }, h('b', {}, all.reduce((t, x) => t + x.entries.length, 0)), h('span', {}, 'Series en total'))));
  root.append(weeklyEvalCard(), nutWeekCard());
  const vol = weeklyVolume();
  // Lumbar y trapecio no estan en el plan: solo se muestran si tienen series
  const shown = Object.keys(MUSCLES).filter((k) => vol[k] || (k !== 'lumbar' && k !== 'trapecio'));
  const volCard = h('section', { class: 'card vol' }, volumeIntro(shown, vol));
  shown.forEach((k) => volCard.append(volumeMeter(k, vol[k])));
  root.append(h('div', { class: 'section-title' }, 'Series por músculo (meta de la semana)'), volCard);
  root.append(linkCard('🏃 Cardio', cardioWeekMinutes() + ' de ' + CARDIO_GOAL + ' min en los últimos 7 días', '#/cardio'));
  root.append(h('div', { class: 'section-title' }, 'Fuerza por ejercicio'),
    h('p', { class: 'muted small', style: 'margin:-4px 4px 10px' }, 'Cada punto es el peso más alto que usaste en una sesión. Si la línea sube, estás progresando.'));
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
          h('div', {}, h('div', { class: 'ex-name' }, ex.name), h('div', { class: 'muted small' }, 'Peso en ' + ex.unit + ' · ' + rows.length + (rows.length === 1 ? ' sesión' : ' sesiones')),
            altNames(ex.id) ? h('div', { class: 'muted small' }, 'Alternativa de: ' + altNames(ex.id) + '. Cada máquina lleva su propio historial.') : null)),
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

// Corregir una sesion pasada (peso, repeticiones o borrar series). Se guarda una copia con fecha de cambio nueva:
// al unir con la nube gana esta copia, igual que cualquier sesion editada en la app.
function editSessionForm(s) {
  const rows = s.entries.map((e) => {
    const ex = exById[e.exerciseId] || { name: e.exerciseId, unit: '' };
    const w = h('input', { type: 'text', inputmode: 'decimal', value: e.weight == null ? '' : fmt(e.weight), 'aria-label': 'Peso de ' + ex.name + ', serie ' + e.set });
    const r = h('input', { type: 'text', inputmode: 'numeric', value: String(e.reps), 'aria-label': 'Repeticiones de ' + ex.name + ', serie ' + e.set });
    const row = h('div', { class: 'edit-row' },
      h('span', { class: 'small' }, ex.name, h('span', { class: 'muted' }, ' · serie ' + e.set)),
      w, h('span', { class: 'muted small' }, ex.unit), r, h('span', { class: 'muted small' }, 'reps'),
      h('button', { class: 'btn small', type: 'button', 'aria-label': 'Borrar o recuperar esta serie', onclick: () => row.classList.toggle('del') }, '×'));
    return { e: e, w: w, r: r, row: row, ex: ex };
  });
  const apply = () => {
    const entries = [];
    for (let i = 0; i < rows.length; i++) {
      const x = rows[i];
      if (x.row.classList.contains('del')) continue;
      const reps = parseInt(x.r.value, 10);
      const wv = x.w.value.trim() === '' ? null : parseNum(x.w.value);
      if (!(reps >= 0) || (wv != null && !(wv >= 0))) { toast('Revisa el peso y las reps de ' + x.ex.name + ' (serie ' + x.e.set + ').'); return; }
      entries.push(Object.assign({}, x.e, { weight: wv, reps: reps }));
    }
    if (!entries.length) {
      if (!confirm('No quedan series. ¿Eliminar la sesión completa?')) return;
      forget(s); save(true); toast('Sesión eliminada.'); render(); return;
    }
    renumber(entries);
    const n = Object.assign({}, s, { entries: entries, updatedAt: Date.now() });
    state.sessions = state.sessions.filter((x) => x.id !== s.id);
    state.sessions.push(n);
    save(true); toast('Sesión corregida.'); render();
  };
  return h('div', {},
    h('p', { class: 'muted small', style: 'margin:0 0 8px' }, 'Corrige el peso o las reps. × marca una serie para borrarla (tócala de nuevo para recuperarla).'),
    rows.map((x) => x.row),
    h('div', { class: 'row wrap', style: 'margin-top:10px' },
      h('button', { class: 'btn primary small', type: 'button', onclick: apply }, 'Guardar cambios'),
      h('button', { class: 'btn small', type: 'button', onclick: () => render() }, 'Cancelar')));
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
      h('button', { class: 'btn small', type: 'button', onclick: () => inner.replaceChildren(editSessionForm(s)) }, '✏️ Corregir'),
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
  root.append(h('section', { class: 'hero' }, h('h2', {}, 'Ajustes'), h('p', {}, 'Guardado en la nube, copia de seguridad, descansos y las imágenes de cada ejercicio.')));
  // Biblioteca de ejercicios (imagenes, notas y unidad), plegada al final
  const lib = h('div', {});
  ROUTINES.forEach((r) => {
    lib.append(h('div', { class: 'section-title' }, r.name));
    r.exercises.forEach((ex, i) => {
      lib.append(h('section', { class: 'card' },
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


  root.append(h('div', { class: 'section-title' }, 'Guardado en la nube'));
  root.append(cloudCard());
  root.append(h('div', { class: 'section-title' }, 'Copia de seguridad'));
  root.append(h('section', { class: 'card' },
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'Descarga o carga un archivo con tus registros. Útil como respaldo extra.'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', type: 'button', onclick: () => download('rutinas-datos-' + todayISO() + '.json', JSON.stringify(exportAll(), null, 2), 'application/json') }, 'Exportar datos'),
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
  root.append(h('div', { class: 'section-title' }, 'Ejercicios'));
  root.append(h('details', { class: 'card lib' }, h('summary', {}, h('strong', {}, 'Ver todos los ejercicios'), h('span', { class: 'muted small' }, ' · técnica, unidad e imágenes (toca una imagen para cambiarla)')), lib));
  root.append(h('p', { class: 'muted small', style: 'text-align:center;margin-top:18px' }, 'Versión ' + VERSION));
}
