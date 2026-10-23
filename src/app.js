// ============================================================
//  UTILIDADES
// ============================================================
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ANIO = new Date().getFullYear();
const nfs = {};
function num(v, d) { return (nfs[d] || (nfs[d] = new Intl.NumberFormat("es-CO", {minimumFractionDigits: d, maximumFractionDigits: d}))).format(v); }
function big(v) {                       // escala larga del español: 1 billón = 10^12
  const a = Math.abs(v);
  if (a >= 1e12) return num(v / 1e12, a >= 1e14 ? 0 : a >= 1e13 ? 1 : 2) + " billones";
  if (a >= 1e9)  return num(v / 1e9,  a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2) + " mil millones";
  if (a >= 1e6)  return num(v / 1e6,  a >= 1e8  ? 0 : a >= 1e7  ? 1 : 2) + " millones";
  return num(v, 0);
}
function fmtVal(v, o) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  let k = o.k;
  if (k === "auto") { const a = Math.abs(v); k = a >= 1e6 ? "big" : a >= 100 ? "n0" : a >= 10 ? "n1" : "n2"; }
  const s = k === "big" ? big(v) : num(v, +k[1]);
  return (o.pre || "") + s + (o.suf || "");
}
function textoPlano(html) {
  try { return (new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || "").replace(/\s+\n/g, "\n").trim(); }
  catch (e) { return String(html || ""); }
}
function unidadDeNombre(n) { const m = String(n || "").match(/\(([^()]*)\)\s*$/); return m ? m[1] : ""; }

// ============================================================
//  RED
// ============================================================
const WB  = "https://api.worldbank.org/v2/es";
const ESU = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0";
const IMF = "https://www.imf.org/external/datamapper/api/v1";
const CEP = "https://api-cepalstat.cepal.org/cepalstat/api/v1";
let jsonpId = 0, modoWB = "directo";

function fetchJSON(url, ms = 40000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, {signal: c.signal})
    .then(r => { if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; } return r.json(); })
    .finally(() => clearTimeout(t));
}
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "wbcb" + (++jsonpId), s = document.createElement("script");
    const t = setTimeout(() => { fin(); reject(new Error("Tiempo de espera agotado")); }, 30000);
    function fin() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = d => { fin(); resolve(d); };
    s.onerror = () => { fin(); reject(new Error("No hay conexión con api.worldbank.org")); };
    s.src = url.replace("format=json", "format=jsonP") + "&prefix=" + cb;
    document.head.appendChild(s);
  });
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
// Consulta al Banco Mundial: reintenta si el servicio está saturado y, como último recurso, usa JSONP.
// Si todo falla se informa el error real de la primera consulta (no el del plan B).
async function wbGet(url) {
  let primero = null;
  for (let i = 0; i < 3; i++) {
    try { const d = await fetchJSON(url, 45000); modoWB = "directo"; return d; }
    catch (e) {
      primero = primero || e;
      if (e.status && e.status < 500 && e.status !== 429) break;      // errores de petición: reintentar no sirve
      await esperar(900 * (i + 1));
    }
  }
  try { const d = await jsonp(url); modoWB = "alterno (JSONP)"; return d; }
  catch (e2) { throw primero || e2; }
}
const wbUrl = (path, p) => WB + path + "?" + new URLSearchParams({format: "json", ...p});
async function wbAll(path, params) {
  const p = {per_page: 1000, ...params};
  const first = await wbGet(wbUrl(path, p));
  if (first && first[0] && first[0].message) throw new Error(first[0].message[0].value || "Parámetro no válido");
  if (!first || !first[0]) throw new Error("Respuesta vacía de la API");
  let rows = first[1] || [];
  const pages = Number(first[0].pages) || 1;
  if (pages > 1) {
    const resto = await Promise.all(Array.from({length: pages - 1}, (_, i) => wbGet(wbUrl(path, {...p, page: i + 2}))));
    resto.forEach(r => { rows = rows.concat((r && r[1]) || []); });
  }
  return {meta: first[0], rows};
}
let imfModo = "", imfCopia = "";
// El FMI a veces no acepta consultas desde páginas web (CORS). Primero se intenta en vivo;
// si falla, se usa la copia que el propio sitio guarda en datos/imf/ (la actualiza GitHub cada día).
async function imfGet(ruta) {
  try { const j = await fetchJSON(`${IMF}/${ruta}`, 15000); imfModo = "vivo"; return j; }
  catch (e1) {
    try {
      const j = await fetchJSON(`datos/imf/${ruta.replace(/[^\w.-]/g, "_")}.json`, 20000);
      imfModo = "copia"; if (j.generado) imfCopia = j.generado;
      return j.datos || j;
    } catch (e2) {
      throw new Error("El FMI no permite consultas directas desde el navegador y este indicador no está en la copia local del sitio (datos/imf/).");
    }
  }
}
function explicarError(e, fuente) {
  const m = String((e && e.message) || e);
  if (e && e.name === "AbortError") return `${fuente} tardó demasiado en responder. Intenta de nuevo en unos minutos.`;
  const h = m.match(/^HTTP (\d{3})/);
  if (h) { const c = +h[1]; return c === 429 ? `${fuente} recibió demasiadas consultas seguidas (error 429). Espera un minuto y pulsa Reintentar.`
    : c >= 500 ? `${fuente} está con problemas o saturado en este momento (error ${c}). Suele resolverse en minutos: pulsa Reintentar.` : `${fuente} rechazó la consulta (error ${c}).`; }
  if (/Failed to fetch|NetworkError|Load failed/i.test(m))
    return `El navegador no pudo conectar con ${fuente}. Puede ser falta de internet o que ${fuente} no permite consultas desde una página web (bloqueo CORS). Si ocurre solo con esta fuente, avísame y lo resolvemos con un servidor intermedio.`;
  return m;
}

// ============================================================
//  ESTADO GLOBAL
// ============================================================
let paises = [], paisMap = new Map(), iso2a3 = new Map();
let srcActual = "wb", ind = null, D = null, filas = [];
const sel = new Set();
const REG = new Map();                      // key -> indicador
let catFiltro = "", consultaId = 0, orden = {k: "valor", asc: false};
let wbFuentes = [], wbIndCache = {}, imfCat = null, cepalItems = null, avzItems = [];
const estadoFuente = {wb: "wait", eurostat: "wait", imf: "wait", cepal: "wait"};
const errFuente = {};
let grafico = null, tabActiva = "mapa";
Object.values(CATALOGO).flat().forEach(o => REG.set(o.key, o));

function setEstado(msg, tipo) {
  const e = $("estado"); e.textContent = msg; e.className = tipo || ""; if (typeof actualizarFrase === "function") actualizarFrase();
  const a = $("alerta");
  if (a) { a.hidden = tipo !== "err"; a.textContent = tipo === "err" ? msg : ""; }
}

// ============================================================
//  ADAPTADORES POR FUENTE  ->  {series: Map(iso3 -> [{y,v,f}]), updated, def, unitApi, label}
// ============================================================
function agregar(series, iso, y, v, f) {
  if (!series.has(iso)) series.set(iso, []);
  series.get(iso).push({y, v, f: f || ""});
}
function decodeJsonStat(js) {
  const ids = js.id, size = js.size;
  const ig = ids.indexOf("geo"), it = ids.indexOf("time");
  if (ig < 0 || it < 0) throw new Error("Eurostat devolvió un formato inesperado");
  ids.forEach((d, i) => { if (i !== ig && i !== it && size[i] > 1) throw new Error("Eurostat devolvió dimensiones adicionales (" + d + ")"); });
  const stride = []; let s = 1;
  for (let i = ids.length - 1; i >= 0; i--) { stride[i] = s; s *= size[i]; }
  const inv = nombre => {
    const idx = js.dimension[nombre].category.index;
    if (Array.isArray(idx)) return idx;
    const arr = []; Object.entries(idx).forEach(([k, p]) => { arr[p] = k; }); return arr;
  };
  const geos = inv("geo"), times = inv("time"), vals = js.value || {}, st = js.status || {};
  const out = [];
  Object.keys(vals).forEach(k => {
    const v = vals[k]; if (v === null || v === undefined) return;
    const i = +k;
    out.push({geo: geos[Math.floor(i / stride[ig]) % size[ig]], time: times[Math.floor(i / stride[it]) % size[it]], v, f: Array.isArray(st) ? st[i] : st[k]});
  });
  return out;
}

const ADAPT = {
  async wb(o, d, h) {
    const pedir = (a, b) => wbAll(`/country/all/indicator/${encodeURIComponent(o.id)}`, {date: `${a}:${b}`, source: o.wbSource || "2", per_page: 10000});
    let r;
    try { r = await pedir(d, h); }
    catch (e) {                      // consulta grande rechazada: se pide por tramos de 9 años, más livianos
      const rs = []; for (let a = d; a <= h; a += 9) rs.push(await pedir(a, Math.min(h, a + 8)));
      r = {meta: rs[0].meta, rows: rs.flatMap(x => x.rows)};
    }
    const series = new Map();
    r.rows.forEach(x => {
      if (x.value === null || x.value === undefined) return;
      const iso = x.countryiso3code || (x.country && x.country.id);
      if (iso) agregar(series, iso, +x.date, x.value);
    });
    return {series, updated: r.meta.lastupdated, link: "https://data.worldbank.org/indicator/" + encodeURIComponent(o.id)};
  },

  async eurostat(o, d, h) {
    const q = new URLSearchParams({format: "JSON", lang: "EN", ...o.flt, sinceTimePeriod: d, untilTimePeriod: h});
    const js = await fetchJSON(`${ESU}/data/${o.ds}?${q}`);
    const series = new Map();
    decodeJsonStat(js).forEach(x => {
      const c2 = x.geo === "EL" ? "GR" : x.geo === "UK" ? "GB" : x.geo;
      const iso = iso2a3.get(c2);
      if (iso) agregar(series, iso, parseInt(x.time, 10), x.v, /[pe]/.test(x.f || "") ? "p" : "");
    });
    return {series, updated: (js.updated || "").slice(0, 10), label: js.label,
            link: "https://ec.europa.eu/eurostat/databrowser/view/" + o.ds + "/default/table"};
  },

  async imf(o, d, h) {
    const j = await imfGet(encodeURIComponent(o.id));
    const vals = j.values && j.values[o.id];
    if (!vals) throw new Error("El FMI no devolvió datos para este indicador.");
    const sc = o.scale || 1, series = new Map();
    Object.entries(vals).forEach(([code, serie]) => {
      const iso = (code === "KOS" || code === "UVK") ? "XKX" : code;
      if (!paisMap.has(iso)) return;
      Object.entries(serie).forEach(([y, v]) => {
        const yy = +y, vv = Number(v);
        if (yy < d || yy > h || v === null || isNaN(vv)) return;
        agregar(series, iso, yy, vv * sc, yy >= ANIO ? "proy" : "");
      });
    });
    return {series, updated: imfModo === "copia" && imfCopia ? "copia del sitio del " + imfCopia.slice(0, 10) : "", link: "https://www.imf.org/external/datamapper/" + encodeURIComponent(o.id) + "@WEO"};
  },

  async cepal(o, d, h) {
    const [dm, dt] = await Promise.all([
      fetchJSON(`${CEP}/indicator/${o.id}/dimensions?lang=es&format=json`),
      fetchJSON(`${CEP}/indicator/${o.id}/data?lang=es&format=json`)
    ]);
    const dims = (dm.body && dm.body.dimensions) || [];
    const dAnio = dims.find(x => /^a(ñ|n)os?/i.test(x.name)), dPais = dims.find(x => /^pa(í|i)s/i.test(x.name));
    if (!dAnio || !dPais) throw new Error("La CEPAL devolvió un formato inesperado.");
    const anios = new Map(dAnio.members.map(m => [m.id, parseInt(m.name, 10)]));
    const fijos = dims.filter(x => x !== dAnio && x !== dPais).map(dim => {
      let m = (o.pick && o.pick[dim.id]) ? dim.members.find(x => x.id === o.pick[dim.id]) : null;
      if (!m) m = dim.members.find(x => /^(ambos sexos|total( nacional)?|nacional)$/i.test(String(x.name).trim()));
      if (!m) { const tops = dim.members.filter(x => x.parent === dim.id); m = (tops.length ? tops : dim.members).slice().sort((a, b) => a.order - b.order)[0]; }
      return {campo: "dim_" + dim.id, id: m.id, nombre: m.name};
    });
    const meta = (dt.body && dt.body.metadata) || {};
    let sc = 1;
    if (o.k === "big" && /d(ó|o)lares/i.test(meta.unit || "")) sc = /miles de millones/i.test(meta.unit) ? 1e9 : /millones/i.test(meta.unit) ? 1e6 : /miles/i.test(meta.unit) ? 1e3 : 1;
    const series = new Map();
    ((dt.body && dt.body.data) || []).forEach(r => {
      if (!r.iso3 || !paisMap.has(r.iso3)) return;
      for (const f of fijos) if (r[f.campo] !== f.id) return;
      const y = anios.get(r["dim_" + dAnio.id]), v = parseFloat(r.value);
      if (!y || isNaN(v) || y < d || y > h) return;
      agregar(series, r.iso3, y, v * sc);
    });
    return {series, updated: (meta.last_update || "").slice(0, 10), unitApi: meta.unit, label: meta.indicator_name,
            def: textoPlano(meta.definition) + (meta.note ? "\n" + textoPlano(meta.note) : ""),
            extra: fijos.length ? "Filtro aplicado: " + fijos.map(f => f.nombre).join(", ") : "",
            link: "https://statistics.cepal.org/portal/cepalstat/indicator.html?indicator_id=" + o.id + "&lang=es"};
  }
};

// ============================================================
//  PAÍSES
// ============================================================
async function cargarPaises() {
  const r = await wbAll("/country", {per_page: 400});
  paises = r.rows.map(c => {
    const agg = !c.region || c.region.id === "NA";
    return {iso: c.id, iso2: c.iso2Code, nombre: (c.name || c.id).trim(), agg, capital: (c.capitalCity || "").trim(),
      cont: agg ? "" : (CONTINENTE[c.id] || ""),
      ingreso: agg ? "Agregados" : (c.incomeLevel.value || "").trim(),
      lat: parseFloat(c.latitude), lon: parseFloat(c.longitude)};
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  paisMap = new Map(paises.map(p => [p.iso, p]));
  iso2a3 = new Map(paises.filter(p => !p.agg && p.iso2).map(p => [p.iso2, p.iso]));

  const conts = [...new Set(paises.filter(p => !p.agg).map(p => p.cont))].filter(Boolean);
  $("fCont").innerHTML = `<option value="">Todos</option>` + conts.sort((a, b) => CONT_NOMBRE[a].localeCompare(CONT_NOMBRE[b], "es")).map(c => `<option value="${c}">${esc(CONT_NOMBRE[c])}</option>`).join("");
  const ings = [...new Set(paises.filter(p => !p.agg).map(p => p.ingreso))].sort((a, b) => a.localeCompare(b, "es"));
  $("fIngreso").innerHTML = `<option value="">Todos</option>` + ings.map(x => `<option>${esc(x)}</option>`).join("");
  $("listaPaises").innerHTML = paises.map(p =>
    `<label data-cont="${p.cont}" data-ing="${esc(p.ingreso)}" data-agg="${p.agg ? 1 : 0}" data-q="${esc(norm(p.nombre + " " + p.iso))}"><input type="checkbox" value="${p.iso}"> ${esc(p.nombre)}</label>`).join("");
  filtrarPaises();
}
function filtrarPaises() {
  const c = $("fCont").value, i = $("fIngreso").value, q = norm($("buscarPais").value), agg = $("verAgg").checked;
  $("listaPaises").querySelectorAll("label").forEach(l => {
    l.hidden = !((agg || l.dataset.agg === "0") && (!c || l.dataset.cont === c) && (!i || l.dataset.ing === i) && (!q || l.dataset.q.includes(q)));
  });
}
function syncChecks() {
  $("listaPaises").querySelectorAll("input").forEach(c => { c.checked = sel.has(c.value); });
  $("contPaises").textContent = sel.size ? `· ${sel.size} seleccionados` : contSel() ? `· ninguno (se muestra todo ${CONT_NOMBRE[contSel()]})` : "· ninguno (se muestran todos)";
}
function onSelChange() {
  syncChecks(); marcarSel(); actualizarFrase();
  if (D) { renderResumen(); renderVista({}); }
}
function onContChange() {           // el continente elegido manda sobre toda la vista
  sel.clear(); filtrarPaises(); syncChecks(); marcarSel(); actualizarFrase();
  if (D) { renderResumen(); renderVista({zoom: true}); }
}
function toggleSel(iso) {
  const p = paisMap.get(iso); if (!p || p.agg) return;
  if (sel.has(iso)) sel.delete(iso); else sel.add(iso);
  onSelChange();
}

// ============================================================
//  CATÁLOGO DE INDICADORES (interfaz)
// ============================================================
function renderTabsFuente() {
  $("tabsFuente").innerHTML = Object.entries(FUENTES).map(([k, f]) =>
    `<button data-src="${k}" class="${k === srcActual ? "on" : ""}">${esc(f.nombre)}<small>${esc(f.sub)}</small></button>`).join("");
  $("descFuente").innerHTML = esc(FUENTES[srcActual].desc) + (errFuente[srcActual] ? ` <b style="color:var(--rojo)">⚠ Última prueba de conexión fallida.</b>` : "") +
    (srcActual === "imf" && imfModo === "copia" ? ` <b>Datos tomados de la copia del sitio${imfCopia ? " (actualizada el " + esc(imfCopia.slice(0, 10)) + ")" : ""}, porque el FMI no responde a consultas directas desde el navegador.</b>` : "");
}
function renderChips() {
  const cats = [...new Set(CATALOGO[srcActual].map(o => o.cat))];
  $("chipsCat").innerHTML = [["", "Todas"], ...cats.map(c => [c, c])].map(([v, t]) =>
    `<button data-cat="${esc(v)}" class="${v === catFiltro ? "on" : ""}">${esc(t)}</button>`).join("");
}
function renderCatalogo() {
  const q = norm($("buscarCat").value);
  const lista = CATALOGO[srcActual].filter(o => (!catFiltro || o.cat === catFiltro) && (!q || norm(o.name + " " + o.desc + " " + o.cat).includes(q)));
  $("catalogo").innerHTML = lista.length ? lista.map(o =>
    `<button class="ind ${ind && ind.key === o.key ? "on" : ""}" data-key="${esc(o.key)}"><b>${esc(o.name)}</b><span class="u">${esc(o.unit)}</span><span class="d">${esc(o.desc)}</span></button>`).join("")
    : `<p class="nota">No hay indicadores con esa búsqueda. Prueba el catálogo completo, más abajo.</p>`;
}
function renderDetalle() {
  if (!ind) { $("detalle").hidden = true; return; }
  const f = FUENTES[ind.src];
  const ficha = [`Código: ${ind.id}`];
  if (ind.org) ficha.push("Organización que produce el dato: " + ind.org);
  if (ind.label) ficha.push("Nombre oficial: " + ind.label);
  if (ind.unitApi) ficha.push("Unidad original de la fuente: " + ind.unitApi);
  if (ind.extra) ficha.push(ind.extra);
  if (ind.updated) ficha.push("Última actualización de la fuente: " + ind.updated);
  if (ind.def) ficha.push("\n" + ind.def);
  $("detalle").hidden = false;
  $("detalle").innerHTML =
    `<h3>${esc(ind.name)}</h3>
     <div class="pills"><span>${esc(f.nombre)}</span><span>Unidad: ${esc(ind.unit || "ver ficha")}</span>${ind.cat ? `<span>${esc(ind.cat)}</span>` : ""}</div>
     ${ind.desc ? `<p><b>Qué mide:</b> ${esc(ind.desc)}</p>` : ""}
     <p><b>Cómo leerlo:</b> ${esc(TONO_TXT[ind.tone])}</p>
     ${ind.src === "imf" ? `<p><b>Ojo:</b> a partir de ${ANIO} los valores son proyecciones del FMI (línea punteada en el gráfico).</p>` : ""}
     ${ind.src === "eurostat" ? `<p><b>Cobertura:</b> solo países europeos (UE, AELC y candidatos).</p>` : ""}
     ${ind.src === "cepal" ? `<p><b>Cobertura:</b> solo América Latina y el Caribe.</p>` : ""}
     <details><summary>Definición oficial y ficha técnica</summary><div class="def">${esc(ficha.join("\n"))}</div></details>`;
}
function ajustarPeriodo() {
  const max = srcActual === "imf" ? ANIO + 5 : ANIO;
  const dSel = $("desde").value, hSel = $("hasta").value;
  let a = "", b = "";
  for (let y = max; y >= 1950; y--) { a += `<option>${y}</option>`; }
  for (let y = max; y >= 1950; y--) { b += `<option>${y}</option>`; }
  $("desde").innerHTML = a; $("hasta").innerHTML = b;
  $("desde").value = dSel && +dSel <= max ? dSel : 2000;
  $("hasta").value = hSel && +hSel <= max && srcActual !== "imf" ? hSel : max;
  if (srcActual === "imf") $("hasta").value = max;
}
function elegirIndicador(o, consultarYa = true) {
  const cambioFuente = o.src !== srcActual;
  ind = o; srcActual = o.src;
  if (cambioFuente) { catFiltro = ""; $("buscarCat").value = ""; renderTabsFuente(); renderChips(); ajustarPeriodo(); resetAvanzado(); }
  renderCatalogo(); renderDetalle(); actualizarFrase();
  if (consultarYa) { cerrarHojas(); consultar(); }
}
function cambiarFuente(s) {
  if (s === srcActual) return;
  srcActual = s; catFiltro = ""; $("buscarCat").value = "";
  renderTabsFuente(); renderChips(); ajustarPeriodo(); resetAvanzado();
  sel.clear(); (MUESTRA_FUENTE[s] || MUESTRA).forEach(i => sel.add(i)); syncChecks(); marcarSel();   // muestra acorde a la cobertura de la fuente
  const primero = CATALOGO[s][0];
  elegirIndicador(primero, true);
}
// --- catálogo completo (avanzado) ---
function resetAvanzado() { avzItems = []; $("avzLista").innerHTML = ""; $("avzCont").textContent = ""; $("avzBuscar").value = ""; if ($("avanzado").open) abrirAvanzado(); }
async function abrirAvanzado() {
  const s = srcActual;
  $("avzDBbox").hidden = s !== "wb";
  $("avzBuscar").disabled = s === "eurostat";
  if (s === "eurostat") { avzItems = []; renderAvanzado(); $("avzCont").textContent = "Eurostat publica miles de tablas con múltiples dimensiones. En esta versión se incluye una selección verificada de los indicadores principales (arriba); se pueden ir sumando más."; return; }
  $("avzCont").textContent = "Cargando catálogo…";
  try {
    if (s === "wb") {
      if (!wbFuentes.length) {
        const r = await wbAll("/source", {per_page: 100});
        wbFuentes = r.rows.filter(x => x.dataavailability === "Y").map(x => ({id: x.id, name: (x.name || "").trim()}));
        $("avzDB").innerHTML = wbFuentes.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
        $("avzDB").value = "2";
      }
      avzItems = await wbIndicadores($("avzDB").value);
    } else if (s === "imf") {
      if (!imfCat) await cargarIMF();
      avzItems = Object.entries(imfCat).map(([id, x]) => ({id, name: `${x.label || id}  [${x.dataset || ""}]`, unit: x.unit || "", desc: textoPlano(x.description), org: x.source || ""}));
    } else if (s === "cepal") {
      if (!cepalItems) {
        const j = await fetchJSON(`${CEP}/thematic-tree?lang=es&format=json`);
        cepalItems = [];
        const walk = (n, path) => {
          if (n.indicator_id) cepalItems.push({id: String(n.indicator_id), name: n.name, desc: path.join(" › ")});
          (n.children || []).forEach(c => walk(c, n.name ? [...path, n.name] : path));
        };
        walk(j.body || {}, []);
      }
      avzItems = cepalItems;
    }
    avzItems.sort((a, b) => a.name.localeCompare(b.name, "es"));
    renderAvanzado();
  } catch (e) { $("avzCont").textContent = "No se pudo cargar el catálogo: " + explicarError(e, FUENTES[s].corto); }
}
async function wbIndicadores(db) {
  if (wbIndCache[db]) return wbIndCache[db];
  const r = await wbAll(`/sources/${db}/indicators`, {per_page: 1000});
  wbIndCache[db] = r.rows.map(x => ({id: x.id, name: (x.name || "").trim(), desc: textoPlano(x.sourceNote), org: textoPlano(x.sourceOrganization), unit: x.unit || unidadDeNombre(x.name), wbSource: db, topics: (x.topics || []).length}));
  return wbIndCache[db];
}
function renderAvanzado() {
  const q = norm($("avzBuscar").value);
  const lista = avzItems.filter(i => !q || norm(i.name + " " + i.id).includes(q));
  $("avzLista").innerHTML = lista.slice(0, 500).map(i => `<option value="${esc(i.id)}">${esc(i.name)}  [${esc(i.id)}]</option>`).join("");
  if (avzItems.length) $("avzCont").textContent = `${lista.length} indicadores` + (lista.length > 500 ? " (se muestran 500; afina la búsqueda)" : "");
}
function indDesdeItem(it) {
  const s = srcActual, db = it.wbSource || "2";
  const key = s === "wb" ? (db === "2" ? "wb:" + it.id : `wb:${db}:${it.id}`) : `${s}:${it.id}`;
  if (REG.has(key)) return REG.get(key);
  const o = {key, src: s, id: it.id, cat: "", name: it.name.replace(/\s+\[[^\]]*\]$/, ""), unit: it.unit || "", k: "auto", pre: "", suf: "", tone: "neutral",
             desc: it.desc && it.desc.length > 400 ? it.desc.slice(0, 400) + "…" : (it.desc || ""), def: it.desc || "", org: it.org || "", wbSource: db, scale: 1, pick: {}, curated: false};
  REG.set(key, o); return o;
}
// --- cargas en segundo plano ---
async function cargarWBCatalogo() {
  const lista = await wbIndicadores("2");
  const ids = new Map(lista.map(x => [x.id, x]));
  CATALOGO.wb = CATALOGO.wb.filter(o => { if (!ids.has(o.id)) { console.warn("Indicador del Banco Mundial no encontrado:", o.id); return false; } return true; });
  CATALOGO.wb.forEach(o => { const x = ids.get(o.id); o.def = x.desc; o.org = x.org; });
  if (srcActual === "wb") { renderCatalogo(); if (ind && ind.src === "wb") renderDetalle(); }
}
async function cargarIMF() {
  const j = await imfGet("indicators");
  imfCat = j.indicators || {};
  CATALOGO.imf = CATALOGO.imf.filter(o => { if (!imfCat[o.id]) { console.warn("Indicador del FMI no encontrado:", o.id); return false; } return true; });
  CATALOGO.imf.forEach(o => { o.def = textoPlano(imfCat[o.id].description); o.org = imfCat[o.id].source || ""; });
  if (srcActual === "imf") { renderCatalogo(); if (ind && ind.src === "imf") renderDetalle(); }
}
function pingFuentes() {
  const marca = (k, p) => p.then(() => { estadoFuente[k] = "ok"; }).catch(e => { estadoFuente[k] = "fail"; errFuente[k] = explicarError(e, FUENTES[k].corto); console.warn(k, e); }).finally(() => { renderEstados(); renderTabsFuente(); });
  marca("imf", cargarIMF());
  marca("eurostat", fetchJSON(`${ESU}/data/une_rt_a?format=JSON&lang=EN&unit=PC_ACT&sex=T&age=Y15-74&geo=ES&sinceTimePeriod=2024`));
  marca("cepal", fetchJSON(`${CEP}/indicator/3289/dimensions?lang=es&format=json`));
  cargarWBCatalogo().catch(e => console.warn("catálogo WB", e));
}
function renderEstados() {
  $("fuentesEstado").innerHTML = Object.entries(FUENTES).map(([k, f]) => {
    const e = estadoFuente[k];
    const t = e === "ok" ? "conectado" : e === "fail" ? "sin conexión: " + (errFuente[k] || "") : "comprobando…";
    return `<span class="${e}" title="${esc(t)}">${esc(f.corto)}</span>`;
  }).join("");
}

// ============================================================
//  CONSULTA
// ============================================================
async function consultar() {
  if (!ind) { setEstado("Elige primero una estadística.", "err"); return; }
  const d = +$("desde").value, h = +$("hasta").value;
  if (d > h) { setEstado("El año inicial no puede ser mayor que el final.", "err"); return; }
  const mi = ++consultaId, o = ind;
  $("btnConsultar").disabled = true;
  setEstado(`Consultando ${FUENTES[o.src].nombre}…`);
  try {
    const R = await ADAPT[o.src](o, d, h);
    if (mi !== consultaId) return;
    estadoFuente[o.src] = "ok"; delete errFuente[o.src]; renderEstados();
    Object.assign(o, {updated: R.updated || o.updated, label: R.label || o.label, unitApi: R.unitApi || o.unitApi, extra: R.extra || o.extra});
    if (R.def && !o.def) o.def = R.def;
    if (!o.unit && R.unitApi) o.unit = R.unitApi;
    renderDetalle();
    procesar(R, d, h);
  } catch (e) {
    if (mi !== consultaId) return;
    estadoFuente[o.src] = "fail"; errFuente[o.src] = explicarError(e, FUENTES[o.src].corto); renderEstados(); renderTabsFuente();
    $("resultados").hidden = true;
    setEstado("No se pudo consultar: " + explicarError(e, FUENTES[o.src].corto), "err");
    $("alerta").insertAdjacentHTML("beforeend", ` <button class="btn sec" data-reintentar style="margin-left:8px;padding:5px 12px">Reintentar</button>`);
  } finally { if (mi === consultaId) $("btnConsultar").disabled = false; }
}
function procesar(R, d, h) {
  const ultimoReal = ind.src === "imf" ? ANIO - 1 : 9999;
  D = {series: R.series, d, h, idx: new Map(), link: R.link, updated: R.updated, ultimoReal};
  filas = [];
  R.series.forEach((arr, iso) => {
    const p = paisMap.get(iso); if (!p) return;
    arr.sort((a, b) => a.y - b.y);
    D.idx.set(iso, new Map(arr.map(x => [x.y, x])));
    const act = arr.filter(x => x.y <= ultimoReal);
    if (!act.length) return;
    const ult = act[act.length - 1], prim = act[0];
    filas.push({iso, nombre: p.nombre, agg: p.agg, cc: p.agg ? "" : p.cont, cont: p.agg ? "Agregado" : (CONT_NOMBRE[p.cont] || "Otros"), ult, prim,
                var: (prim.y !== ult.y && prim.v !== 0) ? (ult.v - prim.v) / Math.abs(prim.v) * 100 : null});
  });
  const ord = filas.filter(r => !r.agg).sort((a, b) => b.ult.v - a.ult.v);
  ord.forEach((r, i) => { r.puesto = i + 1; });
  D.nRank = ord.length;
  if (!filas.length) {
    $("resultados").hidden = true;
    setEstado(`La fuente respondió, pero no hay datos de «${ind.name}» entre ${d} y ${h}. Prueba otro periodo u otro indicador.`, "err");
    return;
  }
  // años disponibles para el mapa
  const anios = new Set(); D.idx.forEach(m => m.forEach((_, y) => anios.add(y)));
  const lista = [...anios].sort((a, b) => b - a);
  $("mapaAnio").innerHTML = `<option value="ultimo">Último dato disponible de cada país</option>` +
    lista.map(y => `<option value="${y}">${y}${y >= ANIO && ind.src === "imf" ? " (proyección)" : ""}</option>`).join("");
  $("resultados").hidden = false;
  renderTodo();
  setEstado(`Listo: ${ord.length} países con dato · ${FUENTES[ind.src].nombre} · ${new Date().toLocaleTimeString("es-CO")}`, "ok");
}

// ============================================================
//  RESULTADOS
// ============================================================
const CONT_ORDER = ["AF", "AS", "EU", "NA", "SA", "OC"];
const CONT_COLOR = {AF: "#d97706", AS: "#dc2626", EU: "#2563eb", NA: "#059669", SA: "#7c3aed", OC: "#0891b2"};
const CONT_RECT = {AF: [-20, 52, -37, 38], EU: [-25, 45, 34, 72], AS: [25, 150, -11, 78], NA: [-170, -52, 5, 84], SA: [-85, -33, -57, 14], OC: [110, 180, -50, 0]};
const contSel = () => $("fCont").value;
function vista() { const c = contSel(); return sel.size ? filas.filter(r => sel.has(r.iso)) : filas.filter(r => !r.agg && (!c || r.cc === c)); }
function estad(rows) {
  const v = rows.map(r => r.ult.v).sort((a, b) => a - b), n = v.length;
  const media = v.reduce((s, x) => s + x, 0) / n;
  const mediana = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1)) : 0;
  const max = rows.reduce((a, b) => b.ult.v > a.ult.v ? b : a), min = rows.reduce((a, b) => b.ult.v < a.ult.v ? b : a);
  return {n, media, mediana, sd, max, min};
}
function renderSinDato() {
  const faltan = [...sel].filter(i => !filas.some(r => r.iso === i)).map(i => (paisMap.get(i) || {nombre: i}).nombre);
  $("sinDato").textContent = faltan.length ? `Sin datos en este periodo: ${faltan.join(", ")}.` : "";
}

// ---------- TABLA ----------
function renderTabla() {
  const {k, asc} = orden;
  const f = [...vista()].sort((a, b) => {
    const x = k === "anio" ? a.ult.y : k === "valor" ? a.ult.v : a[k], y = k === "anio" ? b.ult.y : k === "valor" ? b.ult.v : b[k];
    if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
    const c = typeof x === "string" ? x.localeCompare(y, "es") : x - y;
    return asc ? c : -c;
  });
  $("tabla").innerHTML = f.map(r => `<tr><td>${esc(r.nombre)}</td><td>${esc(r.cont)}</td>
    <td class="n">${r.ult.y}${r.ult.f === "p" ? " (prov.)" : ""}</td><td class="n">${esc(fmtVal(r.ult.v, ind))}</td>
    <td class="n">${r.var === null ? "—" : (r.var > 0 ? "+" : "") + num(r.var, 1) + " %"}</td>
    <td class="n">${r.puesto ? r.puesto + " de " + D.nRank : "—"}</td></tr>`).join("");
}

// ============================================================
//  MAPA
// ============================================================
let mapPaths = new Map(), mapVals = new Map(), mapRank = new Map(), vb = null, vbBase = null, arrastre = null, movido = false;
function proyectar(lon, lat) {
  const l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  return [MAP.k * x, -MAP.k * y];
}
function initMapa() {
  const svg = $("mapa");
  vbBase = [...MAP.viewBox]; vb = [...MAP.viewBox];
  svg.setAttribute("viewBox", vb.join(" "));
  svg.style.aspectRatio = vb[2] + " / " + vb[3];
  svg.innerHTML = `<g>${MAP.shapes.map(([c, n, d], i) => `<path data-i="${i}" data-iso="${c}" d="${d}"/>`).join("")}</g><g id="gMarcas"></g>`;
  MAP.have = new Set(MAP.shapes.map(s => s[0]).filter(Boolean));
  const marcas = paises.filter(p => !p.agg && !MAP.have.has(p.iso) && isFinite(p.lat) && isFinite(p.lon))
    .map(p => { const [x, y] = proyectar(p.lon, p.lat); return `<circle data-iso="${p.iso}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`; }).join("");
  $("gMarcas").innerHTML = marcas;
  mapPaths = new Map();
  svg.querySelectorAll("[data-iso]").forEach(el => { const iso = el.dataset.iso; if (!iso) return; if (!mapPaths.has(iso)) mapPaths.set(iso, []); mapPaths.get(iso).push(el); });
  eventosMapa(svg);
}
function marcarSel() { const ver = sel.size <= 25; mapPaths.forEach((arr, iso) => arr.forEach(el => el.classList.toggle("sel", ver && sel.has(iso)))); }
function zoomContinente(c) {
  if (!vbBase) return;
  const R = CONT_RECT[c];
  if (!R) { vb = [...vbBase]; aplicarVB(); return; }
  const pts = [proyectar(R[0], R[3]), proyectar(R[1], R[3]), proyectar(R[0], R[2]), proyectar(R[1], R[2]), proyectar(R[0], 0), proyectar(R[1], 0)];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ar = vbBase[2] / vbBase[3];
  let w = (x1 - x0) * 1.08, h = (y1 - y0) * 1.08;
  if (w / h < ar) w = h * ar; else h = w / ar;
  w = Math.min(w, vbBase[2]); h = w / ar;
  vb = [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  limitarVB(); aplicarVB();
}

function makeScale(vals, modo, n = 7) {
  const s = vals.slice().sort((a, b) => a - b);
  const q = p => { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  let br = [];
  if (modo === "log" && s.filter(x => x > 0).length >= 2) {
    const pos = s.filter(x => x > 0), a = Math.log10(pos[0]), b = Math.log10(pos[pos.length - 1]);
    for (let i = 1; i < n; i++) br.push(Math.pow(10, a + (b - a) * i / n));
  } else if (modo === "lineal") {
    const a = q(.02), b = q(.98);
    for (let i = 1; i < n; i++) br.push(a + (b - a) * i / n);
  } else for (let i = 1; i < n; i++) br.push(q(i / n));
  br = [...new Set(br.map(x => +x.toPrecision(6)))].sort((a, b) => a - b);
  return {br, n: br.length + 1, min: s[0], max: s[s.length - 1], classOf: v => { let i = 0; while (i < br.length && v >= br[i]) i++; return i; }};
}
function paletaN(pal, n) {
  if (n >= 7) return pal;
  if (n === 1) return [pal[4]];
  return Array.from({length: n}, (_, i) => pal[Math.round(i * 6 / (n - 1))]);
}
function pintarMapa() {
  if (!D) return;
  const yr = $("mapaAnio").value, modo = $("mapaEscala").value;
  mapVals = new Map();
  filas.forEach(r => {
    if (r.agg || (contSel() && r.cc !== contSel())) return;
    if (yr === "ultimo") mapVals.set(r.iso, r.ult);
    else { const o = D.idx.get(r.iso).get(+yr); if (o) mapVals.set(r.iso, o); }
  });
  mapPaths.forEach((arr, iso) => { const p = paisMap.get(iso), fuera = !!contSel() && (!p || p.cont !== contSel()); arr.forEach(el => { el.style.fill = ""; el.classList.toggle("fuera", fuera); }); });
  const leyenda = $("leyenda");
  if (!mapVals.size) { leyenda.innerHTML = `<span>Sin datos para el año elegido.</span>`; $("notaMapa").textContent = ""; return; }
  const sc = makeScale([...mapVals.values()].map(p => p.v), modo), pal = paletaN(PALETAS[ind.tone], sc.n);
  mapVals.forEach((p, iso) => { const col = pal[sc.classOf(p.v)], arr = mapPaths.get(iso); if (arr) arr.forEach(el => { el.style.fill = col; }); });
  mapRank = new Map([...mapVals.entries()].sort((a, b) => b[1].v - a[1].v).map(([iso], i) => [iso, i + 1]));
  const bordes = [sc.min, ...sc.br, sc.max];
  leyenda.innerHTML = pal.slice(0, sc.n).map((c, i) => `<span><i style="background:${c}"></i>${esc(fmtVal(bordes[i], ind))} – ${esc(fmtVal(bordes[i + 1], ind))}</span>`).join("") +
    `<span><i style="background:#dfe3e8"></i>Sin datos</span>`;
  const proy = ind.src === "imf" && yr !== "ultimo" && +yr >= ANIO ? " (proyección del FMI)" : "";
  $("notaMapa").textContent = `${contSel() ? "Continente: " + CONT_NOMBRE[contSel()] + " · " : ""}${mapVals.size} países con dato${yr === "ultimo" ? " · se muestra el último año disponible de cada país (puede variar entre países)" : " en " + yr + proy}. ` +
    `Los círculos son países muy pequeños. Toca un país para compararlo; con la rueda o los botones + y − te acercas.`;
}
function aplicarVB() { $("mapa").setAttribute("viewBox", vb.map(n => +n.toFixed(2)).join(" ")); }
function limitarVB() { vb[0] = clamp(vb[0], vbBase[0], vbBase[0] + vbBase[2] - vb[2]); vb[1] = clamp(vb[1], vbBase[1], vbBase[1] + vbBase[3] - vb[3]); }
function zoomMapa(f, cx = .5, cy = .5) {
  const nw = clamp(vb[2] * f, vbBase[2] / 16, vbBase[2]), nh = nw * vbBase[3] / vbBase[2];
  vb[0] += (vb[2] - nw) * cx; vb[1] += (vb[3] - nh) * cy; vb[2] = nw; vb[3] = nh;
  limitarVB(); aplicarVB();
}
function eventosMapa(svg) {
  const tip = $("tip"), wrap = svg.parentElement;
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomMapa(e.deltaY < 0 ? .8 : 1.25, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, {passive: false});
  svg.addEventListener("pointerdown", e => { arrastre = {x: e.clientX, y: e.clientY, vb: [...vb]}; movido = false; });
  const fin = () => { arrastre = null; svg.classList.remove("arrastrando"); };
  svg.addEventListener("pointerup", fin); svg.addEventListener("pointerleave", () => { fin(); tip.style.display = "none"; });
  svg.addEventListener("pointermove", e => {
    if (arrastre) {
      const r = svg.getBoundingClientRect(), dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (Math.hypot(dx, dy) > 4) { movido = true; svg.classList.add("arrastrando"); }
      if (movido) { vb[0] = arrastre.vb[0] - dx / r.width * vb[2]; vb[1] = arrastre.vb[1] - dy / r.height * vb[3]; limitarVB(); aplicarVB(); tip.style.display = "none"; return; }
    }
    const el = e.target.closest ? e.target.closest("[data-iso]") : null;
    if (!el) { tip.style.display = "none"; return; }
    const iso = el.dataset.iso, p = paisMap.get(iso), p2 = mapVals.get(iso);
    const nombre = p ? p.nombre : (el.dataset.i !== undefined ? MAP.shapes[+el.dataset.i][1] : "");
    let h = `<b>${esc(nombre)}</b><br>`;
    if (p2) h += `${esc(fmtVal(p2.v, ind))}<br><small>${esc(ind.unit || "")}<br>${p2.y}${p2.f === "proy" ? " (proyección)" : ""} · puesto ${mapRank.get(iso)} de ${mapVals.size}</small>`;
    else h += `<small>${D ? "Sin datos para esta consulta" : ""}</small>`;
    tip.innerHTML = h; tip.style.display = "block";
    const r = wrap.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width) x = e.clientX - r.left - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > r.height) y = e.clientY - r.top - tip.offsetHeight - 14;
    tip.style.left = Math.max(0, x) + "px"; tip.style.top = Math.max(0, y) + "px";
  });
  svg.addEventListener("click", e => {
    if (movido) { movido = false; return; }
    const el = e.target.closest("[data-iso]");
    if (el && el.dataset.iso) toggleSel(el.dataset.iso);
  });
  $("zMas").addEventListener("click", () => zoomMapa(.7));
  $("zMenos").addEventListener("click", () => zoomMapa(1.4));
  $("zReset").addEventListener("click", () => { vb = [...vbBase]; aplicarVB(); });
}

// ============================================================
//  CSV
// ============================================================
function descargarCSV() {
  if (!D) return;
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const L = ["fuente;indicador;codigo;pais;iso3;continente;anio;valor;unidad;tipo"];
  filas.forEach(r => D.series.get(r.iso).forEach(s => L.push([q(FUENTES[ind.src].nombre), q(ind.name), q(ind.id), q(r.nombre), r.iso, q(r.cont), s.y, String(s.v).replace(".", ","), q(ind.unit || ""), s.f === "proy" ? "proyeccion" : s.f === "p" ? "provisional" : "dato"].join(";"))));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], {type: "text/csv;charset=utf-8"}));
  a.download = (ind.src + "_" + ind.id).replace(/[^\w.-]/g, "_") + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
}

// ============================================================
//  EVENTOS E INICIO
// ============================================================
function eventos() {
  eventosVistas(); eventosPaises(); eventosMiPais();
  $("alerta").addEventListener("click", e => { if (e.target.closest("[data-reintentar]")) consultar(); });
  $("tabsFuente").addEventListener("click", e => { const b = e.target.closest("button[data-src]"); if (b) cambiarFuente(b.dataset.src); });
  $("chipsCat").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; catFiltro = b.dataset.cat; renderChips(); renderCatalogo(); });
  $("buscarCat").addEventListener("input", renderCatalogo);
  $("catalogo").addEventListener("click", e => { const b = e.target.closest("button[data-key]"); if (b) elegirIndicador(REG.get(b.dataset.key)); });
  $("avanzado").addEventListener("toggle", () => { if ($("avanzado").open && !avzItems.length) abrirAvanzado(); });
  $("avzBuscar").addEventListener("input", renderAvanzado);
  $("avzDB").addEventListener("change", async () => { try { avzItems = await wbIndicadores($("avzDB").value); renderAvanzado(); } catch (e) { $("avzCont").textContent = explicarError(e, "Banco Mundial"); } });
  $("avzLista").addEventListener("change", () => {
    const it = avzItems.find(x => x.id === $("avzLista").value); if (it) elegirIndicador(indDesdeItem(it));
  });
  ["fIngreso", "verAgg"].forEach(id => $(id).addEventListener("change", filtrarPaises));
  $("fCont").addEventListener("change", onContChange);

  $("buscarPais").addEventListener("input", filtrarPaises);
  $("listaPaises").addEventListener("change", e => { if (e.target.checked) sel.add(e.target.value); else sel.delete(e.target.value); onSelChange(); });
  $("btnVisibles").addEventListener("click", () => { $("listaPaises").querySelectorAll("label:not([hidden]) input").forEach(c => sel.add(c.value)); onSelChange(); });
  $("btnLimpiar").addEventListener("click", () => { sel.clear(); onSelChange(); });
  $("btnMuestra").addEventListener("click", () => { sel.clear(); MUESTRA.forEach(i => sel.add(i)); onSelChange(); });
  $("desde").addEventListener("change", consultar); $("hasta").addEventListener("change", consultar);
  $("btnConsultar").addEventListener("click", consultar);
  $("mapaAnio").addEventListener("change", pintarMapa); $("mapaEscala").addEventListener("change", pintarMapa);
  $("btnCSV").addEventListener("click", descargarCSV);
  document.querySelector("#v-tabla thead").addEventListener("click", e => {
    const th = e.target.closest("th"); if (!th || !D) return;
    const k = th.dataset.k; orden = {k, asc: orden.k === k ? !orden.asc : (k === "nombre" || k === "cont" || k === "puesto")}; renderTabla();
  });
  window.addEventListener("unhandledrejection", e => setEstado("Error: " + ((e.reason && e.reason.message) || e.reason), "err"));
}

async function init() {
  aplicarTemaGuardado();
  $("oficinas").innerHTML = OFICINAS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join("");
  renderEstados(); renderTabsFuente(); renderChips(); renderCatalogo(); ajustarPeriodo(); eventos();
  setEstado("Conectando con el Banco Mundial…");
  try { await cargarPaises(); }
  catch (e) { estadoFuente.wb = "fail"; errFuente.wb = explicarError(e, "el Banco Mundial"); renderEstados(); setEstado("No se pudo conectar con el Banco Mundial: " + explicarError(e, "el Banco Mundial") + " Abre este archivo en Chrome, Edge o Firefox con internet activo (no en una vista previa).", "err"); return; }
  estadoFuente.wb = "ok"; renderEstados();
  initMapa();
  const H = leerHash(); sel.clear();
  if (H.p) H.p.split(",").forEach(i => { if (paisMap.has(i)) sel.add(i); });
  if (H.c && [...$("fCont").options].some(o => o.value === H.c)) { $("fCont").value = H.c; filtrarPaises(); }
  if (H.v && VISTAS.some(v => v.id === H.v)) VISTA = H.v;
  syncChecks();
  pingFuentes();
  elegirIndicador((H.i && REG.get(H.i)) || REG.get("wb:NY.GDP.PCAP.CD"), false);
  if (H.d && [...$("desde").options].some(o => o.value === H.d)) $("desde").value = H.d;
  if (H.h && [...$("hasta").options].some(o => o.value === H.h)) $("hasta").value = H.h;
  actualizarFrase(); poblarAddPais();
  if (H.m === "mipais") {
    if (H.p && paisMap.has(H.p.split(",")[0]) && !paisMap.get(H.p.split(",")[0]).agg) MP.iso = H.p.split(",")[0];
    entrarModo("mipais");
  } else if (H.m === "pais") {
    PS.sel = (H.p || "").split(",").filter(i => paisMap.has(i) && !paisMap.get(i).agg).slice(0, 4);
    if (["resumen", "ind", "evo"].includes(H.pv)) PS.vista = H.pv; if (H.pi) PS.evoId = H.pi; if (H.pm === "base") PS.evoModo = "base";
    entrarModo("paises");
  } else consultar();
}
init();
