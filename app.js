const DATA = { preguntas: [], respuestas: [], referencia: [], resultados: [] };

const ID_FIELDS = ['documento', 'numero_documento', 'número_documento', 'identificacion', 'identificación', 'cedula', 'cédula', 'id', 'codigo'];

const AREA_CONFIG = [
  { key: 'Análisis textual', label: 'Análisis textual', max: 25, ref: 'aciertos_analisis_textual', score: 'puntaje_analisis_textual' },
  { key: 'Matemáticas', label: 'Matemáticas', max: 25, ref: 'aciertos_matematicas', score: 'puntaje_matematicas' },
  { key: 'Ciencias naturales', label: 'Ciencias naturales', max: 25, ref: 'aciertos_ciencias_naturales', score: 'puntaje_ciencias_naturales' },
  { key: 'Ciencias sociales', label: 'Ciencias sociales', max: 25, ref: 'aciertos_ciencias_sociales', score: 'puntaje_ciencias_sociales' },
  { key: 'Análisis de imagen', label: 'Análisis de imagen', max: 20, ref: 'aciertos_analisis_imagen', score: 'puntaje_analisis_imagen' }
];

function getEl(id) { return document.getElementById(id); }
function normalizarId(x) { return String(x ?? '').trim().replace(/\s+/g, '').replace(/[.\-]/g, '').toUpperCase(); }
function getStudentId(row) { for (const field of ID_FIELDS) { if (Object.prototype.hasOwnProperty.call(row, field) && String(row[field] ?? '').trim() !== '') return row[field]; } return ''; }

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && q && n === '"') { cur += '"'; i++; continue; }
    if (c === '"') { q = !q; continue; }
    if (c === ',' && !q) { row.push(cur.trim()); cur = ''; continue; }
    if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && n === '\n') i++;
      row.push(cur.trim()); if (row.some(x => x !== '')) rows.push(row); row = []; cur = ''; continue;
    }
    cur += c;
  }
  row.push(cur.trim()); if (row.some(x => x !== '')) rows.push(row);
  const headers = rows.shift() || [];
  return rows.map(r => Object.fromEntries(headers.map((k, i) => [k.trim(), r[i] ?? ''])));
}

const RAW_BASE = 'https://raw.githubusercontent.com/proyectiapreu/recopilacion2026II/refs/heads/main/';
async function loadCSV(path, required = true) {
  const candidates = [path, RAW_BASE + path]; let lastError = null;
  for (const candidate of candidates) {
    try { const r = await fetch(candidate, { cache: 'no-store' }); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return parseCSV(await r.text()); }
    catch (err) { lastError = err; }
  }
  if (required) throw new Error(`No se pudo cargar ${path}: ${lastError?.message || 'error desconocido'}`);
  return [];
}

function num(x) { if (x === undefined || x === null || x === '') return NaN; return Number(String(x).replace(',', '.')); }
function mean(a) { const vals = a.filter(Number.isFinite); return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : NaN; }
function sd(a) { const vals = a.filter(Number.isFinite); if (vals.length < 2) return NaN; const m = mean(vals); return Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / (vals.length - 1)) || 1; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function fmt(x, d = 2) { return Number.isFinite(x) ? x.toFixed(d) : '—'; }

function stats() {
  const st = {};
  AREA_CONFIG.forEach(area => {
    const vals = DATA.referencia.map(r => num(r[area.ref])).filter(Number.isFinite);
    st[area.key] = { m: mean(vals), s: sd(vals), vals: vals.sort((a,b)=>a-b) };
  });
  const totals = DATA.referencia.map(r => num(r.total_aciertos)).filter(Number.isFinite).sort((a, b) => a - b);
  st.total = { m: mean(totals), s: sd(totals), vals: totals };
  return st;
}

function percentile(vals, x) { if (!vals.length) return null; const c = vals.filter(v => v <= x).length; return Math.round(100 * c / vals.length); }
function nivel(p) { if (!Number.isFinite(p)) return 'resultado en revisión'; if (p >= 700) return 'desempeño excepcional'; if (p >= 600) return 'desempeño alto'; if (p >= 500) return 'desempeño medio-alto'; if (p >= 400) return 'desempeño medio-bajo'; return 'desempeño bajo'; }
function areaScoreFromRaw(raw, areaKey, st) { const s = st[areaKey]; if (s && Number.isFinite(s.m) && Number.isFinite(s.s)) return 10 + ((raw - s.m) / s.s); return 10; }
function globalScoreFromRaw(total, st) { if (Number.isFinite(st.total.m) && Number.isFinite(st.total.s)) return 500 + 100 * ((total - st.total.m) / st.total.s); return 500 + 100 * ((total - 60) / 15); }

function renderTabla(detalle) {
  const filtroEl = getEl('filtroArea'); const areaSeleccionada = filtroEl?.value || 'todas'; const tbody = document.querySelector('#tabla tbody'); if (!tbody) return; tbody.innerHTML = '';
  detalle.filter(d => areaSeleccionada === 'todas' || d.area === areaSeleccionada).forEach(d => {
    tbody.insertAdjacentHTML('beforeend', `<tr><td>${d.n}</td><td>${d.area}</td><td>${d.tema}</td><td>${d.ans || '—'}</td><td><span class="pill ${d.ok ? 'ok' : 'bad'}">${d.ok ? 'Correcta' : 'Incorrecta'}</span></td><td>${d.ok ? '—' : d.corr}</td></tr>`);
  });
}

function buscar() {
  const code = normalizarId(getEl('codigo').value);
  const estado = getEl('estado');
  if (!DATA.preguntas.length || !DATA.respuestas.length) { estado.textContent = 'Los datos todavía no están cargados o falló la carga. Recarga la página.'; return; }
  const row = DATA.respuestas.find(r => normalizarId(getStudentId(r)) === code);
  if (!row) { estado.textContent = 'No encontré ese número de documento. Revisa que sea el mismo que registraste al presentar el simulacro.'; getEl('reporte').classList.add('hidden'); return; }

  const st = stats();
  const accArea = Object.fromEntries(AREA_CONFIG.map(a => [a.key, 0]));
  const errArea = Object.fromEntries(AREA_CONFIG.map(a => [a.key, 0]));
  const errTema = {}, errTipo = {}, errSubNat = {};
  const detalle = []; let total = 0;

  DATA.preguntas.forEach(p => {
    const n = Number(p.pregunta); const area = String(p.area || '').trim();
    const ans = (row['P' + n] || '').trim().toUpperCase();
    const corr = (p.respuesta_correcta || '').trim().toUpperCase();
    const ok = ans === corr;
    if (ok) { total++; accArea[area] = (accArea[area] || 0) + 1; }
    else { errArea[area] = (errArea[area] || 0) + 1; errTema[p.tema || 'Sin tema'] = (errTema[p.tema || 'Sin tema'] || 0) + 1; errTipo[p.tipo || 'Sin tipo'] = (errTipo[p.tipo || 'Sin tipo'] || 0) + 1; if (area === 'Ciencias naturales' && p.subarea) errSubNat[p.subarea] = (errSubNat[p.subarea] || 0) + 1; }
    detalle.push({ n, area, subarea: p.subarea || '', tema: p.tema || 'Sin tema', tipo: p.tipo || 'Sin tipo', ans, corr, ok });
  });

  const punt = globalScoreFromRaw(total, st);
  const pctTotal = percentile(st.total.vals, total);
  getEl('puntajeTotal').textContent = Number.isFinite(punt) ? Math.round(punt) : '—';
  getEl('percentil').textContent = pctTotal !== null ? `Ubicación relativa: por encima del ${pctTotal}% de los resultados de referencia.` : 'Puntaje calculado con escala de referencia.';
  getEl('aciertosTotal').textContent = `${total}/120`;
  getEl('nivelGlobal').textContent = `Nivel estimado: ${nivel(punt)}.`;

  const areaScores = AREA_CONFIG.map(area => {
    const raw = accArea[area.key] || 0;
    const pct = Math.round((raw / area.max) * 100);
    const score = areaScoreFromRaw(raw, area.key, st);
    return { area: area.key, label: area.label, raw, pct, score, errors: errArea[area.key] || 0, max: area.max };
  }).sort((a, b) => a.score - b.score);

  getEl('areaDebil').textContent = areaScores[0].label;
  const areasDiv = getEl('areas'); areasDiv.innerHTML = '';
  AREA_CONFIG.forEach(conf => {
    const a = areaScores.find(x => x.area === conf.key); const width = clamp(a.pct, 3, 100);
    areasDiv.insertAdjacentHTML('beforeend', `<div class="area-row"><div class="area-name">${a.label}<span class="area-meta">${a.raw} de ${a.max} aciertos</span><span class="area-percent">${a.pct}% de acierto</span></div><div class="bar"><span style="width:${width}%"></span></div><div class="area-score"><small>% acierto</small>${a.pct}%</div><div class="area-unalscore"><small>Puntaje área</small>${fmt(a.score,2)}</div></div>`);
  });
  renderNaturalSubareas(detalle, areasDiv);

  const topTemas = Object.entries(errTema).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topTipos = Object.entries(errTipo).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const natSub = Object.entries(errSubNat).sort((a, b) => b[1] - a[1]);
  const mejoras = [`Reforzar primero <b>${areaScores[0].label}</b>, porque tiene el menor puntaje de área.`, ...topTemas.map(([t, n]) => `Tema prioritario: <b>${t}</b> (${n} errores).`), ...topTipos.map(([t, n]) => `Tipo de pregunta recurrente: <b>${t}</b> (${n} errores).`)];
  if (natSub.length) mejoras.push(`En Ciencias naturales, revisar especialmente <b>${natSub[0][0]}</b> (${natSub[0][1]} errores).`);
  getEl('mejoras').innerHTML = mejoras.map(x => `<li>${x}</li>`).join('');
  getEl('diagnostico').innerHTML = `El resultado sugiere ${nivel(punt)}. Tu fortaleza relativa fue <b>${areaScores[areaScores.length - 1].label}</b>. La mejora más rentable es revisar los patrones de error en <b>${areaScores[0].label}</b> y los temas con más errores.`;

  renderTabla(detalle);
  const filtroEl = getEl('filtroArea'); if (filtroEl) { filtroEl.value = 'todas'; filtroEl.onchange = () => renderTabla(detalle); }
  estado.innerHTML = `Reporte generado para<strong>${getStudentId(row)}</strong>.`;
  estado.classList.add('estado-generado'); getEl('reporte').classList.remove('hidden');
}

async function init() {
  const estado = getEl('estado');
  try {
    DATA.preguntas = await loadCSV('data/preguntas.csv');
    DATA.respuestas = await loadCSV('data/respuestas_estudiantes.csv');
    DATA.referencia = await loadCSV('data/referencia.csv', false);
    DATA.resultados = await loadCSV('data/resultados.csv', false);
    estado.textContent = 'Ingresa tu número de documento de identidad para consultar el reporte.';
    console.log('Datos cargados', { preguntas: DATA.preguntas.length, respuestas: DATA.respuestas.length, referencia: DATA.referencia.length });
  } catch (e) { estado.textContent = `No se pudieron cargar los CSV. Revisa la carpeta data/ y las rutas RAW.`; console.error(e); }
  const btn = getEl('buscar'); const input = getEl('codigo');
  if (btn) btn.addEventListener('click', buscar);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
}
document.addEventListener('DOMContentLoaded', init);
