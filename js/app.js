// Bancada: página de crafts. A lógica das receitas está em motor.js.
import { criarMotor, DESCRICAO_ESPECIAL } from "./motor.js";
import {
  $, sem_acento, esc, base, carregarBase, nome, icHtml, pintaIc, montaTopo, ligaDica,
  atualizaDicaAberta, esconderDica, mostraErro,
} from "./comum.js";

const CATEGORIAS = [
  ["todos", "Todos"],
  ["blocos", "Blocos"],
  ["ferramentas", "Ferramentas"],
  ["combate", "Combate"],
  ["armaduras", "Armaduras"],
  ["comida", "Comida"],
  ["redstone", "Redstone"],
  ["outros", "Outros"],
];
const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS);

const NOME_ESTACAO = {
  furnace: "Fornalha",
  blast_furnace: "Alto-forno",
  smoker: "Defumador",
  campfire: "Fogueira",
};
const LIMITE_USADO = 60;

let receitas, motor;
const porId = base.porId;

const estado = {
  mesa: Array(9).fill(null),
  mao: null,
  selecionado: null,
  cat: "todos",
  soCraftaveis: false,
  texto: "",
  tick: 0,
  usadoTodos: false,
};

const elItens = new Map(); // id -> botão na lista

// ------------------------------------------------------------------ lista de itens
function montaLista() {
  const frag = document.createDocumentFragment();
  for (const it of base.dados.itens) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item";
    b.dataset.id = it.id;
    b.draggable = true;
    b.setAttribute("aria-label", it.pt);
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("role", "listitem");
    b.innerHTML = icHtml(it.id);
    elItens.set(it.id, b);
    frag.appendChild(b);
  }
  $("itens").appendChild(frag);
}

function montaChips() {
  const box = $("chips");
  for (const [k, rot] of CATEGORIAS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.cat = k;
    b.textContent = rot;
    b.setAttribute("aria-pressed", String(k === estado.cat));
    box.appendChild(b);
  }
  const cr = document.createElement("button");
  cr.type = "button";
  cr.className = "chip sep";
  cr.dataset.cr = "1";
  cr.textContent = "Só os da mesa";
  cr.title = "Mostra só os itens que saem da mesa de trabalho";
  cr.setAttribute("aria-pressed", "false");
  box.appendChild(cr);
}

function aplicaFiltro() {
  const palavras = sem_acento(estado.texto.trim()).split(/\s+/).filter(Boolean);
  let n = 0;
  for (const it of base.dados.itens) {
    const ok =
      (estado.cat === "todos" || it.cat === estado.cat) &&
      (!estado.soCraftaveis || it.cr) &&
      palavras.every((p) => it.busca.includes(p));
    elItens.get(it.id).hidden = !ok;
    if (ok) n++;
  }
  const total = base.dados.itens.length;
  $("contagem").textContent = n === total ? `${n} itens` : `${n} de ${total}`;
  $("vazio").hidden = n !== 0;
  $("itens").hidden = n === 0;
}

// ------------------------------------------------------------------ mesa
function montaMesa() {
  const grade = $("grade");
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot";
    b.dataset.i = i;
    b.setAttribute("aria-label", `Quadrado ${Math.floor(i / 3) + 1}, ${(i % 3) + 1}: vazio`);
    grade.appendChild(b);
  }
}

const CHAVE_MESA = "bancada.mesa";
function salvaMesa() {
  try { localStorage.setItem(CHAVE_MESA, JSON.stringify(estado.mesa)); } catch { /* navegador sem armazenamento */ }
}
function leMesa() {
  try {
    const m = JSON.parse(localStorage.getItem(CHAVE_MESA) ?? "null");
    if (Array.isArray(m) && m.length === 9 && m.every((x) => x === null || porId.has(x))) estado.mesa = m;
  } catch { /* guardado estragado: começa vazia */ }
}

function renderMesa() {
  document.querySelectorAll("#grade .slot").forEach((b) => {
    const i = Number(b.dataset.i);
    const id = estado.mesa[i];
    const pos = `Quadrado ${Math.floor(i / 3) + 1}, ${(i % 3) + 1}`;
    if (id) {
      b.dataset.id = id;
      b.draggable = true;
      b.innerHTML = icHtml(id);
      b.setAttribute("aria-label", `${pos}: ${nome(id)}`);
    } else {
      delete b.dataset.id;
      b.draggable = false;
      b.innerHTML = "";
      b.setAttribute("aria-label", `${pos}: vazio`);
    }
  });
  $("limpar").disabled = estado.mesa.every((x) => !x);
  salvaMesa();
  renderResultado();
}

function renderResultado() {
  const res = motor.resolver(estado.mesa);
  const botao = $("resultado");
  const saida = $("saida");
  if (res) {
    botao.disabled = false;
    botao.dataset.id = res.id;
    botao.innerHTML = `${icHtml(res.id)}${res.n > 1 ? `<span class="n">${res.n}</span>` : ""}`;
    botao.setAttribute("aria-label", `Resultado: ${res.n} ${nome(res.id)}`);
    saida.className = "saida";
    saida.innerHTML = `<b>${res.n > 1 ? res.n + "× " : ""}${esc(nome(res.id))}</b>${res.nota ? ` <span class="nota">(${esc(res.nota)})</span>` : ""}`;
  } else {
    botao.disabled = true;
    delete botao.dataset.id;
    botao.innerHTML = "";
    botao.setAttribute("aria-label", "Resultado: nada");
    saida.className = "saida vazia";
    saida.textContent = estado.mesa.some(Boolean)
      ? "Nenhuma receita bate com o que está na mesa."
      : "Mesa vazia. Coloque itens para ver o que sai.";
  }
}

let ultimoPonteiro = null;

function renderMao() {
  const mao = $("mao");
  const id = estado.mao;
  mao.hidden = !id;
  if (id) {
    pintaIc($("mao-ic"), id);
    $("mao-nome").textContent = nome(id);
  }
  const fan = $("fantasma");
  fan.hidden = !id || !matchMedia("(pointer: fine)").matches || !ultimoPonteiro;
  if (id) pintaIc(fan, id);
}

function marcaSelecao() {
  for (const [id, el] of elItens) el.setAttribute("aria-pressed", String(id === estado.selecionado));
}

// ------------------------------------------------------------------ ações
function escolher(id) {
  estado.mao = id;
  estado.selecionado = id;
  estado.usadoTodos = false;
  marcaSelecao();
  renderMao();
  renderReceitas();
  mostraNaLista(elItens.get(id));
}

// rola só a lista (não a página) até o item ficar à vista
function mostraNaLista(el) {
  if (!el || el.hidden) return;
  const cont = $("itens");
  const c = cont.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (r.top < c.top) cont.scrollTop += r.top - c.top - 8;
  else if (r.bottom > c.bottom) cont.scrollTop += r.bottom - c.bottom + 8;
}

function soltar() {
  estado.mao = null;
  renderMao();
}

function colocar(i, id) {
  estado.mesa[i] = id;
  renderMesa();
}

const proximoLivre = () => estado.mesa.findIndex((x) => !x);

function montarReceita(r) {
  const mesa = Array(9).fill(null);
  const pick = (ing) => {
    const a = motor.alternativas(ing);
    return a[estado.tick % a.length];
  };
  if (r.t === "shaped") {
    r.g.forEach((linha, l) => linha.forEach((ing, c) => { if (ing) mesa[l * 3 + c] = pick(ing); }));
  } else if (r.t === "shapeless") {
    r.i.forEach((ing, k) => { mesa[k] = pick(ing); });
  } else {
    return;
  }
  estado.mesa = mesa;
  renderMesa();
}

// ------------------------------------------------------------------ painel "como fazer"
let cartoes = [];

function slotIng(ing) {
  const alts = motor.alternativas(ing);
  if (!alts.length) return `<span class="slot vazio"></span>`;
  const id = alts[estado.tick % alts.length];
  if (alts.length === 1) return `<button type="button" class="slot" data-id="${id}" aria-label="${esc(nome(id))}">${icHtml(id)}</button>`;
  const tag = typeof ing === "string" && ing.startsWith("#") ? ing.slice(1) : "";
  return `<button type="button" class="slot alt" data-id="${id}" data-alts="${alts.join(",")}" data-tag="${tag}" aria-label="Qualquer um: ${esc(alts.slice(0, 6).map(nome).join(", "))}">${icHtml(id)}</button>`;
}

const fmtNum = (n) => String(Number(n.toFixed(2))).replace(".", ",");

function cartaoHtml(r, idx, idAlvo) {
  let corpo, rotulo, desc = "", podeMontar = false;
  const res = (id, n) => `<button type="button" class="slot res-mini" data-id="${id}" aria-label="${esc(nome(id))}">${icHtml(id)}${n > 1 ? `<span class="n">${n}</span>` : ""}</button>`;
  const seta = `<span class="seta" aria-hidden="true">→</span>`;
  if (r.t === "shaped") {
    const w = r.g[0].length;
    rotulo = `Mesa de trabalho · com forma ${w}×${r.g.length}`;
    const cels = r.g.flat().map((ing) => (ing ? slotIng(ing) : `<span class="slot vazio"></span>`)).join("");
    corpo = `<div class="mini-grade" style="--colunas:${w}">${cels}</div>${seta}${res(r.r, r.n)}`;
    podeMontar = true;
  } else if (r.t === "shapeless") {
    rotulo = "Mesa de trabalho · sem forma";
    const n = r.i.length;
    const cols = n <= 4 ? Math.min(n, 2) : 3;
    corpo = `<div class="mini-grade" style="--colunas:${cols}">${r.i.map(slotIng).join("")}</div>${seta}${res(r.r, r.n)}`;
    podeMontar = true;
  } else if (r.t === "cozinhar") {
    rotulo = `${NOME_ESTACAO[r.e]} · ${fmtNum(r.s)} s${r.x ? ` · ${fmtNum(r.x)} de XP` : ""}`;
    corpo = `${slotIng(r.i)}<span class="seta" aria-hidden="true">+</span><button type="button" class="slot" data-id="${r.e}" aria-label="${NOME_ESTACAO[r.e]}">${icHtml(r.e)}</button>${seta}${res(r.r, r.n)}`;
  } else if (r.t === "cortapedra") {
    rotulo = "Cortapedra";
    corpo = `${slotIng(r.i)}<span class="seta" aria-hidden="true">+</span><button type="button" class="slot" data-id="stonecutter" aria-label="Cortapedra">${icHtml("stonecutter")}</button>${seta}${res(r.r, r.n)}`;
  } else if (r.t === "ferraria") {
    rotulo = "Mesa de ferraria";
    corpo = `<div class="mini-grade" style="--colunas:3">${slotIng(r.m)}${slotIng(r.b)}${slotIng(r.a)}</div>${seta}${res(r.r, r.n)}`;
    desc = "Molde, peça e material, nessa ordem, na mesa de ferraria.";
  } else {
    rotulo = "Mesa de trabalho · receita especial";
    desc = DESCRICAO_ESPECIAL[r.k] ?? "";
    corpo = `${seta}${res(idAlvo, 1)}`;
  }
  return `<article class="cartao">
    <div class="cartao-cab"><span class="rotulo">${rotulo}</span>${podeMontar ? `<button type="button" class="btn" data-montar="${idx}">Montar na mesa</button>` : ""}</div>
    <div class="cartao-corpo">${corpo}</div>
    ${desc ? `<p class="desc">${esc(desc)}</p>` : ""}
  </article>`;
}

function usadoHtml(id) {
  const lista = motor.usadoEm(id);
  if (!lista.length) return "";
  const mostrar = estado.usadoTodos ? lista : lista.slice(0, LIMITE_USADO);
  const slots = mostrar.map((x) => `<button type="button" class="slot" data-id="${x}" aria-label="${esc(nome(x))}">${icHtml(x)}</button>`).join("");
  const mais = lista.length > LIMITE_USADO
    ? `<button type="button" class="btn" data-usado-todos="1">${estado.usadoTodos ? "Mostrar menos" : `Mostrar os ${lista.length}`}</button>` : "";
  return `<section class="usado"><div class="cartao-cab"><span class="rotulo">Usado em ${lista.length} ${lista.length === 1 ? "receita" : "receitas"}</span>${mais}</div><div class="usado-grade">${slots}</div></section>`;
}

function renderReceitas() {
  const corpo = $("rec-corpo");
  const id = estado.selecionado;
  cartoes = [];
  if (!id) {
    $("rec-contagem").textContent = "";
    corpo.innerHTML = `<p class="rec-intro">Escolha um item na lista para ver como ele é feito e onde ele é usado. Os ingredientes também são clicáveis: dá para ir descendo até o material bruto.</p>`;
    return;
  }
  const it = porId.get(id);
  const lista = motor.receitasDe(id);
  $("rec-contagem").textContent = lista.length ? `${lista.length} ${lista.length === 1 ? "receita" : "receitas"}` : "";
  cartoes = lista;
  const cartoesHtml = lista.length
    ? lista.map((r, k) => cartaoHtml(r, k, id)).join("")
    : `<p class="sem-receita">${esc(it.pt)} não tem receita de fabricação. Vem do mundo: mineração, loot de baú, drop de mob, pesca ou troca com aldeão.</p>`;
  corpo.innerHTML = `<div class="ficha">
      <span class="slot" data-id="${id}">${icHtml(id)}</span>
      <div><h3>${esc(it.pt)}</h3>
        <p class="sub">${esc(it.en)}</p>
        <p class="rotulo id">${esc(NOME_CATEGORIA[it.cat])} · ${esc(it.id)}</p></div>
    </div>${cartoesHtml}${usadoHtml(id)}`;
}

// os ingredientes com várias opções trocam de item a cada segundo, como na receita do jogo
function giraAlternativas() {
  estado.tick++;
  document.querySelectorAll(".alt").forEach((el) => {
    const alts = el.dataset.alts.split(",");
    const id = alts[estado.tick % alts.length];
    el.dataset.id = id;
    pintaIc(el.firstElementChild, id);
  });
  atualizaDicaAberta();
}

// ------------------------------------------------------------------ eventos
function ligaEventos() {
  document.addEventListener("pointermove", (e) => {
    ultimoPonteiro = { x: e.clientX, y: e.clientY };
    const fan = $("fantasma");
    if (estado.mao && e.pointerType !== "touch") {
      fan.hidden = false;
      fan.style.transform = `translate(${e.clientX + 6}px, ${e.clientY + 6}px)`;
    }
  });

  $("itens").addEventListener("click", (e) => {
    const b = e.target.closest(".item");
    if (!b) return;
    const id = b.dataset.id;
    if (e.shiftKey) {
      const i = proximoLivre();
      if (i >= 0) colocar(i, id);
      estado.selecionado = id;
      estado.usadoTodos = false;
      marcaSelecao();
      renderReceitas();
    } else {
      escolher(id);
    }
  });

  $("grade").addEventListener("click", (e) => {
    const b = e.target.closest(".slot");
    if (!b) return;
    const i = Number(b.dataset.i);
    if (estado.mao && estado.mesa[i] === estado.mao) colocar(i, null); // tocar de novo no mesmo item esvazia (serve no celular)
    else if (estado.mao) colocar(i, estado.mao);
    else if (estado.mesa[i]) escolher(estado.mesa[i]);
  });
  $("grade").addEventListener("contextmenu", (e) => {
    const b = e.target.closest(".slot");
    if (!b) return;
    e.preventDefault();
    colocar(Number(b.dataset.i), null);
  });

  $("resultado").addEventListener("click", () => {
    const id = $("resultado").dataset.id;
    if (id) escolher(id);
  });
  $("limpar").addEventListener("click", () => { estado.mesa = Array(9).fill(null); renderMesa(); });
  $("soltar").addEventListener("click", soltar);

  $("rec-corpo").addEventListener("click", (e) => {
    const m = e.target.closest("[data-montar]");
    if (m) { montarReceita(cartoes[Number(m.dataset.montar)]); return; }
    if (e.target.closest("[data-usado-todos]")) {
      estado.usadoTodos = !estado.usadoTodos;
      renderReceitas();
      return;
    }
    const s = e.target.closest("button.slot[data-id]");
    if (s) escolher(s.dataset.id);
  });

  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    if (b.dataset.cr) {
      estado.soCraftaveis = !estado.soCraftaveis;
      b.setAttribute("aria-pressed", String(estado.soCraftaveis));
    } else {
      estado.cat = b.dataset.cat;
      $("chips").querySelectorAll("[data-cat]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    }
    aplicaFiltro();
  });
  $("busca").addEventListener("input", (e) => { estado.texto = e.target.value; aplicaFiltro(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.activeElement === $("busca") && $("busca").value) { $("busca").value = ""; estado.texto = ""; aplicaFiltro(); }
      else soltar();
    } else if (e.key === "/" && document.activeElement !== $("busca")) {
      e.preventDefault();
      $("busca").focus();
    }
  });

  // arrastar e soltar (item da lista ou de um quadrado para a mesa; quadrado para fora esvazia)
  document.addEventListener("dragstart", (e) => {
    const el = e.target.closest?.("[data-id][draggable='true']");
    if (!el) return;
    const de = el.classList.contains("slot") && el.dataset.i !== undefined ? Number(el.dataset.i) : -1;
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: el.dataset.id, de }));
    e.dataTransfer.effectAllowed = "copyMove";
    esconderDica();
  });
  $("grade").addEventListener("dragover", (e) => {
    if (e.target.closest(".slot")) { e.preventDefault(); e.target.closest(".slot").classList.add("alvo"); }
  });
  $("grade").addEventListener("dragleave", (e) => e.target.closest?.(".slot")?.classList.remove("alvo"));
  $("grade").addEventListener("drop", (e) => {
    const b = e.target.closest(".slot");
    if (!b) return;
    e.preventDefault();
    b.classList.remove("alvo");
    try {
      const { id, de } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (de >= 0 && !e.ctrlKey) estado.mesa[de] = null;
      colocar(Number(b.dataset.i), id);
    } catch { /* arrasto de outra coisa */ }
  });
  $("itens").addEventListener("dragover", (e) => e.preventDefault());
  $("itens").addEventListener("drop", (e) => {
    e.preventDefault();
    try {
      const { de } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (de >= 0) { estado.mesa[de] = null; renderMesa(); }
    } catch { /* arrasto de outra coisa */ }
  });
  document.addEventListener("dragend", () => document.querySelectorAll(".alvo").forEach((x) => x.classList.remove("alvo")));
}

// ------------------------------------------------------------------ início
async function iniciar() {
  const [, rec] = await Promise.all([carregarBase(), fetch("dados/receitas.json").then((r) => r.json())]);
  receitas = rec;
  motor = criarMotor(base.dados, receitas);
  montaTopo("index.html");
  ligaDica();

  montaChips();
  montaLista();
  montaMesa();
  aplicaFiltro();
  leMesa();
  renderMesa();
  renderReceitas();
  ligaEventos();

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(giraAlternativas, 1100);

  // ?item=id abre direto na receita daquele item (as outras páginas ligam para cá desse jeito)
  const pedido = new URLSearchParams(location.search).get("item");
  if (pedido && porId.has(pedido)) escolher(pedido);
  window.bancada = { estado, motor, escolher, colocar, renderMesa }; // para depurar no console
}

iniciar().catch(mostraErro);
