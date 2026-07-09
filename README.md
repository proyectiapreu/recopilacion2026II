# Proyectia · Resultados Recopilación 2026-II

Página estática para GitHub Pages. Archivos principales:

- `index.html`: estructura de la página.
- `style.css`: colores, logo y diseño visual.
- `app.js`: carga de CSV, cálculo de puntaje, percentil y reporte.
- `assets/logo-proyectia.png`: logo suministrado.
- `data/preguntas.csv`: 120 preguntas de la Recopilación 2026-II con área, tema, tipo y clave.
- `data/respuestas_estudiantes.csv`: respuestas por estudiante.
- `data/cohorte_ficticia.csv`: cohorte normativa ficticia para comparación.

## Códigos de prueba

- PRY-001
- PRY-002
- PRY-003
- PRY-004
- PRY-005

## Advertencia metodológica

La columna `respuesta_correcta` está marcada como `BORRADOR_EDITABLE`. Debe reemplazarse con la clave oficial revisada de Proyectia antes de usar el reporte con estudiantes reales.

## Publicación en GitHub Pages

1. Sube todos los archivos al repositorio.
2. Ve a `Settings > Pages`.
3. En `Branch`, selecciona `main` y `/root`.
4. Guarda.
5. Abre la URL generada por GitHub Pages.

## Actualización de datos

Para agregar estudiantes reales, edita `data/respuestas_estudiantes.csv`. Cada fila debe tener un `codigo`, el nombre del simulacro y las columnas `P1` a `P120`.

No uses documentos de identidad reales si el repositorio es público.


## Archivo adicional de resultados

`data/resultados.csv` contiene un resumen calculado para cada código de prueba: aciertos totales, puntaje estimado, percentil frente a la cohorte ficticia, puntajes por área y áreas de fortaleza/debilidad. La página actual calcula el reporte desde `preguntas.csv`, `respuestas_estudiantes.csv` y `cohorte_ficticia.csv`; este archivo sirve como respaldo, auditoría o base para exportar resultados agregados.


## Cambios de interfaz
- La consulta se realiza por número de documento de identidad. El archivo `respuestas_estudiantes.csv` puede usar una columna llamada `documento`, `numero_documento`, `cedula`, `id` o, por compatibilidad, `codigo`.
- Se agregó botón de inscripción al PreUNAL después del desempeño por área.
- Se agregó bloque final de conexión con Instagram, Linktree, TikTok y WhatsApp.
