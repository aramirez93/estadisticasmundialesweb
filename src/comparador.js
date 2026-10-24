// ============================================================
//  COMPARADOR · HISTORIAL: una tarjeta por indicador, con la evolución de cada país elegido
// ============================================================
const CM = {secs: [], abiertas: new Set(["esencial"]), token: 0};
let cmGraficos = [];
const cmNombre = iso => paisMap.get(iso).nombre;
function cmDestruir() { cmGraficos.forEach(g => g.destroy()); cmGraficos = []; }

function cmLectura(o, filas) {
  const con = filas.filter(f => f.s.length); if (con.length < 2) return con.length ? `Solo ${esc(cmNombre(con[0].iso))} tiene datos de este indicador.` : "";
  const ult = con.map(f => ({iso: f.iso, v: f.s[f.s.length - 1].v, y: f.s[f.s.length - 1].y})), ord = ult.slice().sort((a, b) => b.v - a.v);
  const L = [], nom = cmNombre;
  L.push(`<b>${esc(nom(ord[0].iso))}</b> tiene el valor más alto (${esc(mpFmt(ord[0].v, o))}) y <b>${esc(nom(ord[ord.length - 1].iso))}</b> el más bajo (${esc(mpFmt(ord[ord.length - 1].v, o))}).`);
  const mej = mejorIso(o, ult); if (mej && o.tone !== "neutral") L.push(`Mejor situación: <b>${esc(nom(mej))}</b>.`);
  if (mpTasa(o)) {
    const pr = con.map(f => { const a = f.s.slice(-10); return {iso: f.iso, v: a.reduce((t, p) => t + p.v, 0) / a.length}; });
    L.push(`Promedio de los últimos 10 años: ` + pr.map(x => `${esc(nom(x.iso))} ${esc(mpFmt(x.v, o))}`).join(" · ") + ".");
  } else {
    const cs = con.map(f => { const last = f.s[f.s.length - 1], ref = f.s.slice().reverse().find(p => p.y <= last.y - 10); if (!ref) return null; const c = mpCambio(o, ref.v, last.v); return {iso: f.iso, txt: c.txt, rel: c.rel, anos: last.y - ref.y}; }).filter(Boolean);
    if (cs.length > 1) { const mx = cs.slice().sort((a, b) => b.rel - a.rel)[0]; L.push(`En unos 10 años, ` + cs.map(x => `${esc(nom(x.iso))} ${esc(x.txt)}`).join("; ") + `. Mayor aumento: <b>${esc(nom(mx.iso))}</b>.`); }
  }
  return L.join(" ");
}
function cmTarjeta(o) {
  const isos = PS.sel, filas = isos.map((iso, k) => ({iso, k, s: mpHist.get(iso + "|" + o.key) || [], x: mpExtra.get(iso + "|" + o.key) || []})), fuente = FUENTES[o.src] || FUENTES.wb;
  const hayProy = filas.some(f => f.s.length && f.x.some(p => p.y > f.s[f.s.length - 1].y));
  const vals = filas.map(f => {
    const nombre = esc(cmNombre(f.iso)), pt = `<i class="pt" style="background:${serieColor(f.k)}"></i>`;
    if (!f.s.length) return `<div class="cm-fila vacio">${pt}<span>${nombre}</span><em>sin datos publicados</em></div>`;
    const last = f.s[f.s.length - 1], an = mpAnalisis(o, f.s), r = mpRango(o, f.iso);
    return `<div class="cm-fila">${pt}<span>${nombre}</span><b>${esc(mpFmt(last.v, o))}</b><small>${last.y}</small>${an.etiqueta ? `<span class="mp-tag ${an.clase}">${esc(an.etiqueta)}</span>` : ""}${r ? `<small>puesto ${r.puesto} de ${r.n}</small>` : ""}</div>`;
  }).join("");
  const base = PS.evoModo === "base" && !mpTasa(o) && filas.filter(f => f.s.length).every(f => f.s.some(p => p.v > 0));
  const nota = PS.evoModo === "base" && !base ? " Este indicador no admite índice base 100; se muestran valores reales." : "";
  return `<article class="mp-card" data-k="${esc(o.key)}"><div><h4>${esc(o.name)}</h4><span class="u">${esc(o.unit || "")}${base ? " · índice (primer año = 100)" : ""}</span></div>` +
    `<p class="que">${esc(o.desc || "")}</p><div class="cm-vals">${vals}</div>` +
    `<div class="mp-graf"><canvas role="img" aria-label="Evolución de ${esc(o.name)}" data-k="${esc(o.key)}"></canvas></div>` +
    `<p class="mp-lee">${cmLectura(o, filas)}</p><p class="mp-leyenda">${hayProy ? "Línea punteada: estimación o proyección del FMI. " : ""}${esc(nota.trim())}</p>` +
    `<div class="mp-pie"><span>${esc(TONO_TXT[o.tone] || "")}</span><a href="${esc(fuente.url)}" target="_blank" rel="noopener">${esc(fuente.corto)}</a></div></article>`;
}
function cmGraficar(cv, o) {
  const isos = PS.sel, base = PS.evoModo === "base" && !mpTasa(o), pts = isos.map(iso => (mpHist.get(iso + "|" + o.key) || []).concat(mpExtra.get(iso + "|" + o.key) || []).filter((p, i, a) => i === 0 || p.y > a[i - 1].y));
  const obs = isos.map(iso => mpHist.get(iso + "|" + o.key) || []);
  const okBase = base && obs.filter(s => s.length).every(s => s.some(p => p.v > 0));
  let y0 = 9999, y1 = 0; pts.forEach(a => a.forEach(p => { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); })); if (y1 === 0) return;
  const labels = []; for (let y = y0; y <= y1; y++) labels.push(y);
  const ds = isos.map((iso, i) => {
    const m = new Map(pts[i].map(p => [p.y, p.v])), ultObs = obs[i].length ? obs[i][obs[i].length - 1].y : 0, b0 = okBase ? (obs[i].find(p => p.v > 0) || {}).v : 1;
    return {label: cmNombre(iso), borderColor: serieColor(i), backgroundColor: serieColor(i), borderWidth: 2.3, pointRadius: labels.map(y => y === ultObs ? 3.6 : 0), pointHoverRadius: 5, tension: .2, spanGaps: true,
      segment: {borderDash: c => labels[c.p1DataIndex] > ultObs ? [6, 4] : undefined}, data: labels.map(y => { const v = m.get(y); return v === undefined ? null : okBase ? v / b0 * 100 : v; })};
  });
  const f = v => okBase ? num(v, 0) : (o.pre || "") + mpAbrev(v, o) + (o.suf || ""), ft = v => okBase ? num(v, 1) : mpFmt(v, o);
  Chart.defaults.color = css("--suave"); Chart.defaults.font.family = css("--sans"); Chart.defaults.font.size = 11; Chart.defaults.borderColor = css("--linea");
  cmGraficos.push(new Chart(cv, {type: "line", data: {labels, datasets: ds}, options: {responsive: true, maintainAspectRatio: false, layout: {padding: {top: 8, right: 6}}, interaction: {mode: "index", intersect: false},
    plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${ft(c.parsed.y)}`}}},
    scales: {y: {grace: "6%", ticks: {callback: v => f(v), maxTicksLimit: MOVIL() ? 4 : 5}}, x: {grid: {display: false}, ticks: {maxRotation: 0, autoSkip: true, maxTicksLimit: MOVIL() ? 5 : 9}}}}}));
}
function cmPintarSec(sec) {
  const cuerpo = $("cmb-" + sec.id); if (!cuerpo) return;
  cmGraficos = cmGraficos.filter(g => { if (g.canvas && cuerpo.contains(g.canvas)) { g.destroy(); return false; } return true; });
  const tiene = o => PS.sel.some(i => (mpHist.get(i + "|" + o.key) || []).length), con = sec.inds.filter(tiene), sin = sec.inds.filter(o => !tiene(o));
  cuerpo.innerHTML = con.map(cmTarjeta).join("") + (sin.length ? `<p class="mp-sin">Ningún país elegido tiene datos publicados de: ${sin.map(o => esc(o.name)).join(" · ")}.</p>` : "");
  if (typeof Chart === "undefined") { cuerpo.querySelectorAll(".mp-graf").forEach(x => x.remove()); return; }
  con.forEach(o => { const cv = cuerpo.querySelector(`canvas[data-k="${CSS.escape(o.key)}"]`); if (cv) try { cmGraficar(cv, o); } catch (e) { console.error(e); cv.parentNode.remove(); } });
}
async function cmCargarSec(sec) {
  if (sec.estado === "cargando") return;
  const tok = CM.token, cuerpo = $("cmb-" + sec.id), isos = PS.sel.slice(); sec.estado = "cargando";
  if (sec.estado0 !== "ok") cuerpo.innerHTML = `<div class="mp-cargando" style="grid-column:1/-1">Cargando ${sec.inds.length} indicadores…</div>`;
  let fallos = 0, ult = null;
  await Promise.all(sec.inds.map(o => mpDatos(o, isos).catch(e => { fallos++; ult = e; })));
  if (tok !== CM.token) return;
  if (fallos === sec.inds.length) { sec.estado = "err"; cuerpo.innerHTML = `<div class="mp-cargando" style="grid-column:1/-1">No se pudo consultar: ${esc(explicarError(ult, "la fuente de datos"))} <button class="btn sec" data-cm-reint="${sec.id}">Reintentar</button></div>`; return; }
  sec.estado = "ok"; sec.estado0 = "ok"; cmPintarSec(sec);
  if (fallos) cuerpo.insertAdjacentHTML("beforeend", `<p class="mp-sin">${fallos} indicador(es) no se pudieron consultar. <button class="btn sec" data-cm-reint="${sec.id}">Reintentar</button></p>`);
}
function cmAbrir(id, desplazar) {
  const d = $("cms-" + id); if (!d) return; d.open = true; CM.abiertas.add(id); const s = CM.secs.find(x => x.id === id); if (s && s.estado !== "ok") cmCargarSec(s);
  if (desplazar) d.scrollIntoView({behavior: "smooth", block: "start"});
}
function cmRender() {                       // se llama cada vez que cambian los países o el modo de graficar
  CM.token++; cmDestruir(); CM.secs = mpSecciones();
  $("cmNav").innerHTML = CM.secs.map(s => `<button class="pill" data-cm-ir="${s.id}">${esc(s.titulo)}</button>`).join("");
  $("cmSecs").innerHTML = CM.secs.map(s => `<details class="mp-sec" id="cms-${s.id}" data-sec="${s.id}"${CM.abiertas.has(s.id) ? " open" : ""}><summary><div><h3>${esc(s.titulo)}</h3><div class="sub">${esc(s.sub)} · ${s.inds.length} indicadores</div></div></summary><div class="mp-cuerpo" id="cmb-${s.id}"></div></details>`).join("");
  CM.secs.forEach(s => { if (CM.abiertas.has(s.id)) cmCargarSec(s); });
}
function cmRedibujar() { CM.secs.forEach(s => { if (s.estado === "ok") cmPintarSec(s); }); }
function eventosComparador() {
  $("cmNav").addEventListener("click", e => { const b = e.target.closest("[data-cm-ir]"); if (b) cmAbrir(b.dataset.cmIr, true); });
  $("cmSecs").addEventListener("toggle", e => { const d = e.target, id = d.dataset && d.dataset.sec; if (!id) return; if (d.open) { CM.abiertas.add(id); const s = CM.secs.find(x => x.id === id); if (s && s.estado !== "ok" && s.estado !== "cargando") cmCargarSec(s); } else CM.abiertas.delete(id); }, true);
  $("cmSecs").addEventListener("click", e => { const b = e.target.closest("[data-cm-reint]"); if (b) { const s = CM.secs.find(x => x.id === b.dataset.cmReint); s.estado = ""; s.estado0 = ""; cmCargarSec(s); } });
}
