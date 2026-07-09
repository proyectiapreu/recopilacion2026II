const DATA = { preguntas: [], respuestas: [], cohorte: [], resultados: [] };

const ID_FIELDS = ['documento', 'numero_documento', 'número_documento', 'identificacion', 'identificación', 'cedula', 'cédula', 'id', 'codigo'];

const AREA_CONFIG = [
  { key: 'Análisis textual', label: 'Análisis textual', aliases: ['Análisis textual', 'Analisis textual', 'TC · Análisis textual', 'Temática común', 'Lectura', 'Lectura Crítica'], max: 25, cohort: ['analisis_textual', 'Análisis textual', 'Analisis textual'] },
  { key: 'Matemáticas', label: 'Matemáticas', aliases: ['Matemáticas', 'Matematicas', 'TC · Matemáticas'], max: 25, cohort: ['matematicas', 'Matemáticas', 'Matematicas'] },
  { key: 'Ciencias naturales', label: 'Ciencias naturales', aliases: ['Ciencias naturales', 'Ciencias Naturales', 'Ciencias', 'TC · Ciencias naturales'], max: 25, cohort: ['ciencias_naturales', 'Ciencias naturales', 'Ciencias Naturales', 'Ciencias'] },
  { key: 'Ciencias sociales', label: 'Ciencias sociales', aliases: ['Ciencias sociales', 'Ciencias Sociales', 'Sociales y Ciudadanas', 'Sociales', 'TC · Ciencias sociales'], max: 25, cohort: ['ciencias_sociales', 'Ciencias sociales', 'Ciencias Sociales', 'Sociales y Ciudadanas', 'Sociales'] },
  { key: 'Análisis de imagen', label: 'Análisis de imagen', aliases: ['Análisis de imagen', 'Analisis de imagen', 'Análisis de Imagen', 'Analisis de Imagen', 'Imagen'], max: 20, cohort: ['analisis_imagen', 'Análisis de imagen', 'Analisis de imagen', 'Análisis de Imagen', 'Imagen'] }
];

function getEl(id) { return document.getElementById(id); }

function normalizarId(x) {
  return String(x ?? '').trim().replace(/\s+/g, '').replace(/[.\-]/g, '').toUpperCase();
}

function getStudentId(row) {
  for (const field of ID_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, field) && String(row[field] ?? '').trim() !== '') return row[field];
  }
  return '';
}

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

function resolveArea(areaName) {
  const raw = String(areaName || '').trim();
  return AREA_CONFIG.find(a => a.key === raw)
    || AREA_CONFIG.find(a => a.aliases.includes(raw))
    || AREA_CONFIG.find(a => raw.toLowerCase().includes(a.key.toLowerCase()))
    || AREA_CONFIG[0];
}

function totalFromCohortRow(row) {
  const direct = pickNumber(row, ['total_aciertos', 'total', 'aciertos_totales']);
  if (Number.isFinite(direct)) return direct;
  const sum = AREA_CONFIG.reduce((s, area) => {
    const v = pickNumber(row, area.cohort || area.aliases);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  return sum || NaN;
}

function stats() {
  const st = {};
  AREA_CONFIG.forEach(area => {
    const vals = DATA.cohorte.map(r => pickNumber(r, area.cohort || area.aliases)).filter(Number.isFinite);
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
  if (!Number.isFinite(p)) return 'resultado en revisión';
  if (p >= 700) return 'desempeño excepcional';
  if (p >= 600) return 'desempeño alto';
  if (p >= 500) return 'desempeño medio-alto';
  if (p >= 400) return 'desempeño medio-bajo';
  return 'desempeño bajo';
}

function puntajeDesdeTotal(total, st) {
  if (Number.isFinite(st.total.m) && Number.isFinite(st.total.s) && st.total.vals.length) {
    return Math.round(500 + 100 * ((total - st.total.m) / st.total.s));
  }
  return Math.round(500 + 100 * ((total - 60) / 15));
}

function renderTabla(detalle) {
  const filtroEl = getEl('filtroArea');
  const areaSeleccionada = filtroEl?.value || 'todas';
  const tbody = document.querySelector('#tabla tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  detalle
    .filter(d => areaSeleccionada === 'todas' || d.area === areaSeleccionada)
    .forEach(d => {
      tbody.insertAdjacentHTML('beforeend', `<tr><td>${d.n}</td><td>${d.areaLabel}</td><td>${d.tema}</td><td>${d.ans || '—'}</td><td><span class="pill ${d.ok ? 'ok' : 'bad'}">${d.ok ? 'Correcta' : 'Incorrecta'}</span></td><td>${d.ok ? '—' : d.corr}</td></tr>`);
    });
}

function renderNaturalSubareas(detalle, contenedor) {
  const erroresNat = detalle.filter(d => d.area === 'Ciencias naturales' && !d.ok && d.subarea);
  const totalesNat = detalle.filter(d => d.area === 'Ciencias naturales' && d.subarea);
  const subareas = ['Física', 'Química', 'Biología'];
  const html = subareas.map(sa => {
    const total = totalesNat.filter(d => d.subarea === sa).length;
    const errores = erroresNat.filter(d => d.subarea === sa).length;
    if (!total) return '';
    const aciertos = total - errores;
    const pct = Math.round((aciertos / total) * 100);
    return `<span class="subarea-chip">${sa}: ${aciertos}/${total} (${pct}%)</span>`;
  }).filter(Boolean).join('');
  if (html) contenedor.insertAdjacentHTML('beforeend', `<div class="subarea-panel"><strong>Ciencias naturales por subárea</strong><div>${html}</div></div>`);
}

function buscar() {
  const code = normalizarId(getEl('codigo').value);
  if (!DATA.preguntas.length || !DATA.respuestas.length) {
    getEl('estado').textContent = 'Los datos todavía no están cargados o falló la carga. Recarga la página.';
    return;
  }
  const row = DATA.respuestas.find(r => normalizarId(getStudentId(r)) === code);
  const estado = getEl('estado');

  if (!row) {
    estado.textContent = 'No encontré ese número de documento. Revisa que sea el mismo que registraste al presentar el simulacro.';
    getEl('reporte').classList.add('hidden');
    return;
  }

  const st = stats();
  const accArea = Object.fromEntries(AREA_CONFIG.map(a => [a.key, 0]));
  const errArea = Object.fromEntries(AREA_CONFIG.map(a => [a.key, 0]));
  const errTema = {}, errTipo = {}, errSubNat = {};
  const detalle = [];
  let total = 0;

  DATA.preguntas.forEach(p => {
    const n = Number(p.pregunta);
    const area = resolveArea(p.area);
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
      if (area.key === 'Ciencias naturales' && p.subarea) {
        errSubNat[p.subarea] = (errSubNat[p.subarea] || 0) + 1;
      }
    }
    detalle.push({ n, area: area.key, areaLabel: area.label, subarea: p.subarea || '', tema: p.tema || 'Sin tema', tipo: p.tipo || 'Sin tipo', ans, corr, ok });
  });

  const punt = puntajeDesdeTotal(total, st);
  if (st.total.vals.length) {
    const pct = percentile(st.total.vals, total);
    getEl('percentil').textContent = `Ubicación relativa: por encima del ${pct}% de los resultados de referencia disponibles.`;
  } else {
    getEl('percentil').textContent = 'Puntaje calculado con escala de referencia.';
  }

  getEl('puntajeTotal').textContent = Number.isFinite(punt) ? punt : '—';
  getEl('aciertosTotal').textContent = `${total}/120`;
  getEl('aciertosTotal').setAttribute('aria-label', `${total} aciertos de 120 preguntas`);
  getEl('nivelGlobal').textContent = `Nivel estimado: ${nivel(punt)}.`;

  const areaScores = AREA_CONFIG.map(area => {
    const raw = accArea[area.key];
    const pct = Math.round((raw / area.max) * 100);
    return { area: area.key, label: area.label, raw, pct, errors: errArea[area.key], max: area.max };
  }).sort((a, b) => a.pct - b.pct);

  getEl('areaDebil').textContent = areaScores[0].label;
  const areasDiv = getEl('areas');
  areasDiv.innerHTML = '';
  AREA_CONFIG.forEach(conf => {
    const a = areaScores.find(x => x.area === conf.key);
    const width = clamp(a.pct, 3, 100);
    areasDiv.insertAdjacentHTML('beforeend', `<div class="area-row"><div class="area-name">${a.label}<span class="area-meta">${a.raw} de ${a.max} aciertos</span><span class="area-percent">${a.pct}% de acierto</span></div><div class="bar"><span style="width:${width}%"></span></div><div class="area-score">${a.pct}%</div></div>`);
  });
  renderNaturalSubareas(detalle, areasDiv);

  const topTemas = Object.entries(errTema).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topTipos = Object.entries(errTipo).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const natSub = Object.entries(errSubNat).sort((a, b) => b[1] - a[1]);

  const mejoras = [
    `Reforzar primero <b>${areaScores[0].label}</b>, porque concentra el menor porcentaje de aciertos.`,
    ...topTemas.map(([t, n]) => `Tema prioritario: <b>${t}</b> (${n} errores).`),
    ...topTipos.map(([t, n]) => `Tipo de pregunta recurrente: <b>${t}</b> (${n} errores).`)
  ];
  if (natSub.length) {
    mejoras.push(`En Ciencias naturales, revisar especialmente <b>${natSub[0][0]}</b> (${natSub[0][1]} errores).`);
  }
  getEl('mejoras').innerHTML = mejoras.map(x => `<li>${x}</li>`).join('');

  getEl('diagnostico').innerHTML = `El resultado sugiere ${nivel(punt)}. Tu fortaleza relativa fue <b>${areaScores[areaScores.length - 1].label}</b>. La mejora más rentable es revisar los patrones de error en <b>${areaScores[0].label}</b> y en los temas que aparecen con mayor frecuencia en la tabla.`;

  renderTabla(detalle);
  const filtroEl = getEl('filtroArea');
  if (filtroEl) {
    filtroEl.value = 'todas';
    filtroEl.onchange = () => renderTabla(detalle);
  }

  estado.innerHTML = `Reporte generado para <strong>${getStudentId(row)}</strong>.`;
  estado.classList.add('estado-generado');
  getEl('reporte').classList.remove('hidden');
}

async function init() {
  const estado = getEl('estado');
  try {
    DATA.preguntas = await loadCSV('data/preguntas.csv');
    DATA.respuestas = await loadCSV('data/respuestas_estudiantes.csv');
    DATA.cohorte = await loadCSV('data/referencia.csv', false);
    DATA.resultados = await loadCSV('data/resultados.csv', false);
    estado.textContent = 'Ingresa tu número de documento de identidad para consultar el reporte.';
    console.log('Carga completada', { preguntas: DATA.preguntas.length, respuestas: DATA.respuestas.length, referencia: DATA.cohorte.length });
  } catch (e) {
    estado.textContent = `No se pudieron cargar los CSV. Revisa la carpeta data/ y las rutas RAW.`;
    console.error(e);
  }

  const btn = getEl('buscar');
  const input = getEl('codigo');
  if (btn) btn.addEventListener('click', buscar);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
}

document.addEventListener('DOMContentLoaded', init);
