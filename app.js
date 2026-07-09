const DATA_PATHS = {
  preguntas: 'data/preguntas.csv',
  respuestas: 'data/respuestas_estudiantes.csv',
  resultados: 'data/resultados.csv',
  cohorte: 'data/cohorte_ficticia.csv'
};

let preguntas = [];
let respuestas = [];
let resultados = [];
let cohorte = [];
let areaChart = null;

const areaLabels = ['Matemáticas', 'Ciencias', 'Sociales', 'Lectura', 'Imagen'];
const areaKeys = ['matematicas', 'ciencias', 'sociales', 'lectura', 'imagen'];

function parseCSV(text) {
  const rows = [];
  let current = '';
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (current.length || row.length) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      }
      if (char === '\r' && next === '\n') i++;
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.filter(r => r.length === headers.length).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

async function loadCSV(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  return parseCSV(await response.text());
}

async function init() {
  try {
    [preguntas, respuestas, resultados, cohorte] = await Promise.all([
      loadCSV(DATA_PATHS.preguntas),
      loadCSV(DATA_PATHS.respuestas),
      loadCSV(DATA_PATHS.resultados),
      loadCSV(DATA_PATHS.cohorte)
    ]);
  } catch (error) {
    showMessage('No fue posible cargar las bases CSV. Revisa las rutas en la carpeta data/.');
    console.error(error);
  }
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function showMessage(text) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.classList.remove('hidden');
}

function hideMessage() {
  document.getElementById('message').classList.add('hidden');
}

function percentile(score) {
  const value = Number(score);
  const sorted = cohorte.map(d => Number(d.puntaje_total)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const below = sorted.filter(x => x <= value).length;
  return Math.round((below / sorted.length) * 100);
}

function areaNameFromKey(key) {
  const index = areaKeys.indexOf(key);
  return areaLabels[index] || key;
}

function analyzeStudent(studentCode) {
  const code = normalizeCode(studentCode);
  const result = resultados.find(r => normalizeCode(r.codigo) === code);
  const answers = respuestas.find(r => normalizeCode(r.codigo) === code);

  if (!result || !answers) return null;

  const rows = preguntas.map(q => {
    const questionNumber = q.pregunta;
    const userAnswer = answers[`P${questionNumber}`] || '';
    const correctAnswer = q.respuesta_correcta;
    const isCorrect = userAnswer.toUpperCase() === correctAnswer.toUpperCase();
    return {
      pregunta: questionNumber,
      area: q.area,
      tipo: q.tipo,
      tema: q.tema,
      userAnswer,
      correctAnswer,
      isCorrect
    };
  });

  const totalCorrect = rows.filter(r => r.isCorrect).length;
  const errors = rows.filter(r => !r.isCorrect);

  const areaScores = areaKeys.map(key => ({
    key,
    label: areaNameFromKey(key),
    value: Number(result[key])
  }));

  const best = [...areaScores].sort((a, b) => b.value - a.value)[0];
  const weak = [...areaScores].sort((a, b) => a.value - b.value)[0];

  const errorsByType = countBy(errors, 'tipo');
  const errorsByTheme = countBy(errors, 'tema');
  const errorsByArea = countBy(errors, 'area');

  return {
    result,
    rows,
    totalCorrect,
    totalQuestions: preguntas.length,
    areaScores,
    best,
    weak,
    errors,
    errorsByType,
    errorsByTheme,
    errorsByArea,
    percentile: percentile(result.puntaje_total)
  };
}

function countBy(items, key) {
  const counts = {};
  items.forEach(item => {
    const value = item[key] || 'Sin clasificar';
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function renderAnalysis(analysis) {
  document.getElementById('results').classList.remove('hidden');
  document.getElementById('totalScore').textContent = Math.round(Number(analysis.result.puntaje_total));
  document.getElementById('percentileText').textContent = analysis.percentile
    ? `Por encima del ${analysis.percentile}% de la cohorte de referencia`
    : 'Cohorte de referencia no disponible';
  document.getElementById('totalCorrect').textContent = analysis.totalCorrect;
  document.getElementById('totalQuestions').textContent = `de ${analysis.totalQuestions} preguntas`;
  document.getElementById('bestArea').textContent = analysis.best.label;
  document.getElementById('weakArea').textContent = analysis.weak.label;

  renderChart(analysis.areaScores);
  renderFeedback(analysis);
  renderQuestionTable(analysis.rows);
}

function renderChart(areaScores) {
  const ctx = document.getElementById('areaChart');
  if (areaChart) areaChart.destroy();

  areaChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: areaScores.map(a => a.label),
      datasets: [{
        label: 'Puntaje por área',
        data: areaScores.map(a => a.value),
        borderRadius: 10,
        backgroundColor: ['#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#f6c445']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        y: {
          min: 6,
          max: 14,
          ticks: { stepSize: 1 },
          title: { display: true, text: 'Escala estimada por área' }
        }
      }
    }
  });
}

function renderFeedback(analysis) {
  const container = document.getElementById('feedback');
  const topTypes = analysis.errorsByType.slice(0, 3).map(x => `${x.label} (${x.count})`).join(', ') || 'Sin errores registrados';
  const topThemes = analysis.errorsByTheme.slice(0, 3).map(x => `${x.label} (${x.count})`).join(', ') || 'Sin errores registrados';
  const topAreas = analysis.errorsByArea.slice(0, 2).map(x => `${x.label} (${x.count})`).join(', ') || 'Sin errores registrados';

  container.innerHTML = `
    <div class="feedback-item"><strong>Prioridad principal:</strong> reforzar ${analysis.weak.label}, porque fue el área con menor desempeño relativo.</div>
    <div class="feedback-item"><strong>Errores concentrados por área:</strong> ${topAreas}.</div>
    <div class="feedback-item"><strong>Tipos de pregunta por trabajar:</strong> ${topTypes}.</div>
    <div class="feedback-item"><strong>Temas específicos:</strong> ${topThemes}.</div>
    <div class="feedback-item"><strong>Lectura del resultado:</strong> tu puntaje estimado debe interpretarse como diagnóstico para orientar estudio, no como predicción oficial de admisión.</div>
  `;
}

function renderQuestionTable(rows) {
  const tbody = document.getElementById('questionTable');
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.pregunta}</td>
      <td>${row.area}</td>
      <td>${row.tipo}</td>
      <td>${row.tema}</td>
      <td>${row.userAnswer || 'Sin respuesta'}</td>
      <td><span class="status ${row.isCorrect ? 'correct' : 'wrong'}">${row.isCorrect ? 'Correcta' : 'Incorrecta'}</span></td>
      <td>${row.isCorrect ? '—' : row.correctAnswer}</td>
    </tr>
  `).join('');
}

document.getElementById('searchForm').addEventListener('submit', event => {
  event.preventDefault();
  hideMessage();

  const code = document.getElementById('studentCode').value;
  if (!code.trim()) {
    showMessage('Escribe un código de consulta.');
    return;
  }

  const analysis = analyzeStudent(code);
  if (!analysis) {
    document.getElementById('results').classList.add('hidden');
    showMessage('No encontramos resultados para ese código. Revisa que esté escrito exactamente como fue entregado.');
    return;
  }

  renderAnalysis(analysis);
});

init();
