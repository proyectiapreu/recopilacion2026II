# Proyectia · Consulta de resultados de simulacros

Página estática para GitHub Pages. Permite consultar resultados por código anónimo, mostrar puntaje estimado, desempeño por áreas, reporte de mejora y detalle pregunta por pregunta.

## Archivos principales

- `index.html`: estructura de la página.
- `style.css`: colores, diagramación y diseño visual.
- `app.js`: carga de CSV, búsqueda por código, cálculo de reporte y gráfica.
- `data/preguntas.csv`: clave, área, tipo, tema y dificultad por pregunta.
- `data/respuestas_estudiantes.csv`: respuestas de cada estudiante.
- `data/resultados.csv`: puntajes estimados ya calculados por estudiante.
- `data/cohorte_ficticia.csv`: cohorte normativa simulada para calcular percentiles.

## Códigos de prueba

- PRY-001
- PRY-002
- PRY-003

## Publicación en GitHub Pages

1. Crear un repositorio nuevo en GitHub.
2. Subir todos estos archivos conservando las carpetas.
3. Ir a Settings > Pages.
4. En Source seleccionar `Deploy from a branch`.
5. Elegir rama `main` y carpeta `/root`.
6. Abrir la URL publicada.

## Logo

La página incluye un logo textual editable. Si tienes el logo oficial, súbelo a `assets/logo.png` y reemplaza el bloque `.brand-mark` en `index.html` por:

```html
<img src="assets/logo.png" alt="Proyectia" class="logo-img" />
```

Luego agrega en `style.css`:

```css
.logo-img {
  width: 46px;
  height: 46px;
  object-fit: contain;
}
```

## Nota metodológica

El puntaje debe presentarse como estimación de Proyectia, no como resultado oficial de admisión de la Universidad Nacional.
