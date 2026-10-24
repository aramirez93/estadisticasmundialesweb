// ============================================================
//  MI PAÍS: un solo país, todo su historial, de lo más relevante a lo más curioso
// ============================================================
const MP = {iso: null, token: 0, secs: []};
const mpHist = new Map();      // "ISO|clave" -> [{y,v}]            serie del país
const mpMundo = new Map();     // clave -> [{iso,v,y}]              último dato de cada país
const mpExtra = new Map();     // "ISO|clave" -> [{y,v}]            proyección del FMI
const mpFmiC = new Map();      // id FMI -> promesa con los valores
let mpGraficos = [];
const MP_ESENCIAL = ["NY.GDP.MKTP.CD", "NY.GDP.PCAP.CD", "NY.GDP.MKTP.KD.ZG", "FP.CPI.TOTL.ZG", "SP.POP.TOTL", "SL.UEM.TOTL.ZS", "SP.DYN.LE00.IN", "SI.POV.GINI", "SE.ADT.LITR.ZS", "SP.DYN.TFRT.IN", "IT.NET.USER.ZS", "GC.DOD.TOTL.GD.ZS"];
const MP_FMI_PROPIOS = ["GGXWDG_NGDP", "GGXCNL_NGDP", "BCA_NGDPD", "PPPSH", "rev", "exp", "ie", "pb", "Privatedebt_all", "HH_ALL", "NFC_ALL", "AI_PI", "GII_TC", "total_theil", "SITC1_total"];
const MP_ORDEN = ["Economía", "Población", "Salud", "Educación", "Trabajo", "Pobreza y desigualdad", "Finanzas y comercio", "Gobierno y deuda", "Tecnología", "Ambiente y energía", "Curiosidades"];
const MP_SUB = {"Economía": "Tamaño, crecimiento, precios y estructura productiva", "Población": "Cuántos son, cómo crecen y cómo envejecen", "Salud": "Cuánto se vive y qué tan sano se vive",
  "Educación": "Alfabetización, matrícula e inversión educativa", "Trabajo": "Empleo, desempleo y participación laboral", "Pobreza y desigualdad": "Cómo se reparte el ingreso",
  "Finanzas y comercio": "Relación con el resto del mundo y sistema financiero", "Gobierno y deuda": "Impuestos, deuda y gasto público", "Tecnología": "Conectividad e innovación",
  "Ambiente y energía": "Bosques, energía limpia y contaminación", "Curiosidades": "Datos poco conocidos que también dicen mucho del país"};
// Indicador del Banco Mundial -> indicador equivalente del FMI (para dibujar su estimación y proyección)
const MP_FMI_DE = {"NY.GDP.MKTP.CD": "NGDPD", "NY.GDP.PCAP.CD": "NGDPDPC", "NY.GDP.PCAP.PP.CD": "PPPPC", "NY.GDP.MKTP.KD.ZG": "NGDP_RPCH", "FP.CPI.TOTL.ZG": "PCPIPCH", "SL.UEM.TOTL.ZS": "LUR", "SP.POP.TOTL": "LP"};
const MP_SUG = ["COL", "MEX", "ESP", "ARG", "BRA", "CHL", "PER", "USA"];

// ---------- utilidades ----------
const mpCola = {n: 0, esp: []};
function mpLimitar(fn) {
  return new Promise((ok, ko) => {
    const correr = () => { mpCola.n++; fn().then(ok, ko).then(() => { mpCola.n--; const s = mpCola.esp.shift(); if (s) s(); }); };
    mpCola.n < 4 ? correr() : mpCola.esp.push(correr);
  });
}
const mpSecPorId = id => MP.secs.find(s => s.id === id);
const mpPuntos = o => String(o.suf || "").trim() === "%";                  // se compara en puntos porcentuales
const mpTasa = o => /anual/i.test(o.unit || "");                           // crecimiento o inflación: ya es un cambio
const mpFmt = (v, o) => fmtVal(v, o);
function mpAbrev(v, o) {
  if (o.k !== "big" && Math.abs(v) < 1e6) return fmtVal(v, Object.assign({}, o, {pre: "", suf: ""}));
  return new Intl.NumberFormat("es", {notation: "compact", maximumFractionDigits: 1}).format(v);
}

// ---------- datos ----------
function fmiMundo(vals, sc) {                  // último dato (hasta el año pasado) de cada país en una copia del FMI
  const Y = ANIO - 1, arr = [];
  Object.entries(vals || {}).forEach(([c, s]) => {
    const iso = (c === "KOS" || c === "UVK") ? "XKX" : c, p = paisMap.get(iso); if (!p || p.agg) return;
    const ys = Object.keys(s).map(Number).filter(y => y <= Y && s[y] !== null && s[y] !== undefined && !isNaN(Number(s[y]))); if (!ys.length) return;
    const y = Math.max(...ys); arr.push({iso, v: Number(s[y]) * sc, y});
  });
  return arr;
}
async function mpDatosLocal(o, isos) {              // FMI, OMS, OIT, OWID: copia local del sitio
  const vals = await localValores(o.src, o.id), sc = o.scale || 1;
  isos.forEach(iso => {
    const k = iso + "|" + o.key, cod = (vals && vals[iso]) || {};
    const todo = Object.entries(cod).map(([y, v]) => ({y: +y, v: Number(v) * sc})).filter(p => !isNaN(p.v)).sort((a, b) => a.y - b.y);
    mpHist.set(k, todo.filter(p => p.y < ANIO)); mpExtra.set(k, todo.filter(p => p.y >= ANIO));
  });
  if (!mpMundo.has(o.key)) mpMundo.set(o.key, fmiMundo(vals, sc));
}
async function mpDatos(o, isos = [MP.iso]) {         // carga lo que falte de uno o varios países (una sola consulta por indicador)
  if (o.src !== "wb") return mpDatosLocal(o, isos);
  const id = encodeURIComponent(o.id), faltan = isos.filter(i => !mpHist.has(i + "|" + o.key));
  const pedirPais = async () => {
    if (!faltan.length) return;
    const l2 = faltan.map(i => paisMap.get(i).iso2).join(";");
    const r = await mpLimitar(() => wbAll(`/country/${l2}/indicator/${id}`, {date: `1960:${ANIO}`, source: o.wbSource || "2", per_page: 1000}));
    faltan.forEach(i => mpHist.set(i + "|" + o.key, []));
    r.rows.filter(x => x.value !== null && x.value !== undefined).forEach(x => { const a = mpHist.get(x.countryiso3code + "|" + o.key); if (a) a.push({y: +x.date, v: x.value}); });
    faltan.forEach(i => mpHist.get(i + "|" + o.key).sort((a, b) => a.y - b.y));
  };
  const pedirMundo = async () => {
    if (mpMundo.has(o.key)) return;
    if (typeof mundoCache !== "undefined" && mundoCache && mundoCache.get(o.id)) { mpMundo.set(o.key, mundoCache.get(o.id)); return; }
    try {
      const r = await mpLimitar(() => wbAll(`/country/all/indicator/${id}`, {mrnev: 1, per_page: 400}));
      const arr = []; r.rows.forEach(x => { const q = paisMap.get(x.countryiso3code); if (!q || q.agg || x.value === null || x.value === undefined) return; arr.push({iso: q.iso, v: x.value, y: +x.date}); });
      mpMundo.set(o.key, arr);
    } catch (e) { mpMundo.set(o.key, []); }           // sin comparación mundial, pero la serie sí se muestra
  };
  await Promise.all([pedirPais(), pedirMundo()]);
  const idF = MP_FMI_DE[o.id];
  if (idF) {
    const vals = await localValores("imf", idF), sc = (REG.get("imf:" + idF) || {}).scale || 1;
    isos.forEach(iso => { const k = iso + "|" + o.key; if (mpExtra.has(k)) return; const cod = (vals && vals[iso]) || {};
      mpExtra.set(k, Object.entries(cod).map(([y, v]) => ({y: +y, v: Number(v) * sc})).filter(q => !isNaN(q.v)).sort((a, b) => a.y - b.y)); });
  }
}
function mpRango(o, iso = MP.iso) {
  const arr = mpMundo.get(o.key) || [], me = arr.find(x => x.iso === iso); if (!me || arr.length < 5) return null;
  const n = arr.length, vs = arr.map(x => x.v).sort((a, b) => a - b), med = n % 2 ? vs[n >> 1] : (vs[n / 2 - 1] + vs[n / 2]) / 2;
  return {puesto: arr.filter(x => x.v > me.v).length + 1, n, pct: arr.filter(x => x.v < me.v).length / (n - 1) * 100, med, y: me.y};
}
const mpUlt = (o, iso = MP.iso) => { const s = mpHist.get(iso + "|" + o.key); return s && s.length ? s[s.length - 1] : null; };
const mpPuntaje = (o, r) => o.tone === "bad" ? 100 - r.pct : r.pct;

// ---------- análisis en lenguaje claro ----------
function mpCambio(o, a, b) {
  if (mpPuntos(o)) { const d = b - a; return {rel: d, txt: `${d >= 0 ? "subió" : "bajó"} ${num(Math.abs(d), 1)} puntos porcentuales`, estable: Math.abs(d) < 0.5}; }
  if (a > 0 && b > 0) {
    const r = b / a, estable = Math.abs(r - 1) < 0.03;
    if (r >= 2) return {rel: r - 1, txt: `se multiplicó por ${num(r, 1)}`, estable};
    if (r <= 0.5) return {rel: r - 1, txt: `se redujo a la ${r < 0.25 ? "cuarta parte" : "mitad"} o menos`, estable};
    return {rel: r - 1, txt: `${r >= 1 ? "creció" : "cayó"} ${num(Math.abs(r - 1) * 100, 0)} %`, estable};
  }
  return {rel: b - a, txt: `pasó de ${mpFmt(a, o)} a ${mpFmt(b, o)}`, estable: a === b};
}
function mpAnalisis(o, serie) {
  const last = serie[serie.length - 1], n = serie.length;
  let mx = serie[0], mn = serie[0]; serie.forEach(p => { if (p.v > mx.v) mx = p; if (p.v < mn.v) mn = p; });
  const partes = []; let etiqueta = "", clase = "";
  const ext = n >= 6 ? ` Su valor más alto fue ${mpFmt(mx.v, o)} (${mx.y}) y el más bajo ${mpFmt(mn.v, o)} (${mn.y}).` : "";
  const juzga = (sube, estable) => {
    if (estable) return {etiqueta: "→ Estable", clase: ""};
    const bien = o.tone === "neutral" ? null : (o.tone === "good") === sube;
    return {etiqueta: (sube ? "▲ " : "▼ ") + (bien === null ? (sube ? "Sube" : "Baja") : bien ? "Mejora" : "Empeora"), clase: bien === null ? "" : bien ? "bien" : "mal"};
  };
  if (n < 3) { partes.push(`Solo hay ${n === 1 ? "un dato publicado" : "dos datos publicados"} (${serie.map(p => p.y).join(" y ")}).`); }
  else if (mpTasa(o)) {
    const ult = serie.slice(-10), prom = ult.reduce((s, p) => s + p.v, 0) / ult.length, dif = last.v - prom;
    partes.push(`En los últimos ${ult.length} años promedió ${mpFmt(prom, o)}; el dato de ${last.y} (${mpFmt(last.v, o)}) está ${Math.abs(dif) < 0.3 ? "en la media" : dif > 0 ? "por encima" : "por debajo"} de ese promedio.`);
    const est = Math.abs(dif) < 0.3, j = juzga(dif > 0, est);
    etiqueta = est ? "→ En su promedio" : dif > 0 ? "▲ Sobre su promedio" : "▼ Bajo su promedio"; clase = j.clase;
  } else {
    const ref = serie.slice().reverse().find(p => p.y <= last.y - 10) || serie[0];
    if (ref.y !== last.y) {
      const c = mpCambio(o, ref.v, last.v), anos = last.y - ref.y;
      partes.push(`En ${ref.y} era ${mpFmt(ref.v, o)} y en ${last.y} ${mpFmt(last.v, o)}: ${c.txt} en ${anos} años.`);
      const j = juzga(last.v > ref.v, c.estable); etiqueta = j.etiqueta + (j.etiqueta.startsWith("→") ? "" : ` en ${anos} años`); clase = j.clase;
    }
  }
  return {texto: partes.join(" ") + (n >= 3 ? ext : ""), etiqueta, clase, mx, mn};
}

// ---------- gráfica ----------
const mpPlugEtiq = {id: "mpEtiq", afterDatasetsDraw(ch, a, op) {
  const items = (op && op.items) || [], meta = ch.getDatasetMeta(0); if (!meta) return;
  const ctx = ch.ctx; ctx.save(); ctx.font = "600 11px " + css("--sans"); ctx.fillStyle = css("--tinta"); ctx.textAlign = "center";
  items.forEach(it => {
    const el = meta.data[it.i]; if (!el) return; const w = ctx.measureText(it.txt).width / 2;
    const x = Math.min(Math.max(el.x, ch.chartArea.left + w), ch.chartArea.right - w);
    ctx.textBaseline = it.abajo ? "top" : "bottom"; ctx.fillText(it.txt, x, it.abajo ? el.y + 7 : el.y - 7);
  });
  ctx.restore();
}};
function mpGraficar(cv, o, serie, extra, med) {
  const col = serieColor(0), rojo = serieColor(7), suave = css("--suave"), ultY = serie[serie.length - 1].y;
  const ext = (extra || []).filter(p => p.y > ultY), y0 = serie[0].y, y1 = ext.length ? ext[ext.length - 1].y : ultY;
  const labels = []; for (let y = y0; y <= y1; y++) labels.push(y);
  const m = new Map(serie.map(p => [p.y, p.v])), me = new Map(ext.map(p => [p.y, p.v]));
  const obs = labels.map(y => m.has(y) ? m.get(y) : null), idx = y => labels.indexOf(y);
  const f = v => mpFmt(v, o), barras = mpTasa(o);
  let mx = serie[0], mn = serie[0]; serie.forEach(p => { if (p.v > mx.v) mx = p; if (p.v < mn.v) mn = p; });
  const last = serie[serie.length - 1], items = [{i: idx(last.y), txt: f(last.v)}];
  if (serie.length >= 6) {
    if (Math.abs(idx(mx.y) - idx(last.y)) > 4) items.push({i: idx(mx.y), txt: f(mx.v)});
    if (Math.abs(idx(mn.y) - idx(last.y)) > 4 && Math.abs(idx(mn.y) - idx(mx.y)) > 4) items.push({i: idx(mn.y), txt: f(mn.v), abajo: true});
  }
  const marcados = new Set(items.map(t => t.i)), radios = labels.map((_, i) => marcados.has(i) ? 4.5 : 0);
  const ds = [];
  if (barras) {
    const col2 = labels.map(y => me.has(y) ? (me.get(y) < 0 ? rojo + "88" : col + "88") : (m.get(y) < 0 ? rojo : col));
    ds.push({type: "bar", label: "Dato observado", data: labels.map(y => m.has(y) ? m.get(y) : me.has(y) ? me.get(y) : null), backgroundColor: col2, borderWidth: 0, maxBarThickness: 18});
  } else {
    ds.push({type: "line", label: "Dato observado", data: obs, borderColor: col, backgroundColor: col + "26", fill: true, borderWidth: 2.4, pointRadius: radios, pointHoverRadius: 5, pointBackgroundColor: col, tension: .2, spanGaps: true});
    if (ext.length) ds.push({type: "line", label: "Proyección del FMI", data: labels.map(y => me.has(y) ? me.get(y) : y === ultY ? m.get(y) : null), borderColor: col, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .2, spanGaps: true, fill: false});
  }
  const vals = serie.map(p => p.v).concat(ext.map(p => p.v));
  if (med !== null && med !== undefined && isFinite(med)) {
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || Math.abs(hi) || 1;
    if (med >= lo - span * 1.5 && med <= hi + span * 1.5) ds.push({type: "line", label: "Mediana mundial", data: labels.map(() => med), borderColor: suave, borderDash: [2, 4], borderWidth: 1.4, pointRadius: 0, pointHoverRadius: 0, fill: false});
  }
  Chart.defaults.color = css("--suave"); Chart.defaults.font.family = css("--sans"); Chart.defaults.font.size = 11; Chart.defaults.borderColor = css("--linea");
  const g = new Chart(cv, {data: {labels, datasets: ds}, plugins: [mpPlugEtiq], options: {
    responsive: true, maintainAspectRatio: false, layout: {padding: {top: 18, bottom: 6, right: 6}}, interaction: {mode: "index", intersect: false},
    plugins: {legend: {display: false}, mpEtiq: {items}, tooltip: {callbacks: {title: t => t[0].label + (me.has(+t[0].label) ? " · proyección FMI" : ""), label: c => `${c.dataset.label}: ${f(c.parsed.y)}`}}},
    scales: {y: {grace: "8%", ticks: {callback: v => (o.pre || "") + mpAbrev(v, o) + (o.suf || ""), maxTicksLimit: MOVIL() ? 4 : 5}}, x: {grid: {display: false}, ticks: {maxRotation: 0, autoSkip: true, maxTicksLimit: MOVIL() ? 5 : 9}}}}});
  mpGraficos.push(g);
}

// ---------- tarjetas y secciones ----------
function mpTarjeta(o) {
  const k = MP.iso + "|" + o.key, serie = mpHist.get(k) || [], extra = mpExtra.get(k) || [];
  const last = serie[serie.length - 1], an = mpAnalisis(o, serie), r = mpRango(o), fuente = FUENTES[o.src] || FUENTES.wb;
  const tieneProy = extra.some(p => p.y > last.y), nombre = esc(o.name);
  let pos = "";
  if (r) {
    const txtOK = o.tone === "neutral" ? "" : ` · mejor que el ${num(mpPuntaje(o, r), 0)} % de los países`;
    pos = `<div><div class="mp-pos" aria-hidden="true"><i style="left:${clamp(r.pct, 2, 98)}%"></i></div><div class="mp-pos-t"><span>Valor más bajo</span><span>Valor más alto</span></div>` +
      `<p class="mp-lee" style="margin-top:4px">Puesto <b>${r.puesto}</b> de ${r.n} países (1 = valor más alto, ${r.y})${txtOK}. Mediana mundial: ${esc(mpFmt(r.med, o))}.</p></div>`;
  }
  const leyenda = `<p class="mp-leyenda">${tieneProy ? (mpTasa(o) ? "Barras claras" : "Línea punteada") + ": estimación o proyección del FMI (Perspectivas de la Economía Mundial). " : ""}${r ? "Línea de puntos grises: mediana mundial." : ""}</p>`;
  const alt = `${o.name}: ${mpFmt(last.v, o)} en ${last.y}`;
  return `<article class="mp-card" data-k="${esc(o.key)}"><div><h4>${nombre}</h4><span class="u">${esc(o.unit || "")}</span></div>` +
    `<p class="que">${esc(o.desc || "")}</p>` +
    `<div class="mp-hoy"><b>${esc(mpFmt(last.v, o))}</b><span>en ${last.y}</span>${an.etiqueta ? `<span class="mp-tag ${an.clase}">${esc(an.etiqueta)}</span>` : ""}</div>` +
    `<div class="mp-graf"><canvas role="img" aria-label="${esc(alt)}" data-k="${esc(o.key)}"></canvas></div>` +
    `<p class="mp-lee">${esc(an.texto)}</p>${leyenda}` + pos +
    `<div class="mp-pie"><span>${esc(TONO_TXT[o.tone] || "")}</span><a href="${esc(fuente.url)}" target="_blank" rel="noopener">${esc(fuente.corto)}</a></div></article>`;
}
function mpPintarSec(sec) {
  const cuerpo = $("mpb-" + sec.id); if (!cuerpo) return;
  mpGraficos = mpGraficos.filter(g => { if (g.canvas && cuerpo.contains(g.canvas)) { g.destroy(); return false; } return true; });
  const con = sec.inds.filter(o => (mpHist.get(MP.iso + "|" + o.key) || []).length), sin = sec.inds.filter(o => !(mpHist.get(MP.iso + "|" + o.key) || []).length);
  cuerpo.innerHTML = con.map(mpTarjeta).join("") + (sin.length ? `<p class="mp-sin">Sin datos publicados para este país: ${sin.map(o => esc(o.name)).join(" · ")}.</p>` : "");
  if (typeof Chart === "undefined") { cuerpo.insertAdjacentHTML("afterbegin", `<p class="mp-sin">No se cargó la librería de gráficos; se muestran los datos y su análisis.</p>`); cuerpo.querySelectorAll(".mp-graf").forEach(x => x.remove()); return; }
  cuerpo.querySelectorAll(".mp-card").forEach(c => { const o = con.find(x => x.key === c.dataset.k); if (o && mpHist.get(MP.iso + "|" + o.key).length < 2) c.querySelectorAll(".mp-graf").forEach(x => x.remove()); });
  con.forEach(o => {
    const cv = cuerpo.querySelector(`canvas[data-k="${CSS.escape(o.key)}"]`), k = MP.iso + "|" + o.key, r = mpRango(o);
    if (cv) try { mpGraficar(cv, o, mpHist.get(k), mpExtra.get(k), r ? r.med : null); } catch (e) { console.error(e); cv.parentNode.remove(); }
  });
}
async function mpCargarSec(sec) {
  if (sec.estado === "ok" || sec.estado === "cargando") return;
  const tok = MP.token, cuerpo = $("mpb-" + sec.id); sec.estado = "cargando";
  cuerpo.innerHTML = `<div class="mp-cargando" style="grid-column:1/-1">Cargando ${sec.inds.length} indicadores…</div>`;
  let fallos = 0, ultimo = null;
  await Promise.all(sec.inds.map(o => mpDatos(o).catch(e => { fallos++; ultimo = e; })));
  if (tok !== MP.token) return;
  if (fallos === sec.inds.length) {
    sec.estado = "err";
    cuerpo.innerHTML = `<div class="mp-cargando" style="grid-column:1/-1">No se pudo consultar: ${esc(explicarError(ultimo, "la fuente de datos"))} <button class="btn sec" data-mp-reint="${sec.id}">Reintentar</button></div>`; return;
  }
  sec.estado = "ok"; mpPintarSec(sec); mpHero();
  if (fallos) cuerpo.insertAdjacentHTML("beforeend", `<p class="mp-sin">${fallos} indicador(es) no se pudieron consultar. <button class="btn sec" data-mp-reint="${sec.id}">Reintentar</button></p>`);
}
function mpHero() {
  const p = paisMap.get(MP.iso), todos = MP.secs.flatMap(s => s.inds), g = id => todos.find(o => o.key === "wb:" + id);
  const kpi = (id, t) => { const o = g(id), u = o && mpUlt(o); return u ? `<div class="mp-kpi"><small>${t} · ${u.y}</small><b>${esc(mpFmt(u.v, o))}</b></div>` : ""; };
  const pop = g("SP.POP.TOTL") && mpRango(g("SP.POP.TOTL")), pib = g("NY.GDP.MKTP.CD") && mpRango(g("NY.GDP.MKTP.CD"));
  const L = [];
  if (pop || pib) L.push(`<b>${esc(p.nombre)}</b> ocupa ${[pop && `el puesto ${pop.puesto} de ${pop.n} del mundo por población`, pib && `el ${pib.puesto} por tamaño de su economía`].filter(Boolean).join(" y ")}.`);
  const pts = todos.filter(o => o.tone !== "neutral").map(o => ({o, r: mpRango(o), u: mpUlt(o)})).filter(x => x.r && x.u).map(x => Object.assign(x, {s: mpPuntaje(x.o, x.r)})).sort((a, b) => b.s - a.s);
  const f = pts.filter(x => x.s >= 65).slice(0, 3), d = pts.filter(x => x.s <= 35).slice(-3).reverse();
  if (f.length) L.push(`<b>Puntos fuertes:</b> ` + f.map(x => `${esc(x.o.name)} (${esc(mpFmt(x.u.v, x.o))}, mejor que el ${num(x.s, 0)} % de los países)`).join("; ") + ".");
  if (d.length) L.push(`<b>Puntos débiles:</b> ` + d.map(x => `${esc(x.o.name)} (${esc(mpFmt(x.u.v, x.o))}, peor que el ${num(100 - x.s, 0)} % de los países)`).join("; ") + ".");
  $("mpHero").innerHTML = `<div class="mp-id">${bandera(p)}<div><h2>${esc(p.nombre)}</h2><small>${esc([CONT_NOMBRE[p.cont], p.ingreso, p.capital && "Capital: " + p.capital].filter(Boolean).join(" · "))}</small></div></div>` +
    `<div class="mp-kpis">${kpi("SP.POP.TOTL", "Población")}${kpi("NY.GDP.MKTP.CD", "PIB")}${kpi("NY.GDP.PCAP.CD", "PIB por habitante")}${kpi("SP.DYN.LE00.IN", "Esperanza de vida")}${kpi("SL.UEM.TOTL.ZS", "Desempleo")}</div>` +
    (L.length ? `<ul class="mp-res">${L.map(x => `<li>${x}</li>`).join("")}</ul>` : "");
}

// ---------- pantalla ----------
function mpSecciones() {
  const wb = CATALOGO.wb.filter(o => o.curated), fmi = MP_FMI_PROPIOS.map(id => REG.get("imf:" + id)).filter(Boolean).concat(CATALOGO.oms, CATALOGO.oit, CATALOGO.owid);
  const esenc = MP_ESENCIAL.map(id => REG.get("wb:" + id)).filter(Boolean), usados = new Set(esenc.map(o => o.key));
  const secs = [{id: "esencial", titulo: "Lo esencial", sub: "Los datos que mejor resumen al país", inds: esenc}];
  MP_ORDEN.forEach((c, i) => {
    const inds = wb.filter(o => o.cat === c && !usados.has(o.key)).concat(fmi.filter(o => o.cat === c));
    if (inds.length) secs.push({id: "s" + i, titulo: c, sub: MP_SUB[c] || "", inds});
  });
  secs.forEach(s => { s.estado = ""; });
  return secs;
}
function mpPoblar() {
  $("sugMP").innerHTML = MP_SUG.filter(i => paisMap.has(i)).map(i => `<button class="chip-sug" data-mp-sug="${i}">${esc(paisMap.get(i).nombre)}</button>`).join("");
}
function mpAbrir(id, desplazar) {
  const d = $("mps-" + id); if (!d) return; d.open = true; mpCargarSec(mpSecPorId(id));
  if (desplazar) d.scrollIntoView({behavior: "smooth", block: "start"});
}
function renderMiPais() {
  if (!$("sugMP").innerHTML) mpPoblar();
  if (!MP.iso) { try { const g = localStorage.getItem("miPais"); if (g && paisMap.has(g)) MP.iso = g; } catch (e) {} }
  if (!MP.iso) MP.iso = paisMap.has("COL") ? "COL" : null;
  if (!MP.iso) return;
  MP.token++; mpGraficos.forEach(g => g.destroy()); mpGraficos = [];
  try { localStorage.setItem("miPais", MP.iso); } catch (e) {}
  const p = paisMap.get(MP.iso); $("buscaMP").value = p.nombre; $("fraseMP").textContent = `${p.nombre}: su historia en datos`;
  document.title = `${p.nombre} en datos – Estadísticas Mundiales`; $("estadoMP").textContent = ""; $("resMP").hidden = false;
  MP.secs = mpSecciones();
  $("mpNav").innerHTML = MP.secs.map(s => `<button class="pill" data-mp-ir="${s.id}">${esc(s.titulo)}</button>`).join("");
  $("mpSecs").innerHTML = MP.secs.map(s => `<details class="mp-sec" id="mps-${s.id}" data-sec="${s.id}"><summary><div><h3>${esc(s.titulo)}</h3><div class="sub">${esc(s.sub)} · ${s.inds.length} indicadores</div></div></summary><div class="mp-cuerpo" id="mpb-${s.id}"></div></details>`).join("");
  mpHero();
  $("fuenteMP").innerHTML = `Fuentes: <a href="https://data.worldbank.org" target="_blank" rel="noopener">Banco Mundial</a> (Indicadores del Desarrollo Mundial, series anuales desde 1960) y <a href="https://www.imf.org/external/datamapper" target="_blank" rel="noopener">FMI</a> (estimaciones y proyecciones). Los datos curiosos provienen de organismos que alimentan al Banco Mundial: ONU, OMS, Unión Interparlamentaria, OMT y otros. · consultado ${new Date().toLocaleString("es-CO")}`;
  mpAbrir("esencial", false); guardarHash();
}
function mpRedibujar() { MP.secs.forEach(s => { if (s.estado === "ok") mpPintarSec(s); }); }
function csvMiPais() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`, L = ["indicador;codigo;fuente;pais;iso3;anio;valor;unidad"], p = paisMap.get(MP.iso);
  MP.secs.forEach(s => s.inds.forEach(o => (mpHist.get(MP.iso + "|" + o.key) || []).concat(mpExtra.get(MP.iso + "|" + o.key) || []).forEach(x => L.push([q(o.name), o.id, o.src, q(p.nombre), MP.iso, x.y, String(x.v).replace(".", ","), q(o.unit || "")].join(";")))));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], {type: "text/csv;charset=utf-8"})); a.download = "mi_pais_" + MP.iso + ".csv"; document.body.appendChild(a); a.click(); a.remove();
}
function eventosMiPais() {
  buscadorPais({input: $("buscaMP"), lista: $("lstMP"), onElegir: iso => { MP.iso = iso; renderMiPais(); window.scrollTo(0, 0); }});
  $("sugMP").addEventListener("click", e => { const b = e.target.closest("[data-mp-sug]"); if (b) { MP.iso = b.dataset.mpSug; renderMiPais(); } });
  $("mpNav").addEventListener("click", e => { const b = e.target.closest("[data-mp-ir]"); if (b) mpAbrir(b.dataset.mpIr, true); });
  $("mpSecs").addEventListener("toggle", e => { const d = e.target; if (d.open && d.dataset.sec) mpCargarSec(mpSecPorId(d.dataset.sec)); }, true);
  $("mpSecs").addEventListener("click", e => { const b = e.target.closest("[data-mp-reint]"); if (b) { const s = mpSecPorId(b.dataset.mpReint); s.estado = ""; mpCargarSec(s); } });
  $("btnCSVM").addEventListener("click", csvMiPais);
  $("btnEnlaceM").addEventListener("click", copiarEnlace);
  $("btnCompM").addEventListener("click", () => { PS.sel = [MP.iso]; entrarModo("paises"); });
}
