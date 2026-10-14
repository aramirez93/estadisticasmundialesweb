// ============================================================
//  VISTAS: formas de mostrar los datos, resumen, hojas, tema y enlace
// ============================================================
const VS = {rankOrden: "mayor", rankN: "20", rankColor: "valor", evoModo: "real", evoN: "8", camVer: "abs", camN: "15", distEsc: "auto", distRes: "",
            calorModo: "global", calorN: "25", carreraN: "12", carreraVel: "700", contModo: "mediana", contVista: "barras", relY: "", relLogX: "no", relLogY: "no"};
let VISTA = "mapa", graficoCv = null, timerCarrera = null, relToken = 0, hojaAbierta = null, focoPrevio = null;
const relCache = new Map();
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const oscuro = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };

// Colores categóricos validados (azul, naranja, aqua, amarillo, magenta, verde, violeta, rojo) para tema claro / oscuro
const SERIE = [["#2a78d6", "#3987e5"], ["#eb6834", "#d95926"], ["#1baf7a", "#199e70"], ["#eda100", "#c98500"], ["#e87ba4", "#d55181"], ["#008300", "#008300"], ["#6250d6", "#9085e9"], ["#e34948", "#e66767"]];
const serieColor = i => SERIE[i % SERIE.length][oscuro() ? 1 : 0];
const CONT_IDX = {EU: 0, AF: 1, SA: 2, OC: 3, NA: 4, AS: 6};
const contColor = c => CONT_IDX[c] === undefined ? "#8a94a6" : serieColor(CONT_IDX[c]);
const CONT_FORMA = {EU: "circle", AF: "triangle", SA: "rect", OC: "rectRot", NA: "star", AS: "crossRot"};
const verTono = () => PALETAS[ind.tone][5];
const txtSobre = hex => { const n = parseInt(hex.slice(1), 16), L = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return L > 0.62 ? "#0f1b2d" : "#ffffff"; };
const leyendaCont = codes => CONT_ORDER.filter(c => codes.includes(c)).map(c => `<span class="lg"><i style="background:${contColor(c)}"></i>${esc(CONT_NOMBRE[c])}</span>`).join("");

const VISTAS = [
  {id: "mapa", n: "Mapa", ayuda: "Ideal para ver patrones geográficos: qué regiones tienen valores altos o bajos. Toca un país para compararlo."},
  {id: "ranking", n: "Ranking", ayuda: "Ideal para comparar países uno a uno, de mayor a menor, con el valor exacto al final de cada barra."},
  {id: "evolucion", n: "Evolución", ayuda: "Ideal para ver cómo cambia un dato con los años. El índice (primer año = 100) permite comparar países de tamaños muy distintos."},
  {id: "cambio", n: "Cambio", ayuda: "Cada país es una línea que va del primer al último año: se ve de dónde partió, a dónde llegó y cuánto cambió."},
  {id: "distribucion", n: "Distribución", ayuda: "Cuenta cuántos países caen en cada tramo de valores: ¿se parecen entre sí o hay mucha desigualdad?"},
  {id: "calor", n: "Calor", ayuda: "Cuadrícula de países por años: de un vistazo se ve cuándo subió o cayó cada uno y quién va por delante."},
  {id: "carrera", n: "Carrera", ayuda: "Animación año a año: los países se reordenan según su valor. Útil para ver quién adelanta a quién."},
  {id: "participacion", n: "Participación", ayuda: "Cada rectángulo es un país y su área es su peso en el total. Solo para datos que se pueden sumar (PIB, población…)."},
  {id: "continentes", n: "Continentes", ayuda: "Resume y compara los seis continentes entre sí."},
  {id: "relacion", n: "Relación", ayuda: "Cruza este dato con otro: ¿los países con más de uno tienen más (o menos) del otro?"},
  {id: "tabla", n: "Tabla", ayuda: "Todos los valores, ordenables, para revisar con calma."}
];
const CAN = {ranking: 1, evolucion: 1, cambio: 1, distribucion: 1, carrera: 1, continentes: 1, relacion: 1};

function esTotal() {
  if (!ind) return false;
  if (ind.k === "big") return true;
  if (ind.k === "auto" && filas.length) { const v = filas.filter(r => !r.agg).map(r => r.ult.v).sort((a, b) => a - b); return v.length > 0 && v[v.length >> 1] >= 1e6; }
  return false;
}
function vistaDisponible(id) {
  if (!D) return id === "mapa";
  if (id === "participacion") return esTotal();
  if (["evolucion", "cambio", "calor", "carrera"].includes(id)) return D.h - D.d >= 1;
  if (id === "relacion") return CATALOGO[srcActual].some(o => o.key !== ind.key);
  return true;
}
function sugeridas() {
  const s = new Set(["mapa"]);
  if (esTotal()) s.add("participacion"); else s.add("distribucion");
  if (D && D.h - D.d >= 5) s.add("evolucion");
  return s;
}
function renderBarraVistas() {
  const sg = sugeridas();
  $("vistas").innerHTML = VISTAS.map(v => `<button class="pill ${v.id === VISTA ? "on" : ""} ${sg.has(v.id) ? "rec" : ""}" data-v="${v.id}" ${vistaDisponible(v.id) ? "" : "disabled"} title="${esc(v.ayuda)}${sg.has(v.id) ? " (recomendada para este dato)" : ""}">${v.n}</button>`).join("");
  const on = $("vistas").querySelector(".on"); if (on && on.scrollIntoView) { try { on.scrollIntoView({block: "nearest", inline: "center"}); } catch (e) {} }
}

// ---------- controles por vista ----------
function ctrlDefs(v) {
  const paises = () => [["", "Ninguno"], ...vista().filter(r => r.ult).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(r => [r.iso, r.nombre])];
  switch (v) {
    case "ranking": return [{id: "rankOrden", t: "Orden", o: [["mayor", "De mayor a menor"], ["menor", "De menor a mayor"]]}, {id: "rankN", t: "Cuántos países", o: [["10", "10"], ["20", "20"], ["40", "40"], ["0", "Todos"]]}, {id: "rankColor", t: "Color", o: [["valor", "Un solo color"], ["cont", "Por continente"]]}];
    case "evolucion": return [{id: "evoModo", t: "Qué se grafica", o: [["real", "Valores reales"], ["base", "Índice (primer año = 100)"]]}].concat(sel.size ? [] : [{id: "evoN", t: "Países", o: [["5", "Los 5 más altos"], ["8", "Los 8 más altos"]]}]);
    case "cambio": return [{id: "camVer", t: "Qué mostrar", o: [["abs", "Mayor cambio relativo"], ["sube", "Mayores subidas"], ["baja", "Mayores caídas"]]}, {id: "camN", t: "Cuántos países", o: [["10", "10"], ["15", "15"], ["25", "25"]]}];
    case "distribucion": return [{id: "distEsc", t: "Escala", o: [["auto", "Automática"], ["lineal", "Lineal"], ["log", "Logarítmica"]]}, {id: "distRes", t: "Ubicar un país", o: paises()}];
    case "calor": return [{id: "calorModo", t: "Colores", o: [["global", "Comparar entre países"], ["fila", "Tendencia de cada país"]]}, {id: "calorN", t: "Países", o: [["15", "15"], ["25", "25"], ["40", "40"], ["80", "80"]]}];
    case "carrera": return [{id: "carreraN", t: "Países en la carrera", o: [["8", "8"], ["12", "12"], ["20", "20"]]}, {id: "carreraVel", t: "Velocidad", o: [["1200", "Lenta"], ["700", "Normal"], ["350", "Rápida"]]}];
    case "continentes": return [{id: "contModo", t: "Cómo se resume", o: [["mediana", "Mediana (país típico)"], ["media", "Media simple"]].concat(esTotal() ? [["suma", "Suma (total)"]] : [])}, {id: "contVista", t: "Forma", o: [["barras", "Comparar hoy (barras)"], ["linea", "Evolución (líneas)"]]}];
    case "relacion": return [{id: "relY", t: "Cruzar con", o: CATALOGO[srcActual].filter(o => o.key !== ind.key).map(o => [o.key, o.name])}, {id: "relLogX", t: "Eje horizontal", o: [["no", "Lineal"], ["si", "Logarítmico"]]}, {id: "relLogY", t: "Eje vertical", o: [["no", "Lineal"], ["si", "Logarítmico"]]}];
  }
  return [];
}
function renderCtrl(v) {
  const defs = ctrlDefs(v);
  if (v === "continentes" && !defs[0].o.some(x => x[0] === VS.contModo)) VS.contModo = "mediana";
  if (v === "relacion" && !defs[0].o.some(x => x[0] === VS.relY)) { const o = CATALOGO[srcActual].filter(x => x.key !== ind.key); VS.relY = (o.find(x => x.cat !== ind.cat) || o[0]).key; }
  if (v === "distribucion" && VS.distRes && !vista().some(r => r.iso === VS.distRes)) VS.distRes = "";
  $("ctrlVista").innerHTML = defs.map(d => `<label class="ctl">${esc(d.t)}<select data-k="${d.id}">${d.o.map(([val, t]) => `<option value="${esc(val)}" ${String(VS[d.id]) === String(val) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`).join("");
}

// ---------- gráficos: base común ----------
function okChart() {
  if (typeof Chart === "undefined") { $("avisoVista").textContent = "No se cargó la librería de gráficos (Chart.js). Revisa tu conexión y recarga; el mapa y la tabla sí funcionan."; return false; }
  return true;
}
function nuevoGrafico(cfg, alto) {
  if (graficoCv) { graficoCv.destroy(); graficoCv = null; }
  $("cajaCv").style.height = alto + "px";
  Chart.defaults.color = css("--suave"); Chart.defaults.font.family = css("--sans"); Chart.defaults.font.size = 12; Chart.defaults.borderColor = css("--linea");
  cfg.options = Object.assign({responsive: true, maintainAspectRatio: false}, cfg.options || {});
  graficoCv = new Chart($("cv"), cfg); return graficoCv;
}
const MOVIL = () => innerWidth < 560;
const corto = (t, n) => t.length > n ? t.slice(0, n - 1) + "…" : t;
const ejeValor = (f, unit) => ({ticks: {callback: v => f(v), maxRotation: 0, autoSkip: true, maxTicksLimit: MOVIL() ? 3 : 6}, title: {display: !!unit, text: unit}});
const plugValores = fmt => ({id: "valores", afterDatasetsDraw(ch) {
  const ctx = ch.ctx, horiz = ch.options.indexAxis === "y"; ctx.save(); ctx.fillStyle = css("--tinta"); ctx.font = `500 11px ${css("--sans")}`;
  ch.getDatasetMeta(0).data.forEach((el, i) => {
    const v = ch.data.datasets[0].data[i]; if (v === null || v === undefined) return; const t = fmt(v);
    if (horiz) { ctx.textBaseline = "middle"; ctx.textAlign = v >= 0 ? "left" : "right"; ctx.fillText(t, el.x + (v >= 0 ? 5 : -5), el.y); }
    else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(t, el.x, el.y - 3); }
  }); ctx.restore(); }});
const plugEtiquetasFin = () => ({id: "etiquetasFin", afterDatasetsDraw(ch) {
  const ctx = ch.ctx, it = [];
  ch.data.datasets.forEach((d, i) => { const m = ch.getDatasetMeta(i); if (m.hidden) return; for (let k = d.data.length - 1; k >= 0; k--) if (d.data[k] !== null && d.data[k] !== undefined) { it.push({x: m.data[k].x, y: m.data[k].y, t: d.label, c: d.borderColor}); break; } });
  it.sort((a, b) => a.y - b.y); for (let i = 1; i < it.length; i++) if (it[i].y - it[i - 1].y < 13) it[i].y = it[i - 1].y + 13;
  ctx.save(); ctx.font = `500 11px ${css("--sans")}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  it.forEach(p => { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x + 8, p.y, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = css("--tinta"); ctx.fillText(p.t.length > 17 ? p.t.slice(0, 16) + "…" : p.t, p.x + 15, p.y); });
  ctx.restore(); }});

// ---------- agregación por continente ----------
function agregarCont(vals, modo) {
  const v = vals.slice().sort((x, y) => x - y), n = v.length; if (!n) return null;
  if (modo === "suma") return v.reduce((s, x) => s + x, 0);
  if (modo === "media") return v.reduce((s, x) => s + x, 0) / n;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

// ============================================================
//  RESUMEN (titular, cifras clave, detalles)
// ============================================================
function actualizarFrase() {
  if (!$("fraseInd")) return;
  const c = contSel();
  $("fraseInd").textContent = ind ? ind.name : "una estadística";
  $("frasePais").textContent = sel.size ? (sel.size === 1 ? (paisMap.get([...sel][0]) || {nombre: "1 país"}).nombre : `${sel.size} países elegidos`) : c ? CONT_NOMBRE[c] : "todos los países";
  const d = $("desde").value, h = $("hasta").value;
  $("fraseTiempo").textContent = d && h ? `de ${d} a ${h}` : "de 2000 a hoy";
}
function renderResumen() {
  actualizarFrase();
  const rows = vista().filter(r => r.ult), f = v => fmtVal(v, ind);
  $("tituloRes").textContent = ind.name;
  $("subRes").textContent = "· " + [ind.unit, FUENTES[ind.src].nombre, `${D.d}–${D.h}`].filter(Boolean).join(" · ");
  const fl = D.link ? `<a href="${esc(D.link)}" target="_blank" rel="noopener">ver en la fuente</a>` : "";
  $("fuenteLinea").innerHTML = `Fuente: ${esc(FUENTES[ind.src].nombre)}${ind.org ? " (" + esc(ind.org) + ")" : ""} · indicador ${esc(ind.id)} · consultado ${new Date().toLocaleString("es-CO")}${D.updated ? " · fuente actualizada: " + esc(D.updated) : ""} · ${fl}`;
  renderSinDato();
  if (!rows.length) { $("titular").textContent = "No hay datos para esta selección."; $("stats").innerHTML = ""; $("stats2").innerHTML = ""; $("lectura").innerHTML = ""; return; }
  const e = estad(rows), c = contSel(), ambito = sel.size ? "En los países elegidos" : c ? "En " + CONT_NOMBRE[c] : "En el mundo";
  let t = rows.length === 1 ? `${rows[0].nombre}: ${f(rows[0].ult.v)} en ${rows[0].ult.y}.`
    : `${ambito}, el país típico tiene ${f(e.mediana)}. ${e.max.nombre} encabeza con ${f(e.max.ult.v)} y ${e.min.nombre} cierra con ${f(e.min.ult.v)}.`;
  const cv = rows.filter(r => r.var !== null && isFinite(r.var));
  if (cv.length >= 3) {
    const up = cv.filter(r => r.var > 0).length, down = cv.filter(r => r.var < 0).length;
    t += ind.tone === "good" ? ` ${up} de ${cv.length} países mejoraron en el periodo.` : ind.tone === "bad" ? ` ${down} de ${cv.length} países mejoraron en el periodo.` : ` ${up} de ${cv.length} países crecieron en el periodo.`;
  }
  $("titular").textContent = t;
  const tile = (a, b, s) => `<div class="tile"><small>${esc(a)}</small><b>${esc(b)}</b>${s ? `<span>${esc(s)}</span>` : ""}</div>`;
  $("stats").innerHTML = tile("Mediana", f(e.mediana), `${e.n} países con dato`) + tile("Más alto", f(e.max.ult.v), `${e.max.nombre} (${e.max.ult.y})`) + tile("Más bajo", f(e.min.ult.v), `${e.min.nombre} (${e.min.ult.y})`);
  const glob = (sel.size || c) ? estad(filas.filter(r => !r.agg)) : null;
  const mini = (a, b) => `<div>${esc(a)}<b>${esc(b)}</b></div>`;
  $("stats2").innerHTML = mini("Media", f(e.media)) + mini("Desviación estándar", f(e.sd)) + mini("Países en esta vista", String(e.n)) +
    (e.min.ult.v > 0 ? mini("Máximo ÷ mínimo", num(e.max.ult.v / e.min.ult.v, 1) + " veces") : "") + (glob ? mini("Mediana de todos los países", f(glob.mediana)) : "");
  const L = [];
  if (e.mediana > 0 && e.media > e.mediana * 1.5) L.push(`La media (${f(e.media)}) está muy por encima de la mediana (${f(e.mediana)}): unos pocos países con valores altos elevan el promedio. La mediana describe mejor al país típico.`);
  if (cv.length >= 3) {
    const sv = [...cv].sort((a, b) => b.var - a.var), s = r => (r.var > 0 ? "+" : "") + num(r.var, 1) + " %";
    L.push(`Entre ${D.d} y el último dato, la mayor variación fue la de <b>${esc(sv[0].nombre)}</b> (${s(sv[0])}) y la menor la de <b>${esc(sv[sv.length - 1].nombre)}</b> (${s(sv[sv.length - 1])}).`);
  }
  if (sel.size && sel.size <= 40) { const g = estad(filas.filter(r => !r.agg)); L.push(`${rows.filter(r => !r.agg && r.ult.v > g.mediana).length} de los ${rows.filter(r => !r.agg).length} países elegidos están por encima de la mediana mundial (${f(g.mediana)}).`); }
  $("lectura").innerHTML = L.length ? `<ul>${L.map(x => `<li>${x}</li>`).join("")}</ul>` : `<p class="nota">Sin observaciones adicionales para esta selección.</p>`;
}

// ============================================================
//  DESPACHO DE VISTAS
// ============================================================
function detenerCarrera() { if (timerCarrera) { clearInterval(timerCarrera); timerCarrera = null; } }
function renderTodo() {
  renderResumen();
  if (!vistaDisponible(VISTA)) VISTA = "mapa";
  renderBarraVistas(); renderVista({zoom: true}); marcarSel();
}
function renderVista(o = {}) {
  if (!D) return;
  detenerCarrera(); relToken++;
  const v = VISTA;
  $("v-mapa").hidden = v !== "mapa"; $("v-cv").hidden = !CAN[v]; $("v-html").hidden = !(v === "calor" || v === "participacion"); $("v-tabla").hidden = v !== "tabla";
  $("avisoVista").textContent = ""; $("extraVista").innerHTML = ""; $("htmlVista").innerHTML = "";
  if (graficoCv && !CAN[v]) { graficoCv.destroy(); graficoCv = null; }
  $("ayudaVista").textContent = (VISTAS.find(x => x.id === v) || {}).ayuda || "";
  renderCtrl(v);
  ({mapa: vMapa, ranking: vRanking, evolucion: vEvolucion, cambio: vCambio, distribucion: vDistribucion, calor: vCalor, carrera: vCarrera, participacion: vParticipacion, continentes: vContinentes, relacion: vRelacion, tabla: renderTabla}[v])(o);
  guardarHash();
}
function vMapa(o) { pintarMapa(); if (o && o.zoom) zoomContinente(contSel()); }
const sinDatosVista = t => { if (graficoCv) { graficoCv.destroy(); graficoCv = null; } $("cajaCv").style.height = "80px"; $("avisoVista").textContent = t; };

// ---------- RANKING ----------
function vRanking() {
  if (!okChart()) return;
  let rows = [...vista()].sort((a, b) => VS.rankOrden === "mayor" ? b.ult.v - a.ult.v : a.ult.v - b.ult.v);
  const total = rows.length, N = +VS.rankN; if (N && total > N) rows = rows.slice(0, N);
  if (!rows.length) return sinDatosVista("No hay países con dato en esta selección.");
  if (total > rows.length) $("avisoVista").textContent = `Se muestran ${rows.length} de ${total} países. Elige «Todos» o mira la tabla para ver el resto.`;
  const f = v => fmtVal(v, ind), porCont = VS.rankColor === "cont";
  nuevoGrafico({type: "bar", plugins: rows.length <= 40 ? [plugValores(f)] : [],
    data: {labels: rows.map(r => MOVIL() ? corto(r.nombre, 17) : `${r.nombre} (${r.ult.y})`), datasets: [{data: rows.map(r => r.ult.v), backgroundColor: rows.map(r => porCont ? contColor(r.cc) : verTono()), borderRadius: 4, borderSkipped: false, barPercentage: .78, categoryPercentage: .92}]},
    options: {indexAxis: "y", layout: {padding: {right: rows.length <= 40 ? (MOVIL() ? 62 : 96) : 10}}, plugins: {legend: {display: false}, tooltip: {callbacks: {title: c => rows[c[0].dataIndex].nombre + " (" + rows[c[0].dataIndex].ult.y + ")", label: c => f(c.parsed.x)}}},
      scales: {x: ejeValor(f, ind.unit), y: {grid: {display: false}}}}}, Math.max(300, rows.length * 26 + 70));
  if (porCont) $("extraVista").innerHTML = `<p class="nota">${leyendaCont(rows.map(r => r.cc))}</p>`;
}

// ---------- EVOLUCIÓN ----------
function vEvolucion() {
  if (!okChart()) return;
  let rows = vista().filter(r => r.ult).sort((a, b) => b.ult.v - a.ult.v);
  const total = rows.length, N = sel.size ? 8 : (+VS.evoN || 8);
  rows = rows.slice(0, N);
  if (!rows.length) return sinDatosVista("No hay países con dato en esta selección.");
  if (total > rows.length) $("avisoVista").textContent = sel.size ? `Se grafican 8 de los ${total} países elegidos (más líneas no se distinguen). El gráfico de calor permite ver muchos más.` : `Se grafican los ${rows.length} países con mayor valor de ${total}. Elige países concretos para compararlos.`;
  const labels = []; for (let y = D.d; y <= D.h; y++) labels.push(y);
  const base = VS.evoModo === "base", iProy = ind.src === "imf" ? labels.indexOf(ANIO) : -1;
  const ds = rows.map((r, i) => {
    const m = D.idx.get(r.iso); let b0 = null;
    if (base) { for (const y of labels) { const o = m.get(y); if (o) { b0 = o.v; break; } } if (!b0) return null; }
    const col = serieColor(i);
    return {label: r.nombre, borderColor: col, backgroundColor: col, spanGaps: true, tension: .2, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4,
      data: labels.map(y => { const o = m.get(y); return o ? (base ? o.v / b0 * 100 : o.v) : null; }),
      segment: iProy >= 0 ? {borderDash: c => c.p1DataIndex >= iProy ? [6, 4] : undefined} : undefined};
  }).filter(Boolean);
  const f = v => base ? num(v, 0) : fmtVal(v, ind);
  nuevoGrafico({type: "line", data: {labels, datasets: ds}, plugins: [plugEtiquetasFin()],
    options: {layout: {padding: {right: 118}}, interaction: {mode: "nearest", intersect: false, axis: "x"},
      plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f(c.parsed.y)}`}}},
      scales: {y: {ticks: {callback: v => f(v)}, title: {display: base || !!ind.unit, text: base ? `Índice (${labels[0]} = 100)` : ind.unit}}, x: {grid: {display: false}}}}}, 420);
  $("extraVista").innerHTML = `<p class="nota">${base ? "Cada línea parte de 100 en su primer año con dato: sube más rápido la que crece más, sin importar su tamaño." : ""}${iProy >= 0 ? " La parte punteada son proyecciones del FMI." : ""}</p>`;
}

// ---------- CAMBIO (dumbbell) ----------
function vCambio() {
  if (!okChart()) return;
  let rows = vista().filter(r => r.prim && r.ult && r.prim.y !== r.ult.y && r.var !== null && isFinite(r.var));
  if (rows.length < 2) return sinDatosVista("Se necesitan al menos dos países con dato en dos años distintos.");
  const total = rows.length;
  if (VS.camVer === "abs") rows.sort((a, b) => Math.abs(b.var) - Math.abs(a.var)); else if (VS.camVer === "sube") rows.sort((a, b) => b.var - a.var); else rows.sort((a, b) => a.var - b.var);
  rows = rows.slice(0, sel.size ? Math.min(40, rows.length) : +VS.camN).sort((a, b) => b.var - a.var);
  if (total > rows.length) $("avisoVista").textContent = `Se muestran ${rows.length} de ${total} países.`;
  const mejora = r => ind.tone === "bad" ? r.var < 0 : r.var > 0, col = r => mejora(r) ? serieColor(0) : serieColor(1), f = v => fmtVal(v, ind);
  const pl = {id: "puntas", afterDatasetsDraw(ch) {
    const ctx = ch.ctx, xs = ch.scales.x, m = ch.getDatasetMeta(0); ctx.save(); ctx.font = `600 11px ${css("--sans")}`; ctx.textBaseline = "middle";
    rows.forEach((r, i) => { const y = m.data[i].y, a = xs.getPixelForValue(r.prim.v), b = xs.getPixelForValue(r.ult.v), c = col(r);
      ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.fillStyle = css("--sup"); ctx.beginPath(); ctx.arc(a, y, 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(b, y, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = css("--tinta"); ctx.textAlign = "left"; ctx.fillText((r.var > 0 ? "+" : "") + num(r.var, Math.abs(r.var) < 10 ? 1 : 0) + " %", Math.max(a, b) + 12, y); });
    ctx.restore(); }};
  nuevoGrafico({type: "bar", plugins: [pl],
    data: {labels: rows.map(r => MOVIL() ? corto(r.nombre, 17) : r.nombre), datasets: [{data: rows.map(r => [r.prim.v, r.ult.v]), backgroundColor: rows.map(col), barThickness: 3, borderSkipped: false}]},
    options: {indexAxis: "y", layout: {padding: {right: 56}}, plugins: {legend: {display: false}, tooltip: {callbacks: {title: c => rows[c[0].dataIndex].nombre, label: c => { const r = rows[c.dataIndex]; return [`${r.prim.y}: ${f(r.prim.v)}`, `${r.ult.y}: ${f(r.ult.v)}`, `Cambio: ${r.var > 0 ? "+" : ""}${num(r.var, 1)} %`]; }}}},
      scales: {x: ejeValor(f, ind.unit), y: {grid: {display: false}}}}}, Math.max(300, rows.length * 28 + 70));
  const neutro = ind.tone === "neutral", a = neutro ? "Sube" : "Mejora", b = neutro ? "Baja" : "Empeora";
  $("extraVista").innerHTML = `<p class="nota"><span class="lg"><i style="background:${serieColor(0)}"></i>${a}</span><span class="lg"><i style="background:${serieColor(1)}"></i>${b}</span> Círculo vacío = primer dato del periodo · círculo lleno = último dato.</p>`;
}

// ---------- DISTRIBUCIÓN ----------
function vDistribucion() {
  if (!okChart()) return;
  const rows = vista().filter(r => r.ult), n = rows.length;
  if (n < 5) return sinDatosVista("Hacen falta al menos 5 países para mostrar una distribución. Quita la selección o elige un continente.");
  const vals = rows.map(r => r.ult.v), mn = Math.min(...vals), mx = Math.max(...vals), f = v => fmtVal(v, ind);
  if (mn === mx) return sinDatosVista("Todos los países tienen el mismo valor.");
  const useLog = mn > 0 && (VS.distEsc === "log" || (VS.distEsc === "auto" && mx / mn >= 60));
  const T = v => useLog ? Math.log10(v) : v, nb = clamp(Math.round(Math.sqrt(n) * 1.3), 8, 16), t0 = T(mn), w = (T(mx) - t0) / nb;
  const bin = v => Math.min(nb - 1, Math.floor((T(v) - t0) / w)), inv = t => useLog ? Math.pow(10, t) : t;
  const edges = Array.from({length: nb + 1}, (_, i) => inv(t0 + w * i)), counts = Array(nb).fill(0), miembros = Array.from({length: nb}, () => []);
  rows.forEach(r => { const b = bin(r.ult.v); counts[b]++; miembros[b].push(r); });
  const med = estad(rows).mediana, hr = VS.distRes ? rows.find(r => r.iso === VS.distRes) : null, hb = hr ? bin(hr.ult.v) : -1;
  const pm = {id: "mediana", afterDatasetsDraw(ch) {
    const ctx = ch.ctx, a = ch.chartArea, pos = clamp((T(med) - t0) / w - 0.5, -0.5, nb - 0.5), x = ch.scales.x.getPixelForValue(pos);
    ctx.save(); ctx.strokeStyle = css("--tinta"); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--tinta"); ctx.font = `600 11px ${css("--sans")}`; ctx.textAlign = x > a.left + a.width * .8 ? "right" : "left"; ctx.fillText("Mediana " + f(med), x + (ctx.textAlign === "left" ? 5 : -5), a.top + 10); ctx.restore(); }};
  nuevoGrafico({type: "bar", plugins: [pm],
    data: {labels: edges.slice(0, nb).map(e => f(e)), datasets: [{data: counts, backgroundColor: counts.map((_, i) => i === hb ? serieColor(1) : verTono()), borderRadius: 3, barPercentage: .96, categoryPercentage: 1}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {title: c => `${f(edges[c[0].dataIndex])} a ${f(edges[c[0].dataIndex + 1])}`, label: c => `${c.parsed.y} países`,
        afterBody: c => { const m = miembros[c[0].dataIndex].sort((a, b) => b.ult.v - a.ult.v), t = m.slice(0, 6).map(r => r.nombre); return t.join(", ") + (m.length > 6 ? ` y ${m.length - 6} más` : ""); }}}},
      scales: {y: {ticks: {precision: 0}, title: {display: true, text: "Número de países"}}, x: {grid: {display: false}, title: {display: !!ind.unit, text: (ind.unit || "") + (useLog ? " · escala logarítmica" : "")}, ticks: {maxRotation: 50, autoSkip: true}}}}}, 400);
  let msg = `Mediana: ${f(med)} · ${n} países.`;
  if (useLog) msg += " Como los valores son muy desiguales, los tramos usan escala logarítmica (cada tramo multiplica el anterior).";
  if (hr) msg += ` ${hr.nombre} (${f(hr.ult.v)}) supera al ${num(rows.filter(r => r.ult.v < hr.ult.v).length / n * 100, 0)} % de los países de esta vista.`;
  $("extraVista").innerHTML = `<p class="nota">${esc(msg)}</p>`;
}

// ---------- CALOR (país × año) ----------
function vCalor() {
  let rows = vista().filter(r => r.ult).sort((a, b) => b.ult.v - a.ult.v);
  const total = rows.length; rows = sel.size ? rows.slice(0, 80) : rows.slice(0, +VS.calorN);
  if (!rows.length) { $("htmlVista").innerHTML = ""; $("avisoVista").textContent = "No hay países con dato en esta selección."; return; }
  if (total > rows.length) $("avisoVista").textContent = `Se muestran ${rows.length} de ${total} países (los de mayor valor). Elige países concretos o un continente para ver otros.`;
  const nY = D.h - D.d + 1, step = Math.max(1, Math.ceil(nY / 26)), ys = []; for (let y = D.d; y <= D.h; y += step) ys.push(y); if (ys[ys.length - 1] !== D.h) ys.push(D.h);
  const val = (iso, y) => { const m = D.idx.get(iso); for (let k = 0; k < step; k++) { const o = m.get(y - k); if (o) return o.v; } return null; };
  const M = rows.map(r => ys.map(y => val(r.iso, y))), todos = M.flat().filter(v => v !== null);
  const sc = makeScale(todos, "cuantiles"), pal = PALETAS[ind.tone], palG = paletaN(pal, sc.n), f = v => fmtVal(v, ind), fila = VS.calorModo === "fila";
  const color = (v, i) => { if (v === null) return ""; if (!fila) return palG[sc.classOf(v)]; const a = M[i].filter(x => x !== null), mn = Math.min(...a), mx = Math.max(...a); return pal[mx === mn ? 3 : Math.min(6, Math.floor((v - mn) / (mx - mn) * 6.999))]; };
  $("htmlVista").innerHTML = `<div class="calor-wrap"><table class="calor"><thead><tr><th class="rn"></th>${ys.map(y => `<th class="y">${y}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r, i) => `<tr><th class="rn">${esc(r.nombre)}</th>${ys.map((y, k) => { const v = M[i][k]; return `<td ${v === null ? "" : `style="background:${color(v, i)}" title="${esc(r.nombre)} · ${y}: ${esc(f(v))}"`}></td>`; }).join("")}</tr>`).join("") + `</tbody></table></div>`;
  $("extraVista").innerHTML = `<div class="barra-esc">menor ${pal.map(c => `<i style="background:${c}"></i>`).join("")} mayor<span>· ${fila ? "cada fila usa su propia escala: muestra cuándo subió o bajó, no cuánto vale" : "mismos colores para todos los países: se pueden comparar entre sí"}. Casillas vacías = sin dato.</span></div>`;
}

// ---------- CARRERA ----------
function vCarrera() {
  if (!okChart()) return;
  const years = []; for (let y = D.d; y <= Math.min(D.h, D.ultimoReal); y++) years.push(y);
  const rows = vista();
  if (years.length < 2 || rows.length < 3) return sinDatosVista("Se necesitan al menos 3 países y 2 años para la carrera.");
  const N = +VS.carreraN, f = v => fmtVal(v, ind);
  const serie = rows.map(r => { const m = D.idx.get(r.iso); let last = null, ly = -1e9; return {r, vals: years.map(y => { const o = m.get(y); if (o) { last = o.v; ly = y; return o.v; } return last !== null && y - ly <= 3 ? last : null; })}; });
  const frame = i => serie.map(s => ({r: s.r, v: s.vals[i]})).filter(x => x.v !== null).sort((a, b) => b.v - a.v).slice(0, N);
  let gmax = 0; years.forEach((_, i) => { const t = frame(i)[0]; if (t && t.v > gmax) gmax = t.v; });
  let idx = years.length - 1;
  const pa = {id: "anio", afterDraw(ch) { const a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.fillStyle = css("--tinta"); ctx.globalAlpha = .16; ctx.font = `600 ${Math.min(96, a.height * .28)}px ${css("--serif")}`; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(years[idx], a.right - 8, a.bottom - 6); ctx.restore(); }};
  const ch = nuevoGrafico({type: "bar", plugins: [plugValores(f), pa],
    data: {labels: [], datasets: [{data: [], backgroundColor: [], borderRadius: 4, borderSkipped: false, barPercentage: .8, categoryPercentage: .92}]},
    options: {indexAxis: "y", animation: {duration: 450}, layout: {padding: {right: MOVIL() ? 62 : 96}}, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => f(c.parsed.x)}}},
      scales: {x: Object.assign(ejeValor(f, ""), {max: gmax * 1.06}), y: {grid: {display: false}}}}}, Math.max(300, N * 28 + 70));
  const poner = i => { idx = i; const fr = frame(i), d = ch.data.datasets[0]; ch.data.labels = fr.map(x => MOVIL() ? corto(x.r.nombre, 17) : x.r.nombre); d.data = fr.map(x => x.v); d.backgroundColor = fr.map(x => contColor(x.r.cc)); ch.update(); $("carAnio").textContent = years[i]; $("carRango").value = i; };
  $("extraVista").innerHTML = `<div class="repro"><button class="btn" id="carPlay">▶ Reproducir</button><input type="range" id="carRango" min="0" max="${years.length - 1}" value="${idx}" aria-label="Año"><b id="carAnio">${years[idx]}</b></div><p class="nota">${leyendaCont(rows.map(r => r.cc))}<br>Si a un país le falta el dato de un año, se mantiene su último valor (hasta 3 años).</p>`;
  poner(idx);
  const parar = () => { detenerCarrera(); $("carPlay").textContent = "▶ Reproducir"; };
  $("carPlay").onclick = () => {
    if (timerCarrera) return parar();
    if (idx >= years.length - 1) poner(0);
    $("carPlay").textContent = "❚❚ Pausar";
    timerCarrera = setInterval(() => { if (idx >= years.length - 1) return parar(); poner(idx + 1); }, +VS.carreraVel);
  };
  $("carRango").oninput = e => { parar(); poner(+e.target.value); };
}

// ---------- PARTICIPACIÓN (treemap) ----------
function squarify(items, x, y, w, h) {
  const out = []; let rest = items.slice();
  while (rest.length) {
    const short = Math.min(w, h); let row = [rest[0]], s = rest[0].a, i = 1;
    const peor = (r, t) => { const mx = Math.max(...r.map(q => q.a)), mn = Math.min(...r.map(q => q.a)); return Math.max(short * short * mx / (t * t), t * t / (short * short * mn)); };
    while (i < rest.length) { const nr = row.concat(rest[i]), ns = s + rest[i].a; if (peor(nr, ns) <= peor(row, s)) { row = nr; s = ns; i++; } else break; }
    const th = s / short;
    if (w >= h) { let yy = y; row.forEach(r => { const hh = r.a / th; out.push(Object.assign({}, r, {x, y: yy, w: th, h: hh})); yy += hh; }); x += th; w -= th; }
    else { let xx = x; row.forEach(r => { const ww = r.a / th; out.push(Object.assign({}, r, {x: xx, y, w: ww, h: th})); xx += ww; }); y += th; h -= th; }
    rest = rest.slice(row.length);
  }
  return out;
}
function vParticipacion() {
  const rows = vista().filter(r => r.ult.v > 0).sort((a, b) => b.ult.v - a.ult.v);
  if (rows.length < 3) { $("avisoVista").textContent = "Hacen falta al menos 3 países con valores positivos."; return; }
  const tot = rows.reduce((s, r) => s + r.ult.v, 0), items = rows.slice(0, 40).map(r => ({v: r.ult.v, n: r.nombre, c: r.cc})), resto = rows.slice(40);
  if (resto.length) items.push({v: resto.reduce((s, r) => s + r.ult.v, 0), n: `Otros ${resto.length} países`, c: ""});
  $("htmlVista").innerHTML = `<div class="treemap" id="tm"></div>`;
  const tm = $("tm"), W = tm.clientWidth || 640, H = Math.round(clamp(W * .62, 340, 620)), sc = W * H / tot; tm.style.height = H + "px";
  tm.innerHTML = squarify(items.map(i => Object.assign({}, i, {a: i.v * sc})), 0, 0, W, H).map(b => {
    const col = b.c ? contColor(b.c) : css("--sindato"), tc = b.c ? txtSobre(col) : css("--tinta"), pct = b.v / tot * 100, grande = b.w > 74 && b.h > 42;
    return `<div title="${esc(b.n)}: ${esc(fmtVal(b.v, ind))} (${num(pct, 1)} %)" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;background:${col};color:${tc}">${grande ? `<b>${esc(b.n)}</b><span>${num(pct, pct < 10 ? 1 : 0)} %</span>` : ""}</div>`; }).join("");
  const top3 = items.slice(0, 3), p3 = top3.reduce((s, i) => s + i.v, 0) / tot * 100;
  $("avisoVista").textContent = `${top3.map(i => i.n).join(", ")} suman el ${num(p3, 0)} % del total de esta vista. El área de cada rectángulo es proporcional a su valor.`;
  $("extraVista").innerHTML = `<p class="nota">${leyendaCont(rows.map(r => r.cc))}</p>`;
}

// ---------- CONTINENTES ----------
function vContinentes() {
  const G = {}; CONT_ORDER.forEach(c => { G[c] = []; });
  filas.forEach(r => { if (!r.agg && G[r.cc]) G[r.cc].push(r); });
  const activos = CONT_ORDER.filter(c => G[c].length), f = v => fmtVal(v, ind), puedeSuma = esTotal(), modo = VS.contModo, nombreModo = {mediana: "Mediana", media: "Media", suma: "Suma"}[modo];
  if (!activos.length) return sinDatosVista("No hay datos por continente.");
  $("extraVista").innerHTML = `<div class="tabla-box" style="margin-top:12px"><table><thead><tr><th>Continente</th><th class="n">Países</th><th class="n">Mediana</th><th class="n">Media</th><th class="n">Mínimo</th><th class="n">Máximo</th>${puedeSuma ? '<th class="n">Suma</th>' : ""}</tr></thead><tbody>` +
    activos.map(c => { const rs = G[c], e = estad(rs), tot = rs.reduce((s, r) => s + r.ult.v, 0);
      return `<tr><td><i class="pt" style="background:${contColor(c)}"></i>${esc(CONT_NOMBRE[c])}</td><td class="n">${e.n}</td><td class="n">${esc(f(e.mediana))}</td><td class="n">${esc(f(e.media))}</td><td class="n">${esc(f(e.min.ult.v))}<br><small>${esc(e.min.nombre)}</small></td><td class="n">${esc(f(e.max.ult.v))}<br><small>${esc(e.max.nombre)}</small></td>${puedeSuma ? `<td class="n">${esc(f(tot))}</td>` : ""}</tr>`; }).join("") + `</tbody></table></div>`;
  $("avisoVista").textContent = "La media simple trata igual a un país pequeño que a uno enorme; la mediana representa mejor al país típico. Se usa el último dato de cada país, que puede ser de años distintos.";
  if (!okChart()) return;
  const eje = {title: {display: !!ind.unit, text: ind.unit}, ticks: {callback: v => f(v)}};
  if (VS.contVista === "barras") {
    const d = activos.map(c => ({c, v: agregarCont(G[c].map(r => r.ult.v), modo), n: G[c].length})).sort((a, b) => b.v - a.v);
    nuevoGrafico({type: "bar", plugins: [plugValores(f)], data: {labels: d.map(x => `${CONT_NOMBRE[x.c]} (${x.n})`), datasets: [{data: d.map(x => x.v), backgroundColor: d.map(x => contColor(x.c)), borderRadius: 5, borderSkipped: false, barPercentage: .7}]},
      options: {layout: {padding: {top: 22}}, plugins: {legend: {display: false}, title: {display: true, text: `${nombreModo} por continente`}, tooltip: {callbacks: {label: c => f(c.parsed.y)}}}, scales: {y: eje, x: {grid: {display: false}}}}}, 380);
  } else {
    const labels = []; for (let y = D.d; y <= D.h; y++) labels.push(y);
    const iProy = ind.src === "imf" ? labels.indexOf(ANIO) : -1;
    const ds = activos.map(c => { const iso = G[c].map(r => r.iso), min = modo === "suma" ? Math.ceil(iso.length * .8) : Math.min(3, iso.length);
      return {label: CONT_NOMBRE[c], borderColor: contColor(c), backgroundColor: contColor(c), tension: .2, borderWidth: 2.4, pointRadius: 0, pointHoverRadius: 4,
        data: labels.map(y => { const v = iso.map(i => { const o = D.idx.get(i).get(y); return o ? o.v : null; }).filter(x => x !== null); return v.length >= min ? agregarCont(v, modo) : null; }),
        segment: iProy >= 0 ? {borderDash: x => x.p1DataIndex >= iProy ? [6, 4] : undefined} : undefined}; });
    nuevoGrafico({type: "line", data: {labels, datasets: ds}, plugins: [plugEtiquetasFin()],
      options: {layout: {padding: {right: 118}}, interaction: {mode: "nearest", intersect: false, axis: "x"}, plugins: {legend: {display: false}, title: {display: true, text: `${nombreModo} por continente`}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f(c.parsed.y)}`}}}, scales: {y: eje, x: {grid: {display: false}}}}}, 400);
    $("avisoVista").textContent += " Un año solo se calcula si hay datos de " + (modo === "suma" ? "al menos el 80 % de los países del continente" : "3 países o más del continente") + ".";
  }
}

// ---------- RELACIÓN (dispersión entre dos estadísticas) ----------
const pearson = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return {r: sxy / Math.sqrt(sxx * syy), b: sxy / sxx, a: my - sxy / sxx * mx}; };
async function vRelacion() {
  if (!okChart()) return;
  const tok = ++relToken, oy = REG.get(VS.relY) || CATALOGO[srcActual].find(o => o.key === VS.relY);
  if (!oy) return sinDatosVista("No hay otra estadística con la cual cruzar.");
  sinDatosVista("Cargando la segunda estadística…");
  const ck = oy.key + "|" + D.d + "|" + D.h; let R = relCache.get(ck);
  if (!R) { try { R = await ADAPT[oy.src](oy, D.d, D.h); relCache.set(ck, R); } catch (e) { if (tok === relToken) sinDatosVista("No se pudo consultar la segunda estadística: " + explicarError(e, FUENTES[oy.src].corto)); return; } }
  if (tok !== relToken || VISTA !== "relacion") return;
  $("avisoVista").textContent = "";
  const ultY = oy.src === "imf" ? ANIO - 1 : 9999, pts = [];
  vista().forEach(r => { const s = R.series.get(r.iso); if (!s) return; const a = s.filter(x => x.y <= ultY).sort((p, q) => p.y - q.y); if (!a.length) return; const u = a[a.length - 1]; pts.push({x: r.ult.v, y: u.v, n: r.nombre, c: r.cc, ax: r.ult.y, ay: u.y, iso: r.iso}); });
  if (pts.length < 5) return sinDatosVista("Hay menos de 5 países con dato en ambas estadísticas. Prueba con otro cruce o quita la selección.");
  let lx = VS.relLogX === "si", ly = VS.relLogY === "si", aviso = "";
  if (lx && pts.some(p => p.x <= 0)) { lx = false; aviso += " El eje horizontal tiene valores ≤ 0: se muestra lineal."; }
  if (ly && pts.some(p => p.y <= 0)) { ly = false; aviso += " El eje vertical tiene valores ≤ 0: se muestra lineal."; }
  const tx = v => lx ? Math.log10(v) : v, ty = v => ly ? Math.log10(v) : v, P = pearson(pts.map(p => tx(p.x)), pts.map(p => ty(p.y)));
  const sinLab = new Set(); if (sel.size) pts.forEach(p => { if (sel.has(p.iso)) sinLab.add(p.iso); }); else { [...pts].sort((a, b) => b.x - a.x).slice(0, 3).concat([...pts].sort((a, b) => b.y - a.y).slice(0, 3)).forEach(p => sinLab.add(p.iso)); }
  const fx = v => fmtVal(v, ind), fy = v => fmtVal(v, oy), conts = CONT_ORDER.filter(c => pts.some(p => p.c === c));
  const ds = conts.map(c => ({type: "scatter", label: CONT_NOMBRE[c], data: pts.filter(p => p.c === c), pointStyle: CONT_FORMA[c], pointRadius: 5.5, pointHoverRadius: 8, backgroundColor: contColor(c) + "cc", borderColor: contColor(c), borderWidth: 1.8, order: 1}));
  const xs = pts.map(p => tx(p.x)), x0 = Math.min(...xs), x1 = Math.max(...xs), tr = [];
  for (let i = 0; i <= 40; i++) { const t = x0 + (x1 - x0) * i / 40; tr.push({x: lx ? Math.pow(10, t) : t, y: ly ? Math.pow(10, P.a + P.b * t) : P.a + P.b * t}); }
  ds.push({type: "line", label: "Tendencia", data: tr, borderColor: css("--suave"), borderDash: [6, 5], borderWidth: 1.6, pointRadius: 0, order: 5, tension: 0});
  const pl = {id: "etq", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = `500 11px ${css("--sans")}`; ctx.fillStyle = css("--tinta"); ctx.textBaseline = "middle";
    ch.data.datasets.forEach((d, i) => { if (d.type !== "scatter") return; ch.getDatasetMeta(i).data.forEach((el, k) => { const p = d.data[k]; if (sinLab.has(p.iso)) ctx.fillText(p.n, el.x + 8, el.y - 6); }); }); ctx.restore(); }};
  const ejeT = (o, log) => ({type: log ? "logarithmic" : "linear", title: {display: true, text: o.name + (o.unit ? ` (${o.unit})` : "") + (log ? " · escala log." : "")}});
  nuevoGrafico({type: "scatter", data: {datasets: ds}, plugins: [pl],
    options: {layout: {padding: {right: 40}}, plugins: {legend: {labels: {usePointStyle: true, filter: i => i.text !== "Tendencia"}}, tooltip: {filter: c => c.dataset.type === "scatter", callbacks: {title: c => c[0].raw.n, label: c => [`${ind.name}: ${fx(c.raw.x)} (${c.raw.ax})`, `${oy.name}: ${fy(c.raw.y)} (${c.raw.ay})`]}}},
      scales: {x: Object.assign(ejeT(ind, lx), {ticks: {callback: v => fx(v)}}), y: Object.assign(ejeT(oy, ly), {ticks: {callback: v => fy(v)}})}}}, 480);
  const r = P.r, ar = Math.abs(r), fuerza = ar < .2 ? "muy débil" : ar < .4 ? "débil" : ar < .6 ? "moderada" : ar < .8 ? "fuerte" : "muy fuerte";
  $("extraVista").innerHTML = `<p class="nota"><b>Correlación r = ${num(r, 2)}</b> (${fuerza}, ${r >= 0 ? "positiva" : "negativa"}) en ${pts.length} países${lx || ly ? " · calculada sobre la escala logarítmica elegida" : ""}. Que dos datos vayan juntos no prueba que uno cause el otro. Cada continente tiene su color y su forma.${esc(aviso)}</p>`;
}

// ============================================================
//  HOJAS, TEMA Y ENLACE
// ============================================================
function abrirHoja(n) {
  const h = $("hoja-" + n); if (!h) return;
  document.querySelectorAll(".hoja").forEach(x => { x.hidden = true; });
  focoPrevio = document.activeElement; h.hidden = false; hojaAbierta = h; document.body.style.overflow = "hidden";
  const c = h.querySelector(".hoja-cab .icono"); if (c) c.focus();
}
function cerrarHojas() {
  document.querySelectorAll(".hoja").forEach(x => { x.hidden = true; }); hojaAbierta = null; document.body.style.overflow = "";
  if (focoPrevio && focoPrevio.focus) { try { focoPrevio.focus(); } catch (e) {} } focoPrevio = null;
}
function alternarTema() {
  const t = oscuro() ? "light" : "dark"; document.documentElement.dataset.theme = t;
  try { localStorage.setItem("tema", t); } catch (e) {}
  if (D) renderVista({});
}
function aplicarTemaGuardado() { try { const t = localStorage.getItem("tema"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) {} }
function guardarHash() {
  try {
    const p = new URLSearchParams(); if (ind) p.set("i", ind.key); p.set("v", VISTA);
    if (contSel()) p.set("c", contSel()); if (sel.size) p.set("p", [...sel].join(","));
    p.set("d", $("desde").value); p.set("h", $("hasta").value); history.replaceState(null, "", "#" + p.toString());
  } catch (e) {}
}
function leerHash() { try { return Object.fromEntries(new URLSearchParams(location.hash.slice(1))); } catch (e) { return {}; } }
async function copiarEnlace() {
  guardarHash(); const m = $("msgEnlace");
  try { await navigator.clipboard.writeText(location.href); m.textContent = "Enlace copiado."; } catch (e) { m.textContent = "Copia la dirección del navegador: ya incluye esta vista."; }
  setTimeout(() => { m.textContent = ""; }, 4000);
}
function eventosVistas() {
  document.addEventListener("click", e => {
    const s = e.target.closest("[data-hoja]"); if (s) { abrirHoja(s.dataset.hoja); return; }
    if (e.target.closest("[data-cerrar]")) cerrarHojas();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && hojaAbierta) cerrarHojas(); });
  $("vistas").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b && !b.disabled) { VISTA = b.dataset.v; renderBarraVistas(); renderVista({zoom: true}); } });
  $("ctrlVista").addEventListener("change", e => { const k = e.target.dataset.k; if (!k) return; VS[k] = e.target.value; renderVista({}); });
  $("btnTema").addEventListener("click", alternarTema);
  $("btnEnlace").addEventListener("click", copiarEnlace);
  $("btnConsultar").addEventListener("click", cerrarHojas);
  let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (D && VISTA === "participacion") renderVista({}); }, 250); });
}
