// Página de poções: lê dados/pocoes.json (escrito à mão, ver o _leia dele) e monta o passo a passo.
import { $, sem_acento, esc, base, carregarBase, nome, icHtml, slotItem, montaTopo, ligaDica, mostraErro } from "./comum.js";

const TIPOS = [["todos", "Todas"], ["bom", "Boas"], ["ruim", "Para jogar nos outros"], ["neutro", "Outras"]];

const estado = {
  sel: "healing",
  forma: "beber",      // beber | arremessar | prolongada
  nivel: "normal",     // normal | ext | n2
  tipo: "todos",
  texto: "",
};
let D, porId = new Map();

const paraSeg = (t) => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
const deSeg = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Duração final de uma variante, ou null se a poção é instantânea. */
function duracao(p, nivel, forma) {
  const base_ = nivel === "n2" ? p.n2?.dur : nivel === "ext" ? p.ext : p.dur;
  if (!base_) return null;
  const s = paraSeg(base_) * (forma === "prolongada" ? 0.25 : 1);
  return deSeg(s);
}

const temVariante = (p, nivel) => nivel === "normal" || (nivel === "ext" && !!p.ext) || (nivel === "n2" && !!p.n2);

function ing(id, rotulo) {
  return `<div class="passo-item">${slotItem(id, { link: true })}<span>${esc(rotulo ?? nome(id))}</span></div>`;
}

function passos(p) {
  const out = [];
  const modo = estado.nivel;
  if (p.agua) {
    out.push(["Frasco de água no suporte", `${ing("glass_bottle", "Frasco de água")}<span class="mais">+</span>${ing(p.ingr)}`, `Resulta em ${p.pt}.`]);
  } else {
    out.push(["Faça a Poção Estranha", `${ing("glass_bottle", "Frasco de água")}<span class="mais">+</span>${ing("nether_wart")}`, "Encha os frascos de vidro com água e ponha o fungo em cima."]);
    if (p.ingr) {
      out.push([`Escolha o efeito`, `${ing("potion", "Poção Estranha")}<span class="mais">+</span>${ing(p.ingr)}`, `Resulta em ${p.pt}.`]);
    } else {
      const origem = p.de.map((d) => porId.get(d).pt).join(" ou ");
      out.push([`Comece por ${origem}`, p.de.map((d) => ing(d === "healing" ? "glistering_melon_slice" : porIngrediente(d))).join('<span class="ou">ou</span>'), `Faça antes a poção de origem (${origem}).`]);
      out.push(["Corrompa", `${ing("potion", origem.replace(" ou ", " / "))}<span class="mais">+</span>${ing("fermented_spider_eye")}`, `Resulta em ${p.pt}.`]);
    }
  }
  if (modo === "ext") out.push(["Estenda a duração", `${ing("redstone")}`, "Pode ir antes ou depois do passo anterior, mas nunca junto com o pó de glowstone."]);
  if (modo === "n2") out.push(["Suba para o nível II", `${ing("glowstone_dust")}`, "Duração menor, efeito mais forte."]);
  if (estado.forma !== "beber") out.push(["Poção arremessável", `${ing("gunpowder")}`, "Na poção pronta, em qualquer frasco do suporte."]);
  if (estado.forma === "prolongada") out.push(["Poção prolongada", `${ing("dragon_breath")}`, "Só vale sobre uma poção arremessável."]);
  return out;
}

function porIngrediente(id) {
  return porId.get(id)?.ingr ?? "potion";
}

function rotuloVariante() {
  const p = porId.get(estado.sel);
  const nomeBase = estado.nivel === "n2" && p.n2 ? p.n2.nome : p.pt;
  const sufixo = estado.forma === "arremessar" ? "arremessável" : estado.forma === "prolongada" ? "prolongada" : "de beber";
  return `${nomeBase} (${estado.nivel === "ext" ? "estendida, " : ""}${sufixo})`;
}

function renderPrep() {
  const p = porId.get(estado.sel);
  if (!temVariante(p, estado.nivel)) estado.nivel = "normal";
  const dur = duracao(p, estado.nivel, estado.forma);
  const lista = passos(p).map(([titulo, itens, nota], k) =>
    `<li><span class="num">${k + 1}</span><div><p class="passo-t">${esc(titulo)}</p><div class="passo-itens">${itens}</div><p class="nota-peq">${esc(nota)}</p></div></li>`).join("");
  const niveis = [["normal", "Normal"], ["ext", "Estendida"], ["n2", "Nível II"]]
    .map(([k, r]) => `<button type="button" class="chip" data-nivel="${k}" aria-pressed="${estado.nivel === k}" ${temVariante(p, k) ? "" : "disabled"}>${r}</button>`).join("");
  const formas = [["beber", "Beber"], ["arremessar", "Arremessar"], ["prolongada", "Prolongada"]]
    .map(([k, r]) => `<button type="button" class="chip" data-forma="${k}" aria-pressed="${estado.forma === k}">${r}</button>`).join("");
  $("prep").innerHTML = `
    <div class="ficha ficha-poc">
      <span class="slot" data-id="potion">${icHtml("potion")}</span>
      <div><h3>${esc(rotuloVariante())}</h3>
        <p class="sub">${esc(p.efeito)}</p>
        <p class="rotulo id">${dur ? `duração ${dur}` : "efeito instantâneo"}</p></div>
    </div>
    <div class="chips" role="group" aria-label="Versão">${niveis}</div>
    <div class="chips" role="group" aria-label="Forma">${formas}</div>
    ${p.nota ? `<p class="nota-peq">${esc(p.nota)}</p>` : ""}
    <ol class="passos">${lista}</ol>`;
}

function cartao(p) {
  const linhas = [];
  linhas.push(`<li><span>Normal</span><b>${p.dur ?? "instantânea"}</b></li>`);
  if (p.ext) linhas.push(`<li><span>Estendida <i>(+ redstone)</i></span><b>${p.ext}</b></li>`);
  if (p.n2) linhas.push(`<li><span>${esc(p.n2.nome)} <i>(+ glowstone)</i></span><b>${p.n2.dur ?? "instantânea"}</b></li>`);
  const origem = p.ingr
    ? `${slotItem(p.ingr, { link: true })}<span class="rotulo">${p.agua ? "sobre frasco de água" : "sobre Poção Estranha"}</span>`
    : `${p.de.map((d) => slotItem(d === "healing" ? "glistering_melon_slice" : porIngrediente(d), { link: true })).join("")}<span class="rotulo">${esc(p.de.map((d) => porId.get(d).pt).join(" ou "))} + olho fermentado</span>`;
  return `<article class="ench poc" data-poc="${p.id}" aria-current="${p.id === estado.sel}">
    <header><h3>${esc(p.pt)}</h3><span class="tag ${p.tipo === "ruim" ? "acento" : ""}">${p.tipo === "bom" ? "boa" : p.tipo === "ruim" ? "ofensiva" : "outra"}</span></header>
    <p class="desc">${esc(p.efeito)}</p>
    <div class="aplica-itens">${origem}</div>
    <ul class="duracoes">${linhas.join("")}</ul>
    <button type="button" class="btn" data-ver="${p.id}">Ver passo a passo</button>
  </article>`;
}

function visiveis() {
  const palavras = sem_acento(estado.texto.trim()).split(/\s+/).filter(Boolean);
  return D.pocoes.filter((p) => (estado.tipo === "todos" || p.tipo === estado.tipo) &&
    palavras.every((w) => sem_acento(`${p.pt} ${p.efeito} ${p.id.replace(/_/g, " ")}`).includes(w)));
}

function renderLista() {
  const lista = visiveis();
  $("cartoes").innerHTML = lista.map(cartao).join("");
  $("vazio").hidden = lista.length > 0;
  $("contagem").textContent = lista.length === D.pocoes.length ? `${lista.length} poções` : `${lista.length} de ${D.pocoes.length}`;
}

function renderSuporte() {
  $("suporte").innerHTML = `<p class="rotulo">Suporte de poções</p>
    <div class="passo-itens">${slotItem("brewing_stand", { link: true })}${slotItem("blaze_powder", { link: true })}</div>
    <p class="nota-peq">${esc(D.suporte.texto)}</p>
    <p class="rotulo" style="margin-top:16px">Modificadores</p>
    <ul>${D.modificadores.map((m) => `<li>${slotItem(m.item, { link: true, cls: "mini" })} <b>${esc(m.pt)}:</b> ${esc(m.faz)}</li>`).join("")}</ul>`;
}

function ligaEventos() {
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tipo]");
    if (!b) return;
    estado.tipo = b.dataset.tipo;
    $("chips").querySelectorAll("[data-tipo]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    renderLista();
  });
  $("busca").addEventListener("input", (e) => { estado.texto = e.target.value; renderLista(); });
  $("cartoes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ver]");
    if (!b) return;
    estado.sel = b.dataset.ver;
    renderPrep();
    renderLista();
    $("prep").scrollIntoView({ block: "nearest" });
  });
  $("prep").addEventListener("click", (e) => {
    const n = e.target.closest("[data-nivel]");
    const f = e.target.closest("[data-forma]");
    if (n && !n.disabled) estado.nivel = n.dataset.nivel;
    if (f) estado.forma = f.dataset.forma;
    if (n || f) renderPrep();
  });
}

async function iniciar() {
  const [, dados] = await Promise.all([carregarBase(), fetch("dados/pocoes.json").then((r) => r.json())]);
  D = dados;
  D.pocoes.forEach((p) => porId.set(p.id, p));
  montaTopo("pocoes.html");
  ligaDica();
  $("chips").innerHTML = TIPOS.map(([k, r]) => `<button type="button" class="chip" data-tipo="${k}" aria-pressed="${k === estado.tipo}">${r}</button>`).join("");
  renderSuporte();
  renderPrep();
  renderLista();
  ligaEventos();
}

iniciar().catch(mostraErro);
