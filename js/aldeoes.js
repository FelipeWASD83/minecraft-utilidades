// Página de aldeões: lê dados/aldeoes.json (escrito à mão, ver o _leia dele).
import { $, sem_acento, esc, base, carregarBase, nome, icHtml, slotItem, montaTopo, ligaDica, mostraErro } from "./comum.js";

const estado = { sel: null, texto: "", modo: "todas" };
let D;

const FILTROS = [["todas", "Todas"], ["vende", "O que eles compram"], ["compra", "O que eles vendem"]];

// "vende" = você vende ao aldeão e recebe esmeralda; "compra" = você paga esmeraldas.
const ehVenda = (t) => t.recebe?.[0] === "emerald";
const ehCompra = (t) => t.da?.some(([id]) => id === "emerald");

function casa(t) {
  if (t.texto) return estado.modo === "todas" && !estado.texto;
  if (estado.modo === "vende" && !ehVenda(t)) return false;
  if (estado.modo === "compra" && !ehCompra(t)) return false;
  const ids = [...t.da.map(([id]) => id), t.recebe[0]];
  const palavras = sem_acento(estado.texto.trim()).split(/\s+/).filter(Boolean);
  return palavras.every((p) => ids.some((id) => base.porId.get(id)?.busca.includes(p)));
}

function qtd(q) {
  return q && q !== "1" ? `<span class="q">${esc(q)}×</span>` : "";
}

function trocaHtml(t) {
  if (t.texto) return `<li class="troca-texto">${esc(t.texto)}</li>`;
  const sep = t.alt ? `<span class="ou">ou</span>` : `<span class="mais">+</span>`;
  const da = t.da.map(([id, q]) => `<span class="item-q">${qtd(q)}${slotItem(id, { link: true })}</span>`).join(sep);
  const [rid, rq] = t.recebe;
  return `<li class="troca">
    <div class="troca-da">${da}</div><span class="seta" aria-hidden="true">→</span>
    <span class="item-q">${qtd(rq)}${slotItem(rid, { link: true })}</span>
    <span class="troca-info"><span class="rotulo">${t.usos} usos</span>${t.nota ? `<span class="nota-peq">${esc(t.nota)}</span>` : ""}</span>
  </li>`;
}

function renderLista() {
  $("lista").innerHTML = D.profissoes.map((p) => {
    const n = p.niveis.flat().filter(casa).length;
    return `<li><button type="button" class="farm-item" data-prof="${p.id}" aria-pressed="${p.id === estado.sel}" ${n ? "" : 'style="opacity:.45"'}>
      <span class="slot" data-id="${p.estacao}">${icHtml(p.estacao)}</span>
      <span class="farm-txt"><b>${esc(p.pt)}</b><span class="rotulo">${n} ${n === 1 ? "troca" : "trocas"}</span></span></button></li>`;
  }).join("");
  $("contagem").textContent = `${D.profissoes.length} profissões`;
}

function renderDetalhe() {
  const p = D.profissoes.find((x) => x.id === estado.sel);
  if (!p) { $("detalhe").innerHTML = `<p class="rec-intro">Escolha uma profissão.</p>`; return; }
  const secoes = p.niveis.map((trocas, i) => {
    const lista = trocas.filter(casa);
    if (!lista.length) return "";
    return `<section class="nivel"><header><span class="num">${i + 1}</span><h4>${esc(D.niveis[i])}</h4></header>
      <ul class="trocas">${lista.map(trocaHtml).join("")}</ul></section>`;
  }).join("");
  $("detalhe").innerHTML = `<article class="farm">
    <header><p class="rotulo">Estação de trabalho: ${esc(nome(p.estacao))}</p><h3>${esc(p.pt)}</h3></header>
    ${secoes || `<p class="sem-receita">Nenhuma troca com esse filtro.</p>`}
  </article>`;
}

function render() { renderLista(); renderDetalhe(); }

function ligaEventos() {
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]");
    if (!b) return;
    estado.modo = b.dataset.m;
    $("chips").querySelectorAll("[data-m]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    render();
  });
  $("busca").addEventListener("input", (e) => { estado.texto = e.target.value; render(); });
  $("lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-prof]");
    if (!b) return;
    estado.sel = b.dataset.prof;
    history.replaceState(null, "", `#${estado.sel}`);
    render();
    if (matchMedia("(max-width: 860px)").matches) $("detalhe").scrollIntoView({ block: "start" });
  });
}

async function iniciar() {
  const [, dados] = await Promise.all([carregarBase(), fetch("dados/aldeoes.json").then((r) => r.json())]);
  D = dados;
  montaTopo("aldeoes.html");
  ligaDica();
  $("chips").innerHTML = FILTROS.map(([k, r]) => `<button type="button" class="chip" data-m="${k}" aria-pressed="${k === estado.modo}">${r}</button>`).join("");
  $("dicas").innerHTML = `<p class="rotulo">Dicas</p><ul>${D.dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`;
  const inicial = location.hash.slice(1);
  estado.sel = D.profissoes.some((p) => p.id === inicial) ? inicial : D.profissoes[0].id;
  render();
  ligaEventos();
}

iniciar().catch(mostraErro);
