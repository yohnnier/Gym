/* Rutinas — Navegación, nutrición y pestañas Hoy, Entrenar y Salud.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

// ---------- navegacion ----------
// Pestañas: #/ (Hoy) · #/entrenar · #/prog · #/salud · #/ajustes
// Subpaginas: #/g/<dia> y #/hist y #/cardio (Entrenar) · #/cuerpo y #/examenes (Salud). #/rutina = #/ajustes (enlace antiguo)
const TAB_OF = { group: 'entrenar', hist: 'entrenar', cardio: 'entrenar', cuerpo: 'salud', examenes: 'salud' };
function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  if (p[0] === 'g' && routineById[p[1]]) return { view: 'group', group: routineById[p[1]] };
  if (p[0] === 'rutina') return { view: 'ajustes' };
  if (['entrenar', 'prog', 'salud', 'ajustes', 'hist', 'cuerpo', 'cardio', 'examenes'].indexOf(p[0]) !== -1) return { view: p[0] };
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
  const tab = TAB_OF[r.view] || r.view;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
  if (r.view === 'group') renderGroup(root, r.group);
  else if (r.view === 'prog') renderProg(root);
  else if (r.view === 'cuerpo') renderCuerpo(root);
  else if (r.view === 'cardio') renderCardio(root);
  else if (r.view === 'examenes') renderExamenes(root);
  else if (r.view === 'hist') renderHist(root);
  else if (r.view === 'entrenar') renderEntrenar(root);
  else if (r.view === 'salud') renderSalud(root);
  else if (r.view === 'ajustes') renderRutina(root);
  else renderHome(root);
}

function specText(ex) {
  return (ex.setsText || ex.sets) + ' × ' + ex.repMin + '–' + ex.repMax + (ex.timed ? ' s' : '') + (ex.perLeg ? ' por lado' : '') + ' · descanso ' + (customRest[ex.id] ? restTxt(customRest[ex.id]) : ex.restText);
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
// Tipo de dia: la sesion de pesas registrada ese dia. Si hoy aun no registras, cuenta si marcaste "hoy entreno"
// (con 3-4 dias de pesas por semana, por defecto un dia es sin pesas).
const isLegsDay = (id) => (NUTRITION.legsDays || []).indexOf(id) !== -1;
let trainDays = (function () { try { return JSON.parse(localStorage.getItem(TRAIN_KEY)) || {}; } catch (e) { return {}; } })();
function setTrainToday(v) {
  trainDays = { [todayISO()]: v }; // solo importa el dia de hoy
  try { localStorage.setItem(TRAIN_KEY, JSON.stringify(trainDays)); } catch (e) { /* sin almacenamiento */ }
  render();
}
function dayTypeOf(date) {
  const s = allSessions().filter((x) => x.date === date && x.entries.length && isWeightDay(x.routineId));
  if (s.length) { const legs = s.find((x) => isLegsDay(x.routineId)); const id = legs ? legs.routineId : s[0].routineId; return { kind: 'pesas', legs: !!legs, id: id, from: 'sesión registrada' }; }
  const cs = cardio.sessions.filter((c) => c.date === date && !c.libre);
  if (cs.some((c) => c.dia === NUTRITION.intervalDay)) return { kind: 'intervalos', legs: false, id: NUTRITION.intervalDay, from: 'cardio registrado' };
  if (date === todayISO() && trainDays[date] === true) {
    const nx = planNext();
    return { kind: 'pesas', legs: isLegsDay(nx.id), id: nx.id, from: 'hoy entrenas (' + nx.name.replace(/^Día \d+ · /, '') + ')', ask: true };
  }
  return { kind: 'descanso', legs: false, id: null, from: date === todayISO() ? 'hoy sin pesas' : 'sin sesión de pesas', ask: date === todayISO() };
}
// Calorias netas de una sesion de cardio (por encima del reposo): (MET - 1) x peso actual x horas
function cardioNetKcal(c) {
  const met = (CARDIO_TYPES.find((t) => t[0] === c.tipo) || [0, 5])[1];
  return Math.max(0, (met - 1) * curKg() * (c.min || 0) / 60);
}
// Gasto estimado de un dia (la misma formula que usa Claude en el chat):
// basales x 1,55 en dias de pesas (incluye la sesion) o x 1,3 en los demas, + calorias netas del cardio
// (en dias de pesas solo suma el cardio extra; el del plan ya va en el 1,55)
function daySpend(date, kind, b) {
  b = b || bmrInfo();
  if (!b) return null;
  const cv = cardio.sessions.filter((c) => c.date === date && (kind !== 'pesas' || c.libre)).reduce((k, c) => k + cardioNetKcal(c), 0);
  return b.kcal * (kind === 'pesas' ? 1.55 : 1.3) + cv;
}
function nutTarget(dt, date) {
  const b = NUTRITION.targets[dt.kind];
  const t = { label: b.label, kind: dt.kind, kcal: b.kcal, prot: b.prot, carb: b.carb, extra: 0 };
  if (dt.legs) { t.kcal += NUTRITION.legsExtra.kcal; t.carb += NUTRITION.legsExtra.carb; t.label = 'Día de piernas'; }
  // Cardio libre extra de ese dia: suma la mitad de lo quemado, en carbohidratos
  const extra = Math.round(cardio.sessions.filter((c) => c.date === (date || todayISO()) && c.libre).reduce((s, c) => s + cardioNetKcal(c), 0) * NUTRITION.extraCardioShare / 10) * 10;
  if (extra) { t.extra = extra; t.kcal += extra; t.carb += Math.round(extra / 4); }
  // Ajuste puntual del dia (data/nutrition.json -> "ajustes"): la mitad sale de carbohidratos y el resto de grasa; la proteina no se toca
  const adj = nutAdjust.filter((x) => x.date === (date || todayISO())).reduce((s, x) => s + (+x.kcal || 0), 0);
  if (adj) { t.adj = adj; t.kcal += adj; t.carb = Math.max(0, t.carb + Math.round(adj / 2 / 4)); t.adjWhy = (nutAdjust.find((x) => x.date === (date || todayISO()) && x.motivo) || {}).motivo || ''; }
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
    const adj = d && Array.isArray(d.ajustes) ? d.ajustes : [];
    if (!list || (JSON.stringify(list) === JSON.stringify(nutrition) && JSON.stringify(adj) === JSON.stringify(nutAdjust))) return;
    nutrition = list; nutAdjust = adj; render();
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
    t.extra ? h('p', { class: 'muted small', style: 'margin:2px 0 0' }, '+' + t.extra + ' kcal por tu cardio extra de hoy (en carbohidratos).') : null,
    t.adj ? h('p', { class: 'muted small', style: 'margin:2px 0 0' }, (t.adj > 0 ? '+' : '−') + Math.abs(t.adj) + ' kcal de ajuste de hoy' + (t.adjWhy ? ': ' + t.adjWhy : '') + '.') : null,
    dt.ask ? h('div', { class: 'row', style: 'gap:6px;margin-top:8px;align-items:center' }, h('span', { class: 'small' }, '¿Hoy entrenas pesas?'),
      h('button', { class: 'btn small' + (dt.kind === 'pesas' ? ' primary' : ''), type: 'button', onclick: () => setTrainToday(true) }, 'Sí'),
      h('button', { class: 'btn small' + (dt.kind !== 'pesas' ? ' primary' : ''), type: 'button', onclick: () => setTrainToday(false) }, 'No')) : null);
  if (!d.list.length) {
    card.append(h('p', { class: 'muted small', style: 'margin:6px 0 4px' }, 'Aún no registras comidas hoy. Dímelas en el chat ("desayuno: 3 huevos y un kiwi") y aparecen aquí.'),
      h('p', { class: 'small', style: 'margin:0' }, 'Meta: ' + fmt(t.kcal) + ' kcal · ' + t.prot + ' g proteína · ' + t.carb + ' g carbohidratos · ' + t.fat + ' g grasa'),
      deficitBox(dt, t, 0, today), yesterdayLine());
    return card;
  }
  card.append(nutBar('Calorías', d.tot.kcal, t.kcal, 'kcal'), nutBar('Proteína', d.tot.prot, t.prot, 'g'), nutBar('Carbohidratos', d.tot.carb, t.carb, 'g'), nutBar('Grasa', d.tot.fat, t.fat, 'g'));
  const meals = h('div', { style: 'margin-top:8px' });
  d.list.slice().sort((x, y) => MEALS.indexOf(x.meal) - MEALS.indexOf(y.meal)).forEach((e) => meals.append(h('details', { class: 'ctl' },
    h('summary', {}, h('strong', {}, (e.meal || 'comida').replace(/^./, (c) => c.toUpperCase())), h('span', { class: 'muted small' }, fmt(Math.round(e.kcal || 0)) + ' kcal · ' + fmt(Math.round(e.prot || 0)) + ' g prot')),
    h('div', { class: 'ctl-body' }, (e.items || []).map((it) => h('div', { class: 'ctl-row' }, h('span', {}, it.food + (it.g ? ' · ' + fmt(it.g) + ' g' : '')), h('b', {}, fmt(Math.round(it.kcal || 0)) + ' kcal'))),
      e.notes ? h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Supuestos: ' + e.notes) : null))));
  card.append(meals, deficitBox(dt, t, d.tot.kcal, today), yesterdayLine());
  return card;
}
// Deficit del dia con la formula unica (daySpend): el que tendras si cumples la meta y el de lo comido hasta ahora
const DEF_OK = [300, 550], DEF_MAX = 750;
function deficitBox(dt, t, eaten, date) {
  const sp = daySpend(date, dt.kind);
  if (!sp) return null;
  const plan = round10(sp - t.kcal), now = round10(sp - eaten);
  const row = (label, val, cls) => h('div', { class: 'ctl-row' }, h('span', {}, label), h('b', { class: cls || '' }, fmt(val) + ' kcal'));
  return h('div', { class: 'deficit' },
    row('🔥 Gasto estimado hoy', round10(sp)),
    row('Déficit si cumples la meta', plan),
    eaten ? row('Déficit con lo comido hasta ahora', now) : null,
    h('p', { class: 'muted small', style: 'margin:4px 0 0' }, 'Basales × ' + (dt.kind === 'pesas' ? '1,55 (día de pesas)' : '1,3') + ' + cardio registrado hoy. Lo ideal es ' + DEF_OK[0] + '–' + DEF_OK[1] + ' kcal; más de ' + DEF_MAX + ' arriesga músculo.'));
}
// Cierre de ayer: lo comido y el deficit resultante
function yesterdayLine() {
  const y = isoAdd(todayISO(), -1), d = nutDay(y);
  if (!d.list.length) return null;
  const dt = dayTypeOf(y), sp = daySpend(y, dt.kind);
  const def = sp ? round10(sp - d.tot.kcal) : null;
  return h('p', { class: 'small' + (def != null && def > DEF_MAX ? ' warn-text' : ''), style: 'margin:8px 0 0' },
    'Ayer: ' + fmt(Math.round(d.tot.kcal)) + ' kcal · ' + Math.round(d.tot.prot) + ' g proteína' + (def != null ? ' · déficit ≈ ' + fmt(def) + ' kcal' : '') + (def != null && def > DEF_MAX ? ' (alto)' : ''));
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
      const spend = wk.reduce((s, x) => s + daySpend(x.date, x.t.kind, b), 0) / wk.length;
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

// ---------- Hoy: solo lo del dia ----------
function renderHome(root) {
  const sessions = sortedSessions();
  const last = sessions[0];
  let msg;
  if (!last) msg = 'Empecemos con calma. Elige un día del plan y registra tu primera serie.';
  else if (daysSince(last.date) === 0) msg = 'Hoy ya sumaste. Recuperar también es parte del progreso.';
  else if (daysSince(last.date) > 7) msg = 'Qué bueno verte de nuevo. Retoma con pesos cómodos y ve subiendo.';
  else msg = 'Esto es lo que te toca hoy.';
  root.append(h('section', { class: 'hero' }, h('h2', {}, greeting()), h('p', {}, msg)));

  // Lo que toca: el dia en curso o el siguiente del plan
  const nextDay = planNext(), lastDone = lastDoneByGroup();
  const inCourse = DAYS.find((d) => (d.cardio && !d.exercises.length) ? cardioToday(d).length : todaySession(d.id, false));
  const d = inCourse || nextDay;
  root.append(h('div', { class: 'section-title' }, inCourse ? 'En curso hoy' : 'Te toca'));
  root.append(h('div', { class: 'days' }, dayButton(d, DAYS.indexOf(d), nextDay, lastDone)));
  root.append(h('button', { class: 'btn full free-link', type: 'button', onclick: () => go('#/entrenar') }, 'Ver todo el plan, cardio libre e historial ›'));

  // Avisos cortos (solo cuando corresponde)
  const notes = [];
  if (dose) {
    const dd = doseDays();
    if (dd <= 1) notes.push(h('button', { class: 'card body-link warm', type: 'button', onclick: () => go('#/salud') },
      h('div', {}, h('strong', {}, '💉 ' + (dose.nombre || 'Aplicación') + (dd === 0 ? ' · toca HOY' : dd === 1 ? ' · mañana' : ' · atrasada ' + (-dd) + (dd === -1 ? ' día' : ' días'))),
        h('div', { class: 'muted small' }, 'Márcala en Salud cuando te la pongas')), h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›')));
  }
  const wl = waistSorted(), wlast = wl[wl.length - 1];
  if (!wlast || daysSince(wlast.date) >= WAIST_DAYS) notes.push(h('button', { class: 'card body-link warm', type: 'button', onclick: () => go('#/salud') },
    h('div', {}, h('strong', {}, '📏 Toca medir el abdomen'), h('div', { class: 'muted small' }, wlast ? 'Última: ' + fmt(wlast.cm) + ' cm · ' + agoText(wlast.date) : 'Aún sin medidas')), h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›')));
  notes.forEach((n) => root.append(n));
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


  root.append(h('div', { class: 'section-title' }, 'Nutrición de hoy'), nutritionCard());
  root.append(h('div', { class: 'section-title' }, 'Peso de hoy'), weightCard());
}

// Boton de un dia del plan (portada, estado y "Siguiente")
function dayButton(d, i, nextDay, lastDone) {
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
  return h('button', { class: 'day' + (d === nextDay && !today ? ' next' : ''), type: 'button', onclick: () => go('#/g/' + d.id) },
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
      h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›')));
}

// ---------- Entrenar: el plan completo, cardio libre, grupos sueltos e historial ----------
function renderEntrenar(root) {
  root.append(h('section', { class: 'hero' }, h('h2', {}, 'Entrenar'), h('p', {}, 'Tu ' + PLAN.name.toLowerCase() + '. El marcado como "Siguiente" es el que sigue al último que hiciste.')));
  const nextDay = planNext(), lastDone = lastDoneByGroup();
  root.append(h('div', { class: 'section-title' }, 'Tu ' + PLAN.name.toLowerCase()));
  root.append(h('div', { class: 'days' }, DAYS.map((d, i) => dayButton(d, i, nextDay, lastDone))));
  root.append(h('button', { class: 'btn full free-link', type: 'button', onclick: () => go('#/cardio') },
    freeRun.start || freeRun.acc ? '⏱ Cardio libre en curso · toca para verlo' : '⏱ Cardio libre (opcional): cronómetro, constante o intervalos'));
  root.append(h('div', { class: 'section-title' }, 'Recuperación muscular'), recoveryCard());
  root.append(h('div', { class: 'section-title' }, 'Registros'));
  root.append(linkCard('📅 Historial de pesas', sortedSessions().length + ' sesiones · corrige o borra series pasadas', '#/hist'));
  root.append(linkCard('🏃 Cardio', cardioWeekMinutes() + ' de ' + CARDIO_GOAL + ' min en los últimos 7 días · historial y zonas', '#/cardio'));
  root.append(h('div', { class: 'section-title' }, 'Grupos sueltos'));
  root.append(h('p', { class: 'muted small', style: 'margin:-4px 4px 10px' }, 'Para un día en que quieras entrenar un solo grupo.'));
  root.append(groupsGrid());
}
function linkCard(title, sub, hash) {
  return h('button', { class: 'card body-link', type: 'button', onclick: () => go(hash) },
    h('div', {}, h('strong', {}, title), h('div', { class: 'muted small' }, sub)), h('span', { class: 'day-go', 'aria-hidden': 'true' }, '›'));
}

// ---------- Salud: peso, abdomen, dosis, cuerpo y examenes ----------
function renderSalud(root) {
  root.append(h('section', { class: 'hero' }, h('h2', {}, 'Salud'), h('p', {}, '🔒 Datos privados: se guardan en tu celular y en tu repositorio privado, nunca en el público.')));
  root.append(weightCard(), waistCard(), doseCard());
  const lb = lastBody();
  root.append(linkCard('🧍 Mi cuerpo', lb
    ? 'Último control ' + fmtDate(lb.date) + (lb.peso ? ' · ' + fmt(lb.peso) + ' kg' : '') + (lb.grasa ? ' · ' + fmt(lb.grasa) + ' % grasa' : '') + ' · calorías basales'
    : 'Guarda tus controles de peso y composición corporal', '#/cuerpo'));
  const lbs = labSorted(), ll = lbs[lbs.length - 1];
  root.append(linkCard('🩺 Mis exámenes', ll ? 'Último examen ' + fmtDate(ll.date) + ' · ' + Object.keys(ll.v).length + ' valores' : 'Guarda tus resultados de laboratorio', '#/examenes'));
}

function elapsedText(s) {
  const first = s.entries.length ? (s.startedAt || s.createdAt) : Date.now();
  return 'En sesión: ' + Math.max(0, Math.round((Date.now() - first) / 60000)) + ' min';
}
