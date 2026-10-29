/* ===== Mapa por regiones dentro de "Mi país" (departamentos, estados, comunidades autónomas…) =====
   Límites: datos/geo/{ISO3}.json (Natural Earth y Eurostat/GISCO).  Cifras: datos/reg/{ISO3}.json (si existen). */
const RG = {geo: new Map(), dat: new Map(), iso: null, ind: null, sel: null, token: 0};
const RG_PAISES_CON_DATOS = "Europa (NUTS 2), Estados Unidos, Canadá, Brasil, Colombia y México";
async function rgJson(url) { try { const r = await fetch(url, {cache: "no-cache"}); return r.ok ? await r.json() : null; } catch (e) { return null; } }
async function rgCargar(iso) {
  if (!RG.geo.has(iso)) RG.geo.set(iso, await rgJson(`datos/geo/${iso}.json`));
  if (!RG.dat.has(iso)) RG.dat.set(iso, RG.geo.get(iso) ? await rgJson(`datos/reg/${iso}.json`) : null);
  return {geo: RG.geo.get(iso), dat: RG.dat.get(iso)};
}
function rgUlt(ind, rid) {                // último año con dato de una región
  const s = ind.s[rid]; if (!s) return null;
  const ys = Object.keys(s).filter(y => y !== "0").sort(); const y = ys.length ? ys[ys.length - 1] : "0";
  return {y: y === "0" ? "" : y, v: s[y]};
}
function rgFmt(v, ind) {
  const u = ind.u || "", a = Math.abs(v);
  if (u === "hab.") return big(v);
  if (u === "%") return num(v, 1) + " %";
  if (u === "años") return num(v, 1) + " años";
  return num(v, a >= 100 ? 0 : a >= 10 ? 1 : 2) + (u ? " " + u : "");
}
function rgLista(ind) {                   // [{rid, v, y}] ordenado de mayor a menor
  return Object.keys(ind.s).map(rid => Object.assign({rid}, rgUlt(ind, rid))).filter(x => x.v !== undefined).sort((a, b) => b.v - a.v);
}
function rgClases(vals) {                 // quintiles → cortes
  const s = vals.slice().sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return [q(.2), q(.4), q(.6), q(.8)];
}
// Indicadores donde «más» es mejor ("good") o peor ("bad"): se pintan de rojo (peor) a azul (mejor). El resto, en una sola gama azul.
const RG_TONO = {pib_pc: "good", pib_pps: "good", pib: "good", empleo: "good", vida: "good", ingreso: "good", paro: "bad", pobreza: "bad"};
const RG_DIV = ["#d7191c", "#fdae61", "#ffffbf", "#abd9e9", "#2c7bb6"];          // ColorBrewer RdYlBu, 5 clases
const rgPaleta = tono => tono === "good" ? RG_DIV : tono === "bad" ? RG_DIV.slice().reverse() : null;
function rgColor(v, cortes, tono) {
  const c = cortes.findIndex(x => v < x), k = c < 0 ? 4 : c, pal = rgPaleta(tono);
  return pal ? pal[k] : `color-mix(in srgb, var(--acento) ${[16, 34, 54, 74, 94][k]}%, var(--sup))`;
}
function rgMediana(vals) { const s = vals.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function rgMapa(geo, ind, lista, tono) {
  const val = new Map((lista || []).map(x => [x.rid, x])), cortes = lista && lista.length > 4 ? rgClases(lista.map(x => x.v)) : null;
  const paths = geo.r.map(r => {
    const x = val.get(r.i), fill = x && cortes ? rgColor(x.v, cortes, tono) : x ? "color-mix(in srgb, var(--acento) 45%, var(--sup))" : lista ? "var(--sindato)" : "var(--acento-t)";
    const tt = `${r.n}${x ? ": " + rgFmt(x.v, ind) + (x.y ? " (" + x.y + ")" : "") : lista ? ": sin dato" : ""}`;
    return `<path d="${r.p}" fill="${fill}" fill-rule="evenodd" class="rg-r${RG.sel === r.i ? " sel" : ""}" data-rid="${esc(r.i)}" tabindex="0" role="button" aria-label="${esc(tt)}"><title>${esc(tt)}</title></path>`;
  }).join("");
  return `<svg class="rg-svg" viewBox="-6 -6 ${geo.w + 12} ${geo.h + 12}" role="group" aria-label="Mapa de ${esc(geo.n.toLowerCase())}">${paths}</svg>`;
}
function rgLeyenda(lista, ind, tono) {
  if (!lista || lista.length < 5) return "";
  const c = rgClases(lista.map(x => x.v)), min = lista[lista.length - 1].v, max = lista[0].v;
  return `<div class="rg-ley"><span>${esc(rgFmt(min, ind))}</span>${[0, 1, 2, 3, 4].map(k => `<i style="background:${rgColor(k === 0 ? min : c[k - 1], c, tono)}"></i>`).join("")}<span>${esc(rgFmt(max, ind))}</span></div>` +
    (tono ? `<div class="nota" style="margin:0 0 6px">Rojo = situación menos favorable · azul = más favorable.</div>` : "");
}
function rgLectura(lista, ind, geo) {
  if (lista.length < 3) return "";
  const nom = rid => (geo.r.find(r => r.i === rid) || {}).n || rid, a = lista[0], b = lista[lista.length - 1], med = rgMediana(lista.map(x => x.v));
  let t = `<b>${esc(ind.n)}:</b> el valor más alto está en <b>${esc(nom(a.rid))}</b> (${esc(rgFmt(a.v, ind))}) y el más bajo en <b>${esc(nom(b.rid))}</b> (${esc(rgFmt(b.v, ind))}).`;
  if (ind.u !== "%" && ind.u !== "años" && b.v > 0) t += ` La región más alta supera ${num(a.v / b.v, a.v / b.v >= 10 ? 0 : 1)} veces a la más baja.`;
  else if (ind.u === "%" || ind.u === "años") t += ` La diferencia entre ambas es de ${num(a.v - b.v, 1)} ${ind.u === "%" ? "puntos porcentuales" : "años"}.`;
  t += ` La mediana de las regiones es ${esc(rgFmt(med, ind))}: la mitad está por encima y la otra mitad por debajo.`;
  return t;
}
function rgRanking(lista, ind, geo) {
  if (!lista.length) return "";
  const max = Math.max(...lista.map(x => Math.abs(x.v))) || 1, nom = new Map(geo.r.map(r => [r.i, r.n]));
  return `<ol class="rg-rank">${lista.map((x, i) => `<li data-rid="${esc(x.rid)}" class="${RG.sel === x.rid ? "sel" : ""}" tabindex="0"><span class="n">${i + 1}</span><span class="nm">${esc(nom.get(x.rid) || x.rid)}</span><span class="bar"><i style="width:${Math.max(2, Math.abs(x.v) / max * 100)}%"></i></span><b>${esc(rgFmt(x.v, ind))}</b></li>`).join("")}</ol>`;
}
function rgDetalle(geo, dat) {
  if (!RG.sel) return `<p class="nota" style="margin:8px 0 0">Haz clic en una región del mapa para ver todos sus datos y su puesto entre las demás.</p>`;
  const r = geo.r.find(x => x.i === RG.sel); if (!r) return "";
  const filas = Object.entries(dat?.ind || {}).map(([id, ind]) => {
    const lista = rgLista(ind), pos = lista.findIndex(x => x.rid === RG.sel); if (pos < 0) return "";
    const x = lista[pos], med = rgMediana(lista.map(y => y.v)), dif = x.v > med ? "sobre la mediana" : x.v < med ? "bajo la mediana" : "en la mediana";
    return `<tr><td>${esc(ind.n)}</td><td><b>${esc(rgFmt(x.v, ind))}</b>${x.y ? ` <small>(${x.y})</small>` : ""}</td><td>${pos + 1}.º de ${lista.length}</td><td><small>${dif}</small></td></tr>`;
  }).join("");
  return `<div class="rg-det"><h4>${esc(r.n)}</h4>${filas ? `<table><thead><tr><th>Indicador</th><th>Valor</th><th>Puesto</th><th></th></tr></thead><tbody>${filas}</tbody></table>` : `<p class="nota" style="margin:0">Todavía no hay cifras para esta región; por ahora solo disponemos de su territorio en el mapa.</p>`}</div>`;
}
function rgPintar() {
  const el = $("mpReg"); if (!el) return;
  const {geo, dat} = RG.cur || {}; const p = paisMap.get(RG.iso);
  if (!geo) { el.hidden = true; return; }
  el.hidden = false;
  const inds = dat ? Object.entries(dat.ind).filter(([, o]) => Object.keys(o.s).length >= 3) : [];
  if (inds.length && !inds.some(([id]) => id === RG.ind)) RG.ind = inds[0][0];
  const ind = inds.length ? dat.ind[RG.ind] : null, lista = ind ? rgLista(ind) : null, tono = RG_TONO[RG.ind] || null;
  const años = lista ? [...new Set(lista.map(x => x.y))].filter(Boolean) : [];
  const head = `<summary><div><h3>Mapa por regiones</h3><div class="sub">${esc(geo.n)} · ${geo.r.length} regiones${ind ? " · " + inds.length + " indicadores" : " · solo territorio"}</div></div></summary>`;
  let panel;
  if (ind) {
    panel = `<label class="rg-sel"><span>Indicador</span><select id="rgInd">${inds.map(([id, o]) => `<option value="${esc(id)}"${id === RG.ind ? " selected" : ""}>${esc(o.n)}</option>`).join("")}</select></label>` +
      `<p class="rg-lec">${rgLectura(lista, ind, geo)}</p>${rgLeyenda(lista, ind, tono)}` +
      (años.length > 1 ? `<p class="nota" style="margin:6px 0">Cada región muestra su dato más reciente; los años pueden variar (${esc(Math.min(...años))}–${esc(Math.max(...años))}).</p>` : "") +
      rgRanking(lista, ind, geo);
  } else {
    panel = `<p class="rg-lec">Para ${esc(p.nombre)} tenemos el <b>mapa de sus regiones</b> (${geo.r.length}), pero todavía no estadísticas por región. Las cifras regionales están disponibles para: ${RG_PAISES_CON_DATOS}.</p>` +
      `<div class="rg-chips">${geo.r.map(r => `<button class="pill${RG.sel === r.i ? " on" : ""}" data-rid="${esc(r.i)}">${esc(r.n)}</button>`).join("")}</div>`;
  }
  const fuentes = [geo.f, ...new Set(inds.map(([, o]) => o.f))].filter(Boolean);
  const enlaces = ind ? ` · <a href="${esc(ind.l)}" target="_blank" rel="noopener">ver la fuente del indicador</a>` : "";
  const open = el.open;
  el.innerHTML = head + `<div class="rg-cuerpo"><div class="rg-grid"><div class="rg-mapa">${rgMapa(geo, ind, lista, tono)}${rgDetalle(geo, dat)}</div><div class="rg-panel">${panel}</div></div>` +
    `<div class="nota" style="margin:10px 0 0">Fuentes: ${fuentes.map(esc).join("; ")}${enlaces}${dat ? ` · datos de ${esc(dat.generado)}` : ""}${ind ? ` <button class="btn sec" id="btnCSVR" style="margin-left:8px;padding:3px 10px;font-size:.8rem">CSV regional</button>` : ""}</div></div>`;
  el.open = open;
}
async function renderRegiones(iso) {
  const tk = ++RG.token; RG.iso = iso; RG.sel = null;
  const el = $("mpReg"); if (!el) return;
  el.hidden = true;
  const cur = await rgCargar(iso);
  if (tk !== RG.token) return;
  RG.cur = cur; if (!el.dataset.init) { el.open = true; el.dataset.init = "1"; }
  rgPintar();
}
function csvRegional() {
  medirEvento("csv-regional");
  const {geo, dat} = RG.cur || {}; if (!geo || !dat) return;
  const q = s => `"${String(s).replace(/"/g, '""')}"`, nom = new Map(geo.r.map(r => [r.i, r.n])), L = ["indicador;fuente;pais;iso3;region;codigo_region;anio;valor;unidad"], p = paisMap.get(RG.iso);
  for (const [id, ind] of Object.entries(dat.ind)) for (const [rid, s] of Object.entries(ind.s)) for (const [y, v] of Object.entries(s))
    L.push([q(ind.n), q(ind.f), q(p.nombre), RG.iso, q(nom.get(rid) || rid), rid, y === "0" ? "" : y, String(v).replace(".", ","), q(ind.u || "")].join(";"));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], {type: "text/csv;charset=utf-8"})); a.download = "regiones_" + RG.iso + ".csv"; document.body.appendChild(a); a.click(); a.remove();
}
function eventosRegiones() {
  const el = $("mpReg"); if (!el) return;
  const elegir = t => { const n = t.closest("[data-rid]"); if (n) { RG.sel = RG.sel === n.dataset.rid ? null : n.dataset.rid; rgPintar(); } };
  el.addEventListener("click", e => { if (e.target.closest("#btnCSVR")) return csvRegional(); if (e.target.closest("summary") || e.target.closest("select")) return; elegir(e.target); });
  el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-rid]")) { e.preventDefault(); elegir(e.target); } });
  el.addEventListener("change", e => { if (e.target.id === "rgInd") { RG.ind = e.target.value; rgPintar(); } });
}
