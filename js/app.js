// Bancada: tela. A lógica das receitas está em motor.js.
import { criarMotor, DESCRICAO_ESPECIAL } from "./motor.js";

const COLUNAS_SPRITE = 40; // tem de bater com img/itens.png (ferramentas/renderizar_icones.py)

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

const $ = (id) => document.getElementById(id);
const sem_acento = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

async function carregar() {
  const [dados, receitas] = await Promise.all([
    fetch("dados/itens.json").then((r) => r.json()),
    fetch("dados/receitas.json").then((r) => r.json()),
  ]);
  return { dados, receitas };
}

let dados, receitas, motor;
const porId = new Map();

const estado = {
  mesa: Array(9).fill(null),
  mao: null,
  selecionado: null,
  cat: "todos",
  soCraftaveis: false,
  texto: "",
  tick: 0,
};

const elItens = new Map(); // id -> botão na lista

// ------------------------------------------------------------------ ícones
function icStyle(id) {
  const it = porId.get(id);
  if (!it) return "";
  return `--c:${it.ic % COLUNAS_SPRITE};--r:${Math.floor(it.ic / COLUNAS_SPRITE)}`;
}
const icHtml = (id) => `<i class="ic" style="${icStyle(id)}"></i>`;

function pintaIc(el, id) {
  const it = porId.get(id);
  if (!it) return;
  el.style.setProperty("--c", it.ic % COLUNAS_SPRITE);
  el.style.setProperty("--r", Math.floor(it.ic / COLUNAS_SPRITE));
}

const nome = (id) => porId.get(id)?.pt ?? id;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ------------------------------------------------------------------ lista de itens
function montaLista() {
  const frag = document.createDocumentFragment();
  for (const it of dados.itens) {
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
  for (const it of dados.itens) {
    const ok =
      (estado.cat === "todos" || it.cat === estado.cat) &&
      (!estado.soCraftaveis || it.cr) &&
      palavras.every((p) => it.busca.includes(p));
    elItens.get(it.id).hidden = !ok;
    if (ok) n++;
  }
  $("contagem").textContent = n === dados.itens.length ? `${n} itens` : `${n} de ${dados.itens.length}`;
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
  marcaSelecao();
  renderMao();
  renderReceitas();
}

function soltar() {
  estado.mao = null;
  renderMao();
}

function colocar(i, id) {
  estado.mesa[i] = id;
  renderMesa();
}

function proximoLivre() {
  return estado.mesa.findIndex((x) => !x);
}

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

function cartaoHtml(r, idx, idAlvo) {
  let corpo, rotulo, desc = "", podeMontar = false;
  const res = (id, n) => `<span class="slot res-mini" data-id="${id}">${icHtml(id)}${n > 1 ? `<span class="n">${n}</span>` : ""}</span>`;
  if (r.t === "shaped") {
    const w = r.g[0].length;
    rotulo = `Com forma ${w}×${r.g.length}`;
    const cels = r.g.flat().map((ing) => (ing ? slotIng(ing) : `<span class="slot vazio"></span>`)).join("");
    corpo = `<div class="mini-grade" style="--colunas:${w}">${cels}</div><span class="seta">→</span>${res(r.r, r.n)}`;
    podeMontar = true;
  } else if (r.t === "shapeless") {
    rotulo = "Sem forma";
    const n = r.i.length;
    const cols = n <= 4 ? Math.min(n, 2) : 3;
    corpo = `<div class="mini-grade" style="--colunas:${cols}">${r.i.map(slotIng).join("")}</div><span class="seta">→</span>${res(r.r, r.n)}`;
    podeMontar = true;
  } else {
    rotulo = "Receita especial";
    desc = DESCRICAO_ESPECIAL[r.k] ?? "";
    corpo = `<span class="seta">→</span>${res(idAlvo, 1)}`;
  }
  return `<article class="cartao">
    <div class="cartao-cab"><span class="rotulo">${rotulo}</span>${podeMontar ? `<button type="button" class="btn" data-montar="${idx}">Montar na mesa</button>` : ""}</div>
    <div class="cartao-corpo">${corpo}</div>
    ${desc ? `<p class="desc">${esc(desc)}</p>` : ""}
  </article>`;
}

function renderReceitas() {
  const corpo = $("rec-corpo");
  const id = estado.selecionado;
  cartoes = [];
  if (!id) {
    $("rec-contagem").textContent = "";
    corpo.innerHTML = `<p class="rec-intro">Escolha um item na lista para ver como ele é feito. Os ingredientes também são clicáveis: dá para ir descendo até o material bruto.</p>`;
    return;
  }
  const it = porId.get(id);
  const lista = motor.receitasDe(id);
  $("rec-contagem").textContent = lista.length ? `${lista.length} ${lista.length === 1 ? "receita" : "receitas"}` : "";
  cartoes = lista;
  const cartoesHtml = lista.length
    ? lista.map((r, k) => cartaoHtml(r, k, id)).join("")
    : `<p class="sem-receita">${esc(it.pt)} não sai da mesa de trabalho. Pode vir da fornalha, do cortapedra, da bancada de ferraria, de um baú ou do próprio mundo.</p>`;
  corpo.innerHTML = `<div class="ficha">
      <span class="slot" data-id="${id}">${icHtml(id)}</span>
      <div><h3>${esc(it.pt)}</h3>
        <p class="sub">${esc(it.en)}</p>
        <p class="rotulo id">${esc(NOME_CATEGORIA[it.cat])} · ${esc(it.id)}</p></div>
    </div>${cartoesHtml}`;
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

// ------------------------------------------------------------------ dica flutuante
let dicaEl = null;
function dicaPara(el) {
  const id = el.dataset.id;
  if (!id) return null;
  const alts = el.dataset.alts?.split(",");
  if (alts) {
    const tag = el.dataset.tag;
    const titulo = (tag && dados.nomesTag[tag]) || "Qualquer um destes";
    return { t: titulo, s: `agora: ${nome(id)}` };
  }
  const it = porId.get(id);
  return { t: it?.pt ?? id, s: it && it.en !== it.pt ? `${it.en} · ${id}` : id };
}

function mostraDica(el, x, y) {
  const d = dicaPara(el);
  if (!d) return esconderDica();
  $("dica-t").textContent = d.t;
  $("dica-s").textContent = d.s;
  const box = $("dica");
  box.hidden = false;
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = Math.min(x + 16, innerWidth - w - 8) + "px";
  box.style.top = (y + 20 + h > innerHeight ? y - h - 12 : y + 20) + "px";
  dicaEl = el;
}
function esconderDica() { $("dica").hidden = true; dicaEl = null; }
function atualizaDicaAberta() {
  if (dicaEl && !$("dica").hidden) {
    const d = dicaPara(dicaEl);
    if (d) { $("dica-t").textContent = d.t; $("dica-s").textContent = d.s; }
  }
}

// ------------------------------------------------------------------ eventos
let ultimoPonteiro = null;

function ligaEventos() {
  document.addEventListener("pointermove", (e) => {
    ultimoPonteiro = { x: e.clientX, y: e.clientY };
    const fan = $("fantasma");
    if (estado.mao && e.pointerType !== "touch") {
      fan.hidden = false;
      fan.style.transform = `translate(${e.clientX + 6}px, ${e.clientY + 6}px)`;
    }
  });
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-id]");
    if (el && !el.classList.contains("alvo-dnd")) mostraDica(el, e.clientX, e.clientY);
    else esconderDica();
  });
  document.addEventListener("mousemove", (e) => { if (!$("dica").hidden && dicaEl) mostraDica(dicaEl, e.clientX, e.clientY); });
  document.addEventListener("mouseleave", esconderDica);
  document.addEventListener("scroll", esconderDica, true);

  $("itens").addEventListener("click", (e) => {
    const b = e.target.closest(".item");
    if (!b) return;
    const id = b.dataset.id;
    if (e.shiftKey) {
      const i = proximoLivre();
      if (i >= 0) colocar(i, id);
      estado.selecionado = id;
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
  ({ dados, receitas } = await carregar());
  motor = criarMotor(dados, receitas);
  dados.itens.forEach((it, i) => {
    it.ic = i;
    it.busca = sem_acento(`${it.pt} ${it.en} ${it.id.replace(/_/g, " ")}`);
    porId.set(it.id, it);
  });
  document.documentElement.style.setProperty("--cols", COLUNAS_SPRITE);
  $("versao").textContent = `Minecraft Java ${dados.versao}`;
  $("versao2").textContent = dados.versao;
  $("contagem").textContent = "";

  montaChips();
  montaLista();
  montaMesa();
  aplicaFiltro();
  leMesa();
  renderMesa();
  renderReceitas();
  ligaEventos();

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(giraAlternativas, 1100);

  // abre numa pergunta útil: como se faz a mesa de trabalho
  if (new URLSearchParams(location.search).has("item")) {
    const id = new URLSearchParams(location.search).get("item");
    if (porId.has(id)) escolher(id);
  }
  window.bancada = { estado, motor, escolher, colocar, renderMesa }; // para depurar no console
}

iniciar().catch((e) => {
  console.error(e);
  document.querySelector(".app").innerHTML = `<p class="painel">Não consegui carregar os dados (${esc(e.message)}). Abra a página por um servidor (abrir.bat), não direto do arquivo.</p>`;
});
