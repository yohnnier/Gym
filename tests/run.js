// Pruebas automaticas de Rutinas. Uso (desde la raiz del repo):
//   NODE_PATH=$(npm root -g) node tests/run.js
// Levanta un servidor local, abre la app en Chromium (Playwright) con datos de prueba ficticios
// y revisa lo importante: que todas las pantallas carguen sin errores, la sugerencia de peso,
// el "Siguiente", el gasto y el deficit, la meta de nutricion, la union de sesiones y la edicion del historial.
// Nunca usa datos reales: data/sessions.json y data/nutrition.json se reemplazan por los de tests/fixtures.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const TODAY = '2026-11-01T14:00:00-03:00'; // domingo, hora de Chile

let fails = 0, passes = 0;
function check(name, ok, detail) {
  if (ok) { passes++; console.log('  ✓ ' + name); } else { fails++; console.log('  ✗ ' + name + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}

// Sesiones de prueba de un ejercicio: [fecha, peso, [reps...]]
const EX = 'extension-polea-sobre-cabeza'; // lb, paso 5, 3 x 10-15
function sess(id, date, routineId, exId, weight, reps) {
  return { id: id, date: date, createdAt: Date.parse(date + 'T12:00:00Z'), updatedAt: Date.parse(date + 'T12:00:00Z'), routineId: routineId, source: 'app',
    entries: reps.map((r, i) => ({ exerciseId: exId, set: i + 1, weight: weight, reps: r, rpe: 9 })) };
}

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (u === '/data/sessions.json') f = path.join(__dirname, 'fixtures', 'sessions.json');
    if (u === '/data/nutrition.json') f = path.join(__dirname, 'fixtures', 'nutrition.json');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const BASE = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();

  // Abre la app con un localStorage dado; devuelve la pagina y la lista de errores
  async function open(storage, hash, now) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.clock.setFixedTime(new Date(now || TODAY));
    await page.addInitScript((st) => { Object.keys(st).forEach((k) => localStorage.setItem(k, JSON.stringify(st[k]))); }, storage || {});
    await page.goto(BASE + (hash || '#/'));
    await page.waitForFunction(() => document.querySelector('#app') && document.querySelector('#app').children.length > 0);
    await page.waitForTimeout(300);
    return { page: page, errors: errors, close: () => ctx.close() };
  }
  const BODY = { profile: { edad: 40, sexo: 'h', altura: 175 }, controls: [{ id: 'c1', date: '2026-10-01', peso: 80, grasa: 20, tmb: 1700 }] };
  const WEIGHTS = { entries: [{ date: '2026-10-29', kg: 75 }, { date: '2026-10-30', kg: 76 }, { date: '2026-10-31', kg: 75.5 }] };

  console.log('Pantallas');
  {
    const a = await open({ 'rutinas.body.v1': BODY, 'rutinas.weight.v1': WEIGHTS });
    for (const [hash, tab] of [['#/', 'Hoy'], ['#/entrenar', 'Entrenar'], ['#/prog', 'Progreso'], ['#/salud', 'Salud'], ['#/ajustes', 'Ajustes'],
      ['#/hist', 'Entrenar'], ['#/cardio', 'Entrenar'], ['#/cuerpo', 'Salud'], ['#/examenes', 'Salud'], ['#/g/dia-empuje', 'Entrenar'], ['#/rutina', 'Ajustes']]) {
      await a.page.goto(BASE + hash); await a.page.waitForTimeout(250);
      const active = (await a.page.locator('.tabs button.active').innerText()).trim();
      const n = await a.page.locator('#app > *').count();
      check(hash + ' carga y marca la pestaña ' + tab, n > 0 && active === tab, { n: n, active: active });
    }
    check('sin errores de JavaScript en ninguna pantalla', a.errors.length === 0, a.errors);
    await a.close();
  }

  console.log('Sugerencia de peso (doble progresión)');
  async function planFor(sessions) {
    const a = await open({ 'rutinas.v1': { sessions: sessions, deleted: [] } });
    const p = await a.page.evaluate((id) => { const r = planCore(exById[id], false); return { trend: r.trend, weight: r.weight, reps: r.reps }; }, EX);
    await a.close(); return p;
  }
  let p = await planFor([sess('a', '2026-10-30', 'dia-empuje', EX, 50, [15, 15, 15])]);
  check('15 reps en todas las series → sube 5 lb', p.trend === 'up' && p.weight === 55, p);
  p = await planFor([sess('a', '2026-10-30', 'dia-empuje', EX, 50, [12, 14, 13])]);
  check('dentro del rango → mantiene 50 lb y suma reps', p.trend === 'same' && p.weight === 50, p);
  p = await planFor(['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'].map((d, i) => sess('s' + i, d, 'dia-empuje', EX, 50, [12, 12, 12])));
  check('4 sesiones iguales con el mismo peso → descarga', p.trend === 'deload' && p.weight === 45, p);
  p = await planFor([sess('s0', '2026-10-09', 'dia-empuje', EX, 90, [10, 10, 10])].concat(['2026-10-16', '2026-10-23', '2026-10-30'].map((d, i) => sess('t' + i, d, 'dia-empuje', EX, 50, [12, 12, 12]))));
  check('una marca con otro peso (cambio de máquina) no dispara descarga', p.trend !== 'deload', p);

  console.log('Siguiente día del plan');
  {
    const a = await open({ 'rutinas.v1': { sessions: [sess('e', '2026-10-31', 'dia-empuje', 'press-pecho-maquina', 30, [12, 12, 12])], deleted: [] },
      'rutinas.cardio.v1': { sessions: [{ id: 'b', date: '2026-10-31', tipo: 'Bicicleta', min: 30, libre: true }] } });
    const nx = await a.page.evaluate(() => planNext().id);
    check('después de Empuje (y bici extra) toca Día 2', nx === 'dia-cardio-2', nx);
    await a.close();
  }

  console.log('Calorías, gasto y metas');
  {
    const a = await open({ 'rutinas.body.v1': BODY, 'rutinas.weight.v1': WEIGHTS,
      'rutinas.cardio.v1': { sessions: [{ id: 'i', date: '2026-10-31', tipo: 'Intervalos', min: 30, dia: 'dia-cardio-2' }, { id: 'b', date: '2026-10-31', tipo: 'Bicicleta', min: 30, libre: true }] } });
    const r = await a.page.evaluate(() => ({ kg: curKg(), pesas: daySpend('2026-10-28', 'pesas'), inter: daySpend('2026-10-31', 'intervalos'), pesasConExtra: daySpend('2026-10-31', 'pesas'),
      legs: nutTarget({ kind: 'pesas', legs: true }, '2026-10-28'), extra: nutTarget({ kind: 'intervalos', legs: false }, '2026-10-31') }));
    const near = (x, y) => Math.abs(x - y) < 0.5;
    check('peso actual = promedio de los pesos diarios de 7 días (75,5)', near(r.kg, 75.5), r.kg);
    check('día de pesas = basales × 1,55', near(r.pesas, 1700 * 1.55), r.pesas);
    check('día sin pesas = basales × 1,3 + cardio neto (intervalos y bici)', near(r.inter, 1700 * 1.3 + 7 * 75.5 * 0.5 + 5 * 75.5 * 0.5), r.inter);
    check('en día de pesas solo suma el cardio extra', near(r.pesasConExtra, 1700 * 1.55 + 5 * 75.5 * 0.5), r.pesasConExtra);
    check('piernas: +150 kcal y +37 g de carbohidratos', r.legs.kcal === 2250 && r.legs.carb === 267, r.legs);
    check('cardio extra: la meta sube la mitad de lo quemado (~189 → +90)', r.extra.extra === 90 && r.extra.kcal === 2050 + 90, r.extra);
    await a.close();
  }

  console.log('Unión de sesiones (nube y celular)');
  {
    const a = await open({});
    const r = await a.page.evaluate(() => {
      const base = [{ id: 'x', date: '2026-10-30', routineId: 'dia-empuje', updatedAt: 1, entries: [{ exerciseId: 'press-pecho-maquina', set: 1, weight: 30, reps: 10 }] }];
      const local = [{ id: 'x', date: '2026-10-30', routineId: 'dia-empuje', updatedAt: 2, entries: [{ exerciseId: 'press-pecho-maquina', set: 1, weight: 30, reps: 12 }] }];
      return { newer: mergeSessions(base, local, [])[0].entries[0].reps, deleted: mergeSessions(base, local, ['x']).length };
    });
    check('gana la copia modificada más recientemente', r.newer === 12, r);
    check('una sesión borrada no vuelve', r.deleted === 0, r);
    await a.close();
  }

  console.log('Corregir una sesión pasada');
  {
    const s = sess('h', '2026-10-30', 'dia-empuje', 'press-pecho-maquina', 30, [12, 11, 10]);
    const a = await open({ 'rutinas.v1': { sessions: [s], deleted: [] } }, '#/hist');
    const d = a.page.locator('details.sess').first();
    await d.locator('summary').click();
    await d.getByText('Corregir').click();
    await d.locator('.edit-row').nth(0).locator('input').nth(1).fill('13');
    await d.locator('.edit-row').nth(1).locator('button').click();
    await d.getByText('Guardar cambios').click();
    await a.page.waitForTimeout(200);
    const st = await a.page.evaluate(() => JSON.parse(localStorage.getItem('rutinas.v1')).sessions.find((x) => x.id === 'h'));
    check('cambia las reps, borra la serie y renumera', JSON.stringify(st.entries.map((e) => [e.set, e.reps])) === '[[1,13],[2,10]]', st.entries);
    check('marca la sesión como modificada (para que gane en la nube)', st.updatedAt > s.updatedAt, st.updatedAt);
    check('sin errores al corregir', a.errors.length === 0, a.errors);
    await a.close();
  }

  console.log('Peso y grasa de la báscula diaria');
  {
    const a = await open({ 'rutinas.weight.v1': { entries: [{ date: '2026-10-30', kg: 76, grasa: 24.6 }, { date: '2026-10-31', kg: 75.6, grasa: 24.4 }] } });
    await a.page.fill('input[aria-label="Peso de hoy en kg"]', '75,35');
    await a.page.fill('input[aria-label="Porcentaje de grasa de hoy (opcional)"]', '24,3');
    await a.page.locator('input[aria-label="Peso de hoy en kg"]').locator('xpath=..').locator('button').click();
    await a.page.waitForTimeout(200);
    const w = await a.page.evaluate(() => JSON.parse(localStorage.getItem('rutinas.weight.v1')).entries.find((e) => e.date === '2026-11-01'));
    check('guarda peso y % de grasa del día', w && w.kg === 75.4 && w.grasa === 24.3, w);
    const t = await a.page.locator('#app').innerText();
    check('muestra kg de grasa, sin grasa y el promedio de % de grasa', /18,3 kg de grasa/.test(t) && /57,1 kg sin grasa/.test(t) && /Grasa, promedio de 7 días: 24,4 %/.test(t), t.slice(t.indexOf('Peso'), t.indexOf('Peso') + 400));
    check('sin errores en la tarjeta de peso', a.errors.length === 0, a.errors);
    await a.close();
  }

  console.log('Plan del cuerpo mes a mes');
  {
    // Datos ficticios: parte con 80 kg y 25 % de grasa (20 kg de grasa, 60 sin grasa)
    const entries = [{ date: '2026-11-02', kg: 80, grasa: 25 }, { date: '2026-11-03', kg: 79.8, grasa: 24.9 }, { date: '2026-11-04', kg: 79.9, grasa: 24.8 }, { date: '2026-11-05', kg: 79.6, grasa: 24.8 }];
    const a = await open({ 'rutinas.weight.v1': { entries: entries }, 'rutinas.waist.v1': { entries: [{ date: '2026-11-02', cm: 95 }] }, 'rutinas.body.v1': { profile: { altura: 180 }, controls: [] } }, '#/prog', '2026-11-05T09:00:00-03:00');
    const r = await a.page.evaluate(() => { const s = bodyPlanStart(); const p = bodyPlanAt('2026-12-03', s); return { start: s.date, kg: p.kg, grasa: p.grasa, fat: p.fat, d20: bodyPlanDateFor(20, s) }; });
    check('el plan parte del primer peso con % de grasa', r.start === '2026-11-02', r);
    check('un mes después: −1,6 kg de grasa y −1,2 kg de peso', Math.abs(r.fat - 18.4) < 0.05 && Math.abs(r.kg - 78.8) < 0.05, r);
    check('calcula cuándo llega al 20 %', /^2027-0[1-3]/.test(r.d20), r.d20);
    const t = await a.page.locator('#app').innerText();
    const charts = await a.page.locator('section.card svg.chart').count();
    check('Progreso muestra el plan con 3 gráficas y la tabla mes a mes', /plan mes a mes/.test(t) && /Mes 1/.test(t) && charts >= 3, { charts: charts });
    check('sin errores en el plan del cuerpo', a.errors.length === 0, a.errors);
    await a.close();
  }

  console.log('Copia de seguridad');
  {
    const a = await open({ 'rutinas.weight.v1': WEIGHTS, 'rutinas.waist.v1': { entries: [{ date: '2026-10-30', cm: 90, hip: 98 }] } });
    const keys = await a.page.evaluate(() => Object.keys(exportAll()));
    check('exporta pesas, cuerpo, cardio, peso, abdomen, exámenes, dosis y preferencias',
      ['sessions', 'body', 'cardio', 'weight', 'waist', 'labs', 'dose', 'prefs'].every((k) => keys.indexOf(k) !== -1), keys);
    await a.close();
  }

  await browser.close();
  server.close();
  console.log('\n' + passes + ' pruebas bien, ' + fails + ' con problemas.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
