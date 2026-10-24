// ============================================================
//  BUSCADOR DE PAÍSES: filtra mientras se escribe (sin importar tildes ni mayúsculas)
// ============================================================
function buscadorPais({input, lista, onElegir, excluir}) {
  let items = [], act = -1;
  const cerrar = () => { lista.hidden = true; input.setAttribute("aria-expanded", "false"); act = -1; };
  const resaltar = (n, q) => { const i = q ? norm(n).indexOf(q) : -1; return i < 0 ? esc(n) : esc(n.slice(0, i)) + "<mark>" + esc(n.slice(i, i + q.length)) + "</mark>" + esc(n.slice(i + q.length)); };
  function pintar() {
    const q = norm(input.value).trim(), ex = excluir ? excluir() : [], base = paises.filter(p => !p.agg && !ex.includes(p.iso));
    const ini = q ? base.filter(p => norm(p.nombre).startsWith(q)) : base;
    const pal = q ? base.filter(p => !norm(p.nombre).startsWith(q) && norm(p.nombre).split(/[\s,()-]+/).some(w => w.startsWith(q))) : [];
    const con = q ? base.filter(p => !ini.includes(p) && !pal.includes(p) && (norm(p.nombre).includes(q) || p.iso.toLowerCase() === q || (p.capital && norm(p.capital).startsWith(q)))) : [];
    items = ini.concat(pal, con).slice(0, 80);
    lista.innerHTML = items.length ? items.map((p, i) => `<li role="option" data-iso="${p.iso}" class="${i === act ? "act" : ""}">${bandera(p)}<span>${resaltar(p.nombre, q)}</span><small>${esc(CONT_NOMBRE[p.cont] || "")}</small></li>`).join("")
      : `<li class="vacio">Ningún país coincide con «${esc(input.value)}»</li>`;
    lista.hidden = false; input.setAttribute("aria-expanded", "true");
    const a = lista.querySelector(".act"); if (a) a.scrollIntoView({block: "nearest"});
  }
  const elegir = iso => { cerrar(); input.blur(); onElegir(iso); };
  input.addEventListener("input", () => { act = -1; pintar(); });
  input.addEventListener("focus", () => { input.select(); pintar(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (lista.hidden) pintar(); act = items.length ? (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : -1; pintar(); }
    else if (e.key === "Enter") { e.preventDefault(); const p = items[act >= 0 ? act : 0]; if (p) elegir(p.iso); }
    else if (e.key === "Escape") { cerrar(); input.blur(); }
  });
  lista.addEventListener("mousedown", e => { const li = e.target.closest("[data-iso]"); if (li) { e.preventDefault(); elegir(li.dataset.iso); } });
  input.addEventListener("blur", () => setTimeout(cerrar, 100));
}
