// Descarga estadísticas por región (primer nivel territorial) y las guarda en datos/reg/{ISO3}.json
//   Europa  → Eurostat (NUTS 2)          EE. UU. → Census Bureau (ACS 5 años)
//   Brasil  → IBGE (SIDRA)               Canadá  → Statistics Canada (tablas CSV)
//   Colombia y México → Wikidata (población y superficie, que cita a DANE e INEGI)
// Si un indicador falla se conserva el archivo anterior y el motivo queda en datos/reg/_estado.json.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const OUT = path.resolve("datos/reg");
const GEO = path.resolve("datos/geo");
const UA = { "User-Agent": "estadisticasmundiales.online (datos abiertos)" };
const NUTS_ISO3 = { PT:"PRT", ES:"ESP", FR:"FRA", IT:"ITA", CH:"CHE", UK:"GBR", LI:"LIE", AT:"AUT", DE:"DEU", LU:"LUX", BE:"BEL", NL:"NLD", CY:"CYP", EL:"GRC", TR:"TUR", AL:"ALB", MT:"MLT", BG:"BGR", MK:"MKD", ME:"MNE", RS:"SRB", HR:"HRV", RO:"ROU", SI:"SVN", HU:"HUN", CZ:"CZE", IE:"IRL", DK:"DNK", NO:"NOR", IS:"ISL", SK:"SVK", PL:"POL", LT:"LTU", LV:"LVA", SE:"SWE", EE:"EST", FI:"FIN" };
const IBGE_UF = { 11:"RO",12:"AC",13:"AM",14:"RR",15:"PA",16:"AP",17:"TO",21:"MA",22:"PI",23:"CE",24:"RN",25:"PB",26:"PE",27:"AL",28:"SE",29:"BA",31:"MG",32:"ES",33:"RJ",35:"SP",41:"PR",42:"SC",43:"RS",50:"MS",51:"MT",52:"GO",53:"DF" };

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const redondea = (v) => Math.round(v * 100) / 100;
const hoy = new Date().toISOString().slice(0, 10);

async function pedir(url, opts = {}, intentos = 3) {
  let err;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) { err = e; await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); }
  }
  throw new Error(`${url.slice(0, 90)} → ${err.message}`);
}
const json = async (url, opts) => (await pedir(url, opts)).json();

export function csv(texto) {              // CSV con comillas → matriz
  const filas = []; let f = [], c = "", q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) { if (ch === '"') { if (texto[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { f.push(c); c = ""; }
    else if (ch === "\n") { f.push(c); filas.push(f); f = []; c = ""; }
    else if (ch !== "\r") c += ch;
  }
  if (c || f.length) { f.push(c); filas.push(f); }
  return filas;
}

// ---- estado de la ejecución ----
const estado = { generado: hoy, paises: {} };
const regs = {};                             // iso3 → {id→nombre}
const previo = (iso3) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, `${iso3}.json`), "utf8")); } catch { return null; } };
const acum = {};                             // iso3 → {ind}
function cuenta(iso3, id, ok, motivo) {
  const e = (estado.paises[iso3] ||= { ok: [], fallos: [] });
  if (ok) e.ok.push(id); else e.fallos.push({ id, motivo: String(motivo).slice(0, 220) });
}
function guardarInd(iso3, id, meta, serie) {            // serie: {regionId:{año:valor}}
  const validas = regs[iso3] || {};
  const s = {}; let n = 0;
  for (const [rid, años] of Object.entries(serie)) {
    if (!validas[rid]) continue;
    const o = {};
    for (const [y, v] of Object.entries(años)) if (Number.isFinite(v)) o[y] = redondea(v);
    if (Object.keys(o).length) { s[rid] = o; n++; }
  }
  if (n < 3) throw new Error(`solo ${n} regiones con datos`);
  (acum[iso3] ||= {})[id] = { ...meta, s };
  cuenta(iso3, id, true);
}
async function intentar(iso3, id, fn) {
  try { await fn(); } catch (e) { console.warn(`[${iso3}] ${id}: ${e.message}`); cuenta(iso3, id, false, e.message); }
}

// ---- Eurostat (JSON-stat) ----
function jsonstat(js) {                  // → [{geo, time, v}]
  const ids = js.id, size = js.size, filas = [];
  const pos = {}; ids.forEach((d, i) => (pos[d] = i));
  const fijo = {};                       // dimensiones sin filtrar: se usa su categoría «total»
  for (const d of ids) {
    const n = size[ids.indexOf(d)];
    if (d === "geo" || d === "time" || n <= 1) { fijo[d] = 0; continue; }
    const cat = Object.keys(js.dimension[d].category.index), t = cat.find((c) => /^(TOTAL|T|TOTAL_T)$/i.test(c));
    if (!t) throw new Error(`dimensión sin filtrar: ${d}`);
    fijo[d] = js.dimension[d].category.index[t];
  }
  const paso = []; let acc = 1;
  for (let i = ids.length - 1; i >= 0; i--) { paso[i] = acc; acc *= size[i]; }
  const gi = js.dimension.geo.category.index, ti = js.dimension.time.category.index;
  const g = Object.entries(gi), t = Object.entries(ti);
  for (const [geo, a] of g) for (const [time, b] of t) {
    let k = a * paso[pos.geo] + b * paso[pos.time];
    for (const d of ids) if (d !== "geo" && d !== "time") k += fijo[d] * paso[pos[d]];
    const v = js.value?.[k];
    if (v !== undefined && v !== null) filas.push({ geo, time, v });
  }
  return filas;
}
const EUROSTAT = [
  { id: "pob", t: "demo_r_d2jan", q: "sex=T&age=TOTAL&unit=NR", n: "Población (1 de enero)", u: "hab." },
  { id: "dens", t: "demo_r_d3dens", q: "unit=PER_KM2", n: "Densidad de población", u: "hab./km²" },
  { id: "pib_pc", t: "nama_10r_2gdp", q: "unit=EUR_HAB", n: "PIB por habitante", u: "€" },
  { id: "pib_pps", t: "nama_10r_2gdp", q: "unit=PPS_EU27_2020_HAB", n: "PIB por habitante (poder adquisitivo, PPS)", u: "PPS" },
  { id: "paro", t: "lfst_r_lfu3rt", q: "sex=T&age=Y15-74&unit=PC", n: "Tasa de paro (15-74 años)", u: "%" },
  { id: "empleo", t: "lfst_r_lfe2emprt", q: "sex=T&age=Y20-64&unit=PC", n: "Tasa de empleo (20-64 años)", u: "%" },
  { id: "vida", t: "demo_r_mlifexp", q: "sex=T&age=Y_LT1&unit=YR", n: "Esperanza de vida al nacer", u: "años" },
];
async function europa() {
  for (const ind of EUROSTAT) {
    let filas;
    try {
      const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ind.t}?format=JSON&lang=EN&geoLevel=nuts2&sinceTimePeriod=2012&${ind.q}`;
      filas = jsonstat(await json(url));
    } catch (e) { for (const iso3 of Object.values(NUTS_ISO3)) if (regs[iso3]) cuenta(iso3, ind.id, false, e.message); console.warn(`[Eurostat] ${ind.id}: ${e.message}`); continue; }
    const por = {};
    for (const f of filas) {
      const iso3 = NUTS_ISO3[f.geo.slice(0, 2)]; if (!iso3) continue;
      const y = String(f.time).slice(0, 4);
      ((por[iso3] ||= {})[f.geo] ||= {})[y] = f.v;
    }
    for (const iso3 of Object.values(NUTS_ISO3)) {
      if (!regs[iso3]) continue;
      await intentar(iso3, ind.id, async () => {
        if (!por[iso3]) throw new Error("sin datos");
        guardarInd(iso3, ind.id, { n: ind.n, u: ind.u, f: "Eurostat", l: `https://ec.europa.eu/eurostat/databrowser/view/${ind.t}/default/table` }, por[iso3]);
      });
    }
  }
}

// ---- Estados Unidos: Census Bureau, ACS 5 años ----
async function eeuu() {
  const iso3 = "USA"; if (!regs[iso3]) return;
  const geo = JSON.parse(fs.readFileSync(path.join(GEO, "USA.json"), "utf8"));
  const porFips = Object.fromEntries(geo.r.filter((r) => r.c).map((r) => [r.c, r.i]));
  const vars = "NAME,B01003_001E,B19013_001E,B01002_001E,B23025_003E,B23025_005E,B17001_001E,B17001_002E,B25077_001E";
  const S = { pob: {}, ingreso: {}, edad: {}, paro: {}, pobreza: {}, vivienda: {} };
  let anios = 0, errCensus = "";
  for (const año of Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 - i)) {   // los últimos años disponibles, sin lista fija
    let tabla;
    try { tabla = await json(`https://api.census.gov/data/${año}/acs/acs5?get=${vars}&for=state:*`); } catch (e) { errCensus = e.message; console.warn(`[USA] ACS ${año}: ${e.message}`); continue; }
    const h = tabla[0], ix = Object.fromEntries(h.map((c, i) => [c, i]));
    const num = (v) => { const x = Number(v); return Number.isFinite(x) && x > -1e6 ? x : NaN; };
    anios++;
    for (const f of tabla.slice(1)) {
      const rid = porFips[f[ix.state]]; if (!rid) continue;
      const set = (k, v) => { if (Number.isFinite(v)) ((S[k][rid] ||= {})[año] = v); };
      set("pob", num(f[ix.B01003_001E])); set("ingreso", num(f[ix.B19013_001E])); set("edad", num(f[ix.B01002_001E]));
      set("vivienda", num(f[ix.B25077_001E]));
      set("paro", (num(f[ix.B23025_005E]) / num(f[ix.B23025_003E])) * 100);
      set("pobreza", (num(f[ix.B17001_002E]) / num(f[ix.B17001_001E])) * 100);
    }
  }
  const L = "https://www.census.gov/data/developers/data-sets/acs-5year.html";
  const M = { pob: ["Población", "hab."], ingreso: ["Ingreso mediano de los hogares", "US$"], edad: ["Edad mediana", "años"], paro: ["Tasa de paro", "%"], pobreza: ["Población bajo la línea de pobreza", "%"], vivienda: ["Valor mediano de la vivienda propia", "US$"] };
  for (const [id, [n, u]] of Object.entries(M)) await intentar(iso3, id, async () => {
    if (!anios) throw new Error("Census Bureau: " + errCensus);
    guardarInd(iso3, id, { n, u, f: "U.S. Census Bureau · ACS 5 años", l: L }, S[id]);
  });
}

// ---- Brasil: IBGE SIDRA ----
async function sidra(tabla, variable, periodos) {
  const filas = await json(`https://apisidra.ibge.gov.br/values/t/${tabla}/n3/all/v/${variable}/p/${periodos}`);
  const cab = filas[0];
  const kUF = Object.keys(cab).find((k) => /^D\d+C$/.test(k) && /Federa|Unidade|territ/i.test(cab[k]));
  const kP = Object.keys(cab).find((k) => /^D\d+C$/.test(k) && /Ano|Trimestre|Per[ií]odo/i.test(cab[k]));
  if (!kUF || !kP) throw new Error("estructura SIDRA inesperada");
  const s = {};
  for (const f of filas.slice(1)) {
    const sigla = IBGE_UF[Number(f[kUF])]; if (!sigla) continue;
    const v = Number(f.V); if (!Number.isFinite(v)) continue;
    const y = String(f[kP]).slice(0, 4);
    ((s["BR-" + sigla] ||= {})[y] = v);          // si hay varios trimestres, queda el último
  }
  return s;
}
async function brasil() {
  const iso3 = "BRA"; if (!regs[iso3]) return;
  let pob = {};
  await intentar(iso3, "pob", async () => {
    pob = await sidra(6579, 9324, "last%2010");
    guardarInd(iso3, "pob", { n: "Población (estimación)", u: "hab.", f: "IBGE · SIDRA", l: "https://sidra.ibge.gov.br/tabela/6579" }, pob);
  });
  await intentar(iso3, "paro", async () => {
    const s = await sidra(4099, 4099, "last%2040");
    guardarInd(iso3, "paro", { n: "Tasa de desocupación", u: "%", f: "IBGE · PNAD Continua", l: "https://sidra.ibge.gov.br/tabela/4099" }, s);
  });
  await intentar(iso3, "pib", async () => {
    const s = await sidra(5938, 37, "last%205");           // mil reales corrientes
    const mm = {}, pc = {};
    for (const [r, a] of Object.entries(s)) for (const [y, v] of Object.entries(a)) {
      (mm[r] ||= {})[y] = v / 1000;
      if (pob[r]?.[y]) (pc[r] ||= {})[y] = (v * 1000) / pob[r][y];
    }
    guardarInd(iso3, "pib", { n: "PIB (millones de reales)", u: "M R$", f: "IBGE · Cuentas regionales", l: "https://sidra.ibge.gov.br/tabela/5938" }, mm);
    if (Object.keys(pc).length > 2) guardarInd(iso3, "pib_pc", { n: "PIB por habitante", u: "R$", f: "IBGE · Cuentas regionales", l: "https://sidra.ibge.gov.br/tabela/5938" }, pc);
  });
}

// ---- Canadá: tablas completas de Statistics Canada ----
async function tablaCanada(pid, filtro) {
  const r = await pedir(`https://www150.statcan.gc.ca/n1/tbl/csv/${pid}-eng.zip`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
  const zip = path.join(dir, "t.zip");
  fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  const txt = execFileSync("unzip", ["-p", zip, `${pid}.csv`], { maxBuffer: 2e9 }).toString("utf8").replace(/^﻿/, "");
  fs.rmSync(dir, { recursive: true, force: true });
  const filas = csv(txt), h = filas[0], ix = Object.fromEntries(h.map((c, i) => [c, i]));
  if (ix.REF_DATE === undefined || ix.GEO === undefined || ix.VALUE === undefined) throw new Error("columnas inesperadas");
  const porNombre = Object.fromEntries(Object.entries(regs.CAN).map(([id, n]) => [norm(n), id]));
  const s = {};
  for (const f of filas.slice(1)) {
    if (!filtro(f, ix)) continue;
    const rid = porNombre[norm(f[ix.GEO])]; if (!rid) continue;
    const v = Number(f[ix.VALUE]); if (!Number.isFinite(v)) continue;
    ((s[rid] ||= {})[String(f[ix.REF_DATE]).slice(0, 4)] = v);
  }
  return s;
}
async function canada() {
  const iso3 = "CAN"; if (!regs[iso3]) return;
  let pob = {};
  await intentar(iso3, "pob", async () => {
    pob = await tablaCanada("17100005", (f, ix) => /All ages/i.test(f[ix["Age group"]] ?? "") && /Total/i.test(f[ix.Gender] ?? ""));
    guardarInd(iso3, "pob", { n: "Población (1 de julio)", u: "hab.", f: "Statistics Canada · tabla 17-10-0005-01", l: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000501" }, pob);
  });
  await intentar(iso3, "pib", async () => {
    const s = await tablaCanada("36100222", (f, ix) => /Current prices/i.test(f[ix.Prices] ?? "") && /^Gross domestic product at market prices$/i.test(f[ix.Estimates] ?? ""));
    const pc = {};
    for (const [r, a] of Object.entries(s)) for (const [y, v] of Object.entries(a)) if (pob[r]?.[y]) (pc[r] ||= {})[y] = (v * 1e6) / pob[r][y];
    guardarInd(iso3, "pib", { n: "PIB (millones de CAD)", u: "M CAD", f: "Statistics Canada · tabla 36-10-0222-01", l: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610022201" }, s);
    if (Object.keys(pc).length > 2) guardarInd(iso3, "pib_pc", { n: "PIB por habitante", u: "CAD", f: "Statistics Canada · tabla 36-10-0222-01", l: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610022201" }, pc);
  });
}

// ---- Colombia y México: Wikidata (cita a DANE e INEGI) ----
async function wikidata(iso3, prefijo, fuente, enlace) {
  if (!regs[iso3]) return;
  const q = `SELECT ?iso ?pop ?t ?area WHERE { ?r wdt:P300 ?iso . FILTER(STRSTARTS(?iso,"${prefijo}-")) OPTIONAL { ?r p:P1082 ?ps . ?ps ps:P1082 ?pop . OPTIONAL { ?ps pq:P585 ?t } } OPTIONAL { ?r wdt:P2046 ?area } }`;
  let filas;
  try { filas = (await json(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { headers: { Accept: "application/sparql-results+json" } })).results.bindings; }
  catch (e) { for (const id of ["pob", "area", "dens"]) cuenta(iso3, id, false, e.message); console.warn(`[${iso3}] Wikidata: ${e.message}`); return; }
  const pob = {}, area = {};
  for (const b of filas) {
    const rid = b.iso.value;
    if (b.pop && b.t) { const y = b.t.value.slice(0, 4); if (Number(y) >= 2005) ((pob[rid] ||= {})[y] = Number(b.pop.value)); }
    if (b.area) area[rid] = Number(b.area.value);
  }
  const dens = {};
  for (const [r, a] of Object.entries(pob)) if (area[r]) { const ult = Math.max(...Object.keys(a).map(Number)); (dens[r] = {})[ult] = a[ult] / area[r]; }
  const meta = { f: fuente, l: enlace };
  await intentar(iso3, "pob", async () => guardarInd(iso3, "pob", { n: "Población", u: "hab.", ...meta }, pob));
  await intentar(iso3, "area", async () => guardarInd(iso3, "area", { n: "Superficie", u: "km²", ...meta }, Object.fromEntries(Object.entries(area).map(([r, v]) => [r, { 0: v }]))));
  await intentar(iso3, "dens", async () => guardarInd(iso3, "dens", { n: "Densidad de población", u: "hab./km²", ...meta }, dens));
}

// ---- Wikidata para todos los demás países (población y superficie de sus regiones) ----
async function wikidataResto() {
  for (const iso3 of Object.keys(regs)) {
    if (acum[iso3]?.pob || /^[A-Z]{2}\d/.test(Object.keys(regs[iso3])[0] || "")) continue;      // ya tiene fuente oficial, o es NUTS
    const cuenta2 = {};
    for (const id of Object.keys(regs[iso3])) { const m = id.match(/^([A-Z]{2})-/); if (m) cuenta2[m[1]] = (cuenta2[m[1]] || 0) + 1; }
    const pref = Object.entries(cuenta2).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!pref) continue;
    await wikidata(iso3, pref, "Wikidata (cifras de los institutos nacionales de estadística)", `https://www.wikidata.org/wiki/Special:Search?search=${pref}`);
    await new Promise((ok) => setTimeout(ok, 800));
  }
}

// ---- ejecución ----
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(GEO)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    const d = JSON.parse(fs.readFileSync(path.join(GEO, f), "utf8"));
    regs[f.slice(0, 3)] = Object.fromEntries(d.r.map((r) => [r.i, r.n]));
  }
  await europa();
  await eeuu();
  await brasil();
  await canada();
  await wikidata("COL", "CO", "Wikidata (datos de DANE)", "https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion");
  await wikidata("MEX", "MX", "Wikidata (datos de INEGI)", "https://www.inegi.org.mx/temas/estructura/");
  await wikidataResto();
  let n = 0;
  for (const [iso3, ind] of Object.entries(acum)) {
    const ant = previo(iso3);
    const mezcla = { ...(ant?.ind || {}), ...ind };          // lo que falló conserva el valor previo
    fs.writeFileSync(path.join(OUT, `${iso3}.json`), JSON.stringify({ generado: hoy, ind: mezcla })); n++;
  }
  fs.writeFileSync(path.join(OUT, "_estado.json"), JSON.stringify(estado));
  const fallos = Object.values(estado.paises).reduce((a, p) => a + p.fallos.length, 0);
  console.log(`${n} países con datos regionales; ${fallos} indicadores con fallo`);
}
