// Descarga los datos del FMI (DataMapper) y los guarda en datos/imf/ para que la web los use
// cuando el navegador no pueda consultar al FMI directamente. Se ejecuta con GitHub Actions.
import fs from "node:fs";
const BASE = "https://www.imf.org/external/datamapper/api/v1";
const IDS = ["indicators", "NGDPD", "NGDPDPC", "PPPPC", "NGDP_RPCH", "PCPIPCH", "PCPIEPCH", "LUR", "GGXWDG_NGDP", "GGXCNL_NGDP", "BCA_NGDPD", "LP",
  "PPPSH", "rev", "exp", "ie", "pb", "Privatedebt_all", "HH_ALL", "NFC_ALL", "AI_PI", "GII_TC", "total_theil", "SITC1_total"];
fs.mkdirSync("datos/imf", {recursive: true});
async function bajar(id) {
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch(`${BASE}/${id}`, {headers: {"User-Agent": "Mozilla/5.0 (compatible; estadisticas-mundiales-bot)", "Accept": "application/json"}});
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { console.warn(id, "intento", i, e.message); await new Promise(r => setTimeout(r, 2000 * i)); }
  }
  return null;
}
let fallos = 0;
for (const id of IDS) {
  const datos = await bajar(id);
  if (!datos) { fallos++; continue; }
  const f = `datos/imf/${id}.json`;
  let previo = null; try { previo = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
  if (previo && JSON.stringify(previo.datos) === JSON.stringify(datos)) { console.log(id, "sin cambios"); continue; }
  fs.writeFileSync(f, JSON.stringify({generado: new Date().toISOString(), datos}));
  console.log(id, "actualizado");
}
if (fallos === IDS.length) { console.error("No se pudo descargar nada del FMI"); process.exit(1); }
