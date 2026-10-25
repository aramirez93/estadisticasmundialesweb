// ============================================================
//  DATOS LOCALES: FMI (datos/imf) y fuentes externas OMS, OIT, OWID (datos/ext)
//  Los descarga a diario una acción de GitHub, así no dependen de que el navegador pueda consultar esas webs.
// ============================================================
const EXT = new Set(["oms", "oit", "owid", "acnur", "unesco"]);
const localC = new Map();
function localCarga(src, id) {
  const k = src + ":" + id;
  if (!localC.has(k)) localC.set(k, (async () => {
    try {
      if (src === "imf") { const j = await fetchJSON(`datos/imf/${id}.json`, 20000); return {vals: ((j.datos || j).values || {})[id] || null, generado: j.generado || ""}; }
      const j = await fetchJSON(`datos/ext/${src}_${id}.json`, 20000); return {vals: j.series || null, generado: j.generado || ""};
    } catch (e) { return {vals: null, generado: ""}; }
  })());
  return localC.get(k);
}
const localValores = (src, id) => localCarga(src, id).then(r => r.vals);
const mpFmiValores = id => localValores("imf", id);
let extEstado = null;
async function cargarExtEstado() {
  try { extEstado = await fetchJSON("datos/ext/_estado.json", 10000); } catch (e) { extEstado = null; }
  EXT.forEach(k => {
    const ok = extEstado && extEstado.fuentes && extEstado.fuentes[k] && extEstado.fuentes[k].ok;
    CATALOGO[k] = ok ? CATALOGO[k].filter(o => ok.includes(o.id)) : [];
  });
}
// Adaptador para el explorador (misma forma que ADAPT.wb / imf)
async function adaptLocal(o, d, h) {
  const r = await localCarga(o.src, o.id);
  if (!r.vals) throw new Error("Estos datos todavía no se han descargado. Se actualizan con la acción «Actualizar datos» de GitHub (Actions → Run workflow).");
  const sc = o.scale || 1, series = new Map();
  Object.entries(r.vals).forEach(([iso0, s]) => {
    const iso = (iso0 === "KOS" || iso0 === "UVK") ? "XKX" : iso0; if (!paisMap.has(iso)) return;
    Object.entries(s).forEach(([y, v]) => { const yy = +y, vv = Number(v) * sc; if (yy < d || yy > h || isNaN(vv)) return; agregar(series, iso, yy, vv); });
  });
  return {series, updated: r.generado ? "copia del sitio del " + r.generado.slice(0, 10) : "", link: FUENTES[o.src].url};
}
