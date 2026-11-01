/* Rutinas — Guardado en la nube (GitHub) y exportar/importar.
 * Todos los archivos de js/app/ comparten el ámbito global y se cargan en orden (ver index.html). */
'use strict';

// ---------- guardado en la nube (GitHub) ----------
// La app guarda las sesiones en data/sessions.json del repositorio, con una llave de acceso
// (token de GitHub con permiso solo para este repositorio) guardada en este dispositivo.
const GH = { owner: 'yohnnier', repo: 'Gym', branch: 'main', path: 'data/sessions.json' };
const GH_API = 'https://api.github.com/repos/' + GH.owner + '/' + GH.repo;
const TOKEN_KEY = 'rutinas.gh.v1';
let ghToken = null;
try { ghToken = localStorage.getItem(TOKEN_KEY) || null; } catch (e) { /* sin almacenamiento */ }
if (ghToken) priv.status = 'idle';
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
  document.querySelectorAll('.sync-status:not(.priv-status)').forEach((el) => { el.replaceWith(syncBadge()); });
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


// Secciones privadas: como leerlas, escribirlas y saber si estan vacias
const PRIV_SECTIONS = {
  body: { get: () => body, set: (d) => { body = d; try { localStorage.setItem(BODY_KEY, JSON.stringify(body)); } catch (e) { /* */ } }, empty: (d) => !(d.controls || []).length && !Object.keys(d.profile || {}).length },
  cardio: { get: () => cardio, set: (d) => { cardio = d; try { localStorage.setItem(CARDIO_KEY, JSON.stringify(cardio)); } catch (e) { /* */ } }, empty: (d) => !(d.sessions || []).length },
  weight: { get: () => wlog, set: (d) => { wlog = d; try { localStorage.setItem(WEIGHT_KEY, JSON.stringify(wlog)); } catch (e) { /* */ } }, empty: (d) => !(d.entries || []).length },
  waist: { get: () => waist, set: (d) => { waist = d; try { localStorage.setItem(WAIST_KEY, JSON.stringify(waist)); } catch (e) { /* */ } }, empty: (d) => !(d.entries || []).length },
  labs: { get: () => labs, set: (d) => { labs = d; try { localStorage.setItem(LAB_KEY, JSON.stringify(labs)); } catch (e) { /* */ } }, empty: (d) => !(d.records || []).length },
  dose: { get: () => dose, set: (d) => { dose = d && d.proxima ? d : null; try { if (dose) localStorage.setItem(DOSE_KEY, JSON.stringify(dose)); else localStorage.removeItem(DOSE_KEY); } catch (e) { /* */ } }, empty: (d) => !d }
};
function privError(status) {
  const e = new Error(
    status === 401 ? 'la llave no es válida o ya venció'
      : status === 403 || status === 404 ? 'la llave no tiene permiso para el repositorio privado ' + GH_PRIV.repo + ' (o aún no existe)'
      : status === 0 ? 'no hubo respuesta de GitHub (revisa tu conexión a internet)'
      : 'GitHub respondió con un error (' + status + ')');
  e.status = status;
  return e;
}
async function privRead(token) {
  const r = await ghFetch(GH_PRIV_API + '/contents/' + GH_PRIV.path + '?t=' + Date.now(), { headers: ghHeaders(token), cache: 'no-store' });
  if (r.status === 404) {
    const repo = await ghFetch(GH_PRIV_API, { headers: ghHeaders(token), cache: 'no-store' });
    if (repo.ok) return { data: null, sha: null };
    throw privError(repo.status);
  }
  if (!r.ok) throw privError(r.status);
  const j = await r.json();
  let data = null;
  try { data = JSON.parse(b64dec(j.content || '') || 'null'); } catch (e) { data = null; }
  return { data: data, sha: j.sha };
}
async function privWrite(token, obj, sha) {
  const body = { message: 'Datos privados desde la app', content: b64enc(JSON.stringify(obj, null, 1) + '\n') };
  if (sha) body.sha = sha;
  const r = await ghFetch(GH_PRIV_API + '/contents/' + GH_PRIV.path, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) { const e = privError(r.status); e.conflict = true; throw e; }
  if (!r.ok) throw privError(r.status);
}
function setPriv(status, error) {
  priv.status = status;
  if (error != null) priv.error = error;
  document.querySelectorAll('.priv-status').forEach((el) => { el.replaceWith(privBadge()); });
}
function privBadge() {
  let t;
  switch (priv.status) {
    case 'off': t = { cls: 'off', text: '🔒 Datos privados: solo en este dispositivo.' }; break;
    case 'saving': t = { cls: 'wait', text: '🔒 Guardando datos privados…' }; break;
    case 'ok': t = { cls: 'ok', text: '🔒 Datos privados guardados en tu repositorio privado · ' + new Date(priv.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }; break;
    case 'error': t = { cls: 'err', text: '⚠ Datos privados: ' + priv.error + '. Siguen guardados en este dispositivo.' }; break;
    default: t = { cls: 'wait', text: '🔒 Datos privados pendientes de guardar…' };
  }
  return h('div', { class: 'sync-status priv-status ' + t.cls, role: 'status' }, t.text);
}
function schedulePrivSync(delay) {
  if (!ghToken) return;
  if (priv.status !== 'saving') setPriv('pending');
  clearTimeout(priv.timer);
  priv.timer = setTimeout(runPrivSync, delay == null ? 8000 : delay);
}
// Une lo de este dispositivo con lo del repositorio privado: gana la seccion modificada mas recientemente
async function runPrivSync() {
  if (!ghToken) return;
  if (priv.running) { priv.again = true; return; }
  priv.running = true;
  clearTimeout(priv.timer);
  setPriv('saving');
  try {
    for (let attempt = 0; ; attempt++) {
      const remote = await privRead(ghToken);
      const rs = remote.data && remote.data.sections ? remote.data.sections : {};
      const out = Object.assign({}, rs);
      let push = false, pulled = false;
      Object.keys(PRIV_SECTIONS).forEach((n) => {
        const sec = PRIV_SECTIONS[n], local = sec.get(), r = rs[n];
        let lm = privMeta[n] || 0;
        if (!lm && !sec.empty(local)) lm = privMeta[n] = Date.now(); // dato local que aun no se habia subido
        if (r && (r.updatedAt || 0) > lm) { sec.set(r.data); privMeta[n] = r.updatedAt; out[n] = r; pulled = true; return; }
        if (!r && sec.empty(local)) return;
        out[n] = { updatedAt: lm, data: local };
        if (!r || JSON.stringify(r.data) !== JSON.stringify(local)) push = true;
      });
      try { localStorage.setItem(PRIV_META_KEY, JSON.stringify(privMeta)); } catch (e) { /* sin almacenamiento */ }
      if (push) {
        try { await privWrite(ghToken, { v: 1, sections: out }, remote.sha); }
        catch (e) { if (e.conflict && attempt < 2) continue; throw e; }
      }
      priv.at = Date.now();
      setPriv('ok', '');
      if (pulled && !(document.activeElement && document.activeElement.tagName === 'INPUT')) render();
      break;
    }
  } catch (e) {
    setPriv('error', e.message);
    if (e.status === 0 || !e.status || e.status >= 500) priv.timer = setTimeout(runPrivSync, 60000);
  } finally {
    priv.running = false;
    if (priv.again) { priv.again = false; schedulePrivSync(1000); }
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
  runPrivSync();
  render();
}
function disconnectGitHub() {
  if (!confirm('¿Desconectar? Tus registros quedan guardados en la nube y en este dispositivo, pero los nuevos solo se guardarán aquí.')) return;
  ghToken = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* sin almacenamiento */ }
  clearTimeout(sync.timer);
  clearTimeout(priv.timer);
  setSync('off', '');
  setPriv('off', '');
  render();
}

function cloudCard() {
  const card = h('section', { class: 'card cloud' });
  if (ghToken) {
    card.append(
      h('strong', {}, '☁ Conectado a GitHub'),
      h('p', { class: 'muted small' }, 'Cada serie que registras se guarda sola en tu repositorio (' + GH.owner + '/' + GH.repo + '). Puedes abrir la app en otro dispositivo y conectarlo con la misma llave.'),
      syncBadge(), privBadge(),
      h('div', { class: 'row wrap', style: 'margin-top:10px' },
        h('button', { class: 'btn', type: 'button', onclick: () => { runSync(); runPrivSync(); } }, 'Guardar ahora'),
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

// Copia completa: pesas, cuerpo, cardio, peso diario, abdomen, examenes, dosis y preferencias (maquinas, descansos, unidades)
function exportAll() {
  return Object.assign({}, state, { exportedAt: new Date().toISOString(), body: body, cardio: cardio, weight: wlog, waist: waist, labs: labs, dose: dose,
    prefs: { alts: altPref, rest: customRest, units: customUnit } });
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
      if (data.weight && Array.isArray(data.weight.entries)) { wlog = data.weight; saveW(); }
      if (data.waist && Array.isArray(data.waist.entries)) { waist = data.waist; saveWaist(); }
      if (data.labs && Array.isArray(data.labs.records)) { labs = data.labs; saveLabs(); }
      if (data.dose && data.dose.proxima) { dose = data.dose; saveDose(); }
      const pf = data.prefs || {};
      if (pf.alts && typeof pf.alts === 'object') { altPref = pf.alts; saveAlts(); }
      if (pf.rest && typeof pf.rest === 'object') { customRest = pf.rest; saveRest(); }
      if (pf.units && typeof pf.units === 'object') { customUnit = pf.units; saveUnits(); Object.keys(customUnit).forEach((id) => { if (exById[id]) setUnit(id, customUnit[id]); }); }
      save(true); render();
    } catch (e) {
      alert('El archivo no es una exportación válida de esta app.');
    }
  };
  reader.readAsText(file);
}
