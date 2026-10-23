// ============================================================
//  PÁGINAS DE PAÍS Y COMPARADOR (hasta 4 países)
// ============================================================
const PERFIL = ["NY.GDP.MKTP.CD", "NY.GDP.PCAP.CD", "NY.GDP.MKTP.KD.ZG", "FP.CPI.TOTL.ZG", "SP.POP.TOTL", "SP.URB.TOTL.IN.ZS", "SP.DYN.TFRT.IN", "SP.POP.65UP.TO.ZS",
  "SP.DYN.LE00.IN", "SP.DYN.IMRT.IN", "SH.XPD.CHEX.GD.ZS", "SE.ADT.LITR.ZS", "SE.SEC.ENRR", "SL.UEM.TOTL.ZS", "SL.TLF.CACT.FE.ZS", "SI.POV.GINI", "IT.NET.USER.ZS", "EG.ELC.RNEW.ZS",
  "imf:GGXWDG_NGDP", "imf:GGXCNL_NGDP", "imf:BCA_NGDPD", "imf:rev", "imf:exp", "imf:ie", "imf:pb", "imf:HH_ALL"];   // los «imf:» vienen del FMI (copia local del sitio)
const fmiNoDisp = new Set();                // indicadores del FMI cuya copia local no existe todavía
const SUGERENCIAS = [["COL", "MEX"], ["ARG", "CHL"], ["ESP", "PRT"], ["BRA", "ARG"], ["USA", "CHN"], ["COL", "PER", "ECU"]];
const TITULO = document.title;
let modo = "explorar", psToken = 0, mundoCache = null;
const PS = {sel: [], vista: "resumen", evoId: "NY.GDP.PCAP.CD", evoModo: "real"};
const histCache = new Map();               // iso3 -> Map(idIndicador -> [{y,v}])
const perfilInds = () => PERFIL.map(id => REG.get(id.includes(":") ? id : "wb:" + id)).filter(o => o && !fmiNoDisp.has(o.key));
const nombreInd = o => o.name + (o.src === "imf" ? " (FMI)" : "");
const AYUDA_P = {resumen: "El radar muestra, en cada tema, qué porcentaje de los países del mundo queda por debajo (más afuera = mejor posición; donde «menos es mejor» se invierte). La línea punteada es la mediana mundial.",
                 ind: "Último dato disponible de cada país, su puesto en el mundo y la tendencia reciente. ✓ marca el mejor valor del grupo cuando hay un «mejor» claro.",
                 evo: "Evolución de un indicador. El índice (primer año = 100) permite comparar países de tamaños muy distintos. La línea punteada es una estimación o proyección del FMI."};

// ---------- datos ----------
async function filasFmi(o, isos) {            // filas con la forma del Banco Mundial, a partir de la copia local del FMI
  const vals = await mpFmiValores(o.id); if (!vals) { fmiNoDisp.add(o.key); return []; }
  const sc = o.scale || 1, rows = [];
  isos.forEach(iso => { const sr = vals[iso]; if (sr) Object.entries(sr).forEach(([y, v]) => { const n = Number(v) * sc; if (!isNaN(n)) rows.push({countryiso3code: iso, date: y, value: n, fmi: +y >= ANIO}); }); });
  return rows;
}
async function cargarHist(isos) {
  const faltan = isos.filter(i => !histCache.has(i)); if (!faltan.length) return;
  const inds = perfilInds(), l2 = faltan.map(i => paisMap.get(i).iso2).join(";");
  const res = await Promise.all(inds.map(o => o.src === "imf" ? filasFmi(o, faltan) : wbAll(`/country/${l2}/indicator/${o.id}`, {date: `${ANIO - 35}:${ANIO}`, per_page: 2000}).then(r => r.rows, () => null)));
  if (inds.every((o, k) => o.src === "imf" || res[k] === null)) throw new Error("No se pudo consultar el Banco Mundial.");
  faltan.forEach(i => histCache.set(i, new Map()));
  res.forEach((rows, k) => (rows || []).forEach(x => {
    if (x.value === null || x.value === undefined) return;
    const m = histCache.get(x.countryiso3code); if (!m) return;
    const id = inds[k].id; if (!m.has(id)) m.set(id, []); m.get(id).push({y: +x.date, v: x.value, f: x.fmi ? "fmi" : ""});
  }));
  // estimaciones y proyecciones del FMI (hasta 5 años adelante) para los indicadores del Banco Mundial que tienen equivalente
  await Promise.all(inds.filter(o => o.src === "wb" && MP_FMI_DE[o.id]).map(async o => {
    const idF = MP_FMI_DE[o.id], vals = await mpFmiValores(idF); if (!vals) return;
    const sc = (REG.get("imf:" + idF) || {}).scale || 1;
    faltan.forEach(iso => {
      const sr = vals[iso], a = histCache.get(iso).get(o.id); if (!sr || !a || !a.length) return;
      const ult = a[a.length - 1].y, add = Object.entries(sr).map(([y, v]) => ({y: +y, v: Number(v) * sc, f: "fmi"})).filter(q => q.y > ult && q.y <= ANIO + 5 && !isNaN(q.v));
      if (add.length) histCache.get(iso).set(o.id, a.concat(add));
    });
  }));
  histCache.forEach(m => m.forEach(a => a.sort((p, q) => p.y - q.y)));
}
async function cargarMundo() {
  if (mundoCache) return;
  const inds = perfilInds();
  const res = await Promise.all(inds.map(o => o.src === "imf" ? mpFmiValores(o.id).then(v => v ? fmiMundo(v, o.scale || 1) : (fmiNoDisp.add(o.key), []), () => [])
    : wbAll(`/country/all/indicator/${o.id}`, {mrnev: 1, per_page: 400}).then(r => r.rows, () => null)));
  const m = new Map();
  res.forEach((rows, k) => { const arr = []; (rows || []).forEach(x => {
    if (x.iso) { arr.push(x); return; }                       // ya viene calculado (FMI)
    const p = paisMap.get(x.countryiso3code); if (!p || p.agg || x.value === null || x.value === undefined) return; arr.push({iso: p.iso, v: x.value, y: +x.date}); }); m.set(inds[k].id, arr); });
  mundoCache = m;
}
const ultimo = (iso, id) => { const a = (histCache.get(iso) || new Map()).get(id); if (!a) return null; for (let i = a.length - 1; i >= 0; i--) if (!a[i].f) return a[i]; return null; };   // ignora las proyecciones
function rango(id, iso) {
  const arr = (mundoCache && mundoCache.get(id)) || [], me = arr.find(x => x.iso === iso); if (!me) return null;
  const n = arr.length; return {puesto: arr.filter(x => x.v > me.v).length + 1, n, pct: arr.filter(x => x.v < me.v).length / Math.max(1, n - 1) * 100};
}
function medianaMundo(id) { const v = ((mundoCache && mundoCache.get(id)) || []).map(x => x.v).sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; }
const puntaje = (o, r) => o.tone === "bad" ? 100 - r.pct : r.pct;
function mejorIso(o, vals) {
  if (o.tone === "neutral" || vals.length < 2) return null;
  const s = vals.slice().sort((a, b) => o.tone === "good" ? b.v - a.v : a.v - b.v);
  return s[0].v === s[1].v ? null : s[0].iso;
}

// ---------- pantalla ----------
const bandera = p => p.iso2 ? `<img class="flag" src="https://flagcdn.com/w40/${p.iso2.toLowerCase()}.png" alt="" width="28" height="21" loading="lazy" onerror="this.remove()">` : "";
function poblarAddPais() {
  $("addPais").innerHTML = `<option value="">Añadir un país…</option>` + paises.filter(p => !p.agg).map(p => `<option value="${p.iso}">${esc(p.nombre)}</option>`).join("");
  $("sugPaises").innerHTML = SUGERENCIAS.filter(g => g.every(i => paisMap.has(i))).map(g => `<button class="chip-sug" data-sug="${g.join(",")}">${esc(g.map(i => paisMap.get(i).nombre).join(" vs "))}</button>`).join("");
}
function cabeceraP() {
  const n = PS.sel.map(i => paisMap.get(i).nombre);
  $("frasePaises").textContent = !n.length ? "Elige uno o más países para ver su perfil o compararlos" : n.length === 1 ? `Perfil de ${n[0]}` : `Comparando ${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
  document.title = n.length ? `${n.join(" vs ")} – Estadísticas Mundiales` : TITULO;
}
function entrarModo(m) {
  modo = m; $("modo-explorar").hidden = m !== "explorar"; $("modo-paises").hidden = m !== "paises"; $("modo-mipais").hidden = m !== "mipais";
  document.querySelectorAll(".modos button").forEach(b => b.classList.toggle("on", b.dataset.modo === m));
  window.scrollTo(0, 0);
  if (m === "paises") renderPaises();
  else if (m === "mipais") renderMiPais();
  else { document.title = TITULO; if (D) { renderResumen(); renderVista({zoom: true}); } else if (ind) consultar(); guardarHash(); }
}
function anadirPais(iso) {
  if (PS.sel.includes(iso)) return;
  if (PS.sel.length >= 4) { $("estadoP").textContent = "Puedes comparar hasta 4 países a la vez. Quita uno para añadir otro."; $("estadoP").className = ""; return; }
  PS.sel.push(iso); renderPaises();
}
function quitarPais(iso) { PS.sel = PS.sel.filter(i => i !== iso); renderPaises(); }
async function renderPaises() {
  const tok = ++psToken; cabeceraP();
  if (!PS.sel.length) { $("paisRes").hidden = true; $("estadoP").textContent = ""; guardarHash(); return; }
  $("estadoP").className = ""; $("estadoP").textContent = `Consultando ${perfilInds().length} indicadores del Banco Mundial y el FMI…`;
  try { await Promise.all([cargarHist(PS.sel), cargarMundo()]); }
  catch (e) { if (tok === psToken) { $("estadoP").className = "err"; $("estadoP").textContent = "No se pudo consultar: " + explicarError(e, "el Banco Mundial"); } return; }
  if (tok !== psToken) return;
  $("estadoP").textContent = ""; pintarPaises(); guardarHash();
}
function insightsPaises() {
  const inds = perfilInds(), sel = PS.sel, nom = iso => paisMap.get(iso).nombre, L = []; let titular = "";
  if (sel.length === 1) {
    const iso = sel[0], pop = rango("SP.POP.TOTL", iso), pib = rango("NY.GDP.MKTP.CD", iso);
    if (pop || pib) titular = `${nom(iso)} ocupa ${[pop && `el puesto ${pop.puesto} de ${pop.n} del mundo por población`, pib && `el ${pib.puesto} por PIB total`].filter(Boolean).join(" y ")}.`;
    else titular = `${nom(iso)}: último dato disponible de ${inds.length} indicadores.`;
    const pts = inds.filter(o => o.tone !== "neutral").map(o => ({o, r: rango(o.id, iso), u: ultimo(iso, o.id)})).filter(x => x.r && x.u).map(x => Object.assign(x, {s: puntaje(x.o, x.r)})).sort((a, b) => b.s - a.s);
    const f = pts.filter(x => x.s >= 60).slice(0, 3), d = pts.filter(x => x.s <= 40).slice(-3).reverse();
    if (f.length) L.push(`<b>Puntos fuertes:</b> ` + f.map(x => `${esc(x.o.name)} (${esc(fmtVal(x.u.v, x.o))}, mejor que el ${num(x.s, 0)} % de los países)`).join("; ") + ".");
    if (d.length) L.push(`<b>Puntos débiles:</b> ` + d.map(x => `${esc(x.o.name)} (${esc(fmtVal(x.u.v, x.o))}, peor que el ${num(100 - x.s, 0)} % de los países)`).join("; ") + ".");
  } else {
    const gana = Object.fromEntries(sel.map(i => [i, 0])); let comp = 0;
    inds.filter(o => o.tone !== "neutral").forEach(o => {
      const v = sel.map(iso => ({iso, u: ultimo(iso, o.id)})).filter(x => x.u); if (v.length < 2) return;
      comp++; const b = mejorIso(o, v.map(x => ({iso: x.iso, v: x.u.v}))); if (b) gana[b]++;
    });
    const orden = sel.slice().sort((a, b) => gana[b] - gana[a]);
    titular = comp ? (sel.length === 2 ? `${nom(orden[0])} queda mejor en ${gana[orden[0]]} de ${comp} indicadores comparables; ${nom(orden[1])}, en ${gana[orden[1]]}.`
      : `${nom(orden[0])} queda mejor en ${gana[orden[0]]} de ${comp} indicadores comparables, seguido de ${nom(orden[1])} (${gana[orden[1]]}).`) : "No hay suficientes datos en común para comparar.";
    const dif = [];
    inds.forEach(o => { const v = sel.map(iso => ({iso, u: ultimo(iso, o.id)})).filter(x => x.u && x.u.v > 0); if (v.length < 2) return; const s = v.slice().sort((a, b) => b.u.v - a.u.v), r = s[0].u.v / s[s.length - 1].u.v; if (r >= 1.5) dif.push({o, r, a: s[0].iso, b: s[s.length - 1].iso}); });
    dif.sort((a, b) => b.r - a.r);
    if (dif.length) L.push(`<b>Mayores diferencias:</b> ` + dif.slice(0, 3).map(x => `${esc(x.o.name.toLowerCase())} (${esc(nom(x.a))} tiene ${num(x.r, 1)} veces el valor de ${esc(nom(x.b))})`).join("; ") + ".");
    L.push(`Las cifras son el último dato disponible de cada país; pueden ser de años distintos.`);
  }
  return {titular, L};
}
function pintarPaises() {
  $("paisRes").hidden = false;
  const iP = REG.get("wb:SP.POP.TOTL");
  $("pCards").innerHTML = PS.sel.map((iso, i) => { const p = paisMap.get(iso), pop = ultimo(iso, "SP.POP.TOTL");
    return `<div class="pcard" style="--c:${serieColor(i)}"><button class="x" data-quitar="${iso}" aria-label="Quitar ${esc(p.nombre)}">✕</button><div class="pn">${bandera(p)}<b>${esc(p.nombre)}</b></div><small>${esc(CONT_NOMBRE[p.cont] || "")} · ${esc(p.ingreso)}</small>${p.capital ? `<small>Capital: ${esc(p.capital)}</small>` : ""}<small>Población: ${pop ? esc(fmtVal(pop.v, iP)) + " (" + pop.y + ")" : "—"}</small></div>`; }).join("");
  const ins = insightsPaises();
  $("pTitular").textContent = ins.titular; $("pLineas").innerHTML = ins.L.map(x => `<li>${x}</li>`).join("");
  $("vistasP").innerHTML = [["resumen", "Perfil"], ["ind", "Indicadores"], ["evo", "Evolución"]].map(([v, t]) => `<button class="pill ${PS.vista === v ? "on" : ""}" data-pv="${v}">${t}</button>`).join("");
  $("ayudaP").textContent = AYUDA_P[PS.vista]; $("avisoP").textContent = "";
  $("pv-graf").hidden = PS.vista === "ind"; $("pv-ind").hidden = PS.vista !== "ind"; $("ctrlP").hidden = PS.vista !== "evo";
  if (PS.vista === "ind") $("pv-ind").innerHTML = tablaInd();
  else if (PS.vista === "resumen") pintarRadar(); else pintarEvo();
  $("fuenteP").innerHTML = `Fuente: <a href="https://data.worldbank.org" target="_blank" rel="noopener">Banco Mundial</a> (Indicadores del Desarrollo Mundial) y <a href="https://www.imf.org/external/datamapper" target="_blank" rel="noopener">FMI</a> (indicadores marcados «FMI») · consultado ${new Date().toLocaleString("es-CO")} · Puesto = posición entre ${mundoCache && mundoCache.get("SP.POP.TOTL") ? mundoCache.get("SP.POP.TOTL").length : "los"} países y territorios con dato (1 = valor más alto).`;
}
function spark(arr, color) {
  arr = (arr || []).filter(p => !p.f);
  if (arr.length < 3) return "";
  const a = arr.slice(-25), w = 84, h = 22, ys = a.map(p => p.v), mn = Math.min(...ys), mx = Math.max(...ys), x0 = a[0].y, x1 = a[a.length - 1].y;
  const sx = y => (y - x0) / ((x1 - x0) || 1) * (w - 6) + 3, sy = v => mx === mn ? h / 2 : h - 3 - (v - mn) / (mx - mn) * (h - 6), l = a[a.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${a.map(p => sx(p.y).toFixed(1) + "," + sy(p.v).toFixed(1)).join(" ")}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${sx(l.y).toFixed(1)}" cy="${sy(l.v).toFixed(1)}" r="2.3" fill="${color}"/></svg>`;
}
function tablaInd() {
  const inds = perfilInds(), cols = PS.sel; let cat = "";
  let h = `<div class="tabla-box"><table class="ptabla"><thead><tr><th>Indicador</th>${cols.map((iso, i) => `<th><i class="pt" style="background:${serieColor(i)}"></i>${esc(paisMap.get(iso).nombre)}</th>`).join("")}<th>Mediana mundial</th></tr></thead><tbody>`;
  inds.forEach(o => {
    if (o.cat !== cat) { cat = o.cat; h += `<tr class="grupo"><th colspan="${cols.length + 2}">${esc(cat)}</th></tr>`; }
    const vals = cols.map(iso => ({iso, u: ultimo(iso, o.id)})), best = mejorIso(o, vals.filter(x => x.u).map(x => ({iso: x.iso, v: x.u.v}))), med = medianaMundo(o.id);
    h += `<tr><th class="in">${esc(nombreInd(o))}<small>${esc(o.unit)}</small></th>` + vals.map((x, i) => {
      if (!x.u) return `<td class="vacio">—<small>sin dato reciente</small></td>`;
      const r = rango(o.id, x.iso);
      return `<td class="${best === x.iso ? "mejor" : ""}"><b>${esc(fmtVal(x.u.v, o))}</b>${best === x.iso ? '<span class="chk" title="Mejor valor del grupo">✓</span>' : ""}<small>${x.u.y}${r ? ` · puesto ${r.puesto} de ${r.n}` : ""}</small>${spark(histCache.get(x.iso).get(o.id), serieColor(i))}</td>`; }).join("") +
      `<td class="mund">${med === null ? "—" : esc(fmtVal(med, o))}</td></tr>`;
  });
  return h + `</tbody></table></div>`;
}
function chartListoP() { if (typeof Chart === "undefined") { $("avisoP").textContent = "No se cargó la librería de gráficos. Revisa tu conexión y recarga; la pestaña Indicadores sí funciona."; return false; } return true; }
function pintarRadar() {
  if (!chartListoP()) return;
  const inds = perfilInds().filter(o => o.tone !== "neutral");
  const ds = PS.sel.map((iso, i) => ({label: paisMap.get(iso).nombre, data: inds.map(o => { const r = rango(o.id, iso); return r ? puntaje(o, r) : null; }), borderColor: serieColor(i), backgroundColor: serieColor(i) + "26", borderWidth: 2, pointRadius: 3, pointBackgroundColor: serieColor(i), spanGaps: true}));
  ds.push({label: "Mediana mundial", data: inds.map(() => 50), borderColor: css("--suave"), borderDash: [5, 4], borderWidth: 1.3, pointRadius: 0, fill: false});
  nuevoGrafico({type: "radar", data: {labels: inds.map(o => corto(o.name, 24)), datasets: ds},
    options: {plugins: {legend: {labels: {usePointStyle: true}}, tooltip: {callbacks: {label: c => c.dataset.label === "Mediana mundial" ? "Mediana mundial" : `${c.dataset.label}: mejor que el ${num(c.parsed.r, 0)} % de los países`}}},
      scales: {r: {min: 0, max: 100, ticks: {stepSize: 25, backdropColor: "transparent"}, pointLabels: {font: {size: MOVIL() ? 10 : 11}, color: css("--tinta")}, grid: {color: css("--linea")}, angleLines: {color: css("--linea")}}}}}, MOVIL() ? 400 : 500, true);
  const sin = inds.filter(o => PS.sel.some(iso => !rango(o.id, iso))).length;
  $("avisoP").textContent = sin ? `En ${sin} de ${inds.length} ejes falta el dato de algún país; esos puntos quedan sin dibujar.` : "";
}
function pintarEvo() {
  if (!chartListoP()) return;
  const inds = perfilInds(); if (!inds.some(o => o.id === PS.evoId)) PS.evoId = inds[0].id;
  const o = inds.find(x => x.id === PS.evoId), base = PS.evoModo === "base";
  $("ctrlP").innerHTML = `<label class="ctl">Indicador<select data-pk="evoId">${[...new Set(inds.map(x => x.cat))].map(c => `<optgroup label="${esc(c)}">${inds.filter(x => x.cat === c).map(x => `<option value="${x.id}" ${x.id === PS.evoId ? "selected" : ""}>${esc(nombreInd(x))}</option>`).join("")}</optgroup>`).join("")}</select></label>` +
    `<label class="ctl">Qué se grafica<select data-pk="evoModo"><option value="real" ${!base ? "selected" : ""}>Valores reales</option><option value="base" ${base ? "selected" : ""}>Índice (primer año = 100)</option></select></label>`;
  let y0 = 9999, y1 = 0; PS.sel.forEach(iso => (histCache.get(iso).get(o.id) || []).forEach(p => { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }));
  if (y1 === 0) { if (graficoP) { graficoP.destroy(); graficoP = null; } $("cajaP").style.height = "60px"; $("avisoP").textContent = "Ninguno de los países tiene datos recientes de este indicador."; return; }
  const labels = []; for (let y = y0; y <= y1; y++) labels.push(y);
  let hayFmi = false;
  const ds = PS.sel.map((iso, i) => { const pts = histCache.get(iso).get(o.id) || [], m = new Map(pts.map(p => [p.y, p.v])), fy = new Set(pts.filter(p => p.f).map(p => p.y)); if (fy.size) hayFmi = true; const b0 = base ? labels.map(y => m.get(y)).find(v => v !== undefined && v !== 0) : null;
    return {label: paisMap.get(iso).nombre, borderColor: serieColor(i), backgroundColor: serieColor(i), borderWidth: 2.4, pointRadius: 0, pointHoverRadius: 4, tension: .2, spanGaps: true, segment: {borderDash: c => fy.has(labels[c.p1DataIndex]) ? [6, 4] : undefined}, data: labels.map(y => { const v = m.get(y); return v === undefined ? null : base ? (b0 ? v / b0 * 100 : null) : v; })}; });
  const f = v => base ? num(v, 0) : fmtVal(v, o);
  nuevoGrafico({type: "line", data: {labels, datasets: ds}, plugins: [plugEtiquetasFin()],
    options: {layout: {padding: {right: 118}}, interaction: {mode: "nearest", intersect: false, axis: "x"}, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${f(c.parsed.y)}`}}},
      scales: {y: {ticks: {callback: v => f(v)}, title: {display: base || !!o.unit, text: base ? `Índice (${labels[0]} = 100)` : o.unit}}, x: {grid: {display: false}}}}}, 420, true);
  $("avisoP").textContent = `${nombreInd(o)}${o.desc ? ": " + o.desc : ""}${hayFmi ? " · Línea punteada: estimación o proyección del FMI (Perspectivas de la Economía Mundial)." : ""}`;
}
function csvPaises() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`, L = ["indicador;codigo;fuente;pais;iso3;anio;valor;unidad;tipo"];
  perfilInds().forEach(o => PS.sel.forEach(iso => ((histCache.get(iso) || new Map()).get(o.id) || []).forEach(p => L.push([q(o.name), o.id, o.src, q(paisMap.get(iso).nombre), iso, p.y, String(p.v).replace(".", ","), q(o.unit || ""), p.f ? "estimacion/proyeccion FMI" : "observado"].join(";")))));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], {type: "text/csv;charset=utf-8"})); a.download = "comparacion_" + PS.sel.join("_") + ".csv"; document.body.appendChild(a); a.click(); a.remove();
}
function eventosPaises() {
  document.querySelector(".modos").addEventListener("click", e => { const b = e.target.closest("button[data-modo]"); if (b && b.dataset.modo !== modo) entrarModo(b.dataset.modo); });
  $("addPais").addEventListener("change", e => { const iso = e.target.value; e.target.value = ""; if (iso) anadirPais(iso); });
  $("sugPaises").addEventListener("click", e => { const b = e.target.closest("[data-sug]"); if (b) { PS.sel = b.dataset.sug.split(","); renderPaises(); } });
  $("pCards").addEventListener("click", e => { const b = e.target.closest("[data-quitar]"); if (b) quitarPais(b.dataset.quitar); });
  $("vistasP").addEventListener("click", e => { const b = e.target.closest("[data-pv]"); if (b) { PS.vista = b.dataset.pv; pintarPaises(); guardarHash(); } });
  $("ctrlP").addEventListener("change", e => { const k = e.target.dataset.pk; if (k) { PS[k] = e.target.value; pintarPaises(); guardarHash(); } });
  $("btnCSVP").addEventListener("click", csvPaises);
  $("btnEnlaceP").addEventListener("click", copiarEnlace);
  $("btnIrComparar").addEventListener("click", () => { PS.sel = [...sel].slice(0, 4); cerrarHojas(); entrarModo("paises"); });
}
