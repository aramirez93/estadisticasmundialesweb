// Genera map-data.js: geometría mundial proyectada (Natural Earth) con corte correcto en el antimeridiano.
import fs from "fs";
import { createRequire } from "module";
import { geoNaturalEarth1, geoPath, geoArea } from "d3-geo";
import { presimplify, simplify, quantile } from "topojson-simplify";
const require = createRequire(import.meta.url);
const topojson = require("topojson-client");
const iso = require("i18n-iso-countries");
const { countries } = require("countries-list");

const RES = process.argv[2] || "50m";
const Q = +(process.argv[3] || 0.3);           // fracción de puntos a eliminar
let topo = JSON.parse(fs.readFileSync(`node_modules/world-atlas/countries-${RES}.json`, "utf8"));
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, Q));
const fc = topojson.feature(topo, topo.objects.countries);

const K = 170;
const proj = geoNaturalEarth1().scale(K).translate([0, 0]);
const path = geoPath(proj).digits(1);
const EXTRA = { Kosovo: "XKX" };
const MIN_AREA = 4e-6;                          // sr (~160 km²): descarta islotes diminutos

const shapes = [];
let minY = 1e9, maxY = -1e9;
for (const f of fc.features) {
  const name = f.properties.name;
  if (name === "Antarctica") continue;
  const code = (f.id ? iso.numericToAlpha3(String(f.id).padStart(3, "0")) : EXTRA[name]) || "";
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let keep = polys.filter(p => geoArea({ type: "Polygon", coordinates: p }) >= MIN_AREA);
  if (!keep.length) keep = polys;               // país diminuto: se conserva
  const geom = { type: "MultiPolygon", coordinates: keep };
  const d = path(geom);
  if (!d) continue;
  const b = path.bounds(geom);
  minY = Math.min(minY, b[0][1]); maxY = Math.max(maxY, b[1][1]);
  shapes.push([code, name, d]);
}
const W = proj([180, 0])[0];
const pad = 6;
const vb = [-W - pad, minY - pad, 2 * W + 2 * pad, maxY - minY + 2 * pad].map(n => +n.toFixed(1));

const continents = {};
for (const [a2, info] of Object.entries(countries)) {
  const a3 = iso.alpha2ToAlpha3(a2);
  if (a3) continents[a3] = info.continent;
}
continents.XKX = "EU";

const out = `// Generado automáticamente (world-atlas ${RES}, proyección Natural Earth)
const MAP = ${JSON.stringify({ k: K, viewBox: vb, shapes })};
const CONTINENTE = ${JSON.stringify(continents)};
`;
fs.writeFileSync("map-data.js", out);
console.log("shapes:", shapes.length, "bytes:", out.length, "viewBox:", vb.join(" "));
console.log("sin ISO:", shapes.filter(s => !s[0]).map(s => s[1]).join(", "));
