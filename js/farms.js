// Página de farms: lê dados/farms.json (escrito à mão, ver o _leia dele).
import { $, esc, base, carregarBase, nome, icHtml, slotItem, montaTopo, ligaDica, mostraErro } from "./comum.js";

const estado = { grupo: "todos", sel: null };
let D;

function linha(f) {
  return `<li><button type="button" class="farm-item" data-farm="${f.id}" aria-pressed="${f.id === estado.sel}">
    <span class="slot" data-id="${f.icone}">${icHtml(f.icone)}</span>
    <span class="farm-txt"><b>${esc(f.nome)}</b><span class="rotulo">${esc(f.nivel)} · ${esc(f.onde)}</span></span>
  </button></li>`;
}

function renderLista() {
  const lista = D.farms.filter((f) => estado.grupo === "todos" || f.grupo === estado.grupo);
  $("lista").innerHTML = lista.map(linha).join("");
  $("contagem").textContent = lista.length === D.farms.length ? `${lista.length} farms` : `${lista.length} de ${D.farms.length}`;
}

function renderDetalhe() {
  const f = D.farms.find((x) => x.id === estado.sel);
  if (!f) {
    $("detalhe").innerHTML = `<p class="rec-intro">Escolha uma farm na lista. Cada uma traz o que rende, o que levar e o passo a passo. Os itens são clicáveis e abrem a receita na aba Crafts.</p>`;
    return;
  }
  const materiais = f.materiais.map(([id, obs]) =>
    `<li>${slotItem(id, { link: true })}<span><b>${esc(nome(id))}</b><br><span class="nota-peq">${esc(obs)}</span></span></li>`).join("");
  const rende = f.rende.map((id) => slotItem(id, { link: true })).join("");
  $("detalhe").innerHTML = `
    <article class="farm">
      <header>
        <p class="rotulo">${esc(f.nivel)} · ${esc(f.onde)}</p>
        <h3>${esc(f.nome)}</h3>
        <p class="farm-resumo">${esc(f.resumo)}</p>
      </header>
      <div class="bloco"><p class="rotulo">O que rende</p><div class="aplica-itens">${rende}</div></div>
      <div class="bloco"><p class="rotulo">O que levar</p><ul class="materiais">${materiais}</ul></div>
      <div class="bloco"><p class="rotulo">Passo a passo</p>
        <ol class="passos">${f.passos.map((p, k) => `<li><span class="num">${k + 1}</span><div><p>${esc(p)}</p></div></li>`).join("")}</ol></div>
      ${f.dicas?.length ? `<div class="bloco"><p class="rotulo">Dicas</p><ul class="dicas-lista">${f.dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
      ${f.cuidado ? `<p class="alerta"><b>Cuidado:</b> ${esc(f.cuidado)}</p>` : ""}
    </article>`;
}

function seleciona(id) {
  estado.sel = id;
  history.replaceState(null, "", `#${id}`);
  renderLista();
  renderDetalhe();
  if (matchMedia("(max-width: 860px)").matches) $("detalhe").scrollIntoView({ block: "start" });
}

function ligaEventos() {
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    estado.grupo = b.dataset.g;
    $("chips").querySelectorAll("[data-g]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    renderLista();
  });
  $("lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-farm]");
    if (b) seleciona(b.dataset.farm);
  });
  addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (D.farms.some((f) => f.id === id)) { estado.sel = id; renderLista(); renderDetalhe(); }
  });
}

async function iniciar() {
  const [, dados] = await Promise.all([carregarBase(), fetch("dados/farms.json").then((r) => r.json())]);
  D = dados;
  montaTopo("farms.html");
  ligaDica();
  $("chips").innerHTML = [["todos", "Todas"], ...D.grupos]
    .map(([k, r]) => `<button type="button" class="chip" data-g="${k}" aria-pressed="${k === estado.grupo}">${r}</button>`).join("");
  const inicial = location.hash.slice(1);
  estado.sel = D.farms.some((f) => f.id === inicial) ? inicial : D.farms[0].id;
  renderLista();
  renderDetalhe();
  ligaEventos();
}

iniciar().catch(mostraErro);
