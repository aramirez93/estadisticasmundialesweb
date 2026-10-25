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

## v0.8
- **Nuevo logo e icono** (SVG, también como favicon).
- **Buscador de países que filtra al escribir** (sin importar tildes ni mayúsculas) en «Mi país» y «Comparar países»; admite flechas y Enter.
- **Comparar países, vista Historial**: una tarjeta por indicador con la evolución de cada país elegido (hasta 4), su valor actual, tendencia, puesto mundial, lectura en palabras y proyecciones del FMI en línea punteada. Cubre todo el catálogo (Banco Mundial, FMI, OMS, OIT y OWID), con el interruptor «Índice (primer año = 100)». «Perfil» (radar) e «Indicadores» (tabla) siguen disponibles.
- **Fuentes nuevas**: OMS (10 indicadores de salud), OIT (4 de trabajo) y Our World in Data (7). Las descarga a diario la acción de GitHub «Actualizar datos» (`.github/scripts/actualizar_ext.mjs`) y quedan en `datos/ext/`; si una descarga falla se conserva la anterior y el motivo queda en `datos/ext/_estado.json`. Mientras no existan esos archivos, las fuentes nuevas se ocultan sin afectar al resto.

## v0.9 – Mapa por regiones
- En «Mi país» aparece el **mapa de la primera subdivisión** del país (departamentos, estados, provincias, comunidades autónomas…) para los 251 territorios. Los límites están en `datos/geo/` y se generan con `.github/scripts/generar_geo.mjs` (Natural Earth, dominio público; en Europa, regiones NUTS 2 de Eurostat/GISCO).
- **Cifras por región** (`datos/reg/`, las descarga `.github/scripts/actualizar_reg.mjs` dentro de la acción «Actualizar datos»): Europa (Eurostat NUTS 2), Estados Unidos (Census Bureau), Brasil (IBGE), Canadá (Statistics Canada), Colombia y México (Wikidata, que cita a DANE e INEGI). Para el resto de países solo hay mapa.
- Lo que falle se registra en `datos/reg/_estado.json`; el sitio simplemente oculta lo que no tenga datos.

## v0.10 – Mi país primero y más fuentes
- Orden de las secciones: **Mi país → Comparar países → Explorar datos**. La web abre en «Mi país» (los enlaces antiguos al explorador siguen funcionando).
- Nueva fuente **ACNUR** (refugiados, solicitantes de asilo y desplazados) y 13 indicadores nuevos de Our World in Data (historia del PIB desde 1820, democracia, corrupción, género, homicidios, renovables…).
- Cifras regionales de **todos los países** que las tengan en Wikidata (población, superficie, densidad); Europa, EE. UU., Canadá, Brasil, Colombia y México siguen con sus fuentes oficiales.
- Correcciones tras la primera ejecución real: paro regional de Eurostat (dimensión de nivel educativo) y desgloses de los indicadores de la OMS (obesidad, sobrepeso, saneamiento y combustibles limpios).

## v0.11 – Colores y UNESCO
- Mapas y mapa de calor con escala divergente **rojo (peor) → amarillo claro → azul (mejor)**, apta para daltonismo; los indicadores sin «bueno/malo» (población, densidad…) siguen en una sola gama azul. Los mapas regionales aplican la misma lógica donde corresponde (PIB, empleo, paro, pobreza…).
- Nueva fuente **UNESCO** (Instituto de Estadística): finalización de estudios, niños fuera de la escuela, alumnos por docente y años de educación obligatoria y gratuita.
