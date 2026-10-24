// Genera datos/geo/{ISO3}.json: mapa de la primera subdivisión de cada país, listo para dibujar en SVG.
// Fuentes: Natural Earth (dominio público) y Eurostat/GISCO vía Nuts2json (regiones NUTS 2 de Europa).
// Uso: node .github/scripts/generar_geo.mjs [carpeta_con_ne10.json_y_nuts2.json]  (sin argumento, descarga de GitHub)
import fs from "node:fs";
import path from "node:path";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const NUTS = "https://raw.githubusercontent.com/eurostat/Nuts2json/master/pub/v2/2021/4326/10M/nutsrg_2.json";
const OUT = path.resolve("datos/geo");
const ANCHO = 1000;       // ancho del mapa principal en unidades de dibujo
const TOL = 1.1;          // tolerancia de simplificación (unidades)

// NUTS (prefijo) → ISO3
const NUTS_ISO3 = { PT:"PRT", ES:"ESP", FR:"FRA", IT:"ITA", CH:"CHE", UK:"GBR", LI:"LIE", AT:"AUT", DE:"DEU", LU:"LUX", BE:"BEL", NL:"NLD", CY:"CYP", EL:"GRC", TR:"TUR", AL:"ALB", MT:"MLT", BG:"BGR", MK:"MKD", ME:"MNE", RS:"SRB", HR:"HRV", RO:"ROU", SI:"SVN", HU:"HUN", CZ:"CZE", IE:"IRL", DK:"DNK", NO:"NOR", IS:"ISL", SK:"SVK", PL:"POL", LT:"LTU", LV:"LVA", SE:"SWE", EE:"EST", FI:"FIN" };
const NIVEL = { COL:"Departamentos", MEX:"Estados", USA:"Estados", CAN:"Provincias y territorios", BRA:"Estados", ESP:"Comunidades autónomas (NUTS 2)", FRA:"Regiones (NUTS 2)", ITA:"Regiones (NUTS 2)", DEU:"Distritos (NUTS 2)", PRT:"Regiones (NUTS 2)", GBR:"Regiones (NUTS 2)", NLD:"Provincias (NUTS 2)", BEL:"Provincias (NUTS 2)", POL:"Voivodatos (NUTS 2)", GRC:"Regiones (NUTS 2)", AUT:"Estados (NUTS 2)" };
const MEX_NOMBRE = { "Distrito Federal": "Ciudad de México" };

async function leer(arg, nombre, url) {
  if (arg && fs.existsSync(path.join(arg, nombre))) return JSON.parse(fs.readFileSync(path.join(arg, nombre), "utf8"));
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

// ---- geometría ----
const anillos = (geom) => {            // → lista de polígonos; cada uno = [exterior, ...huecos]
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
};
const bboxP = (poly) => {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const [x, y] of poly[0]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
};
const areaP = (poly) => { const [a, b, c, d] = bboxP(poly); return (c - a) * (d - b); };

function dp(pts, tol) {                 // Douglas-Peucker iterativo
  const n = pts.length; if (n < 5) return pts;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const pila = [[0, n - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let m = -1, dm = tol;
    const [x1, y1] = pts[i], [x2, y2] = pts[j];
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    for (let k = i + 1; k < j; k++) {
      const [x, y] = pts[k];
      let d;
      if (l2 === 0) d = Math.hypot(x - x1, y - y1);
      else { const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2)); d = Math.hypot(x - x1 - t * dx, y - y1 - t * dy); }
      if (d > dm) { dm = d; m = k; }
    }
    if (m > 0) { keep[m] = 1; pila.push([i, m], [m, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

function trazo(anillo, tol) {           // anillo ya escalado → "Mx y l dx dy …z"
  let p = dp(anillo, tol).map(([x, y]) => [Math.round(x), Math.round(y)]);
  p = p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
  if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  if (p.length < 3) return "";
  let s = `M${p[0][0]} ${p[0][1]}l`, px = p[0][0], py = p[0][1];
  const t = [];
  for (let i = 1; i < p.length; i++) { t.push(`${p[i][0] - px} ${p[i][1] - py}`); px = p[i][0]; py = p[i][1]; }
  return s + t.join(" ") + "z";
}

// Agrupa las partes de un país en el conjunto principal y las lejanas (islas de ultramar)
function construir(iso3, regs) {
  // regs: [{id,n,polys:[poly]}] en grados lon/lat
  const todos = regs.flatMap((r) => r.polys.map((p) => ({ r, p })));
  // cruce del antimeridiano
  let xmin = 1e9, xmax = -1e9;
  for (const t of todos) for (const c of t.p[0]) { if (c[0] < xmin) xmin = c[0]; if (c[0] > xmax) xmax = c[0]; }
  if (xmax - xmin > 200) for (const t of todos) for (const a of t.p) for (const c of a) if (c[0] < 0) c[0] += 360;
  // conjunto principal: parte mayor + las que quedan a menos de 12° (se repite hasta estabilizar)
  todos.forEach((t) => (t.bb = bboxP(t.p)));
  todos.sort((a, b) => areaP(b.p) - areaP(a.p));
  const MARG = 12;
  let box = todos[0].bb.slice();
  const main = new Set([todos[0]]);
  for (let ch = true; ch;) {
    ch = false;
    for (const t of todos) {
      if (main.has(t)) continue;
      const b = t.bb;
      if (b[2] >= box[0] - MARG && b[0] <= box[2] + MARG && b[3] >= box[1] - MARG && b[1] <= box[3] + MARG) {
        main.add(t); box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])]; ch = true;
      }
    }
  }
  const lat0 = (box[1] + box[3]) / 2, k = Math.cos((lat0 * Math.PI) / 180);
  const ancho = (box[2] - box[0]) * k, alto = box[3] - box[1];
  const S = ANCHO / Math.max(ancho, alto);
  const proy = (x, y) => [(x - box[0]) * k * S, (box[3] - y) * S];
  // lejanas → recuadros en una franja inferior
  const lejos = todos.filter((t) => !main.has(t));
  let W = ancho * S, H = alto * S;
  const out = new Map(regs.map((r) => [r, []]));
  for (const t of main) out.get(t.r).push(t.p.map((a) => a.map(([x, y]) => proy(x, y))));
  if (lejos.length) {
    // las partes de una misma región lejana se agrupan; cada grupo se escala a ≤ 22 % del ancho
    const grupos = new Map();
    for (const t of lejos) { if (!grupos.has(t.r)) grupos.set(t.r, []); grupos.get(t.r).push(t); }
    const alturaFranja = Math.max(H * 0.22, 60);
    let cursor = 0; const y0 = H + 30;
    for (const [r, ts] of grupos) {
      const b = ts.reduce((q, t) => [Math.min(q[0], t.bb[0]), Math.min(q[1], t.bb[1]), Math.max(q[2], t.bb[2]), Math.max(q[3], t.bb[3])], [1e9, 1e9, -1e9, -1e9]);
      const kk = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
      const w = (b[2] - b[0]) * kk, h = b[3] - b[1];
      const s = Math.min(S, (alturaFranja) / Math.max(h, 1e-6), (ancho * S * 0.22) / Math.max(w, 1e-6));
      for (const t of ts) out.get(r).push(t.p.map((a) => a.map(([x, y]) => [cursor + (x - b[0]) * kk * s, y0 + (b[3] - y) * s])));
      cursor += w * s + 25;
    }
    W = Math.max(W, cursor); H = y0 + alturaFranja;
  }
  return { W: Math.round(W), H: Math.round(H), partes: out };
}

function salida(iso3, fuente, nivel, regs) {
  const { W, H, partes } = construir(iso3, regs);
  const r = [];
  for (const [reg, polys] of partes) {
    let d = "";
    const ordenadas = polys.slice().sort((a, b) => areaP(b) - areaP(a));
    ordenadas.forEach((poly, i) => {
      const a = areaP(poly);
      if (i > 0 && a < 4) return;                       // motas invisibles
      poly.forEach((anillo, j) => { d += trazo(anillo, TOL); });
    });
    if (!d) { // región diminuta: se conserva sin simplificar
      const poly = ordenadas[0]; if (poly) d = trazo(poly[0], 0);
    }
    if (d) r.push({ i: reg.id, n: reg.n, ...(reg.c ? { c: reg.c } : {}), p: d });
  }
  r.sort((a, b) => a.n.localeCompare(b.n, "es"));
  return { f: fuente, n: nivel, w: W, h: H, r };
}

// Alaska y Hawái se reubican como recuadros (como en los mapas habituales de EE. UU.)
function ajustarUSA(regs) {
  for (const r of regs) {
    if (r.id === "US-AK") for (const poly of r.polys) for (const a of poly) for (const c of a) { if (c[0] > 0) c[0] -= 360; c[0] = (c[0] + 150) * 0.38 - 118; c[1] = (c[1] - 64) * 0.5 + 27; }
    if (r.id === "US-HI") for (const poly of r.polys) for (const a of poly) for (const c of a) { c[0] += 52; c[1] += 5; }
  }
}

const arg = process.argv[2];
const ne = await leer(arg, "ne10.json", NE);
const nuts = await leer(arg, "nuts2.json", NUTS);
fs.mkdirSync(OUT, { recursive: true });

const porPais = new Map();
for (const f of ne.features) {
  const p = f.properties; const iso3 = p.adm0_a3;
  if (!iso3 || !p.name) continue;
  if (!porPais.has(iso3)) porPais.set(iso3, []);
  porPais.get(iso3).push(f);
}
const indice = {};
const euro = new Map();
for (const f of nuts.features) {
  const iso3 = NUTS_ISO3[f.properties.id.slice(0, 2)]; if (!iso3) continue;
  if (!euro.has(iso3)) euro.set(iso3, []);
  euro.get(iso3).push(f);
}

const escribir = (iso3, data) => {
  const s = JSON.stringify(data);
  fs.writeFileSync(path.join(OUT, `${iso3}.json`), s);
  indice[iso3] = { regiones: data.r.length, nivel: data.n, fuente: data.f, bytes: s.length };
};

for (const [iso3, fs_] of euro) {
  const regs = fs_.map((f) => ({ id: f.properties.id, n: f.properties.na, polys: anillos(f.geometry) }));
  escribir(iso3, salida(iso3, "Eurostat · GISCO (NUTS 2021)", NIVEL[iso3] || "Regiones (NUTS 2)", regs));
}
for (const [iso3, lista] of porPais) {
  if (euro.has(iso3)) continue;
  const vistos = new Set();
  const regs = lista.map((f) => {
    const p = f.properties;
    let nombre = p.name; let id = p.iso_3166_2; let c;
    if (iso3 === "COL" && p.name === "Bogota") { id = "CO-DC"; nombre = "Bogotá D. C."; }
    if (iso3 === "MEX" && p.name === "Distrito Federal") { id = "MX-CMX"; nombre = MEX_NOMBRE[p.name]; }
    if (iso3 === "USA" && p.code_local) c = String(p.code_local).replace(/^US/, "");   // código FIPS
    if (!id || /~|^[A-Z]{2}-X/.test(id) || vistos.has(id)) id = (iso3 + "-" + (p.name || "").normalize("NFD").replace(/[^\w]/g, "")).toUpperCase();
    vistos.add(id);
    return { id, n: nombre, c, polys: anillos(f.geometry) };
  }).filter((r) => r.polys.length);
  if (iso3 === "USA") ajustarUSA(regs);
  escribir(iso3, salida(iso3, "Natural Earth (dominio público)", NIVEL[iso3] || "Divisiones territoriales", regs));
}
fs.writeFileSync(path.join(OUT, "_indice.json"), JSON.stringify({ generado: new Date().toISOString().slice(0, 10), paises: indice }));
const total = Object.values(indice).reduce((a, b) => a + b.bytes, 0);
console.log(`${Object.keys(indice).length} países, ${(total / 1e6).toFixed(1)} MB`);
