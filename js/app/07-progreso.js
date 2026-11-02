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
  root.append(h('div', { class: 'section-title' }, 'Cuerpo'), bodyPlanCard());
  root.append(h('div', { class: 'section-title' }, 'Esta semana'), weeklyEvalCard(), nutWeekCard());
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

// ---------- cuerpo: historial completo y plan mes a mes (peso, % de grasa, kg de grasa y cintura) ----------
const MONTH_DAYS = 30.44;
// Todos los registros del cuerpo, de las dos basculas: controles mensuales (Mi cuerpo, Fitdays) y pesos diarios
function bodyRecords() {
  const ctl = body.controls.filter((c) => c.peso).map((c) => ({ date: c.date, kg: c.peso, grasa: c.grasa != null ? c.grasa : null,
    fatKg: c.masaGrasa != null ? c.masaGrasa : c.grasa != null ? c.peso * c.grasa / 100 : null, musculo: c.musculo != null ? c.musculo : null, src: 'control' }));
  const day = wlog.entries.map((e) => ({ date: e.date, kg: e.kg, grasa: e.grasa != null ? e.grasa : null, fatKg: e.grasa != null ? e.kg * e.grasa / 100 : null, musculo: e.musculo != null ? e.musculo : null, src: 'diaria' }));
  return ctl.concat(day).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.src === 'control' ? -1 : 1));
}
// Punto de partida del plan: el primer registro con % de grasa desde el inicio del programa (BODY_PLAN.startDate)
function bodyPlanStart() {
  return bodyRecords().find((r) => r.date >= BODY_PLAN.startDate && r.grasa != null) || null;
}
// Lo que dice el plan para una fecha: grasa y masa sin grasa cambian a ritmo constante hasta la ultima meta
function bodyPlanAt(date, s) {
  s = s || bodyPlanStart();
  if (!s) return null;
  const fat0 = s.kg * s.grasa / 100, lean0 = s.kg - fat0, last = BODY_PLAN.goals[BODY_PLAN.goals.length - 1];
  const at = (m) => { const f = fat0 - BODY_PLAN.fatLossPerMonth * m, l = lean0 + BODY_PLAN.leanGainPerMonth * m; return { fat: f, lean: l, kg: f + l, grasa: 100 * f / (f + l) }; };
  let mEnd = 0; while (at(mEnd).grasa > last && mEnd < 36) mEnd += 0.05;
  return at(Math.min(Math.max(0, (Date.parse(date) - Date.parse(s.date)) / DAY / MONTH_DAYS), mEnd));
}
// Fecha aproximada en que el plan llega a un % de grasa
function bodyPlanDateFor(pct, s) {
  for (let d = 0; d < 1100; d += 1) { const iso = isoAdd(s.date, d); if (bodyPlanAt(iso, s).grasa <= pct + 1e-9) return iso; }
  return null;
}
// Promedio movil de 7 dias de los pesos diarios (con al menos 3 datos en la ventana)
function avg7(list, field, date) {
  const t = Date.parse(date);
  const v = list.filter((e) => e[field] != null && Date.parse(e.date) <= t && Date.parse(e.date) > t - 7 * DAY).map((e) => e[field]);
  return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
// Valor real mas reciente hasta una fecha: promedio de 7 dias de la bascula diaria, o el ultimo registro
function bodyNow(date) {
  const day = wlog.entries.map((e) => ({ date: e.date, kg: e.kg, grasa: e.grasa, fatKg: e.grasa != null ? e.kg * e.grasa / 100 : null }));
  const g = avg7(day, 'grasa', date), k = avg7(day, 'kg', date), fk = avg7(day, 'fatKg', date);
  const last = bodyRecords().filter((r) => r.date <= date);
  const lastFat = last.filter((r) => r.grasa != null).pop(), lastKg = last.pop();
  return {
    kg: k != null ? k : lastKg ? lastKg.kg : null,
    grasa: g != null ? g : lastFat ? lastFat.grasa : null,
    fatKg: fk != null ? fk : lastFat ? lastFat.fatKg : null,
    avg: g != null, src: g != null ? 'diaria' : lastFat ? lastFat.src : null, date: lastFat ? lastFat.date : null
  };
}
// Grafica en el tiempo: puntos diarios, controles mensuales (anillos), promedio de 7 dias, plan (punteado) y meta
function trendChart(o) {
  const marks = o.marks || [];
  if (!o.pts.length && !marks.length) return null;
  const W = 320, H = 160, L = 14, R = 14, T = 22, B = 24;
  const all = o.pts.concat(marks, o.avg, o.plan);
  const ts = all.map((p) => Date.parse(p.date));
  // Mismo rango de fechas en todas las graficas (o.range), para poder compararlas una bajo otra
  const t0 = o.range ? Math.min(Date.parse(o.range[0]), Math.min.apply(null, ts)) : Math.min.apply(null, ts);
  const t1 = Math.max(o.range ? Date.parse(o.range[1]) : 0, Math.max.apply(null, ts), t0 + DAY);
  const vs = all.map((p) => p.v).concat(o.goal != null ? [o.goal] : []);
  let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const x = (d) => L + (W - L - R) * (Date.parse(d) - t0) / (t1 - t0);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const f = (v) => fmt(Math.round(v * 10) / 10);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const line = (pts, cls) => pts.length > 1 ? '<polyline class="' + cls + '" points="' + pts.map((p) => x(p.date).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ') + '"/>' : '';
  const dd = (t) => { const p = new Date(t).toISOString().slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); };
  const tip = (p, src) => '<title>' + fmtDate(p.date) + (src ? ' (' + src + ')' : '') + ': ' + esc(f(p.v) + ' ' + o.unit) + (o.planAt && o.planAt(p.date) != null ? ' · plan ' + esc(f(o.planAt(p.date)) + ' ' + o.unit) : '') + '</title>';
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(o.label) + '">';
  svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" class="chart-base"/>';
  if (o.goal != null) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.goal).toFixed(1) + '" y2="' + y(o.goal).toFixed(1) + '" class="chart-goal"/>' +
    '<text x="' + L + '" y="' + (y(o.goal) - 4).toFixed(1) + '" class="chart-date">meta final ' + esc(f(o.goal) + ' ' + o.unit) + '</text>';
  if (o.today) svg += '<line x1="' + x(o.today).toFixed(1) + '" x2="' + x(o.today).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" class="chart-today"/>';
  svg += line(o.plan, 'chart-plan') + line(o.avg, 'chart-line');
  // Donde deberias estar hoy segun el plan (punto sobre la linea punteada)
  if (o.today && o.planAt && o.planAt(o.today) != null) {
    const px = x(o.today).toFixed(1), py = y(o.planAt(o.today)).toFixed(1);
    svg += '<circle cx="' + px + '" cy="' + py + '" r="3.5" class="chart-plan-now"/><text x="' + (+px - 6) + '" y="' + (+py + 14) + '" class="chart-date" text-anchor="end">hoy debería: ' + esc(f(o.planAt(o.today))) + '</text>';
  }
  o.pts.forEach((p) => {
    const cx = x(p.date).toFixed(1), cy = y(p.v).toFixed(1);
    svg += '<g class="chart-pt"><circle cx="' + cx + '" cy="' + cy + '" r="10" class="chart-hit"/><circle cx="' + cx + '" cy="' + cy + '" r="3" class="chart-dot-sm"/>' + tip(p, 'diaria') + '</g>';
  });
  marks.forEach((p) => {
    const cx = x(p.date).toFixed(1), cy = y(p.v).toFixed(1);
    svg += '<g class="chart-pt"><circle cx="' + cx + '" cy="' + cy + '" r="10" class="chart-hit"/><circle cx="' + cx + '" cy="' + cy + '" r="5" class="chart-ctl"/>' + tip(p, 'control mensual') + '</g>' +
      '<text x="' + cx + '" y="' + (+cy - 9).toFixed(1) + '" class="chart-val" text-anchor="middle">' + esc(f(p.v)) + '</text>';
  });
  if (o.avg.length) { const la = o.avg[o.avg.length - 1]; svg += '<text x="' + x(la.date).toFixed(1) + '" y="' + (y(la.v) + 16).toFixed(1) + '" class="chart-val last" text-anchor="middle">' + esc(f(la.v)) + '</text>'; }
  if (o.plan.length) { const pe = o.plan[o.plan.length - 1]; svg += '<text x="' + (W - R) + '" y="' + (y(pe.v) + 14).toFixed(1) + '" class="chart-val" text-anchor="end">' + esc(f(pe.v)) + '</text>'; }
  svg += '<text x="' + L + '" y="' + (H - 6) + '" class="chart-date">' + dd(t0) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" class="chart-date" text-anchor="end">' + dd(t1) + '</text>';
  svg += '</svg>';
  const box = h('div', { class: 'chart-box' });
  box.innerHTML = svg;
  return box;
}
function bodyPlanCard() {
  const S = bodyPlanStart(), today = todayISO(), recs = bodyRecords();
  const card = h('section', { class: 'card' }, h('strong', {}, '🎯 Recomposición: historial y plan'));
  if (!recs.length) {
    card.append(h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Anota tu peso (y el % de grasa de la báscula diaria) o un control en Mi cuerpo para ver tu evolución.'));
    return card;
  }
  const r1 = (v) => fmt(Math.round(v * 10) / 10);
  const goal1 = BODY_PLAN.goals[0], goalN = BODY_PLAN.goals[BODY_PLAN.goals.length - 1];
  // Al dia de hoy: lo que esperaba el plan frente a lo real
  if (S) {
    const p = bodyPlanAt(today, S), now = bodyNow(today);
    const d1 = bodyPlanDateFor(goal1, S), dN = bodyPlanDateFor(goalN, S);
    const days = Math.round((Date.parse(today) - Date.parse(S.date)) / DAY);
    card.append(h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, 'El plan parte del inicio del programa: ' + fmtDate(S.date) + ' (' + (S.src === 'control' ? 'control mensual' : 'báscula diaria') + ': ' + r1(S.kg) + ' kg · ' + r1(S.grasa) + ' %). Cada mes: −' + fmt(BODY_PLAN.fatLossPerMonth) + ' kg de grasa y +' + fmt(BODY_PLAN.leanGainPerMonth) + ' kg sin grasa. Meta ' + goal1 + ' % ≈ ' + (d1 ? fmtDate(d1) : '—') + ' · ' + goalN + ' % ≈ ' + (dN ? fmtDate(dN) : '—') + '.'));
    const row = (label, plan, real, unit, better) => {
      const d = real != null ? real - plan : null;
      return h('tr', {}, h('td', {}, label), h('td', { class: 'num' }, r1(plan) + ' ' + unit), h('td', { class: 'num' }, real != null ? r1(real) + ' ' + unit : '—'),
        h('td', { class: 'num' + (d != null && better ? (d <= 0.3 ? ' pr' : ' warn-text') : '') }, d != null ? (d > 0 ? '+' : '') + r1(d) : '—'));
    };
    card.append(h('div', { class: 'chart-title' }, 'Al día de hoy (' + days + ' días de programa)'),
      h('table', { class: 'sets' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'num' }, 'Plan'), h('th', { class: 'num' }, 'Real'), h('th', { class: 'num' }, 'Dif.'))),
        h('tbody', {},
          row('% de grasa', p.grasa, now.grasa, '%', true),
          row('Grasa (kg)', p.fat, now.fatKg, 'kg', true),
          row('Peso', p.kg, now.kg, 'kg', false))),
      h('p', { class: 'muted small', style: 'margin:4px 0 0' }, 'Debías bajar ' + r1(S.grasa - p.grasa) + ' puntos de % de grasa y ' + r1(S.kg * S.grasa / 100 - p.fat) + ' kg de grasa desde el inicio. Real: ' +
        (now.avg ? 'promedio de 7 días de la báscula diaria' : 'último registro (' + (now.src === 'control' ? 'control mensual' : 'báscula diaria') + (now.date ? ', ' + fmtDate(now.date) : '') + ')') +
        '. Ojo: si el inicio es de una báscula y lo real de otra, la diferencia puede ser de la báscula (±2–3 puntos).'));
  }
  // Graficas: desde el primer registro hasta 2 meses adelante
  const from = [recs[0].date].concat(waist.entries.map((e) => e.date)).sort()[0], to = isoAdd(today, 60), range = [from, to];
  const planPts = (fn) => { const out = []; if (!S) return out; for (let d = S.date; d <= to; d = isoAdd(d, 7)) out.push({ date: d, v: fn(bodyPlanAt(d, S)) }); return out; };
  const daily = recs.filter((r) => r.src === 'diaria'), ctls = recs.filter((r) => r.src === 'control');
  const avgPts = (field) => daily.map((e) => ({ date: e.date, v: avg7(daily, field, e.date) })).filter((p) => p.v != null);
  const pa = (fn) => (d) => (S && d >= S.date ? fn(bodyPlanAt(d, S)) : null);
  const alt = body.profile && +body.profile.altura;
  const blocks = [
    ['% de grasa', trendChart({ range: range, today: today, label: 'Porcentaje de grasa', unit: '%', pts: daily.filter((e) => e.grasa != null).map((e) => ({ date: e.date, v: e.grasa })), marks: ctls.filter((c) => c.grasa != null).map((c) => ({ date: c.date, v: c.grasa })), avg: avgPts('grasa'), plan: planPts((p) => p.grasa), goal: goal1, planAt: pa((p) => p.grasa) })],
    ['Grasa (kg)', trendChart({ range: range, today: today, label: 'Kilos de grasa', unit: 'kg', pts: daily.filter((e) => e.fatKg != null).map((e) => ({ date: e.date, v: e.fatKg })), marks: ctls.filter((c) => c.fatKg != null).map((c) => ({ date: c.date, v: c.fatKg })), avg: avgPts('fatKg'), plan: planPts((p) => p.fat), planAt: pa((p) => p.fat) })],
    ['Masa muscular (kg)', trendChart({ range: range, today: today, label: 'Masa muscular', unit: 'kg', pts: daily.filter((e) => e.musculo != null).map((e) => ({ date: e.date, v: e.musculo })), marks: ctls.filter((c) => c.musculo != null).map((c) => ({ date: c.date, v: c.musculo })), avg: avgPts('musculo'),
      plan: S && S.musculo != null ? planPts((p) => S.musculo + (p.lean - (S.kg - S.kg * S.grasa / 100))) : [], planAt: S && S.musculo != null ? pa((p) => S.musculo + (p.lean - (S.kg - S.kg * S.grasa / 100))) : null })],
    ['Peso (kg)', trendChart({ range: range, today: today, label: 'Peso', unit: 'kg', pts: daily.map((e) => ({ date: e.date, v: e.kg })), marks: ctls.map((c) => ({ date: c.date, v: c.kg })), avg: avgPts('kg'), plan: planPts((p) => p.kg), planAt: pa((p) => p.kg) })],
    ['Cintura (cm)', trendChart({ range: range, today: today, label: 'Cintura semanal', unit: 'cm', pts: waistSorted().map((e) => ({ date: e.date, v: e.cm })), avg: [], plan: [], goal: alt ? Math.round(alt / 2) : null })]
  ];
  blocks.forEach((b) => card.append(h('div', { class: 'chart-title' }, b[0]), b[1] || h('p', { class: 'muted small', style: 'margin:4px 0' }, 'Aún sin datos.')));
  card.append(h('div', { class: 'chart-legend muted small' }, h('span', {}, '◯ control mensual (Fitdays)'), h('span', {}, '● báscula diaria'), h('span', {}, '━ promedio 7 días'), h('span', {}, '┅ plan'), h('span', {}, '│ hoy')));
  // Tabla mes a mes desde el inicio del programa: plan contra lo real
  if (S) {
    const tb = h('tbody');
    for (let i = 0; i <= 8; i++) {
      const d = isoAdd(S.date, Math.round(i * MONTH_DAYS)), p = bodyPlanAt(d, S), now = d <= today ? (i === 0 ? { kg: S.kg, grasa: S.grasa } : bodyNow(d)) : null;
      tb.append(h('tr', {}, h('td', {}, i === 0 ? 'Inicio' : 'Mes ' + i, h('div', { class: 'muted small' }, fmtDate(d))),
        h('td', { class: 'num' }, r1(p.kg) + ' kg', h('div', { class: 'muted small' }, r1(p.grasa) + ' % · ' + r1(p.fat) + ' kg grasa')),
        h('td', { class: 'num' }, now && now.kg != null ? r1(now.kg) + ' kg' : '—',
          now && now.grasa != null ? h('div', { class: 'muted small' }, r1(now.grasa) + ' %' + (i ? (now.grasa <= p.grasa + 0.5 ? ' ✓' : ' · atrasado') : '')) : null)));
      if (p.grasa <= goalN + 0.05) break;
    }
    card.append(h('details', { class: 'chart-table' }, h('summary', { class: 'muted small' }, 'Meta de cada mes'),
      h('table', { class: 'sets' }, h('thead', {}, h('tr', {}, h('th', {}, 'Mes'), h('th', { class: 'num' }, 'Plan'), h('th', { class: 'num' }, 'Real'))), tb)));
  }
  // Historial completo de registros, del mas reciente al primero
  const hb = h('tbody');
  recs.slice().reverse().forEach((r) => hb.append(h('tr', {}, h('td', {}, fmtDate(r.date), h('div', { class: 'muted small' }, r.src === 'control' ? 'control mensual' : 'diaria')),
    h('td', { class: 'num' }, r1(r.kg)), h('td', { class: 'num' }, r.grasa != null ? r1(r.grasa) : '—'), h('td', { class: 'num' }, r.fatKg != null ? r1(r.fatKg) : '—'), h('td', { class: 'num' }, r.musculo != null ? r1(r.musculo) : '—'))));
  card.append(h('details', { class: 'chart-table' }, h('summary', { class: 'muted small' }, 'Todos los registros (' + recs.length + ')'),
    h('table', { class: 'sets' }, h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', { class: 'num' }, 'Peso'), h('th', { class: 'num' }, '% grasa'), h('th', { class: 'num' }, 'Grasa kg'), h('th', { class: 'num' }, 'Músculo'))), hb)),
    h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'Es una guía: con menos grasa el ritmo suele bajar. Compara % de grasa dentro de la misma báscula; entre básculas distintas puede haber 2–3 puntos de diferencia.'));
  return card;
}
