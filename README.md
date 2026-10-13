# Estadísticas Mundiales

Web de estadísticas de todos los países con mapa, gráficos y tablas. Consulta en vivo el Banco Mundial, Eurostat, el FMI y la CEPAL.

Es un sitio estático: el archivo `index.html` contiene toda la aplicación.

Fuentes: [Banco Mundial](https://data.worldbank.org), [Eurostat](https://ec.europa.eu/eurostat), [FMI DataMapper](https://www.imf.org/external/datamapper), [CEPALSTAT](https://statistics.cepal.org).

## Novedades v0.4
- El filtro de **continente** ahora limita el mapa (con zoom automático), el gráfico y la tabla.
- Nueva pestaña **Continentes** para compararlos (mediana, media o suma; barras o evolución en el tiempo).
- **FMI**: si el navegador no puede consultar al FMI directamente, la web usa la copia de `datos/imf/`, que se actualiza cada día con la acción de GitHub «Actualizar datos del FMI».

## Estructura
- `index.html`: el sitio publicado (se genera con `node src/build.js`).
- `src/`: código fuente (HTML/CSS, catálogos, lógica, mapa).
- `datos/imf/`: copia local de los datos del FMI.
