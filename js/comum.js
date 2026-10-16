// Peças que todas as páginas da Bancada usam: topo com navegação, rodapé, ícones e dica flutuante.

export const COLUNAS_SPRITE = 40; // tem de bater com img/itens.png (ferramentas/renderizar_icones.py)

const PAGINAS = [
  ["index.html", "Crafts"],
  ["encantamentos.html", "Encantamentos"],
  ["pocoes.html", "Poções"],
  ["aldeoes.html", "Aldeões"],
  ["farms.html", "Farms"],
  ["zerar.html", "Zerar o jogo"],
  ["calculadoras.html", "Calculadoras"],
];

export const $ = (id) => document.getElementById(id);
export const sem_acento = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const base = { dados: null, porId: new Map() };

/** Carrega a lista de itens (nomes, ícones). Toda página chama isto primeiro. */
export async function carregarBase() {
  const dados = await fetch("dados/itens.json").then((r) => r.json());
  dados.itens.forEach((it, i) => {
    it.ic = i;
    it.busca = sem_acento(`${it.pt} ${it.en} ${it.id.replace(/_/g, " ")}`);
    base.porId.set(it.id, it);
  });
  base.dados = dados;
  document.documentElement.style.setProperty("--cols", COLUNAS_SPRITE);
  return base;
}

export const nome = (id) => base.porId.get(id)?.pt ?? id;
export const hrefItem = (id) => `index.html?item=${encodeURIComponent(id)}`;

export function icStyle(id) {
  const it = base.porId.get(id);
  if (!it) return "";
  return `--c:${it.ic % COLUNAS_SPRITE};--r:${Math.floor(it.ic / COLUNAS_SPRITE)}`;
}
export const icHtml = (id) => `<i class="ic" style="${icStyle(id)}"></i>`;

export function pintaIc(el, id) {
  const it = base.porId.get(id);
  if (!it) return;
  el.style.setProperty("--c", it.ic % COLUNAS_SPRITE);
  el.style.setProperty("--r", Math.floor(it.ic / COLUNAS_SPRITE));
}

/** Quadradinho de inventário com o item; vira link para a página de crafts quando `link` for true. */
export function slotItem(id, { link = false, n = 0, cls = "" } = {}) {
  const t = link ? "a" : "span";
  const h = link ? ` href="${hrefItem(id)}"` : "";
  return `<${t} class="slot ${cls}"${h} data-id="${esc(id)}">${icHtml(id)}${n > 1 ? `<span class="n">${n}</span>` : ""}</${t}>`;
}

// ------------------------------------------------------------------ topo e rodapé
export function montaTopo(atual) {
  const links = PAGINAS.map(([href, rot]) =>
    `<a href="${href}"${href === atual ? ' aria-current="page"' : ""}>${rot}</a>`).join("");
  $("topo").innerHTML = `
    <a class="marca" href="index.html" aria-label="Bancada, início">
      <svg class="marca-grade" viewBox="0 0 15 15" width="26" height="26" aria-hidden="true" shape-rendering="crispEdges">
        <rect x="0" y="0" width="4" height="4"/><rect x="5" y="0" width="4" height="4"/><rect x="10" y="0" width="4" height="4"/>
        <rect x="0" y="5" width="4" height="4"/><rect x="5" y="5" width="4" height="4" class="aceso"/><rect x="10" y="5" width="4" height="4"/>
        <rect x="0" y="10" width="4" height="4"/><rect x="5" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/>
      </svg>
      <span class="marca-nome">Bancada</span>
    </a>
    <nav class="nav" aria-label="Seções">${links}</nav>
    <p class="topo-meta rotulo" id="versao">Minecraft Java</p>`;
  $("rodape").innerHTML = `<p class="rotulo">Feito para jogar: dados e texturas lidos do Minecraft Java <span id="versao2"></span>. Minecraft é marca da Mojang Studios. Ferramenta de fã, sem vínculo com a Mojang ou a Microsoft.</p>`;
  if (base.dados) {
    $("versao").textContent = `Minecraft Java ${base.dados.versao}`;
    $("versao2").textContent = base.dados.versao;
  }
}

// ------------------------------------------------------------------ dica flutuante
let dicaEl = null;

function dicaPara(el) {
  const id = el.dataset.id;
  if (!id) return null;
  const alts = el.dataset.alts?.split(",");
  if (alts) {
    const tag = el.dataset.tag;
    const titulo = (tag && base.dados.nomesTag[tag]) || "Qualquer um destes";
    return { t: titulo, s: `agora: ${nome(id)}` };
  }
  const it = base.porId.get(id);
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
export function esconderDica() { $("dica").hidden = true; dicaEl = null; }
export function atualizaDicaAberta() {
  if (dicaEl && !$("dica").hidden) {
    const d = dicaPara(dicaEl);
    if (d) { $("dica-t").textContent = d.t; $("dica-s").textContent = d.s; }
  }
}

/** Liga a dica a qualquer elemento com data-id (item) em qualquer lugar da página. */
export function ligaDica() {
  if (!$("dica")) {
    const d = document.createElement("div");
    d.className = "dica"; d.id = "dica"; d.hidden = true; d.setAttribute("role", "tooltip");
    d.innerHTML = '<b id="dica-t"></b><span id="dica-s"></span>';
    document.body.appendChild(d);
  }
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-id]");
    if (el) mostraDica(el, e.clientX, e.clientY);
    else esconderDica();
  });
  document.addEventListener("mousemove", (e) => { if (!$("dica").hidden && dicaEl) mostraDica(dicaEl, e.clientX, e.clientY); });
  document.addEventListener("mouseleave", esconderDica);
  document.addEventListener("scroll", esconderDica, true);
}

/** Texto de erro padrão quando um JSON não carrega (página aberta por file://, por exemplo). */
export function mostraErro(e) {
  console.error(e);
  const alvo = document.querySelector("main") ?? document.body;
  alvo.innerHTML = `<p class="painel">Não consegui carregar os dados (${esc(e.message)}). Abra a página por um servidor (abrir.bat), não direto do arquivo.</p>`;
}
