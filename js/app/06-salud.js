/* Rutinas — Mi cuerpo, informe de la báscula, cardio, peso diario, abdomen, dosis y exámenes.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

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
    h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/salud') }),
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
const CARDIO_TYPES = [['Caminata rápida', 4.5], ['Caminata inclinada', 9], ['Trote suave', 7], ['Bicicleta', 6], ['Elíptica', 5], ['Intervalos', 8], ['Escaleras', 6.5], ['Salto de cuerda', 11], ['Natación', 6], ['Otro', 5]];
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
    h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/entrenar') }),
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
    h('label', { class: 'full check-row' }, h('input', { name: 'extra', type: 'checkbox' }), ' Es cardio extra (no cuenta como día del plan)'),
    h('button', { class: 'btn primary full', type: 'submit' }, 'Guardar sesión de cardio'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const m = parseNum(form.elements.min.value), date = form.elements.fecha.value;
    if (!m || !date) { toast('Escribe la fecha y los minutos.'); return; }
    const nx = planNext();
    cardio.sessions.push({ id: uid(), date: date, tipo: form.elements.tipo.value, min: Math.round(m), hr: parseNum(form.elements.hr.value), dia: form.elements.extra.checked ? undefined : (form.elements.tipo.value === 'Intervalos' ? 'dia-cardio-2' : (nx && nx.cardio && nx.cardio !== 'intervalos' ? nx.id : undefined)), libre: form.elements.extra.checked || undefined });
    saveCardio(); toast('Cardio guardado en este dispositivo.'); render();
  });
  root.append(h('div', { class: 'section-title' }, 'Nueva sesión'), h('section', { class: 'card' }, form));

  // Historial
  if (cardio.sessions.length) {
    const list = h('section', { class: 'card' });
    cardio.sessions.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).forEach((c) => {
      const kcal = Math.round(cardioNetKcal(c));
      const z = zoneOf(zones, c.hr);
      list.append(h('div', { class: 'ctl-row cardio-row' },
        h('div', {}, h('strong', {}, c.tipo + (c.libre ? ' · extra' : '')), h('div', { class: 'muted small' }, fmtDate(c.date) + ' · ' + c.min + ' min' + (c.hr ? ' · ' + c.hr + ' lpm' : '') + (c.rondas ? ' · ' + c.rondas + ' rondas' : '') + (kcal ? ' · ≈ ' + kcal + ' kcal netas' : '')), detLine(c),
          z != null ? h('span', { class: 'sugg-tag' + (z === 2 ? '' : ' down') }, z === 0 ? 'Bajo la zona 1' : z === 5 ? 'Sobre la zona 4' : 'Zona ' + z) : null),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Eliminar', onclick: () => {
          if (!confirm('¿Eliminar esta sesión de cardio?')) return;
          cardio.sessions = cardio.sessions.filter((x) => x.id !== c.id); saveCardio(); render();
        } }, '×')));
    });
    root.append(h('div', { class: 'section-title' }, 'Tus sesiones'), list);
  }
}




// ---------- peso diario ----------
const wSorted = () => wlog.entries.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
// field = 'kg' (peso) o 'grasa' (% de grasa de la bascula diaria; solo las entradas que lo tienen)
function wAvg(fromDays, toDays, field) { // promedio de las entradas con antiguedad entre toDays (incluido) y fromDays (excluido)
  const f = field || 'kg';
  const v = wlog.entries.filter((e) => { const d = daysSince(e.date); return d >= toDays && d < fromDays && e[f] != null; }).map((e) => e[f]);
  return v.length ? { avg: v.reduce((s, x) => s + x, 0) / v.length, n: v.length } : null;
}
// Peso diario y, opcional, % de grasa de la bascula diaria (la de cada manana). El control completo y mensual
// (Fitdays) va en Mi cuerpo: son basculas distintas y no se mezclan.
function addWeight(date, kg, fat) {
  if (!isoOk(date) || !(kg >= 30 && kg <= 250)) { toast('Escribe un peso entre 30 y 250 kg.'); return false; }
  if (fat != null && !(fat >= 3 && fat <= 60)) { toast('Escribe el % de grasa entre 3 y 60, o déjalo vacío.'); return false; }
  const old = wlog.entries.find((e) => e.date === date);
  const n = { date: date, kg: Math.round(kg * 10) / 10 };
  if (fat != null) n.grasa = Math.round(fat * 10) / 10; else if (old && old.grasa != null) n.grasa = old.grasa;
  wlog.entries = wlog.entries.filter((e) => e.date !== date).concat(n);
  saveW(); return true;
}
const wFatKg = (e) => Math.round(e.kg * e.grasa / 10) / 10; // kg de grasa de una entrada con % de grasa
function importWeights(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { toast('El texto no es válido. Pégalo completo.'); return; }
  const list = Array.isArray(data) ? data : [data];
  let n = 0;
  list.forEach((c) => { if (c && isoOk(c.fecha) && +c.peso >= 30 && +c.peso <= 250) { wlog.entries = wlog.entries.filter((e) => e.date !== c.fecha).concat(Object.assign({ date: c.fecha, kg: Math.round(+c.peso * 10) / 10 }, +c.grasa >= 3 && +c.grasa <= 60 ? { grasa: Math.round(+c.grasa * 10) / 10 } : {})); n++; } });
  if (!n) { toast('No encontré pesos en el texto.'); return; }
  saveW(); toast(n + ' peso' + (n > 1 ? 's' : '') + ' guardado' + (n > 1 ? 's' : '') + '.'); render();
}
function weightCard() {
  const today = todayISO(), mine = wlog.entries.find((e) => e.date === today);
  const inp = h('input', { type: 'text', inputmode: 'decimal', placeholder: mine ? fmt(mine.kg) : 'Peso, ej: 77,2', 'aria-label': 'Peso de hoy en kg' });
  const fatIn = h('input', { type: 'text', inputmode: 'decimal', placeholder: mine && mine.grasa != null ? fmt(mine.grasa) + ' % grasa' : '% grasa (opcional)', 'aria-label': 'Porcentaje de grasa de hoy (opcional)' });
  const card = h('section', { class: 'card dose' },
    h('div', { class: 'row between' }, h('strong', {}, '⚖️ Peso'), h('span', { class: 'muted small' }, mine ? 'Hoy: ' + fmt(mine.kg) + ' kg' + (mine.grasa != null ? ' · ' + fmt(mine.grasa) + ' % grasa' : '') : 'Aún no anotas hoy')),
    h('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, inp,
      h('button', { class: 'btn primary', type: 'button', style: 'white-space:nowrap', onclick: () => {
        const kg = inp.value.trim() ? parseNum(inp.value) : (mine ? mine.kg : NaN);
        if (addWeight(today, kg, fatIn.value.trim() ? parseNum(fatIn.value) : null)) { toast('Peso guardado.'); render(); }
      } }, mine ? 'Cambiar' : 'Guardar')),
    h('div', { class: 'row', style: 'margin-top:6px' }, fatIn));
  if (mine && mine.grasa != null) card.append(h('p', { class: 'small', style: 'margin:8px 0 0' }, 'Hoy: ' + fmt(wFatKg(mine)) + ' kg de grasa · ' + fmt(Math.round((mine.kg - wFatKg(mine)) * 10) / 10) + ' kg sin grasa'));
  const w1 = wAvg(7, 0), w0 = wAvg(14, 7);
  if (w1 && w1.n >= 3) {
    const d = w0 && w0.n >= 3 ? w1.avg - w0.avg : null;
    card.append(h('p', { class: 'small', style: 'margin:8px 0 0' }, 'Promedio de 7 días: ',
      h('b', {}, fmt(Math.round(w1.avg * 10) / 10) + ' kg'),
      d != null ? ' (' + (d > 0 ? '+' : '') + fmt(Math.round(d * 100) / 100) + ' kg vs. la semana anterior)' : ''));
  } else {
    card.append(h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'Pésate a la misma hora, en ayunas. Con 3 o más pesos en la semana te muestro el promedio, que es lo que importa (el peso de un día varía 1–2 kg por agua y comida).'));
  }
  const g1 = wAvg(7, 0, 'grasa'), g0 = wAvg(14, 7, 'grasa');
  if (g1 && g1.n >= 3) {
    const d = g0 && g0.n >= 3 ? g1.avg - g0.avg : null;
    card.append(h('p', { class: 'small', style: 'margin:4px 0 0' }, 'Grasa, promedio de 7 días: ',
      h('b', {}, fmt(Math.round(g1.avg * 10) / 10) + ' %'),
      d != null ? ' (' + (d > 0 ? '+' : '') + fmt(Math.round(d * 10) / 10) + ' puntos vs. la semana anterior)' : ''));
  }
  card.append(h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Báscula diaria: en ayunas, después del baño. El control completo (Fitdays) va una vez al mes en Mi cuerpo; no mezcles las dos básculas.'));
  if (wlog.entries.length) {
    const sorted = wSorted().slice().reverse();
    const ta = h('textarea', { class: 'body-paste', rows: '2', placeholder: '[{"fecha":"2026-10-24","peso":75.9}]', 'aria-label': 'Texto de pesos para importar' });
    const copy = () => { const t = JSON.stringify(wSorted().map((e) => Object.assign({ fecha: e.date, peso: e.kg }, e.grasa != null ? { grasa: e.grasa } : {})), null, 1); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copiado.'), () => toast('No se pudo copiar.')); else toast('Tu navegador no permite copiar.'); };
    card.append(h('details', { class: 'ctl', style: 'margin-top:8px' }, h('summary', {}, h('span', { class: 'muted small' }, 'Historial (' + sorted.length + ')')),
      sorted.slice(0, 30).map((e) => h('div', { class: 'ctl-row' }, h('span', {}, fmtDate(e.date)),
        h('span', {}, h('strong', {}, fmt(e.kg) + ' kg '), e.grasa != null ? h('span', { class: 'muted small' }, fmt(e.grasa) + ' % ') : null, h('button', { class: 'btn small', type: 'button', 'aria-label': 'Borrar', onclick: () => { wlog.entries = wlog.entries.filter((x) => x.date !== e.date); saveW(); render(); } }, '×')))),
      h('div', { class: 'hiit-actions', style: 'margin-top:8px' }, h('button', { class: 'btn small', type: 'button', onclick: copy }, 'Copiar copia de seguridad')),
      ta, h('button', { class: 'btn small', type: 'button', style: 'margin-top:6px', onclick: () => importWeights(ta.value.trim()) }, 'Importar pesos')));
  }
  return card;
}


// ---------- abdomen semanal ----------
const WAIST_DAYS = 7;
const waistSorted = () => waist.entries.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
function importWaist(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { toast('El texto no es válido. Pégalo completo.'); return; }
  const list = Array.isArray(data) ? data : [data];
  let n = 0;
  list.forEach((c) => { if (c && isoOk(c.fecha) && +c.abdomen >= 40 && +c.abdomen <= 200) { waist.entries = waist.entries.filter((e) => e.date !== c.fecha).concat(Object.assign({ date: c.fecha, cm: Math.round(+c.abdomen * 10) / 10 }, +c.cadera >= 50 && +c.cadera <= 200 ? { hip: Math.round(+c.cadera * 10) / 10 } : {})); n++; } });
  if (!n) { toast('No encontré medidas en el texto.'); return; }
  saveWaist(); toast(n + ' medida' + (n > 1 ? 's' : '') + ' guardada' + (n > 1 ? 's' : '') + '.'); render();
}
function waistCard() {
  const list = waistSorted(), last = list[list.length - 1], prev = list[list.length - 2];
  const due = !last || daysSince(last.date) >= WAIST_DAYS;
  const dateIn = h('input', { type: 'date', value: todayISO(), max: todayISO(), 'aria-label': 'Fecha de la medida' });
  const inp = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Abdomen, ej: 84,5', 'aria-label': 'Abdomen en cm' });
  const hipIn = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Cadera (opcional)', 'aria-label': 'Cadera en cm (opcional)' });
  const lastHip = list.slice().reverse().find((e) => e.hip);
  const card = h('section', { class: 'card dose' + (due ? ' warm' : '') },
    h('div', { class: 'row between' }, h('strong', {}, '📏 Abdomen (semanal)'),
      h('span', { class: 'muted small' }, last ? 'Última: ' + fmt(last.cm) + ' cm · ' + agoText(last.date) : 'Aún sin medidas')));
  if (lastHip) card.append(h('p', { class: 'muted small', style: 'margin:2px 0 0' }, 'Cadera ' + fmt(lastHip.hip) + ' cm (' + fmtDate(lastHip.date) + ') · cintura/cadera ' + fmt(Math.round(lastHip.cm / lastHip.hip * 100) / 100) + ' (meta: menos de 0,90)'));
  if (due) card.append(h('p', { class: 'small', style: 'margin:4px 0 0' }, last ? 'Toca medirte esta semana.' : 'Anota tu primera medida.',
    ' Pasa la huincha por el ombligo, en ayunas y al final de una exhalación normal, sin apretar ni meter el abdomen.'));
  card.append(h('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, inp,
    h('button', { class: 'btn primary', type: 'button', style: 'white-space:nowrap', onclick: () => {
      const v = parseNum(inp.value), d = dateIn.value, hp = hipIn.value.trim() ? parseNum(hipIn.value) : null;
      if (!isoOk(d) || !(v >= 40 && v <= 200)) { toast('Escribe el abdomen en cm (entre 40 y 200).'); return; }
      if (hp != null && !(hp >= 50 && hp <= 200)) { toast('Escribe la cadera en cm (entre 50 y 200), o déjala vacía.'); return; }
      const old = waist.entries.find((e) => e.date === d);
      const n = { date: d, cm: Math.round(v * 10) / 10 };
      if (hp != null) n.hip = Math.round(hp * 10) / 10; else if (old && old.hip) n.hip = old.hip;
      waist.entries = waist.entries.filter((e) => e.date !== d).concat(n);
      saveWaist(); toast('Medida guardada.'); render();
    } }, 'Guardar')));
  card.append(h('div', { class: 'row', style: 'gap:8px;margin-top:6px;align-items:center' }, h('span', { class: 'muted small' }, 'Fecha'), dateIn),
    h('div', { class: 'row', style: 'margin-top:6px' }, hipIn));
  if (last && prev) {
    const d = Math.round((last.cm - prev.cm) * 10) / 10, tot = Math.round((last.cm - list[0].cm) * 10) / 10;
    card.append(h('p', { class: 'small', style: 'margin:8px 0 0' }, (d > 0 ? '+' : '') + fmt(d) + ' cm vs. la medida anterior (' + fmtDate(prev.date) + ')' +
      (list.length > 2 ? ' · ' + (tot > 0 ? '+' : '') + fmt(tot) + ' cm desde el inicio (' + fmtDate(list[0].date) + ')' : '')));
  }
  if (list.length) {
    const ta = h('textarea', { class: 'body-paste', rows: '2', placeholder: '[{"fecha":"2026-10-25","abdomen":84.5}]', 'aria-label': 'Texto de medidas para importar' });
    const copy = () => { const t = JSON.stringify(list.map((e) => Object.assign({ fecha: e.date, abdomen: e.cm }, e.hip ? { cadera: e.hip } : {})), null, 1); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copiado.'), () => toast('No se pudo copiar.')); else toast('Tu navegador no permite copiar.'); };
    card.append(h('details', { class: 'ctl', style: 'margin-top:8px' }, h('summary', {}, h('span', { class: 'muted small' }, 'Historial (' + list.length + ')')),
      list.slice().reverse().map((e) => h('div', { class: 'ctl-row' }, h('span', {}, fmtDate(e.date)),
        h('span', {}, h('strong', {}, fmt(e.cm) + ' cm '), e.hip ? h('span', { class: 'muted small' }, 'cadera ' + fmt(e.hip) + ' · ICC ' + fmt(Math.round(e.cm / e.hip * 100) / 100) + ' ') : null, h('button', { class: 'btn small', type: 'button', 'aria-label': 'Borrar', onclick: () => { waist.entries = waist.entries.filter((x) => x.date !== e.date); saveWaist(); render(); } }, '×')))),
      h('div', { class: 'hiit-actions', style: 'margin-top:8px' }, h('button', { class: 'btn small', type: 'button', onclick: copy }, 'Copiar copia de seguridad')),
      ta, h('button', { class: 'btn small', type: 'button', style: 'margin-top:6px', onclick: () => importWaist(ta.value.trim()) }, 'Importar medidas')));
  }
  return card;
}

// ---------- recordatorio de aplicacion ----------
const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
function doseDays() { return Math.round((isoToDate(dose.proxima) - isoToDate(todayISO())) / DAY); }
function doseIcs() {
  const nombre = (dose.nombre || 'Aplicación').replace(/[\r\n,;]/g, ' ');
  const d = dose.proxima.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarm = (trig, txt) => ['BEGIN:VALARM', 'TRIGGER:' + trig, 'ACTION:DISPLAY', 'DESCRIPTION:' + txt, 'END:VALARM'];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rutinas//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    'UID:aplicacion-' + d + '@rutinas', 'DTSTAMP:' + now, 'DTSTART:' + d + 'T090000', 'DTEND:' + d + 'T091500',
    'SUMMARY:💉 ' + nombre + ': toca la aplicación',
    'DESCRIPTION:Confírmala en la app Rutinas cuando te la pongas. Si se corre\\, cambia la fecha en la app.']
    .concat(alarm('-P1D', 'Mañana toca la aplicación'), alarm('PT0S', 'Hoy toca la aplicación'), ['END:VEVENT', 'END:VCALENDAR']).join('\r\n');
}
function doseCard() {
  const mk = (cls) => h('section', { class: 'card ' + (cls || '') });
  if (!dose) {
    const nom = h('input', { type: 'text', placeholder: 'Ej: Sostenón', 'aria-label': 'Nombre' });
    const ult = h('input', { type: 'date', 'aria-label': 'Última aplicación', max: todayISO() });
    const inter = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '90', placeholder: 'Ej: 10', 'aria-label': 'Cada cuántos días' });
    return h('section', { class: 'card dose' },
      h('strong', {}, '💉 Recordatorio de aplicación'),
      h('p', { class: 'muted small', style: 'margin:4px 0 10px' }, '🔒 Se guarda solo en este celular. Anota tu última aplicación y cada cuántos días te toca: la app calcula la próxima y te avisa aquí.'),
      h('label', { class: 'small muted' }, 'Nombre (solo para ti)'), nom,
      h('label', { class: 'small muted' }, 'Última aplicación'), ult,
      h('label', { class: 'small muted' }, 'Cada cuántos días'), inter,
      h('button', { class: 'btn primary', type: 'button', style: 'margin-top:10px', onclick: () => {
        const n = Math.round(parseNum(inter.value) || 0);
        if (!isoOk(ult.value) || n < 1 || n > 90) { toast('Pon la fecha de tu última aplicación y los días entre dosis (1 a 90).'); return; }
        dose = { nombre: nom.value.trim().slice(0, 40), intervalo: n, proxima: isoAdd(ult.value, n), ultima: ult.value, aplicadas: [ult.value] };
        saveDose(); toast('Listo. Próxima aplicación: ' + fmtDate(dose.proxima) + '.'); render();
      } }, 'Guardar recordatorio'));
  }
  const d = doseDays();
  const due = d <= 0;
  const title = d > 1 ? 'en ' + d + ' días' : d === 1 ? 'mañana' : d === 0 ? 'HOY' : 'atrasada ' + (-d) + (d === -1 ? ' día' : ' días');
  const card = h('section', { class: 'card dose' + (d <= 1 ? ' warm' : '') });
  card.append(h('strong', {}, '💉 ' + (dose.nombre || 'Aplicación') + ' · ' + (d === 0 ? 'toca HOY' : d < 0 ? title : 'próxima ' + title)),
    h('p', { class: 'small', style: 'margin:4px 0 10px' },
      'Próxima: ' + longDay(dose.proxima) + ' (' + fmtDate(dose.proxima) + ')' + (dose.ultima ? ' · última: ' + fmtDate(dose.ultima) : '') + ' · cada ' + dose.intervalo + ' días.' +
      (d === 0 ? ' Hoy te toca: confírmala cuando te la pongas.' : d < 0 ? ' Se pasó la fecha: si ya te la pusiste, márcala; si se corrió, cambia la fecha.' : '')));
  const panel = h('div', { style: 'margin-top:10px' });
  const dateIn = h('input', { type: 'date', value: todayISO(), max: todayISO(), 'aria-label': 'Fecha de aplicación' });
  const moveIn = h('input', { type: 'date', value: dose.proxima, min: todayISO(), 'aria-label': 'Nueva fecha' });
  const open = (kind) => {
    panel.replaceChildren();
    if (kind === 'done') {
      panel.append(h('label', { class: 'small muted' }, '¿Qué día te la pusiste?'), dateIn,
        h('button', { class: 'btn primary', type: 'button', style: 'margin-top:8px', onclick: () => {
          if (!isoOk(dateIn.value)) { toast('Elige la fecha.'); return; }
          dose.ultima = dateIn.value; dose.aplicadas = (dose.aplicadas || []).filter((x) => x !== dateIn.value).concat(dateIn.value).sort();
          dose.proxima = isoAdd(dateIn.value, dose.intervalo); saveDose();
          toast('Anotada. Próxima: ' + fmtDate(dose.proxima) + '.'); render();
        } }, 'Guardar y calcular la próxima'));
    } else if (kind === 'move') {
      panel.append(h('label', { class: 'small muted' }, 'Nueva fecha de la próxima aplicación'), moveIn,
        h('button', { class: 'btn primary', type: 'button', style: 'margin-top:8px', onclick: () => {
          if (!isoOk(moveIn.value)) { toast('Elige la fecha.'); return; }
          dose.proxima = moveIn.value; saveDose(); toast('Fecha cambiada: ' + fmtDate(dose.proxima) + '.'); render();
        } }, 'Cambiar fecha'));
    } else if (kind === 'cfg') {
      const nom = h('input', { type: 'text', value: dose.nombre || '', 'aria-label': 'Nombre' });
      const inter = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '90', value: String(dose.intervalo), 'aria-label': 'Cada cuántos días' });
      panel.append(h('label', { class: 'small muted' }, 'Nombre'), nom, h('label', { class: 'small muted' }, 'Cada cuántos días'), inter,
        h('div', { class: 'row wrap', style: 'margin-top:8px' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            const n = Math.round(parseNum(inter.value) || 0);
            if (n < 1 || n > 90) { toast('Pon entre 1 y 90 días.'); return; }
            dose.nombre = nom.value.trim().slice(0, 40);
            if (n !== dose.intervalo && dose.ultima) dose.proxima = isoAdd(dose.ultima, n);
            dose.intervalo = n; saveDose(); toast('Guardado.'); render();
          } }, 'Guardar'),
          h('button', { class: 'btn', type: 'button', onclick: () => { if (confirm('¿Borrar el recordatorio de este dispositivo?')) { dose = null; try { localStorage.removeItem(DOSE_KEY); } catch (e) { /* sin almacenamiento */ } render(); } } }, 'Borrar recordatorio')));
    }
  };
  card.append(h('div', { class: 'row wrap' },
    h('button', { class: 'btn primary small', type: 'button', onclick: () => open('done') }, due ? '✅ Ya me la puse' : '✅ Ya me la puse'),
    h('button', { class: 'btn small', type: 'button', onclick: () => open('move') }, '📆 Cambiar fecha'),
    h('button', { class: 'btn small', type: 'button', onclick: () => download('proxima-aplicacion.ics', doseIcs(), 'text/calendar') }, '📅 Al calendario'),
    h('button', { class: 'btn small', type: 'button', 'aria-label': 'Ajustes', onclick: () => open('cfg') }, '⚙️')),
    panel);
  return card;
}
function longDay(iso) { return isoToDate(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }); }

// ---------- mis examenes (laboratorio) ----------
// [clave, nombre, unidad, minimo, maximo, decimales]. Los rangos son los del laboratorio RedSalud; un maximo/minimo null = sin limite.
const LAB_FIELDS = [
  ['testo', 'Testosterona total', 'nmol/L', 4.6, 28.2], ['testoLibre', 'Testosterona libre', 'pg/mL', 9.57, 40.6],
  ['estradiol', 'Estradiol', 'pg/mL', null, null], ['shbg', 'SHBG', 'nmol/L', null, null], ['psa', 'PSA', 'ng/mL', 0, 4],
  ['hto', 'Hematocrito', '%', 40, 54], ['hb', 'Hemoglobina', 'g/dL', 13.5, 17], ['rbc', 'Glóbulos rojos', 'x10⁶/µL', 4.9, 5.7],
  ['leucos', 'Leucocitos', 'x10³/µL', 4, 10], ['plaquetas', 'Plaquetas', 'x10³/µL', 150, 400], ['vhs', 'VHS', 'mm/h', 0, 13],
  ['colTotal', 'Colesterol total', 'mg/dL', null, 200], ['ldl', 'LDL', 'mg/dL', null, 130], ['hdl', 'HDL', 'mg/dL', 40, 60], ['tg', 'Triglicéridos', 'mg/dL', 0, 150],
  ['glicemia', 'Glicemia', 'mg/dL', 74, 99], ['insulina', 'Insulina', 'uUI/mL', 3, 29.1], ['homa', 'HOMA', '', null, 2.5], ['hba1c', 'Hb glicosilada', '%', null, 5.7],
  ['got', 'GOT', 'U/L', 17, 59], ['gpt', 'GPT', 'U/L', 21, 72], ['bilirrubina', 'Bilirrubina total', 'mg/dL', 0.2, 1.3], ['pcr', 'PCR', 'mg/L', 0, 10],
  ['vitD', 'Vitamina D', 'ng/mL', 20, 100], ['b12', 'Vitamina B12', 'pg/mL', 239, 931], ['tsh', 'TSH', 'mIU/L', 0.4, 4.05], ['t4l', 'T4 libre', 'ng/dL', 0.78, 2.19]
];
const labSorted = () => labs.records.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
function importLabs(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { toast('El texto no es válido. Pégalo completo.'); return; }
  const list = Array.isArray(data) ? data : [data];
  let added = 0;
  list.forEach((c) => {
    if (!c || !c.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) return;
    const rec = { id: uid(), date: c.fecha, v: {} };
    LAB_FIELDS.forEach((f) => { if (c[f[0]] != null && !isNaN(+c[f[0]])) rec.v[f[0]] = +c[f[0]]; });
    if (c.nota) rec.nota = String(c.nota).slice(0, 400);
    labs.records = labs.records.filter((x) => x.date !== rec.date); // un registro por fecha
    labs.records.push(rec); added++;
  });
  if (!added) { toast('No encontré exámenes en el texto.'); return; }
  saveLabs(); toast(added + ' examen' + (added > 1 ? 'es' : '') + ' guardado' + (added > 1 ? 's' : '') + ' en este dispositivo.'); render();
}
function labState(f, v) {
  if (v == null) return null;
  if (f[3] != null && v < f[3]) return 'bajo';
  if (f[4] != null && v > f[4]) return 'alto';
  return f[3] == null && f[4] == null ? null : 'ok';
}
function renderExamenes(root) {
  root.append(h('div', { class: 'group-head' },
    h('button', { class: 'back', type: 'button', 'aria-label': 'Volver', onclick: () => go('#/salud') }),
    h('div', { class: 'grow' }, h('h2', {}, 'Mis exámenes'), h('div', { class: 'muted small' }, 'Resultados de laboratorio y su evolución'))));
  $('.back', root).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  root.append(h('div', { class: 'card soft' }, h('p', { class: 'small', style: 'margin:0' }, '🔒 Estos datos se guardan solo en este dispositivo. No se suben a GitHub ni forman parte del repositorio público. Son informativos: tu médico es quien los interpreta.')));

  const recs = labSorted();
  if (!recs.length) {
    root.append(h('section', { class: 'card', style: 'border-color:var(--warm)' },
      h('strong', {}, 'Aún no hay exámenes guardados aquí'),
      h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Pega el texto que te dé el asistente en "Importar exámenes", más abajo. Se guardan solo en el navegador de este celular.')));
  } else {
    const last = recs[recs.length - 1], prev = recs[recs.length - 2];
    const tbl = h('table', { class: 'lab-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Examen'), h('th', {}, prev ? fmtDate(prev.date) : ''), h('th', {}, fmtDate(last.date)), h('th', {}, 'Rango'))));
    const tb = h('tbody', {});
    LAB_FIELDS.forEach((f) => {
      const v = last.v[f[0]], p = prev ? prev.v[f[0]] : null;
      if (v == null && p == null) return;
      const st = labState(f, v);
      const rng = f[3] != null && f[4] != null ? f[3] + '–' + f[4] : f[4] != null ? '≤ ' + f[4] : f[3] != null ? '≥ ' + f[3] : '—';
      tb.append(h('tr', {},
        h('td', {}, f[1], f[2] ? h('div', { class: 'muted small' }, f[2]) : null),
        h('td', { class: 'muted' }, p != null ? fmt(p) : '—'),
        h('td', { class: 'lab-val' + (st === 'alto' || st === 'bajo' ? ' out' : '') }, v != null ? fmt(v) : '—', st === 'alto' ? ' ▲' : st === 'bajo' ? ' ▼' : ''),
        h('td', { class: 'muted small' }, rng)));
    });
    tbl.append(tb);
    root.append(h('div', { class: 'section-title' }, prev ? 'Último examen vs. anterior' : 'Último examen'),
      h('section', { class: 'card' }, tbl,
        h('p', { class: 'muted small', style: 'margin:8px 0 0' }, '▲ sobre el rango del laboratorio · ▼ bajo el rango. Los rangos son los del laboratorio y no siempre son la meta ideal para ti.')));
    if (last.nota) root.append(h('section', { class: 'card soft' }, h('div', { class: 'muted small' }, 'Nota del ' + fmtDate(last.date)), h('p', { class: 'small', style: 'margin:4px 0 0' }, last.nota)));

    const list = h('section', { class: 'card' });
    recs.slice().reverse().forEach((c) => {
      const det = h('div', {});
      LAB_FIELDS.forEach((f) => { if (c.v[f[0]] != null) det.append(h('div', { class: 'ctl-row' }, h('span', {}, f[1]), h('strong', {}, fmt(c.v[f[0]]) + ' ' + f[2]))); });
      if (c.nota) det.append(h('p', { class: 'muted small' }, c.nota));
      det.append(h('button', { class: 'btn small', type: 'button', style: 'margin-top:8px', onclick: () => {
        if (!confirm('¿Borrar el examen del ' + fmtDate(c.date) + ' de este dispositivo?')) return;
        labs.records = labs.records.filter((x) => x.id !== c.id); saveLabs(); render();
      } }, 'Borrar este examen'));
      list.append(h('details', { class: 'ctl' }, h('summary', {}, h('strong', {}, fmtDate(c.date)), h('span', { class: 'muted small' }, Object.keys(c.v).length + ' valores')), det));
    });
    root.append(h('div', { class: 'section-title' }, 'Historial'), list);
  }

  const ta = h('textarea', { class: 'body-paste', rows: '3', placeholder: '{"fecha":"2026-10-22","testo":57.2,…}', 'aria-label': 'Texto de exámenes para importar' });
  root.append(h('div', { class: 'section-title' }, 'Importar exámenes'),
    h('section', { class: 'card' },
      h('p', { class: 'muted small', style: 'margin-top:0' }, 'Pega aquí el texto que te dé el asistente. Si pegas un examen con una fecha que ya existe, lo reemplaza.'),
      ta, h('button', { class: 'btn', type: 'button', style: 'margin-top:8px', onclick: () => { importLabs(ta.value.trim()); } }, 'Importar')));
  if (recs.length) {
    const backup = () => JSON.stringify(recs.map((c) => Object.assign({ fecha: c.date }, c.v, c.nota ? { nota: c.nota } : {})), null, 1);
    root.append(h('div', { class: 'section-title' }, 'Copia de seguridad'),
      h('section', { class: 'card' },
        h('p', { class: 'muted small', style: 'margin:0 0 8px' }, 'Guarda una copia por si cambias de celular o borras los datos del navegador. Para recuperarla, pega el texto en "Importar exámenes".'),
        h('div', { class: 'hiit-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const t = backup();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copiado. Pégalo en un lugar seguro.'), () => toast('No se pudo copiar.'));
            else toast('Tu navegador no permite copiar. Usa Descargar.');
          } }, 'Copiar texto'),
          h('button', { class: 'btn', type: 'button', onclick: () => download('mis-examenes.json', backup(), 'application/json') }, 'Descargar'))));
  }
}
