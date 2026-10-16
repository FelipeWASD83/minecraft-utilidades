// Guia para zerar: lê dados/zerar.json (escrito à mão) e dados/minerios.json (gerado do jogo).
// As tarefas marcadas ficam no localStorage desta origem (chave bancada.zerar).
import { $, esc, base, carregarBase, nome, icHtml, slotItem, montaTopo, ligaDica, mostraErro } from "./comum.js";

const CHAVE = "bancada.zerar";
let D, M;
let feitas = new Set();

function le() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (Array.isArray(v)) feitas = new Set(v.filter((x) => typeof x === "string"));
  } catch { /* guardado estragado: começa do zero */ }
}
function salva() {
  try { localStorage.setItem(CHAVE, JSON.stringify([...feitas])); } catch { /* sem armazenamento */ }
}

const idTarefa = (fase, k) => `${fase.id}-${k}`;
const totalTarefas = () => D.fases.reduce((n, f) => n + f.tarefas.length, 0);

function itensHtml(itens) {
  if (!itens.length) return "";
  return `<div class="tarefa-itens">${itens.map(([id, q]) =>
    `<span class="item-q">${slotItem(id, { link: true })}${q ? `<span class="q">${esc(q)}</span>` : ""}</span>`).join("")}</div>`;
}

function faseHtml(f, i) {
  const tarefas = f.tarefas.map((t, k) => {
    const id = idTarefa(f, k);
    return `<li class="tarefa"><label><input type="checkbox" data-t="${id}" ${feitas.has(id) ? "checked" : ""}>
      <span class="tarefa-txt">${esc(t.texto)}</span></label>${itensHtml(t.itens)}</li>`;
  }).join("");
  return `<section class="fase" id="f-${f.id}">
    <header><p class="rotulo">Etapa ${i + 1} de ${D.fases.length}</p><h3>${esc(f.titulo)}</h3><p class="farm-resumo">${esc(f.resumo)}</p></header>
    <ul class="tarefas">${tarefas}</ul>
    ${f.dicas.length ? `<div class="bloco"><p class="rotulo">Dicas</p><ul class="dicas-lista">${f.dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
  </section>`;
}

// ------------------------------------------------------------------ minérios (altura vem do jogo)
const EXTRA = {
  emerald_ore: "Só em biomas de montanha.",
  gold_ore: "Também em mesas de deserto (badlands), acima de y 32.",
  coal_ore: "Muito comum em qualquer altura.",
  ancient_debris: "Nether. Resiste a explosão e a lava depois de virar netherite.",
  nether_gold_ore: "Nether. Dá pepitas de ouro.",
  nether_quartz_ore: "Nether.",
  redstone_ore: "Lagos de lava perto do fundo: cuidado.",
  diamond_ore: "Abaixo de y -54 há lagos de lava.",
  iron_ore: "Também em cavernas e nas montanhas, em altura 232.",
};

function melhor(m) {
  const picos = [...new Set(m.faixas.map((f) => f.pico).filter((p) => p !== null))];
  if (!picos.length) return "qualquer altura da faixa";
  return picos.map((p) => (p <= -60 ? "no fundo (-64 e logo acima)" : `y ${p}`)).join(" ou ");
}

function minerioHtml() {
  const linhas = M.map((m) => {
    const lo = Math.min(...m.faixas.map((f) => f.min));
    const hi = Math.max(...m.faixas.map((f) => f.max));
    return `<tr><td>${slotItem(m.id, { link: true })}</td><td><b>${esc(nome(m.id))}</b><br><span class="nota-peq">${m.dim === "nether" ? "Nether" : "Overworld"}</span></td>
      <td class="mono">${lo} a ${hi}</td><td>${esc(melhor(m))}<br><span class="nota-peq">${esc(EXTRA[m.id] ?? "")}</span></td></tr>`;
  }).join("");
  return `<section class="fase" id="f-minerios">
    <header><p class="rotulo">Consulta</p><h3>Onde cavar</h3>
      <p class="farm-resumo">A altura (y) de cada minério, lida direto das regras de geração do jogo. Aperte F3 no jogo para ver o seu y.</p></header>
    <div class="tabela-rolagem"><table class="tabela"><thead><tr><th></th><th>Minério</th><th>Faixa de y</th><th>Mais comum</th></tr></thead><tbody>${linhas}</tbody></table></div>
  </section>`;
}

// ------------------------------------------------------------------ tela
function renderToc() {
  $("toc").innerHTML = D.fases.map((f, i) => {
    const total = f.tarefas.length;
    const ok = f.tarefas.filter((_, k) => feitas.has(idTarefa(f, k))).length;
    return `<li><a href="#f-${f.id}" data-ir="f-${f.id}"><span class="num ${ok === total ? "ok" : ""}">${ok === total ? "✓" : i + 1}</span>
      <span><b>${esc(f.titulo)}</b><br><span class="rotulo">${ok} de ${total}</span></span></a></li>`;
  }).join("") + `<li><a href="#f-minerios" data-ir="f-minerios"><span class="num">⛏</span><span><b>Onde cavar</b><br><span class="rotulo">tabela de alturas</span></span></a></li>`;
  const feitasN = D.fases.reduce((n, f) => n + f.tarefas.filter((_, k) => feitas.has(idTarefa(f, k))).length, 0);
  const tot = totalTarefas();
  $("barra").style.width = `${(feitasN / tot) * 100}%`;
  $("progresso-txt").textContent = `${feitasN} de ${tot} tarefas feitas`;
}

function renderGuia() {
  $("guia").innerHTML = D.fases.map(faseHtml).join("") + minerioHtml();
}

function ligaEventos() {
  $("guia").addEventListener("change", (e) => {
    const c = e.target.closest("[data-t]");
    if (!c) return;
    if (c.checked) feitas.add(c.dataset.t); else feitas.delete(c.dataset.t);
    salva();
    renderToc();
  });
  $("toc").addEventListener("click", (e) => {
    const a = e.target.closest("[data-ir]");
    if (!a) return;
    e.preventDefault();
    document.getElementById(a.dataset.ir)?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  $("zerar").addEventListener("click", () => {
    if (!feitas.size || !confirm("Desmarcar todas as tarefas?")) return;
    feitas.clear();
    salva();
    renderGuia();
    renderToc();
  });
}

async function iniciar() {
  const [, dados, minerios] = await Promise.all([
    carregarBase(),
    fetch("dados/zerar.json").then((r) => r.json()),
    fetch("dados/minerios.json").then((r) => r.json()),
  ]);
  D = dados;
  M = minerios;
  montaTopo("zerar.html");
  ligaDica();
  le();
  renderGuia();
  renderToc();
  ligaEventos();
}

iniciar().catch(mostraErro);
