# Resultados Recopilación Proyectia 2026-II

Página estática para consultar resultados del simulacro de la Recopilación Proyectia 2026-II.

## Archivos principales

```text
index.html
style.css
app.js
assets/logo-proyectia.png
data/preguntas.csv
data/respuestas_estudiantes.csv
data/referencia.csv
data/resultados.csv
```

## Consulta por documento

El archivo `data/respuestas_estudiantes.csv` debe tener una columna de identificación del participante. Se recomienda usar:

```csv
documento,simulacro,P1,P2,P3
1000000001,Recopilación Proyectia 2026-II,C,A,B
```

La página también reconoce columnas equivalentes como `numero_documento`, `identificacion`, `cedula` o `id`.

## Solucionario

`data/preguntas.csv` contiene el solucionario diligenciado, el área, el bloque, la subárea cuando aplica, el tema y la respuesta correcta.

Distribución usada:

```text
25 preguntas de Análisis textual
25 preguntas de Matemáticas
25 preguntas de Ciencias naturales
25 preguntas de Ciencias sociales
20 preguntas de Análisis de imagen
```

En Temática común se redistribuyen las preguntas así:

```text
25 Análisis textual
5 Matemáticas
5 Ciencias naturales
5 Ciencias sociales
```

## Publicación en GitHub Pages

Sube los archivos a la raíz del repositorio y activa GitHub Pages desde `Settings > Pages`.

La estructura debe quedar así:

```text
repositorio/
├── index.html
├── style.css
├── app.js
├── assets/
└── data/
```

## Nota de privacidad

Si el repositorio es público, los CSV también serán públicos. Para usar documentos reales, conviene restringir el acceso o usar una solución con backend privado.
