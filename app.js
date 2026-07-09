const DATA = { preguntas: [], respuestas: [], cohorte: [], resultados: [] };

const AREA_CONFIG = [
  { key: 'Temática común', label: 'Lectura / Temática común', aliases: ['Temática común', 'Lectura', 'Lectura Crítica'], max: 40 },
  { key: 'Matemáticas', label: 'Matemáticas', aliases: ['Matemáticas', 'Matematicas'], max: 20 },
  { key: 'Ciencias Naturales', label: 'Ciencias Naturales', aliases: ['Ciencias Naturales', 'Ciencias'], max: 20 },
  { key: 'Sociales y Ciudadanas', label: 'Sociales y Ciudadanas', aliases: ['Sociales y Ciudadanas', 'Sociales'], max: 20 },
  { key: 'Análisis de Imagen', label: 'Análisis de Imagen', aliases: ['Análisis de Imagen', 'Analisis de Imagen', 'Imagen'], max: 20 }
];

function getEl(id) { return document.getElementById(id); }

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && q && n === '"') { cur += '"'; i++; continue; }
    if (c === '"') { q = !q; continue; }
    if (c === ',' && !q) { row.push(cur.trim()); cur = ''; continue; }
    if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && n === '\n') i++;
      row.push(cur.trim());
      if (row.some(x => x !== '')) rows.push(row);
      row = []; cur = '';
      continue;
    }
    cur += c;
  }
  row.push(cur.trim());
  if (row.some(x => x !== '')) rows.push(row);
  const headers = rows.shift();
  return rows.map(r => Object.fromEntries(headers.map((k, i) => [k.trim(), r[i] ?? ''])));
}

const RAW_BASE = 'https://raw.githubusercontent.com/proyectiapreu/recopilacion2026II/refs/heads/main/';

async function loadCSV(path, required = true) {
  const candidates = [path, RAW_BASE + path];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const r = await fetch(candidate, { cache: 'no-store' });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return parseCSV(await r.text());
    } catch (err) {
      lastError = err;
    }
  }
  if (required) throw new Error(`No se pudo cargar ${path}: ${lastError?.message || 'error desconocido'}`);
  return [];
}

function num(x) {
  if (x === undefined || x === null || x === '') return NaN;
  return Number(String(x).replace(',', '.'));
}

function pickNumber(row, aliases) {
  for (const name of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      const v = num(row[name]);
      if (!Number.isNaN(v)) return v;
    }
  }
  return NaN;
}

function mean(a) {
  const vals = a.filter(Number.isFinite);
  if (!vals.length) return NaN;
  return vals.reduce((x, y) => x + y, 0) / vals.length;
}

function sd(a) {
  const vals = a.filter(Number.isFinite);
  if (vals.length < 2) return NaN;
  const m = mean(vals);
  const value = Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / (vals.length - 1));
  return value || 1;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function totalFromCohortRow(row) {
  const direct = pickNumber(row, ['total_aciertos', 'total', 'aciertos_totales']);
  if (Number.isFinite(direct)) return direct;
  const sum = AREA_CONFIG.reduce((s, area) => {
    const v = pickNumber(row, area.aliases);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  return sum || NaN;
}

function stats() {
  const st = {};
  AREA_CONFIG.forEach(area => {
    const vals = DATA.cohorte.map(r => pickNumber(r, area.aliases)).filter(Number.isFinite);
    st[area.key] = { m: mean(vals), s: sd(vals), vals };
  });
  const totals = DATA.cohorte.map(totalFromCohortRow).filter(Number.isFinite).sort((a, b) => a - b);
  st.total = { m: mean(totals), s: sd(totals), vals: totals };
  return st;
}

function percentile(vals, x) {
  if (!vals.length) return null;
  const c = vals.filter(v => v <= x).length;
  return Math.round(100 * c / vals.length);
}

function nivel(p) {
  if (!Number.isFinite(p)) return 'resultado pendiente de cohorte normativa válida';
  if (p >= 700) return 'desempeño excepcional';
  if (p >= 600) return 'desempeño alto';
  if (p >= 500) return 'desempeño medio-alto';
  if (p >= 400) return 'desempeño medio-bajo';
  return 'desempeño bajo';
}

function scaleArea(raw, area, st) {
  const areaStats = st[area.key];
  if (areaStats && Number.isFinite(areaStats.m) && Number.isFinite(areaStats.s)) {
    return 10 + ((raw - areaStats.m) / areaStats.s);
  }
  // Fallback transparente: escala proporcional centrada en 10 si la cohorte no tiene esa columna.
  return 6 + (raw / area.max) * 8;
}

function renderTabla(detalle) {
  const filtroEl = getEl('filtro');
  const f = (filtroEl?.value || '').toLowerCase();
  const tbody = document.querySelector('#tabla tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  detalle
    .filter(d => !f || String(d.n).includes(f) || d.areaLabel.toLowerCase().includes(f) || d.tema.toLowerCase().includes(f) || d.tipo.toLowerCase().includes(f) || (f.includes('incorrect') && !d.ok) || (f.includes('correct') && d.ok))
    .forEach(d => {
      tbody.insertAdjacentHTML('beforeend', `<tr><td>${d.n}</td><td>${d.areaLabel}</td><td>${d.tema}</td><td>${d.ans || '—'}</td><td><span class="pill ${d.ok ? 'ok' : 'bad'}">${d.ok ? 'Correcta' : 'Incorrecta'}</span></td><td>${d.ok ? '—' : d.corr}</td></tr>`);
    });
}

function buscar() {
  const code = getEl('codigo').value.trim().toUpperCase();
  if (!DATA.preguntas.length || !DATA.respuestas.length) {
    getEl('estado').textContent = 'Los datos todavía no están cargados o falló la carga. Espera unos segundos y recarga con Ctrl + F5.';
    return;
  }
  const row = DATA.respuestas.find(r => String(r.codigo || '').trim().toUpperCase() === code);
  const estado = getEl('estado');

  if (!row) {
    estado.textContent = 'No encontré ese código. Revisa mayúsculas, guiones y espacios.';
    getEl('reporte').classList.add('hidden');
    return;
  }

  const st = stats();
  const accArea = Object.fromEntries(AREA_CONFIG.map(a => [a.key, 0]));
  const errArea = Object.fromEntries(AREA_CONFIG.map(a => [a.key, 0]));
  const errTema = {}, errTipo = {};
  const detalle = [];
  let total = 0;

  DATA.preguntas.forEach(p => {
    const n = Number(p.pregunta);
    const area = AREA_CONFIG.find(a => a.aliases.includes(p.area)) || AREA_CONFIG.find(a => a.key === p.area) || AREA_CONFIG[0];
    const ans = (row['P' + n] || '').trim().toUpperCase();
    const corr = (p.respuesta_correcta || '').trim().toUpperCase();
    const ok = ans === corr;
    if (ok) {
      total++;
      accArea[area.key]++;
    } else {
      errArea[area.key]++;
      errTema[p.tema || 'Sin tema'] = (errTema[p.tema || 'Sin tema'] || 0) + 1;
      errTipo[p.tipo || 'Sin tipo'] = (errTipo[p.tipo || 'Sin tipo'] || 0) + 1;
    }
    detalle.push({ n, area: area.key, areaLabel: area.label, tema: p.tema || 'Sin tema', tipo: p.tipo || 'Sin tipo', ans, corr, ok });
  });

  let punt, pct;
  if (Number.isFinite(st.total.m) && Number.isFinite(st.total.s) && st.total.vals.length) {
    const z = (total - st.total.m) / st.total.s;
    punt = Math.round(500 + 100 * z);
    pct = percentile(st.total.vals, total);
    getEl('percentil').textContent = `Por encima del ${pct}% de la cohorte normativa ficticia.`;
  } else {
    punt = Math.round(500 + 100 * ((total - 60) / 15));
    getEl('percentil').textContent = 'Cohorte de referencia no disponible. Puntaje calculado con escala provisional.';
  }

  getEl('puntajeTotal').textContent = Number.isFinite(punt) ? punt : '—';
  getEl('aciertosTotal').textContent = `${total}/120`;
  getEl('nivelGlobal').textContent = `Nivel estimado: ${nivel(punt)}.`;

  const areaScores = AREA_CONFIG.map(area => ({
    area: area.key,
    label: area.label,
    raw: accArea[area.key],
    score: scaleArea(accArea[area.key], area, st),
    errors: errArea[area.key]
  })).sort((a, b) => a.score - b.score);

  getEl('areaDebil').textContent = areaScores[0].label;
  const areasDiv = getEl('areas');
  areasDiv.innerHTML = '';
  areaScores.slice().sort((a, b) => AREA_CONFIG.findIndex(x => x.key === a.area) - AREA_CONFIG.findIndex(x => x.key === b.area)).forEach(a => {
    const width = clamp((a.score - 6) / 8 * 100, 5, 100);
    areasDiv.insertAdjacentHTML('beforeend', `<div class="area-row"><div class="area-name">${a.label}<br><small>${a.raw} aciertos</small></div><div class="bar"><span style="width:${width}%"></span></div><div class="area-score">${a.score.toFixed(1)}</div></div>`);
  });

  const topTemas = Object.entries(errTema).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topTipos = Object.entries(errTipo).sort((a, b) => b[1] - a[1]).slice(0, 3);
  getEl('mejoras').innerHTML = [
    `Reforzar primero <b>${areaScores[0].label}</b>, porque concentra el menor puntaje relativo.`,
    ...topTemas.map(([t, n]) => `Tema prioritario: <b>${t}</b> (${n} errores).`),
    ...topTipos.map(([t, n]) => `Tipo de pregunta recurrente: <b>${t}</b> (${n} errores).`)
  ].map(x => `<li>${x}</li>`).join('');

  getEl('diagnostico').innerHTML = `El resultado sugiere ${nivel(punt)}. Tu fortaleza relativa fue <b>${areaScores[areaScores.length - 1].label}</b>. La mejora más rentable es revisar los patrones de error en <b>${areaScores[0].label}</b> y en los temas que aparecen con mayor frecuencia en la tabla.`;

  renderTabla(detalle);
  const filtroEl = getEl('filtro');
  if (filtroEl) filtroEl.oninput = () => renderTabla(detalle);

  estado.textContent = `Reporte generado para ${code}.`;
  getEl('reporte').classList.remove('hidden');
}

async function init() {
  const estado = getEl('estado');
  try {
    DATA.preguntas = await loadCSV('data/preguntas.csv');
    DATA.respuestas = await loadCSV('data/respuestas_estudiantes.csv');
    DATA.cohorte = await loadCSV('data/cohorte_ficticia.csv');
    DATA.resultados = await loadCSV('data/resultados.csv', false);
    estado.textContent = `Datos cargados: ${DATA.preguntas.length} preguntas, ${DATA.respuestas.length} registros y ${DATA.cohorte.length} casos de cohorte. Escribe un código para consultar el reporte.`;
    console.log('Preguntas:', DATA.preguntas.length, 'Respuestas:', DATA.respuestas.length, 'Cohorte:', DATA.cohorte.length, 'Resultados:', DATA.resultados.length);
    console.log('Columnas preguntas:', DATA.preguntas[0] ? Object.keys(DATA.preguntas[0]) : []);
    console.log('Columnas cohorte:', DATA.cohorte[0] ? Object.keys(DATA.cohorte[0]) : []);
  } catch (e) {
    estado.textContent = `No se pudieron cargar los CSV: ${e.message}. Revisa la carpeta data/ y las rutas RAW.`;
    console.error(e);
  }

  const btn = getEl('buscar');
  const input = getEl('codigo');
  if (btn) btn.addEventListener('click', buscar);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
}

document.addEventListener('DOMContentLoaded', init);
