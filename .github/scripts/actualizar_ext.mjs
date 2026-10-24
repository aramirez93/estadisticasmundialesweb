// Descarga indicadores de la OMS, la OIT (ILOSTAT) y Our World in Data y los guarda en datos/ext/
// con un formato único: {generado, fuente, id, series: {ISO3: {año: valor}}}
// Se ejecuta con GitHub Actions. Si una descarga falla, se conserva el archivo anterior y se anota el motivo en datos/ext/_estado.json.
import fs from "node:fs";
const OUT = process.env.DATOS_EXT || "datos/ext";
fs.mkdirSync(OUT, {recursive: true});
const UA = {"User-Agent": "Mozilla/5.0 (compatible; estadisticas-mundiales-bot)", "Accept": "*/*"};

const OMS = ["WHOSIS_000002", "NCD_BMI_30A", "NCD_BMI_25A", "NCD_HYP_PREVALENCE_A", "M_Est_smk_curr_std", "UHC_INDEX_REPORTED", "WSH_SANITATION_SAFELY_MANAGED", "HWF_0006", "WHS6_102", "PHE_HHAIR_PROP_POP_CLEAN_FUELS"];
const OIT = [   // clasificación preferida (si no se indica, se usa el total o la categoría con más datos)
  {id: "UNE_2EAP_SEX_AGE_RT_A", classif1: "AGE_YTHADULT_Y15-24"}, {id: "SDG_0831_SEX_ECO_RT_A"}, {id: "HOW_TEMP_SEX_ECO_NB_A"}, {id: "ILR_TUMT_NOC_RT_A"}];
const OWID = ["happiness-cantril-ladder", "human-development-index", "daily-per-capita-caloric-supply", "global-hunger-index", "meat-supply-per-person", "annual-working-hours-per-worker", "per-capita-energy-use"];

async function pedir(url, formato, intentos = 3) {
  let err;
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, {headers: UA, signal: AbortSignal.timeout(120000)});
      if (!r.ok) throw new Error("HTTP " + r.status);
      return formato === "json" ? await r.json() : await r.text();
    } catch (e) { err = e; console.warn("  intento", i, e.message); await new Promise(r => setTimeout(r, 2500 * i)); }
  }
  throw err;
}
export function csv(texto) {                 // lector de CSV con comillas
  const filas = []; let f = [], c = "", q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) { if (ch === '"') { if (texto[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { f.push(c); c = ""; }
    else if (ch === "\n") { f.push(c); filas.push(f); f = []; c = ""; }
    else if (ch !== "\r") c += ch;
  }
  if (c !== "" || f.length) { f.push(c); filas.push(f); }
  const cab = filas.shift() || [];
  return {cab, filas};
}
const ISO3 = /^[A-Z]{3}$/;
const vacio = v => v === null || v === undefined || v === "" || v === "SEX_BTSX";
function paisesConDatos(series) { return Object.keys(series).length; }

async function oms(id) {
  const series = {}; let url = `https://ghoapi.azureedge.net/api/${id}?$filter=${encodeURIComponent("SpatialDimType eq 'COUNTRY'")}`, paginas = 0;
  while (url && paginas++ < 50) {
    const j = await pedir(url, "json");
    for (const r of j.value || []) {
      if (!ISO3.test(r.SpatialDim || "") || ![r.Dim1, r.Dim2, r.Dim3].every(vacio)) continue;
      const v = r.NumericValue ?? parseFloat(r.Value); const y = +r.TimeDim;
      if (!isFinite(v) || !y) continue;
      (series[r.SpatialDim] = series[r.SpatialDim] || {})[y] = v;
    }
    url = j["@odata.nextLink"] || null;
  }
  return series;
}
async function oit(def) {
  const t = await pedir(`https://rplumber.ilo.org/data/indicator/?id=${def.id}&type=code&format=.csv`, "text");
  const {cab, filas} = csv(t), ix = n => cab.indexOf(n);
  const iA = ix("ref_area"), iS = ix("sex"), iC1 = ix("classif1"), iC2 = ix("classif2"), iT = ix("time"), iV = ix("obs_value");
  if (iA < 0 || iT < 0 || iV < 0) throw new Error("columnas inesperadas: " + cab.slice(0, 8).join("|"));
  let rs = filas.filter(r => r.length > iV);
  if (iS >= 0) rs = rs.filter(r => r[iS] === "SEX_T");
  const elegir = (col, preferida) => {
    if (col < 0) return; const cuenta = {}; rs.forEach(r => { cuenta[r[col]] = (cuenta[r[col]] || 0) + 1; });
    const ks = Object.keys(cuenta); if (!ks.length) return;
    const total = ks.find(k => /(_TOTAL|_TOT|YGE15|^NOC_TOTAL)$/i.test(k)), mejor = (preferida && cuenta[preferida] ? preferida : total) || ks.sort((a, b) => cuenta[b] - cuenta[a])[0];
    rs = rs.filter(r => r[col] === mejor);
  };
  elegir(iC1, def.classif1); elegir(iC2, null);
  const series = {};
  for (const r of rs) {
    const y = parseInt(r[iT], 10), v = parseFloat(r[iV]); if (!ISO3.test(r[iA]) || !isFinite(v) || !y) continue;
    (series[r[iA]] = series[r[iA]] || {})[y] = v;
  }
  return series;
}
async function owid(slug) {
  const t = await pedir(`https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=true`, "text");
  const {cab, filas} = csv(t), iC = cab.findIndex(x => /^code$/i.test(x)), iY = cab.findIndex(x => /^(year|day)$/i.test(x));
  if (iC < 0 || iY < 0 || cab.length < 4) throw new Error("columnas inesperadas: " + cab.join("|"));
  const iV = cab.findIndex((x, i) => i !== iC && i !== iY && !/^entity$/i.test(x)), series = {};
  for (const r of filas) {
    const code = r[iC] === "OWID_KOS" ? "KOS" : r[iC], y = parseInt(r[iY], 10), v = parseFloat(r[iV]);
    if (!ISO3.test(code) || !isFinite(v) || !y) continue;
    (series[code] = series[code] || {})[y] = v;
  }
  return series;
}
const estado = {generado: new Date().toISOString(), fuentes: {}};
async function fuente(clave, nombre, items, fn) {
  const ok = [], fallos = [];
  console.log("==", nombre);
  for (const it of items) {
    const id = it.id || it, f = `${OUT}/${clave}_${id}.json`;
    try {
      const series = await fn(it), n = paisesConDatos(series);
      if (n < 20) throw new Error("solo " + n + " países con datos");
      fs.writeFileSync(f, JSON.stringify({generado: new Date().toISOString(), fuente: clave, id, series}));
      console.log("  ok", id, n, "países");
    } catch (e) { console.warn("  FALLO", id, e.message); fallos.push({id, motivo: String(e.message).slice(0, 160)}); }
    if (fs.existsSync(f)) ok.push(id);           // si hay archivo (de hoy o anterior), el sitio lo puede usar
  }
  estado.fuentes[clave] = {ok, fallos};
}
await fuente("oms", "OMS (Observatorio Mundial de la Salud)", OMS, oms);
await fuente("oit", "OIT (ILOSTAT)", OIT, oit);
await fuente("owid", "Our World in Data", OWID, owid);
fs.writeFileSync(`${OUT}/_estado.json`, JSON.stringify(estado, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(estado.fuentes).map(([k, v]) => [k, {ok: v.ok.length, fallos: v.fallos.length}]))));
