# Estadísticas Mundiales

Web de estadísticas de todos los países con mapa, gráficos y tablas. Consulta en vivo el Banco Mundial, Eurostat, el FMI y la CEPAL.

Es un sitio estático: el archivo `index.html` contiene toda la aplicación.

Fuentes: [Banco Mundial](https://data.worldbank.org), [Eurostat](https://ec.europa.eu/eurostat), [FMI DataMapper](https://www.imf.org/external/datamapper), [CEPALSTAT](https://statistics.cepal.org).

## Novedades v0.6
- **Comparar países** (hasta 4): perfil con radar de posición mundial, tabla de 18 indicadores con puesto, tendencia y «mejor valor del grupo», y evolución. Cada comparación tiene su enlace (`#m=pais&p=COL,MEX`).
- Corregido: el indicador «Esperanza de vida» tenía mal su ficha y fallaba al elegirlo.

## Novedades v0.5
- Rediseño más limpio (móvil y escritorio, tema claro/oscuro): una frase de consulta con tres botones (estadística, países, periodo) y un resultado con titular, tres cifras clave y el gráfico.
- 11 formas de ver cada dato: mapa, ranking, evolución (con índice base 100), cambio (inicio→fin), distribución, calor (país × año), carrera animada, participación (treemap), continentes, relación entre dos estadísticas y tabla.
- Cada vista se puede compartir con un enlace (copia el estado en la dirección).

## Novedades v0.4
- El filtro de **continente** ahora limita el mapa (con zoom automático), el gráfico y la tabla.
- Nueva pestaña **Continentes** para compararlos (mediana, media o suma; barras o evolución en el tiempo).
- **FMI**: si el navegador no puede consultar al FMI directamente, la web usa la copia de `datos/imf/`, que se actualiza cada día con la acción de GitHub «Actualizar datos del FMI».

## Estructura
- `index.html`: el sitio publicado (se genera con `node src/build.js`).
- `src/`: código fuente (HTML/CSS, catálogos, lógica, mapa).
- `datos/imf/`: copia local de los datos del FMI.

## v0.6.1
- Banco Mundial más resistente: reintentos automáticos, consulta por tramos de años si la consulta completa falla, mensajes de error claros (429/5xx) y botón "Reintentar".

## v0.7
- **Mi país**: nueva sección con un solo país. Muestra su historial completo ordenado de lo esencial a lo curioso, con una tarjeta por indicador (qué mide, valor actual, tendencia, gráfica, puesto mundial y mediana). Dato curioso: se añaden 24 indicadores del Banco Mundial (turismo, mujeres en el parlamento, homicidios, patentes, vacunación…).
- **Comparar países** ahora incluye datos del FMI (deuda, balance fiscal, cuenta corriente, ingresos y gasto públicos, intereses, deuda de los hogares) y dibuja con línea punteada las estimaciones y proyecciones del FMI.
- **FMI**: se retiran «Inversión total» y «Ahorro nacional» (el FMI ya no los publica en DataMapper) y se añaden 12 indicadores nuevos. Después de este cambio hay que ejecutar una vez la acción «Actualizar datos del FMI» (pestaña Actions → Run workflow) para descargarlos.
