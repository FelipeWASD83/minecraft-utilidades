// Página de encantamentos: lê dados/encantamentos.json (tirado do jogo) e filtra por item.
import { $, sem_acento, esc, base, carregarBase, nome, icHtml, hrefItem, montaTopo, ligaDica, mostraErro } from "./comum.js";

// Itens-exemplo de cada família, na ordem em que aparecem na tela.
const ESCOLHA = [
  "diamond_sword", "diamond_spear", "diamond_axe", "mace", "trident", "bow", "crossbow",
  "diamond_pickaxe", "diamond_shovel", "diamond_hoe", "fishing_rod", "shears",
  "diamond_helmet", "diamond_chestplate", "diamond_leggings", "diamond_boots", "turtle_helmet", "elytra",
  "shield", "flint_and_steel", "carrot_on_a_stick", "brush",
];

const ROMANO = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const rotuloPeso = (p) => (p >= 10 ? "Comum" : p >= 5 ? "Incomum" : p >= 2 ? "Raro" : "Muito raro");

const estado = { item: null, texto: "", filtros: new Set() };
let ench = [], itensTag = {}, porIdEnch = new Map();

const FILTROS = [
  ["tabela", "Na mesa"],
  ["troca", "Com aldeão"],
  ["tesouro", "Só tesouro"],
  ["maldicao", "Maldições"],
];

const serve = (e, item) => itensTag[e.itens]?.includes(item);
const poder = (par, nivel) => par[0] + par[1] * (nivel - 1);

function montaEscolha() {
  const lista = ESCOLHA.filter((id) => base.porId.has(id));
  $("escolha").innerHTML = lista.map((id) =>
    `<button type="button" class="slot" data-id="${id}" data-pick="${id}" aria-pressed="false" aria-label="${esc(nome(id))}">${icHtml(id)}</button>`).join("");
}

function montaChips() {
  $("chips").innerHTML = FILTROS.map(([k, r]) =>
    `<button type="button" class="chip" data-f="${k}" aria-pressed="false">${r}</button>`).join("");
}

function cartao(e) {
  const tags = [];
  if (e.maldicao) tags.push(`<span class="tag acento">Maldição</span>`);
  if (e.tesouro && !e.maldicao) tags.push(`<span class="tag acento">Tesouro</span>`);
  if (e.tabela) tags.push(`<span class="tag">Mesa</span>`);
  if (e.troca) tags.push(`<span class="tag">Aldeão</span>`);
  if (e.loot) tags.push(`<span class="tag">Loot e pesca</span>`);
  const aplica = ESCOLHA.filter((id) => base.porId.has(id) && serve(e, id));
  const conflito = e.exclusivos.length
    ? `<p class="conflito"><span class="rotulo">Não combina com</span> ${e.exclusivos.map((x) => esc(porIdEnch.get(x)?.pt ?? x)).join(", ")}</p>` : "";
  const niveis = Array.from({ length: e.max }, (_, k) => {
    const L = k + 1;
    return `<li><b>${ROMANO[L]}</b> ${poder(e.min, L)} a ${poder(e.maxc, L)}</li>`;
  }).join("");
  return `<article class="ench" data-id-e="${e.id}">
    <header><h3>${esc(e.pt)}</h3><span class="rotulo">nível máx. ${ROMANO[e.max]}</span></header>
    <p class="desc">${esc(e.desc)}</p>
    <div class="tags">${tags.join("")}<span class="tag fraca">${rotuloPeso(e.peso)}</span></div>
    ${conflito}
    <div class="aplica"><span class="rotulo">Serve em</span>
      <div class="aplica-itens">${aplica.map((id) => `<a class="slot mini" href="${hrefItem(id)}" data-id="${id}" aria-label="${esc(nome(id))}">${icHtml(id)}</a>`).join("")}${aplica.length ? "" : '<span class="nota-peq">livros e itens de comando</span>'}</div>
    </div>
    <details><summary>Poder necessário na mesa e custo na bigorna</summary>
      ${e.tabela ? `<ul class="niveis">${niveis}</ul><p class="nota-peq">Faixa de “poder de encantamento” que sorteia o nível.</p>` : '<p class="nota-peq">Não sai na mesa de encantamento.</p>'}
      <p class="nota-peq">Bigorna: multiplicador ${e.bigorna} com item e ${Math.max(1, Math.floor(e.bigorna / 2))} com livro, vezes o nível final.</p>
    </details>
  </article>`;
}

function visiveis() {
  const palavras = sem_acento(estado.texto.trim()).split(/\s+/).filter(Boolean);
  return ench.filter((e) => {
    if (estado.item && !serve(e, estado.item)) return false;
    for (const f of estado.filtros) if (!e[f]) return false;
    const alvo = sem_acento(`${e.pt} ${e.en} ${e.id.replace(/_/g, " ")} ${e.desc}`);
    return palavras.every((p) => alvo.includes(p));
  });
}

// Encantamentos que cabem no item. Os que se barram formam um grupo; dentro do grupo, cada "opção"
// é um conjunto que combina entre si (Lealdade e Condutividade juntas, ou só Correnteza).
function sugestao(item) {
  const cab = ench.filter((e) => serve(e, item) && !e.maldicao);
  const ids = new Set(cab.map((e) => e.id));
  const barra = (x, y) => porIdEnch.get(x).exclusivos.includes(y);
  const visto = new Set();
  const grupos = [];
  for (const e of cab) {
    if (visto.has(e.id)) continue;
    const comp = [];
    const fila = [e.id];
    while (fila.length) {
      const x = fila.pop();
      if (visto.has(x)) continue;
      visto.add(x);
      comp.push(x);
      for (const y of porIdEnch.get(x).exclusivos) if (ids.has(y) && !visto.has(y)) fila.push(y);
    }
    // conjuntos de convivência máximos (o grupo tem poucos membros, então vale tentar todos)
    const livres = [];
    for (let mascara = 1; mascara < 1 << comp.length; mascara++) {
      const set = comp.filter((_, i) => mascara & (1 << i));
      if (set.every((x, i) => set.every((y, j) => i === j || !barra(x, y)))) livres.push(set);
    }
    const maximos = livres.filter((a) => !livres.some((b) => b.length > a.length && a.every((x) => b.includes(x))));
    grupos.push(maximos);
  }
  return grupos;
}

function render() {
  const lista = visiveis();
  $("cartoes").innerHTML = lista.map(cartao).join("");
  $("vazio").hidden = lista.length > 0;
  $("contagem").textContent = lista.length === ench.length ? `${ench.length} encantamentos` : `${lista.length} de ${ench.length}`;
  $("limpar").hidden = !estado.item;
  document.querySelectorAll("[data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === estado.item)));

  const sug = $("sugestao");
  if (estado.item) {
    $("resumo").innerHTML = `<b>${esc(nome(estado.item))}</b>: ${lista.length} ${lista.length === 1 ? "encantamento serve" : "encantamentos servem"}.`;
    const grupos = sugestao(estado.item);
    const nomeNivel = (x) => `${esc(porIdEnch.get(x).pt)} ${ROMANO[porIdEnch.get(x).max]}`;
    $("sugestao-lista").innerHTML = grupos.map((opcoes) =>
      `<li>${opcoes.map((set) => set.map(nomeNivel).join(" + ")).join(' <span class="ou">ou</span> ')}</li>`).join("");
    sug.hidden = false;
  } else {
    $("resumo").textContent = "Escolha um item para ver só o que serve nele e o que cabe junto.";
    sug.hidden = true;
  }
}

function ligaEventos() {
  $("escolha").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    estado.item = estado.item === b.dataset.pick ? null : b.dataset.pick;
    render();
  });
  $("limpar").addEventListener("click", () => { estado.item = null; render(); });
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const f = b.dataset.f;
    if (estado.filtros.has(f)) estado.filtros.delete(f); else estado.filtros.add(f);
    b.setAttribute("aria-pressed", String(estado.filtros.has(f)));
    render();
  });
  $("busca").addEventListener("input", (e) => { estado.texto = e.target.value; render(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== $("busca")) { e.preventDefault(); $("busca").focus(); }
    else if (e.key === "Escape" && estado.item) { estado.item = null; render(); }
  });
}

async function iniciar() {
  const [, dados] = await Promise.all([carregarBase(), fetch("dados/encantamentos.json").then((r) => r.json())]);
  ench = dados.encantamentos;
  itensTag = dados.itensTag;
  porIdEnch = new Map(ench.map((e) => [e.id, e]));
  montaTopo("encantamentos.html");
  ligaDica();
  montaEscolha();
  montaChips();
  ligaEventos();
  const pedido = new URLSearchParams(location.search).get("item");
  if (pedido && base.porId.has(pedido)) estado.item = pedido;
  render();
}

iniciar().catch(mostraErro);
